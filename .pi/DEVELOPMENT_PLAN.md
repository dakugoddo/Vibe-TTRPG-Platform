# Eternity Table: текущий план разработки

> Обновлено: 2026-07-12
> Назначение: короткий рабочий план. Этот файл не является журналом всех закрытых срезов.

## Правила вектора

- `продолжай` означает автономную работу до реального блокера.
- Core остаётся local-first: `.md` + YAML frontmatter на диске хоста.
- Крупные изменения проходят product/architecture gate: sync, permissions, `.md` формат, desktop packaging, native windows, plugin/mod API.
- Баги фиксируются через `.pi/BUG_BACKLOG.md`, фичи через `.pi/FEATURE_BACKLOG.md`.
- Длинные срезы имеют компактный handoff в `.pi/workflows/`.
- Git hygiene важна, но mixed dirty tree или runtime-файлы мира не должны блокировать полезную разработку.

## Текущее состояние

- UI/theme/i18n foundation реализован: semantic theme tokens, visual workspace presets, density registry, RU/EN switch, основные shell/entity/settings/assets/audio поверхности переведены на токены. Settings/Notes shell UI и StyleDemo закрыты дополнительным EN-pass; Electron умеет открывать встроенную папку `locales`. Оставшаяся кириллица в коде в основном относится к data/model compatibility, тестам и шаблонам новых сущностей, а не к стабильному UI chrome.
- Compact character card foundation реализован по уточнённому контракту: карточка на canvas информационная, без roll/edit/add/delete controls, detailed info показывается только при edit access к entity.
- Workspace foundation реализован локально: screen-window singleton, canvas pinned window instances, local window layouts, Obsidian-like Notes workspace с vault tree, tab/split editor, source/preview/split modes, entity data, linked context и unified movable Notes shell modules, включая обязательный `Editor`. Первый leaf-open срез для Notes panes реализован: новая сущность открывается отдельным editor leaf рядом с активным, повторное открытие фокусирует существующий leaf. Native multi-window отложен до desktop gate.
- Electron desktop foundation реализован: shell, preload IPC, native folder dialog, native asset reveal, embedded server path, build artifact metadata, custom app icon, lazy-loaded app shell chunks, player delivery baseline, `desktop:dev`, `desktop:pack`, `desktop:dist`, dev performance overlay.
- Alpha 0.1 опубликована: чистый `main`, Windows portable/setup artifacts, release checksums, bundled preview world, двуязычные README (`README.md`/`README.ru.md`) и collapsible changelog в публичной документации.
- Canvas middle-button pan стабилизирован: compositor-first preview, small commit threshold, global listeners. Stage overscan отменён из-за FPS regression; Konva Stage должен оставаться размером viewport.
- Module/mod gate зафиксирован: новые крупные функции сначала классифицируются как core platform, built-in optional module или future mod/data pack; пустые module toggles без реального mount point не добавлять.

## Ближайший безопасный срез

1. Post-alpha public main hygiene:
   - при любом обновлении `main` обновлять обе публичные README-версии (`README.md` и `README.ru.md`), общий статус/описание и collapsible changelog (`<details><summary>...</summary>`);
   - процедурное правило сохранено как локальный Hermes skill `vibe-main-branch-release-rules`;
   - публичный `main` должен оставаться app-only: без `test-world/`, `.pi/`, agent files, Graphify output, прототипов, секретов и generated artifacts.
2. Pre-release usability pack:
   - идти по `.pi/docs/pre-release-usability-pack.md`;
   - completed slices: `Asset loading/error/retry foundation`, `Entity quick actions`, `Notes discoverability polish`, `Audio dock states`, `Canvas card readability`, `Startup clarity`, `Settings reset controls`;
   - automated release QA passed 2026-06-20;
   - следующий пункт: manual QA после опубликованной alpha, с фиксацией найденных blocker/high bugs.
3. Electron desktop polish:
   - Windows signing decision;
   - clean/public alpha artifacts опубликованы и скачанный portable smoke прошёл; следующий шаг — clean-machine manual QA.
4. UI polish по фактическим шероховатостям после Electron QA:
   - manual English smoke по основным экранам;
   - оставшиеся hardcoded surfaces только если это реальные UI-подписи, а не данные мира/шаблоны;
   - compact card/entity sheet читаемость;
   - theme consistency на разных плотностях.
5. Custom world locales/editor только после отдельного design-doc:
   - design-doc расширен в `.pi/docs/i18n-custom-locales-foundation.md`;
   - server list/read/write/rollback endpoints, typed client API, Settings preview/editor, pure merge/flatten utils и client-side preview merge реализованы;
   - write endpoint создаёт `.bak` и откатывает файл при ошибке; Settings editor пишет только JSON object через ConfirmDialog, умеет rollback из `.bak` и draft import/export;
   - runtime application supported world overrides (`ru/en`) подключён для host/current room; host публикует supported locale snapshots в Yjs `worldLocales`, player-клиенты применяют их без File API; Settings editor получил key-table поверх JSON draft с фильтрами; unsupported locale files остаются редактируемыми data-pack файлами;
   - manual QA checklist: `.pi/docs/world-locale-editor-qa.md`;
   - следующий безопасный срез после QA: точечная полировка editor UX по фактическим проблемам.
6. Notes workspace polish и native multi-window после Electron gate:
   - ручная QA shell modules/settings/reset/audio dock, включая перенос `Editor`/`Vault`/`Context` между left/center/right;
   - текущий архитектурный срез: проверить первый Obsidian-like editor leaf model pass, где новая сущность открывается отдельным leaf, center-drop объединяет leaf в tab group, edge-drop создает split;
   - polish будущих shell-расширений после owner QA.
7. Следующее обновление — архитектурный epic `Entity UI / Sheet Builder` (`FEAT-ENTITY-UI-BUILDER-001`):
   - переработать UI сущности, который отображается в canvas entity windows, из набора hardcoded sheets в data-driven конструктор без немедленного изменения канонического `.md` entity-формата;
   - разделить **данные сущности**, **описание UI/layout** и **runtime-вычисления**, чтобы одна схема интерфейса могла безопасно переиспользоваться разными типами сущностей и темами;
   - предусмотреть block registry: базовые display/input/layout blocks, составные секции и специальные функциональные блоки (`HP/resource`, wounds, attributes, inventory, attacks, abilities, rolls, Markdown, children/relations), каждый с typed config, permissions и predictable runtime contract;
   - дать GM/editor режим модернизации: добавление/удаление/reorder/resize/group blocks, настройка заголовков/плотности/варианта внешнего вида через semantic theme tokens, выбор data binding и preview desktop/player/read-only states;
   - спроектировать binding/formula graph: ссылки на `properties`, parent/child context bubbling, arithmetic/conditions/clamp/derived values, Roll Engine integration, dependency-cycle detection, cached evaluation и объяснимый breakdown источников;
   - HP/resource block должен настраивать source/current/max/temp, min/max policy, отображение bar/counter/pips, права изменения, автоматические эффекты/threshold events и формулы, но не исполнять произвольный JavaScript;
   - предусмотреть schema versioning, draft/publish, undo/redo, validation, safe fallback к built-in sheet, migration/rollback, import/export templates и будущий mod/data-pack registry;
   - architecture gate создан в `.pi/docs/entity-ui-sheet-builder-architecture.md`: отдельно зафиксированы schema/registry, binding resolver, permissions, storage/sync phases, formula AST, theme contract, fallback, migrations и plugin boundary;
   - первый implementation slice после owner gate — только V1 schema + pure validator/round-trip + registry `container`/`property-value` + read-only internal preview renderer с hardcoded-sheet fallback; без изменений `.md`, server API, Yjs, authoring и production sheets;
   - до implementation нужен owner approval предложенных defaults и решений Phase 1: storage folder, assignment precedence, schema author roles, hand-edit policy, history depth и первый production consumer.

## Активные проверки

- Owner QA: Electron middle-button pan на тестовом мире должен оставаться визуально плавным, без возврата Stage overscan.
- Owner QA: packaged/downloaded Electron portable уже поднимает embedded server и освобождает порт после закрытия; следующий уровень — clean-machine manual QA и проверка installer flow.
- Manual QA: asset previews/audio/video через `/api/assets/file?path=...` на host и player origin.
- Manual QA: Canvas clipboard paste должен работать только после фокуса/последнего клика по canvas: plain text создаёт прямоугольник с текущими стилями rect tool, PNG/JPG/GIF из clipboard загружаются как assets и вставляются на canvas; paste в input/textarea/contenteditable/окне сущности не должен создавать canvas-объекты.
- Manual QA: pre-release usability pack должен проверяться по `.pi/docs/pre-release-usability-pack.md` после каждого completed slice.
- Manual QA: pinned entity windows должны разделять права на canvas placement и права на содержимое entity.
- Manual QA: Notes shell modules должны после reload восстановить нормальные области из legacy storage, переключаться через ribbon/settings, обязательный `Editor` не должен выключаться, все module frames должны перетаскиваться за шапку между left/center/right, left/right edge drop должен ставить окна рядом по горизонтали внутри области, top/bottom edge drop должен возвращать вертикальную стопку, пустые left/center/right drop-области должны оставаться доступными после переноса последнего модуля, editor не должен показывать лишнюю `G1`-шапку над вкладками, shell-сегменты не должны скроллиться вместо самих модулей, reset не должен закрывать вкладки, Audio dock не должен останавливать playback при Canvas/Notes switch.
- Manual QA: Notes editor leaves должны открываться из Vault/Search/ссылок как отдельные окна внутри `Editor`, повторный клик по уже открытой сущности должен только фокусировать её, drop в центр другого leaf должен объединять сущности во вкладки, drop на края должен создавать row/column split без пустых окон, перетаскивание не должно показывать browser ghost preview или большой full-pane overlay, header split-кнопок быть не должно.
- Manual QA: Notes embedded Audio должен показывать одну шапку модуля без внутренних повторов `Пульт звука`; Canvas floating Audio должен сохранить нижний player и обычный popup.

## Не трогать без отдельного решения

- Формат `.md` entity/YAML frontmatter.
- Ролевую модель и приватность GM/player без полного QA.
- World-level theme/custom locale storage.
- Native multi-window/multi-monitor runtime.
- Runtime-файлы `test-world/*`.
- Reference prototypes в `.pi/prototypes/*.html`.

## Каноничные документы

- `.pi/workflows/current-ui-redesign.md` — живой handoff текущего UI/Electron направления.
- `.pi/BUG_BACKLOG.md` — только активные/QA-pending баги.
- `.pi/FEATURE_BACKLOG.md` — только активные/планируемые фичи.
- `.pi/docs/electron-desktop-migration-plan.md` — desktop architecture gate.
- `.pi/docs/release-0.1-beta-checklist.md` — чеклист перед beta tag/release.
- `.pi/docs/ui-redesign-master-plan.md` — решения и анализ по UI.
- `.pi/docs/compact-character-card-canvas.md` — контракт compact character card.
- `.pi/docs/entity-ui-sheet-builder-architecture.md` — architecture gate следующего Entity UI / Sheet Builder epic.
- `.pi/docs/notes-workspace-obsidian-redesign.md` — контракт Obsidian-like режима заметок.
- `.pi/rules/canvas-best-practices.md` — правила canvas performance и middle-pan.
- `.pi/docs/code-map.md` — карта владельцев логики.
