# 🎨 Canvas Best Practices

> Как работать с Infinite Canvas (react-konva). Что можно, что нельзя.

---

## 1. АРХИТЕКТУРА КАНВАСА

### Структура Stage (InfiniteCanvas.tsx)
```
Konva Stage (z:0, бесконечный, draggable)
├── BackgroundLayer      # Фон, сетка (квадраты/гексы)
├── DrawingLayer         # Рисование (Line, Rect, Ellipse, Text, Image)
├── FogOfWarLayer        # Туман войны (world-space оффскрин-текстура)
├── PortalLayer          # Интерактивные порталы
└── CursorLayer          # Курсоры других игроков + пинги
```

Закреплённые окна (z:10) — НЕ внутри Stage, рендерятся отдельным слоем над Stage с transform-синхронизацией.

### Сторы канваса (3 штуки)
| Стор | Файл | За что отвечает |
|------|------|----------------|
| `useCanvasStore` | `canvasStore.ts` | Навигация: activeCanvasId, history, scale, offset |
| `useCanvasDrawStore` | `canvasDrawStore.ts` | Инструменты, стили, выделение, undo/redo (local) |
| `useCanvasSyncStore` | `canvasSyncStore.ts` | Yjs-синхронизация элементов, fog, awareness |

---

## 2. КЛЮЧЕВЫЕ ПРИНЦИПЫ

### 2.1 Не трогай stage scale/offset без понимания
```typescript
// Stage transform — СВЯЩЕННЫЕ поля
stageRef.current.scaleX()   // ≈ scale
stageRef.current.scaleY()   // ≈ scale
stageRef.current.x()        // offset.x
stageRef.current.y()        // offset.y

// Менять через:
stageRef.current.scale({ x: newScale, y: newScale });
stageRef.current.position({ x: newX, y: newY });
stageRef.current.batchDraw();
```

### 2.2 Всегда используй throttling для drag/move
```typescript
// Уже реализовано:
const throttledSetTransform = useMemo(
  () => throttle((x: number, y: number, scale: number) => {
    stageRef.current?.position({ x, y });
    stageRef.current?.scale({ x: scale, y: scale });
    stageRef.current?.batchDraw();
    // Обновить zustand для pinned окон
  }, 33), // ~30fps
  []
);
```

### 2.3 Координаты: world vs screen
```typescript
// Screen → World (для новых объектов, кликов)
const worldX = (screenX - stageOffset.x) / stageScale;
const worldY = (screenY - stageOffset.y) / stageScale;

// World → Screen (для tooltip, попапов)
const screenX = worldX * stageScale + stageOffset.x;
const screenY = worldY * stageScale + stageOffset.y;

// PIN окна (screen → canvas)
newX = (screenX - stageOffset.x) / stageScale;
newY = (screenY - stageOffset.y) / stageScale;

// UNPIN окна (canvas → screen)
newX = worldX * stageScale + stageOffset.x; // clamp to viewport
newY = worldY * stageScale + stageOffset.y;
```

---

## 3. ИНСТРУМЕНТЫ РИСОВАНИЯ

### activeTool (9 тулов)
```
hand    — панорамирование (дефолт)
select  — выделение/drag/rotate существующих элементов
pen     — свободное рисование (Line с tension)
line    — прямая линия
rect    — прямоугольник
ellipse — эллипс
frame   — фрейм (группировка)
text    — текст (клик = курсор, печать = набор)
image   — вставка изображения
```

### currentStyle
```typescript
{
  stroke: string;        // hex
  strokeWidth: number;   // px
  strokeStyle: number[]; // dash pattern
  fill: string;          // hex
  opacity: number;       // 0-1
  fillOpacity: number;
  strokeOpacity: number;
  startCap, endCap: 'butt' | 'round' | 'square';
  fontSize: number;
  fontFamily: string;
  textAlign: 'left' | 'center' | 'right';
  textColor: string;
  textOpacity: number;
}
```

---

## 4. ПРОИЗВОДИТЕЛЬНОСТЬ

### ❌ ЗАПРЕЩЕНО
```typescript
// ❌ НЕ создавай объекты в рендере (новые reference каждый кадр!)
<Rect fill={`rgba(0,0,0,${opacity})`} /> // СТРОКА КАЖДЫЙ РЕНДЕР

// ❌ НЕ используй фильтры без нужды (blur, shadow — дорого!)
<Rect shadowBlur={10} /> // ПЕРЕРИСОВЫВАЕТ ТЕКСТУРУ НА КАЖДЫЙ КАДР

// ❌ НЕ рисуй >1000 элементов без виртуализации
// ❌ НЕ подписывайся на частые события без троттлинга
// ❌ НЕ делай batchDraw() внутри цикла
// ❌ НЕ игнорируй offscreen элементы — cull их
```

### ✅ РАЗРЕШЕНО
```typescript
// ✅ Мемоизируй fills и стили
const layerConfig = useMemo(() => ({
  fill: `rgba(0,0,0,${opacity})`,
}), [opacity]);

// ✅ Cull элементы вне viewport
const isVisible = useCallback((elem: DrawElement) => {
  const bounds = getElementBounds(elem);
  return rectsIntersect(bounds, viewportBounds);
}, [viewportBounds]);

// ✅ Throttle на drag/move/zoom
// ✅ Offscreen-канвас для Fog of War (текстура)
// ✅ Минимизируй количество Layers (каждый = дорогой canvas)
```

### Fog of War текстура:
```typescript
// World-space оффскрин-канвас 2048×2048
// Центр привязан к viewport с шагом 400 world-units
// Регенерируется только при изменении reveals или сдвиге > 400
// Konva Image позиционируется в МИРОВЫХ координатах
```

---

## 5. МУЛЬТИПЛЕЕР КАНВАСА

### Yjs документ (каждый канвас — отдельный)
```typescript
// canvasSyncStore.ts
const doc = new Y.Doc();
const elementsMap = doc.getMap('elements'); // DrawElement[]
const fogMap = doc.getMap('fogReveals');    // FogReveal[]
const undoManager = new Y.UndoManager(elementsMap);

// Комната: ws://host:3001/ws/canvas/<canvasId>
```

### Awareness (курсоры, пинг)
```typescript
// Локальное состояние (отправляем)
awareness.setLocalStateField('cursor', { x, y });

// Состояния других игроков (получаем)
awareness.on('change', () => {
  const states = awareness.getStates(); // Map<clientId, { name, role, color, cursor, ping }>
});
```

### Flow:
1. `joinCanvas(canvasId)` → создать Y.Doc → подключить y-websocket
2. Изменения → Yjs (все клиенты) → debounce 2s → файлы (хост)
3. `leaveCanvas()` → отключить, очистить
4. Переключение канваса = `leaveCanvas(old)` → `joinCanvas(new)`

---

## 6. FOG OF WAR

### Модель данных
```typescript
interface FogReveal {
  id: string;
  type: 'circle' | 'rect';
  x: number;       // world coords
  y: number;
  // circle
  radius?: number;
  // rect
  width?: number;
  height?: number;
}

// Дефолт = полный туман (fogMap пуст)
// addFogReveal() — добавляет просвет
// removeIntersectingReveals() — удаляет просветы (cover)
// clearAllFog() — полный туман
// revealAll() — всё видно (огромный reveal ±10000)
```

### Рендер
```typescript
// FogOfWarLayer — отдельный Konva Layer
// Оффскрин-канвас 2048×2048, тёмный с «дырками» просветов
// Позиция: worldArea.left, worldArea.top (в мировых координатах)
// GM toggle: gmFogVisible (ГМ видит туман опционально)
// Player: playerFogVisible (игроки видят всегда)
```

---

## 7. SNAP-TO-GRID

```typescript
// canvasDrawStore.ts
{
  gridEnabled: boolean;    // default false
  gridType: 'square' | 'hex';
  gridSpacing: number;     // default 50
}

// Snap в handleSelectDragMove:
// Квадраты: примагничиваем top-left угол к ближайшему grid-пересечению
// Гексы: примагничиваем центр к ближайшему hex-центру
// Threshold: 8px world coords (ближе = snap, дальше = free)
```

---

## 8. PORTALS (ПОРТАЛЫ)

```typescript
interface PortalEntity extends Entity {
  type: 'portal';
  properties: {
    canvasId: string;    // целевой канвас
    targetX: number;     // куда телепортировать камеру
    targetY: number;
    targetZoom?: number; // опционально
  };
}

// Рендер: PortalLayer (интерактивные, кликабельные)
// Двойной клик → navigate(canvasId) + setPosition(x, y, zoom)
```

---

## 9. ДОБАВЛЕНИЕ НОВОГО ИНСТРУМЕНТА

1. Добавь тул в `canvasDrawStore.activeTool` union type
2. Добавь хендлеры в `InfiniteCanvas.tsx` (mouseDown/Move/Up)
3. Добавь кнопку в `CanvasToolbar.tsx`
4. Добавь шорткат (9 тулов → новая цифра)
5. Обнови `Plan Excalidraw-like.md`

---

## 10. РАСШИРЕНИЕ DRAW ELEMENTS

```typescript
interface DrawElement {
  id: string;
  type: 'line' | 'pen' | 'rect' | 'ellipse' | 'frame' | 'text' | 'image';
  // geometry
  points?: number[];      // для pen/line
  x, y, width, height?: number; // для rect/ellipse/frame/image/text
  // style
  stroke, strokeWidth, fill, opacity, ...;
  // meta
  rotation?: number;
  parentId?: string;      // для группировки в frame
  locked?: boolean;
}
```

При добавлении нового типа элемента:
1. Обнови `DrawElement.type`
2. Обнови рендер в `InfiniteCanvas.tsx` (switch по type)
3. Обнови `throttledSaveDrawElements`
4. Обнови bounds calculation для выделения

---

*Canvas = самый сложный модуль. Изменения здесь = высокий риск регрессии.*
