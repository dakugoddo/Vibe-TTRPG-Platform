# Eternity Table

Local-first virtual tabletop and campaign knowledge base for tabletop RPGs.

Eternity Table combines an infinite canvas, an Obsidian-style Markdown knowledge base, entity sheets, assets, audio tools, dice rolls, and multiplayer sync around one rule: the host's world folder is the source of truth.

## Status

Version: `0.1.0 beta`

This beta is usable for local testing and early campaign preparation, but it is not a polished public release yet. The core architecture is in place; UI, permissions, packaging, and multiplayer QA are still being hardened.

## Core Idea

Eternity Table is designed as a local-first VTT:

- The GM owns a world folder on disk.
- World content is stored as Markdown files with YAML frontmatter.
- The host runs a local file server and opens the app.
- Players connect through the host IP over LAN, Radmin VPN, Hamachi, or a similar private network.
- No central cloud is required.

The project is a hybrid of:

- Miro / Excalidraw style infinite canvas
- Obsidian style Markdown knowledge base
- FoundryVTT style RPG entities, sheets, assets, and session tools

## Features In 0.1 Beta

### Infinite Canvas

- Pan and zoom canvas.
- Drawing tools: hand, select, pen, line, rectangle, ellipse, frame, text, image.
- Canvas entities, cards, tokens, pinned windows, and portals.
- Middle-button pan optimized for smoother Electron camera movement.
- Canvas object selection, lasso behavior, undo/redo foundation, snap/grid foundations.
- Fog of war foundation.
- GIF and image asset rendering foundation.

### Knowledge Base

- Entities are Markdown files with YAML frontmatter.
- Recursive entity hierarchy.
- Wiki links through `[[entity-id]]` and Markdown rendering.
- Obsidian-like Notes workspace:
  - vault/entity tree
  - tab groups
  - split panes
  - source editor
  - preview mode
  - split editor/preview mode
  - entity data view
  - outline, backlinks, outgoing links, graph-summary context
  - attached child entities
- Local layout persistence for the notes workspace.

### Entity System

Everything important is an entity:

- `character`
- `object`
- `ability`
- `competency`
- `attack`
- `tag`
- `note`
- `canvas`
- `portal`
- `folder`

Entities can contain other entities. A character can contain inventory objects, an object can contain attacks, and a note can contain related nested content.

### Character And Mechanics

- Character sheet foundation.
- Stats, resources, inventory, abilities, competencies, attacks, tags, status data.
- Dynamic calculation helpers for stats.
- Dice roll engine and formula parsing.
- Chat roll integration.
- Compact character card foundation on canvas.

### Assets

- Recursive asset index.
- Image, GIF, video, audio, and file asset handling foundation.
- Asset browser with upload/delete/show-in-folder flows.
- Native Electron asset reveal when running in desktop mode.

### Audio

- Bottom audio dock foundation.
- GM audio desk foundation.
- Music, ambience, SFX, voice channel concepts.
- Local-first audio deck persistence foundation.

### Multiplayer

- Yjs CRDT sync for world/session state.
- Separate canvas sync rooms.
- Awareness/cursor and multiplayer ping foundations.
- Host/player identity and role foundation.
- Permissions helpers for view/edit access.

### Desktop

- Electron shell.
- Native folder picker.
- Embedded server build path.
- Desktop dev launcher.
- Portable and installer build configuration through electron-builder.
- Dev performance overlay foundation.

## Quick Start

### Requirements

- Windows is the primary tested environment.
- Node.js 24+ is currently used in development.
- npm.

### Browser Dev Mode

Run from the repository root:

```bat
start.bat
```

This starts:

- Express file server on `http://localhost:3001`
- Vite client on `http://localhost:5173`

Players on the same private network can connect to the host's Vite URL.

### Electron Dev Mode

Run from the repository root:

```bat
start-electron-dev.bat
```

Or manually:

```bat
cd app
npm.cmd run desktop:dev
```

### Build Electron App

Run:

```bat
build-electron-dist.bat
```

Artifacts are written to:

```text
electron-release/
```

Expected names:

- `Eternity-Table-0.1.0-portable-x64.exe`
- `Eternity-Table-0.1.0-setup-x64.exe`

To start an unpacked build:

```bat
start-electron-built.bat
```

## Manual Development Commands

### Server

```bat
cd server
npm.cmd run dev
```

### Client

```bat
cd app
npm.cmd run dev -- --host
```

### Checks

```bat
cd app
npm.cmd exec tsc -- --noEmit
npm.cmd run lint
npm.cmd run build
npm.cmd run desktop:build
```

```bat
cd server
npm.cmd run build
```

Focused app tests use the server-provided `tsx`:

```bat
cd app
..\server\node_modules\.bin\tsx.cmd src\utils\notesWorkspaceLayout.test.ts
..\server\node_modules\.bin\tsx.cmd src\store\notesWorkspaceStore.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\notesWorkspaceLinks.test.ts
```

## Project Structure

```text
app/
  electron/          Electron main/preload runtime
  scripts/           Desktop build/dev helpers
  src/
    components/
      canvas/        Infinite canvas UI
      ui/            Shell, drawers, login, settings, assets, audio
      windows/       Entity windows and sheets
      workspace/     Notes workspace mode
    hooks/           React hooks
    locales/         Built-in ru/en translations
    services/        File API, desktop bridge, audio, roll services
    store/           Zustand and Yjs-facing stores
    utils/           Pure helpers, layout models, theme, parsers

server/
  src/
    index.ts         Express API and websocket entry
    worldManager.ts  World create/open/status
    fileManager.ts   Entity Markdown CRUD
    assetManager.ts  Asset index and safe paths
    fileWatcher.ts   External file watch
    playerProfiles.ts

.pi/
  docs/              Architecture, design, QA, and handoff docs
  rules/             Project rules for agents
  skills/            Local project skills
  workflows/         Active long-task handoffs

test-world/
  Example development world data
```

## World Data Model

The world folder is the main source of truth.

Common folders:

```text
general/    Shared world entities
gm/         GM-only entities
users/      Player-owned entities and inventory
assets/     Binary/media files
players/    Player profiles
world.yaml  World metadata
```

Entity files are Markdown documents with YAML frontmatter. The Markdown body is the entity description.

## Notes Workspace

The Notes workspace is a local Obsidian-like editor mode over the entity system.

It does not create a separate note format. It edits the same entity Markdown data used by the rest of the platform.

Current modes:

- `Editor`: source Markdown editing with wiki-link autocomplete.
- `Preview`: rendered Markdown.
- `Split`: editor and preview side by side.
- `Data`: entity properties, tags, and attached child entities.
- `Outline`: Markdown headings.
- `Links`: backlinks and outgoing links.
- `Graph`: compact relationship summary.

Write access follows the existing entity permission model. If the user cannot edit an entity, the editor is read-only.

## Multiplayer Model

The host is authoritative for disk writes.

High-level flow:

```text
Markdown files <-> Express API <-> Yjs documents <-> connected clients
```

External edits can be detected by the file watcher and pushed back to clients.

## Design System

The UI uses semantic theme variables and the shared `glass` helper from:

```text
app/src/utils/theme.ts
```

Themes are intended to become full visual workspaces, not only light/dark color palettes.

## Beta Limitations

- Some UI surfaces are still being polished.
- Full native multi-window and multi-monitor workflows are planned after the Electron foundation is stable.
- Permissions and visibility need more GM/player QA.
- PDF viewing is planned but not implemented.
- Desktop app icon/signing metadata still needs final polish.
- Public release packaging should be smoke-tested on a clean machine before distribution.

## Documentation For Contributors

Start here:

- `AGENTS.md`
- `.pi/DEVELOPMENT_PLAN.md`
- `.pi/FEATURE_BACKLOG.md`
- `.pi/BUG_BACKLOG.md`
- `.pi/docs/code-map.md`
- `.pi/docs/notes-workspace-obsidian-redesign.md`
- `.pi/docs/electron-desktop-migration-plan.md`

## License

License is not finalized yet.
