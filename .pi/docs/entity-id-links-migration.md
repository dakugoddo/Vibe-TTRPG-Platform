# Entity ID links migration

> Дата: 2026-05-21  
> Статус: core реализован; migration utility добавлена как безопасный dry-run/apply endpoint.

## Проблема

Текущее правило "имя сущности в general DB уникально и является ID" плохо масштабируется:

- персонаж может иметь личные копии предметов, атак, способностей и компетенций;
- одинаковые имена должны быть допустимы в разных ветках/инвентарях;
- rename не должен ломать ссылки;
- `[[wiki-ссылки]]` должны уметь ссылаться на конкретную сущность, а не на первое совпавшее имя.

## Целевое состояние

- Каждая сущность во всех базах (`general`, `users`, `gm`) имеет стабильный `id` во frontmatter.
- `name` становится display name, а не primary key.
- Canonical wikilink: `[[entityId]]`.
- UI показывает display name, но хранит ссылку на ID.
- Legacy `[[Name]]` продолжает резолвиться как fallback до миграции.

## Решение по формату ID

Пользователь предложил ID по дате без точек:

```text
2026101223251655
```

Это 16 цифр: `YYYYMMDDHHmmssCC` (сотые секунды). Если использовать настоящие миллисекунды, формат будет 17 цифр: `YYYYMMDDHHmmssSSS`.

Выбран формат:

- `17 digits` — `YYYYMMDDHHmmssSSS`, честные milliseconds. Формат длиннее примера, зато лучше выдерживает быстрые batch-create операции.

Collision guard: если ID уже занят, генератор сдвигает timestamp на следующий миллисекундный тик.

## Миграционный план

### Slice 1: ID helpers and index

- [x] Добавить helper генерации ID.
- [x] Добавить entity lookup by ID and legacy name.
- [x] Parser читает `id` из frontmatter; если отсутствует, временно использует старый filename-derived ID.

### Slice 2: Serializer and fileManager

- [x] Новые сущности всегда получают frontmatter `id`.
- [x] Существующие `.md` без `id` читаются без падения.
- [x] Миграция может дописать ID в файлы мира отдельной командой/utility.

### Slice 3: Link resolver

- [x] `MarkdownRenderer` резолвит `[[id]]`.
- [x] `[[name]]` работает как legacy fallback.
- [x] Поддержан alias: `[[id|display text]]`.

### Slice 4: Obsidian-like autocomplete

- [x] В основных текстовых полях описания при вводе `[[` появляется список сущностей.
- [x] Поиск идёт по `name`, `id`, `type`; список фильтруется по текущей роли/видимости.
- [x] Вставка пишет canonical `[[id]]`.

### Slice 5: Rename/backlinks

- [x] Rename меняет `name` и file path, но не меняет `id`.
- [x] Backlinks ищут canonical ID links и legacy name links.
- [x] Rename manager не переписывает canonical ID links.

## Риски

- Слишком ранняя миграция может сломать старые миры. Поэтому API по умолчанию работает в dry-run режиме.
- Нужно разделить file path, display name и entity ID.
- Player/user DB и вложенные сущности должны получить такие же гарантии, как general DB.
- Нужна ручная QA на Obsidian compatibility: файлы остаются читаемыми, но `[[id]]` менее человекочитаемы без UI alias.

## Acceptance criteria

- [x] Новая сущность получает стабильный frontmatter ID.
- [x] Две сущности с одинаковым `name` могут существовать в разных ветках без конфликта ссылок.
- [x] `[[id]]` открывает ровно нужную сущность.
- [x] Legacy `[[name]]` не ломается сразу после обновления.
- [x] Rename не ломает canonical ID links.
- [x] Autocomplete помогает выбрать сущность по имени и вставляет canonical link.

## Реализация 2026-05-21

- Client/server generators: `entityId.ts`.
- Client parser/serializer writes `id` and reads `id -> uid -> fallback`.
- Server fileManager writes `id`, resolves files by `id` or legacy name, preserves readable filenames and allows duplicate display names with filename suffixes when needed.
- `EntityLink` and `MarkdownRenderer` resolve canonical ID links with legacy-name fallback.
- `WikiLinkTextarea` подключён к основным description/notes полям персонажа, предмета, способности и generic entity description.
- `POST /api/world/migrate/entity-ids` проходит `general`, `gm` и все `users/*`: по умолчанию возвращает dry-run отчёт, а при `dryRun: false` минимально дописывает `id` в frontmatter без полного пересериализовывания markdown.
- `fileApi.migrateEntityIds(dryRun)` добавлен для будущего UI/maintenance-действия.

Осталось: ручной QA migration flow на копии мира и отдельный UI/maintenance entrypoint, если понадобится запускать миграцию не через API.
