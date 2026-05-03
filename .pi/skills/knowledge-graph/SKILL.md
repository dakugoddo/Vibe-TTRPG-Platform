---
name: knowledge-graph
description: Obsidian-like Knowledge Graph, wiki-links, .md file system, entity serialization. Use when working with entity notes, [[wiki-links]], graph view, markdown rendering, or .md file format.
---

# 🕸️ Obsidian-like Knowledge Graph & Linking

> Когда применять: заметки, wiki-ссылки, .md файлы, entitySerializer, MarkdownRenderer, EntityLink, graph view.

---

## 1. БЫСТРЫЙ СТАРТ

Ключевые файлы:
- `app/src/utils/entitySerializer.ts` — .md ↔ Entity
- `app/src/utils/entityParser.ts` — парсинг .md
- `app/src/components/ui/MarkdownRenderer.tsx` — рендер markdown
- `app/src/components/ui/EntityLink.tsx` — [[wiki-ссылки]]
- `server/src/fileManager.ts` — CRUD .md файлов

---

## 2. ФОРМАТ .md ФАЙЛОВ

### Структура:
```markdown
---
id: "sword-of-flame"
parentId: "thorins-inventory"
type: "object"
name: "Огненный Меч"
imageId: "sword-flame.webp"
icon_url: "https://..."
database: "general"
properties:
  damage: "1d8+2"
  damageType: "fire"
  weight: 3
tags:
  - "magic-item"
  - "fire-damage"
---

# Огненный Меч

Этот меч пылает вечным огнём. Найден в пещерах под Железной Горой.

## Свойства
- Урон: 1d8+2 (рубящий + огонь)
- Свойство: Свет (20 футов)
- Активация: бонус-действие

## Связанные статьи
- [[Торин Железнобокий]] — текущий владелец
- [[Кузница Двалина]] — место создания
- [[Великая Война]] — история оружия
```

### Правила:
1. **YAML frontmatter** — ВСЕГДА между `---` в начале
2. **ID** — то же что и имя файла (без .md)
3. **Уникальность** — имя = уникальный ID в general DB
4. **Markdown-тело** — описание в свободной форме
5. **[[wiki-ссылки]]** — на другие сущности (по имени)

---

## 3. ENTITY SERIALIZATION

### entitySerializer.ts — основные функции:

```typescript
// Сериализация: Entity → .md строка
function serializeEntity(entity: Entity): string {
  const frontmatter = {
    id: entity.id,
    parentId: entity.parentId,
    type: entity.type,
    name: entity.name,
    imageId: entity.imageId,
    icon_url: entity.icon_url,
    database: entity.database,
    properties: entity.properties,
    tags: entity.tags,
  };
  
  const yaml = stringify(frontmatter, { lineWidth: -1 });
  return `---\n${yaml}---\n\n${entity.description}`;
}

// Десериализация: .md строка → Entity
function deserializeEntity(markdown: string): Entity {
  const { frontmatter, content } = parseFrontmatter(markdown);
  return {
    id: frontmatter.id,
    name: frontmatter.name,
    type: frontmatter.type,
    parentId: frontmatter.parentId || null,
    description: content.trim(),
    imageId: frontmatter.imageId,
    icon_url: frontmatter.icon_url,
    properties: frontmatter.properties || {},
    tags: frontmatter.tags || [],
    database: frontmatter.database || 'general',
  };
}
```

### Инварианты (НЕ НАРУШАТЬ):
- ❌ Не меняй структуру YAML frontmatter
- ❌ Не добавляй обязательные поля (все кроме id/type/name опциональны)
- ✅ Можно добавлять необязательные поля (с дефолтными значениями)
- ✅ Совместимость с Obsidian (открываются в Obsidian без ошибок)

---

## 4. WIKI-ССЫЛКИ [[...]]

### EntityLink.tsx:
```typescript
// Парсинг [[ссылок]] в Markdown
const WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g;

// Рендер: кликабельная ссылка
<EntityLink entityName="Торин Железнобокий" />

// Поведение:
// 1. Клик → найти сущность по имени
// 2. Если найдена → открыть окно (openWindow)
// 3. Если не найдена → предложить создать новую заметку
// 4. Ctrl+Клик → открыть в новой вкладке (будущее)
```

### Обратные ссылки (Backlinks):
```typescript
// Поиск всех сущностей, которые ссылаются на данную
function getBacklinks(entityName: string): Entity[] {
  return allEntities.filter(e => 
    e.description.includes(`[[${entityName}]]`)
  );
}
```

---

## 5. MARKDOWN RENDERER

### Поддерживаемые фичи:
```markdown
# Заголовки (h1-h6)
**жирный** *курсив* ~~зачёркнутый~~
- списки (unordered)
1. нумерованные (ordered)
> цитаты
`inline code`
```code blocks```
| таблицы | GFM |
[[wiki-ссылки]]
!roll 2d6+3  (интерактивные броски — будущее)
```

### Расширения:
```typescript
// react-markdown + remark-gfm
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    // Кастомный рендер для Wiki-ссылок
    text: ({ children }) => {
      // Замена [[...]] на <EntityLink />
    },
    // Кастомный рендер для !roll
    text: ({ children }) => {
      // Замена !roll на <InlineRollButton />
    },
  }}
/>
```

---

## 6. GRAPH VIEW (БУДУЩЕЕ)

### План:
```typescript
// Узлы: каждая entity
// Рёбра: [[wiki-ссылки]] + parentId отношения
// Рендер: Force-directed graph (d3-force или react-force-graph)

interface GraphNode {
  id: string;
  name: string;
  type: EntityType;
  group: string; // для цветовой группировки
}

interface GraphLink {
  source: string;
  target: string;
  type: 'wiki-link' | 'parent-child';
}
```

---

## 7. ФАЙЛОВАЯ СИСТЕМА

### Структура мира:
```
test-world/
├── general/
│   ├── characters/
│   │   └── Торин Железнобокий.md
│   ├── objects/
│   │   └── Огненный Меч.md
│   ├── notes/
│   │   └── Великая Война.md
│   ├── canvases/
│   │   └── Таверна.md
│   └── tags/
│       └── magic-item.md
├── users/
│   └── player-1/
│       └── inventory/
│           └── Зелье Лечения.md
├── gm/
│   └── secret-note.md
└── world.yaml
```

### Матрёшка (вложенность через папки):
```
Торин Железнобокий.md           ← character (файл)
Торин Железнобокий/              ← папка (дети)
  ├── Экскалибур.md              ← object
  └── Экскалибур/                ← дети меча
      └── Рубящая Атака.md       ← attack
```

### Правила файловой системы:
- Имя файла = имя сущности (без спецсимволов, запрещённых в Windows)
- Папка с именем сущности = её дети (parentId)
- При переименовании → каскадное переименование папки и обновление parentId у детей
- При удалении → рекурсивное удаление детей (с ConfirmDialog!)

---

## 8. OBSIDIAN СОВМЕСТИМОСТЬ

### Что должно работать если открыть мир в Obsidian:
1. ✅ YAML frontmatter парсится
2. ✅ [[wiki-ссылки]] работают
3. ✅ Markdown рендерится
4. ✅ Файловая структура понятна

### Что НЕ будет работать в Obsidian (и это ок):
- ❌ Специфичные поля YAML (icon_url, database)
- ❌ Интерактивные броски (!roll)
- ❌ Graph view с типами сущностей
- ❌ Drag & drop между папками

### Запреты:
- ❌ НЕ добавляй поля, которые ломают Obsidian-парсинг
- ❌ НЕ меняй синтаксис [[ссылок]]
- ❌ НЕ добавляй обязательные поля без дефолта

---

*Файлы переживут код. .md — наш source of truth.*
