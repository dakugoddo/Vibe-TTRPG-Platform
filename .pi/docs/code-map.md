# Code Map

> Дата: 2026-05-25
> Назначение: быстрый навигатор по владельцам логики, чтобы агент не тратил лишние проходы `rg` на типовые задачи.

## Frontend entry

| Зона | Файлы | Когда идти сюда |
|------|-------|-----------------|
| App shell | `app/src/App.tsx`, `app/src/main.tsx`, `app/src/i18n.ts`, `app/src/utils/notesWorkspaceConstants.ts` | старт приложения, глобальная компоновка, базовая инициализация i18next. Крупные surfaces (`InfiniteCanvas`, `NotesWorkspace`, drawers, settings, audio dock, window manager) должны оставаться lazy-loaded через `React.lazy/Suspense`; не возвращать статические imports в `App.tsx`, иначе основной app chunk снова вырастет и вернётся Vite chunk-size warning. |
| Side drawers | `app/src/components/ui/LeftDrawer.tsx`, `app/src/components/ui/RightDrawer.tsx` | открытие боковых панелей, header pattern, GM player selector, tabs базы/файлов/чата |
| Settings shell | `app/src/components/ui/SettingsWindow.tsx`, `app/src/App.tsx`, `app/src/utils/permissions.ts`, `.pi/docs/player-identity-roles.md` | окно настроек, player-safe tabs, GM-only world/roles tabs, role policy matrix, player profile role assignment |
| Theme/density runtime | `app/src/utils/theme.ts`, `app/src/hooks/useThemePreset.ts`, `app/src/hooks/useInterfaceDensity.ts`, `app/src/index.css`, `app/src/components/ui/SettingsWindow.tsx` | built-in visual presets, local custom palette, density presets, CSS variables, localStorage-backed theme/density choice |
| Localization runtime | `app/src/i18n.ts`, `app/src/utils/localization.ts`, `app/src/hooks/useLocalePreference.ts`, `app/src/locales/ru.json`, `app/src/locales/en.json`, `app/src/components/ui/SettingsWindow.tsx`, `.pi/docs/i18n-custom-locales-foundation.md` | language preference, localStorage-backed locale choice, built-in ru/en bundles, future custom world locale plan |
| Module registry | `app/src/utils/appModules.ts`, `.pi/docs/module-architecture.md` | pure internal module definitions, default enablement, core-lock normalization for future optional modules |
| Platform/desktop runtime | `.pi/docs/platform-runtime-decision.md`, `.pi/docs/electron-desktop-migration-plan.md`, `.pi/docs/electron-player-delivery-policy.md`, `app/package.json`, `app/electron/main.cjs`, `app/electron/preload.cjs`, `app/electron/assets/icon.*`, `app/scripts/generate-desktop-icons.cjs`, `app/scripts/desktop-dev.cjs`, `app/scripts/build-server.cjs`, `app/src/services/desktopBridge.ts`, `app/src/components/ui/LoginScreen.tsx`, `app/vite.config.ts`, `server/package.json`, `server/tsconfig.json`, `server/src/index.ts` | Electron shell, typed preload boundary, native world folder dialog, native asset reveal with path allowlist, browser-first rollback, Vite file-build base, server build, embedded packaged server import, electron-builder config, custom app icon, player delivery baseline, Express/Yjs server lifecycle healthcheck/spawn/stop, future native windows. `desktop-dev.cjs` must not hardcode `5173` as required; it should treat it as preferred, preflight listen, choose a fallback port, and pass the actual `VIBE_ELECTRON_DEV_SERVER_URL` to Electron. Avoid `npm.cmd` inside Node/Electron launchers on Windows; spawn direct Node entrypoints for Vite/Electron/server and pass `VIBE_NODE_EXEC_PATH` into Electron main. |
| Audio session bridge | `app/src/components/ui/AudioSessionBridge.tsx`, `app/src/hooks/useAudioSessionEnabled.ts` | player opt-in, приём Yjs audio commands, fade-aware локальное воспроизведение SFX/tracks |
| Audio module shell | `app/src/components/ui/AudioControlDock.tsx`, `app/src/components/ui/AudioDesk.tsx`, `.pi/docs/gm-audio-desk.md` | отдельный нижний аудио-док, temporary mixer popup, local cue buttons, channel stop/all-stop, optional broadcast controls |
| Audio playback service | `app/src/services/audioPlayback.ts` | `HTMLAudioElement` playback, Web Audio buffer cache, duration metadata, channel/effective volume, local fade helpers, audio-output priming |
| Audio channel mixer hook | `app/src/hooks/useAudioChannelVolumes.ts` | localStorage-backed channel volumes for music/ambience/sfx/voice |
| Audio playlist model | `app/src/utils/audioPlaylists.ts` | localStorage-backed audio queue playlist helpers; UI integration moved out of `AssetBrowser` and awaits standalone audio module design |
| GM audio desk model | `.pi/docs/gm-audio-desk.md`, `app/src/utils/audioDeckModel.ts` | normalized cue/playlist/scene model for the future GM soundboard and session playlist state |
| Notifications | `app/src/utils/notificationModel.ts`, `app/src/utils/sessionNotificationModel.ts`, `app/src/store/notificationStore.ts`, `app/src/components/ui/NotificationCenter.tsx`, `app/src/components/ui/SessionNotificationBridge.tsx`, `.pi/docs/notification-system.md` | local notifications, session metadata events, upload approvals, toast/center UI, player -> GM approval request routing. `NotificationCenter surface="floating"` is canvas shell UI; `surface="embedded"` is for notes/context panes and must not float over the notes editor. |
| Global styles | `app/src/index.css`, `app/src/utils/theme.ts` | базовые токены, scrollbar, glass classes, Tailwind-level styling |
| Types | `app/src/types.ts`, `app/src/types/canvasTypes.ts` | Entity/ChatMessage/canvas draw element contracts |

## Stores

| Store | Ответственность |
|-------|-----------------|
| `app/src/store/yjsStore.ts` | Yjs connection, roles, permissions gate for Entity mutations, chat messages, latest audio session command |
| `app/src/store/entityStore.ts` | local entity store snapshot and entity CRUD bridge |
| `app/src/store/canvasStore.ts` | active canvas, camera transform, canvas history |
| `app/src/store/canvasDrawStore.ts` | active canvas tool, draw style, selection, marquee, undo/redo state, fog tool UI state |
| `app/src/store/canvasSyncStore.ts` | persistent canvas draw/fog data, awareness cursors, pings, canvas write guards |
| `app/src/store/windowStore.ts` | entity windows, pinning, positioning, open/close |
| `app/src/store/uiStore.ts` | global UI helpers such as `ConfirmDialog` |

## Canvas

| Задача | Начинать с |
|--------|------------|
| Toolbar/tool buttons/style controls | `app/src/components/canvas/CanvasToolbar.tsx` |
| Pointer flow, drawing, lasso, selection, drag, resize, rotate | `app/src/components/canvas/InfiniteCanvas.tsx` |
| Canvas camera navigation | `app/src/components/canvas/InfiniteCanvas.tsx`, `app/src/store/canvasStore.ts` — wheel zoom, `setTransform`, stage offset/scale, middle-button pan lifecycle; middle-pan starts on Stage but move/up must stay global until the real middle-button release |
| Canvas image picker | `app/src/components/canvas/CanvasImagePicker.tsx`, `app/src/components/canvas/InfiniteCanvas.tsx` |
| Draw element bounds, z-order, selection math, fog geometry | `app/src/types/canvasTypes.ts` |
| Canvas object anchors / line endpoint snap | `app/src/utils/canvasAnchors.ts`, `app/src/components/canvas/InfiniteCanvas.tsx` |
| Canvas line routing/editing helpers | `app/src/utils/canvasLineRouting.ts`, `app/src/types/canvasTypes.ts`, `app/src/components/canvas/CanvasToolbar.tsx`, `app/src/components/canvas/InfiniteCanvas.tsx` |
| Canvas visual style presets | `app/src/utils/canvasVisualStyle.ts`, `app/src/types/canvasTypes.ts`, `app/src/components/canvas/CanvasToolbar.tsx`, `app/src/components/canvas/InfiniteCanvas.tsx` |
| Canvas linked entity tokens/cards | `app/src/types/canvasTypes.ts`, `app/src/components/canvas/InfiniteCanvas.tsx`, `app/src/components/canvas/CanvasToolbar.tsx`, `app/src/utils/canvasEntityTokenFrame.ts`, `app/src/utils/entityCanvasDefaults.ts`, `app/src/components/windows/blocks/EntityCanvasTokenSettings.tsx`, `.pi/docs/canvas-entity-tokens.md` |
| Compact character card on canvas | `app/src/utils/characterCardSummary.ts`, `app/src/utils/entityActionRollModel.ts`, `app/src/services/entityActionRoll.ts`, `app/src/components/canvas/InfiniteCanvas.tsx`, `app/src/components/windows/blocks/EntityCanvasTokenSettings.tsx`, `.pi/docs/compact-character-card-canvas.md` | informational compact summary on the canvas card itself, вкладки `Статы/Действия/Ресурсы/Заметки`, all available character blocks are derived from entity/children; no `properties.compactCard` field selector/settings UI; canvas overlay must not become an editor or roll surface |
| Workspace/window ergonomics | `app/src/utils/windowLayout.ts`, `app/src/store/windowStore.ts`, `app/src/components/windows/WindowManager.tsx`, `app/src/components/windows/EntityWindow.tsx`, `.pi/docs/workspace-window-ergonomics-plan.md` | screen/canvas window layers, local layout actions, quick screen snapshot, future named/workspace snapshots and multi-monitor design gate |
| Notes workspace mode | `app/src/utils/workspaceMode.ts`, `app/src/utils/notesWorkspaceLayout.ts`, `app/src/utils/notesWorkspaceLinks.ts`, `app/src/utils/notesWorkspaceModules.ts`, `app/src/store/workspaceModeStore.ts`, `app/src/store/notesWorkspaceStore.ts`, `app/src/components/workspace/NotesWorkspace.tsx`, `app/src/App.tsx`, `app/src/components/ui/HudBar.tsx`, `app/src/components/ui/SettingsWindow.tsx`, `.pi/docs/notes-workspace-obsidian-redesign.md`, `.pi/docs/notes-workspace-rich-search-polish.md` | local-only `Канвас/Заметки` mode, canvas render toggle, shared theme background, grouped Obsidian-like vault tree, storage combobox, extended entity search via `entitySearch.ts`, persisted local tab/split editor board, drag/drop tabs with edge drop-zones, closeable panes, split pane resize ratio, `notesWorkspaceModules.ts` registry for implemented/planned shell modules, persisted shell module visibility/width/height for Vault/Context/Notifications/Search/Graph/Audio, SettingsWindow controls for shell module visibility plus `resetShell()` for shell-only defaults, Markdown-rich toolbar over Markdown source, source/preview/split/UI modes, entity data view, children/attached entities, outline/backlinks/graph context, active-entity quick actions for parent/copy wiki/copy id/pin to active canvas. Do not reintroduce screen-window layout controls as the main notes workflow. Do not call `preventDefault()` on draggable pane/tab `mousedown`; row click must cover the whole entity row, chevron alone expands children. Notes shell visibility/size belongs in `notesWorkspaceStore`, not component `useState`, and must not be reset with central `resetLayout()`. Audio in Notes mode uses the embedded host `NOTES_AUDIO_DOCK_HOST_ID`; `AudioControlDock` must remain the single mounted owner of `AudioDesk` to avoid duplicate playback lifecycles and audio stops on Canvas/Notes switches. |
| Canvas persistence filter/cleanup | `app/src/utils/canvasPersistence.ts` |
| Persistent draw/fog sync | `app/src/store/canvasSyncStore.ts` |

## Entity and knowledge base

| Задача | Начинать с |
|--------|------------|
| Left database tree, search, context menu, quick-create | `app/src/components/ui/EntityDatabase.tsx` | Row click opens/focuses the entity in the active workspace mode; chevron click expands/collapses children. Context menu owns open/focus, pin to active canvas, parent focus, copy wiki/id, quick-create and host file actions. Do not put row-open and tree-expand on the same click target. |
| Entity bulk selection, delete, and selected-row batch drag/drop | `.pi/docs/bulk-entity-actions.md`, `app/src/components/ui/EntityDatabase.tsx`, `app/src/utils/entityDragPayload.ts`, `app/src/utils/entityTreeSelection.ts` |
| Entity windows, context menu, quick links, sheet selection | `app/src/components/windows/EntityWindow.tsx` |
| Entity window technical/debug mode | `app/src/components/windows/EntityWindow.tsx`, `.pi/docs/entity-window-debug-mode.md` |
| Window layout and pinned windows | `app/src/components/windows/WindowManager.tsx` |
| Wiki link rendering and custom markdown blocks | `app/src/components/ui/MarkdownRenderer.tsx`, `app/src/components/ui/EntityLink.tsx` |
| Wiki link editing autocomplete | `app/src/components/ui/WikiLinkTextarea.tsx` |
| Asset browser UI, SFX preview, asset selection and bulk delete | `app/src/components/ui/AssetBrowser.tsx`, `app/src/hooks/useMediaLoadState.ts`, `app/src/utils/assetLoadState.ts`, `app/src/services/fileApi.ts`, `.pi/docs/bulk-entity-actions.md`, `.pi/docs/pre-release-usability-pack.md` | Asset Browser image/video previews use shared loading/error/retry state; keep `/api/assets/file?path=...` from `getAssetUrl()` as source of truth. |
| Asset drag payloads, binary upload, file reads and canvas image drop/migration | `app/src/utils/assetDrag.ts`, `app/src/utils/fileRead.ts`, `app/src/utils/canvasInlineImageMigration.ts`, `app/src/services/fileApi.ts`, `server/src/index.ts`, `app/src/components/canvas/InfiniteCanvas.tsx`, `app/src/types/canvasTypes.ts` |
| Entity image picker | `app/src/components/windows/blocks/EntityImageBlock.tsx`, `app/src/services/fileApi.ts` |
| Entity selectors and snapshots | `app/src/hooks/useEntities.ts` |
| Entity search matching, snippets, facets, query syntax, property filters, recent history and saved searches | `app/src/utils/entitySearch.ts`, `app/src/utils/entitySearch.test.ts`, `app/src/components/ui/EntityDatabase.tsx` |
| Markdown/frontmatter client parser | `app/src/utils/entityParser.ts`, `app/src/utils/entitySerializer.ts` |
| Entity ID/schema helpers | `app/src/utils/entityId.ts`, `app/src/utils/entitySchema.ts`, `server/src/entityId.ts`, `server/src/entitySchema.ts` |
| Entity drag/drop routing contract | `.pi/docs/entity-drop-router.md`, `app/src/utils/entityDropRouter.ts`, `app/src/utils/entityDropRouter.test.ts`, `app/src/utils/entityDragPayload.ts`, `app/src/utils/entityTreeMutations.ts`, `app/src/components/ui/EntityDatabase.tsx`, `app/src/components/windows/EntityWindow.tsx`, `app/src/components/canvas/InfiniteCanvas.tsx`, `app/src/components/windows/blocks/InventoryBlock.tsx`, `app/src/components/windows/blocks/AbilitiesBlock.tsx`, `app/src/components/windows/blocks/CompetenciesBlock.tsx`, `app/src/components/windows/blocks/ObjectSheet.tsx`, `app/src/components/windows/blocks/StatusBlock.tsx` |
| Entity title-driven filenames | `.pi/docs/entity-title-filenames.md`, `server/src/entityTitleFilename.ts`, `server/src/entityTitleFilename.test.ts`, `server/src/entityTitleRename.ts`, `server/src/entityTitleRename.test.ts`, `server/src/fileManager.ts`, `server/src/index.ts`, `app/src/services/fileApi.ts`, `app/src/services/fileSyncService.ts` |
| Entity visibility and canvas access | `.pi/docs/entity-visibility-permissions.md`, `app/src/utils/permissions.ts`, `app/src/components/canvas/InfiniteCanvas.tsx`, `app/src/components/windows/blocks/EntityCanvasTokenSettings.tsx` |
| Player identity and roles | `.pi/docs/player-identity-roles.md`, `server/src/playerProfiles.ts`, `server/src/index.ts`, `app/src/services/fileApi.ts`, `app/src/components/ui/LoginScreen.tsx`, `app/src/components/ui/SettingsWindow.tsx`, `app/src/store/yjsStore.ts` |

## Character and mechanics blocks

| Block | Ответственность |
|-------|-----------------|
| `CharacterSheet.tsx` | tabs and composition of character blocks |
| `AttributeBlock.tsx` | stats, wounds, powers, defense, status tags |
| `SkillsBlock.tsx` | skill ranks and skill+competency rolls |
| `CompetenciesBlock.tsx` | child competency entities, rank, roll, open/delete |
| `AbilitiesBlock.tsx` | child ability entities, cost/range/area/diceFormula, Roll Engine action |
| `AbilitySheet.tsx` | standalone ability window fields and Roll Engine action |
| `ResourcesBlock.tsx` | flexible `properties.resources` counters |
| `InventoryBlock.tsx` | inventory list, equip/quantity/delete, item drag/drop, player ownership |
| `ObjectSheet.tsx` | object properties, tags, embedded attacks |
| `AttackSheet.tsx` | attack properties and attack tags |
| `TagPickerPopup.tsx`, `TagEditor.tsx` | tag selection and tag modifier editing |

Pure helpers:

- `app/src/hooks/useCalculatedStat.ts` - calculated stats and tag modifiers.
- `app/src/services/rollEngine.ts` - single Roll Engine facade.
- `app/src/utils/diceParser.ts` - notation parser and low-level dice rolls.
- `app/src/utils/rollVariables.ts` - Entity roll formula variable resolver (`$урон`, `$strength`, ranks/base values).
- `app/src/utils/abilityModel.ts` - ability formula and cost helpers.
- `app/src/utils/permissions.ts` - pure permission/view helper, `Base Player` role policy and effective permissions.
- `app/src/utils/entityTreeMutations.ts` - shared entity tree move and owner propagation helper for canvas/database/window drops.
- `app/src/utils/entityDragPayload.ts` - shared DataTransfer reader/writer for single and selected multi-entity drags.
- `app/src/utils/entityTreeSelection.ts` - pure helper for reducing selected entity ids to top-level roots before batch operations.
- `app/src/utils/resourceModel.ts` - resource normalization and clamp logic.

## Server

| Файл | Ответственность |
|------|-----------------|
| `server/src/index.ts` | Express API, websocket/y-websocket boot, request routing, world/entity maintenance endpoints |
| `server/src/worldManager.ts` | create/open worlds and world metadata |
| `server/src/fileManager.ts` | CRUD `.md` entities, folder routing, serialization bridge, minimal entity-id migration utility |
| `server/src/assetManager.ts` | recursive `assets/` index, stable path-based asset IDs, MIME/type detection, safe asset path resolution |
| `server/src/playerProfiles.ts` | player profile claim/list/update helpers for `players/<playerId>.json` and legacy `users/*` compatibility |
| `server/src/fileWatcher.ts` | chokidar external edit watcher |
| `server/src/renameManager.ts` | cascade rename and wiki-link updates |
| `server/src/shared/types.ts` | server-side shared Entity types |

## Focused tests

Run app focused tests from `app/` with the server-provided `tsx`:

```bat
..\server\node_modules\.bin\tsx.cmd src\utils\diceParser.test.ts
..\server\node_modules\.bin\tsx.cmd src\services\rollEngine.test.ts
..\server\node_modules\.bin\tsx.cmd src\services\audioPlayback.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\audioPlaylists.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\audioDeckModel.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\entitySerializer.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\entityId.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\entitySearch.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\entityDropRouter.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\entityTreeSelection.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\canvasInlineImageMigration.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\theme.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\canvasAnchors.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\rollVariables.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\permissions.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\abilityModel.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\resourceModel.test.ts
```

Run server focused tests from `server/`:

```bat
npx tsx src\fileManager.test.ts
npx tsx src\assetManager.test.ts
npx tsx src\entityId.test.ts
npx tsx src\entityTitleFilename.test.ts
npx tsx src\entityTitleRename.test.ts
npx tsx src\playerProfiles.test.ts
```

Full frontend checks:

```bat
npm.cmd exec tsc -- --noEmit
npm.cmd run lint
npm.cmd run build
```

## Search rules of thumb

- UI text or button behavior: search the visible Russian label first, then component names.
- Canvas bugs: search in `InfiniteCanvas.tsx` for the action name, then check `canvasDrawStore.ts` and `canvasSyncStore.ts`.
- Entity write bugs: check UI component first, then `yjsStore.canModify`, then server serializer only if data reaches disk incorrectly.
- If 3-5 targeted searches do not locate the owner, update this file or `.pi/ARCHITECTURE.md` with the missing map before continuing.

## Workspace / Pinned Entity Windows

- `app/src/store/windowStore.ts` owns personal screen windows only: `openWindow(entityId)` is a screen singleton and layout actions/snapshots ignore pinned canvas placements.
- `app/src/types/canvasTypes.ts` owns `CanvasWindowInstance`.
- `app/src/utils/canvasPersistence.ts` owns `canvasWindowInstances[]` read/sanitize/upsert/remove helpers plus shared create/id/z-index helpers used by `EntityWindow`, `EntityDatabase` and `NotesWorkspace`.
- `app/src/components/windows/WindowManager.tsx` maps active canvas `canvasWindowInstances[]` into pinned `EntityWindow` render states.
- `app/src/components/windows/EntityWindow.tsx` owns pin/unpin/delete/drag/resize behavior for canvas window placements and must split permissions: canvas edit rights for placement, entity edit rights for content.
- Do not persist shared pinned windows in `entity.properties.windowState`; that field is legacy/local runtime and is stripped by `server/src/fileManager.ts`.

Focused tests:

```bat
cd app
..\server\node_modules\.bin\tsx.cmd src\utils\canvasPersistence.test.ts
..\server\node_modules\.bin\tsx.cmd src\store\windowStore.test.ts
..\server\node_modules\.bin\tsx.cmd src\store\notesWorkspaceStore.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\notesWorkspaceModules.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\notesWorkspaceLinks.test.ts
```
