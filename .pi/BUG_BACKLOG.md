# Vibe TTRPG Platform: bug backlog

> Дата обновления: 2026-05-31
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
| `BUG-CANVAS-002` | `P2` | CanvasModule | `Canvas history + line tools` | Fixed, manual QA pending | 2026-05-21 | Траектории/пути объектов типа line на canvas работают некорректно. | Кодовый фикс: snap/bounds для line drag теперь считаются по сдвинутым точкам, а не по старому bbox. |
| `BUG-CANVAS-003` | `P2` | CanvasModule | `Canvas history + line tools` | Fixed, manual QA pending | 2026-05-21 | `Ctrl+Z` и `Ctrl+Shift+Z`/redo для canvas editing не работают, хотя контур уже есть. | Кодовый фикс: `Y.UndoManager` переведён на явные local origins, canvas подписан на `elements`, добавлены UI-кнопки undo/redo. |
| `BUG-CANVAS-004` | `P2` | CanvasModule | `Canvas line editing` | Fixed, manual QA pending | 2026-05-22 | Двойной клик по сегменту line добавляет точку, но двойной клик по самой точке не удаляет её. | Кодовый фикс усилен: line point insert/delete вынесен в tested helpers; double-click рядом с внутренней точкой удаляет её даже если событие попало в line group, endpoints не удаляются, undo snapshot сохраняется. |
| `BUG-CANVAS-005` | `P3` | CanvasModule | `Canvas delete UX` | Fixed, manual QA pending | 2026-05-24 | После появления `Ctrl+Z` удаление обычных объектов canvas не должно требовать подтверждения; подтверждение нужно оставить только для карточек/фишек сущностей. | Кодовый фикс: Delete/Backspace удаляет обычные draw elements сразу через undo-able canvas mutation; если в выделении есть `entityToken`, используется `ConfirmDialog` перед удалением всего выделения. |
| `BUG-CHAT-001` | `P2` | RightDrawer / ChatPanel | `Right drawer chat` | Fixed, manual QA pending | 2026-05-21 | Чат/броски/события визуально уходят низом за рамку браузера; вкладки должны открываться снизу; нужна кнопка перехода к последним сообщениям. | Кодовый фикс: right drawer получил `min-h-0`, вкладки скроллятся к последнему элементу, добавлена кнопка jump-to-latest. |
| `BUG-UI-001` | `P3` | UI | `Design system polish` | Partially fixed, broader UI pass planned | 2026-05-21 | Кнопка `Импорт .md`, стандартный scrollbar и пропадающий плюс создания выбиваются из дизайна; в окнах сущностей много вкладок. | Импорт приведён к теме, `no-scrollbar` реализован, create plus виден постоянно; `SheetTabs` получил горизонтальный wheel-scroll и стрелки при переполнении без нативной толстой полосы. Полный redesign описан в `.pi/docs/ui-redesign-direction.md`. |
| `BUG-UI-002` | `P3` | CanvasToolbar | `Canvas style controls` | Fixed, manual QA pending | 2026-05-22 | В настройках rectangle/ellipse дублируются semi-transparent fill swatches и отдельная кнопка пустой заливки при наличии opacity controls; проценты прозрачности нельзя ввести руками. | Кодовый фикс: fill palette упрощена до одной solid-палитры, opacity проценты стали number inputs рядом со sliders. |
| `BUG-ASSETS-001` | `P2` | Asset Library / CanvasModule | `Canvas image assets` | Fixed, manual QA pending | 2026-05-22 | Картинки, добавленные прямо на canvas, не появляются в браузере файлов и не доступны в выборе фото сущности. | Новые картинки из image tool/drop Host загружает в `assets/` и сохраняет `imageAssetPath`; старые inline `data:` canvas images можно перенести в `assets/` из вкладки `Файлы`. |
| `BUG-ASSETS-002` | `P2` | Asset upload | `Entity image upload` | Fixed, manual QA pending | 2026-05-22 | Загрузка изображения для превью сущности падает `Payload Too Large`. | Добавлен бинарный upload endpoint `/api/assets/upload-binary` с лимитом `250mb`; `EntityImageBlock`, canvas image upload и вкладка `Файлы` отправляют файлы бинарно без base64/JSON. Старый `/api/assets/upload` оставлен для миграции inline `data:` canvas images. |
| `BUG-ASSETS-004` | `P1` | CanvasModule / Asset upload / Notifications | `Canvas drag/drop upload` | Fixed, manual QA pending | 2026-05-29 | Drag/drop image file onto canvas left a permanent loading/hourglass area and did not show upload/approval notifications. | Canvas file drop now uploads through binary asset API before inserting the draw element, shows local progress for every image upload, sends player -> GM approval for files over `50 MB`, mirrors approved upload progress through session notifications, and logs upload/insert failures with file/canvas context. Inline fallback is no longer silently written to canvas. |
| `BUG-ASSETS-005` | `P1` | Asset Library / AudioModule | `Asset index API` | Fixed, smoke QA passed | 2026-05-31 | Тестовый мир не показывает файлы во вкладке `Файлы` и в интерфейсе плеера. | Причина: клиентские `AssetBrowser` и `AudioDesk` вызывают `/api/assets/index`, но server route отсутствовал. Восстановлен recursive asset index endpoint и guarded routes для delete/show-in-explorer; smoke на `test-world`: `/api/assets/index` вернул 14 assets, из них 10 images и 4 audio, `/api/assets/file` для MP3 вернул `200`. |
| `BUG-ASSETS-006` | `P1` | Asset Library / AudioModule / CanvasModule | `Asset URL resolution` | Fixed, verification pending | 2026-05-31 | После восстановления индекса файлы видны, но preview и аудио не грузятся; плеер пишет `Не удалось воспроизвести`, а часть UI ходит по старому `/api/assets/<file>`. | Клиентский `getAssetUrl` переведён на стабильный `/api/assets/file?path=...`, нормализует relative API URLs из индекса, legacy `/api/assets/<file>` и host IP для player-клиентов. `listAssetRecords` теперь отдаёт потребителям абсолютный URL file-server, чтобы `<img>`, `<video>` и `AudioDesk` не били в Vite origin. |
| `BUG-CANVAS-007` | `P2` | CanvasModule | `Fog texture zero-size` | Fixed, verification pending | 2026-05-31 | При открытии мира в консоль сыпется `InvalidStateError: drawImage ... canvas element with a width or height of 0`. | Добавлен guard в `FogOfWarLayer`: пока Stage/texture не имеют положительных размеров, Konva Image для fog canvas не рендерится. Это защищает стартовый render и resize от zero-size offscreen canvas. |
| `BUG-ASSETS-003` | `P3` | Asset Browser | `Asset path copy` | Fixed, manual QA pending | 2026-05-22 | Кнопка копирования в браузере файлов копирует internal asset path/имя, а ожидается путь файла в проводнике. | Добавлен `/api/assets/fs-path`; UI копирует абсолютный путь файла на host-диске с fallback на internal asset path. |
| `BUG-DEV-001` | `P3` | Server runtime | `Dev ergonomics` | Fixed | 2026-05-22 | При повторном запуске сервера порт `3001` занят, Node падает сырым stack trace `EADDRINUSE`. | Сервер теперь обрабатывает `EADDRINUSE` и печатает понятное сообщение, что уже запущен другой процесс на `3001`. |
| `BUG-EXPLORER-001` | `P2` | File system | `Explorer integration` | Fixed, manual QA pending | 2026-05-23 | `Показать в проводнике` на сущности открывает `Документы`, а не выделяет `.md` файл сущности. | Кодовый фикс: аргументы `explorer.exe` разделены на `['/select,', filePath]`; добавлен маленький server test для Windows reveal args. |
| `BUG-CANVAS-TOKENS-001` | `P2` | CanvasModule | `Entity tokens and art` | Fixed, manual QA pending | 2026-05-23 | Art representation растягивает горизонтальные изображения по вертикали; `i` на art показывает описание отдельным popup. | Кодовый фикс: art вставляется и ресайзится с сохранением aspect ratio, изображение рендерится без растяжения, `i` на art открывает overlay поверх самого арта. |
| `BUG-CANVAS-TOKENS-002` | `P2` | CanvasModule | `Entity tokens and art` | Fixed, manual QA pending | 2026-05-24 | В UI нужно называть art-режим `Карточка`; в toolbar были кракозябры, обводка карточки не учитывала прозрачность/стиль, а переключение `Фишка -> Карточка` снова делало карточку горизонтальной. | Кодовый фикс: видимые подписи заменены на `Карточка`, toolbar переключает режим через aspect-ratio размер linked image без жесткого `220x150`, stroke opacity/style применяются к рамке карточки, `i` перенесён в правый нижний угол. |
| `BUG-ENTITY-DROP-001` | `P1` | EntityDatabase / CanvasModule | `Entity drag and drop routing` | Fixed, manual QA pending | 2026-05-24 | Старое меню `Перенести/Копировать` при drop на окно сущности может применяться к canvas за окном и переносить/копировать сущность не туда. | Guard против canvas-route поверх UI сохранён; `entityDropRouter` управляет canvas, database tree, inventory, attacks, abilities, competencies и tag drops; `DragDropPopover` стал единым portal action menu. Move доступен только GM, `attack -> character` запрещён матрицей. |
| `BUG-CANVAS-006` | `P2` | CanvasModule / Asset Library | `Animated image assets` | Fixed, manual QA pending | 2026-05-27 | GIF-файлы на canvas отображаются статичной первой картинкой; тестовый `giphy.gif` не проигрывается. | Кодовый фикс: `ImageNode` определяет `.gif`/`data:image/gif` sources и перерисовывает Konva layer через `requestAnimationFrame`, чтобы браузерный animated image отдавал текущий frame. Добавлен focused test для source detection; нужен ручной QA на `giphy.gif`. |
| `BUG-AUDIO-001` | `P1` | AudioModule | `Persistent audio playback` | Fixed, manual QA pending | 2026-05-25 | Музыка останавливается при переключении с вкладки музыки на дайсы/чат/другую вкладку. | Кодовый срез: `AudioDesk` вынесен из вкладки правой шторки в отдельный корневой `AudioControlDock`, поэтому UI-переключение базы/чата больше не размонтирует playback. Требуется ручная QA длинного music/ambience трека. |
| `BUG-AUDIO-002` | `P2` | AudioModule / Asset Browser | `Audio UX placement` | Partially fixed, product redesign planned | 2026-05-25 | Управление музыкой оказалось одновременно во вкладке `Файлы` и отдельной вкладке `Звук`, хотя ожидается отдельная менюшка/модуль. | Вкладка `Звук` убрана из RightDrawer; `Файлы` возвращены к роли asset library без play/queue/playlist controls. Полный нижний плеер + микшер требует design approval по `FEAT-AUDIO-003`. |
| `BUG-AUDIO-003` | `P2` | AudioModule | `Mixer live volume` | Fixed, owner QA passed | 2026-05-25 | Ползунки микшера двигаются, но громкость уже играющих звуков не меняется. | Кодовый фикс: `audioPlayback` handles подписаны на изменение channel volume и пересчитывают effective volume для активного media/Web Audio playback; добавлен focused test. Владелец подтвердил 2026-05-26, что громкость меняется. |
| `BUG-UI-003` | `P3` | App Shell / Notifications | `Floating UI placement` | Fixed, manual QA pending | 2026-05-28 | Кнопка уведомлений перекрывает личный инвентарь/левую шторку. | `NotificationCenter` перенесён в верхний центр экрана; popup центрируется и больше не занимает левый край. |
| `BUG-UI-004` | `P2` | App Shell / Notifications | `Floating UI placement` | Fixed, manual QA pending | 2026-05-28 | Кнопка уведомлений в верхнем центре перекрывает canvas toolbar. | `NotificationCenter` перенесён в правый верхний безопасный слот (`right: 96px`) с popup, открывающимся вправо/влево от кнопки, чтобы не закрывать top-center toolbar. |
| `BUG-UI-005` | `P2` | App Shell / Notifications | `Floating UI placement` | Fixed, manual QA pending | 2026-05-29 | Кнопка уведомлений всё ещё мешает в свободных углах экрана; нужно держать её сверху справа относительно панели инструментов canvas. | `NotificationCenter` закреплён рядом с правым краем верхнего canvas toolbar (`left: calc(50% + 340px)` на широких экранах) с fallback к правому краю на узких viewport. |
| `BUG-MULTIPLAYER-001` | `P1` | SessionModule / CanvasModule | `Multiplayer latency` | Mitigation added, manual QA required | 2026-05-28 | При подключении к себе через IP и у друга появилась сильная задержка мультиплеера. | Немедленный mitigation: cursor awareness throttled до ~20 updates/sec; player-upload session progress throttled до max 2 updates/sec или >=2% delta, чтобы не забивать общий Yjs/WebSocket канал; resolved session notifications bounded/TTL-pruned by GM/Host. Нужна ручная GM/player проверка через IP/Radmin/Hamachi; если лаг останется, следующий шаг - profiling Yjs doc size, asset streaming saturation и canvas awareness RTT. |
| `BUG-AUDIO-004` | `P3` | AudioModule | `Compact dock UX` | Fixed, manual QA pending | 2026-05-28 | Мини-режим плеера выглядит как полноценная панель, а должен быть полупрозрачным шариком. | `AudioControlDock` теперь в compact состоянии рендерит только круглую кнопку; expanded mode открывается по клику и имеет отдельную кнопку сворачивания. |
| `BUG-AUDIO-005` | `P2` | AudioModule / Player client | `Audio opt-out lifecycle` | Fixed, manual QA pending | 2026-05-28 | Игрок может выключить session audio, но уже играющая музыка продолжает звучать. | `AudioSessionBridge` останавливает все локальные playback handles при отключении opt-in; повторное включение может принять последнюю активную команду. |
| `BUG-AUDIO-006` | `P2` | AudioModule | `Ambience multi-loop` | Fixed, manual QA pending | 2026-05-28 | Канал `Атмосфера` должен запускать несколько loop-треков одновременно, но работал как один слот. | `AudioDesk` и player-side bridge получили отдельные handles для ambience assets/cues; channel stop по-прежнему гасит весь ambience. |
| `BUG-AUDIO-007` | `P3` | AudioModule | `Fade preset labels` | Fixed, manual QA pending | 2026-05-28 | Непонятно, что означают `0s/1s/3s` в музыкальном доке. | Добавлена явная подпись/tooltip: это fade in/out presets для запуска и остановки звука. |
| `BUG-CANVAS-006B` | `P2` | CanvasModule / Asset Library | `Animated image assets` | Fixed, manual QA pending | 2026-05-28 | Предыдущий Konva redraw fix не оживил `giphy.gif` на canvas. | Animated GIF теперь рендерится как DOM `<img>` overlay через `react-konva-utils/Html`, а прозрачный Konva hit rect сохраняет selection/drag. |

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
| Audio mixer live volume | Passed | 2026-05-26 | Владелец подтвердил, что изменение громкости в микшере влияет на звук. |

### Update for `BUG-MULTIPLAYER-001` (2026-05-29)

- Confirmed concrete failure from owner log: remote Radmin/IP client can trigger `WS_ERR_UNSUPPORTED_MESSAGE_LENGTH` / close code `1009` during Yjs world/canvas sync, which previously crashed the Node server.
- Added server-side WebSocket error handlers and bounded `maxPayload` for watch/Yjs sockets so an oversized sync packet closes that client connection instead of killing the server process.
- Versioned Yjs IndexedDB persistence keys (`v2-no-inline-canvas-payloads`) for world and canvas docs to avoid replaying stale browser cache updates that may still contain old inline/base64 canvas image payloads.
- Canvas shared sync now strips heavy `data:image` values from draw elements before writing to Yjs/shared canvas snapshots; asset-backed images keep `imageAssetPath` only.
- File writeback now skips identical entity saves and only calls `rename-path` when the title changed, reducing startup `GET/PUT/rename-path` storms.
- Follow-up after owner retest log: `root` still produced repeated `GET/PUT`, so canvas draw elements now use stable `zIndex/id` ordering before persistence/signature comparison, and `saveEntity` skips `PUT` when server file content is equivalent.
- Player navigation follow-up corrected after owner retest: plain mouse wheel zooms around the pointer, and canvas pan is done by holding the middle mouse button. This keeps read-only/player clients able to move around the canvas without edit permissions while preserving expected wheel zoom.
- Asset loading follow-up: Asset Browser no longer probes audio durations for every file-list open; audio metadata is fetched only in the `audio` filter and capped to the visible first batch, reducing MP3 GET bursts over Radmin/Hamachi.
- Manual QA still required through Radmin/Hamachi: server must not crash, first sync should finish without multi-second UI stalls, cursors should remain responsive, and entity rename validation spam should drop sharply.
