# Eternity Table: текущий план разработки

> Обновлено: 2026-06-22
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
- Beta 0.1 preparation started: product name `Eternity Table`, GitHub README and release checklist created.
- Canvas middle-button pan стабилизирован: compositor-first preview, small commit threshold, global listeners. Stage overscan отменён из-за FPS regression; Konva Stage должен оставаться размером viewport.
- Module/mod gate зафиксирован: новые крупные функции сначала классифицируются как core platform, built-in optional module или future mod/data pack; пустые module toggles без реального mount point не добавлять.

## Ближайший безопасный срез

1. Pre-release usability pack:
   - идти по `.pi/docs/pre-release-usability-pack.md`;
   - completed slices: `Asset loading/error/retry foundation`, `Entity quick actions`, `Notes discoverability polish`, `Audio dock states`, `Canvas card readability`, `Startup clarity`, `Settings reset controls`;
   - automated release QA passed 2026-06-20;
   - текущий пункт: manual QA по pack перед beta;
   - далее: beta release checklist.
2. Electron desktop polish:
   - Windows signing decision;
   - `desktop:pack` passed 2026-06-20; manual launch smoke packaged app remains.
3. Beta 0.1 release QA:
   - пройти `.pi/docs/release-0.1-beta-checklist.md`;
   - решить, какие `test-world/*` изменения являются demo-data, а какие runtime-мусор.
4. UI polish по фактическим шероховатостям после Electron QA:
   - manual English smoke по основным экранам;
   - оставшиеся hardcoded surfaces только если это реальные UI-подписи, а не данные мира/шаблоны;
   - compact card/entity sheet читаемость;
   - theme consistency на разных плотностях.
5. Custom world locales/editor только после отдельного design-doc:
   - design-doc расширен в `.pi/docs/i18n-custom-locales-foundation.md`;
   - read-only server endpoints, typed client API, Settings preview, pure merge/flatten utils и client-side preview merge реализованы без записи в мир;
   - следующий безопасный кодовый срез: write endpoint только с backup/rollback и focused tests;
   - editor/import/export UI — только после read-only QA и write endpoint.
6. Notes workspace polish и native multi-window после Electron gate:
   - ручная QA shell modules/settings/reset/audio dock, включая перенос `Editor`/`Vault`/`Context` между left/center/right;
   - текущий архитектурный срез: проверить первый Obsidian-like editor leaf model pass, где новая сущность открывается отдельным leaf, center-drop объединяет leaf в tab group, edge-drop создает split;
   - polish будущих shell-расширений после owner QA.

## Активные проверки

- Owner QA: Electron middle-button pan на тестовом мире должен оставаться визуально плавным, без возврата Stage overscan.
- Owner QA: packaged Electron build должен запускать embedded server и освобождать порт после закрытия.
- Manual QA: asset previews/audio/video через `/api/assets/file?path=...` на host и player origin.
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
- `.pi/docs/notes-workspace-obsidian-redesign.md` — контракт Obsidian-like режима заметок.
- `.pi/rules/canvas-best-practices.md` — правила canvas performance и middle-pan.
- `.pi/docs/code-map.md` — карта владельцев логики.
