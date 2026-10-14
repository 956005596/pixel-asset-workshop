# Contributing

Bug reports, documentation improvements and small, reproducible fixes are welcome.
Include browser/OS versions, reproduction steps and a minimal project or request
that you have permission to share. Remove local paths and private artwork first.

## Development

No npm install or build step is needed. Open index.html in desktop Chrome/Edge.
The HTML contains the application's CSS and JavaScript and is the source of truth.
cli.mjs launches a separate temporary headless Chrome profile; mcp-server.mjs wraps
that local interface over stdio. agent-contract.json documents accepted requests.

Node.js 22+ and Chrome/Chromium are required for automated checks:

```sh
npm run check
npm test
```

Set PIXEL_WORKSHOP_BROWSER to an absolute browser executable path if auto-detection
fails. Tests use temporary directories and synthetic/built-in data, then clean up.
Tests exercise exports, format restoration, validation, offline rendering and MCP.
They do not establish final animation quality or engine compatibility.

After intentionally changing the agent API, run npm run schema and review the
contract diff. Do not run historical integration scripts from a private workspace:
all required runtime code is already in index.html.

Keep pull requests focused. Explain user-visible behavior, validation and limits.
Do not add dependencies, online generation or new file formats without discussing
the design in an issue first. Source and documentation contributions use MIT.
Only contribute artwork you can distribute, and state its license explicitly.
