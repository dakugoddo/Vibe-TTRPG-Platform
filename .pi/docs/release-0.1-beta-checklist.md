# Eternity Table 0.1 beta release checklist

> Обновлено: 2026-06-11
> Статус: подготовка к beta release, без git tag/release до ручной QA

## Цель

Подготовить проект к первому beta-релизу `0.1.0`: README, desktop packaging, базовый smoke, понятные ограничения и список ручных проверок.

## Уже готово

- Название продукта: `Eternity Table`.
- Версия приложения: `0.1.0`.
- Electron metadata обновлена: productName, appId, artifact names, shortcut name.
- README для GitHub создан.
- Notes workspace получил Obsidian-like первый срез: vault tree, tabs/splits, source/preview/split modes, data view, linked context.
- Notes shell-модули встроены в рабочую область: `Vault`, `Context`, `Notifications`, `Search`, `Graph`, `Audio`, settings toggles, shell-only reset и persisted resize/visibility.
- Desktop build path проходит через `npm.cmd run desktop:build`.
- Unpacked Electron build проверен через `npm.cmd run desktop:pack` на Windows 2026-06-11: создан `electron-release/win-unpacked/Eternity Table.exe`; остаются ожидаемые warnings по default Electron icon и Vite chunk-size.

## Перед git tag/release проверить вручную

1. Чистый запуск dev browser mode:
   - `start.bat`
   - открыть мир
   - проверить canvas, шторки, файлы, аудио, заметки.
2. Чистый запуск Electron dev:
   - `start-electron-dev.bat`
   - открыть тестовый мир
   - проверить FPS overlay и middle-button pan.
3. Notes workspace QA:
   - переключиться `Канвас -> Заметки`
   - открыть note/character/object
   - проверить `Редактор`, `Просмотр`, `Два вида`, `Данные`, `Оглавление`, `Связи`, `Граф`
   - проверить collapse/expand дерева
   - проверить, что повторное открытие одной сущности не создает дубликаты вкладок
   - проверить wiki autocomplete через `[[` в редактируемом source/split
   - проверить graph-сводку: входящие, центральная сущность, исходящие
   - проверить ribbon/settings toggles для `Vault`, `Context`, `Notifications`, `Search`, `Graph`, `Audio`
   - проверить `Сброс` shell-модулей: вкладки остаются открытыми, размеры/visibility возвращаются к дефолтам
   - проверить нижний Audio dock в Notes mode и отсутствие остановки воспроизведения при переключении Canvas/Notes
   - проверить read-only состояние на сущности без прав.
4. Packaged build:
   - очистить старые artifacts в `electron-release/`, если нужен публичный release bundle
   - `build-electron-dist.bat`
   - запустить portable exe
   - проверить embedded server и освобождение порта после закрытия.
5. Player smoke:
   - подключение с другого клиента по IP
   - видимость cursors/ping
   - права на GM/user/general сущности.

## Автоматические проверки перед release

```bat
cd app
npm.cmd exec tsc -- --noEmit
npm.cmd run lint
npm.cmd run build
npm.cmd run desktop:build
..\server\node_modules\.bin\tsx.cmd src\utils\notesWorkspaceLayout.test.ts
..\server\node_modules\.bin\tsx.cmd src\store\notesWorkspaceStore.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\notesWorkspaceModules.test.ts
..\server\node_modules\.bin\tsx.cmd src\utils\notesWorkspaceLinks.test.ts
```

```bat
cd server
npm.cmd run build
```

## Не включать в release commit

- runtime-изменения `test-world/*`, если они не являются специально подготовленными demo-data;
- `.pi/prototypes/*.html` owner references;
- временные `dist/`, `electron-release/`, cache/build artifacts; перед release не смешивать старые `Vibe TTRPG Platform*` artifacts с новым `Eternity Table*`;
- локальные профили/настройки.

## Release notes draft

### Eternity Table 0.1.0 beta

Первый beta-срез local-first VTT: бесконечный canvas, Markdown entity knowledge base, entity sheets, asset/audio foundations, Yjs multiplayer sync, Electron shell и Obsidian-like Notes workspace.

Известные ограничения:

- UI еще полируется;
- native multi-window/multi-monitor не входит в beta;
- permissions/visibility требуют GM/player QA;
- desktop icon/signing metadata не финализированы;
- public distribution требует clean-machine smoke.
