# World locale editor QA

> Дата: 2026-06-22  
> Статус: manual QA pending; key-table editor и player delivery через Yjs implemented
> Цель: проверить `Settings -> Мир -> Переводы мира` перед beta/0.1 и перед дальнейшим player delivery слоем.

## Подготовка

1. Открыть тестовый мир в Electron/dev.
2. Создать папку `<world>/locales`.
3. Создать валидный файл `<world>/locales/ru.json`:

```json
{
  "settings": {
    "tabs": {
      "world": "Мир QA"
    }
  }
}
```

4. Создать битый файл `<world>/locales/en.json`:

```json
{
```

## Проверка списка и preview

- `Settings -> Мир -> Переводы мира` показывает `ru` и `en`.
- Для `ru` preview показывает ненулевой `Override keys`, `Merged keys` и sample `settings.tabs.world`.
- Для `en` diagnostics показывает ошибку JSON, приложение не падает.
- Unsupported locale-файлы вроде `en-US.json` могут отображаться и редактироваться как data-pack файлы, но не обязаны применяться к runtime UI.

## Проверка runtime override

- При текущем языке `ru` и валидном `ru.json` UI label вкладки мира меняется на override после входа в комнату или после сохранения файла.
- Если `ru.json` удалить или сделать битым, приложение возвращается к built-in RU label после reload/повторного входа.
- Entity names/descriptions/properties не переводятся автоматически.

## Проверка player delivery

- Host открывает мир, входит как GM и держит язык интерфейса `ru`.
- Player подключается к той же комнате, выбирает язык интерфейса `ru` и не должен вызывать `/api/world/locales/*` со своей стороны.
- Host меняет один supported override, например `settings.tabs.world`, и нажимает `Сохранить`.
- Host UI обновляется сразу после save.
- Player UI получает тот же label через Yjs `worldLocales` без reload и без File API.
- Если Host откатывает файл через `Откатить`, Player получает откат через тот же Yjs snapshot.

## Проверка editor/save

- В блоке таблицы ключей найти `settings.tabs.world` через поиск.
- Изменить override value inline в таблице; JSON fallback ниже должен обновиться тем же ключом.
- Очистить value или нажать reset key; override key должен исчезнуть из JSON draft.
- Изменить JSON в textarea на валидный object и нажать `Сохранить`.
- ConfirmDialog появляется до записи.
- После подтверждения `<world>/locales/ru.json` обновлён pretty JSON.
- Если файл уже существовал, рядом появился `<world>/locales/ru.json.bak`.
- Невалидный JSON или JSON array не сохраняется и показывает ошибку в editor block.

## Проверка rollback

- После успешного save нажать `Откатить`.
- ConfirmDialog появляется до записи.
- После подтверждения `<world>/locales/ru.json` восстановлен из `<world>/locales/ru.json.bak`.
- Если `.bak` отсутствует, показывается ошибка и текущий файл не меняется.

## Проверка import/export

- `Экспорт` скачивает текущий draft как `<locale>.json`.
- `Импорт` принимает только JSON object и подставляет его в textarea.
- Import не пишет файл мира до явного `Сохранить`.

## Не должно происходить

- Не должно быть auto-save при наборе текста.
- Не должно быть записи player-клиентом через File API.
- Не должно быть изменения `.md` entity/YAML frontmatter.
- Не должно быть применения unsupported locale id как runtime языка.
