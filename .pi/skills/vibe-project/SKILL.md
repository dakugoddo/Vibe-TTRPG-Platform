---
name: vibe-project
description: Complete project overview for Vibe TTRPG Platform. Use this skill when starting any task in this project to understand the architecture, tech stack, file structure, and current development status. This is the entry point for all development work.
---

# 🎲 Vibe TTRPG Platform — Project Overview

> **Назначение**: Быстрый вход в проект для любого агента.  
> **Правило**: Прочитай этот документ ПЕРВЫМ перед любой работой.

---

## 1. ЧТО ЭТО ЗА ПРОЕКТ

**Vibe TTRPG Platform** — гибридная локальная VTT-платформа (Virtual Tabletop) для настольных ролевых игр.

### Концепция (три в одном):
- **Miro** — бесконечные канвасы для рисования, карт, заметок
- **Obsidian** — база знаний на .md файлах с wiki-ссылками
- **FoundryVTT** — чарлисты, инвентарь, броски кубов, туман войны

### Ключевая фишка: ЛОКАЛЬНО-ПЕРВЫЙ (Local-First)
- ГМ создаёт мир на своём ПК (файлы .md)
- Когда надо играть — поднимает сервер
- Игроки подключаются по IP (Hamachi/RadminVPN) — им НЕ надо ничего устанавливать
- В перспективе: Steam + Steam Networking вместо Hamachi

---

## 2. ТЕХНОЛОГИЧЕСКИЙ СТЕК

| Слой | Технология | Зачем |
|------|-----------|-------|
| Frontend | React 19 + TypeScript + Vite | UI |
| Стили | Tailwind CSS v4 | Glassmorphism |
| Стейт | Zustand | Лёгкие сторы |
| Canvas 2D | react-konva | Рисование, карты, токены |
| CRDT | Yjs + y-websocket | Мультиплеер-синхронизация |
| Сервер | Express (порт 3001) | REST API + WebSocket |
| Файлы | .md с YAML frontmatter | Source of truth (можно открыть в Obsidian) |
| Локализация | i18next | Русский (основной) / Английский |

---

## 3. КЛЮЧЕВАЯ АРХИТЕКТУРА: Entity System

**ВСЁ в системе — это Entity.** 9 типов:

| Тип | Описание | Где хранится |
|-----|---------|-------------|
| `character` | Персонаж | general/characters/ |
| `object` | Предмет (меч, зелье) | general/objects/ |
| `ability` | Способность | general/abilities/ |
| `attack` | Атака (вложена в оружие) | Внутри объекта-родителя |
| `tag` | Тег (модификатор) | general/tags/ |
| `note` | Заметка (wiki-статья) | general/notes/ |
| `canvas` | Рабочее пространство | general/canvases/ |
| `portal` | Портал между канвасами | На канвасе-родителе |
| `folder` | Папка для группировки | В любой базе |

### Три базы данных:
```
general/  — Общая база (имя = уникальный ID). Все видят.
users/    — Инвентари игроков (uid = ID). Видит владелец + ГМ.
gm/       — База ГМа. Только ГМ видит.
```

### Интерфейс Entity:
```typescript
{
  id: string;
  parentId: string | null;  // Матрёшка: вложенность
  type: EntityType;
  name: string;             // Уникально в general DB
  description: string;      // Markdown
  imageId?: string;         // Изображение
  properties: Record<string, any>;  // Статы, координаты, и т.д.
  tags: string[];           // Прикреплённые теги
  database?: DatabaseType;
}
```

### Матрёшка (вложенность):
```
Торин Железнобокий.md          ← character
Торин Железнобокий/
  ├── Экскалибур.md            ← object (parentId: "Торин Железнобокий")
  └── Экскалибур/
      └── Рубящая Атака.md     ← attack (parentId: "Экскалибур")
```

---

## 4. СТРУКТУРА ПРОЕКТА (файловая)

```
Vibe TTRPG Platform/
├── app/                          # React-фронтенд (Vite)
│   ├── src/
│   │   ├── App.tsx               # Корень приложения
│   │   ├── types.ts              # Entity, ChatMessage
│   │   ├── store/                # Zustand сторы
│   │   ├── hooks/                # useEntities, useCalculatedStat
│   │   ├── services/             # fileApi, fileSyncService
│   │   ├── utils/                # diceParser, theme, entitySerializer
│   │   ├── components/
│   │   │   ├── canvas/           # InfiniteCanvas, CanvasToolbar
│   │   │   ├── windows/          # WindowManager, EntityWindow, CharacterSheet
│   │   │   │   └── blocks/       # AttributeBlock, InventoryBlock, etc.
│   │   │   └── ui/              # Drawers, Chat, Database, Login, etc.
│   │   └── locales/             # ru.json, en.json
│   └── package.json
├── server/                       # Express файловый сервер
│   └── src/
│       ├── index.ts              # Точка входа (порт 3001)
│       ├── worldManager.ts       # Создание/открытие миров
│       ├── fileManager.ts        # CRUD .md файлов
│       ├── fileWatcher.ts        # chokidar-вотчер
│       └── renameManager.ts      # Каскадное переименование
├── start.bat                     # Запуск всего
├── world.yaml                    # Метаданные тестового мира
├── test-world/                   # Тестовые данные
├── .pi/                          # Документация и скиллы
│   ├── ARCHITECTURE_ANALYSIS.md  # Разбор масштабирования
│   ├── 3D_FUTURE_ANALYSIS.md     # План 3D-интеграции
│   ├── DEVELOPMENT_PLAN.md       # План доработок по этапам
│   └── skills/                   # Скиллы для агентов
└── [дизайн-документы].md
```

---

## 5. ПОТОК ДАННЫХ: Как всё синхронизируется

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  .md файлы   │ ←──→│ Express API  │ ←──→│  Yjs (CRDT)  │
│  (на диске)  │     │  (порт 3001) │     │  (в памяти)  │
└──────────────┘     └──────────────┘     └──────┬───────┘
       ↑                    ↑                    │
       │ chokidar           │ fileSyncService    │ y-websocket
       │ (внешние правки)   │ (debounce 2s)      │
                                                 │
                    ┌────────────────────────────┘
                    ↓
          ┌──────────────────┐
          │  Все клиенты     │
          │  (через WebSocket │
          │   на хосте)      │
          └──────────────────┘
```

### Важные правила синхронизации:
1. **Хост** = source of truth (файлы на диске)
2. **Игроки** получают данные через Yjs (не трогают файлы)
3. Изменения в Yjs → debounce 2 сек → запись в .md файлы (только хост)
4. Внешние правки (Obsidian) → chokidar → WebSocket → Yjs → все клиенты
5. Каждый канвас = отдельный Y.Doc + отдельная WebSocket комната

---

## 6. КАК ЗАПУСТИТЬ

### Быстрый старт (dev):
```bat
start.bat
```
Откроет: Vite (5173) + Express (3001)

### Ручной запуск:
```bash
# Терминал 1 — сервер
cd server && npm run dev

# Терминал 2 — клиент
cd app && npm run dev -- --host
```

### Подключение игрока:
1. Хост запускает оба сервера
2. Хост в Hamachi получает IP (например 25.55.120.14)
3. Игрок открывает `http://25.55.120.14:5173` в браузере
4. Выбирает "Подключиться к Игре" → вводит IP

---

## 7. ТЕКУЩИЙ СТАТУС РАЗРАБОТКИ

### ✅ Готово:
- Entity System + CRDT синхронизация
- Window Manager (3 режима)
- Infinite Canvas с рисованием (9 тулов)
- Canvas routing (порталы)
- Character Sheet (статы, инвентарь, атаки)
- Math Engine (useCalculatedStat)
- Entity Database с drag&drop
- Чат + броски кубов
- Login Screen
- .md файловая система
- Glassmorphism UI

### 🔴 В РАБОТЕ (Этап 1):
- Чиним мультиплеер (y-websocket версии, роли, права)
- start.bat с --host
- Поле имени игрока

### 📋 Дальше (Этапы 2-4):
См. `DEVELOPMENT_PLAN.md`

---

## 8. КЛЮЧЕВЫЕ ДОКУМЕНТЫ

| Документ | Что внутри |
|----------|-----------|
| `MASTER DESIGN DOCUMENT Vibe TTRPG Platform.md` | Полная спецификация проекта от Product Manager'а |
| `FUTURE_DEVELOPMENT_PLAN.md` | Архитектурные решения по мультиплееру и оптимизации |
| `MULTIPLAYER_IMPLEMENTATION_AND_TESTING.md` | Как тестировать мультиплеер с другом |
| `Plan Excalidraw-like.md` | Статус канвас-рисования (Фазы 1-9) |
| `.pi/ARCHITECTURE_ANALYSIS.md` | Разбор проблем масштабирования |
| `.pi/3D_FUTURE_ANALYSIS.md` | План 3D + Tauri + Steam |
| `.pi/DEVELOPMENT_PLAN.md` | Поэтапный план доработок |
| `.pi/skills/vibe-ui-architecture/SKILL.md` | Архитектура UI (читать перед правками интерфейса!) |

---

## 9. ПРАВИЛА ДЛЯ АГЕНТОВ

1. **Перед любой задачей** — прочитай этот файл
2. **Перед правками UI** — прочитай `vibe-ui-architecture/SKILL.md`
3. **Язык UI** — Русский. **Язык кода** — Английский.
4. **Не меняй технологический стек** без явного указания пользователя
5. **Любое удаление** — через `ConfirmDialog` (useUIStore.openConfirm)
6. **Любой drag&drop выбор** — через `DragDropPopover` (не window.confirm)
7. **Контекстные меню** — копируй шаблон из UI Architecture (секция 7)
8. **Новые z-index** — сверяйся с иерархией слоёв (UI Architecture секция 3)
9. **При добавлении файлов** — обнови этот документ
10. **Пиши в .pi/** все аналитические документы
