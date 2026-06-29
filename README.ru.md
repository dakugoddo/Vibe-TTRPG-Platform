# Eternity Table

[English](README.md) | **Русский**

Локальная виртуальная tabletop-платформа и база знаний кампании для настольных RPG.

Eternity Table объединяет бесконечный холст, Obsidian-подобную Markdown-базу знаний, листы сущностей, ассеты, аудио-инструменты, броски костей и мультиплеерную синхронизацию вокруг одного правила: папка мира у хоста является источником истины.

## Статус

Версия: `0.1.0 alpha`

Первая публичная alpha доступна как Windows x64 prerelease. Она предназначена для раннего тестирования, подготовки локальных кампаний и сбора обратной связи, но ещё не предназначена для критически важных игровых кампаний. Основная архитектура уже есть; UI, права доступа, упаковка и multiplayer QA всё ещё дорабатываются.

Страница релиза:

- [v0.1.0-alpha](https://github.com/dakugoddo/Vibe-TTRPG-Platform/releases/tag/v0.1.0-alpha)

<details>
<summary>История изменений</summary>

### v0.1.0-alpha

- Опубликован первый публичный Windows x64 alpha prerelease.
- Очищена публичная ветка `main`: теперь в ней только код приложения, release-скрипты, README-файлы и релизные данные.
- Добавлен встроенный preview-мир в `app/preview-world/` для демонстрации и onboarding.
- Добавлен desktop-flow **Open preview world**, который открывает временную копию встроенного preview-мира; изменения в preview-сессии сбрасываются при пересоздании preview.
- Добавлены Windows portable и installer artifacts через Electron Builder.
- Добавлены SHA256 checksums для release artifacts.
- Из публичной ветки исключены локальные материалы: персональные тестовые миры, `.pi/`, агентные инструкции, Graphify output, приватные прототипы и случайно отслеживаемые зависимости.
- Development performance overlay теперь opt-in и не отображается по умолчанию.
- Обновлены dependency lockfiles в рамках alpha audit pass.
- Добавлена двуязычная публичная документация: английский `README.md` и русский `README.ru.md`.

</details>

## Основная идея

Eternity Table проектируется как local-first VTT:

- GM владеет папкой мира на диске.
- Контент мира хранится как Markdown-файлы с YAML frontmatter.
- Хост запускает локальный файловый сервер и открывает приложение.
- Игроки подключаются к IP хоста по LAN, Radmin VPN, Hamachi или похожей приватной сети.
- Центральное облако не требуется.

Проект совмещает идеи:

- бесконечного холста в стиле Miro / Excalidraw;
- Markdown-базы знаний в стиле Obsidian;
- RPG-сущностей, листов, ассетов и session tools в духе FoundryVTT.

## Возможности в 0.1 Alpha

### Бесконечный холст

- Панорамирование и масштабирование холста.
- Инструменты рисования: рука, выбор, перо, линия, прямоугольник, эллипс, фрейм, текст, изображение.
- Canvas-сущности, карточки, токены, закреплённые окна и порталы.
- Оптимизированное панорамирование средней кнопкой мыши для более плавной Electron-камеры.
- Выбор объектов, lasso-поведение, фундамент undo/redo, snap/grid foundation.
- Фундамент тумана войны.
- Фундамент отображения GIF и image assets.

### База знаний

- Сущности являются Markdown-файлами с YAML frontmatter.
- Рекурсивная иерархия сущностей.
- Wiki-ссылки через `[[entity-id]]` и Markdown rendering.
- Obsidian-подобный Notes workspace:
  - дерево vault/entity;
  - tab groups;
  - split panes;
  - dock modules для vault, context, notifications, search, graph и audio;
  - управление видимостью shell modules, resize и reset;
  - source editor;
  - preview mode;
  - split editor/preview mode;
  - entity data view;
  - outline, backlinks, outgoing links, graph-summary context;
  - attached child entities.
- Локальное сохранение layout для Notes workspace.

### Система сущностей

Всё важное является сущностью:

- `character`
- `object`
- `ability`
- `competency`
- `attack`
- `tag`
- `note`
- `canvas`
- `portal`
- `folder`

Сущности могут содержать другие сущности. Персонаж может содержать предметы инвентаря, предмет может содержать атаки, а заметка может содержать связанные вложенные материалы.

### Персонажи и механики

- Фундамент листа персонажа.
- Статы, ресурсы, инвентарь, способности, компетенции, атаки, теги, статусы.
- Dynamic calculation helpers для статов.
- Dice roll engine и parsing формул.
- Интеграция бросков в чат.
- Фундамент компактной карточки персонажа на холсте.

### Ассеты

- Рекурсивный индекс ассетов.
- Фундамент для изображений, GIF, видео, аудио и файлов.
- Asset browser с upload/delete/show-in-folder flows.
- Native Electron asset reveal в desktop mode.

### Аудио

- Фундамент нижнего audio dock.
- Фундамент GM audio desk.
- Концепции music, ambience, SFX и voice channels.
- Фундамент local-first persistence для audio deck.

### Мультиплеер

- Yjs CRDT sync для world/session state.
- Отдельные canvas sync rooms.
- Фундамент awareness/cursor и multiplayer ping.
- Фундамент host/player identity и ролей.
- Permission helpers для view/edit access.

### Desktop

- Electron shell.
- Native folder picker.
- Embedded server build path.
- Desktop dev launcher.
- Portable и installer build configuration через electron-builder.
- Custom desktop icon assets подключены к Electron и Windows packaging.
- Lazy-loaded app surfaces, чтобы production app shell не превышал Vite chunk warning threshold.
- Development performance overlay, который включается только явно.

## Быстрый старт

### Скачать alpha build

Скачайте Windows x64 portable build или installer здесь:

- [GitHub Releases: v0.1.0-alpha](https://github.com/dakugoddo/Vibe-TTRPG-Platform/releases/tag/v0.1.0-alpha)

Доступные artifacts:

- `Eternity-Table-0.1.0-portable-x64.exe`
- `Eternity-Table-0.1.0-setup-x64.exe`
- `SHA256SUMS.txt`

Windows builds пока не подписаны, поэтому SmartScreen warnings ожидаемы.

### Требования для разработки

- Windows — основная протестированная среда.
- В разработке сейчас используется Node.js 24+.
- npm.

### Browser Dev Mode

Запуск из корня репозитория:

```bat
start.bat
```

Это запускает:

- Express file server на `http://localhost:3001`
- Vite client на `http://localhost:5173`

Игроки в той же приватной сети могут подключаться к Vite URL хоста.

### Electron Dev Mode

Запуск из корня репозитория:

```bat
start-electron-dev.bat
```

Или вручную:

```bat
cd app
npm.cmd run desktop:dev
```

### Сборка Electron app

Запуск:

```bat
build-electron-dist.bat
```

Artifacts будут записаны в:

```text
electron-release/
```

Ожидаемые имена:

- `Eternity-Table-0.1.0-portable-x64.exe`
- `Eternity-Table-0.1.0-setup-x64.exe`

Запуск unpacked build:

```bat
start-electron-built.bat
```

## Ручные команды разработки

### Server

```bat
cd server
npm.cmd run dev
```

### Client

```bat
cd app
npm.cmd run dev -- --host
```

### Проверки

```bat
cd app
npm.cmd exec tsc -- --noEmit
npm.cmd run lint
npm.cmd run build
npm.cmd run desktop:build
```

```bat
cd server
npm.cmd run build
```

Focused app tests используют `tsx` из server dependencies:

```bat
cd app
..\server\node_modules\.bin\tsx.cmd src\utils\notesWorkspaceLayout.test.ts
..\server\node_modules\.bin\tsx.cmd src\store\notesWorkspaceStore.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\notesWorkspaceModules.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\notesWorkspaceLinks.test.ts
```

## Структура проекта

```text
app/
  electron/          Electron main/preload runtime
  preview-world/     Встроенный demo world template, копируемый во временную сессию
  scripts/           Desktop build/dev helpers
  src/
    components/
      canvas/        Infinite canvas UI
      ui/            Shell, drawers, login, settings, assets, audio
      windows/       Entity windows and sheets
      workspace/     Notes workspace mode
    hooks/           React hooks
    locales/         Built-in ru/en translations
    services/        File API, desktop bridge, audio, roll services
    store/           Zustand and Yjs-facing stores
    utils/           Pure helpers, layout models, theme, parsers

server/
  src/
    index.ts         Express API and websocket entry
    worldManager.ts  World create/open/status
    fileManager.ts   Entity Markdown CRUD
    assetManager.ts  Asset index and safe paths
    fileWatcher.ts   External file watch
    playerProfiles.ts
```

Публичная/release ветка намеренно содержит только код приложения, build scripts, README-файлы и встроенный preview world. Персональные test worlds, агентные инструкции, прототипы, Graphify output и приватные planning files должны оставаться локальными или только в development branches.

## Встроенный preview world

Electron app включает небольшой демонстрационный мир:

```text
app/preview-world/
```

В desktop mode на экране входа в host/world menu есть **Open preview world**. При открытии приложение копирует встроенный template во временную папку и открывает эту копию. Пользователь может свободно редактировать, рисовать, создавать сущности и тестировать инструменты, но эти изменения намеренно сбрасываются при следующем открытии preview.

Preview world является release data. Персональные development worlds вроде `test-world/` не являются release data и не должны попадать в публичную ветку.

## Модель данных мира

Папка мира — главный источник истины.

Типичные папки:

```text
general/    Общие сущности мира
gm/         GM-only сущности
users/      Сущности и инвентарь игроков
assets/     Binary/media files
players/    Профили игроков
world.yaml  Метаданные мира
```

Entity files — это Markdown-документы с YAML frontmatter. Markdown body является описанием сущности.

## Notes Workspace

Notes workspace — local Obsidian-like editor mode поверх entity system.

Он не создаёт отдельный формат заметок. Он редактирует те же entity Markdown data, которые используются остальной платформой.

Текущие режимы:

- `Editor`: редактирование исходного Markdown с wiki-link autocomplete.
- `Preview`: rendered Markdown.
- `Split`: editor и preview рядом.
- `Data`: свойства сущности, теги и attached child entities.
- `Outline`: Markdown headings.
- `Links`: backlinks и outgoing links.
- `Graph`: компактная сводка связей.

Права записи следуют существующей entity permission model. Если пользователь не может редактировать сущность, editor read-only.

## Multiplayer model

Хост авторитетен для disk writes.

High-level flow:

```text
Markdown files <-> Express API <-> Yjs documents <-> connected clients
```

Внешние изменения могут обнаруживаться file watcher и отправляться обратно клиентам.

## Design system

UI использует semantic theme variables и общий `glass` helper из:

```text
app/src/utils/theme.ts
```

Themes должны стать полноценными visual workspaces, а не только light/dark color palettes.

## Ограничения alpha

- Некоторые UI surfaces всё ещё полируются.
- Полноценные native multi-window и multi-monitor workflows запланированы после стабилизации Electron foundation.
- Permissions и visibility требуют дополнительного GM/player QA.
- PDF viewing запланирован, но ещё не реализован.
- Windows builds не подписаны; SmartScreen warnings ожидаемы до решения по code signing.
- Public release packaging стоит smoke-test на чистой машине перед распространением.

## Repository hygiene

Публичная ветка должна оставаться product-focused. Не коммитить:

- персональные/test world folders (`test-world/`, root `world.yaml`, root `general/`, `assets/`, `users/`, `gm/`, `players/`);
- agent instructions, skills, Graphify output или private planning folders (`.pi/`, `.agents/`, `.opencode/`, `.codex/`, `.hermes.md`, `AGENTS.md`, `skills/`, `graphify-out/`);
- локальные credentials (`.env`, API keys, tokens);
- generated build artifacts (`app/dist/`, `app/dist-server/`, `electron-release/`).

Храните такие материалы локально или в development-only branches. Встроенный preview world — единственные world data, которые должны поставляться вместе с приложением.

## Документация для contributors

Этот README является публичной точкой входа. Внутренняя planning/agent documentation намеренно исключена из public release branch; храните её в local tooling или dedicated development branches.

## License

Лицензия ещё не финализирована.
