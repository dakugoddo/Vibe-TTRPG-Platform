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

1. Продолжить compact character card: добавить roll/action buttons только через существующий Roll Engine facade.
2. Добавить entity-level defaults/настройки полей compact card только после короткого product gate, потому что это затронет UX сущностей и сохранение preference.
3. Custom world locales/editor продолжать только после отдельного формата и server endpoint design.

## Проверки

Минимум после code slice:

```bat
cd app
npm.cmd exec tsc -- --noEmit
npm.cmd run lint
npm.cmd run build
..\server\node_modules\.bin\tsx.cmd src\utils\characterCardSummary.test.ts
```

Если менялся `theme.ts`, дополнительно:

```bat
cd app
..\server\node_modules\.bin\tsx.cmd src\utils\theme.test.ts
```

Для UI желательно открыть локальное приложение в Browser/in-app browser и проверить Settings/AssetBrowser/AudioDesk. Если Browser недоступен или сервер не запущен, честно записать это в финале.

## Handoff note

Следующий агент должен продолжать UI foundation, а не возвращаться к аудио/roles/canvas крупным срезам, пока интерфейсный фундамент не станет устойчивым. Главный ближайший кодовый шаг - language switch/custom locales foundation в SettingsWindow без изменения файлового формата мира.
