# Pre-release usability pack

> Обновлено: 2026-06-12
> Статус: implementation in progress
> Цель: довести существующий функционал до более понятного и пригодного для beta `0.1.0` вида без запуска крупных новых подсистем.

## Принцип

Этот pack не добавляет PDF viewer, native multi-window, WYSIWYG, world locale editor или новую permission model. Он закрывает места, где пользователь уже видит функцию, но функция ощущается сырой: непонятно, что загрузилось, что сломалось, куда нажимать и как быстро выполнить частое действие.

Общие ограничения:

- не менять `.md` формат и YAML frontmatter;
- не менять ролевую модель без отдельного QA;
- не добавлять тяжёлые зависимости;
- не трогать `test-world/*` как release-data без отдельного решения владельца;
- все UI-строки, добавляемые в стабильные surfaces, вести через `ru/en`, если это не временный debug/dev текст.

## Порядок реализации

### 1. Asset loading/error/retry foundation

Статус: first slice implemented for entity image block and Asset Browser image/video previews; QA pending.

Задача: сделать поведение файлов предсказуемым, когда preview/audio/image не загрузились.

Форма реализации:

- лёгкий helper/hook для `idle/loading/ready/error`;
- единый визуальный паттерн: skeleton/loader, ошибка, кнопка retry/reload;
- первая интеграция в самые заметные места: entity image block и asset browser previews;
- без PDF viewer и без новой metadata database.

Acceptance:

- image preview показывает loading state до `onLoad`;
- битый/недоступный файл показывает понятную ошибку, а не пустой блок;
- retry меняет key/src и повторяет загрузку;
- пути через `/api/assets/file?path=...` остаются source of truth.

### 2. Entity quick actions

Статус: implemented; automated QA passed, manual UI smoke pending.

Задача: ускорить частые действия с сущностью.

Форма реализации:

- компактное меню/toolbar в entity window и Notes entity context;
- команды: открыть, сфокусировать, закрепить/добавить на canvas, показать родителя, скопировать wiki/id ссылку;
- команды должны учитывать права доступа и текущий workspace mode.

Acceptance:

- пользователь может за 1-2 клика получить ссылку на entity;
- если entity уже открыта, команда фокусирует существующее окно/вкладку;
- action disabled/hidden при отсутствии прав или неподходящем context.

### 3. Notes workspace discoverability polish

Задача: сделать режим заметок понятнее как рабочее пространство.

Форма реализации:

- активный pane/tab должен быть визуально очевиден;
- drop-zones и split behavior должны иметь понятный hover/active state;
- reset layout/shell должен быть доступен из predictable места;
- search results должны показывать тип, базу и короткий snippet.

Acceptance:

- по скриншоту понятно, какая вкладка активна;
- пользователь видит, куда будет вставлена панель при drag;
- reset не уничтожает данные сущностей и не пишет в мир.

### 4. Audio dock usability

Задача: убрать ощущение "сломано", когда аудио пустое, остановлено или файл не проигрался.

Форма реализации:

- empty state для `ничего не играет`;
- error state для failed playback;
- быстрый `stop all`;
- понятное отображение текущего трека, канала и локального/session режима.

Acceptance:

- failed mp3 показывает ошибку и не ломает остальной dock;
- пользователь всегда видит, какой канал/трек активен;
- Canvas/Notes switch не останавливает playback.

### 5. Canvas card readability

Задача: сделать entity cards/tokens читаемыми на обычном zoom.

Форма реализации:

- стабильные размеры и overflow rules;
- имя, тип/иконка, ключевые параметры без превращения в Excel;
- compact card остаётся информационной, без edit/roll controls.

Acceptance:

- карточка не разваливается на длинных именах;
- ключевые параметры видны без открытия окна;
- нет пересечения текста с token controls.

### 6. Startup and first-run flow

Задача: уменьшить потребность помнить инструкцию запуска.

Форма реализации:

- clearer state для `создать/открыть мир`;
- статус локального сервера и комнаты;
- понятное сообщение, если server unavailable;
- desktop/browser flows должны использовать один язык и одну терминологию.

Acceptance:

- новый пользователь понимает, что нажимать для открытия мира;
- ошибка сервера содержит конкретное действие;
- Electron и browser mode не расходятся в основных терминах.

### 7. Settings as control center

Задача: собрать локальные UX-переключатели и reset-действия в одном месте.

Форма реализации:

- reset UI layout / notes layout / shell modules;
- reset theme/custom palette;
- app module toggles с понятным статусом;
- dev overlay controls только в dev build.

Acceptance:

- пользователь может вернуть локальный UI в рабочее состояние без чистки localStorage руками;
- reset не трогает world data;
- toggles отражают то же состояние, что и runtime UI.

## Commit strategy

Каждый пункт делается отдельным commit:

1. `docs: plan pre-release usability pack`
2. `feat: add asset load states`
3. `feat: add entity quick actions`
4. `style: polish notes workspace affordances`
5. `feat: improve audio dock states`
6. `style: improve canvas card readability`
7. `feat: clarify startup flow`
8. `feat: add settings reset controls`

Если пункт выявит баг из прошлой AI-правки, дополнительно обновить `.pi/BUG_BACKLOG.md` и релевантный rule/doc по regression learning loop.

## QA

- `npm.cmd exec tsc -- --noEmit`
- `npm.cmd run lint`
- `npm.cmd run build`
- focused tests для изменённых utils/store;
- manual smoke: assets, audio, Notes, canvas cards, settings reset, startup Electron/browser.
