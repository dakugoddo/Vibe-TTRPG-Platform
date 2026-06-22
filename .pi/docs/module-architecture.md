# Module architecture

> Status: design seed for `FEAT-MODULES-001`.
> Date: 2026-05-25.

## Goal

Let large features such as the audio player, future 3D view, external API integrations, and optional GM tools grow without turning the core app into one tangled surface.

This is not a mod marketplace plan yet. The first target is a controlled internal module system:

- modules can be enabled/disabled from settings;
- optional UI is mounted lazily and not mixed into unrelated panels;
- sync/storage/contracts are explicit;
- permissions are checked through one role policy layer;
- feature code can be tested in slices.

## Why This Matters

If every feature is added directly to `App`, `RightDrawer`, `AssetBrowser`, and `yjsStore`, the app will eventually become hard to debug and slow to change. A module boundary keeps the platform local-first and flexible while still allowing rich functionality.

## Proposed Layers

### Tier 1: Internal Modules

Built with the app, controlled by settings.

Examples:

- `audio`: bottom player + mixer + audio session commands;
- `assetLibrary`: file browser and asset actions;
- `canvasTools`: advanced Excalidraw-like editing tools;
- `rulesEngine`: roll/mechanics runtime;
- `future3d`: optional 3D surface when the runtime decision is approved.

This is the safest near-term model.

### Tier 2: World-Enabled Modules

A world config declares which internal modules are active for that world/session.

Example:

```yaml
modules:
  audio:
    enabled: true
  future3d:
    enabled: false
```

### Tier 3: Trusted Local Extensions

Future-only. Local extension folders can add data packs or UI hooks through a constrained API. This should not be implemented until core permissions, schema migrations, and packaging are stable.

## Module Contract Draft

```ts
interface AppModule {
  id: string;
  label: string;
  version: string;
  defaultEnabled: boolean;
  requiredPermissions?: string[];
  settingsPanel?: React.LazyExoticComponent<React.ComponentType>;
  dockComponent?: React.LazyExoticComponent<React.ComponentType>;
  worldConfigSchemaVersion?: number;
}
```

## Foundation Slice Added

- `app/src/utils/appModules.ts` defines the first internal module registry.
- `assetLibrary` and `rulesEngine` are core and cannot be disabled.
- `audio` is optional/prototype and can be disabled by future settings UI.
- `canvasTools` is prototype but currently not disableable because existing canvas editing assumes the tools exist.
- `future3d` is planned and disabled by default.
- The registry is pure data/normalization only. It is not wired into `App` yet, so this slice does not change runtime behavior.
- `app/src/utils/appModules.test.ts` covers defaults, unknown keys, optional toggles and core-lock behavior.

Do not let modules directly own random global state. They should talk through stable core services:

- entities and markdown files;
- asset library;
- session/Yjs commands;
- permissions;
- settings/world config;
- canvas extension points.

## Performance Rules

- Mount heavy UI only when enabled.
- Prefer lazy imports for large optional surfaces.
- Do not start file watchers, timers, audio contexts, Yjs observers, or network/API polling unless the module is enabled and the user has permission.
- Keep long-running playback/receivers at the app shell level when they must survive UI tab switching.
- Store persistent world choices separately from local user preferences.

## Audio As First Consumer

The audio module should prove the pattern:

- `AudioControlDock` is a root-level module surface, not a database tab.
- `AssetBrowser` lists audio files but does not control playback.
- `AudioDesk` is the current GM control surface and may be redesigned visually without moving back into drawers/files.
- Working audio spec: `.pi/docs/gm-audio-desk.md`.
- External source policy: `.pi/docs/audio-source-extensions.md`.
- Settings should later expose world/user audio enablement, player permissions, and source policies.
- YouTube and SoundCloud support must pass product/API gate before code.

## Implementation Notes 2026-05-27

- Added `app/src/hooks/useAppModuleEnablement.ts` with localStorage-backed module toggles.
- `App` now mounts `AudioSessionBridge` and `AudioControlDock` only when the `audio` module is enabled.
- `SettingsWindow` exposes an `Аудио-модуль` toggle in the Audio tab.
- Current toggle is local-user scope. World-level module enablement is still an open product/architecture decision.

## Open Decisions For Owner

- Which modules are core-always-on versus optional?
- Should module enablement be per-world, per-user, or both?
- Should players be able to disable local module UI if the GM has enabled the world module?
- Is future third-party mod support a real goal, or only internal modules/data packs?
- How strict should module permissions be in a trusted tabletop environment?

## Решение 2026-06-22: что core, что модуль, что future mod

Критерий простой: если отключение функции ломает базовую работу мира, это core. Если мир остаётся рабочим, но исчезает отдельный рабочий инструмент, это internal module. Если функция нужна не всем системам/сеттингам или может жить как пакет контента, это future mod/data pack.

| Слой | Что входит | Правило |
|------|------------|---------|
| Core platform | Entity/.md format, file sync, permissions, base canvas, notes workspace, asset index, settings/i18n, theme tokens, module registry | Нельзя отключить без поломки мира или данных |
| Core content schema | Базовые типы entity, wiki links, generic character/object/ability/attack/tag/note/canvas, read-only compact cards | Это общий язык приложения, а не отдельная игровая система |
| Built-in optional modules | Audio desk, PDF viewer, 3D view, advanced canvas tools, combat/initiative tracker, automation/macros, graph view, import/export tools | Можно выключить локально/в мире; не меняет `.md` контракт без migration gate |
| System/data packs | D&D-like sheets, конкретные формулы бросков, статусы, предметные шаблоны, стартовые базы правил, локализации, визуальные темы | Должны ставиться как content pack/mod, а не зашиваться в core |
| External integrations | YouTube/SoundCloud, AI helpers, online importers, marketplace, сторонние API | Только opt-in module/mod, без фоновых запросов при выключении |

### Новые функции: предварительная раскладка

- Combat tracker: built-in optional module. Core хранит generic entities/resources; tracker читает их и не меняет формат мира без design-doc.
- PDF preview/card on canvas: built-in optional module поверх asset library. Не добавлять тяжёлую viewer-зависимость до design-doc.
- Graph view: built-in optional Notes module. Связи `[[id]]` остаются core, визуализация отключаемая.
- D&D 5e / d20 готовые листы: system pack. Core оставляет generic character sheet и formulas.
- Theme packs: future mod/data pack. Core хранит theme tokens и валидатор, но не обязан нести десятки стилей.
- Translation packs/editor: future mod/data pack plus world override layer. Core остаётся RU/EN + loader.
- Audio source providers: optional module per provider. Local audio остаётся текущим built-in audio module.
- 3D tabletop: built-in optional module after desktop/perf gate, not replacement for 2D canvas.

### Правило для кода

Не добавлять новый `AppModuleId` заранее. Сначала нужен хотя бы один реальный mount point или service gate; пустой toggle в настройках хуже отсутствия toggle.
