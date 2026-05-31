# UI redesign master plan

> Дата: 2026-05-31
> Статус: decision draft для `FEAT-UI-002`
> Цель: перед дальнейшей крупной разработкой выбрать цельное направление интерфейса, систему тем, переводов и оформления сущностей.

## 1. Короткий вывод

Интерфейс Vibe TTRPG уже умеет многое, но сейчас ощущается как набор рабочих модулей, собранных поверх общего dark glass. Следующий крупный приоритет должен быть не "ещё одна фича", а дизайн-система, которая сделает приложение цельным инструментом ГМа и игрока.

Предлагаемый порядок:

1. Утвердить визуальное направление и плотность интерфейса.
2. Перевести тему в нормальные semantic tokens, а не набор случайных Tailwind-цветов.
3. Собрать Settings -> Interface как место выбора темы, плотности и языка.
4. Спроектировать i18n manager: переключение языка сейчас, редактирование/импорт переводов позже.
5. Пересобрать entity sheets как компактные, читаемые, игровые панели, а не таблицу Excel.
6. После этого полировать drawers, asset browser, audio dock, notifications и canvas toolbar в одном языке.

Статический preview-макет для обсуждения: `.pi/prototypes/ui-redesign-preview.html`.

## 2. Mini-PRD

### Для кого

- ГМ, который во время сессии быстро открывает сущности, музыку, заметки, карты, файлы и броски.
- Игрок, который должен понимать свой лист, инвентарь, статусы, активные эффекты и звук с минимальным шумом.
- Автор мира, который между сессиями работает с базой как с Obsidian-like хранилищем.

### Что должно измениться

- Интерфейс должен выглядеть как один продукт, а не как набор временных панелей.
- Сущности должны быть красивыми и плотными: больше чисел на экране, но без ощущения сухой бухгалтерской таблицы.
- Темы должны быть редактируемыми через данные.
- Перевод должен быть управляемым из UI, хотя полный редактор локалей можно делать отдельным срезом.
- Нужно иметь быстрый способ смотреть будущий интерфейс до внедрения в приложение.

### Что не должно измениться без отдельного решения

- Формат `.md` сущностей и YAML frontmatter.
- Local-first модель.
- Zustand как основной state layer.
- React + Tailwind + i18next.
- Ролевая модель доступа.
- Canvas coordinate system и z-index иерархия.

## 3. Главные проблемы текущего UI

### 3.1 Визуальная цельность

Сейчас части приложения используют похожий dark/glass язык, но разные модули имеют разный визуальный вес:

- RightDrawer и LeftDrawer уже ближе к единому header pattern.
- EntityWindow и entity blocks всё ещё выглядят как несколько исторических слоёв.
- SettingsWindow уже содержит foundation тем, но это не финальная дизайн-система.
- AssetBrowser, AudioDesk, NotificationCenter и CanvasToolbar не воспринимаются как один cockpit.

### 3.2 Плотность

В TTRPG интерфейсе плотность важнее декоративного воздуха. ГМу нужно видеть:

- HP, AC, ресурсы, статусы, инициативу, модификаторы;
- быстрые действия атаки/способности;
- заметки и wiki-links;
- инвентарь и экипировку;
- видимость/права/GM-only состояние.

Но если сделать просто таблицу, интерфейс станет сухим и тяжёлым. Нужен "компактный игровой лист": числа крупнее текста, группы читаются мгновенно, важные состояния имеют цвет/иконку/ритм.

### 3.3 Темы

Сейчас есть theme foundation, но финальный pass должен разделить:

- primitive tokens: raw palette, shadows, radii, opacity;
- semantic tokens: surface, panel, toolbar, danger, success, stat, inventory, note;
- component tokens: entity header, stat tile, drawer row, toolbar button;
- density tokens: compact, balanced, spacious.

Без этого custom themes быстро превратятся в ручное переписывание JSX.

### 3.4 Перевод

i18next уже есть, но приложение содержит много строк прямо в компонентах. Для смены языка и будущего пользовательского перевода нужен план:

- audit hardcoded UI strings;
- namespace model;
- fallback model;
- editor/import/export;
- storage location для custom locales.

### 3.5 Сущности

EntityWindow сейчас функционален, но будущий дизайн должен явно поддерживать разные типы:

- character: sheet, combat, resources, inventory, notes, canvas token defaults;
- object: свойства, атаки, экипировка, ценность, теги;
- ability: стоимость, дистанция, длительность, roll/action metadata;
- attack: hit/damage blocks, тип урона, формула, источник;
- note: readable markdown/wiki article;
- tag: эффект, статус, правила применения;
- canvas: карта/сцена, видимость, portals, defaults.

## 4. Визуальные направления на выбор

Это не финальные темы, а варианты характера.

### Вариант A: Arcane Control Desk

Тон: тёмный рабочий cockpit ГМа, металл, стекло, тонкие магические акценты.

Палитра:

- graphite / near-black surface;
- teal для активного состояния;
- amber/brass для важных GM controls;
- crimson для danger/status;
- muted parchment для заметок и wiki.

Плюсы:

- ближе всего к текущей dark/glass базе;
- хорошо подходит для VTT;
- легко сделать плотным и читаемым;
- не выглядит как generic SaaS.

Риски:

- можно снова уйти в слишком тёмный однотонный UI;
- нужно осторожно с glow, чтобы не получить декоративный шум.

### Вариант B: Cartographer Workbench

Тон: рабочий стол картографа, тёмная карта, светлые панели данных, чернила и цветные маркеры.

Палитра:

- dark map canvas;
- warm off-white panels для чтения markdown;
- ink blue/green для действий;
- red wax для danger;
- muted gold для GM-only.

Плюсы:

- заметки и сущности читаются легче;
- меньше усталость глаз при долгой подготовке мира;
- хороший мост между Obsidian и VTT.

Риски:

- светлые панели могут конфликтовать с canvas и fog of war;
- потребуется аккуратная dark/light mixed theme.

### Вариант C: Tactical Ledger

Тон: военный/тактический терминал без сухости Excel: компактные строки, яркие статусы, сильная иерархия.

Палитра:

- charcoal base;
- green/cyan telemetry;
- orange action accents;
- red damage/critical;
- blue system/info.

Плюсы:

- максимальная плотность;
- хорошо для боёв, статов, инвентаря;
- быстро сканируется.

Риски:

- можно сделать слишком утилитарно;
- хуже передаёт fantasy/roleplay атмосферу.

### Рекомендация для первого preview

Начать с гибрида A + C:

- базовый характер: Arcane Control Desk;
- структура и плотность: Tactical Ledger;
- для markdown/note участков добавить более спокойную reading surface, чтобы текст не тонул в glass.

## 5. Тема как данные

### 5.1 ThemePreset

```ts
interface ThemePreset {
  id: string;
  name: string;
  mode: 'dark' | 'light' | 'mixed';
  density: 'compact' | 'balanced' | 'spacious';
  palette: ThemePalette;
  typography: ThemeTypography;
  radii: ThemeRadii;
  effects: ThemeEffects;
}
```

### 5.2 Semantic tokens

```ts
interface ThemePalette {
  appBg: string;
  canvasBg: string;
  surfaceBase: string;
  surfaceRaised: string;
  surfaceInset: string;
  borderSubtle: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentPrimary: string;
  accentSecondary: string;
  danger: string;
  warning: string;
  success: string;
  info: string;
  gmOnly: string;
  noteSurface: string;
  statSurface: string;
}
```

### 5.3 Component tokens

Нужны не только цвета, а правила компонентов:

- `window.header.height`
- `drawer.width.compact`
- `entity.statTile.minWidth`
- `entity.block.headerHeight`
- `toolbar.button.size`
- `tabs.height`
- `input.height`
- `radius.card`
- `radius.tool`
- `shadow.panel`

### 5.4 Density modes

Compact:

- меньше vertical padding;
- stat tiles 48-56 px высотой;
- строки инвентаря 28-32 px;
- табы с иконкой и короткой подписью;
- toolbars icon-first.

Balanced:

- текущий default для большинства пользователей.

Spacious:

- для подготовки мира, чтения заметок, больших экранов.

## 6. Перевод и локализация

### 6.1 Первый срез

- Settings -> Interface -> Language: RU / EN.
- Все новые строки только через i18next.
- Добавить audit checklist для hardcoded строк.
- Не делать сразу тяжёлый editor, пока не утверждён формат custom locales.

### 6.2 Второй срез

- Namespace browser в Settings.
- Поиск ключей.
- Inline edit значения.
- Import/export JSON.
- Reset to default.

### 6.3 Storage варианты

Вариант A: custom locales в мире.

Путь: `world/locales/ru.custom.json`, `world/locales/en.custom.json`.

Плюсы:

- мир переносится со своими терминами;
- можно делать setting-specific vocabulary.

Минусы:

- игроки должны получать custom locales через host/server endpoint.

Вариант B: локально в приложении.

Путь: `localStorage` или пользовательская папка desktop runtime в будущем.

Плюсы:

- персональная настройка пользователя;
- не меняет мир.

Минусы:

- хуже переносимость.

Рекомендация:

- app default locales остаются в `app/src/locales`;
- world custom locales проектируются как future local-first layer;
- на первом срезе только переключение языка + hardcoded string cleanup.

## 7. Entity sheet redesign

### 7.1 Основной принцип

Окно сущности должно иметь два режима чтения:

- Play mode: плотный, красивый, быстрый, минимум debug.
- Edit/Full mode: больше сырых свойств, настройки, служебные поля.

### 7.2 Character

Первый экран:

- портрет/фишка;
- имя, роль, owner/visibility;
- HP/AC/initiative/speed;
- основные характеристики в 2x3 или 3x2 сетке;
- активные статусы;
- быстрые атаки/способности.

Ниже:

- Skills/Competencies как компактные списки с search/filter;
- Resources с маленькими треками;
- Inventory table с группировкой и equip toggle;
- Notes markdown.

### 7.3 Object

Первый экран:

- иконка/арт;
- тип/редкость/стоимость/вес;
- экипировано или нет;
- свойства и теги;
- вложенные атаки.

### 7.4 Ability

Первый экран:

- action type;
- cost/resource;
- range/target/duration;
- roll formula;
- save/DC;
- description.

### 7.5 Attack

Первый экран:

- hit formula;
- damage formula;
- damage type;
- range;
- linked weapon/source;
- buttons для броска.

### 7.6 Note

Нужен режим чтения:

- больше line-height;
- wiki-links заметны;
- callouts/rolls/tables читаются;
- markdown не выглядит как маленький debug block.

## 8. App shell и рабочие зоны

### 8.1 Canvas

Canvas должен оставаться главным полотном. UI не должен перекрывать:

- toolbar;
- notification center;
- audio dock;
- drawers;
- floating windows.

Нужен layout budget:

- top center: canvas toolbar;
- top right: notifications/settings/player status;
- bottom: audio dock;
- left/right: drawers;
- center: windows/canvas.

### 8.2 Drawers

LeftDrawer:

- player inventory;
- owner selector for GM;
- compact tree/table hybrid later.

RightDrawer:

- database;
- files;
- chat/rolls.

Общий паттерн:

- header с иконкой, названием и статусом;
- action strip;
- search/filter region;
- scroll body.

### 8.3 Settings

Settings становится центром:

- Interface: theme, density, language;
- Audio: local module, output behavior;
- Canvas: grid/fog/controls;
- World: host-only metadata;
- Roles: player roles/permissions;
- Localization: future editor.

## 9. Preview-макет

Задача preview:

- показать общий характер интерфейса;
- показать entity sheet compact density;
- показать Settings theme/language controls;
- показать drawers/canvas/audio как один cockpit;
- не быть финальной реализацией.

Файл: `.pi/prototypes/ui-redesign-preview.html`.

Правила preview:

- не подключать новые зависимости;
- не менять production app;
- использовать статический HTML/CSS;
- держать русский UI;
- показать минимум два состояния сущности: character и object/ability preview.

## 10. Implementation slices

### Slice 0: Decision gate

- [x] Добавить `FEAT-UI-002`.
- [x] Поднять UI redesign в `.pi/DEVELOPMENT_PLAN.md`.
- [x] Создать этот master plan.
- [x] Создать preview-макет.
- [ ] Получить ответы владельца на вопросы.

### Slice 1: Theme token foundation

- Пересобрать `utils/theme.ts` вокруг semantic tokens.
- Сохранить совместимость `glass.*`, чтобы не переписывать всё за раз.
- Добавить theme registry.
- Добавить density registry.
- Focused tests для theme normalization.

### Slice 2: Settings UI

- Interface tab: theme preset, density, language.
- Preview swatches.
- Persist local choice.
- Не делать world-level theme persistence без решения.

### Slice 3: i18n cleanup

- Вынести новые строки.
- Начать с shell/drawers/settings/entity windows.
- Добавить missing-key audit script или checklist.

### Slice 4: Entity kit

- Новый `EntityHeader`.
- Новый `EntitySection`.
- Новый `StatTile`.
- Новый `ResourceTrack`.
- Новый `ActionPill`.
- Сначала Character/Object/Ability/Attack, затем Note/Tag/Canvas.

### Slice 5: Workbench polish

- CanvasToolbar.
- AssetBrowser.
- AudioDesk/AudioControlDock.
- NotificationCenter.
- Context menus.

## 11. Acceptance criteria

- Интерфейс в default theme воспринимается как один продукт.
- В Settings можно сменить тему, плотность и язык.
- Новые темы не требуют массовой правки JSX.
- Entity sheet показывает больше полезных чисел на первом экране.
- Character sheet не выглядит как Excel-таблица.
- Object/Ability/Attack имеют собственные компактные игровые блоки.
- Markdown notes остаются комфортными для чтения.
- UI не перекрывает canvas toolbar, drawers, audio dock и notifications.
- Player client получает те же asset URLs через host IP.
- Русский остаётся основным языком, английский не ломается.

## 12. Риски

- Большой UI pass может расползтись. Поэтому сначала tokens и компоненты, потом экраны.
- Слишком декоративная тема ухудшит скорость игры. Поэтому preview должен проверяться на плотность.
- Слишком плотная тема станет Excel. Поэтому нужны визуальные группы, иконки и ритм.
- Полный i18n editor может стать отдельным проектом. Поэтому сначала language switch + key cleanup.
- Entity sheets могут затронуть rules/math UX. Поэтому roll/action buttons надо проектировать вместе с Roll Engine.
- Переписывание `theme.ts` может сломать много компонентов. Поэтому сохранить compatibility aliases.

## 13. Вопросы владельцу

1. Визуальный тон: ближе к `Arcane Control Desk`, `Cartographer Workbench`, `Tactical Ledger` или гибрид A+C?
2. Нужна ли светлая тема в первом настоящем срезе, или достаточно dark + mixed reading surfaces?
3. Плотность по умолчанию: compact или balanced?
4. Entity sheets: больше D&D-like карточка или более системно-agnostic лист с настройкой полей?
5. Нужно ли делать отдельный "combat view" для персонажа, или первый экран character sheet должен уже быть combat-ready?
6. Инвентарь: таблица с плотными строками или карточки-группы по категориям?
7. Notes: markdown должен быть ближе к Obsidian reading mode или к компактному игровому справочнику?
8. Темы: разрешать пользователю вручную менять все цвета сразу, или только выбирать preset + accent?
9. Custom themes должны храниться локально у пользователя или в мире?
10. Переводы: нужен ли пользовательский редактор переводов в MVP, или сначала достаточно переключения RU/EN и cleanup hardcoded строк?
11. Нужны ли world-specific термины перевода, например переименовать "способность" в "заклинание" для конкретного мира?
12. Насколько яркими могут быть type accents для character/object/ability/tag?
13. Нужен ли режим "низкая визуальная нагрузка" для слабых ПК или долгих сессий?
14. Окна сущностей должны иметь фиксированную сетку или адаптивный layout под ширину?
15. Важнее сейчас polish entity sheets или polish app shell/drawers?

## 14. Предлагаемое решение по умолчанию

Если владелец не выберет иначе, стартовый implementation после gate:

- направление: Arcane Control Desk + Tactical Ledger density;
- default density: balanced, но compact доступен в Settings;
- default theme: dark graphite + teal/amber/crimson accents;
- reading surface для notes: чуть теплее и спокойнее, но не полноценная светлая тема;
- Settings: theme preset, density, language;
- i18n: RU/EN switch и cleanup новых строк;
- entity sheets: Character first, затем Object/Ability/Attack.
