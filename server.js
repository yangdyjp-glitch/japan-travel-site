const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname);
const PORT = Number(process.env.PORT || 3000);
const SUPABASE_URL = (process.env.SUPABASE_URL || "https://rqboffsihgilxpnktuxm.supabase.co").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || "sb_publishable_J-8C1-APN9g2jJ7JQYIr-w_UhnH655w";
const MAX_BODY_BYTES = 20 * 1024;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 5;
const rateBuckets = new Map();
const allowedRoutes = new Set([
  "craft-culture",
  "powder-snow",
  "anime-kingdom",
  "sanin-setouchi-art",
  "tokyo-halloween"
]);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp"
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

function getClientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0].trim();
  return request.socket.remoteAddress || "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  const current = rateBuckets.get(ip);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(ip, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("payload_too_large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    request.on("error", reject);
  });
}

function normalizeInquiry(input) {
  const requestedLanguage = String(input.language || "en").trim().toLowerCase();
  const language = requestedLanguage.startsWith("ja")
    ? "ja"
    : requestedLanguage.startsWith("zh")
      ? "zh-CN"
      : "en";
  const sourcePath = String(input.sourcePath || "/").trim();
  const inquiry = {
    name: String(input.name || "").trim(),
    email: String(input.email || "").trim().toLowerCase(),
    route: String(input.route || "").trim(),
    message: String(input.message || "").trim(),
    language,
    source_path: (sourcePath || "/").slice(0, 300)
  };

  if (inquiry.name.length < 1 || inquiry.name.length > 120) return null;
  if (inquiry.email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inquiry.email)) return null;
  if (!allowedRoutes.has(inquiry.route)) return null;
  if (inquiry.message.length < 1 || inquiry.message.length > 2000) return null;
  return inquiry;
}

async function handleInquiry(request, response) {
  if (request.method !== "POST") {
    response.writeHead(405, { Allow: "POST" });
    response.end();
    return;
  }

  if (!String(request.headers["content-type"] || "").includes("application/json")) {
    sendJson(response, 415, { ok: false, error: "unsupported_media_type" });
    return;
  }

  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    sendJson(response, 429, { ok: false, error: "too_many_requests" });
    return;
  }

  let input;
  try {
    input = await readJsonBody(request);
  } catch (error) {
    sendJson(response, error.message === "payload_too_large" ? 413 : 400, { ok: false, error: error.message });
    return;
  }

  if (String(input.website || "").trim()) {
    sendJson(response, 201, { ok: true });
    return;
  }

  const inquiry = normalizeInquiry(input);
  if (!inquiry) {
    sendJson(response, 422, { ok: false, error: "invalid_fields" });
    return;
  }

  if (!SUPABASE_KEY) {
    console.error("Inquiry storage is not configured: missing SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY.");
    sendJson(response, 503, { ok: false, error: "storage_unavailable" });
    return;
  }

  try {
    const upstream = await fetch(`${SUPABASE_URL}/rest/v1/inquiries`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(inquiry),
      signal: AbortSignal.timeout(10000)
    });

    if (!upstream.ok) {
      console.error(`Supabase inquiry insert failed with status ${upstream.status}.`);
      sendJson(response, 502, { ok: false, error: "storage_failed" });
      return;
    }

    sendJson(response, 201, { ok: true });
  } catch (error) {
    console.error(`Inquiry insert failed: ${error.name || "request_error"}.`);
    sendJson(response, 502, { ok: false, error: "storage_failed" });
  }
}

function staticFilePath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const resolved = path.resolve(ROOT, relative);
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) return null;
  return resolved;
}

function serveStatic(request, response) {
  const filePath = staticFilePath(request.url || "/");
  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
      "Cache-Control": extension === ".html" || extension === ".css" || extension === ".js"
        ? "no-cache"
        : "public, max-age=86400",
      "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY"
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

const server = http.createServer((request, response) => {
  if ((request.url || "").split("?")[0] === "/api/inquiries") {
    handleInquiry(request, response);
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }
  serveStatic(request, response);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Japan Atelier Trips listening on port ${PORT}.`);
});
