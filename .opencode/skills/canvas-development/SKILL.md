---
name: canvas-development
description: Excalidraw-подобный канвас на react-konva: рисование, фигуры, текст, изображения, фреймы, лассо, snap guides
---

## Файловая структура канваса
- `canvasTypes.ts` — типы DrawElement, хелперы (getChildrenOfFrame, reorderElements)
- `canvasDrawStore.ts` — Zustand: tool, style, selection, undo/redo, clipboard
- `CanvasToolbar.tsx` — тулбар + стиль-панель + объекты на канвасе + z-order
- `InfiniteCanvas.tsx` — рендеринг (sorted zIndex), objectNames, descriptions, inline editing

## Типы DrawElement
pen, line, rect, ellipse, text, image, frame

## Реализованные фичи
- Рисование: Pen (RDP-сглаживание), Line, Rect, Ellipse
- Наконечники линий: none/arrow/circle/diamond/square (start + end)
- Point handles для линий, resize handles для фигур
- Мульти-выбор: marquee, group bbox, выравнивание
- Undo/Redo: Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y, max 50
- Copy/Paste/Duplicate: Ctrl+C/V/D, сдвиг +20px
- Текст: textarea overlay, Konva Text, шрифты/размеры/выравнивание
- Изображения: I шорткат, drag-and-drop, автомасштаб 600px, placeholder
- Фреймы: F шорткат, inline ввод имени, drag за шапку, дети двигаются с фреймом
- Лассо: pointInPolygon ray-casting
- Z-order: панель слоёв, reorderElements()
- Smart Snap Guides: розовые линии, tolerance 5px
- Shift-snap: поворот 30°, drag-lock по оси
- Раздельная прозрачность: fillOpacity / strokeOpacity / textOpacity
- Названия объектов: centerX над фигурами, по центру линий
- Описания внутри фигур: word-wrap, двойной клик → textarea

## Шорткаты
H — horizontal line, V — vertical, P — pen, L — line, R — rect, O — ellipse
I — image, F — frame
Escape — deselect
Delete/Backspace — удалить
Ctrl+A — select all

## Отложено
- Точки прикрепления (attachment points)
- Привязка линий к объектам
- Встроенные web-страницы (iframe)
- Указка (мультиплеер)

## Verification
Тестируй визуально: cd app && npm run dev → Quick Local → проверяй каждую фичу отдельно
