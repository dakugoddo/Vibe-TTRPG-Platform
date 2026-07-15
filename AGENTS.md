# AGENTS.md — Portable Agent Bootstrap

Compact cross-agent bootstrap for Eternity Table / Vibe TTRPG Platform. Hermes uses `.hermes.md` first; Codex/OpenCode/Aider/etc. can use this file. Keep it compact; do not paste the full knowledge base here.

## Project identity
Local-first VTT + campaign knowledge base for tabletop RPGs:
- infinite canvas (Miro/Excalidraw style),
- Markdown/Obsidian-like entity vault,
- FoundryVTT-like character sheets, inventory, rolls, fog of war, multiplayer.

Frontend is `app/` (React 19 + TypeScript + Vite + Tailwind v4 + Zustand + react-konva + Yjs + Electron). Server is `server/` (Express + ws/y-websocket + chokidar). Source of truth is the host world folder: `.md` files with YAML frontmatter.

## Critical rules
- Preserve `.md` + YAML frontmatter and `[[wiki-links]]` compatibility.
- Preserve unified Entity model (`type`, `parentId`, `properties`, `tags`, `database`).
- Do not change canvas coordinate model, sync debounce, role/permission model, or tech stack without explicit owner approval.
- No new dependencies without approval.
- UI text Russian-first/i18n-aware; code/types/comments English.
- UI styles go through `app/src/utils/theme.ts`, semantic `--vibe-*` tokens, or `glass.*`.
- Use `ConfirmDialog`; never `window.confirm`.
- Respect z-index hierarchy: canvas 0, pinned 10, canvas UI 20, drawer buttons 30, drawers 40, windows 50, popovers/dialogs 9999+.

## Token/cost discipline
- If `graphify-out/graph.json` exists, use Graphify before reading many files:
  - `graphify query "<question>" --budget 1500`
  - `graphify explain "<node>"`
  - `graphify path "A" "B"`
- Use graph results to choose a small exact file set, then read/edit only those files.
- Keep long-term decisions in `.pi/docs`, canonical skills, and Graphify memory; do not rely on chat history.

## Canonical context
- `.hermes.md` — compact Hermes-specific always-loaded rules.
- `.pi/AI_SETUP.md` — map of agent systems, Graphify, context-mode, skills, hooks.
- `skills/*/SKILL.md` — canonical project skills.
- `.pi/DEVELOPMENT_PLAN.md` — понятный владельцу roadmap.
- `.pi/planning/{IDEAS,BUGS,QUESTIONS,NEXT_RELEASE}.md` — каноническое planning-хранилище.
- `.pi/docs/*.md` — detailed contracts and decisions.
- `.pi/docs/AGENTS.full.md` — archived pre-optimization full AGENTS content.

## Load only relevant project skills
Start with `skills/vibe-project/SKILL.md`. Then load by domain:
- idea/reference/bug intake и product gate: `skills/product-planning-gate/SKILL.md`
- принятая фича/`продолжай`: `skills/vertical-slice-planner/SKILL.md`
- UI: `skills/vibe-ui-architecture/SKILL.md`
- canvas: `skills/canvas-engine/SKILL.md`
- entities/Markdown/wiki links: `skills/knowledge-graph/SKILL.md`
- dice/stats/math: `skills/mechanics-engine/SKILL.md`
- multiplayer/Yjs/rooms/permissions: `skills/multiplayer-sync/SKILL.md`
- sheets/forms/inventory: `skills/dynamic-forms/SKILL.md`
- after implementation: `skills/self-critique/SKILL.md`, `skills/test-generator/SKILL.md`

## Workflow
Vertical slices only: Mini-PRD → smallest end-to-end implementation → checks → self-critique → docs/memory update. If the owner says `продолжай`, continue the nearest safe roadmap slice autonomously; stop only for data-loss, architecture, dependency, security, or product-fork blockers.

## Commands
- Root `start.bat`: server 3001 + Vite 5173.
- `cd app && npm run build`; `cd app && npm run lint`.
- `cd server && npm run build`.
- Use focused tests from README when touching notes workspace/stores/utils.

## Git hygiene
Inspect `git status --short` before edits. Do not overwrite world/test data or user changes unless explicitly asked. Keep agent/config changes separate from app/server product changes.
