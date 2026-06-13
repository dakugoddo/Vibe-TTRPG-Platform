# Vibe TTRPG Platform: bug backlog

> Обновлено: 2026-06-07
> Назначение: активные баги, QA-pending фиксы и regression notes. Закрытая история не хранится здесь, чтобы не засорять контекст.

## Приоритеты

- `P0` — потеря данных, приложение не запускается, критичная поломка сохранения/синхронизации.
- `P1` — сломан основной игровой сценарий, права доступа, GM-only приватность или мультиплеер.
- `P2` — важная функция работает нестабильно, но есть обходной путь.
- `P3` — полировка, UX-дефект, визуальная проблема, низкий риск.

## Активные баги и проверки

| ID | Priority | Module | Status | Суть | Следующий шаг |
|----|----------|--------|--------|------|---------------|
| `BUG-ELECTRON-002` | `P1` | Electron Desktop / CanvasModule | Fixed, owner QA pending | Agent-induced regression: Electron dev проседал при middle-button pan и открытии entity windows. | Owner QA на тестовом мире. DevTools остаётся opt-in через `VIBE_ELECTRON_OPEN_DEVTOOLS=1`; dev perf overlay остаётся доступным в dev build. |
| `BUG-ELECTRON-003` | `P1` | Electron Desktop / Dev Launcher | Fixed, owner QA pending | Agent-induced regression: `desktop:dev` жёстко стартовал Vite на `127.0.0.1:5173`, а потом Windows падал на `spawn EINVAL` при запуске через `npm.cmd` из Node. | Проверить `start-electron-dev.bat`: если `5173` недоступен, скрипт должен выбрать следующий свободный порт, стартовать Vite через Node entrypoint и передать URL в Electron. |
| `BUG-CANVAS-009` | `P2` | CanvasModule | Fixed, owner QA pending | Agent-induced follow-up: попытка убрать edge clipping через Stage overscan просадила FPS до ~10. | Stage должен оставаться viewport-sized. Если clipping вернётся, сначала профилировать commit rate/FPS, а не увеличивать Stage. |
| `BUG-MULTIPLAYER-001` | `P1` | SessionModule / CanvasModule | Mitigation added, manual QA required | Radmin/Hamachi лаги и oversized Yjs payload risk. | Ручная GM/player проверка через IP: сервер не падает, sync завершается, cursors responsive. |
| `BUG-ASSETS-006` | `P1` | Asset Library / AudioModule / CanvasModule | Fixed, verification pending | Preview/audio ранее расходились между `/api/assets/<file>` и `/api/assets/file?path=...`. | Проверить image/video/audio previews на host и player origin. |
| `BUG-CANVAS-007` | `P2` | CanvasModule | Fixed, verification pending | Fog texture zero-size мог давать `drawImage InvalidStateError`. | Проверить запуск тестового мира без console spam. |
| `BUG-CANVAS-006B` | `P2` | CanvasModule / Asset Library | Fixed, manual QA pending | GIF на canvas переведены на DOM overlay вместо Konva redraw. | Проверить animated GIF selection/drag/playback. |
| `BUG-NOTES-001` | `P2` | NotesWorkspace / EntityDatabase | Fixed, owner QA pending | Notes mode panes/splits были неинтуитивны: не было закрытия pane, drag выделял текст, split-down мог выглядеть неполным, EntityDatabase по клику то раскрывал, то открывал окно. | Проверить single-click open/focus, раскрытие только стрелкой, split down на всю высоту, drag/drop pane zones и встроенные notifications. |
| `BUG-NOTES-002` | `P2` | NotesWorkspace / Theme System | Fixed, owner QA pending | Agent-induced follow-up: central editor wrapper duplicated pane headers, pane drag was blocked by `preventDefault`, vault row hit area did not match visual row, Universal Glass notes shell lost rounded glass corners, Arcane Control radii were too round. | Проверить pane/tab drag, full-row vault clicks, отсутствие внешней шапки `Редактор`, округленный Universal Glass и более квадратный Arcane Control. |
| `BUG-NOTES-003` | `P2` | NotesWorkspace / DnD | Fixed, owner QA pending | Agent-induced regression: HTML drag fallback accepted arbitrary `text/plain`/image drags, drop preview could hang, moving the last tab out of a pane left an empty pane, and shell modules were not movable between left/center/right areas. | Проверить: pane/header drag не создает пустые panes; drag выделенного текста/картинок не показывает workspace preview; Vault/Search/Context/Graph/Notifications/Audio переносятся между left/center/right. |
| `BUG-I18N-003` | `P2` | Localization / Settings | Fixed, owner QA pending | English locale did not cover stable Settings/Notes shell UI enough; user also needed a desktop button to open translation files. | Проверить English mode: Settings tabs/sections, Notes storage names/module labels/search fields are English; Electron button opens built-in locales folder. |

## Regression notes

- `BUG-ELECTRON-002`: не открывать DevTools автоматически в Electron dev; это искажает perf-ощущение. Для camera pan использовать compositor-first preview и редкие Konva commits.
- `BUG-ELECTRON-003`: не хардкодить Vite dev URL в Electron launcher. `5173` является preferred port, но `app/scripts/desktop-dev.cjs` должен заранее проверять возможность listen, выбирать fallback-порт и передавать фактический `VIBE_ELECTRON_DEV_SERVER_URL` в Electron. Не запускать Vite/Electron/server через `npm.cmd` из Node launcher; использовать прямые Node entrypoints (`vite/bin/vite.js`, `electron/cli.js`, `tsx/dist/cli.mjs`) и передавать `VIBE_NODE_EXEC_PATH` в Electron main.
- `BUG-CANVAS-009`: не расширять Konva Stage ради “запаса рендера” без измерений. Увеличение canvas-площади напрямую бьёт по FPS.
- `BUG-UI-006`: compact character card не является настройкой полей в entity window. Это canvas-card представление всей доступной информации персонажа в компактном read-only виде.
- `BUG-NOTES-002`: в draggable NotesWorkspace headers/tabs не ставить `preventDefault()` на `mousedown`, иначе браузер может не запустить native drag. Для дерева сущностей row click должен покрывать всю визуальную строку, а раскрытие детей должно быть только на chevron. Радиусы notes shell/panes должны идти через `--vibe-radius-*`, чтобы темы реально меняли форму интерфейса.
- `BUG-NOTES-003`: NotesWorkspace pane DnD must be gated by the internal MIME `application/vnd.vibe-notes-workspace-tab`; never fall back to `text/plain`, otherwise selected text/images can trigger stale drop previews. Moving/splitting the last tab out of a pane must collapse the empty source group. Shell module moves should use pointer-driven module headers and `notesWorkspaceStore.moveShellModule()`, not browser HTML DnD.
- `BUG-I18N-003`: stable application chrome belongs in `ru/en.json`; entity names/descriptions/properties are user/world content and must not be translated at render time. Desktop-only folder buttons must go through the typed Electron preload bridge.
- Для agent-induced regression всегда обновлять релевантный `.pi/rules/*`, `.pi/docs/*` или `.pi/skills/*/SKILL.md`, а не только точечно фиксить код.

## Ручные QA сценарии

| Scenario | Status | Notes |
|----------|--------|-------|
| Electron middle-button pan на test-world | Pending owner QA | Проверять FPS dev overlay и визуальные рывки. |
| Electron dev launcher fallback port | Pending owner QA | Запустить `start-electron-dev.bat`; при недоступном `5173` должен появиться warning про fallback URL, после чего Electron открывает приложение. |
| Packaged Electron smoke | Pending | App запускает embedded server, `/api/world/status` отвечает, порт освобождается после закрытия. |
| Assets preview/audio/video | Pending | Проверить host/player origin и пути с пробелами/кириллицей. |
| Multiplayer через Radmin/Hamachi | Pending | Проверить sync, cursors, отсутствие crash на больших мирах. |
| GIF canvas overlay | Pending | Проверить playback, drag, selection, resize. |
| Notes workspace panes and entity clicks | Pending owner QA | Проверить single-click entity open/focus в canvas/notes, стрелку раскрытия, группировку vault, split down, pane drag/drop и close pane. |
| Notes workspace module drag and i18n | Pending owner QA | Проверить module header drag между left/center/right, отсутствие preview при drag текста/картинок, English Settings/Notes labels и кнопку открытия `app/src/locales`. |
