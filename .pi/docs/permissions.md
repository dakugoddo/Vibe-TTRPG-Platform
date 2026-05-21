# Permissions Contract

> Дата: 2026-05-19

## Цель

Права доступа должны проверяться не только в UI. UI может скрыть кнопку, но финальная защита должна быть в store/API write path.

Решение владельца проекта от 2026-05-19: проект использует доверенную privacy модель. Для настольной игры достаточно, чтобы интерфейс скрывал GM-only и чужие user-данные от игроков. Это не считается криптографической или сетевой security boundary.

## Роли

- `gm` - может менять все базы.
- `player` - не может менять GM-базу.
- `spectator` - не может писать.

## Базы

- `general` - общая база мира. Сейчас игроку разрешена запись, потому что часть совместного gameplay flow завязана на общие сущности. Это правило можно ужесточить позже.
- `user` - пользовательская база. Игрок может менять сущности без владельца или с владельцем, совпадающим с его локальным id.
- `gm` - скрытая база мастера. Игроки и spectator не пишут.

## Текущий enforcement

Write path:

Store-level guard добавлен в:

- `addEntity`
- `updateEntity`
- `deleteEntity`
- `cloneEntity`

Даже если компонент ошибочно вызовет write-метод, store блокирует запись и пишет warning в console.

Чистая функция проверки находится в `app/src/utils/permissions.ts` и покрыта focused test. Сейчас owner marker может совпадать либо с локальным player id, либо с отображаемым именем игрока: это нужно для совместимости с текущими `users/<playerName>/` папками.

View path:

- `canViewEntity` находится в `app/src/utils/permissions.ts`;
- `EntityDatabase` использует `canViewEntity` перед показом сущности в UI;
- игроки не видят `gm` базу;
- игроки видят свою `user` базу по `_playerOwner`, local player id или local player name;
- legacy user-сущности без `_playerOwner` видны текущему владельцу локального inventory, чтобы старые данные не пропали из интерфейса;
- ГМ видит все базы и может переключать user inventory через селектор игроков.

UI action gating:

- кнопки создания сущностей и папок показываются только когда текущая роль может писать в целевую базу;
- импорт `.md` доступен только host-клиенту с правом записи в целевую базу;
- контекстное меню оставляет `Открыть окно`, `Копировать [[ссылку]]` и `Экспорт .md` для read-only сущностей, но скрывает `Переименовать`, `Дублировать`, `Удалить` и `Выдать игроку`;
- быстрый hover-delete скрывается для read-only сущностей и системного root canvas;
- drag/drop в `EntityDatabase` сначала проверяет право записи в целевую базу и право менять переносимую сущность;
- `CompetenciesBlock` скрывает `Добавить`, кнопки изменения ранга и удаление для read-only сущностей; бросок кубов и открытие окна остаются доступными как безопасные действия;
- `AbilitiesBlock` скрывает создание, редактирование полей и удаление ability-сущностей без прав, но оставляет чтение, открытие окна и бросок уже заданной формулы через Roll Engine;
- `ObjectSheet` и `AttackSheet` проверяют `yjsStore.canModify(...)` перед записью и переводят edit-controls в read-only: свойства не меняются, tag edit скрыт, а создание/перетаскивание/удаление атак доступно только при праве редактирования;
- `EntityWindow`, `CharacterSheet` notes и `EntityImageBlock` скрывают rename/delete, description/notes edit, hidden tag edit и image edit для read-only сущностей.
- `SkillsBlock` скрывает изменение ранга навыков для read-only персонажа, но не блокирует броски навыков.
- `ResourcesBlock` скрывает создание, изменение и удаление счетчиков ресурсов для read-only персонажа, сохраняя просмотр текущих значений.
- `InventoryBlock` скрывает equip toggle, quantity input, delete и drag/drop для read-only персонажа или read-only предмета; при move/copy в owned user inventory owner marker применяется к предмету и его дочерним сущностям.
- `AttributeBlock` проверяет `yjsStore.canModify(...)` перед изменением статов, ран, active powers и статусов; при read-only состоянии UI не отправляет системные логи ран/статусов.
- Legacy blocks `PropertiesBlock` и `StatusBlock` скрывают tag edit/drop для read-only сущностей на случай будущего повторного подключения.
- Canvas editing проходит через тот же контракт: `canvasSyncStore` блокирует draw/fog mutations, undo/redo, full-array sync и mirror writeback без права менять текущую canvas entity; read-only canvas скрывает drawing/fog/style controls и оставляет безопасный select/navigation UI; `CanvasToolbar` применяет style/z-order через guarded `syncElementsArray`; `InfiniteCanvas` не дает перетаскивать токены/порталы или удалять портал без права редактировать соответствующую сущность.

Focused test: `app/src/utils/permissions.test.ts` проверяет write и view boundaries.

## Owner marker

Текущий owner marker берется из:

```ts
entity.properties._playerOwner
```

Это временный совместимый маркер, потому что user-базы уже подмешивают `_playerOwner` при загрузке. File sync использует этот marker, чтобы сохранять user-сущности в папку конкретного игрока, а не всегда в папку хоста. Позже лучше вынести владельца в отдельное top-level поле Entity или metadata, чтобы не смешивать системные права с игровыми `properties`.

## Выдача Предметов

Команда "Выдать игроку" в базе сущностей создает копию сущности в `user` базе выбранного игрока и проставляет `_playerOwner`. Исходная сущность в `general` базе остается на месте как мастер-шаблон. Дочерние сущности копии получают тот же owner marker.

## Важно для будущих задач

1. Новые UI-кнопки должны спрашивать `yjsStore.canModify(...)`, но не полагаться только на это.
2. Новые write paths должны проходить через `yjsStore.addEntity/updateEntity/deleteEntity/cloneEntity`.
3. Новые UI-списки сущностей должны использовать `canViewEntity` или компонент/селектор, который уже его применяет.
4. Прямой `entitiesMap.set/delete` допустим только для системной загрузки, file sync и миграций.
5. Прямой `elementsMap.set/delete` или `fogMap.set/delete` в UI недопустим; используй методы `canvasSyncStore`, чтобы не обходить canvas permission guard.
6. Перед ужесточением записи в `general` нужно отдельно обсудить игровой flow.
7. Если когда-нибудь понадобится настоящая приватность от технически любопытного клиента, придется разделять sync rooms/docs, а не только UI.
