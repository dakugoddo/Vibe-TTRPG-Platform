# Current workflow: UI redesign foundation

> Дата обновления: 2026-06-02
> Статус: Active
> Связанные задачи: `FEAT-UI-002`, `FEAT-I18N-002`, будущий compact character card view

## Цель

Довести интерфейс Vibe TTRPG до цельного, стильного и компактного foundation перед новой крупной разработкой: визуальные темы как полноценные workspaces, читаемые entity sheets, удобные настройки, будущий переводческий слой и компактные карточки персонажей на canvas.

## Решения владельца

- Темы - это не simple light/dark palette, а разные визуальные рабочие столы: Universal Glass, Wooden Tabletop, RGB/Game Desk, Arcane/Tech Desk, Low Load и будущие моддерские стили.
- Отдельная светлая тема на старте не нужна.
- Плотность по умолчанию - `balanced`.
- Статы и сущности должны быть компактными, но не сухой Excel: важные числа читаются крупнее, большие массивы остаются сканируемыми.
- Для списков предметов/атак/способностей нужны оба режима: строгая таблица и визуальная карточная сетка.
- Отдельный боевой режим чарника не нужен, но нужен compact character card на canvas с быстрыми вкладками/статами/атаками/способностями.
- Notes/workspace должен двигаться к Obsidian-like работе с несколькими окнами; будущий multi-window/multi-monitor режим важен.
- Темы и кастомные переводы можно хранить в мире; редактор переводов полезен для моддеров, но не должен быть тяжёлым первым срезом.
- Effects зависят от темы; low-load тема может отключать тяжёлые blur/animation/effects.
- Layout адаптивный, но с оптимальными max-width/max-height, чтобы контент не растягивался уродливо на полный монитор.

## Текущее состояние

- `theme.ts` уже содержит semantic CSS variables и built-in visual presets.
- SettingsWindow показывает visual theme presets и временный `Custom palette`.
- App shell, drawers, HUD, CanvasToolbar, AudioControlDock, NotificationCenter переведены на semantic tokens.
- EntityWindow, CharacterSheet notes, MarkdownRenderer, core entity blocks, ObjectSheet, AttackSheet, InventoryBlock, StatTooltip, TagPickerPopup, EntityImageBlock переведены на semantic tokens.
- SettingsWindow, AssetBrowser и AudioDesk переведены на semantic tokens.
- `FEAT-I18N-002` первый срез внесён: `SettingsWindow -> Интерфейс` получил RU/EN switch, i18next инициализируется из localStorage, добавлены `localization.ts`, `useLocalePreference.ts`, focused test и mini-plan `.pi/docs/i18n-custom-locales-foundation.md`.
- Compact character card первый срез внесён: `characterCardSummary.ts` строит быстрые метрики/resources/action counts, а token info overlay показывает compact summary для `character` без изменения `DrawElement`.
- `Фишка` и `Карточка` теперь открывают единый DOM compact overlay через кнопку `i`; вкладки добавляются туда, а не в legacy inline Konva overlay.
- Compact character card tabbed content внесён: `Статы`, `Действия`, `Ресурсы`, `Заметки`. Helper отдаёт первые атаки/способности с формулами, nested attack parent name и inventory preview.
- Compact character card roll actions внесены: `AttackSheet`, `AbilitiesBlock` и canvas compact card используют общий `entityActionRoll` service поверх Roll Engine facade.
- Workspace/window ergonomics design gate и первый local-only code slice внесены: `.pi/docs/workspace-window-ergonomics-plan.md`, `windowLayout.ts`, `tileWindow`, `arrangeVisibleWindowsGrid`, `cascadeVisibleWindows`, quick screen snapshot, layout menu в `EntityWindow`.
- Notes workspace mode design gate и local-only foundation внесены: `.pi/docs/notes-workspace-mode-design.md`, `workspaceMode.ts`, `workspaceModeStore.ts`, HUD `Канвас/Заметки`, `NotesWorkspace`, скрытие `InfiniteCanvas`/`CanvasToolbar`, canvas-pinned placements в notes mode, named local snapshots screen-окон, pure tab/split model `notesWorkspaceLayout.ts`, persisted local tab board через `notesWorkspaceStore.ts`, read-only linked views через `notesWorkspaceLinks.ts` и drag/drop вкладок внутри/между groups.
- Notes workspace resize polish внесён: split panes используют persisted `ratio`, drag-handle между группами обновляет ratio через store, а pure helper клампит размер, чтобы панели не схлопывались.
- Tauri/native migration gate внесён: `.pi/docs/tauri-native-migration-plan.md` фиксирует Tauri v2 host shell + React/Vite frontend + текущий Express/Yjs server как sidecar-прототип; runtime rewrite, browser popout и native multi-window не начинать до отдельной prototype branch.
- Compact character card defaults gate внесён: `.pi/docs/compact-character-card-defaults-gate.md` рекомендует `entity.properties.compactCard`, но код не начинать до решения владельца по вопросам хранения, auto-pick, GM/player view и лимитам.
- Документация обновлена в `.pi/docs/ui-redesign-master-plan.md`, `.pi/DEVELOPMENT_PLAN.md`, `.pi/FEATURE_BACKLOG.md` и `.pi/skills/vibe-ui-architecture/SKILL.md`.
- Последние token-pass изменения проверены командами `npm.cmd exec tsc -- --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `tsx src/utils/theme.test.ts`, но могут оставаться незакоммиченными из-за git/sandbox approval limit.

## Нельзя трогать без отдельного запроса

- Runtime/user dirty тестового мира:
  - `test-world/.index.json`
  - `test-world/general/canvases/root.md`
  - `test-world/gm/audio_deck.json`
- Reference prototypes владельца в `.pi/prototypes/*.html` считать входными референсами, а не кодом приложения.
- Не вводить новый формат тем мира, custom locales storage, multi-window runtime или entity `.md` формат без product gate.
- Не добавлять зависимости для UI/i18n без явного согласия.

## Следующий безопасный срез

1. Ответить на вопросы `.pi/docs/compact-character-card-defaults-gate.md` перед кодом entity-level compact card defaults.
2. Custom world locales/editor продолжать только после отдельного формата и server endpoint design.
3. Tauri/native продолжать только через отдельную prototype branch: shell -> sidecar lifecycle -> player delivery -> native windows.

## Проверки

Минимум после code slice:

```bat
cd app
npm.cmd exec tsc -- --noEmit
npm.cmd run lint
npm.cmd run build
..\server\node_modules\.bin\tsx.cmd src\utils\characterCardSummary.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\entityActionRollModel.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\windowLayout.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\notesWorkspaceLayout.test.ts
..\server\node_modules\.bin\tsx.cmd src\store\notesWorkspaceStore.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\notesWorkspaceLinks.test.ts
```

Если менялся `theme.ts`, дополнительно:

```bat
cd app
..\server\node_modules\.bin\tsx.cmd src\utils\theme.test.ts
```

Для UI желательно открыть локальное приложение в Browser/in-app browser и проверить Settings/AssetBrowser/AudioDesk. Если Browser недоступен или сервер не запущен, честно записать это в финале.

## Обновление 2026-06-03

Решения владельца по workspace:

- Screen entity window = один личный unpinned экземпляр. Повторное открытие фокусирует screen window.
- Pinned windows/cards/tokens на canvas = отдельные canvas placements. Одну сущность можно закреплять много раз.
- Window layouts/snapshots остаются локальными для пользователя. GM-shared layouts не нужны.
- Движение/удаление canvas placement проверяется по праву на canvas; редактирование содержимого - по праву на entity.
- Tauri/native migration стала вторым крупным приоритетом после UI foundation; multi-window/multi-monitor перенесён после Tauri gate.
- Tauri gate закрыт документом `.pi/docs/tauri-native-migration-plan.md`: первый путь - Tauri host shell и существующий server как sidecar, без переписи на Rust до proof.
- Нужен будущий Notes workspace mode: Obsidian-like режим без рендера canvas, с заметками/сущностями как вкладками/панелями. Перед кодом изучить Obsidian workspace docs/patterns.

Кодовый foundation внесён:

- `canvasWindowInstances[]` в canvas entity заменяет новый shared pinned-window путь.
- `windowStore.openWindow` теперь работает как screen singleton и не блокируется pinned copies.
- `EntityWindow` больше не пишет pinned `windowState` в саму entity; pin создаёт canvas placement, unpin/delete удаляет placement.
- Если entity недоступна игроку, pinned window показывает заглушку без содержимого.
- `NotesWorkspace` добавлен как локальный режим интерфейса: canvas не рендерится, canvas toolbar скрыт, canvas-specific drop route отключён, а screen windows продолжают работать через существующий `EntityWindow`.
- Named local snapshots добавлены в `windowStore` и левую панель `NotesWorkspace`: screen-window раскладки можно сохранить под именем, восстановить и удалить; canvas-pinned placements не попадают в snapshot.
- Pure tab/split model добавлен в `notesWorkspaceLayout.ts` и подключён к `NotesWorkspace` через local-only `notesWorkspaceStore.ts`: tab board умеет открывать сущность в existing screen window, фокусировать окно, закрывать вкладку, split-ить активную группу и переживать reload через validated `localStorage` без world format и без параллельного editor.
- Read-only linked views добавлены через `notesWorkspaceLinks.ts`: Markdown, outline по headings, backlinks и graph-summary показываются внутри tab board без записи в мир и без нового editor.
- Drag/drop вкладок добавлен через `moveNotesWorkspaceTab`, `notesWorkspaceStore.moveTab` и HTML drag/drop в `NotesWorkspace`: можно менять порядок вкладок и переносить их между tab groups.
- Resize split panes добавлен через `setNotesWorkspaceSplitRatio`, `notesWorkspaceStore.resizeSplit` и draggable separator в `NotesWorkspace`: размеры групп сохраняются локально в существующий layout.
- Compact character card defaults gate добавлен в `.pi/docs/compact-character-card-defaults-gate.md`: рекомендуемый формат `properties.compactCard`, вопросы владельцу и первый implementation slice.

Следующий безопасный UI-срез:

1. Entity-level compact card defaults делать только после ответов владельца на `.pi/docs/compact-character-card-defaults-gate.md`, потому что это затронет UX сущностей и preference format.
2. Tauri/native продолжать только в prototype branch по `.pi/docs/tauri-native-migration-plan.md`; не начинать browser popout как основной путь multi-monitor.
3. Custom world locales/editor продолжать только после отдельного формата и server endpoint design.

## Handoff note

Следующий агент должен продолжать UI foundation, а не возвращаться к аудио/roles/canvas крупным срезам, пока интерфейсный фундамент не станет устойчивым. Ближайшие шаги требуют gate: entity-level compact card defaults или отдельная Tauri prototype branch; не делать runtime rewrite в основном дереве.
