# 🎲 Vibe TTRPG Platform — AGENTS.md

> **Назначение**: Главный файл для всех AI-агентов. Читай ПЕРВЫМ.  
> **Дата**: 2026-05-03  
> **Правило**: Всё что здесь написано — закон. Не нарушай.

---

## 1. ЧТО ЭТО

**Vibe TTRPG Platform** — локально-первая VTT-платформа (Virtual Tabletop) для настольных RPG.

### Три в одном:
| Компонент | Аналог | Назначение |
|-----------|--------|-----------|
| **Бесконечный Canvas** | Miro / Excalidraw / Tldraw | Карты, токены, рисование, fog of war |
| **База Знаний** | Obsidian | Заметки, лор, правила, [[wiki-ссылки]], graph view |
| **VTT Engine** | FoundryVTT | Чарлисты, инвентарь, броски кубов, туман войны |

### Ключевая фишка: ЛОКАЛЬНО-ПЕРВЫЙ
- ГМ создаёт мир на своём ПК (файлы `.md`)
- Когда играть — поднимает сервер Express + WebSocket
- Игроки подключаются по IP (Hamachi/RadminVPN) — **ничего не устанавливают**
- Source of truth = файлы на диске хоста

---

## 2. ТЕХНОЛОГИЧЕСКИЙ СТЕК

| Слой | Технология | Версия |
|------|-----------|--------|
| Frontend | React + TypeScript + Vite | React 19, Vite 7 |
| Стили | Tailwind CSS | v4 (utility-first) |
| Стейт | Zustand | v5 |
| Canvas 2D | react-konva | 19.2 (Konva 10) |
| CRDT Sync | Yjs + y-websocket | 13.6 / 1.5 |
| Сервер | Express | порт 3001 |
| Файлы | .md + YAML frontmatter | Source of truth |
| Локализация | i18next | Русский (основной) / Английский |
| Анимации | framer-motion | v12 |
| Всплывашки | @floating-ui/react + react-contexify | |
| Иконки | lucide-react + react-icons | |

---

## 3. АРХИТЕКТУРА: 5 МОДУЛЕЙ

### 3.1 CanvasModule — Интерактивный канвас
- Бесконечный 2D-канвас (react-konva Stage)
- 9 инструментов: hand, select, pen, line, rect, ellipse, frame, text, image
- Undo/redo через Y.UndoManager
- Snap-to-grid (квадраты/гексы)
- Fog of War (reveal/cover, world-space текстура)
- Мультиплеерные курсоры и пинг (G+клик)
- Порталы между канвасами
- Токены (окна на канвасе: icon/compact/full)
- Ролевая модель: GM видит туман опционально, игроки — всегда

### 3.2 KnowledgeBaseModule — Obsidian-подобная база знаний
- Все сущности — `.md` файлы с YAML frontmatter
- [[wiki-ссылки]] между сущностями
- Markdown-рендер (react-markdown + remark-gfm)
- Рекурсивное дерево базы (EntityDatabase)
- Drag & drop между базами (general/user/gm)
- Инлайн-переименование
- Контекстные меню (шаблон из UI Architecture)
- Graph view (в планах)

### 3.3 CharacterModule — Чарлисты и инвентари
- CharacterSheet: вкладки Stats / Inventory / Notes
- Динамические атрибуты (StatRow с useCalculatedStat)
- HP-бары, Power toggle (Астрал/Эфир/Аура)
- Инвентарь с категориями: оружие/броня/расходуемое/прочее
- Equip/unequip toggle
- Drag & drop из базы в инвентарь
- ObjectSheet, AttackSheet (вложенные атаки оружия)
- Теги (статусы, свойства)

### 3.4 RulesEngineModule — Рантайм математика
- `useCalculatedStat(entityId, statPath)` — вычисление статов
- Порядок: base → adhoc → additions → multiplications → min/max
- Context bubbling: поиск стата вверх по parent chain
- DiceParser: `/r 1d20+5`, `/r 2d6+$strength` — парсинг переменных
- Инлайн-броски в Markdown: `!roll 2d6+$dex`
- Системы: D&D 5e (основная), совместимость с d20-подобными

### 3.5 SessionModule — Сессии и мультиплеер
- Локально-первая модель: файлы → сервер → клиенты
- Yjs CRDT + y-websocket для real-time sync
- Каждый канвас = отдельный Y.Doc + отдельная комната
- Роли: Host (GM), Player (ограниченные права на запись)
- Awareness: курсоры, пинг, присутствие
- Debounce 2 сек: Yjs → файлы
- Chokidar: внешние правки → WebSocket → Yjs
- IndexedDB: офлайн-кэш (y-indexeddb)

---

## 4. СТРУКТУРА ПРОЕКТА

```
Vibe TTRPG Platform/
├── app/                          # React-фронтенд (Vite)
│   └── src/
│       ├── types.ts              # Entity, ChatMessage, EntityType, DatabaseType
│       ├── store/                # Zustand: yjs, entity, canvas, window, ui
│       ├── hooks/                # useEntities, useCalculatedStat
│       ├── services/             # fileApi, fileSyncService
│       ├── utils/                # diceParser, theme, entitySerializer
│       ├── components/
│       │   ├── canvas/           # InfiniteCanvas, CanvasToolbar
│       │   ├── windows/          # WindowManager, EntityWindow, CharacterSheet
│       │   │   └── blocks/       # AttributeBlock, InventoryBlock, etc.
│       │   └── ui/               # Drawers, Chat, Database, Login
│       └── locales/              # ru.json, en.json
├── server/                       # Express + WebSocket (порт 3001)
│   └── src/
│       ├── index.ts              # Точка входа
│       ├── worldManager.ts       # Создание/открытие миров
│       ├── fileManager.ts        # CRUD .md файлов
│       ├── fileWatcher.ts        # chokidar-вотчер
│       └── renameManager.ts      # Каскадное переименование
├── start.bat                     # Запуск: server + client
├── world.yaml                    # Метаданные мира
├── test-world/                   # Тестовые данные
├── general/                      # Общая база сущностей (.md)
├── gm/                           # Скрытая база ГМа
├── users/                        # Базы игроков
├── .pi/                          # Документация и скиллы
│   ├── skills/                   # Скиллы для агентов
│   ├── rules/                    # Правила кодирования
│   └── docs/                     # Авто-генерируемая документация
└── AGENTS.md                     # ← ты здесь
```

---

## 5. ENTITY SYSTEM — ЯДРО ВСЕГО

**ВСЁ в системе — это Entity.** 9 типов:

| Тип | Описание | Где хранится |
|-----|---------|-------------|
| `character` | Персонаж (игрок/NPC) | general/characters/ |
| `object` | Предмет (меч, зелье, броня) | general/objects/ |
| `ability` | Способность/заклинание | general/abilities/ |
| `attack` | Атака (вложена в оружие) | Внутри объекта-родителя |
| `tag` | Тег (модификатор, статус) | general/tags/ |
| `note` | Заметка (wiki-статья, правило) | general/notes/ |
| `canvas` | Игровое поле/карта | general/canvases/ |
| `portal` | Портал между канвасами | На канвасе-родителе |
| `folder` | Папка для группировки | В любой базе |

### Три базы:
```
general/  — Общая база (имя = уникальный ID). Все видят.
users/    — Инвентари игроков (uid = ID). Владелец + ГМ.
gm/       — База ГМа. Только ГМ.
```

### Матрёшка (вложенность):
```
Торин Железнобокий.md          ← character
Торин Железнобокий/
  ├── Экскалибур.md            ← object (parentId: "Торин Железнобокий")
  └── Экскалибур/
      └── Рубящая Атака.md     ← attack (parentId: "Экскалибур")
```

### Интерфейс Entity:
```typescript
{
  id: string;
  parentId: string | null;
  type: EntityType;
  name: string;             // Уникально в general DB
  description: string;      // Markdown
  imageId?: string;
  icon_url?: string;
  properties: Record<string, any>;
  tags: string[];
  database?: DatabaseType;
}
```

---

## 6. ПОТОК ДАННЫХ

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  .md файлы   │ ←──→│ Express API  │ ←──→│  Yjs (CRDT)  │
│  (на диске)  │     │  (3011)      │     │  (в памяти)  │
└──────────────┘     └──────────────┘     └──────┬───────┘
       ↑                    ↑                    │
       │ chokidar           │ fileSyncService    │ y-websocket
       │ (внешние правки)   │ (debounce 2s)      │
       │                    │                    │
       │            ┌───────┴────────────────────┘
       │            ↓
       │   ┌──────────────────┐
       └──→│  Все клиенты     │
           │  (WebSocket)     │
           └──────────────────┘
```

### Правила синхронизации:
1. **Хост** = source of truth (файлы на диске)
2. **Игроки** получают данные через Yjs (не трогают файлы)
3. Yjs → debounce 2 сек → .md файлы (хост)
4. Внешние правки (Obsidian) → chokidar → WebSocket → Yjs
5. Каждый канвас = отдельный Y.Doc + комната

---

## 7. КОНВЕНЦИИ КОДА

### Naming
- **Файлы компонентов**: `PascalCase.tsx` → `InfiniteCanvas.tsx`, `EntityDatabase.tsx`
- **Хуки**: `useXxx.ts` → `useCalculatedStat.ts`, `useEntities.ts`
- **Утилиты**: `camelCase.ts` → `diceParser.ts`, `entitySerializer.ts`
- **Сторы**: `xxxStore.ts` → `canvasDrawStore.ts`, `windowStore.ts`
- **Типы в коде**: `PascalCase` → `Entity`, `WindowMode`, `DrawElement`
- **Переменные/функции**: `camelCase` → `activeCanvasId`, `handleDragEnd`
- **CSS классы**: Tailwind utility-first, кастомные через `theme.ts`

### Язык
- **UI / строки**: Русский (основной), английский (через i18n)
- **Код / типы / комментарии**: Английский

### Стиль кода
- TypeScript strict mode
- Функциональные компоненты + хуки (никаких классов)
- Zustand сторы для глобального состояния
- Локальное состояние через `useState`
- Никаких проп-дриллингов > 2 уровней — используй стор или контекст
- Экспорт по умолчанию для компонентов страниц, именованный для утилит

### Tailwind
- Используй utility-классы, не пиши кастомный CSS
- Глобальные токены стилей — ТОЛЬКО в `utils/theme.ts`
- При изменении темы — меняй `theme.ts`, 80% приложения обновится

### Импорты
```typescript
// Порядок: React → libraries → utils → stores → hooks → components → types
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { glass } from '../../utils/theme';
import { useCanvasDrawStore } from '../../store/canvasDrawStore';
import { useEntitiesByParent } from '../../hooks/useEntities';
import { EntityWindow } from '../windows/EntityWindow';
import type { Entity } from '../../types';
```

---

## 8. Z-ИНДЕКСЫ (КРИТИЧНО)

```
z:0    — Активный канвас (Konva Stage)
z:10   — Закреплённые окна на канвасе (pinned)
z:20   — UI канваса: CanvasToolbar, кнопка рецентра
z:30   — Кнопки открытия шторок
z:40   — Боковые панели (LeftDrawer, RightDrawer)
z:50   — Незакреплённые окна (unpinned EntityWindow)
z:9999 — Всплывашки: Tooltip, Popover, ContextMenu, ConfirmDialog
```

**При добавлении элемента — проверь его z-index по этой иерархии.**

---

## 9. TTRPG DOMAIN KNOWLEDGE

### Ключевые механики, которые нужно понимать:
- **D20 System**: d20 + modifiers vs DC. Attack rolls, saving throws, skill checks.
- **Advantage/Disadvantage**: roll 2d20, take higher/lower.
- **Damage types**: piercing, bludgeoning, slashing, fire, cold, lightning, etc.
- **Action economy**: action, bonus action, reaction, movement.
- **Conditions**: poisoned, stunned, prone, invisible, etc.
- **Concentration**: spellcasters maintain one concentration spell.
- **Rest mechanics**: short rest (1h, spend hit dice), long rest (8h, full recovery).
- **Fog of War**: players see only what their tokens reveal. GM sees everything.
- **Token vision**: darkvision (greyscale), truesight, blindsight.
- **Initiative tracking**: turn order in combat.
- **HP tracking**: current/max, temporary HP, death saves.

### Баланс и геймдизайн:
- CR (Challenge Rating) для монстров
- Action economy баланс (legendary actions для боссов)
- Bounded accuracy (AC ~10-20, attack ~+3 to +11)
- Ресурс-менеджмент (spell slots, ki points, rage uses)

### Лор и повествование:
- Фракции, NPC relationships
- Мировые события и таймлайны
- Квесты: main, side, personal character arcs
- [[Wiki-links]] для связывания всего

---

## 10. ЗАПРЕТЫ (ЧТО НЕЛЬЗЯ ДЕЛАТЬ)

### Canvas
- ❌ НЕ ломать состояние канваса (stage scale/offset)
- ❌ НЕ менять систему координат без консультации
- ❌ НЕ удалять тулзы — только добавлять новые
- ❌ НЕ трогать throttled функции без понимания (drag performance)
- ❌ НЕ добавлять Konva layers без необходимости (perf!)

### Obsidian-совместимость
- ❌ НЕ менять формат .md файлов (YAML frontmatter священен)
- ❌ НЕ ломать [[wiki-ссылки]]
- ❌ НЕ менять правила уникальности имён в general DB

### Архитектура
- ❌ НЕ вводить новые стейт-менеджеры (Zustand — достаточно)
- ❌ НЕ добавлять зависимости без явного согласования
- ❌ НЕ менять технологический стек
- ❌ НЕ оверинжинирить: простое решение > сложное

### UI
- ❌ НЕ хардкодить цвета — используй `glass.*` из `theme.ts`
- ❌ НЕ использовать `window.confirm` — только `ConfirmDialog`
- ❌ НЕ создавать контекстное меню не по шаблону (секция 7 UI Arch)
- ❌ НЕ игнорировать z-index иерархию

### Мультиплеер
- ❌ НЕ менять ролевую модель без полного тестирования
- ❌ НЕ убирать debounce на fileSync (сожрёт диск)
- ❌ НЕ давать игрокам права на запись в чужие базы

---

## 11. КЛЮЧЕВЫЕ ДОКУМЕНТЫ

| Документ | Что внутри |
|----------|-----------|
| `MASTER DESIGN DOCUMENT Vibe TTRPG Platform.md` | Полная спецификация проекта |
| `FUTURE_DEVELOPMENT_PLAN.md` | Архитектурные решения и оптимизация |
| `MULTIPLAYER_IMPLEMENTATION_AND_TESTING.md` | Тестирование мультиплеера |
| `Plan Excalidraw-like.md` | Статус канвас-рисования |
| `UI_ARCHITECTURE.md` | Архитектура интерфейса |
| `.pi/ARCHITECTURE_ANALYSIS.md` | Проблемы масштабирования |
| `.pi/DEVELOPMENT_PLAN.md` | Поэтапный план доработок |
| `.pi/skills/vibe-project/SKILL.md` | Быстрый вход в проект |
| `.pi/skills/vibe-ui-architecture/SKILL.md` | Архитектура UI |
| `.pi/rules/coding-style.md` | Правила кодирования |
| `.pi/rules/ttrpg-domain.md` | TTRPG доменные знания |
| `.pi/rules/canvas-best-practices.md` | Canvas best practices |
| `.pi/rules/mechanics-engine.md` | Math/Mechanics engine |
| `.pi/rules/vertical-slice-workflow.md` | Vibe coding workflow |

---

## 12. КАК ЗАПУСТИТЬ

```bat
start.bat
```
→ Vite dev server (5173) + Express (3001)

### Ручной запуск:
```bash
# Терминал 1 — сервер
cd server && npm run dev

# Терминал 2 — клиент
cd app && npm run dev -- --host
```

### Подключение игрока:
1. Хост запускает сервер + клиент
2. Хост в Hamachi получает IP (например `25.55.120.14`)
3. Игрок открывает `http://25.55.120.14:5173`
4. Выбирает "Подключиться к Игре" → вводит IP

---

## 13. AI-АГЕНТУ: ПОРЯДОК ДЕЙСТВИЙ

1. **Прочитай этот файл** (ты уже здесь)
2. **Прочитай vibe-project/SKILL.md** для быстрого входа
3. **Если задача касается UI** → прочитай vibe-ui-architecture/SKILL.md
4. **Прочитай релевантный rule** из `.pi/rules/`
5. **Действуй в vibe-стиле**: mini-PRD → план → итерации → self-critique
6. **После кода** → предложи тесты, задокументируй в `.pi/docs/`

---

*Последнее обновление: 2026-05-03 — инициализация AGENTS.md*
