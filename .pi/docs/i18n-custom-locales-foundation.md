# Custom world locales and translation editor

> Дата: 2026-06-22  
> Статус: read-only server foundation implemented, write/editor ещё не делать  
> Решение: встроенные RU/EN переводы остаются core, пользовательские переводы мира проектируются как future mod/data-pack layer.

## Цель

Сделать переводы приложения управляемыми для моддеров и авторов миров, но не превратить i18n в источник поломок мира. Пользователь должен иметь:

- локальный выбор языка интерфейса;
- встроенные переводы приложения из `app/src/locales`;
- будущие world overrides, которые лежат рядом с миром и едут вместе с ним;
- редактор переводов с импортом, экспортом и откатом.

Важно: entity names/descriptions/properties являются контентом мира и не переводятся UI-слоем автоматически.

## Что уже есть

- `app/src/i18n.ts` инициализирует `i18next` из встроенных `ru.json` и `en.json`.
- `app/src/utils/localization.ts` хранит локальный выбор языка в `localStorage` через `vibe_locale`.
- `SettingsWindow -> Интерфейс` показывает RU/EN switch и кнопку открытия встроенной папки переводов в Electron.
- `server/src/worldLocaleManager.ts` безопасно читает существующий `<world>/locales/*.json` без записи.
- `.pi/docs/code-map.md` фиксирует границу: стабильный chrome приложения переводится через `ru/en.json`, данные мира не трогаются.

## Слои

| Слой | Где хранится | Кто меняет | Назначение |
|---|---|---|---|
| Core app locale | `app/src/locales/ru.json`, `app/src/locales/en.json` | разработчик приложения | Базовый стабильный UI chrome |
| World locale overrides | `<world>/locales/<locale>.json` | автор мира / моддер | Переименование UI-терминов под конкретный мир или систему |
| User-local overrides | будущий local app data | конкретный пользователь | Личная правка подписи без изменения мира |
| Entity content | `.md` сущности | автор мира / ГМ / игроки по правам | Не часть i18n, переводится вручную как контент |

## Формат файлов мира

Минимальный формат должен быть обычным JSON object с partial overrides:

```text
<world>/locales/ru.json
<world>/locales/en.json
<world>/locales/<custom-locale>.json
```

Пример:

```json
{
  "settings.tabs.audio": "Звук",
  "workspace.notes.modules.vault": "Архив",
  "assetBrowser.filters.pdf": "Книги"
}
```

Правила:

- ключи плоские или вложенные можно поддержать позже, но первый writer должен сохранять плоские dot-keys;
- неизвестные ключи не падают, а показываются как warnings в редакторе;
- пустая строка считается валидным override только если пользователь явно включил режим "пустое значение"; по умолчанию пустое поле удаляет override;
- файл мира не должен копировать весь `ru.json`, только изменённые ключи.

## Merge order

При загрузке клиента итоговый словарь строится так:

1. built-in locale из приложения;
2. world locale overrides с сервера хоста;
3. user-local overrides, если этот слой появится позже.

Если world override битый:

- приложение остаётся на built-in locale;
- Settings показывает ошибку world locale;
- файл не перезаписывается автоматически.

## Server endpoints

Первый серверный срез должен быть read/write только для host/GM:

```text
GET  /api/world/locales
GET  /api/world/locales/:locale
PUT  /api/world/locales/:locale
POST /api/world/locales/:locale/validate
POST /api/world/locales/:locale/export
```

Минимальная семантика:

- `GET /api/world/locales` возвращает список доступных world locale override файлов и их размер/mtime;
- `GET /api/world/locales/:locale` возвращает JSON overrides и diagnostics;
- `PUT` пишет файл атомарно через temp file + rename;
- `validate` проверяет JSON, unknown keys, типы значений и размер;
- `export` отдаёт файл для ручного сохранения.

Player-клиенты на первом этапе только читают merged locale, без записи.

## Editor UX

Редактор переводов должен быть не WYSIWYG, а таблица ключей:

- поиск по ключу и текущему тексту;
- фильтры: changed, missing, unknown, built-in only;
- колонки: key, built-in RU, built-in EN, world override;
- кнопки: reset key, reset locale file, import JSON, export JSON, open folder;
- предупреждение, что entity content не переводится здесь.

Первый UI-срез можно сделать в Settings как отдельную панель "Переводы мира", без отдельного окна.

## Mod/data-pack model

World locale overrides являются data-pack, а не core schema:

- они не меняют `.md` entity format;
- их можно отключить или удалить без миграции сущностей;
- они могут поставляться вместе с system pack/theme pack;
- конфликт нескольких packs решается order list, но это отдельный future slice.

Не добавлять marketplace/mod loader сейчас. Достаточно формата, валидации и импорт/экспорт JSON.

## Rollback and safety

Перед записью `PUT` сервер должен:

- валидировать JSON;
- ограничивать размер файла, например 512 KB на locale в первом срезе;
- писать backup рядом: `<locale>.json.bak`;
- использовать atomic write;
- запрещать path traversal и locale id вне allowlist pattern: `^[a-z]{2}(-[A-Z]{2})?$`.

Rollback в UI:

- "Reset key" удаляет один override;
- "Reset locale" переименовывает текущий файл в backup или очищает overrides после подтверждения через `ConfirmDialog`;
- "Restore backup" можно добавить вторым срезом.

## Acceptance criteria for first implementation slice

- Built-in RU/EN continue working without world locale files.
- Host can open Settings -> World translations and see available override files.
- Host can edit one key, save it to `<world>/locales/<locale>.json`, reload app and see changed chrome label.
- Player receives the merged locale from host and sees the same changed chrome label.
- Invalid JSON does not break app startup.
- `desktop:build`, focused locale tests and server locale endpoint tests pass.

## Do not do yet

- Не делать WYSIWYG translation editor.
- Не переводить entity content автоматически.
- Не добавлять remote marketplace/mod loader.
- Не менять `.md` entity/YAML frontmatter.
- Не добавлять тяжёлые зависимости ради JSON editor.
- Не давать player write-доступ к world locale files без отдельной permission QA.

## Реализованный read-only срез

- `GET /api/world/locales` возвращает список существующих валидных locale override файлов.
- `GET /api/world/locales/:locale` читает один override-файл, возвращает diagnostics для битого JSON и не ломает запуск.
- Locale id ограничен pattern `^[a-z]{2}(-[A-Z]{2})?$`, path traversal отклоняется.
- Сервер не создаёт `<world>/locales`, не пишет backup и не меняет файлы мира.
- Focused test: `server/src/worldLocaleManager.test.ts`.

## Следующий безопасный срез

1. Добавить typed client API для read-only endpoints.
2. Показать read-only список world locale files в Settings.
3. Добавить pure utils для flatten/unflatten/merge locale objects и tests перед write/editor.
4. Только после этого добавлять `PUT` и editor.
