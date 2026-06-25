# AI Setup / Agent Memory Map

Purpose: one source of truth for agent tooling in this repo. Keep this file compact and current.

## Goals
- Low token cost for long-running development.
- Stable project understanding across Hermes, Codex, OpenCode, and other agents.
- Graph-based lookup before brute-force file reading.
- Canonical project skills instead of scattered duplicated rules.

## Always-loaded bootstraps
- `.hermes.md` — Hermes-specific compact context. Hermes loads this before `AGENTS.md` and therefore does not pay for the full historical file.
- `AGENTS.md` — portable compact bootstrap for Codex/OpenCode/Aider/etc.
- `.pi/docs/AGENTS.full.md` — archived full historical AGENTS; reference only when auditing old wording.

## Canonical project skills
Canonical skills live under root `skills/`:

| Skill | Use when |
|---|---|
| `vibe-project` | first entry for any project task |
| `vertical-slice-planner` | planning a new feature or handling `продолжай` |
| `vibe-ui-architecture` | UI, theme, windows, drawers, settings, assets, audio, notes workspace |
| `canvas-engine` | canvas, drawing tools, fog, tokens, portals |
| `knowledge-graph` | entity files, Markdown, wiki links, Obsidian compatibility |
| `mechanics-engine` | dice, formulas, stats, rule math |
| `dynamic-forms` | character sheets, inventory, attack/object forms |
| `self-critique` | post-slice quality pass |
| `test-generator` | focused tests and review checklist |

Legacy `.pi/skills`, `.opencode/skills`, and `.agents/skills` are compatibility forwarding stubs. Do not add new knowledge there; update root `skills/` only.

## Graphify: mandatory graph memory
Graphify is installed and `graphify-out/graph.json` exists. Current benchmark on this repo snapshot: about 19x fewer tokens per average query.

Use Graphify before reading many files:

```bash
graphify query "how does notes workspace persist layout" --budget 1500
graphify explain "NotesWorkspace"
graphify path "EntityWindow" "windowStore"
```

Update graph after meaningful code/doc changes:

```bash
bash scripts/graphify-update.sh
```

Recommended hooks:
- git post-commit/post-checkout hooks via `graphify hook install` for automatic rebuild/checks;
- Codex `PreToolUse` hook in `.codex/hooks.json` routes through `scripts/graphify-hook.sh`.

Graphify outputs are generated and ignored by git: `graphify-out/`.

## Context Mode
Context Mode is complementary to Graphify. Graphify stores project structure/code relationships. Context Mode stores/retrieves tool/session outputs and reduces raw output in agent context. If installed for an agent client, keep it as MCP/hook configuration outside product code. Do not mix context-mode runtime data into app/server.

OpenCode has an MCP-only `context-mode` entry in `opencode.jsonc` using `npx -y context-mode`. Hermes-native context-mode wiring is not assumed; configure via Hermes MCP separately if needed and verify after restart. See `.pi/docs/context-mode-setup.md`.

## Secrets
Never commit API keys. Local secrets belong in `.env`, user-level agent config, or OS credential storage.

- `opencode.jsonc` must remain secret-free.
- `opencode.example.jsonc` documents expected env vars.
- If a key was previously committed, rotate it and check git history before publishing.

## Agent-specific files
- `.codex/environments/environment.toml` — build/check actions for Codex.
- `.codex/hooks.json` — Codex hooks; should call repo wrapper scripts, not absolute user paths.
- `opencode.jsonc` — OpenCode MCP config, secret-free.
- `opencode.example.jsonc` — copyable template.
- `.opencode/agents/*.md` — role agents; read-only reviewers/designers.

## Verification for agent-config changes
Run these before claiming the setup is fixed:

```bash
python scripts/validate-agent-config.py
graphify benchmark graphify-out/graph.json
cd app && npm run build
cd server && npm run build
```

App/server builds are sanity checks only; agent setup changes should not modify product logic.
