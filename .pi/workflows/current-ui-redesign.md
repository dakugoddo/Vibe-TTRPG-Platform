# Current workflow: UI/Electron foundation

> Обновлено: 2026-06-07
> Статус: Active handoff
> Связанные задачи: `FEAT-UI-002`, `FEAT-I18N-002`, `FEAT-PLATFORM-ELECTRON-001`, `FEAT-WORKSPACE-001`

## Цель

Держать текущий UI/Electron срез продолжабельным после compaction: что уже решено, что нельзя трогать без gate и какой следующий безопасный шаг.

## Решения владельца

- Темы — это полноценные визуальные рабочие столы, а не simple light/dark palette.
- Светлая/тёмная пара на старте не нужна; важнее разные стили и low-load вариант.
- Плотность по умолчанию — `balanced`.
- Интерфейс должен быть компактным и читаемым: больше цифр на экране, но не “сухой Excel”.
- Для списков нужны оба вида: плотная таблица и визуальная карточная сетка.
- Compact character card — это информация прямо на canvas card, не отдельный боевой режим и не настройки выбора полей.
- Canvas compact card не содержит roll/edit/add/delete controls; действия остаются в entity window.
- Screen entity window — один личный unpinned экземпляр. Canvas pinned windows/cards/tokens — отдельные placements, их можно иметь много.
- Window layouts локальные. GM показывает игрокам нужное через canvas placements, а не shared screen windows.
- Notes workspace должен идти к Obsidian-like workflow: vault tree, editor tabs/splits, source/preview/split modes, entity data и linked panes вокруг активной сущности. Native multi-window идёт после Electron gate.
- Electron migration приоритетнее полного Notes workspace/multi-window.

## Реализовано

- `theme.ts`: semantic CSS variables, visual presets, density registry.
- App shell/drawers/HUD/toolbar/audio/notifications переведены на semantic tokens.
- EntityWindow, CharacterSheet notes, MarkdownRenderer, core entity blocks, ObjectSheet, AttackSheet, InventoryBlock, StatTooltip, TagPickerPopup, EntityImageBlock переведены на semantic tokens.
- SettingsWindow, AssetBrowser, AudioDesk переведены на semantic tokens.
- i18n foundation: RU/EN switch, localStorage preference, i18next initialization.
- Compact character card: all-info derived summary, tabbed read-only overlay, edit-access gate, no `properties.compactCard`.
- Workspace foundation: screen singleton windows, local layouts/snapshots, canvas pinned window instances, Obsidian-like local Notes workspace tab/split editor, source/preview/split modes, entity data, children and linked views.
- Electron foundation: main/preload, native world folder dialog, native asset reveal, desktop dev script, embedded server build path, package/dist scripts, build artifact metadata, player delivery baseline, packaged smoke path.
- Canvas performance regression fix: middle-button pan uses compositor-first preview; Stage overscan removed and must not be reintroduced without profiling.

## Не трогать без отдельного запроса

- `test-world/*` runtime files.
- `.pi/prototypes/*.html` reference prototypes from owner.
- Entity `.md`/YAML format.
- World-level theme/custom locale storage.
- Native multi-window/multi-monitor runtime.
- Permissions/visibility model.
- New UI/i18n dependencies.

## Следующий безопасный срез

1. Electron desktop polish:
   - app icon/signing visual metadata;
   - packaged app smoke QA.
2. UI polish только по конкретным найденным дефектам:
   - hardcoded surfaces;
   - compact card readability;
   - theme/density consistency.
3. Custom world locale editor — только после design-doc формата и server endpoints.
4. Notes workspace polish/native multi-window — после Electron gate.

## Проверки после code slice

Минимум для frontend/desktop среза:

```bat
cd app
npm.cmd exec tsc -- --noEmit
npm.cmd run lint
npm.cmd run build
npm.cmd run desktop:build
```

Focused tests по необходимости:

```bat
cd app
..\server\node_modules\.bin\tsx.cmd src\utils\characterCardSummary.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\notesWorkspaceLayout.test.ts
..\server\node_modules\.bin\tsx.cmd src\store\notesWorkspaceStore.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\notesWorkspaceLinks.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\theme.test.ts
```

Для canvas performance:

- Проверить middle-button pan в dev Electron с открытым perf overlay.
- Не считать Stage overscan допустимым фикс-путём без профиля.
- Если clipping снова виден, сначала уменьшать/профилировать commit threshold.
