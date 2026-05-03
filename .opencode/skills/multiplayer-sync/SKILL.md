---
name: multiplayer-sync
description: Yjs CRDT синхронизация, y-websocket, топология звезда, debouncing, tombstone cleanup, awareness protocol
---

## Архитектура
- Хост поднимает Express + WebSocket сервер (порт 3001)
- Игроки подключаются по LAN IP к хосту
- Топология "Звезда" — избегаем O(N²) P2P соединений
- Local-First: ГМ может создать мир офлайн, потом поднять сервер

## Yjs организация
- Раздельные Y.Docs (Subdocuments): каждый канвас = отдельная комната
- Y.Map для сущностей, Y.Array для чата
- Yjs Awareness Protocol для эфемерных данных (курсоры, указка)
- Throttling ~30fps для курсоров

## Синхронизация Файлы ↔ Yjs
1. Хост загружает файлы → парсит → заполняет Yjs
2. Игроки получают данные через y-websocket
3. Изменения через Yjs → debounced writeback (2 сек) → файлы на хосте
4. Внешние изменения (Obsidian) → chokidar → WebSocket → Yjs → все игроки

## Защита от проблем
- `recentWrites` Set — защита от sync loops
- `_isLoading` flag — не писать во время загрузки
- Tombstone cleanup: раз в сессию — переинициализация Yjs из файловой системы
- Batching частых событий (Drag-n-Drop)

## Клиентские сервисы
- `fileApi.ts` — API клиент с isHost проверкой, auto-reconnect
- `fileSyncService.ts` — мост Файлы ↔ Yjs, debounced writeback

## IndexedDB
- y-indexeddb = кэш для быстрого старта
- НЕ источник истины (источник = файлы на диске)

## Мультиплеер UI
- LoginScreen: Выбор роли → Выбор мира → Имя комнаты → Старт
- Хост: запускает файловый сервер
- Игроки: подключаются к хосту, получают данные через Yjs
