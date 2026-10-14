# 像素素材工坊 · Pixel Asset Workshop

[English](README.md) · [详细使用说明](docs/guide.zh-CN.md) · [助手调用说明](docs/agents.zh-CN.md) · [MIT 许可证](LICENSE)

本地离线的像素人物、骨骼动作与程序化技能特效工具。双击 **index.html**
即可在桌面 Chrome / Edge 使用，无需账号、密钥、联网或安装依赖。
界面为简体中文。**关闭或刷新前必须保存项目 JSON，本版没有自动保存。**

![离线编辑器](docs/images/editor.png)

![程序生成的冰爆关键帧](docs/images/ice-burst.png)

## 可以制作什么

- 人物：32、48、64、96、128、256、512 像素，像素编辑、分层、复制帧、洋葱皮和透明 PNG 导入。
- 动作：17 关节骨骼、两段腿部 IK、多关节手臂、武器跟随手腕和图片蒙皮，烘焙待机、走、跑、攻击序列帧。
- 特效：火、冰、雷、治疗、风五组程序模板，最多六部件，调整时序、缩放、旋转、变化曲线、亮光叠加及导入 PNG 图集。
- 交付：透明 PNG 单帧与图集、播放 JSON、可编辑项目、特效配方；助手导出另含带背景的预览图。
- 助手调用：CLI 与可选本地 stdio MCP，结构化 JSON、稳定部件 ID、参数校验和逐帧边界诊断。

## 命令行快速开始

仅命令行需要 Node.js 22+ 和已安装的 Chrome / Chromium，无 npm 依赖：

```sh
git clone https://github.com/956005596/pixel-asset-workshop.git
cd pixel-asset-workshop
node cli.mjs doctor
node cli.mjs run --request examples/ice-burst.json --out outputs/ice-burst
npm run check
npm test
```

每次输出写新目录，已有目录拒绝覆盖。返回 JSON 中的 previewPath 用于看图，
sheetPath 用于透明图集，projectPath 用于继续修改。预览带背景，不能冒充透明素材。
未找到浏览器时，用 PIXEL_WORKSHOP_BROWSER 指定浏览器可执行文件路径。

## 范围与限制

这是个人游戏素材工具的首个公开版本，尚无公开使用量或下载量统计。
人物专用 CLI 编辑接口尚未提供，需在网页调整；CLI/MCP 主要操作特效并保留人物数据。
骨骼功能导出烘焙图片，不能作为游戏引擎实时骨骼运行时。单图不会补画被遮挡身体、
创造新朝向，关节、分区与接缝仍需人工校准。放大模板不会增加原画细节。

特效 4–32 帧、1–30 FPS，最大 512 像素；导入特效素材每格最长边保留至 64 像素，
最多 16 源帧。没有联网 AI 绘图、任意自然语言解析、GIF/APNG 导出或引擎自动接入。
功能检查不代表最终美术、动作手感、手机触控或游戏内表现通过验收。

欢迎通过 Issues 和 PR 提交可复现问题及局部改进，见 [贡献指南](CONTRIBUTING.md)。
代码与随附程序化示例使用 MIT；导入图片仍遵守自身版权。发布内容不含用户参考人物图、
私人游戏素材与历史本机执行日志，详见 [来源说明](THIRD_PARTY_NOTICES.md)。
