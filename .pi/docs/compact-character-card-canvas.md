# Compact character card on canvas

> Дата: 2026-06-02
> Статус: первый безопасный срез для `FEAT-UI-002` / `FEAT-CANVAS-TOKENS-001`

## Цель

Дать GM/player быстрый боевой и навигационный взгляд на персонажа прямо с canvas, не открывая полный чарник и не создавая отдельный "боевой режим" окна.

## Решения владельца

- Отдельный боевой режим чарника не нужен.
- Нужна компактная карточка персонажа на canvas с быстрыми статами и будущими вкладками: статы, способности, атаки, ресурсы.
- Карточка должна быть плотной и читаемой, но не превращаться в сухую таблицу.

## Первый срез

Первый срез не меняет формат `DrawElement` и не добавляет новый `EntityTokenMode`. Он улучшает существующий linked token/card контур:

- `app/src/utils/characterCardSummary.ts` строит compact summary из `character` entity и списка сущностей.
- Summary читает legacy `stats`, `attributes`, `attributes.wounds`, `resources`, inventory objects, direct/nested attacks и abilities.
- Кнопка `i` у `entityToken` показывает для персонажа:
  - 4 быстрых метрики;
  - wounds/resources bars;
  - счётчики атак, способностей и вещей;
  - краткое описание;
  - кнопку открытия полной сущности.
- `Фишка` и `Карточка` используют один DOM compact overlay, чтобы будущие tabs не дублировались в Konva и HTML.
- Сохранённые canvas данные остаются совместимыми: это только presentation layer.

## Будущие срезы

- Добавить compact tabs внутри canvas card: `Stats`, `Actions`, `Resources`, `Notes`.
- Добавить tabbed content внутри единого DOM overlay: `Stats`, `Actions`, `Resources`, `Notes`.
- Позволить entity-level defaults выбирать, какие поля показывать на compact card.
- Подключить roll/action buttons через существующий Roll Engine facade.
- Проверить permissions: player не должен видеть GM/private fields через compact card.

## QA

- Перетащить персонажа на canvas как `Фишка`.
- Нажать `i`: summary должен появиться рядом с token и не выходить за экран.
- У персонажа без ресурсов/атак overlay остаётся аккуратным и показывает описание.
- У скрытой/private entity overlay не раскрывает данные.
- Double-click/open button продолжает открывать исходную entity.
