---
name: vibe-ui-architecture
description: Complete UI architecture reference for Vibe TTRPG Platform. Use when modifying ANY UI component, fixing interface bugs, changing styles, adding new UI elements, or understanding how the glassmorphism design system works. This skill eliminates the need to re-read every component file.
---

# 🎨 Vibe TTRPG — UI Architecture Reference

> **Назначение**: Единый источник истины по всему интерфейсу.  
> **Правило**: Перед ЛЮБЫМ изменением UI — прочитай этот документ.  
> **Язык интерфейса**: Русский. **Язык кода/типов**: Английский.

---

## 1. ГЛОБАЛЬНАЯ ТЕМА (Самый важный файл)

**`app/src/utils/theme.ts`** — экспортирует объект `glass` со всеми Tailwind-классами:

| Ключ | Назначение | Где используется |
|------|-----------|-----------------|
| `glass.bg` | Фон приложения (градиент) | `App.tsx` |
| `glass.window` | Рамка окна (blur, border, shadow) | `EntityWindow.tsx` |
| `glass.header` | Шапка окна | `EntityWindow.tsx` |
| `glass.titleText` | Заголовок окна | `EntityWindow.tsx` |
| `glass.content` | Тело окна (padding, gap) | `EntityWindow.tsx` |
| `glass.blockBg` | Фон блоков (inset shadow) | Все блоки в `blocks/` |
| `glass.blockHeader` | Заголовок блока (uppercase, tracking) | Все блоки |
| `glass.input` | Поля ввода | Везде |

**Правило**: При смене всей темы — меняй ТОЛЬКО этот файл. 80% приложения обновится автоматически.

---

## 2. ФАЙЛОВАЯ СТРУКТУРА UI

```
app/src/
├── App.tsx                          # Корень: фон, слои, Canvas, Drawers
├── index.css                        # Глобальные стили Tailwind
├── main.tsx                         # Точка входа React
├── utils/theme.ts                   # Глобальная тема (glass)
├── store/
│   ├── windowStore.ts               # Окна (позиции, режимы, pin, localStorage)
│   ├── canvasStore.ts               # Навигация по канвасам
│   ├── canvasDrawStore.ts           # Инструменты рисования, undo/redo
│   ├── canvasSyncStore.ts           # Yjs синхронизация канвасов
│   └── uiStore.ts                   # ConfirmDialog
├── components/
│   ├── canvas/
│   │   ├── InfiniteCanvas.tsx       # Konva Stage: рендер, рисование, drag
│   │   └── CanvasToolbar.tsx        # Панель инструментов + стили
│   ├── windows/
│   │   ├── WindowManager.tsx        # Контейнер всех окон (слои 10 и 50)
│   │   ├── EntityWindow.tsx         # Рамка окна (Rnd), 3 режима, контекстное меню
│   │   ├── CharacterSheet.tsx       # Вкладки персонажа: Stats/Inventory/Notes
│   │   └── blocks/
│   │       ├── EntityImageBlock.tsx  # Фото сущности с управлением
│   │       ├── AttributeBlock.tsx    # Статы, HP-бары, power toggle
│   │       ├── InventoryBlock.tsx    # Инвентарь с категориями и equip
│   │       ├── ObjectSheet.tsx       # Карточка предмета
│   │       ├── AttackSheet.tsx       # Карточка атаки
│   │       ├── PropertiesBlock.tsx   # Свойства (только в debug mode)
│   │       ├── StatusBlock.tsx       # Статусы персонажа
│   │       ├── TagEditor.tsx         # Редактор тегов
│   │       └── TagPickerPopup.tsx    # Поповер выбора тега
│   └── ui/
│       ├── LoginScreen.tsx           # Экран входа (Host/Player)
│       ├── HudBar.tsx                # Верхняя панель
│       ├── LeftDrawer.tsx            # Левая шторка (инвентарь)
│       ├── RightDrawer.tsx           # Правая шторка (база + чат)
│       ├── EntityDatabase.tsx        # Дерево сущностей + drag&drop
│       ├── ChatPanel.tsx             # Чат с Yjs-синхронизацией
│       ├── ConfirmDialog.tsx         # Модальное окно подтверждения
│       ├── DragDropPopover.tsx       # Поповер "Копировать/Перенести"
│       ├── MarkdownRenderer.tsx      # Рендер markdown + [[wiki-links]]
│       ├── EntityLink.tsx            # Кликабельная wiki-ссылка
│       ├── StatTooltip.tsx           # Тултип "Расчёт модификаторов"
│       └── Tooltip.tsx               # Базовый Popover компонент
```

---

## 3. ИЕРАРХИЯ Z-СЛОЁВ (КРИТИЧНО)

```
z:0    — Активный канвас (Konva Stage)
z:10   — Закреплённые окна на канвасе (pinned windows, масштабируются с zoom)
z:20   — UI канваса: CanvasToolbar (тулбар), кнопка рецентра
z:30   — Кнопки открытия шторок (левая и правая)
z:40   — Боковые панели (LeftDrawer, RightDrawer)
z:50   — Незакреплённые окна (unpinned EntityWindow)
z:9999 — Всплывашки: Tooltip, Popover, ContextMenu, ConfirmDialog
```

**Правило**: При создании нового UI-элемента — проверь его z-index по этой иерархии.

---

## 4. WINDOW MANAGER (Окна)

### 4.1 Стор (`windowStore.ts`)

```typescript
type WindowMode = 'full' | 'compact' | 'icon';

interface WindowState {
  id: string;        // ID окна (обычно = entityId)
  entityId: string;  // ID связанной сущности
  mode: WindowMode;  // full=отладка, compact=обычный, icon=кружок
  x, y: number;      // Позиция
  width, height: number;
  zIndex: number;
  isPinned: boolean; // Закреплено на канвасе?
  canvasId?: string; // На каком канвасе закреплено
}
```

### 4.2 Ключевые методы

| Метод | Что делает |
|-------|-----------|
| `openWindow(entityId, x, y)` | Открыть окно. Если уже открыто — фокус. Если pinned на другом канвасе — создать unpinned копию. |
| `closeWindow(id)` | Закрыть окно |
| `updateWindow(id, partial)` | Обновить свойства |
| `focusWindow(id)` | Поднять z-index |
| `setMode(id, mode)` | Сменить режим |
| `togglePin(id, canvasId)` | Закрепить/открепить с конвертацией координат |
| `hydrateWindow(state)` | Восстановить pinned окно из БД при загрузке |

### 4.3 WindowManager.tsx — рендер

```
Pinned окна:   fixed inset-0 z-10 → transform (масштаб канваса)
Unpinned окна: fixed inset-0 z-50 → без масштаба (экранные координаты)
```

Показываются только pinned окна текущего канваса (`win.canvasId === activeCanvasId`).

### 4.4 Координаты при pin/unpin

```
PIN (screen → canvas):
  newX = (x - stageOffset.x) / stageScale
  newY = (y - stageOffset.y) / stageScale

UNPIN (canvas → screen):
  newX = (x * stageScale) + stageOffset.x
  newY = (y * stageScale) + stageOffset.y
  (с clamp в границы экрана)
```

---

## 5. ТРИ РЕЖИМА ОКНА

### Icon mode (w=64, h=64)
- Рендерится через `Rnd` без resize
- Круглая рамка с `CircleDot` иконкой и truncate-именем
- Тултип при наведении
- Двойной клик → compact

### Compact mode (min 300×200)
- Заголовок + тип + кнопки (pin, mode, close)
- Контент зависит от типа сущности:
  - `character` → CharacterSheet (stats/inventory/notes)
  - `note` → Markdown описание
  - `object` → ObjectSheet + описание
  - `attack` → AttackSheet + описание
  - `tag` → TagEditor
  - Остальные → описание + properties

### Full mode (Debug, min 400×500)
- То же что compact + дополнительные секции:
  - Сырые properties (JSON)
  - TagEditor (для tag)
  - Все TAGS с кнопками удаления
  - System ID

---

## 6. ZUSTAND СТОРЫ (Краткий справочник)

| Стор | Файл | Ключевые данные |
|------|------|----------------|
| `useWindowStore` | `windowStore.ts` | `windows`, `focusedWindowId`, `highestZIndex` |
| `useCanvasStore` | `canvasStore.ts` | `activeCanvasId`, `canvasHistory`, `scale`, `offset` |
| `useCanvasDrawStore` | `canvasDrawStore.ts` | `activeTool`, `currentStyle`, `selectedElementIds`, `drawingElement`, `isDraggingGlobal` |
| `useCanvasSyncStore` | `canvasSyncStore.ts` | `elements: DrawElement[]`, `undoManager`, `joinCanvas()`, `leaveCanvas()` |
| `useEntityStore` | `entityStore.ts` | `entities: Record<string, Entity>` |
| `useUIStore` | `uiStore.ts` | `confirmDialog`, `openConfirm()` |

### Важные хуки-селекторы (`hooks/useEntities.ts`)

```typescript
useEntity(id)            // Одна сущность (только её ререндер)
useAllEntities()         // Все сущности массивом
useEntitiesByParent(id)  // Дети указанного parentId
useEntitiesByType(type)  // Все сущности типа
useEntitiesByIds(ids)    // Несколько по ID
getEntitySnapshot(id)    // Синхронный доступ (для обработчиков)
getEntitiesSnapshot()    // Все сущности синхронно
```

---

## 7. КОНТЕКСТНЫЕ МЕНЮ (СТАНДАРТ)

Все контекстные меню в проекте **обязаны** следовать этому шаблону:

```tsx
// 1. Рендер через createPortal в document.body
// 2. Защитный слой: fixed inset-0 z-[99998]
// 3. Само меню: z-[99999]

// Контейнер меню:
className="fixed rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10 
           py-1.5 min-w-[200px] overflow-hidden backdrop-blur-3xl bg-[#151c2b]/70"

// Заголовок:
className="px-3 py-1.5 text-[9px] font-bold text-white/30 uppercase tracking-widest 
           border-b border-white/5 mb-1 select-none pointer-events-none"

// Кнопка действия:
className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 
           hover:text-white transition-colors flex items-center gap-2 group"

// Иконка (Lucide):
size={14} className="text-white/40 group-hover:text-white/80 transition-colors"

// Опасное действие (удалить):
className="... text-red-400 hover:bg-red-500/20 hover:text-red-300"
// Иконка: text-red-500/50 group-hover:text-red-400

// Разделитель:
<div className="border-t border-white/5 my-1 mx-2" />
```

### Где используются контекстные меню:
- `EntityDatabase.tsx` — `EntityContextMenu` (на элементах базы)
- `EntityWindow.tsx` — встроенное в шапку окна (createPortal в конце файла)
- Порталы на канвасе (InfiniteCanvas.tsx)

---

## 8. DRAG & DROP

### Компоненты:
- `DragDropPopover` — кастомный поповер "Скопировать/Перенести/Отмена" (замена window.confirm)

### Потоки drag&drop:

1. **Из базы в инвентарь**: `application/entity-id` + `application/source-database`
2. **Из базы на канвас**: то же самое, в `App.tsx.onDrop`
3. **Внутри базы** (смена parent): через `RecursiveEntityItem.onDrop`
4. **Между базами**: `DragDropPopover` с выбором Move/Copy

---

## 9. ENTITY DATABASE (Дерево сущностей)

### Файл: `EntityDatabase.tsx`

Компонент принимает пропсы:
```typescript
{
  baseParentId: string | null;  // 'my-personal-inventory' | 'global' | activeCanvasId | null
  showRootCanvas?: boolean;
  headerTitle?: string;
  allowedTabs?: string[];       // ['object', 'note', 'character']
  targetDb?: DatabaseType;      // 'user' | 'general' | 'gm'
}
```

### Где используется:
- `RightDrawer` → `baseParentId={null}`, `showRootCanvas=true`
- `LeftDrawer` → `baseParentId="my-personal-inventory"`, `targetDb="user"`

### Категории (`EntityGroups`):
```
canvas, character, object, ability, note, tag, attack
```
У каждой: цвет точки, цвет текста, hover-стили.

### RecursiveEntityItem:
- Рекурсивно рендерит детей (`parentId === entity.id`)
- Для character/folder/canvas: клик → expand, двойной клик → открыть окно
- Для остальных: клик → открыть окно (или navigate для canvas)
- Drag source + drop target
- Inline-переименование

---

## 10. CHARACTER SHEET

### Файл: `CharacterSheet.tsx`

Три вкладки: **Stats**, **Inventory**, **Notes**

### AttributeBlock (`AttributeBlock.tsx`)
- `StatRow` компонент для каждого атрибута
- `useCalculatedStat` для вычислений
- Popover для редактирования (base + adhoc)
- Wiki-link на имя стата (ищет `note` с таким же именем)
- HP-бар (`bg-red-500` прогресс)
- Power toggle: Астрал/Эфир/Аура (стилизованные свитчеры)
- Секция Status/Properties (только в debug)

### InventoryBlock (`InventoryBlock.tsx`)
- Категории: оружие, броня, расходуемое, другое
- Equip/unequip toggle (Apple-style `bg-green-500`)
- Количество предметов
- Агрегация атак с экипированного оружия
- Drag & drop приём
- Сортировка по колонкам

### Math Engine (`useCalculatedStat.ts`)
- `useCalculatedStat(entityId, statPath[])`
- Возвращает: `{ total, base, breakdown[] }`
- Порядок: base → adhoc → additions → multiplications → min/max
- Context bubbling: если стат не найден, идёт вверх по parentId

---

## 11. CANVAS / РИСОВАНИЕ

### Инструменты (`activeTool`):
`hand` | `select` | `pen` | `line` | `rect` | `ellipse` | `frame` | `text` | `image`

### Стили (`currentStyle`):
```typescript
{ stroke, strokeWidth, strokeStyle, fill, opacity, fillOpacity, strokeOpacity,
  startCap, endCap, fontSize, fontFamily, textAlign, textColor, textOpacity }
```

### Сторы:
- `canvasDrawStore` — локальное состояние (инструмент, стиль, выделение)
- `canvasSyncStore` — Yjs-синхронизация (Y.Doc на каждый канвас, UndoManager)

### Шорткаты:
```
1-9: инструменты
Delete/Backspace: удалить выделенное
Ctrl+Z: undo
Ctrl+Shift+Z / Ctrl+Y: redo
Ctrl+C/V/D: copy/paste/duplicate
Ctrl+A: select all
Shift (drag): lock по оси
Shift (rotate): snap 30°
```

---

## 12. ЧАТ И ДАЙСЫ

### ChatPanel (`ChatPanel.tsx`)
- Yjs-синхронизация через `yjsStore.chatArray`
- Системные сообщения (isSystem=true) — по центру
- Свои сообщения — справа (`bg-white/20`)
- Чужие — слева (`bg-black/40`)
- Парсер дайсов: `/r 1d20+5` или `/roll 2d6`

### DiceParser (`diceParser.ts`)
- `parseAndRollDice(command)` → `DiceRollResult`
- Формат: `(\d*)d(\d+)([+-]\d+)?`
- Crit detection: `isCritMax` (все max), `isCritMin` (все 1)
- Ограничения: 1-100 дайсов, 2-1000 граней

---

## 13. ПРАВИЛА РЕДАКТИРОВАНИЯ UI

1. **Меняешь стиль глобально** → `theme.ts`
2. **Добавляешь контекстное меню** → копируй шаблон из секции 7
3. **Добавляешь всплывашку** → `z-[9999]`, рендер через `createPortal`
4. **Меняешь окно** → помни про pinned/unpinned координаты (секция 4.4)
5. **Трогаешь цвета** → используй `glass.*` из темы, не хардкодь
6. **Drag & drop** → используй `DragDropPopover` вместо `window.confirm`
7. **Удаление** → всегда через `useUIStore.openConfirm()` (ConfirmDialog)

---

## 14. ЛОКАЛИЗАЦИЯ

### Файлы:
- `app/src/locales/ru.json` — русский (основной)
- `app/src/locales/en.json` — английский

### Использование:
```tsx
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
t('hud.activeElements') // → "Объекты на канвасе"
```

---

## 15. ЛОГИН И МУЛЬТИПЛЕЕР

### LoginScreen (`LoginScreen.tsx`)
- Шаги: `main` → `host`/`join` → `loading`
- Host: создаёт/открывает мир, запускает файловый сервер
- Player: подключается по IP (сохранённые серверы)
- `setIsHost(true/false)` определяет кто запускает fileApi

### Yjs подключение:
- `yjsStore.joinRoom(roomName)` — подключается к `ws://host:3001/ws/world`
- Canvas: отдельные комнаты `ws://host:3001/ws/canvas/<canvasId>`
- `IndexeddbPersistence` для офлайн-кэша
