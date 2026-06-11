# Electron Desktop Migration Gate

> Дата: 2026-06-05
> Статус: Electron desktop packaging foundation implemented. Shell, native folder dialog, native asset reveal, embedded packaged server, artifact metadata, player delivery baseline, portable/installer build и smoke-test внесены 2026-06-05/07.

## Решение

Владелец изменил порядок платформенной миграции:

1. Сначала закончить UI foundation: темы, компактность, entity UI, переводы, стабильный визуальный фундамент.
2. После UI сделать миграцию на Electron.
3. После Electron-фундамента вернуться к полноценному режиму заметок и multi-window/multi-monitor workflow.

Это заменяет прежний desktop path как ближайший рабочий путь. Старые Tauri/Rust документы остаются историческим сравнением и материалом для будущего пересмотра, но не являются текущим next step.

## Почему Electron теперь первый desktop path

Проект уже имеет React/Vite frontend и Node/Express/Yjs server. Для Electron это ближе к текущей архитектуре:

- меньше риска переписывать server/file watcher/world manager;
- проще упаковать текущий Node runtime;
- проще контролировать Chromium-поведение canvas, audio, assets и DOM overlays;
- проще сделать desktop multi-window после proof;
- меньше шансов застрять на WebView-отличиях до завершения UI.

Минус Electron - размер приложения и базовое потребление памяти. На текущем этапе это приемлемый tradeoff, потому что главный риск проекта не размер билда, а потеря скорости разработки и стабильности local-first workflow.

## Non-goals первого Electron-среза

- Не переписывать Express/Yjs server.
- Не менять `.md` + YAML frontmatter формат мира.
- Не менять role/permission модель.
- Не переносить бизнес-логику во frontend renderer.
- Не делать полноценный Notes workspace redesign до desktop foundation.
- Не делать multi-window/multi-monitor в первом commit.
- Не добавлять Steam/installer-specific решения до локального desktop proof.

## Предлагаемый порядок

## Реализовано 2026-06-05

- `app/electron/main.cjs`: Electron main window, dev/prod loading, external link guard, single-instance lock.
- `app/electron/preload.cjs`: минимальный typed-safe bridge marker `window.vibeDesktop`.
- `app/package.json`, `app/scripts/desktop-dev.cjs`, `app/scripts/build-server.cjs`: scripts `electron`, `electron:dev`, `desktop:dev`, `desktop:build`, `desktop:start`, `desktop:pack`, `desktop:dist`; `desktop:dev` поднимает Vite, предпочитает `127.0.0.1:5173`, но при недоступном порте выбирает fallback и затем открывает Electron без ручного второго терминала. DevDependencies: `electron`, `cross-env`, `electron-builder`.
- `app/vite.config.ts`: `base: './'`, чтобы production build работал из `file://`.
- `app/electron/main.cjs`: local server lifecycle proof. Electron проверяет `http://localhost:3001/api/world/status`; если сервер не запущен, стартует текущий `server` через `npm run start`, ждёт healthcheck до `VIBE_ELECTRON_SERVER_STARTUP_TIMEOUT_MS` и пытается остановить child process при выходе.
- `app/src/store/yjsStore.ts`, `app/src/store/canvasSyncStore.ts`: `file://`/desktop fallback для WebSocket host теперь `localhost`, если нет сохраненного `vibe_server_ip`.
- `app/electron/main.cjs`, `app/electron/preload.cjs`, `app/src/services/desktopBridge.ts`, `app/src/components/ui/LoginScreen.tsx`: первый безопасный IPC-контракт для desktop-only выбора папки мира. Renderer видит только `window.vibeDesktop.selectWorldFolder()`, а запись/чтение мира по-прежнему идет через существующий server API.
- `server/src/index.ts`: server entry получил явные `startVibeFileServer()`/`stopVibeFileServer()` exports. В dev Electron может стартовать server как `npm run start`, а packaged Electron импортирует `resources/server/dist/index.js` внутрь main process без зависимости от установленного Node/npm.
- `server/package.json`, `server/tsconfig.json`: добавлен `npm run build`, `*.test.ts` исключены из production `server/dist`.
- `app/package.json` `build.extraResources`: packaged app включает `server/dist`, `server/package.json`, `server/node_modules`.
- `.gitignore`: generated `electron-release/` и старый `app/release/` не попадают в git.
- `start-electron-dev.bat`, `build-electron-dist.bat`, `start-electron-built.bat`: корневые Windows launchers для dev Electron, сборки desktop-дистрибутива и запуска собранного exe.
- Проверено: `npm.cmd run desktop:pack`, `npm.cmd run desktop:dist`, packaged exe smoke-test. Собранный exe поднимает `/api/world/status`, а после остановки освобождает порт `3001`.

Ограничение: auto-update, app icon/signing visual polish и installer UX ещё не сделаны. Player delivery baseline зафиксирован в `.pi/docs/electron-player-delivery-policy.md`.

## Performance guardrails для Electron

- Electron DevTools не должны открываться автоматически. В dev-режиме они включаются только явно через `VIBE_ELECTRON_OPEN_DEVTOOLS=1`, потому что detached DevTools могут сильно просаживать canvas и искажать FPS-проверку.
- Camera pan/zoom не должен обновлять React/Zustand на каждый `pointermove`. Konva Stage можно двигать напрямую в hot path, закреплённый DOM-слой окон нужно синхронизировать imperative transform, а store обновлять throttled и обязательно финально при завершении жеста.
- `batchDraw` во время drag/pan нельзя вызывать на каждый `mousemove`; нужно коалесцировать отрисовку через `requestAnimationFrame`, чтобы частота событий мыши не превращалась в частоту полной перерисовки canvas.
- Для middle-button pan предпочтителен compositor-first путь: кадр-в-кадр двигать Konva DOM container через CSS `translate3d`, параллельно двигать pinned layer, а реальную позицию Konva Stage коммитить редко по threshold и обязательно в конце жеста. Это ограничивает тяжёлые canvas redraw кадры.
- DOM transform writes в этом compositor path тоже должны быть RAF-coalesced: `mousemove` только обновляет pending transform, а реальные `style.transform` записи для Stage container и pinned layer идут максимум один раз за animation frame.
- `body.canvas-camera-panning` по умолчанию должен быть мягким состоянием для cursor/user-select и диагностики. Не отключать blur, тени, анимации и pointer-events у всего UI без отдельного замера: это визуально ломает интерфейс и не покрывает элементы, которые находятся вне `.ui-layer`.
- На время middle-button pan можно отключать `pointer-events` у Konva Stage container. После старта жеста движение уже контролируется глобальными `window` listeners, а Stage не должен продолжать гонять Konva hit-testing по canvas-элементам до отпускания кнопки.
- Отключение `backdrop-filter`/`backdrop-blur` у UI overlays оставлять как отдельный performance fallback, если dev overlay и ручная проверка показывают, что именно Chromium compositor на CSS blur создаёт резкие FPS drops.
- При подозрении на desktop-регрессию сначала смотреть dev overlay: FPS, frame ms, dropped frames, heap, число canvas elements и windows. Субъективное "лагуче" фиксировать цифрами до следующей оптимизации.
- В dev runtime доступен синтетический smoke-test камеры: `await window.__vibeRunCameraPerfTest({ durationMs: 3000 })`. Он не заменяет ручной middle-button drag, но помогает быстро ловить грубые регрессии FPS после правок hot path.

## Как запускать

Из корня проекта:

```bat
start-electron-dev.bat
```

Запускает рабочий Electron dev mode: Vite + Electron + local server lifecycle. Это основной режим для разработки.

```bat
build-electron-dist.bat
```

Собирает desktop-дистрибутив в `electron-release/`: unpacked app, portable exe и NSIS installer.

```bat
start-electron-built.bat
```

Запускает уже собранный `electron-release/win-unpacked/Vibe TTRPG Platform.exe`. Перед этим нужно хотя бы один раз выполнить `build-electron-dist.bat`.

Низкоуровневые npm-команды остаются в `app/`:

- `npm.cmd run desktop:dev`
- `npm.cmd run desktop:pack`
- `npm.cmd run desktop:dist`

### Phase 0 - UI freeze gate

Цель: не мигрировать нестабильный интерфейс.

Готово, когда:

- semantic theme tokens применены к основным поверхностям;
- entity windows/cards достаточно стабильны;
- Settings/AssetBrowser/AudioDesk не имеют крупных hardcoded style pockets;
- compact character card contract зафиксирован;
- custom locales/world themes имеют хотя бы design-doc или минимальный понятный формат.

### Phase 1 - Electron shell prototype

Цель: открыть текущий Vite build в Electron без runtime rewrite.

Статус: local proof внесён.

Срез:

- отдельная prototype branch;
- добавить Electron main/preload scaffolding;
- renderer грузит существующий frontend build;
- dev mode сохраняет текущий browser-first запуск;
- browser runtime остается рабочим rollback path.

Acceptance:

- приложение открывается в Electron window;
- canvas, entity windows, settings и asset previews работают как в браузере;
- обычный `npm run build` для app не ломается;
- Electron-only API не просачивается в обычный browser runtime.

### Phase 2 - Server lifecycle proof

Цель: Electron управляет текущим server как локальным процессом или bundled Node entry.

Статус: dev workspace использует `npm run start` в `server/`; packaged app импортирует compiled server из `resources/server/dist/index.js` внутри Electron main process. После старта Electron ждёт healthcheck и показывает понятную ошибку, если `3001` не поднялся.

Срез:

- старт/остановка server из Electron main process;
- порт `3001` или динамический порт фиксируется в runtime config;
- корректное завершение процесса при закрытии приложения;
- ошибки запуска сервера показываются в понятном UI.

Acceptance:

- хост может открыть мир в desktop app;
- player browser clients могут подключиться к host IP как раньше;
- закрытие desktop app освобождает порт;
- dev/browser режим не зависит от Electron.

### Phase 3 - Desktop file access polish

Цель: улучшить локальный UX без изменения source of truth.

Статус: первый native folder dialog для открытия/создания мира внесён. Packaging path собран через `electron-builder`. Asset reveal через Electron shell добавлен с allowlist по текущему world/assets. Build artifact names и NSIS installer UX настроены; иконка пока default Electron icon и требует отдельного визуального среза.

Срез:

- native folder/file dialogs для открытия мира и asset actions;
- show-in-explorer через Electron shell;
- аккуратный allowlist для путей мира/assets;
- explicit permission boundaries между renderer и main.

Acceptance:

- renderer не получает произвольный доступ к файловой системе;
- вся запись entity/world файлов остается через существующий server/file manager;
- asset browser и audio deck продолжают работать по текущему API.

### Phase 3.5 - Player delivery baseline

Статус: baseline принят и записан в `.pi/docs/electron-player-delivery-policy.md`.

- Electron app сейчас предназначен для хоста/ГМа.
- Игроки остаются browser-first и подключаются к host IP без установки.
- Windows builds пока unsigned; SmartScreen warnings ожидаемы до отдельного signing решения.
- Отдельный player desktop client требует будущий product gate.

### Phase 4 - Desktop windows, then Notes mode

Цель: только после desktop foundation вернуться к полноценным рабочим пространствам.

Порядок:

1. Проверить Electron `BrowserWindow`/window state для дополнительных локальных окон.
2. Спроектировать multi-monitor поведение как local-only user workspace.
3. После этого углублять Notes workspace: tabs/splits/editor ergonomics, multi-window views, Obsidian-like workflow.

Важно: текущий Notes workspace foundation можно сохранять и чинить, но не превращать его в большую продуктовую ветку до Electron proof.

## Технические границы

- Frontend остается React/Vite.
- Server остается Node/Express/Yjs на первом desktop path.
- Electron main process отвечает за desktop lifecycle, native dialogs, process control и безопасный bridge.
- Renderer не должен напрямую читать/писать world files.
- Все Electron APIs проходят через минимальный typed preload bridge.
- Browser-first mode сохраняется как обязательный rollback path для игроков и разработки.

## Риски

| Риск | Почему важно | Митигировать |
|------|--------------|--------------|
| Больший runtime | Electron тяжелее Tauri/WebView | Не оптимизировать раньше proof; сначала проверить UX и стабильность |
| Main/renderer security | Renderer нельзя давать полный Node access | `contextIsolation`, typed preload bridge, запрет произвольных IPC команд |
| Server lifecycle | Нужно не оставлять висящий `3001` | Явный start/stop, healthcheck, cleanup on exit |
| Player delivery | Игрокам по-прежнему нужен browser URL | Не ломать текущий host server/browser client path |
| UI instability | Миграция усилит цену UI-переделок | Делать Electron только после UI foundation |

## Проверки первого прототипа

- Открыть Electron app.
- Создать/открыть тестовый мир.
- Проверить `/api/world/status`, `/api/assets/index`, `/api/entities`.
- Проверить canvas pan/zoom, middle-button pan, GIF/image/video preview.
- Открыть entity window, compact character card, Settings, AssetBrowser, AudioDesk.
- Подключить player browser client к host IP.
- Закрыть Electron app и проверить, что server process остановлен.

## Rollback

Electron path должен быть optional:

- удаление Electron scaffold не ломает app/server;
- `start.bat`, ручной browser dev и current Vite build остаются рабочими;
- world files не получают Electron-only поля;
- обычный browser client не импортирует Electron modules.
