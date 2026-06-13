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

**`app/src/utils/theme.ts`** — источник theme presets, CSS variables и объекта `glass` со всеми Tailwind-классами. После `FEAT-UI-002` темы считаются не просто палитрами, а визуальными столами/workspaces.

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
| `glass.panel` | Общая shell-панель: drawers, docks, HUD, notification center | App shell |
| `glass.panelHeader` | Header shell-панели с semantic border/header surface | Drawers, docks, notification center |
| `glass.iconButton` | Иконка-кнопка без жёстких `black/white` цветов | Canvas toolbar, drawer buttons, settings/actions |
| `glass.iconButtonActive` | Активное состояние icon/tool button | Toolbar, tabs, toggles |
| `glass.tabBar` / `glass.tabActive` / `glass.tabIdle` | Общий tab/segmented control contract | Sheet tabs, CanvasToolbar |
| `glass.popover` | Popover/dropdown shell на theme tokens | Tool menus, pickers |

### 1.1 Theme token contract

`theme.ts` задаёт built-in presets: `universalGlass`, `woodenTable`, `arcaneControl`, `rgbGameDesk`, `lowLoad`. Каждый preset обязан отдавать semantic CSS variables:

- global: `--vibe-app-bg`, `--vibe-body-bg`, `--vibe-text-primary`, `--vibe-text-muted`, `--vibe-text-faint`;
- accents: `--vibe-accent`, `--vibe-accent-2`, `--vibe-accent-3`, `--vibe-danger`, `--vibe-success`, `--vibe-warning`;
- surfaces: `--vibe-surface-window`, `--vibe-surface-header`, `--vibe-surface-block`, `--vibe-surface-input`, `--vibe-surface-hover`;
- structure: `--vibe-border-subtle`, `--vibe-border-strong`, `--vibe-radius-sm/md/lg`, `--vibe-shadow-window`, `--vibe-shadow-block`, `--vibe-backdrop-blur`.

**Правило**: новые UI-компоненты должны использовать `glass.*` или эти semantic variables. Не добавляй новую тему через россыпь hardcoded `bg-[#...]` в компонентах. Если компоненту нужен новый визуальный смысл, сначала добавь semantic token в `theme.ts`, затем используй его в JSX/CSS.

### 1.2 Entity UI migration status

После первых `FEAT-UI-002` entity passes уже переведены на semantic tokens:

- `EntityWindow`: frame/header/actions/relations/context menu/generic description/debug surfaces.
- `CharacterSheet`: notes tab textarea/read surface.
- `MarkdownRenderer`: headings, blockquote, code/pre, tables, stats/inventory custom markdown blocks.
- `AttributeBlock`, `SkillsBlock`, `CompetenciesBlock`, `AbilitiesBlock`, `ResourcesBlock`, `StatTooltip`: core stat/resource/ability surfaces, popovers, counters and status colors use `--vibe-*` semantic tokens.
- `TagPickerPopup`, `EntityImageBlock`: picker modal, tag creation, image placeholder, overlay editor and upload/error states use `glass.*` and semantic tokens.
- `ObjectSheet`, `AttackSheet`: parameter cards, action/danger panels, formula roll controls, tag pills and description empty states use semantic tokens.
- `InventoryBlock`: equipped attack summary, dense item table, category sections, sort headers, equip toggles, qty input and total weight use semantic tokens.
- `SettingsWindow`: settings frame, interface/audio/canvas/world/roles panels, language switch, role badges, toggles, range/input controls and error states use semantic tokens.
- `AssetBrowser`: host/player file surfaces, toolbar, migrate warning, filters/sort, selection bar, empty/error states and asset cards use semantic tokens.
- `AudioDesk`: player mixer, GM audio desk, channel tabs, broadcast/fade controls, cues, audio list, empty/error states and danger/success actions use semantic tokens.
- `Density registry`: `theme.ts` owns `compact/balanced/spacious` spacing presets and CSS variables (`--vibe-space-*`, `--vibe-control-*`, `--vibe-tab-height`, `--vibe-row-height`, `--vibe-font-scale`); `useInterfaceDensity.ts` applies localStorage-backed choice; `SettingsWindow -> Интерфейс` owns the UI switch. `glass.*`, `SheetTabs` and dense inventory table cells already read these variables. New shared surfaces should use `glass.*` or these variables instead of fixed padding when density should affect them.
- `Compact character card`: `app/src/utils/characterCardSummary.ts` owns derived character summary data, `app/src/utils/entityActionRollModel.ts` + `app/src/services/entityActionRoll.ts` own roll formulas/chat dispatch for full entity sheets, and `InfiniteCanvas.tsx` owns the unified DOM overlay tabs (`Статы`, `Действия`, `Ресурсы`, `Заметки`) for both `Фишка` and `Карточка`. Canvas compact card is informational only and lives on the canvas card itself: derive and show all available compact character blocks from the entity and children, with scroll/tabs when needed. Do not add `properties.compactCard`, visible-field selectors, roll/edit/add/delete controls, or a compact-card settings UI. Use the entity window for all character interactions and editing; detailed card info is hidden unless the current role can edit the entity.
- `Workspace windows`: `app/src/utils/windowLayout.ts` owns screen-space layout math; `windowStore.ts` applies local-only `tile/grid/cascade` actions and quick screen snapshot; `EntityWindow.tsx` owns the layout menu. Do not apply screen-space auto-layout to pinned canvas windows without a separate coordinate QA slice.
- `Pinned entity windows`: shared pinned windows are canvas placements in `canvas.properties.canvasWindowInstances[]` (`canvasTypes.ts` + `canvasPersistence.ts`), not `entity.properties.windowState`. `openWindow(entityId)` is a personal screen singleton; pin creates a separate canvas window instance, so one entity can be pinned many times without copying the entity file. Movement/deletion checks canvas edit rights; content editing checks entity rights.
- `Notes workspace mode`: `workspaceMode.ts` + `workspaceModeStore.ts` own the local `canvas | notes` mode; `App.tsx` switches between `InfiniteCanvas` and `NotesWorkspace`; `WindowManager` hides canvas-pinned placements when `showPinned=false`; pure tab/split data contract, including tab move/reorder, split resize ratio and tab view modes, lives in `notesWorkspaceLayout.ts`; local tab board state lives in `notesWorkspaceStore.ts`, persists via validated `localStorage`, and migrates legacy `markdown` view to `preview`; `NotesWorkspace.tsx` is now the Obsidian-like local editor workspace with vault tree, source/preview/split Markdown modes, entity data view, children/attached entities and linked context; linked data parses headings/wiki links/backlinks in `notesWorkspaceLinks.ts`. This path is local-only: do not add world-shared workspace layout, browser popout or native multi-window without the Electron/native gate, and do not reintroduce screen-window layout controls as the main notes workflow.

После этого token-pass старые hardcoded surfaces нужно искать точечно через `rg "white/|black/|#[0-9a-fA-F]{6}|bg-black|text-white|border-white"` перед каждым UI-срезом, а не считать какой-то один файл главным долгом.

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
| `openWindow(entityId, x, y)` | Открыть личное screen-окно. Если screen-окно этой entity уже открыто — фокус. Pinned copies на canvas не блокируют screen-окно. |
| `closeWindow(id)` | Закрыть окно |
| `updateWindow(id, partial)` | Обновить свойства |
| `focusWindow(id)` | Поднять z-index |
| `setMode(id, mode)` | Сменить режим |
| `togglePin(id, canvasId)` | Legacy/local pin toggle. Для shared pinned windows новый код должен создавать/удалять `canvasWindowInstances[]`. |
| `hydrateWindow(state)` | Legacy-восстановление старого pinned `windowState`; не использовать для нового shared canvas placement. |

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
- `app/src/utils/localization.ts` — supported locales, localStorage key, normalization helpers
- `app/src/hooks/useLocalePreference.ts` — UI hook для смены языка через i18next
- `.pi/docs/i18n-custom-locales-foundation.md` — mini-plan для будущих custom world locales

### Использование:
```tsx
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
t('hud.activeElements') // → "Объекты на канвасе"
```

### Правило:
- первый срез `FEAT-I18N-002` уже даёт RU/EN switch в `SettingsWindow -> Интерфейс` и хранит выбор локально;
- новые UI-строки, добавляемые в текущем UI-redesign pass, нужно заводить через `t(...)`;
- custom world locale files и редактор переводов пока planned, не записывай `world/locales/*.json` без отдельного product/architecture gate.

---

## 14.1 Notes Workspace DnD guardrails

- `NotesWorkspace.tsx` tab/pane HTML DnD must only read/write the internal `application/vnd.vibe-notes-workspace-tab` MIME. Do not add `text/plain` fallback: selected text, images and external drags must not show workspace drop previews.
- Pane drag that moves the last tab out of a group must collapse the now-empty source group via `notesWorkspaceLayout.ts`; keep `notesWorkspaceLayout.test.ts` and `notesWorkspaceStore.test.ts` aligned with that contract.
- Notes shell modules (`Vault`, `Context`, `Notifications`, `Search`, `Graph`, `Audio`) are pointer-dragged by module headers and persisted through `notesWorkspaceStore.shell.moduleAreas/moduleOrder`. Do not implement shell module movement with browser HTML DnD.
- Stable UI labels go through i18n locale files. Entity names/descriptions/properties are world content and must not be translated by UI render code.

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
