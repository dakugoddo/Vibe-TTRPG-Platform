# Eternity Table: feature backlog

> Обновлено: 2026-06-12
> Назначение: активные и планируемые фичи. Реализованная история намеренно убрана из активного контекста.

## Приоритеты

- `F0` — фундаментальная схема/миграция, без которой дальнейшие функции будут хрупкими.
- `F1` — основной игровой workflow для ГМа/игроков.
- `F2` — важное ускорение работы или quality-of-life.
- `F3` — полировка, эксперимент или визуальное улучшение.

## Активные функции

| ID | Priority | Module | Status | Суть | Следующий шаг |
|----|----------|--------|--------|------|---------------|
| `FEAT-PLATFORM-ELECTRON-001` | `F0` | Electron Desktop | Foundation implemented | Electron shell, native folder dialog, native asset reveal, embedded server, package scripts, build artifact metadata, custom app icon, lazy-loaded app shell chunks, player delivery baseline и dev perf overlay реализованы. | Windows signing decision, clean-machine packaged smoke QA. |
| `FEAT-RELEASE-001` | `F1` | Release / Docs | Beta prep active | Product rename to Eternity Table, GitHub README and beta checklist prepared. | Manual QA checklist, clean release commit/tag only after separating runtime `test-world/*` changes. |
| `FEAT-USABILITY-001` | `F1` | Pre-release UX | Implemented, manual QA pending | Pre-release usability pack: asset states, entity quick actions, Notes discoverability, Audio dock states, canvas card readability, startup clarity и Settings reset controls. | Пройти manual smoke по `.pi/docs/pre-release-usability-pack.md` перед beta tag. |
| `FEAT-UI-002` | `F0` | UI / Settings / Entity sheets | Foundation implemented, polish continues | Semantic theme tokens, visual presets, density, core surfaces, compact card и UI handoff реализованы. | Точечная полировка после Electron QA: hardcoded surfaces, readability, theme consistency. |
| `FEAT-I18N-002` | `F1` | Localization / Modding | Foundation implemented, custom world layer planned | RU/EN switch, локальный preference, расширенный Settings/Notes UI перевод, desktop-кнопка открытия встроенной папки `locales`, App/Login shell, drawers/HUD, notifications, hotkeys, Asset Browser, image asset picker, Canvas Toolbar, entity link/drop popover, EntityDatabase context/group, Audio desk/dock, ChatPanel, EntityWindow shell и CharacterSheet tabs string pass есть. Пользовательский редактор переводов нужен для моддеров. | Design-doc для world locale format, endpoints, import/export и rollback; отдельный i18n-pass для оставшихся hardcoded entity block/tooling строк. |
| `FEAT-WORKSPACE-001` | `F1` | Workspace / Notes | Obsidian-like editor slice implemented, polish continues | Local notes workspace, tabs/splits, vault tree, source/preview/split editor, entity data, children, outline/backlinks/graph context и pinned canvas windows реализованы. | Ручная QA, polish linked context/search, затем native multi-window после Electron gate. |
| `FEAT-WORKSPACE-002` | `F1` | Workspace / Notes | Implemented, owner QA pending | Notes workspace rich Markdown toolbar, storage combobox, extended entity search result cards, theme-correct shell radii and removal of duplicate central editor header. | Owner QA по `.pi/docs/notes-workspace-rich-search-polish.md`; позже решить, нужна ли настоящая WYSIWYG-зависимость. |
| `FEAT-WORKSPACE-003` | `F1` | Workspace / Notes Modules | Implemented, owner QA pending | Notes shell получил module registry, persisted visibility/resize/area/order для обязательного `Editor` и модулей `Vault`, `Context`, `Notifications`, `Search`, `Graph`, `Audio`; модули перетаскиваются за шапку между left/center/right через pointer DnD, без HTML drag fallback и без создания пустых panes. | Ручная QA toggles/settings/reset/resize/search/graph/audio, module drag left/center/right включая перенос `Editor`, затем polish будущих shell-расширений. |
| `FEAT-WORKSPACE-004` | `F1` | Workspace / Notes Panes | First leaf-open slice implemented, owner QA pending | Полноценная Obsidian-like модель рабочих вкладок: в Notes mode окно/модуль/вкладка являются одним UX-понятием. Каждая сущность открывается один раз и фокусируется при повторном открытии; `Audio/Vault/Search/Context/Graph/Notifications` тоже существуют в единственном экземпляре. Drop в центр другой рабочей вкладки объединяет их в tab group, drop на края создает row/column split, визуальный preview должен быть единым тонким индикатором. Первый срез добавил `openNotesWorkspaceTabInNewLeaf()` / `openTabInNewLeaf`. | Ручная QA: открыть несколько разных сущностей из Vault/Search/ссылок и убедиться, что они появляются отдельными leaves; повторно открыть ту же сущность и убедиться, что она фокусируется без дубля; перетащить entity leaf и shell module в центр/края другой рабочей вкладки, проверив единый индикатор и отсутствие дублей. |
| `FEAT-ASSETS-LOAD-001` | `F1` | Asset Library / CanvasModule | First slice implemented, QA pending | Единые loading/error/retry states для image/GIF/video/PDF/audio/entity images. | Проверить entity image и Asset Browser image/video retry; расширить на canvas/entity image consumers по найденным QA-проблемам. |
| `FEAT-PDF-001` | `F2` | Asset Library / CanvasModule | Planned, needs design slice | Просмотр PDF и linked PDF card/page preview на canvas. | Design-doc перед зависимостями: viewer library, asset storage, zoom/search/page preview boundaries. |
| `FEAT-AUDIO-003` | `F1` | AudioModule | Foundation implemented, polish remains | Standalone local-first audio module с bottom dock, AudioDesk, ambience multi-loop и deck persistence. | Final mixer popup, reconnect-safe snapshots, permissions/delegation, artwork metadata policy. |
| `FEAT-ROLES-PLAYERS-001` | `F1` | SessionModule / Permissions | Foundation implemented, polish remains | Player identity foundation и role assignment есть. | Переименование, online/offline conflicts, `_playerOwner -> playerId` migration, explicit session feedback. |
| `FEAT-CANVAS-EXCALIDRAW-001` | `F2` | CanvasModule | Planned continuation | Advanced connector routing, line handles, binding UX, perf QA. | Делать отдельным canvas slice после desktop/UI stabilization. |

## Product gates

- World-level themes/custom locales: нужен формат хранения, миграция и rollback.
- Native multi-window/multi-monitor: только после Electron foundation QA.
- PDF viewer: не добавлять тяжёлую зависимость без design-doc.
- Permissions/visibility: не менять модель доступа без ручного GM/player QA.
- `.md` entity format: не менять без отдельного architecture gate.
