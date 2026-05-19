# Sync Layers Contract

> Дата: 2026-05-18
> Статус: рабочий контракт после первого прохода по canvas sync.

## Цель

Синхронизация должна быть разделена по смыслу данных. Иначе live-движения мыши, canvas-геометрия, чат, fog of war и будущие боевые события начнут мешать друг другу и раздувать CRDT-документы.

## Persistent State

Данные, которые должны пережить перезапуск и попасть в файлы мира:

- `Entity` и все содержимое `.md` файлов;
- `schemaVersion`;
- canvas `drawElements`;
- canvas `fogReveals` как текущие patch-based области тумана;
- порталы, токены и закрепленные сущности через Entity parent/position model;
- игровые изменения, которые являются фактом мира: HP, инвентарь, статусы, ресурсы.

Текущий путь для сущностей:

```text
.md files -> Express API -> world Y.Doc -> fileSyncService -> .md files
```

Текущий путь для canvas:

```text
canvas entity properties -> canvas Y.Doc -> debounced canvas entity snapshot -> fileSyncService -> .md files
```

## Ephemeral State

Временное состояние, которое нужно только во время действия и не должно писаться в `.md`:

- preview рисования до commit;
- marquee/lasso selection;
- selected ids;
- drag snapshots;
- hover/focus;
- inline edit overlays;
- локальные настройки видимости вроде player fog preview toggle.

Сейчас большая часть этого уже находится в `canvasDrawStore` или локальных refs `InfiniteCanvas`. Следующий оптимизационный проход: вынести live drag preview из persistent Y.Map там, где это начнет давить на производительность.

## Awareness State

Данные присутствия, которые живут в Yjs awareness и не являются фактом мира:

- курсоры игроков;
- ping pulse;
- имя, цвет и роль участника;
- будущие "смотрю сюда", "измеряю дистанцию", "выбираю цель" preview-состояния.

`canvasSyncStore` уже держит cursor/ping в awareness. Эти данные не сериализуются в Entity и не пишутся в файлы.

## Правила Для Новых Фич

1. Если состояние должно сохраниться после перезапуска, оно должно попасть в Entity или другой явно описанный persistent файл.
2. Если состояние меняется на каждом mousemove, сначала считать его ephemeral.
3. Если состояние нужно другим игрокам только как присутствие или preview, использовать awareness/ephemeral transport, а не persistent Entity.
4. Любой бросок кубов идет через Roll Engine; результат броска может быть persistent только если он является частью истории/лога сессии.
5. Временные поля с префиксом `_` не должны попадать в canvas persistence.

## Известные Ограничения

- `root` canvas теперь создается как системная canvas entity с id/name `root`, но UI по-прежнему показывает его локализованным fake root-элементом и скрывает из обычного списка.
- External edit `.md` -> Entity -> уже открытый canvas Y.Doc поддержан для `drawElements` и `fogReveals`; этот путь нужно отдельно прогнать в ручном QA с Obsidian/VS Code.
- `fogReveals` сохраняет старое имя поля, но текущая модель хранит dark patches. Переименование лучше делать отдельной миграцией.
