# Japan Atelier Trips 图片素材包使用说明

本素材包根据《图片素材说明_全中文版》中的 Fig.1-Fig.32 图片需求整理。

## 文件夹结构

- `selected_figures/`：已按 Fig 编号整理好的网页候选图片，均已压缩为适合网页预览与开发使用的 JPEG；Fig.7 为 SVG 路线地图；Fig.20、Fig.22、Fig.30 为需授权素材说明文件。
- `metadata/figure_mapping.csv`：每个 Fig 编号对应的建议用途、源文件、授权状态和注意事项。
- `metadata/attribution_manifest.csv`：去重后的图片来源、作者和许可证信息。
- `metadata/contact_sheet.jpg`：所有已下载候选图片的缩略预览。

## 重要版权说明

1. 本包优先使用 Wikimedia Commons、CC0、Public Domain 或 Creative Commons 授权图片。
2. CC BY / CC BY-SA 图片上线时必须保留署名、许可证链接，并说明是否修改。
3. CC BY-SA 图片如果被改作，衍生作品可能需要以相同或兼容许可证发布；正式商用前请做法律复核。
4. 吉卜力、USJ/任天堂、东京迪士尼等强 IP 素材没有直接抓取下载，已以 `REQUIRES_LICENSED_ASSET` 文件标注。正式网站请使用官方授权、图库授权或自有合规照片。
5. 涉及人物、商标、建筑和美术馆/艺术品的图片，即便图片本身有开源授权，也可能存在肖像权、商标权、建筑/艺术品权利或场馆拍摄规则问题。正式商业上线前请再次确认。

## 推荐使用方式

开发阶段可直接将 `selected_figures/` 中的文件按 Fig 编号替换网页图片位置；正式上线前，以 `figure_mapping.csv` 为依据逐张确认版权和替换必要的授权素材。
