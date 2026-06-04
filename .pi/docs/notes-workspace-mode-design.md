# Notes Workspace Mode: design gate

> Дата: 2026-06-03
> Статус: Design gate + local-only shell + named local snapshots + local tab/split board persistence + read-only linked views
> Связанные задачи: `FEAT-WORKSPACE-001`, `FEAT-UI-002`, future Tauri/native multi-window

## Зачем это нужно

Владельцу нужен режим работы с заметками и сущностями ближе к Obsidian: не всегда canvas должен быть главным экраном. Для разработки лора, правил, NPC и предметов удобнее отдельный workspace, где открытые сущности занимают центральную область как вкладки/панели, а canvas временно не рендерится.

Этот режим не заменяет canvas. Это второй рабочий контекст:

- `Canvas mode` - сцены, карты, токены, закреплённые карточки, порталы.
- `Notes mode` - заметки, правила, сущности, markdown, быстрые раскладки окон.

## Что подсказал Obsidian

Официальная справка Obsidian описывает интерфейс через tabs и tab groups: вкладки можно перетаскивать между группами, создавать новые группы через split right/down, менять размеры групп, pin-ить вкладки и сохранять layouts через Workspaces core plugin.

Полезные паттерны для Vibe:

- **Tab group, а не одно окно**: центральная область состоит из групп, каждая группа держит свои вкладки.
- **Split right/down**: основная операция раскладки - разделить активную группу вправо или вниз.
- **Drag/drop tabs**: вкладку можно переставить внутри группы или перенести в другую группу.
- **Pinned tab**: закреплённая вкладка не перехватывает обычную навигацию ссылок; ссылки открываются отдельно.
- **Linked views**: локальный graph/backlinks/outline может быть связан с активной заметкой.
- **Saved workspaces**: layout хранит открытые файлы/вкладки и ширину/видимость sidebars, но не меняет сами файлы.
- **Pop-out windows**: Obsidian делает отдельные окна только на desktop; для Vibe это надо оставить после Tauri/native gate.

Источники:

- Obsidian Help: `Tabs` - `https://obsidian.md/help/tabs`
- Obsidian Help: `Workspaces` - `https://obsidian.md/help/plugins/workspaces`
- Obsidian Help: `Pop-out windows` - `https://obsidian.md/help/pop-out-windows`
- Obsidian Developer Docs: `Workspace` / `WorkspaceLeaf` - `https://obsidian-developer-docs.pages.dev/Reference/TypeScript-API/Workspace/`

## Решение для Vibe

### MVP без риска

Первый срез должен быть только local-only shell:

1. Добавить режим интерфейса `canvas | notes`.
2. В `notes` режиме не рендерить `InfiniteCanvas` и `CanvasToolbar`.
3. Оставить `WindowManager` для личных unpinned окон, но скрыть canvas-pinned placements.
4. Дать быстрые действия над уже открытыми screen windows: grid, cascade, save/restore snapshot.
5. Дать быстрый список заметок/сущностей для открытия screen window через существующий `openWindow`.
6. Хранить выбранный режим локально в `localStorage`, не в мире.
7. Дать named local snapshots для screen-window раскладок без записи в world files.
8. Подключить local tab/split board поверх существующего `EntityWindow`: вкладки и группы управляют фокусом/открытием screen windows, но не создают параллельный редактор.
9. Хранить tab board layout локально в `localStorage` с runtime-валидацией, не в world files.
10. Добавить read-only linked views: Markdown, outline, backlinks и graph-summary без записи в мир.

### Почему так

- Не меняется формат entity `.md`.
- Не появляется новый sync contract.
- Не затрагиваются права доступа.
- Не создаётся browser popout, который потом всё равно придётся пересобрать под Tauri.
- Уже существующий `EntityWindow` остаётся единственной оболочкой редактирования сущности.
- Named snapshots сохраняют только screen windows и не трогают canvas-pinned placements.

## Будущая модель после MVP

### Layout tree

Будущий полноценный режим должен иметь собственную local layout tree-модель:

```ts
type NotesWorkspaceNode =
  | { type: 'split'; direction: 'row' | 'column'; ratio: number; children: [NotesWorkspaceNode, NotesWorkspaceNode] }
  | { type: 'tabs'; activeTabId: string; tabs: NotesWorkspaceTab[] };

type NotesWorkspaceTab = {
  id: string;
  entityId: string;
  pinned?: boolean;
  view: 'entity' | 'markdown' | 'graph' | 'backlinks' | 'outline';
};
```

Эта модель должна жить локально, пока владелец отдельно не решит, что нужны named workspace snapshots в мире.

Первый pure helper уже внесён в `app/src/utils/notesWorkspaceLayout.ts`:

- `createEmptyNotesWorkspaceLayout`;
- `openNotesWorkspaceTab` с reuse existing по `entityId + view`;
- `splitActiveNotesWorkspaceGroup`;
- `setActiveNotesWorkspaceGroup`;
- `setActiveNotesWorkspaceTab`;
- `closeNotesWorkspaceTab`;
- `listNotesWorkspaceGroups`.

UI-render подключён отдельным безопасным срезом:

- `app/src/store/notesWorkspaceStore.ts` держит local-only layout state и оборачивает pure helpers;
- `NotesWorkspace` рендерит tab groups/splits в центральной области, открывает сущности через существующий `openWindow` и фокусирует уже открытые screen windows;
- tab board layout сохраняется локально в `localStorage` с валидацией, чтобы битые данные не ломали workspace;
- tab board пока не сохраняется в world files и не заменяет `EntityWindow` как единственную оболочку редактирования сущностей.

Read-only linked views подключены отдельным срезом:

- `app/src/utils/notesWorkspaceLinks.ts` парсит markdown headings, outgoing `[[wiki]]` links и backlinks;
- `NotesWorkspace` показывает вкладки `Markdown`, `Оглавление`, `Связи` и `Граф` как read-only слой поверх активной entity;
- linked views не редактируют entity напрямую и не создают новый sync contract.

### Linked views

Локальные linked views уже добавлены первым read-only срезом:

- markdown preview активной entity;
- outline по markdown headings;
- backlinks/outgoing links;
- graph-summary активной entity.

Linked views не должны редактировать entity напрямую, только читать текущий active tab.

### Pinned tabs vs canvas pinned windows

Важно не смешивать термины:

- `Pinned canvas window` - shared placement на canvas, видимый другим по правам.
- `Pinned notes tab` - личная вкладка в Notes mode, которая не заменяется при открытии ссылок.

Это разные сущности UI. Их нельзя хранить одним полем.

## Нельзя в первом срезе

- Не писать workspace layout в entity `.md` или `world.yaml`.
- Не делать GM-shared notes layout.
- Не открывать browser popout как основной multi-monitor путь.
- Не добавлять новую библиотеку layout manager.
- Не дублировать editor/sheet logic параллельно `EntityWindow`.
- Не раскрывать hidden/private entity в быстрых списках без существующего permission guard.

## Acceptance criteria MVP

- Пользователь может переключить UI между `Canvas` и `Заметки`.
- В `Заметки` режиме canvas и canvas toolbar не рендерятся.
- Личные screen windows остаются открытыми и редактируемыми.
- Закреплённые canvas placements не всплывают поверх notes workspace.
- Можно быстро разложить открытые окна сеткой или каскадом.
- Можно сохранить, восстановить и удалить named local layout snapshot.
- Можно открыть видимую сущность в local tab board, разделить активную группу вправо/вниз, переключать/закрывать вкладки и фокусировать связанное screen window.
- Local tab board layout переживает reload на этом клиенте.
- Можно открыть read-only Markdown/Outline/Backlinks/Graph-summary вкладки для активной entity.
- Выбор режима переживает reload на этом клиенте.
- Проверки: `workspaceMode.test.ts`, `windowStore.test.ts`, `notesWorkspaceLayout.test.ts`, `notesWorkspaceStore.test.ts`, `notesWorkspaceLinks.test.ts`, `npm.cmd run build`, `npm.cmd run lint`.
