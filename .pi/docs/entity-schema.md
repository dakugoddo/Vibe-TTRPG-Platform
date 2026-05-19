# Entity Schema

> Дата: 2026-05-18
> Текущая версия: `1`

## Зачем

`schemaVersion` нужен, чтобы проект мог развивать структуру сущностей без внезапного слома старых миров.

Это не ограничение игровой системы. Это версия технического контракта: как Entity нормализуется в памяти и как она записывается в `.md` frontmatter.

## Где хранится

В памяти:

```ts
interface Entity {
  id: string;
  parentId: string | null;
  schemaVersion?: number;
  type: EntityType;
  name: string;
  description: string;
  properties: Record<string, any>;
  tags: string[];
}
```

В `.md`:

```yaml
---
type: character
schemaVersion: 1
tags: [игрок]
---
```

## Совместимость

Старые `.md` файлы без `schemaVersion` считаются совместимыми с текущей схемой и при следующей записи получают `schemaVersion: 1`.

Правило: отсутствие версии не должно мешать открытию мира.

## Текущая схема v1

В v1 сохраняются прежние правила:

- `type` определяет базовую форму сущности;
- `name` берется из первого Markdown-заголовка;
- `description` берется из тела Markdown после заголовка;
- `tags` хранятся в frontmatter;
- универсальные данные лежат в `properties`;
- для character часть статов сериализуется в `stats` и `resources`;
- для tag/ability/canvas часть полей выносится в top-level frontmatter;
- `parentId` определяется структурой папок, а не frontmatter.

## Валидные типы

- `character`
- `object`
- `ability`
- `competency`
- `tag`
- `canvas`
- `note`
- `portal`
- `folder`
- `attack`

## Правила для будущих миграций

1. Новое поле сначала должно быть optional.
2. Parser должен уметь прочитать старый файл без нового поля.
3. Serializer должен писать актуальную версию схемы.
4. Миграция не должна терять пользовательский Markdown.
5. Игровые механики не должны хардкодиться только из-за версии Entity-схемы.

## Где код

- Client type: `app/src/types.ts`
- Client schema helpers: `app/src/utils/entitySchema.ts`
- Client parser: `app/src/utils/entityParser.ts`
- Client serializer: `app/src/utils/entitySerializer.ts`
- Server type: `server/src/shared/types.ts`
- Server schema helpers: `server/src/entitySchema.ts`
- Server parser/serializer: `server/src/fileManager.ts`
