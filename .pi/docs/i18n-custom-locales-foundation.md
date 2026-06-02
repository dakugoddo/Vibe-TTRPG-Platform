# i18n/custom locales foundation

> Дата: 2026-06-02
> Статус: mini-plan для `FEAT-I18N-002`

## Цель

Сделать перевод приложения управляемым из интерфейса и подготовить фундамент для моддерских переводов мира, не меняя файловый формат мира и не вводя тяжёлый редактор раньше времени.

## Первый безопасный срез

- Использовать существующий `react-i18next`.
- Добавить выбор языка в `SettingsWindow -> Интерфейс`.
- Хранить выбранный язык локально в `localStorage`, чтобы игрок и ГМ могли иметь разные UI preferences.
- Инициализировать `i18next` из сохранённого языка.
- Показать в настройках статус будущего слоя custom world locales, но пока не писать файлы мира.
- Добавить маленькую pure-утилиту нормализации/хранения языка и focused test.

## Что не делаем в первом срезе

- Не создаём `world/locales/*.json`.
- Не добавляем server endpoints для custom locales.
- Не делаем полноценный редактор ключей.
- Не переводим весь существующий UI за один проход.
- Не меняем структуру `app/src/locales/ru.json` и `app/src/locales/en.json` кроме добавления ключей для нового блока настроек.

## Будущий формат-кандидат

После отдельного product/architecture gate можно хранить пользовательские переводы в мире:

```text
<world>/locales/ru.custom.json
<world>/locales/en.custom.json
<world>/locales/<custom-locale>.json
```

Клиент должен будет получать merged locale через host/server endpoint:

1. built-in locale из приложения;
2. world custom overrides;
3. optional user-local overrides.

## Acceptance criteria первого среза

- В настройках есть компактный переключатель `Русский / English`.
- Выбор языка сохраняется между перезагрузками клиента.
- Новый блок настроек сам меняет текст при переключении языка.
- Future custom locale status не обещает готовый редактор и ясно показывает, что world storage ещё planned.
- `tsc`, `lint`, `build` и focused localization test проходят.
