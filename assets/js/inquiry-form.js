(function () {
  const form = document.querySelector("[data-inquiry-form]");
  if (!form) return;

  const status = document.getElementById("inquiry-status");
  const submit = form.querySelector("button[type='submit']");
  const messages = {
    en: {
      sending: "Sending…",
      success: "Thank you—your inquiry has been received. We’ll be in touch.",
      error: "We couldn’t send your inquiry. Please try again."
    },
    ja: {
      sending: "送信中…",
      success: "お問い合わせを受け付けました。担当者よりご連絡します。",
      error: "送信できませんでした。時間をおいて再度お試しください。"
    },
    zh: {
      sending: "正在提交…",
      success: "咨询已收到，我们会尽快与你联系。",
      error: "提交失败，请稍后重试。"
    }
  };

  function currentMessages() {
    const language = document.documentElement.lang.toLowerCase();
    if (language.startsWith("ja")) return messages.ja;
    if (language.startsWith("zh")) return messages.zh;
    return messages.en;
  }

  function setState(state, text) {
    status.dataset.state = state;
    status.textContent = text;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const copy = currentMessages();
    const originalLabel = submit.textContent;
    form.setAttribute("aria-busy", "true");
    submit.disabled = true;
    submit.textContent = copy.sending;
    setState("", "");

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          route: data.get("route"),
          message: data.get("message"),
          website: data.get("website"),
          language: document.documentElement.lang,
          sourcePath: window.location.pathname
        })
      });

      if (!response.ok) throw new Error("submit_failed");
      form.reset();
      setState("success", copy.success);
    } catch {
      setState("error", copy.error);
    } finally {
      form.removeAttribute("aria-busy");
      submit.disabled = false;
      submit.textContent = originalLabel;
    }
  });
})();
