# Entity Title Filenames

> Дата: 2026-05-24  
> Статус: server endpoint + sync hook implemented, manual QA pending для `FEAT-ENTITY-FILENAME-001`  
> Цель: сделать `.md` файлы и одноимённые папки читаемыми в проводнике/Obsidian, не ломая стабильные `id`, вложенность и ссылки.

## Целевое поведение

Видимое название сущности берётся из заголовка markdown:

```md
# Кошка
```

Файл и одноимённая папка должны называться так же:

```text
characters/
  Кошка.md
  Кошка/
    Лазерная винтовка.md
```

Если имя занято в той же папке:

```text
Кошка.md
Кошка (1).md
Кошка (2).md
```

Стабильный `id` во frontmatter остаётся главным ключом. Имя файла - удобная оболочка для человека, а не identity.

## Что нельзя ломать

- `id` сущности не меняется при переименовании.
- `[[id]]` ссылки не меняются.
- `[[id|label]]` ссылки не меняются автоматически, если пользователь сам выбрал label.
- Вложенная папка сущности переименовывается вместе с `.md`.
- Children остаются children через `parentId`, а не через угаданную папку.
- File watcher не должен принять rename за delete+create и потерять данные.

## Источник истины

На уровне UI:

- `entity.name` = видимое имя сущности;
- основной markdown H1 должен синхронизироваться с `entity.name`;
- file path выводится из database + parent folder + safe filename.

На уровне диска:

- frontmatter `id` и `type` обязательны;
- filename может отличаться от `id`;
- legacy files без `id` сначала проходят migration из `FEAT-ENTITY-ID-001`.

## Safe filename

Алгоритм:

1. взять `entity.name` или первый H1;
2. trim;
3. заменить запрещённые Windows символы `< > : " / \ | ? *` на безопасный дефис или пробел;
4. схлопнуть повторные пробелы;
5. убрать точку/пробел в конце;
6. если пусто, использовать fallback `${type}-${id}`;
7. проверить collision в target folder;
8. если занято другим entity id, добавить suffix ` (1)`, ` (2)`.

Collision сравнивается по нормализованному Windows-case-insensitive имени.

Реализация foundation:

- `server/src/entityTitleFilename.ts` - pure helper для safe filename, collision suffix и Windows-case-insensitive сравнения.
- `server/src/entityTitleFilename.test.ts` - focused test для запрещённых символов, fallback, `(1)/(2)`, reserved Windows names и case-only rename.
- `server/src/entityTitleRename.ts` - dry-run/apply helper для `.md` + одноимённой child-folder rename с temporary path для case-only rename.
- `server/src/entityTitleRename.test.ts` - focused test для dry-run, apply, сохранения `id`, folder rename и collision suffix.
- `POST /api/entities/:id/rename-path` - server endpoint; host sync вызывает его после `saveEntity`, чтобы переименование из UI доходило до файла.

## Rename transaction

Операция должна выполняться на server side, через один endpoint:

```http
POST /api/entities/:id/rename-path
```

Вход:

```ts
{
  title: string;
  dryRun?: boolean;
}
```

Выход dry-run:

```ts
{
  entityId: string;
  oldFilePath: string;
  newFilePath: string;
  oldFolderPath?: string;
  newFolderPath?: string;
  collisionSuffix?: number;
  warnings: string[];
}
```

Apply:

1. найти entity по `id`;
2. вычислить текущий `.md` path и optional child folder path;
3. вычислить target path с suffix;
4. временно подавить watcher для old/new paths;
5. обновить markdown title/frontmatter/name в памяти;
6. переименовать `.md` во временное имя при case-only rename на Windows;
7. переименовать child folder, если она существует;
8. записать обновлённый `.md`;
9. обновить index/cache;
10. отправить sync event клиентам;
11. снять watcher suppression.

Если folder rename прошёл, а file rename упал, endpoint должен попытаться rollback. Если rollback не удался, вернуть ошибку с конкретными paths для ручного восстановления.

## Когда запускать rename

Безопасный порядок:

1. UI меняет `entity.name` и markdown H1 как сейчас.
2. После debounce или explicit save сервер запускает dry-run.
3. Если rename безопасен, apply происходит автоматически.
4. Если есть предупреждения, UI показывает ненавязчивую плашку и предлагает `Переименовать файл`.

Для первого внедрения лучше не делать массовый автопереезд всего мира. Нужны:

- dry-run всего мира;
- отчёт collisions;
- backup/copy QA;
- apply только после ручного подтверждения.

## Acceptance criteria

- [x] Переименование `# Кошка` меняет `character.md` на `Кошка.md`.
- [x] Одноимённая папка `character/` меняется на `Кошка/`.
- [x] `id` в frontmatter не меняется.
- [ ] `[[id]]` ссылки продолжают открывать ту же сущность.
- [x] При конфликте helper выбирает `Кошка (1).md`, затем `Кошка (2).md`.
- [x] Case-only collision проверяется по Windows-case-insensitive ключу.
- [ ] Внешняя правка файла в Obsidian не создаёт duplicate entity.
- [x] Серверный focused test покрывает file+folder rename и collision path.
- [ ] Rollback failure path покрыт отдельным fault-injection тестом.

## Открытые решения

- Делать ли auto-rename при каждом изменении H1, или только по кнопке/после потери фокуса.
- Нужно ли сохранять старый filename как alias для поиска.
- Должны ли labels в `[[id|old name]]` автоматически обновляться при rename, или оставаться авторским текстом.
