---
name: entity-system
description: Файловая система сущностей (.md + YAML frontmatter), матрёшка-вложенность, CRUD операции, каскадное переименование
---

## Формат файла сущности
Каждая сущность = .md файл с YAML frontmatter:
- `type` — обязательно (character|object|ability|tag|canvas|portal|note|folder)
- `tags` — массив тегов
- `image` — ID ассета
- `stats` — характеристики (сокращённо: strength: 18 → {base: 18})
- `resources` — HP, мана с current/max
- `properties` — произвольные данные
- Первый H1 в body = имя сущности
- Остальной body = description

## Матрёшка-вложенность
Рядом с .md файлом создаётся папка с тем же именем:
```
Торин Железнобокий.md
Торин Железнобокий/
├── Экскалибур.md
└── Экскалибур/
    └── Рубящая Атака.md
```
`parentId` вычисляется из пути, НЕ хранится в frontmatter.

## Структура мира
```
/world/
├── world.yaml
├── general/          # Имя = ID, дубликаты запрещены
├── users/            # uid = ID, дубликаты разрешены
├── gm/               # Только ГМ
└── assets/           # Медиа
```

## Серверные модули (server/src/)
- `index.ts` — Express API + WebSocket
- `worldManager.ts` — создание/открытие мира
- `fileManager.ts` — CRUD, парсинг YAML, sanitizeFilename (50 chars)
- `fileWatcher.ts` — chokidar, WebSocket broadcast, recentWrites
- `renameManager.ts` — атомарное каскадное переименование

## Клиентские модули (app/src/services/)
- `fileApi.ts` — API клиент, WebSocket, auto-reconnect
- `fileSyncService.ts` — мост Файлы ↔ Yjs, debounced writeback (2 сек)

## API эндпоинты
- POST /api/world/create, /api/world/open
- GET/POST/PUT/DELETE /api/entities
- POST /api/entities/:id/rename
- POST /api/entities/import
- GET /api/assets, POST /api/assets/upload, GET /api/assets/:filename
- WS /ws/watch
