# Code Map

> Дата: 2026-05-21
> Назначение: быстрый навигатор по владельцам логики, чтобы агент не тратил лишние проходы `rg` на типовые задачи.

## Frontend entry

| Зона | Файлы | Когда идти сюда |
|------|-------|-----------------|
| App shell | `app/src/App.tsx`, `app/src/main.tsx`, `app/src/i18n.ts` | старт приложения, глобальная компоновка, локализация |
| Global styles | `app/src/index.css`, `app/src/utils/theme.ts` | базовые токены, scrollbar, glass classes, Tailwind-level styling |
| Types | `app/src/types.ts`, `app/src/types/canvasTypes.ts` | Entity/ChatMessage/canvas draw element contracts |

## Stores

| Store | Ответственность |
|-------|-----------------|
| `app/src/store/yjsStore.ts` | Yjs connection, roles, permissions gate for Entity mutations, chat messages |
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
| Draw element bounds, z-order, selection math, fog geometry | `app/src/types/canvasTypes.ts` |
| Canvas persistence filter/cleanup | `app/src/utils/canvasPersistence.ts` |
| Persistent draw/fog sync | `app/src/store/canvasSyncStore.ts` |

## Entity and knowledge base

| Задача | Начинать с |
|--------|------------|
| Left database tree, search, context menu, quick-create | `app/src/components/ui/EntityDatabase.tsx` |
| Entity windows, context menu, quick links, sheet selection | `app/src/components/windows/EntityWindow.tsx` |
| Window layout and pinned windows | `app/src/components/windows/WindowManager.tsx` |
| Wiki link rendering and custom markdown blocks | `app/src/components/ui/MarkdownRenderer.tsx` |
| Entity selectors and snapshots | `app/src/hooks/useEntities.ts` |
| Markdown/frontmatter client parser | `app/src/utils/entityParser.ts`, `app/src/utils/entitySerializer.ts` |
| Schema version helpers | `app/src/utils/entitySchema.ts`, `server/src/entitySchema.ts` |

## Character and mechanics blocks

| Block | Ответственность |
|-------|-----------------|
| `CharacterSheet.tsx` | tabs and composition of character blocks |
| `AttributeBlock.tsx` | stats, wounds, powers, defense, status tags |
| `SkillsBlock.tsx` | skill ranks and skill+competency rolls |
| `CompetenciesBlock.tsx` | child competency entities, rank, roll, open/delete |
| `AbilitiesBlock.tsx` | child ability entities, cost/range/area/diceFormula, Roll Engine action |
| `ResourcesBlock.tsx` | flexible `properties.resources` counters |
| `InventoryBlock.tsx` | inventory list, equip/quantity/delete, item drag/drop, player ownership |
| `ObjectSheet.tsx` | object properties, tags, embedded attacks |
| `AttackSheet.tsx` | attack properties and attack tags |
| `TagPickerPopup.tsx`, `TagEditor.tsx` | tag selection and tag modifier editing |

Pure helpers:

- `app/src/hooks/useCalculatedStat.ts` - calculated stats and tag modifiers.
- `app/src/services/rollEngine.ts` - single Roll Engine facade.
- `app/src/utils/diceParser.ts` - notation parser and low-level dice rolls.
- `app/src/utils/permissions.ts` - pure permission/view helper.
- `app/src/utils/resourceModel.ts` - resource normalization and clamp logic.

## Server

| Файл | Ответственность |
|------|-----------------|
| `server/src/index.ts` | Express API, websocket/y-websocket boot, request routing |
| `server/src/worldManager.ts` | create/open worlds and world metadata |
| `server/src/fileManager.ts` | CRUD `.md` entities, folder routing, serialization bridge |
| `server/src/fileWatcher.ts` | chokidar external edit watcher |
| `server/src/renameManager.ts` | cascade rename and wiki-link updates |
| `server/src/shared/types.ts` | server-side shared Entity types |

## Focused tests

Run app focused tests from `app/` with the server-provided `tsx`:

```bat
..\server\node_modules\.bin\tsx.cmd src\utils\diceParser.test.ts
..\server\node_modules\.bin\tsx.cmd src\services\rollEngine.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\entitySerializer.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\permissions.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\resourceModel.test.ts
```

Run server focused tests from `server/`:

```bat
npx tsx src\fileManager.test.ts
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
