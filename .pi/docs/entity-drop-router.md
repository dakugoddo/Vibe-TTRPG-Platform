# Entity Drag/Drop Router

> Дата: 2026-05-24  
> Статус: core routing + shared tree mutations + unified action menu implemented для `FEAT-ENTITY-DROP-001`, manual QA pending  
> Цель: заменить разрозненные drop-paths единым контрактом, чтобы canvas, окна сущностей, инвентари и будущие массовые операции не спорили друг с другом.

## Проблема

Сейчас у проекта уже есть несколько сценариев drag/drop:

- сущность из базы на canvas как связанная `Фишка` или `Карточка`;
- старый popover `Перенести/Копировать` для операций между базами;
- drop предметов в инвентарь персонажа;
- срочный guard, который не даёт canvas перехватывать drop поверх окна сущности.

Этого хватает для MVP, но не хватает для безопасного развития: один и тот же drag может попасть в canvas-route, в entity-window-route или в inventory-route. Нужен один resolver, который сначала определяет target, потом доступные actions, потом исполняет выбранное действие.

## Термины

- `source entity` - сущность, которую тащат.
- `target` - место, куда попал drop: canvas, entity window, database folder, asset browser или пустая область.
- `placement` - визуальное размещение на canvas без изменения `.md` сущности: `Фишка` или `Карточка`.
- `copy` - создание копии `.md` сущности в целевом контейнере.
- `move` - перенос `.md` сущности с изменением parent/database/path. Доступен только GM.

## Контракт target resolver

Порядок определения target:

1. Если pointer находится над element с `data-entity-drop-target`, target берётся из ближайшего такого контейнера.
2. Если pointer находится над любым не-canvas UI слоем, canvas-route не запускается.
3. Если pointer находится над canvas stage, target = `canvas`.
4. Если target не найден, drop игнорируется.

Предлагаемая структура:

```ts
type EntityDropTarget =
  | { kind: 'canvas'; canvasId: string; point: { x: number; y: number } }
  | { kind: 'entity'; entityId: string; slot: EntityStorageSlot }
  | { kind: 'database'; database: DatabaseType; parentId: string | null };

type EntityDropAction =
  | 'place-token'
  | 'place-card'
  | 'copy-entity'
  | 'move-entity';
```

## Начальная матрица совместимости

| Target | Source type | Actions |
|--------|-------------|---------|
| Canvas | any visible entity | `Фишка`, `Карточка`, `Копировать`, `Переместить` |
| Character inventory | `object` | `Копировать`, `Переместить` |
| Character abilities | `ability` | `Копировать`, `Переместить` |
| Character competencies | `competency` | `Копировать`, `Переместить` |
| Character | `attack` | запрещено напрямую |
| Object attacks | `attack` | `Копировать`, `Переместить` |
| Folder/database branch | valid entity type | `Копировать`, `Переместить` |

Правила:

- `Переместить` показывается только GM и только если source можно менять.
- Player может копировать/перемещать только внутри разрешённой user-базы и только по permission helper.
- Drop на canvas как `Фишка/Карточка` не меняет `parentId`, `database` и path сущности.
- Drop на canvas как `Копировать/Переместить` создаёт/переносит `.md` сущность в storage текущего canvas. Это фактически публичное размещение в мире и должно позже подключиться к permission model.
- Если target не поддерживает source type, popover не открывается; UI показывает короткое disabled-state объяснение.

## UI

Единый popover `DragDropPopover` заменяет старые параллельные copy/move ветки и рендерится через portal поверх UI.

Canvas menu:

- `Фишка`
- `Карточка`
- `Копировать`
- `Переместить` для GM

Entity-window menu:

- `Копировать в <слот>`
- `Переместить в <слот>` для GM

Меню рендерится через `createPortal` и использует z-index popup слоя. Никаких `window.confirm`.

## Исполнение actions

`place-token` / `place-card`:

- создаёт `DrawElement type='entityToken'`;
- `linkedEntityId = source.id`;
- берёт defaults из `properties.canvasToken`;
- сохраняет canvas state через `canvasSyncStore`.

`copy-entity`:

- использует существующий `cloneEntity`;
- назначает target parent/database;
- сохраняет новый ID и path;
- для canvas storage выставляет публичный режим по умолчанию после появления permission contract.

`move-entity`:

- использует серверный/сторовый rename/move контур;
- недоступен без GM role;
- должен быть атомарным для `.md` файла и одноимённой папки children.

## План реализации

1. [x] Добавить pure helper `getEntityDropActions(source, target, context)` и `resolveEntityStorageSlot(sourceType, target)`.
2. [x] Пометить основные слоты data-атрибутами: `data-entity-drop-target`, `data-entity-id`, `data-entity-slot`, `data-entity-accepts`.
3. [x] Подключить старое меню `Перенести/Копировать` к единому action contract для database tree.
4. [x] Перевести canvas drop на тот же action contract, сохранив текущие `Фишка/Карточка`.
5. [x] Добавить focused tests для matrix helper.
6. После этого строить bulk operations поверх той же матрицы.

## Реализация

- `app/src/utils/entityDropRouter.ts` - pure contract helper без UI-зависимостей.
- `app/src/utils/entityDropRouter.test.ts` - focused test для canvas actions, player/gm copy/move, запрета `attack -> character` и self-drop.
- Drop target data-атрибуты внесены в `InventoryBlock`, `AbilitiesBlock`, `CompetenciesBlock`, `ObjectSheet` и `StatusBlock`.
- `DragDropPopover` рендерится через `createPortal`, закрывается кликом вне меню и показывает единый copy/move action menu с иконками и permission-aware списком действий.
- `InventoryBlock` уже использует `entityDropRouter` для внешних `object` drops: copy доступен при праве писать в target, move скрыт без GM/source права.
- `ObjectSheet` использует `entityDropRouter` для внешних `attack` drops: copy доступен при праве писать в предмет, move скрыт без GM/source права.
- `AbilitiesBlock` и `CompetenciesBlock` используют `entityDropRouter` для внешних `ability`/`competency` drops: copy доступен при праве писать в персонажа, move скрыт без GM/source права, owner marker применяется к clone/move tree.
- `StatusBlock` использует `entityDropRouter` для `tag` drops как action `Добавить тег`: это ссылка на tag entity, без перемещения самого tag-файла.
- `InfiniteCanvas` использует `entityDropRouter` для drop сущности на canvas: `Фишка` и `Карточка` создают linked representation без изменения `.md`, `Копировать на канвас` клонирует entity tree в storage активного canvas, `Переместить на канвас` доступно только GM и переносит entity tree в database активного canvas.
- `EntityDatabase` root/folder/entity row drops используют `entityDropRouter`: action menu показывает только разрешённые `copy/move`, `move` скрыт без GM/source права, `attack -> character` отсекается общей матрицей, а перенос tree обновляет database у дочерних сущностей.
- `app/src/utils/entityTreeMutations.ts` содержит общий helper для owner propagation и move tree; теперь через него проходят canvas copy/move, database root/folder drops, inventory drops, object attack drops, ability/competency drops и выдача сущности игроку.

## Открытые решения

- Считать ли `Копировать/Переместить на canvas` всегда публичным доступом для всех игроков, или спрашивать режим видимости при действии.
- Должен ли character принимать `tag`/status через drop, или статусы лучше добавлять только через статусный блок.
- Нужно ли разрешать ability/competency в object, если игровая система позже потребует “модули предметов”.
