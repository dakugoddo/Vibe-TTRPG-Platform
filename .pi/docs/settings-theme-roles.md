# Settings, themes and roles

> Дата: 2026-05-22  
> Статус: design draft для `FEAT-SETTINGS-001`; settings shell, local custom palette и role policy foundation внесены 2026-05-23.

## Цель

Нужно полноценное окно настроек, где игрок меняет безопасные личные параметры, а ГМ управляет миром, сессией, ролями, правами и темой. Темы должны быть простыми для пользовательской настройки, а права не должны ломать доверенную локально-первую модель.

## Разделение настроек

### Local user settings

Хранятся локально в браузере/клиенте:

- язык;
- масштаб UI;
- личная громкость каналов;
- включение session audio;
- тема или локальный theme override, если ГМ разрешил.

### World settings

Хранятся в файлах мира:

- название мира;
- дефолтная тема мира;
- доступные theme presets;
- правила canvas grid/snap по умолчанию;
- базовая роль для подключившихся игроков.

### Session settings

Живут в Yjs/session state:

- текущие участники;
- роли и временные права;
- кто может запускать audio/SFX;
- кто может редактировать canvas/entity/database.

## Роли

Минимум:

- `Base Player` - неснимаемая базовая роль для всех подключившихся. В ней контролируются базовые права любого игрока.
- `Player` - обычная игровая роль поверх базовой.
- `Trusted Player` - расширенные права на canvas/audio/свои сущности.
- `GM` - полный host/workbench контроль.

Правило: запрет в базовой роли нельзя случайно обойти пользовательской ролью без явного GM override.

## Темы

Тема должна строиться на токенах, а не на ручной замене классов:

- background;
- surface;
- surface elevated;
- border;
- text primary/secondary/muted;
- accent per entity type;
- danger/warning/success;
- shadow/glow strength;
- scrollbar style.

Пользовательские темы лучше хранить как JSON/YAML preset, который потом можно импортировать/экспортировать.

## Предлагаемые срезы

### Slice 1: Settings shell

- [x] Окно настроек с вкладками `Интерфейс`, `Аудио`, `Canvas`, GM-only `Мир`, `Роли`.
- [x] Permission-aware tabs: игрок видит только личные настройки.
- [x] `Аудио` использует существующие `useAudioSessionEnabled` и `useAudioChannelVolumes`.
- [x] `Canvas` использует существующие grid settings из `canvasDrawStore`.
- [ ] `Мир` пока read-only shell; world persistence будет отдельным срезом.
- [x] `Роли` показывает runtime role policy и эффективные права; редактируемая permission matrix будет отдельным срезом.

### Slice 2: Theme tokens

- [x] Вынести базовый app background/scrollbar/accent в CSS variable theme runtime.
- [x] Добавить 2-3 встроенных preset.
- [x] Подключить локальный выбор preset в `SettingsWindow` и хранить в `localStorage`.
- [x] Добавить local custom palette как данные: background gradient stops, text, accent и scrollbar tokens.
- [ ] Постепенно перевести `glass.*` и компонентные surface/text tokens на CSS variables.
- [ ] Добавить import/export custom theme и live preview без сохранения до `Применить`.

### Slice 3: Roles and rights

- [x] Описать role schema в `app/src/utils/permissions.ts`.
- [x] Добавить базовую неснимаемую роль `Base Player`.
- [x] UI для GM: read-only матрица эффективных прав по ролям в `SettingsWindow`.
- [ ] Добавить editable role matrix, world persistence и явный GM override для обхода базовых запретов.

## Acceptance criteria

- [x] Игрок не видит GM-only настройки.
- [ ] ГМ может менять тему мира без правки кода.
- [x] Локальный пользователь может собрать custom palette без правки кода.
- [x] Базовая роль применяется ко всем default player roles в runtime helper и не удаляется.
- [x] Настройки не ломают текущую доверенную privacy model.
- [x] Theme preset можно сохранить как данные, а не как CSS patch.
