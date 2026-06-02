# Workspace/window ergonomics plan

> Дата: 2026-06-02  
> Статус: product/design gate + первый local-only code slice для `FEAT-UI-002` / `FEAT-WORKSPACE-001`

## Цель

Довести работу с окнами до Obsidian-like workspace: ГМ и автор мира должны быстро раскладывать 2-4 сущности рядом, держать заметки/правила/персонажей под рукой, переключаться между canvas и базой знаний, а в будущем использовать несколько мониторов без потери локально-первой модели.

Важно: это не отдельный "режим заметок" и не новый state-manager. Нужно развить существующий `windowStore` / `WindowManager` / `EntityWindow`.

## Текущий контракт

- `app/src/store/windowStore.ts` хранит `WindowState`: `id`, `entityId`, `mode`, `x/y`, `width/height`, `zIndex`, `isPinned`, `canvasId`.
- Окна сохраняются в `localStorage` по комнате через `vibe-ttrpg-windows-*`.
- Pinned окна могут сохраняться в `entity.properties.windowState` и гидратятся из `WindowManager`.
- `WindowManager` уже разделяет два слоя:
  - pinned canvas-space layer `z-10`, масштабируется вместе с canvas;
  - unpinned screen-space layer `z-50`, живёт поверх рабочего пространства.
- `EntityWindow` уже использует `react-rnd`, поддерживает drag/resize, `compact/full/icon`, pin/unpin и контекстное меню.

## Боль сейчас

- Нет быстрых layout actions: поставить окно слева/справа, в угол, рядом с активным, сеткой 2x2.
- `openWindow(entityId)` всегда фокусирует существующее окно по ID; для multi-reference работы нужна явная модель: один live-window на entity или несколько screen copies.
- `compact/full/icon` описывают debug/размер, но не workspace intent: reading, editing, reference, pinned note.
- Нет workspace presets: "подготовка лора", "сессия", "боевой стол", "аудио + заметки".
- Multi-monitor в браузере не может полноценно управлять внешними окнами без отдельного browser window / future desktop runtime. Но можно подготовить контракт popout/layout snapshots уже сейчас.
- При широком окне контент может стать слишком растянутым; нужен max content width внутри больших окон.

## Принцип решения

1. Не менять `.md` формат сущностей для первого среза.
2. Не ломать существующий `WindowState`; добавлять поля только если без них нельзя.
3. Разделить "layout действия" и "workspace persistence":
   - layout actions можно делать локально в `windowStore`;
   - сохранение пресетов лучше хранить локально или в мире только после product gate.
4. Сначала дать быстрые эргономичные команды, потом уже создавать сложный workspace manager.

## Предлагаемый MVP

### Срез 1: window layout actions без нового формата мира

Добавить в `windowStore` чистые действия:

- `tileWindow(id, preset)`:
  - `left`, `right`, `top`, `bottom`;
  - `topLeft`, `topRight`, `bottomLeft`, `bottomRight`;
  - `center`, `wideCenter`;
  - `twoColumnPrimary`, если активное окно должно занять левую большую область.
- `cascadeWindows()` для быстрого наведения порядка.
- `arrangeVisibleWindowsGrid()` для 2-4 открытых окон.

UI:

- В `EntityWindow` header/context menu добавить icon-only layout menu рядом с pin/mode.
- В меню использовать lucide icons, короткие tooltips, без текстовых "инструкций" внутри приложения.
- Для pinned окон layout actions либо disabled, либо переводят в canvas-space presets только после отдельного решения.

Плюсы:

- Быстро полезно для Obsidian-like работы.
- Не трогает world files.
- Не требует desktop/multi-monitor runtime.

Риски:

- Нужно аккуратно clamped sizing, чтобы окна не улетали за viewport.
- На маленьких экранах сетка 2x2 должна деградировать в stacked layout.

### Implementation note 2026-06-02

Первый local-only срез внесён:

- `app/src/utils/windowLayout.ts` содержит pure layout math для `left/right/corners/center/wideCenter/grid/cascade`.
- `app/src/store/windowStore.ts` получил `tileWindow`, `arrangeVisibleWindowsGrid`, `cascadeVisibleWindows`.
- `app/src/components/windows/EntityWindow.tsx` получил icon-only layout menu для unpinned окон.
- Pinned windows пока не участвуют в auto-layout, чтобы не ломать canvas-space координаты.
- Срез не меняет `.md`, `WindowState` формат и world-shared storage.

### Срез 2: workspace snapshots

Добавить локальные snapshots:

- "Сохранить текущую раскладку";
- "Восстановить раскладку";
- "Сбросить раскладку".

Хранение:

- Первый безопасный вариант: `localStorage` per room/player.
- World-shared вариант: отдельный `world_ui/workspaces/*.json` или поле в world settings, только после product gate.

### Срез 3: reading layout для notes

Для `note` и generic markdown windows:

- max readable content width внутри очень широкого окна;
- более спокойный reading surface;
- sticky local tabs/outline позже, если markdown станет длинным.

Это лучше делать после layout actions, потому что пользователь сначала должен удобно поставить несколько заметок рядом.

### Срез 4: future multi-monitor / popout

В браузере:

- можно открыть новый browser tab/window с route параметром `?workspace=...` или `?entity=...`;
- окна между вкладками не будут магически одним DOM, нужна sync через текущий Zustand/Yjs/URL-state;
- browser popout нельзя надёжно позиционировать на конкретном мониторе.

В future desktop/Tauri:

- можно делать настоящие native windows на разных мониторах;
- нужен отдельный platform gate и контракт, какие workspace snapshots открываются как native windows.

## Что не делать сейчас

- Не вводить новый глобальный workspace engine до layout actions.
- Не писать world-shared workspace формат без решения владельца.
- Не делать multi-monitor через хаки браузера, которые будут ломаться в Hamachi/Radmin сессиях.
- Не превращать pinned canvas windows и unpinned screen windows в одну модель без теста координат.

## Вопросы владельцу

1. Нужно ли разрешить несколько screen-window копий одной entity одновременно, или одна entity = одно активное окно, а для сравнения использовать только разные сущности?
2. Layout presets должны быть только локальными для пользователя или ГМ должен уметь раздать игрокам "сценарную раскладку"?
3. Pinned canvas окна должны участвовать в auto-layout, или auto-layout работает только с unpinned screen windows?
4. Нужно ли в первом MVP отдельное окно/режим "Notes workspace", или достаточно layout actions + улучшенного reading layout для note windows?
5. Для multi-monitor ближайшая цель: browser popout/tab foundation или ждать Tauri/native window gate?

## Рекомендация по умолчанию

Сделать сначала `Срез 1`: локальные layout actions для unpinned окон. Это даст быстрый прирост удобства без миграции, без новых файлов мира и без спорного multi-monitor решения. После ручной проверки 2-4 окон можно идти в local workspace snapshots.

## QA первого среза

- Открыть 4 сущности, разложить grid 2x2, перезапустить клиент и проверить localStorage restore.
- В header unpinned окна открыть layout menu и проверить left/right/corner/center/wide center.
- Открыть заметку + персонажа рядом: текст не должен растягиваться уродливо на широкий viewport.
- Проверить маленький viewport: layout menu не должен создавать окна шире экрана.
- Проверить pinned окно: layout action не должен ломать canvas scale/offset.
- Проверить фокус/z-index после auto-layout: активное окно остаётся сверху.
