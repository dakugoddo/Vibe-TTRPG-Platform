# Vibe TTRPG Platform: bug backlog

> Дата обновления: 2026-05-21  
> Назначение: единая очередь багов для triage, приоритизации и batching по модулям.

## Приоритеты

- `P0` — потеря данных, приложение не запускается, критичная поломка сохранения/синхронизации.
- `P1` — сломан основной игровой сценарий, права доступа, GM-only приватность или мультиплеер.
- `P2` — важная функция не работает, но есть обходной путь; чинить ближайшим тематическим срезом.
- `P3` — полировка, UX-неудобство, визуальный дефект, низкий риск.

## Правило обработки

- [x] Сначала triage: записать баг, модуль, приоритет, batch key и ожидаемый момент исправления.
- [x] `P0/P1` чинить немедленно или перед продолжением новой разработки.
- [x] `P2/P3` группировать по модулю и чинить пачкой, если нет причины повышать приоритет.
- [x] После исправления обновлять этот файл, `.pi/DEVELOPMENT_PLAN.md` и релевантный QA-документ.

## Активные баги

| ID | Priority | Module | Batch key | Status | Reported | Симптом | План |
|----|----------|--------|-----------|--------|----------|---------|------|
| `BUG-CANVAS-001` | `P2` | CanvasModule | `Canvas selection tools` | Fixed, manual QA pending | 2026-05-20 | Инструмент lasso в панели управления не работает. | Кодовый фикс внесён в `InfiniteCanvas`: lasso стартует поверх элементов, а selection сохраняется после переключения в select. |

### План для `BUG-CANVAS-001`

- [x] Найти владельца lasso tool: toolbar button, active tool state, canvas pointer handlers.
- [x] Проверить, что lasso выбирает элементы в координатах canvas, а не screen-space.
- [x] Проверить совместимость с текущим local-preview подходом: selection preview локальный, итог selection state не пишет лишнего в Yjs persistence.
- [x] Проверить, что lasso не конфликтует с drag/select/fog edit modes.
- [x] После фикса добавить ручной QA шаг в `.pi/docs/testing-multiplayer.md`.

### Исправление `BUG-CANVAS-001`

- Дата фикса: 2026-05-21.
- Причина: lasso выделял элементы, но затем `setTool('select')` очищал selection; дополнительно lasso не стартовал при mousedown поверх существующего draw element.
- Изменение: lasso pointer-down вынесен до empty-stage guard, а порядок сохранения selection изменён на `setTool('select')` → `selectElements(...)`.
- Сопутствующее: тот же порядок поправлен для `Ctrl+A`, image insert/drop и frame creation, чтобы новый selection не стирался при переключении в select.
- Проверка: `npm.cmd exec tsc -- --noEmit` в `app`; ручной UI QA нужен по `.pi/docs/testing-multiplayer.md`, тест №10, шаг 19.

## Проверенные вручную сценарии

| Scenario | Status | Verified | Notes |
|----------|--------|----------|-------|
| Multiplayer через Radmin/Hamachi | Passed | 2026-05-20 | Подключение с другого компьютера работает. |
| Awareness cursors | Passed | 2026-05-20 | Клиенты видят мышки друг друга. |
| Canvas object movement sync | Passed | 2026-05-20 | Перемещение объекта появляется на другом компьютере после отпускания объекта; такое поведение принято. |
