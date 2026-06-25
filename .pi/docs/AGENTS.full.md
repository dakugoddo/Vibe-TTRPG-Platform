# 🎲 Vibe TTRPG Platform — AGENTS.md

> **Назначение**: Главный файл для всех AI-агентов. Читай ПЕРВЫМ.
> **Дата**: 2026-05-20
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
- **Общение с владельцем, планы реализации (implementation plan), бэклоги и любые отчеты в `.pi/`**: Строго Русский язык (для удобства чтения владельцем). Всегда пиши планы и общайся на русском.

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
| `AGENTS.md` (этот файл) | Главный вход для AI-агентов |
| `.pi/DEVELOPMENT_PLAN.md` | Поэтапный план доработок (текущий статус) |
| `.pi/BUG_BACKLOG.md` | Очередь багов, приоритеты, batch-группы и статус исправлений |
| `.pi/FEATURE_BACKLOG.md` | Очередь новых функций, feature triage, зависимости и acceptance criteria |
| `.pi/ARCHITECTURE_ANALYSIS.md` | Проблемы масштабирования и решения |
| `.pi/3D_FUTURE_ANALYSIS.md` | План 3D + Tauri + Steam |
| `.pi/docs/code-map.md` | Быстрая карта владельцев логики в коде |
| `.pi/docs/platform-runtime-decision.md` | Decision draft по Tauri/Rust/Steam/3D |
| `.pi/docs/module-architecture.md` | План отключаемых внутренних модулей и будущих расширений |
| `.pi/MASTER DESIGN DOCUMENT Vibe TTRPG Platform.md` | Оригинальная спецификация (исторический) |
| `.pi/Plan Excalidraw-like.md` | Лог фаз канвас-рисования (исторический) |
| `.pi/docs/testing-multiplayer.md` | Инструкция тестирования мультиплеера |
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
2. Хост в Hamachi/RadminVPN получает IP (например `25.55.120.14`)
3. Игрок открывает `http://25.55.120.14:5173`
4. Выбирает "Подключиться к Игре" → вводит IP

---

## 13. ТЕКУЩИЙ СТАТУС (2026-05-28)

### ✅ Готово
- Мультиплеер вручную подтверждён владельцем через Radmin/Hamachi: подключение, курсоры и перемещение canvas-объектов работают.
- Roll Engine стал единым фасадом для чата, Markdown, навыков, компетенций, атак и способностей.
- Entity ID links переведены на стабильные `[[id]]`, есть Obsidian-like autocomplete и миграционный dry-run/apply endpoint.
- Asset Browser получил рекурсивный индекс, stable asset paths, upload/delete/show-in-explorer, image/video previews и drag image assets на canvas.
- Canvas получил undo/redo, lasso fix, entity token/card foundation, line binding/snap foundation и GIF DOM overlay foundation.
- Audio module вынесен из шторок/файлов в отдельный bottom dock + `AudioDesk`; core остаётся local-first.
- Notification foundation добавлен: model/store, toast stack, notification center и upload progress.

### 🟠 Сейчас в работе
- Session notification channel и GM approval flow для player uploads больше `100 MB`.
- Audio module polish: mobile layout, локальная дека до world persistence, reconnect-safe music/ambience snapshots.
- Canvas/asset QA: GIF/video, line binding, cards/tokens, undo/redo, drop routing.
- Roles/player identity и entity visibility/access guards.

### 📋 Дальше
См. `.pi/DEVELOPMENT_PLAN.md`, `.pi/FEATURE_BACKLOG.md` и `.pi/BUG_BACKLOG.md`.

---

## 14. AI-АГЕНТУ: ПОРЯДОК ДЕЙСТВИЙ

1. **Прочитай этот файл** (ты уже здесь)
2. **Прочитай `.pi/skills/vibe-project/SKILL.md`** для быстрого входа
3. **Если задача касается UI** → прочитай `.pi/skills/vibe-ui-architecture/SKILL.md`
4. **Прочитай релевантный rule** из `.pi/rules/`
5. **Действуй в vibe-стиле**: mini-PRD → план → итерации → self-critique
6. **После кода** → предложи тесты, задокументируй в `.pi/docs/`

### 14.0 Команда "Продолжай"

Если владелец проекта пишет `продолжай`, `продолжай работать`, `лабай`, `херачь дальше` или похожую команду, это означает:

1. Агент продолжает разработку автономно, а не останавливается ради нового подтверждения.
2. Работать нужно до реального блокера: нехватка данных, риск поломать фундамент, критичный выбор продукта, невозможность проверить/собрать или операция, требующая явного разрешения.
3. Некритичные вопросы, вкусовые развилки и варианты реализации нужно откладывать и группировать в один будущий список, а не прерывать текущую разработку.
4. Если можно сделать безопасный foundation-first срез без выбора владельца, агент делает его.
5. Если git, commit, push или GitHub-интеграция временно не работают из-за лимитов, авторизации, sandbox или сети, это не блокирует разработку. Нужно кратко зафиксировать проблему, продолжить кодить и оставить рабочее дерево в понятном состоянии.
6. Git-гигиена остаётся целью: после проверенного среза агент пытается сделать осмысленный commit/push, когда это доступно, но не прекращает полезную работу только потому, что git сейчас "не пашет".
7. Останавливать работу и звать владельца нужно только там, где дальнейшее действие может привести к потере данных, неверной архитектурной развилке, смене технологического фундамента или нарушению уже принятой задумки.

### 14.1 Bug intake и приоритеты

Если пользователь пишет, что нашёл баг, агент **не обязан сразу чинить его в текущем сообщении**. Сначала нужно сделать triage:

1. Записать баг в `.pi/BUG_BACKLOG.md` и, если он влияет на roadmap, добавить ссылку/чекбокс в `.pi/DEVELOPMENT_PLAN.md`.
2. Назначить приоритет:
   - `P0` — потеря данных, приложение не запускается, критичная поломка сохранения/синхронизации.
   - `P1` — сломан основной игровой сценарий, права доступа, приватность GM-only или мультиплеерная сессия.
   - `P2` — важная функция не работает, но есть обходной путь; чинить ближайшим тематическим срезом.
   - `P3` — полировка, неудобство, визуальный дефект, низкий риск.
3. Назначить module/batch key: `Canvas selection`, `EntityWindow`, `Roll Engine`, `File sync`, `Permissions`, etc.
4. Чинить немедленно только `P0/P1`, либо `P2`, если текущий срез уже трогает тот же модуль.
5. `P2/P3` баги группировать по модулю и исправлять пачкой, чтобы не распыляться и не гонять одни и те же файлы много раз.
6. Если описание неоднозначное, сначала уточнить ожидание. Не чинить то, что может оказаться не багом, а непонятым UX/требованием.
7. После исправления обновить `.pi/BUG_BACKLOG.md`, `.pi/DEVELOPMENT_PLAN.md`, релевантный QA-документ и сделать отдельный `fix: ...` commit.

### 14.1.1 Agent-induced regression learning loop

Если баг очевидно появился из-за предыдущей AI-правки или агентского решения, агент не должен ограничиваться точечным фиксом. Нужно отдельно закрыть причину повторения:

1. В `.pi/BUG_BACKLOG.md` пометить баг как `agent-induced regression` или явно написать в плане, какая предыдущая правка создала дефект.
2. При фиксе прочитать соседний код и локальный ownership-документ, чтобы понять не только строку ошибки, но и контракт модуля.
3. Добавить короткий regression note в релевантный справочный файл: `.pi/docs/code-map.md`, `.pi/docs/*`, `.pi/rules/*` или `.pi/skills/*/SKILL.md`.
4. Если ошибка связана с повторяющимся паттерном работы агента, обновить именно skill/rule, а не только backlog.
5. В note фиксировать практическое правило: "не делать X, потому что Y; использовать Z", без длинной ретроспективы.
6. Добавить или расширить focused test/QA-шаг, если баг можно поймать автоматически или простым smoke-сценарием.
7. В финальном отчёте коротко сказать, какой справочный файл обновлён, чтобы следующий агент не повторил тот же промах.

### 14.2 Самоанализ дорогого поиска

Агент обязан отслеживать, сколько усилий уходит на поиск нужного места в коде:

- если за 3-5 точечных `rg`/file-read проходов не найден владелец логики;
- если приходится читать большие несвязанные куски кода только чтобы понять, где находится функция;
- если название UI-элемента, фичи или файла не совпадает с фактической архитектурой;
- если проблема возникла из-за неоднозначной формулировки пользователя.

В таких случаях агент должен остановить "слепое шерстение" и сделать вывод:

- проблема в навигации по проекту → добавить задачу на улучшение `.pi` архитектурных/дизайн/код-map документов;
- проблема в структуре кода → предложить или запланировать refactor/navigation helper;
- проблема в формулировке задачи → коротко сказать, что именно неоднозначно, и уточнить перед исправлением.

Это правило нужно применять периодически во время длинных задач, а не только в финале.

### 14.3 Feature intake и планирование

Если пользователь просит новый функционал, агент **не должен слепо кодить первое прочтение запроса**. Сначала нужно сделать feature triage:

1. Записать фичу в `.pi/FEATURE_BACKLOG.md` и, если она влияет на roadmap, добавить ссылку/чекбокс в `.pi/DEVELOPMENT_PLAN.md`.
2. Проверить, не существует ли уже часть функционала:
   - если функционал уже есть, но сломан или недоделан — оформить как bug/enhancement и довести существующий контур;
   - если есть фундамент, расширять его, а не создавать параллельную систему;
   - если это реально новая область — оформить mini-PRD/acceptance criteria.
3. Назначить приоритет:
   - `F0` — фундаментальная схема/миграция, без которой следующие функции будут хрупкими.
   - `F1` — основной игровой workflow для ГМа/игроков.
   - `F2` — важное ускорение работы или quality-of-life.
   - `F3` — полировка, эксперимент или визуальное улучшение.
4. Назначить module/batch key: `Canvas history`, `Asset Browser`, `Audio Workbench`, `Entity ID Links`, `UI Design System`, etc.
5. Для фич, которые трогают `.md` формат, sync, permissions, file system или будущую платформенную упаковку, сначала сделать короткий design-doc в `.pi/docs/`.
6. Если запрос неоднозначный или пользователь мог ошибиться, явно назвать неоднозначность и уточнить до реализации. Не строить фундамент на догадке.
7. После реализации обновить `.pi/FEATURE_BACKLOG.md`, `.pi/DEVELOPMENT_PLAN.md`, релевантный QA-документ и сделать отдельный `feat: ...` или `refactor: ...` commit.

### 14.4 Architecture/Product gate для крупных нововведений

Если задача меняет глобальный UX, архитектуру модулей, sync/permissions, файловый формат, внешний API, desktop/Steam packaging, plugin/mod-систему или другой фундамент, агент **не должен сразу строить финальную реализацию по догадке**.

Правило:

1. Сначала оформить feature/bug triage в `.pi/FEATURE_BACKLOG.md` или `.pi/BUG_BACKLOG.md`.
2. Создать или обновить design-doc в `.pi/docs/` с mini-PRD, вариантами, рисками, зависимостями и acceptance criteria.
3. Если область имеет зрелые аналоги или внешние API, свериться с актуальными источниками/официальной документацией и сохранить выводы ссылками.
4. Отдать владельцу короткий список решений и вопросов, которые реально влияют на продукт.
5. До согласования можно делать только обратимые foundation-first срезы: вынести общие сервисы, тесты, типы, стабилизировать баги, убрать ошибочное размещение UI.
6. Нельзя добавлять новую зависимость, менять технологический фундамент, фиксировать публичный формат или окончательное место сложного UI без явного согласования.
7. Команда `продолжай` не отменяет этот gate: автономность продолжается вокруг безопасных срезов, но продуктовые развилки собираются для будущего решения.

Примеры, где gate обязателен: audio player/mixer, YouTube/API-интеграции, plugin/mod architecture, role identity, entity permission model, Tauri/Rust/Steam, 3D-сцена, формат `.md`/Yjs данных.

---

*Последнее обновление: 2026-05-25 — добавлен Architecture/Product gate для крупных нововведений и внешних API.*

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
