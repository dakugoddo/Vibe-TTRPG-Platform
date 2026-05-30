# Canvas Excalidraw-grade upgrade

> Дата: 2026-05-22  
> Статус: design draft для `FEAT-CANVAS-EXCALIDRAW-001`.

## Цель

Canvas должен остаться быстрым VTT-слоем, но получить выразительность и удобство визуальной доски: линии связывают заметки и сущности, объекты примагничиваются предсказуемо, а стили могут быть как чистыми, так и живыми/рукописными.

## Что обсудить с владельцем

- Насколько рукописный стиль нужен по умолчанию: `clean`, `soft rough`, `handdrawn`.
- Должны ли линии физически привязываться к объектам и двигаться вместе с ними всегда, или только когда включён режим binding.
- Какие connector modes нужны первыми: straight polyline, free curve, elbow/orthogonal.
- Как grid snap должен сочетаться с object snap и будущими токенами на боевой сетке.
- Нужны ли разные наборы стрелок/капсов для схем, карт и боевых сцен.

## Предлагаемые срезы

### Slice 1: Snap foundation

- Добавить режим grid snap и object snap radius.
- Считать anchor points для rectangle/ellipse/image/frame: center, sides, corners.
- Показывать snap preview без записи в Yjs до завершения drag/draw.

2026-05-22 partial:

- В проекте уже был grid UI и snap при drag draw elements.
- Добавлен grid snap для создания line/rectangle/ellipse/frame/text/image и для direct image drop.
- `Shift` временно обходит snap при создании/дропе, как уже было принято для drag snap.
- Object/edge anchor binding остаётся отдельным следующим срезом.

2026-05-23 partial:

- Добавлен `canvasAnchors` foundation: anchor points для `rectangle`, `ellipse`, `image`, `frame`, `text`.
- Anchors: center, sides and corners.
- Line tool endpoints и ручное перетаскивание точек line/arrow магнитятся к ближайшему anchor в screen-stable radius.
- Показывается локальная cyan snap preview; она не пишется в Yjs и исчезает после завершения drag/draw.
- `Shift` временно отключает object/grid snap для line endpoint.
- Добавлен optional binding contract: `startBinding?: { elementId, anchor }`, `endBinding?: { elementId, anchor }`.
- Если endpoint line/arrow snapped к anchor, связь сохраняется в draw element.
- При перемещении bound object endpoints связанных линий пересчитываются в локальном preview и в финальном сохранении.
- Старые линии без binding продолжают работать как раньше.

2026-05-23 visual style partial:

- Добавлен `DrawElement.visualStyle?: 'clean' | 'soft' | 'sketch'` и default `clean`.
- `CanvasToolbar` получил compact preset control `Ровно/Мягко/Скетч` в панели stroke styles.
- `clean` сохраняет текущую чистую геометрию.
- `soft` добавляет лёгкую translucent halo-обводку для читаемости на тёмных картах.
- `sketch` добавляет deterministic jitter-дубль обводки для line/rectangle/ellipse/image/frame без случайного мерцания и без новой зависимости.
- Старые draw elements без `visualStyle` рендерятся как `clean`.

2026-05-23 line mode partial:

- Добавлен `DrawElement.lineMode?: 'straight' | 'curved' | 'elbow'` и default `straight`.
- `CanvasToolbar` получил line mode control `Прямая/Кривая/Угол` для line/pen tools и выбранных line/arrow objects.
- `straight` рендерит точную polyline без сглаживания.
- `curved` сохраняет текущий smooth/tension контур для свободных линий и pen.
- `elbow` строит ортогональный маршрут через midpoint каждого сегмента; данные endpoints остаются прежними, поэтому binding/undo/redo не меняют контракт.
- Старые draw elements без `lineMode` получают migration-safe fallback: 2 точки = `straight`, 3+ точки = `curved`.
- Line point insert/delete теперь идёт через tested helpers: double-click по сегменту вставляет point, double-click рядом с внутренней point удаляет её, endpoints не удаляются.

### Slice 2: Line binding contract

- Расширить `DrawElement` для line/arrow:
  - `startBinding?: { elementId: string; anchor: string }`
  - `endBinding?: { elementId: string; anchor: string }`
- При перемещении bound object пересчитывать крайние точки линии.
- Undo/redo должен видеть binding как часть draw element state.

### Slice 3: Connector routing

- Straight: текущая polyline модель.
- Free curve: сглаженные точки, но с редактируемыми handles.
- Elbow: ортогональный маршрут для графов/схем.

### Slice 4: Visual style presets

- Не вводить новый canvas engine.
- Для rough/handdrawn сначала проверить lightweight rendering через Konva custom `Shape`/cached path, а не добавлять тяжёлую зависимость.
- Стили должны быть данными элемента, а не глобальным CSS.

## Риски

- Binding меняет формат draw elements, поэтому нужен migration-safe default.
- Snap preview нельзя писать в persistent Yjs на каждом mousemove.
- Handdrawn rendering может быть дорогим на больших сценах; сначала профилировать на 100-300 объектах.

## Acceptance criteria

- [x] Линия может привязаться к краю/центру объекта и сохраняет связь после перемещения объекта.
- [x] Можно включить/выключить grid snap для drag и создания базовых draw elements.
- [x] Object snap имеет понятную визуальную подсказку.
- [x] Есть минимум два режима линии: straight/polyline и free/curved.
- [x] Есть минимум два visual style preset: clean и handdrawn/rough.
- [ ] Multiplayer пишет только итоговые состояния, а не каждый preview mousemove.
