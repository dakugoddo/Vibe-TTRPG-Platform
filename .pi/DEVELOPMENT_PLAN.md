# Eternity Table: текущий план разработки

> Обновлено: 2026-06-07
> Назначение: короткий рабочий план. Этот файл не является журналом всех закрытых срезов.

## Правила вектора

- `продолжай` означает автономную работу до реального блокера.
- Core остаётся local-first: `.md` + YAML frontmatter на диске хоста.
- Крупные изменения проходят product/architecture gate: sync, permissions, `.md` формат, desktop packaging, native windows, plugin/mod API.
- Баги фиксируются через `.pi/BUG_BACKLOG.md`, фичи через `.pi/FEATURE_BACKLOG.md`.
- Длинные срезы имеют компактный handoff в `.pi/workflows/`.
- Git hygiene важна, но mixed dirty tree или runtime-файлы мира не должны блокировать полезную разработку.

## Текущее состояние

- UI/theme/i18n foundation реализован: semantic theme tokens, visual workspace presets, density registry, RU/EN switch, основные shell/entity/settings/assets/audio поверхности переведены на токены.
- Compact character card foundation реализован по уточнённому контракту: карточка на canvas информационная, без roll/edit/add/delete controls, detailed info показывается только при edit access к entity.
- Workspace foundation реализован локально: screen-window singleton, canvas pinned window instances, local window layouts, Obsidian-like Notes workspace с vault tree, tab/split editor, source/preview/split modes, entity data и linked context. Native multi-window отложен до desktop gate.
- Electron desktop foundation реализован: shell, preload IPC, native folder dialog, native asset reveal, embedded server path, build artifact metadata, player delivery baseline, `desktop:dev`, `desktop:pack`, `desktop:dist`, dev performance overlay.
- Beta 0.1 preparation started: product name `Eternity Table`, GitHub README and release checklist created.
- Canvas middle-button pan стабилизирован: compositor-first preview, small commit threshold, global listeners. Stage overscan отменён из-за FPS regression; Konva Stage должен оставаться размером viewport.

## Ближайший безопасный срез

1. Electron desktop polish:
   - app icon/signing visual metadata;
   - smoke QA packaged app.
2. Beta 0.1 release QA:
   - пройти `.pi/docs/release-0.1-beta-checklist.md`;
   - решить, какие `test-world/*` изменения являются demo-data, а какие runtime-мусор.
3. UI polish по фактическим шероховатостям после Electron QA:
   - оставшиеся hardcoded surfaces;
   - compact card/entity sheet читаемость;
   - theme consistency на разных плотностях.
4. Custom world locales/editor только после отдельного design-doc:
   - формат хранения в мире;
   - server endpoints;
   - import/export/rollback policy.
5. Notes workspace polish и native multi-window после Electron gate.

## Активные проверки

- Owner QA: Electron middle-button pan на тестовом мире должен оставаться визуально плавным, без возврата Stage overscan.
- Owner QA: packaged Electron build должен запускать embedded server и освобождать порт после закрытия.
- Manual QA: asset previews/audio/video через `/api/assets/file?path=...` на host и player origin.
- Manual QA: pinned entity windows должны разделять права на canvas placement и права на содержимое entity.

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
