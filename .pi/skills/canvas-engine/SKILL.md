---
name: canvas-engine
description: Interactive Canvas / Tldraw-style components for Vibe TTRPG Platform. Use when adding drawing tools, modifying canvas behavior, working with react-konva, or debugging canvas issues.
---

# 🎨 Interactive Canvas Engine

> Когда применять: любое изменение InfiniteCanvas, инструментов рисования, fog of war, snap-to-grid, порталов, токенов на канвасе.

---

## 1. БЫСТРЫЙ СТАРТ

Перед работой с канвасом — прочитай:
- `.pi/rules/canvas-best-practices.md` — полные правила
- `UI_ARCHITECTURE.md` — секция про координаты pinned/unpinned
- `app/src/components/canvas/InfiniteCanvas.tsx` — основной файл

---

## 2. АРХИТЕКТУРА КАНВАСА (напоминание)

```
Konva Stage (draggable, бесконечный)
├── BackgroundLayer      # Сетка (квадраты/гексы), фон
├── DrawingLayer         # DrawElement[] (pen, line, rect, ellipse, text, image)
├── FogOfWarLayer        # World-space оффскрин-текстура 2048×2048
├── PortalLayer          # Интерактивные порталы
└── CursorLayer          # Курсоры + пинг (Awareness)
```

### Pinned окна — НЕ внутри Stage
- Рендерятся отдельным div (z:10)
- Синхронизируют transform со Stage
- Координаты: canvas-world, не screen

---

## 3. СОСТОЯНИЕ КАНВАСА

### Три стора:
| Стор | Назначение |
|------|-----------|
| `canvasStore` | activeCanvasId, history, scale, offset |
| `canvasDrawStore` | activeTool, currentStyle, selectedIds, isDragging |
| `canvasSyncStore` | Yjs: elements, fog, undoManager, awareness |

### Важные методы:
```typescript
// canvasSyncStore — присоединение к канвасу
joinCanvas(canvasId: string)
leaveCanvas()
sendPing(x: number, y: number)

// canvasDrawStore — инструменты
setActiveTool(tool: ToolType)
addElement(element: DrawElement)
updateElement(id: string, changes: Partial<DrawElement>)
deleteElements(ids: string[])
undo()
redo()
```

---

## 4. ДОБАВЛЕНИЕ НОВОГО ИНСТРУМЕНТА

### Пошагово:

**Шаг 1: Тип инструмента**
```typescript
// canvasDrawStore.ts
type ToolType = 'hand' | 'select' | 'pen' | 'line' | 'rect' | 'ellipse' | 'frame' | 'text' | 'image' | 'NEW_TOOL';
```

**Шаг 2: Тип элемента (если новый тип)**
```typescript
// canvasTypes.ts
interface NewElementType extends BaseDrawElement {
  type: 'new_type';
  // специфичные поля
}
```

**Шаг 3: Обработчики в InfiniteCanvas.tsx**
```typescript
// handleMouseDown — что начинается при клике
// handleMouseMove — что происходит при движении
// handleMouseUp — финализация

if (activeTool === 'new_tool') {
  // логика
}
```

**Шаг 4: Рендер элемента**
```typescript
// В DrawingLayer — switch по element.type
case 'new_type':
  return <NewTypeShape key={el.id} element={el} />;
```

**Шаг 5: Кнопка в CanvasToolbar.tsx**
```tsx
<ToolButton
  icon={<NewIcon size={18} />}
  active={activeTool === 'new_tool'}
  onClick={() => setActiveTool('new_tool')}
  tooltip="Новый инструмент"
  shortcut="0"
/>
```

**Шаг 6: Шорткат**
```typescript
// keydown handler
case '0': setActiveTool('new_tool'); break;
```

---

## 5. FOG OF WAR — ПРАВИЛА

### Fog Edit Mode
- Кнопка 👁️ включает fog edit mode
- Панель инструментов заменяется на fog-панель
- Все клики перехватываются (не проходят в инструменты рисования)

### Fog инструменты:
```
🖌️ Reveal Brush  — круглый просвет (drag = размер)
⬜ Reveal Area    — прямоугольный просвет
🖌️ Cover Brush   — убирает пересекающиеся просветы (drag)
⬜ Cover Area     — убирает пересекающиеся просветы
⬛ Cover All      — clearAllFog()
🔓 Reveal All     — revealAll() (всё видно)
```

### Реализация:
```typescript
// canvasSyncStore
addFogReveal(reveal: FogReveal)          // добавить просвет
removeIntersectingReveals(shape: Shape)  // скрыть область
clearAllFog()    // полный туман
revealAll()      // всё видно

// FogOfWarLayer рендер:
// 1. Создать оффскрин-канвас 2048×2048
// 2. Залить тёмным (fog color)
// 3. Вырезать «дырки» просветов (globalCompositeOperation: 'destination-out')
// 4. Обновлять только при изменении reveals ИЛИ сдвиге viewport > 400 units
// 5. Konva Image в мировых координатах
```

---

## 6. ТОКЕНЫ НА КАНВАСЕ

### Открытие токена (pinned окно)
```typescript
// 1. Создать окно в windowStore
windowStore.openWindow(entityId, worldX, worldY);

// 2. Закрепить на канвасе
windowStore.togglePin(windowId, activeCanvasId);

// 3. Режим icon (64×64 круг)
windowStore.setMode(windowId, 'icon');

// 4. Центрировать камеру
window.__vibeSetStageCamera(worldX, worldY, scale);
```

### Перетаскивание токена
```typescript
// handleSelectDragMove:
// 1. Вычислить delta в world-координатах
// 2. Применить snap-to-grid если включен
// 3. Обновить позицию окна через windowStore
// 4. Сохранить через throttledSave с dragGenerationRef
```

### Контекстное меню токена:
- «Открыть» (icon → compact)
- «Закрепить/Открепить»
- «Дублировать»
- «Удалить с канваса» (только unpin)

---

## 7. СЕТКА (GRID)

```typescript
// canvasDrawStore
interface GridState {
  gridEnabled: boolean;
  gridType: 'square' | 'hex';
  gridSpacing: number;
}
```

### Рендер:
- Квадраты: цикл по x/y с шагом spacing
- Гексы (flat-top): смещение каждого второго ряда на spacing/2
- Цвет: `rgba(255,255,255,0.05)` — едва заметный
- Перерисовывается при zoom/pan

### Snap:
```typescript
function snapToGrid(x: number, y: number, grid: GridState): { x: number, y: number } {
  if (!grid.gridEnabled) return { x, y };
  
  if (grid.gridType === 'square') {
    return {
      x: Math.round(x / grid.gridSpacing) * grid.gridSpacing,
      y: Math.round(y / grid.gridSpacing) * grid.gridSpacing,
    };
  }
  
  // Hex snap (к ближайшему hex-центру)
  // ...
}
```

---

## 8. ПРОИЗВОДИТЕЛЬНОСТЬ

### Правила:
1. **Throttle всё что движется**: drag, pan, zoom (30fps = 33ms)
2. **Cull элементы вне viewport**: не рендерить невидимое
3. **Мемоизировать Konva-конфиги**: `useMemo` для fill/stroke/etc
4. **Не создавать объекты в рендере**: особенно массивы точек
5. **Fog отдельным offscreen canvas**: не пересчитывать каждый кадр
6. **Минимум Layers**: каждый Layer = отдельный Canvas элемент

---

## 9. ТЕСТИРОВАНИЕ КАНВАСА

```typescript
// Что тестировать:
- Инструменты создают правильные элементы
- Undo/redo работает
- Snap-to-grid корректный
- Координаты world↔screen конвертация
- Fog of war reveal/cover
- Переключение канвасов (join/leave cleanup)
```

---

*Канвас — лицо платформы. Баги здесь видны сразу.*
