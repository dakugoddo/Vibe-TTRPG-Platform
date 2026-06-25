# Context Mode setup

Context Mode is optional and complementary to Graphify.

- Graphify answers project-structure/code-relationship questions from `graphify-out/graph.json`.
- Context Mode reduces raw tool-output/context churn and can provide session/tool-output retrieval through MCP.

## Current repo wiring

`opencode.jsonc` registers a `context-mode` MCP server through `npx -y context-mode`, so no global install or committed dependency is required.

Expected OpenCode MCP entry:

```json
"context-mode": {
  "type": "local",
  "command": ["npx", "-y", "context-mode"],
  "enabled": true
}
```

This is deliberately MCP-only. Hook support differs per client and should be enabled per-client only after verifying that the client recognizes context-mode hooks.

## Hermes

Do not assume Hermes automatically uses this OpenCode MCP config. For Hermes-native MCP, use Hermes CLI/user config in a separate setup pass and verify with `hermes mcp list` / `hermes mcp test` after restart.

## Verification

For OpenCode, after restart ask the agent/client for `ctx stats` or check MCP server list if the client exposes one. If `npx -y context-mode` downloads the package on first use, network access is required.

## Rules

- Do not commit context-mode databases/cache.
- Keep `graphify-out/` generated and ignored.
- Prefer Graphify for codebase navigation; prefer Context Mode for large raw tool output/session continuity.
