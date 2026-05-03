# 📋 ПЛАН ДОРАБОТКИ ДО РАБОЧЕГО РЕЛИЗА

> Дата: 2026-05-02
> Цель: Довести приложение до состояния, когда можно скинуть другу и играть

---

## 📊 ТЕКУЩИЙ СТАТУС (кратко)

### ✅ ГОТОВО
- React+TS+Vite+Tailwind
- Yjs + y-websocket (entity sync)
- Express файловый сервер (CRUD, ассеты, вотчер)
- .md файловая система (YAML frontmatter, матрёшка)
- Window Manager (3 режима, drag, resize, pin)
- Infinite Canvas (react-konva, 9 тулов, undo/redo, snap)
- Canvas routing (порталы между канвасами)
- Character Sheet (статы, инвентарь, атаки, заметки)
- Math Engine (useCalculatedStat, breakdown, context bubbling)
- Entity Database (рекурсивное дерево, drag&drop, контекстное меню)
- Chat + Dice парсер
- Login Screen (Host/Player, сохранённые миры/серверы)
- Tag System (hidden/statuses/properties)
- Glassmorphism UI

---

## 🔴 ЭТАП 1: ЧИНИМ МУЛЬТИПЛЕЕР (Критический) — **В РАБОТЕ**

Без этого друг НЕ сможет подключиться.

| # | Задача | Файлы | Статус |
|---|--------|-------|--------|
| 1.1 | **Синхронизировать y-websocket** (обе стороны на 1.5.4) | `server/package.json`, `app/package.json` | ✅ Готово |
| 1.2 | **Добавить `--host` в start.bat** | `start.bat` | ✅ Готово |
| 1.3 | **Поле имени игрока при входе** (Player + Host) | `LoginScreen.tsx`, `App.tsx` | ✅ Готово |
| 1.4 | **Ролевая модель в Yjs** (GM/Player, awareness, права) | `yjsStore.ts` | ✅ Готово |
| 1.5 | **Валидация прав на запись** (`canModifyEntity`, `canModify`) | `yjsStore.ts` | ✅ Готово |
| 1.6 | **Разделение fileSync по игрокам** | `fileSyncService.ts` | ⬜ Требует тестирования |
| 1.7 | **Тестовый прогон с Hamachi** | Инструкция | ✅ Протестировано — мультиплеер работает |

### 🟠 БАГФИКСЫ КАНВАСА (2026-05-02)

| # | Баг | Фикс |
|---|-----|------|
| 1 | Элементы возвращаются на место после drag | `lastDragDeltaRef` + `handleSelectDragEnd` использует точный финальный delta |
| 2 | Закреплённые окна отстают при панораме (hand-tool + middle-click + zoom) | `throttledSetTransform` в `handleDragMove`, `handleMiddlePanMove`, `handleWheel` |
| 3 | Клик в «Объекты на канвасе» не центрирует камеру | `window.__vibeSetStageCamera` для прямого управления Stage |
| 4 | Повторный клик телепортирует объект дальше | `dragGenerationRef` — stale throttled save игнорируется; `selectedElementIds` из store |
| 5 | Точки растягивания/векторов не работали | `gen` параметр в `throttledSaveDrawElements` сделан опциональным |
| 6 | Двойной клик в базе — закреплённое окно сдвигается вместо центрирования | `openWindow` теперь вызывает `__vibeSetStageCamera` |

### Изменённые файлы:
- `InfiniteCanvas.tsx`: `handleDragMove`, `handleMiddlePanMove`, `handleSelectDragStart/End`, `throttledSaveDrawElements`, `stageRef` + `window.__vibeSetStageCamera`
- `CanvasToolbar.tsx`: `centerOn` вызывает `__vibeSetStageCamera`
- `windowStore.ts`: `openWindow` вызывает `__vibeSetStageCamera`

Чтобы можно было реально играть в TTRPG.

| # | Задача | Файлы | Почему важно |
|---|--------|-------|-------------|
| 2.1 | **Awareness: курсоры других игроков** | `canvasSyncStore.ts`, `InfiniteCanvas.tsx` | ✅ Готово |
| 2.2 | **Мультиплеерный пинг** (ГМ тыкает → пульс на карте у всех) | `canvasSyncStore.ts`, `InfiniteCanvas.tsx` | ✅ Готово |
| 2.3 | **Snap-to-Grid** (сетка с настройкой шага: квадраты/гексы) | `InfiniteCanvas.tsx`, `canvasDrawStore.ts`, `CanvasToolbar.tsx` | ✅ Готово |
| 2.4 | **Туман Войны** (Fog of War — упрощённая модель, без covers) | `InfiniteCanvas.tsx`, `canvasSyncStore.ts`, `canvasDrawStore.ts`, `canvasTypes.ts`, `CanvasToolbar.tsx` | ✅ Готово |
| 2.5 | **Кнопки броска кубов из статов** (`!roll 2d6+$strength`) | `AttributeBlock.tsx` | Основное действие игрока |
| 2.6 | **Интерактивное редактирование HP** (клик → изменить) | `AttributeBlock.tsx` | Без этого ГМ вручную в JSON лезет |
| 2.7 | **Лог изменений в чат** (HP, статусы) | `AttributeBlock.tsx`, `ChatPanel.tsx` | Прозрачность игры |

### Реализовано (2026-05-02)

#### 2.1 Awareness: курсоры других игроков
- `canvasSyncStore.ts`: состояние `remoteCursors`, экспорт типа `RemoteCursor`
- `joinCanvas()`: устанавливает локальное состояние awareness (имя, роль, цвет, координаты), подписывается на `awareness.on('change')` для получения курсоров других игроков
- `leaveCanvas()`: отписывается от awareness, чистит `remoteCursors`
- `setLocalCursor(x, y)`: обновляет локальную позицию курсора через `awareness.setLocalStateField('cursor', ...)`
- 10 детерминированных цветов (хеш от playerId), бейдж «ГМ» для GM
- `InfiniteCanvas.tsx`: в `handleMouseMove` (throttled ~30fps) обновляет локальный курсор через `setLocalCursor`
- Новый Layer рендерит кружки с цветом игрока, именем и бейджем «ГМ»

#### 2.2 Мультиплеерный пинг
- `canvasSyncStore.ts`: `sendPing(x, y)` — отправляет ping через awareness (поле `ping: {x, y, timestamp}`), авто-очистка через `PING_DURATION_MS` (2500ms), `clearLocalPing()` убирает ping из состояния
- `RemoteCursor` дополнен опциональным `ping?` полем
- `InfiniteCanvas.tsx`: компонент `PingPulse` — расширяющееся кольцо (14px→70px) с затуханием за 2.5 сек, зажал `G` + клик = пинг (работает во всех режимах, даже при рисовании), хинт «G + клик = пинг» в левом нижнем углу канваса
- Пинг рендерится отдельно от курсора (можно пинговать в одну точку, а курсор держать в другой)

#### 2.3 Snap-to-Grid
- `canvasDrawStore.ts`: состояние `gridEnabled` (default false), `gridType` ('square'|'hex'), `gridSpacing` (default 50), экшены `toggleGrid`, `setGridType`, `setGridSpacing`
- `InfiniteCanvas.tsx`: сетка теперь конфигурируемая — читает настройки из стора; хексагональная сетка (flat-top); snap-to-grid в `handleSelectDragMove` — примагничивает верхний-левый угол (квадраты) или центр (гексы) к ближайшей точке (threshold 8px world coords)
- `CanvasToolbar.tsx`: кнопка сетки с popup-панелью (toggle, тип, пресеты шага 25/50/75/100)

#### 2.4 Туман Войны (Fog of War) — ПЕРЕРАБОТКА (2026-05-02, фикс)

**Модель упрощена:**
- Убран `fogCoverMap` — теперь только один `fogMap<FogReveal>` (просветы)
- **Дефолт = полный туман**: пустой `fogMap` = всё затуманено
- **Просвет (Reveal)**: добавляет дыру в тумане
- **Скрыть (Cover)**: удаляет все пересекающиеся просветы из `fogMap` (закрашивает обратно)
- **Покрыть всё**: `clearAllFog()` — очищает `fogMap` (возвращает полный туман)
- **Сбросить всё**: `revealAll()` — очищает `fogMap` + добавляет огромный просвет ±10000 (всё видно)

**canvasTypes.ts:**
- `FogRevealType = 'circle' | 'rect'` (убран `ellipse`)
- Добавлены хелперы: `getFogRevealBounds(reveal)`, `fogRevealsOverlap(a, b)`

**canvasSyncStore.ts:**
- Только `fogMap: Y.Map<FogReveal>`, `fogReveals: FogReveal[]`
- Методы: `addFogReveal()`, `removeIntersectingReveals(shape)` (cover tools), `clearAllFog()` (full fog), `revealAll()` (massive reveal)
- Убраны: `fogCoverMap`, `fogCovers`, `addFogCover()`, `coverAll()`, `removeFogReveal()`

**InfiniteCanvas.tsx — FogOfWarLayer переписан (world-space):**
- **World-space текстура**: фиксированный оффскрин-канвас 2048×2048px, покрывающий область мира вокруг viewport'а.
- Центр текстуры привязан к центру viewport'а с шагом 400 world-units — не дёргается при каждом пикселе панорамы.
- Текстура регенерируется только при изменении reveals или сдвиге центра > 400 units.
- Konva Image позиционируется в **мировых координатах** (worldArea.left/top) — туман неподвижен в мире.
- Видимость: игроки видят туман всегда (если `playerFogVisible=true`), ГМ — только при `gmFogVisible=true`.
- **Fog Edit Mode**: кнопка 👁️ включает выделенный режим; панель инструментов заменяется на fog-панель; все клики перехватываются.

**CanvasToolbar.tsx:**
- «⬛ Покрыть всё» → `clearAllFog()` (полный туман)
- «🔓 Сбросить всё» → `revealAll()` (огромный просвет, всё видно)
- Кнопки cover-инструментов (🖌️Кисть/◻️Область в секции «Скрыть») теперь удаляют просветы

---

## 🟡 ЭТАП 3: ИНСТРУМЕНТЫ ГМА (Средний)

ГМ должен чувствовать контроль.

| # | Задача | Файлы |
|---|--------|-------|
| 3.1 | **Auto-WebP конвертация** (sharp на сервере) | `server/index.ts` |
| 3.2 | **ГМ видит инвентари всех игроков** | `LeftDrawer.tsx`, `EntityDatabase.tsx` |
| 3.3 | **Drag & Drop между игроками** (выдать/забрать предмет) | `EntityDatabase.tsx`, `InventoryBlock.tsx` |
| 3.4 | **Контекстное меню "Выдать предмет игроку"** | `EntityDatabase.tsx` |
| 3.5 | **Инлайн-броски в Markdown** (`!roll 2d6+$strength`) | `MarkdownRenderer.tsx`, `diceParser.ts` |
| 3.6 | **Кастомные блоки Markdown** (`stats`, `inventory`, `gm-only`) | `MarkdownRenderer.tsx` |
| 3.7 | **ConfirmDialog при удалении drawing элементов** | `InfiniteCanvas.tsx` |
| 3.8 | **Эфемерный слой синхронизации** (drag позиции через WS, не CRDT) | `canvasSyncStore.ts` |

---

## 🟢 ЭТАП 4: ПОЛИРОВКА (Низкий)

| # | Задача |
|---|--------|
| 4.1 | История бросков (отдельная вкладка в чате) |
| 4.2 | Профиль игрока (аватар, цвет ника) |
| 4.3 | Панель горячих клавиш (Help) |
| 4.4 | Переключатель светлой/тёмной темы |
| 4.5 | Token-изображения отдельно от portrait |
| 4.6 | Иконки статусов на токенах |
| 4.7 | Звуки (броски, уведомления) |
| 4.8 | Анимация перехода между канвасами |
| 4.9 | Валидация: нельзя создать сущность без имени |
| 4.10 | Контекстное меню удаления порталов с канваса |

---

## 🚀 ДОРОЖНАЯ КАРТА К STEAM

```
Версия 0.1 ──── ЭТАП 1: Чиним мультиплеер
                  (React + TS + Express + Yjs)
                     │
Версия 0.2 ──── ЭТАП 2: Базовый геймплей
                     │
Версия 0.3 ──── ЭТАП 3: Инструменты ГМа
                     │
Версия 0.4 ──── Тестирование с реальной группой
                     │
Версия 0.5 ──── Tauri-обёртка (десктопное приложение)
                     │
Версия 0.7 ──── 3D-кости и виртуальный стол (Three.js)
                     │
Версия 0.9 ──── Steam Workshop + Steam Networking
                     │
Версия 1.0 ──── РЕЛИЗ В STEAM 🎉
```

---

## 📁 ФАЙЛЫ ПРОЕКТА (ключевые)

```
app/src/
├── types.ts                    # Entity, ChatMessage
├── store/
│   ├── yjsStore.ts             # Yjs core: doc, entities, chat, roles
│   ├── entityStore.ts          # Zustand + Yjs observer
│   ├── canvasStore.ts          # activeCanvasId, history, zoom/pan
│   ├── canvasDrawStore.ts      # Tools, selection, undo/redo
│   ├── canvasSyncStore.ts      # Yjs per-canvas sync + UndoManager
│   ├── windowStore.ts          # Window positions, modes, pin
│   └── uiStore.ts              # ConfirmDialog state
├── hooks/
│   ├── useEntities.ts          # Selectors (by id, parent, type)
│   └── useCalculatedStat.ts    # Math engine
├── services/
│   ├── fileApi.ts              # REST client + WebSocket watcher
│   └── fileSyncService.ts      # Bridge: Files ↔ Yjs
├── utils/
│   ├── diceParser.ts           # /r 1d20+5 parser
│   ├── theme.ts                # Glassmorphism classes
│   ├── entitySerializer.ts     # .md ↔ Entity
│   └── entityParser.ts         # .md → Entity
├── components/
│   ├── canvas/
│   │   ├── InfiniteCanvas.tsx  # Konva stage, rendering
│   │   └── CanvasToolbar.tsx   # Drawing tools, styles
│   ├── windows/
│   │   ├── WindowManager.tsx   # All open windows
│   │   ├── EntityWindow.tsx    # Window frame (Rnd)
│   │   ├── CharacterSheet.tsx  # Character tabs
│   │   └── blocks/
│   │       ├── AttributeBlock.tsx
│   │       ├── InventoryBlock.tsx
│   │       ├── EntityImageBlock.tsx
│   │       ├── ObjectSheet.tsx
│   │       ├── AttackSheet.tsx
│   │       ├── PropertiesBlock.tsx
│   │       ├── StatusBlock.tsx
│   │       ├── TagEditor.tsx
│   │       └── TagPickerPopup.tsx
│   └── ui/
│       ├── LoginScreen.tsx
│       ├── HudBar.tsx
│       ├── LeftDrawer.tsx
│       ├── RightDrawer.tsx
│       ├── EntityDatabase.tsx
│       ├── ChatPanel.tsx
│       ├── ConfirmDialog.tsx
│       ├── DragDropPopover.tsx
│       ├── MarkdownRenderer.tsx
│       ├── EntityLink.tsx
│       ├── StatTooltip.tsx
│       └── Tooltip.tsx

server/src/
├── index.ts                    # Express + WebSocket сервер
├── worldManager.ts             # Создание/открытие миров
├── fileManager.ts              # CRUD .md файлов
├── fileWatcher.ts              # chokidar + WebSocket уведомления
├── renameManager.ts            # Атомарное переименование
└── shared/types.ts             # Общие типы
```
