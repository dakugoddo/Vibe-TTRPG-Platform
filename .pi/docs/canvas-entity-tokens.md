# Canvas entity tokens and cards

> Дата: 2026-05-24  
> Статус: MVP foundation для `FEAT-CANVAS-TOKENS-001`.

## Цель

Перетаскивание сущности из базы на canvas не должно перемещать `.md` файл, менять `parentId`, копировать сущность или вкладывать её в canvas. На canvas должна появляться только визуальная репрезентация, которая ссылается на исходную сущность по canonical ID.

## Текущий контракт

Canvas representation хранится в `DrawElement` внутри `canvas.properties.drawElements`:

```ts
{
  type: 'entityToken',
  linkedEntityId: string,
  entityTokenMode: 'token' | 'art', // UI label: Фишка / Карточка
  entityTokenFrame?: 'plain' | 'ring' | 'badge' | 'hex',
  x: number,
  y: number,
  width: number,
  height: number
}
```

Правила:

- `linkedEntityId` указывает на существующую entity ID.
- Исходная entity остаётся в своей базе и папке.
- Double-click по representation открывает исходную entity, если у пользователя есть доступ.
- Кнопка `i` на token representation открывает permission-aware info popover с именем, типом и коротким plain-text описанием.
- Для `character` token info popover дополнительно показывает compact sheet summary: вкладки `Статы`, `Действия`, `Ресурсы`, `Заметки`, быстрые метрики, wounds/resources bars, действия с формулами, первые вещи инвентаря и счётчики атак/способностей/вещей. Summary строится через `app/src/utils/characterCardSummary.ts` и не меняет сохранённый `DrawElement`.
- Кнопка `i` на карточке использует тот же semantic DOM compact overlay, что и фишка; старый inline Konva overlay считается временным legacy-путём и не должен расширяться новыми вкладками.
- Info popover для token показывает миниатюру representation image с fallback на первую букву и до 3 тегов сущности; недоступные entity по-прежнему не раскрывают приватные данные.
- Если entity скрыта для пользователя, UI показывает безопасный placeholder без имени и изображения.
- Drag/resize работают как у draw elements и сохраняются в canvas state.
- Карточка вставляется с aspect ratio исходного изображения, рендерится без растяжения и при resize сохраняет пропорции.
- Drop сущности на canvas открывает выбор `Фишка` или `Карточка`; оба варианта создают только linked representation.
- Выбранный `entityToken` можно переключить между `Фишка` и `Карточка` в canvas style panel.
- Выбранный `entityToken` можно переключить между frame presets `Простая`, `Кольцо`, `Плашка`, `Гекс`; цвет, толщина, стиль и прозрачность рамки берутся из обычных stroke-полей, поэтому общий выбор обводки работает и для фишек/карточек.
- Для `entityToken` используется общее поле `showName`: toggle видимости имени в style panel скрывает подпись фишки или нижнюю плашку карточки, не скрывая `i`-кнопку и double-click open.
- Entity-level defaults хранятся в `entity.properties.canvasToken`: `mode`, `frame`, `showName`, `stroke`, `tokenImage`, `artImage`, размеры token/card. Окно сущности показывает отдельную вкладку `Настройки` с редактированием режима, рамки, подписи, цвета рамки, отдельных image sources для фишки/карточки и размера текущего режима; drop сущности на canvas применяет эти defaults к выбранному варианту.
- Entity-level defaults для состава compact character card хранятся отдельно в `entity.properties.compactCard`: выбранные статы, ресурсы, действия, вещи и режим заметок. Это информационная настройка, не визуальная настройка `canvasToken`.
- Если `tokenImage` или `artImage` пустые, representation использует основное `entity.icon_url`; если сущность скрыта по правам, изображение не раскрывается.
- Right-click по `entityToken` открывает compact context menu: открыть исходную сущность, переключить `Фишка/Карточка` с применением entity-level размеров, показать/скрыть имя и применить frame preset. Если выделено несколько `entityToken`, frame preset применяется ко всем выбранным linked tokens. Edit actions доступны только при праве редактировать текущий canvas.
- Внутреннее значение режима пока остаётся `art` ради совместимости сохранённых canvas data; в UI и документации пользователя этот режим называется `Карточка`.

## Что ещё нужно

- Контекстное меню representation: дополнительные быстрые actions для нескольких selected tokens, если они понадобятся после ручного QA.
- Entity settings: пользовательские frame assets из asset library.
- Расширенный hover card: markdown preview, избранные stats, действия GM/player.
- Пользовательские рамки из asset library и сохранённые entity-level defaults для token/card.
- Мультивыбор и массовая смена representation mode.

## QA

См. `.pi/docs/testing-multiplayer.md`, шаги canvas QA по linked entity token/card.
