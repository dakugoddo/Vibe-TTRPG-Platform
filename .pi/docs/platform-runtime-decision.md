# Platform Runtime Decision

> Дата: 2026-05-21
> Статус: decision draft. Не начинать миграцию без отдельного прототипа.

> Обновление 2026-06-04: актуальный gate перед Tauri-кодом вынесен в `.pi/docs/tauri-native-migration-plan.md`. Этот документ остаётся историческим сравнением runtime-вариантов; рабочий порядок миграции теперь читать там.

## Вопрос

Нужно ли переносить Vibe TTRPG Platform на Tauri + Rust, Electron, Neutralino или игровой движок ради будущего Steam-релиза, встроенного сервера, файлового доступа и потенциального 3D?

## Короткий вывод

Сейчас фундамент переписывать не нужно.

Текущий React + TypeScript + Vite + Express + Yjs стек остается основной базой разработки. Самый выгодный путь - сохранить browser-first приложение и позже проверить Tauri как тонкую desktop-оболочку с bundled sidecar, а не как немедленную перепись сервера на Rust.

Минимальный следующий runtime-прототип:

1. Собрать production frontend через `vite build`.
2. Запустить существующий Express/WebSocket сервер как bundled sidecar.
3. Открыть локальный URL внутри Tauri WebView.
4. Проверить file access, world folder picker, websocket multiplayer, shutdown sidecar, portable build.

Если этот прототип пройдет, можно думать о Rust-sidecar или частичном Rust core. Если нет - Electron остается более тяжелым, но более прямым fallback для уже существующего Node/Express приложения.

## Почему не переписывать сейчас

- Основная ценность проекта сейчас в Entity-модели, `.md` source of truth, Roll Engine, canvas, permissions и GM workflow, а не в desktop shell.
- Tauri/Rust rewrite затронет file manager, world manager, websocket lifecycle, watcher, permissions и packaging одновременно. Это высокий риск для фундамента, который еще активно стабилизируется.
- Steam-релиз требует не только оболочку, но и отдельные вопросы: Workshop packaging, Cloud paths, Steam Networking/lobbies, app ID, SDK, деплой, обновления, тестовые аккаунты.
- Простое 3D можно проверять внутри текущего React-приложения через Three.js/Babylon.js, без смены runtime.

## Альтернативы

| Вариант | Выгода | Риск | Рекомендация |
|---------|--------|------|--------------|
| Browser-first + `start.bat`/launcher | Минимальный риск, текущая разработка быстрая, игрокам уже достаточно браузера | Не выглядит как Steam desktop app, ручной запуск сервера | Оставить основной путь до стабильного vertical slice |
| Tauri shell + Node/Express sidecar | Малый desktop bundle, можно использовать текущий frontend/server почти без переписи | Sidecar lifecycle, installer quirks, WebView различия по ОС | Лучший первый desktop-прототип |
| Tauri shell + Rust backend | Малый runtime, сильный file/process control, потенциально чище для Steam | Большая перепись сервера и файлового слоя | Рассматривать только после успешного Tauri sidecar прототипа |
| Electron | Самый прямой перенос Node + Chromium, меньше WebView surprises | Больший размер, выше baseline RAM, нужно аккуратно изолировать main/renderer | Fallback, если Tauri sidecar окажется дорогим |
| Neutralino | Очень легкий shell, native API из JS | Меньше экосистема, сложнее для комплексного server/Steam пути | Не основной кандидат |
| Godot/Unity | Сильный 3D/game runtime | Полная перепись UI, Entity, Obsidian-like KB и web workflow | Не делать для основной платформы |
| Three.js/Babylon.js внутри React | Быстрый 3D-прототип без миграции | Нужно держать 3D как отдельный viewport, не смешивать с Konva без плана | Делать как feature-прототип, не как platform rewrite |

## 3D стратегия

3D не требует перехода на игровой движок.

Первый 3D vertical slice должен быть маленьким и встроенным:

- отдельное окно или режим canvas viewport;
- импорт простой сцены/модели или генеративная тестовая сцена;
- связь с Entity: token/entity id, позиция, видимость;
- без переноса всего 2D canvas в 3D.

Three.js лучше для первого минимального прототипа, потому что он ближе к текущему React/frontend стеку. Babylon.js стоит рассмотреть, если понадобится больше game-engine возможностей: WebGPU/WebGL abstraction, physics, scene tooling.

## Steam путь

Steam не должен диктовать перепись сейчас, но текущая `.md` модель хорошо подходит под будущие функции:

- Workshop item = папка мира (`world.yaml`, `general/`, `gm/`, `users/`, assets);
- Steam Cloud = sync выбранных world/save paths;
- Steam Networking/lobbies = потенциальная замена Hamachi/Radmin для поздней версии;
- Achievements/statistics = отдельный слой, не часть core Entity.

Что потребуется от владельца проекта:

- Steamworks partner/app access;
- Steam App ID и SDK;
- решение, какие папки миров синхронизировать в Cloud;
- политика Workshop: что публикуется, что приватно, как паковать assets;
- тесты на реальном Steam клиенте и нескольких аккаунтах.

## Что Codex может сделать сам

- Поддерживать browser-first разработку.
- Подготовить Tauri proof-of-concept с sidecar, если будет принято решение.
- Добавить Three.js/Babylon.js 3D prototype внутри текущего React-приложения.
- Написать packaging checklist и smoke tests.
- Разделить runtime adapters так, чтобы file/world API не был завязан на browser-only assumptions.

## Что требует ручного решения владельца

- Когда именно начинать desktop prototype.
- Готов ли проект принять Rust как runtime dependency.
- Нужен ли Steamworks SDK до публичной playable beta.
- Какой уровень 3D нужен: визуальный просмотр, тактическая сцена, полноценная 3D VTT.
- Какие данные мира можно синхронизировать через Steam Cloud/Workshop.

## Решение на сейчас

`defer rewrite, prototype shell later`.

Практический курс:

1. Продолжать foundation-first разработку в текущем веб-стеке.
2. Не добавлять Tauri/Rust в основной код, пока vertical slice не стабилен.
3. После стабильного gameplay slice сделать отдельную ветку/prototype: `Tauri shell + Node sidecar`.
4. Параллельно разрешить маленький 3D prototype внутри React, если он не ломает 2D canvas.

## Проверенные источники

- Tauri architecture and sidecar docs: `https://v2.tauri.app/concept/architecture/`, `https://tauri.app/fr/develop/sidecar/`
- Electron process model docs: `https://www.electronjs.org/docs/latest/tutorial/process-model`
- Neutralino docs: `https://neutralino.js.org/`, `https://neutralino.js.org/docs/api/overview`
- Steamworks docs: `https://partner.steamgames.com/doc/features/workshop/implementation`, `https://partner.steamgames.com/doc/features/cloud`, `https://partner.steamgames.com/doc/api/ISteamnetworkingSockets`
- Three.js/Babylon docs: `https://threejs.org/manual/en/fundamentals.html`, `https://www.babylonjs.com/specifications`
