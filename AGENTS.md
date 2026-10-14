# Contributing as an agent

Read README.md and CONTRIBUTING.md before changing this repository.
The browser application source of truth is index.html; it is self-contained.
Preserve offline operation and the project/recipe/playback format boundaries.
Do not add network calls, API keys, paid services, or client registration.
Read agent-contract.json before constructing CLI/MCP requests. Use stable module IDs.
Preserve inputs and create new output directories. Do not commit generated reports
with local paths, private art, credentials, or unrelated files.
Run npm run check and npm test for changes to the browser, CLI, MCP, or contract.
Inspect actual previews for rendering changes. Automated assertions are not art,
animation feel, device-performance, or game-engine acceptance.
