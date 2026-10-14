# 让 Codex / Cindy 调用像素素材工坊

现在可以直接让助手生成、检查、修改和导出技能特效。生成仍使用本地程序和你导入的 PNG，没有联网绘图、密钥或费用。网页保持单文件，双击仍可用。

告诉助手：**“用这个工坊制作蓝色冰爆，256像素、24帧，先看预览，把碎片减少一点，再导出。”** 助手读取仓库根目录 `AGENTS.md`，通过命令行工作；你无需画序列帧或操作参数。

## 命令行使用

需要 Node.js 22+ 和已有 Chrome / Chromium。命令行无 npm 包、无在线下载。网页手工使用不需要 Node.js。每次调用启动独立临时浏览器，关闭后清理自己的进程和目录，保留你的浏览器页面。

在仓库根目录运行：

```sh
node cli.mjs doctor
node cli.mjs describe
node cli.mjs run --request examples/ice-burst.json --out outputs/ice-burst
```

`run` 的标准输出是一个 JSON 结果，含 `projectPath`、`previewPath`、`sheetPath`、文件列表、参数和逐帧诊断。默认写入 `AI生成素材/` 下的新目录，也可用 `--out 新目录`。目录已存在时拒绝覆盖。失败返回 `{ok:false,error:{code,message,details}}`，命令退出码非零；不要把失败当成完成。

**助手应打开 `previewPath` 真正查看图，再按部件修改；诊断不是美术验收。** 透明单帧和图集用于游戏，带棋盘格和帧标签的预览用于观看。

## 继续修改已有素材

请求JSON使用明确字段，先 `describe` 查询可用模板、部件ID和范围。`agent-contract.json` 提供完整 JSON Schema。

```json
{
  "version": 1,
  "projectPath": "outputs/ice-burst/ice-burst-项目.json",
  "effect": {"name":"蓝色冰爆二版","fps":20},
  "operations": [
    {"op":"update","id":"skill-shards","changes":{"count":12,"evolution":{"turns":1,"to":35}}}
  ],
  "output": {"columns":6,"frame":12}
}
```

将此修改请求保存在仓库根目录，再执行 `run` 即可。`projectPath` 和素材路径相对于请求文件所在目录；标准输入和 MCP 相对于工作目录。`--out` 相对于命令执行目录。不要在调整现有项目时重新指定 `template`，否则会换成模板初始设置。

也可以把 JSON 从标准输入传入：

```sh
node cli.mjs run --request - < 修改请求.json
node cli.mjs inspect --project 素材目录/技能-项目.json
node cli.mjs preview --project 素材目录/技能-项目.json --out 新预览.png --frames 0,6,12,18,23
```

请求按顺序读取项目、应用配方、应用效果设置、执行部件操作、导入 PNG、检查并导出。`add / update / remove / move` 分别添加、修改、删除、调整叠放顺序；最后的部件绘制在最上面。最多6部件。`delay` 和 `duration` 是整个动画的百分比，两者合计不超过100。

导入自己的图片：

```json
{
  "version":1,
  "effect":{"template":"ice","name":"冰爆加星光"},
  "assets":[{
    "path":"你准备的四帧素材.png",
    "cellWidth":64,"cellHeight":64,"frameCount":4,
    "module":{"id":"my-stars","name":"星光","delay":60,"duration":40,
      "evolution":{"from":50,"to":140,"turns":1}}
  }]
}
```

以上导入示例需要你自行提供有权使用的 PNG，仓库不附带该图片。单图可省略切分尺寸。图集必须等格、无间隔，按从左到右、从上到下读取。每格最长边缩至64像素，小图不自动放大，居中留透明边；素材颜色和半透明度按Canvas解码保留，半透明颜色可能出现1级舍入；原图文件不改变。最多16源帧，不会补画新形态。

## 标准 MCP 接口（可选）

提供 `mcp-server.mjs`，供支持本地 stdio MCP 的客户端接入。已验证协议收发及真实生成，但**没有修改你的客户端设置，也没有自动注册**。当前马上可用的是上面的命令行。

客户端需要设置可执行的 Node 路径和此目录内服务文件的绝对路径。示例结构如下，具体外层配置字段由客户端决定；不要照抄占位路径：

```json
{
  "mcpServers": {
    "pixel-workshop": {
      "command": "/绝对路径/node",
      "args": ["/绝对路径/像素素材工坊/mcp-server.mjs"]
    }
  }
}
```

工具：`pixel_workshop_describe` 读取规范；`pixel_workshop_render` 接收 `request` 和可选 `outputDir`；`pixel_workshop_inspect` 只读检查项目；`pixel_workshop_preview` 直接返回 PNG 图像给模型。服务的工作目录决定相对输入路径，推荐使用绝对输入路径。服务串行处理生成请求，并支持取消。

实现按官方 [stdio 传输规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) 和 [Tools 规范](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)：标准输出只有逐行 JSON-RPC，PNG 通过 image 内容块返回，工具执行错误使用 `isError`。

## 网页内调用与限制

已打开的网页暴露 `window.PixelWorkshop.call(method, args)`。例如：

```js
const state = await PixelWorkshop.call('getState');
await PixelWorkshop.call('patchEffect', {
  expectedRevision: state.revision,
  operations: [{op:'update',id:'skill-shards',changes:{count:12}}]
});
```

返回 `{ok,apiVersion,revision,result}` 或结构化错误。人工修改也会增加版本；`expectedRevision` 防止覆盖更新的修改。方法串行执行，批次无效时保留原项目。页面内可用 `restoreRevision` 恢复最多5个旧状态，合计最多16 MiB；大项目不进入这段临时历史。关闭页面会清空历史，可靠恢复仍依赖项目 JSON。命令行每次是新会话，旧版成果由独立输出目录保留。

边界：画布32–512、4–32帧、1–30 FPS、最多6部件。空白起止帧允许；到达画布边缘只是可能裁切的提示，需要看图。接口本轮以技能特效为主，项目人物数据原样保留，支持最高512像素、版本5紧凑格式及版本6骨骼项目，项目文件上限192 MiB；尚未提供人物编辑专用命令。不理解任意自然语言，也不自动创造新形状：由助手把意图转成已有形状、运动、旋转、缩放、时序和 PNG 组合。

公开版检查已在 macOS 和 Ubuntu CI 通过；未验证客户端自动注册、Windows 环境、具体游戏工程或 Maker 导入。本次公开版本的可复现检查见仓库中的 `tests/smoke.mjs`；历史本机日志不随仓库发布。
