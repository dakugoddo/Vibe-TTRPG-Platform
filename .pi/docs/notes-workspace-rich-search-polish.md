# Notes workspace: rich editor, search and theme polish

> Обновлено: 2026-06-11
> Статус: implemented, owner QA pending

## Контракт текущего среза

- Markdown-rich editor остается Markdown-first: toolbar вставляет Markdown в `entity.description`, а не вводит новый формат хранения, HTML storage или тяжелую редакторскую зависимость.
- Полноценный WYSIWYG, CodeMirror или TipTap делать только отдельным dependency gate.
- Расширенный поиск NotesWorkspace использует общий `entitySearch.ts`, чтобы название, описание, свойства, теги, тип, база и ID искались одинаково с database drawer/search.
- Storage combobox является локальным фильтром поверх уже разрешенных сущностей. Он не должен обходить `canViewEntity` и не должен показывать GM/user сущности игрокам без прав.
- В draggable headers/tabs не ставить `preventDefault()` на `mousedown`: это ломает native HTML drag. Для защиты от выделения текста использовать `select-none`, `draggable` и отдельные drag handlers.
- Entity tree row click должен покрывать всю визуальную строку. Chevron остается единственным click target для expand/collapse.
- Радиусы notes shell/panes идут через `--vibe-radius-*`. Universal Glass должен выглядеть округлым стеклом, Arcane Control - более квадратным control-console стилем.
- Notes mode background должен использовать тот же `vibe-app-bg` / `--vibe-app-bg`, что и canvas shell. Не вводить отдельную декоративную сетку NotesWorkspace, потому что темы являются полноценными визуальными столами, а не просто цветами панелей.
- View `UI` показывает сущность внутри theme-window preview без подключения screen window/RND state. Это нужно для проверки того, как entity sheet будет выглядеть на canvas/window surface.
- Drag панели должен работать за всю header-зону pane, как окно в Windows. Узкий drag handle по названию считается недостаточным.
- Drag/drop pane implementation следует держать близко к MDN HTML Drag and Drop contract: `dragstart` записывает serialized string в `dataTransfer`, `dragover` на валидном drop target вызывает `preventDefault()`, а чтение payload делается в `drop`. Не делать частый React `setState` на каждом `dragover`; держать текущую drop-zone в ref и обновлять state только при смене зоны.
- Для перетаскивания pane header в NotesWorkspace использовать pointer-based docking session, а не HTML5 DnD: `pointerdown` на header, distance activation, `elementFromPoint` для поиска `data-notes-group-id`, расчет edge-zone по rect, применение `moveTab`/`splitTabToGroup` на `pointerup`. HTML5 DnD можно оставлять только как fallback для tab reorder, но docking панели не должен зависеть от браузерного `drop`.
- Resize между `Vault`, центральным editor board и `Context` является local UI state, а не world data.
- Visibility/width/height shell-модулей `Vault`, `Context`, `Notifications`, `Search`, `Graph`, `Audio` хранится в `notesWorkspaceStore` и `localStorage` (`vibe-ttrpg-notes-workspace-shell-v1`). Не возвращать это в компонентные `useState`, иначе режим заметок снова будет терять раскладку при перезапуске.
- `notesWorkspaceModules.ts` является registry для shell-модулей Notes mode. Live toggles получают только `status: implemented`; новые модули не должны появляться в рабочем ribbon без renderer/QA.
- `Audio` в Notes mode является нижним dock-модулем с тем же `AudioDesk`. `AudioControlDock` остаётся единственным владельцем `AudioDesk`: в canvas mode он показывает floating bottom dock, в Notes mode позиционируется в `NOTES_AUDIO_DOCK_HOST_ID`, а без видимого host остаётся скрытым, но смонтированным.
- Внутри Notes mode выключение visibility `Audio` должно скрывать dock из layout, но не размонтировать `AudioDesk`, пока app-level AudioModule включён. Иначе обычное скрытие панели или переключение Canvas/Notes будет останавливать локальное воспроизведение.
- Shell-модули Notes mode переключаются как быстрыми кнопками ribbon, так и в `SettingsWindow -> Интерфейс -> Модули режима заметок`. Оба пути должны писать в один `notesWorkspaceStore`, без второго состояния.
- Сброс shell-модулей Notes mode выполняется через `notesWorkspaceStore.resetShell()` и должен возвращать visibility/width/height к registry-defaults без сброса открытых вкладок и split-layout заметок. Не переиспользовать для этого `resetLayout()`, потому что он отвечает только за центральную рабочую область заметок.
- Текст настроек shell-модулей Notes mode хранится в `settings.interface.notesModules` (`ru/en`). Новые controls в этой секции не должны добавлять hardcoded UI-строки, потому что система перевода является частью ближайшего UI foundation.
- `NotificationCenter surface="embedded"` в Notes mode является dock-контентом правой колонки. Floating-уведомления остаются для canvas shell и не должны перекрывать редактор заметок.
- Будущая модульность Notes shell: аудио/музыкальные расширения и будущие панели должны стать dock-модулями с registry/settings visibility. Технические модули не получают крестик в шапке как entity panes; их включение/выключение должно идти через настройки/registry/ribbon.

## QA

- Открыть Notes mode и проверить, что центральной внешней шапки `Редактор` больше нет.
- Открыть несколько разных сущностей из Vault/Search: новая сущность должна открываться отдельным editor leaf, а повторный клик по уже открытой сущности должен фокусировать существующий leaf без дубля.
- Перетащить заголовок панели и вкладку на край другой панели: должна появиться drop-zone и после отпускания должен создаться split.
- Кликать по верхней, средней и нижней части строки сущности в vault: вся строка должна открывать/focus сущность, а раскрытие детей работает только по chevron.
- Переключить storage combobox между `Все`, `Общая`, личными инвентарями и `GM`; список не должен показывать сущности без прав.
- Проверить поиск по названию, описанию, тегам, типу, базе и свойствам; result card должен показывать matched fields/snippet.
- В редакторе нажать toolbar actions: bold, italic, heading, list, quote, code, wiki link. В preview должен рендериться тот же Markdown.
- Проверить Universal Glass и Arcane Control: первый с округленными glass-панелями, второй с почти квадратными углами.
- Проверить, что фон Notes mode меняется вместе с темой так же, как canvas mode.
- Проверить view `UI` для character/object/attack/ability/note.
- Перетащить pane за любую пустую область шапки, а не только за название.
- Потянуть вертикальные разделители между Vault/editor/context и проверить изменение ширины.
- В ribbon слева выключить/включить `Vault`, `Context`, `Notifications`, `Search`, `Graph`, `Audio`; центральный editor board должен расширяться, правый модуль должен исчезать только когда выключены все правые dock-модули, а нижний Audio dock должен исчезать только при выключенном `Audio`.
- В настройках `Интерфейс -> Модули режима заметок` выключить/включить те же shell-модули и проверить, что ribbon сразу отражает состояние.
- В настройках нажать `Сброс` в секции shell-модулей и проверить, что `Vault`, `Context`, `Notifications` снова включены, `Search`, `Graph`, `Audio` выключены, размеры вернулись к дефолтам, а открытые вкладки заметок не закрылись.
- В ribbon слева включить `Search`, ввести запрос и проверить, что правый dock показывает те же расширенные результаты, что и Vault search: название, описание, свойства, теги, тип, база и ID.
- В ribbon слева включить `Graph`, открыть сущность с `[[wiki-link]]`/backlinks и проверить компактный правый dock: центр выбранной сущности, входящие/исходящие счётчики и быстрые переходы по связанным сущностям.
- В ribbon слева включить `Audio`, проверить нижний `AudioDesk`, drag/drop аудиофайлов у host, player volume view и resize-разделитель между editor board и Audio dock.
- В настройках выключить app-level `Аудио-модуль` и проверить, что `Audio` исчезает из Notes ribbon, а canvas floating dock тоже не монтируется.
- Изменить ширину `Vault`/правой колонки и высоту `Audio`, перезагрузить приложение и проверить, что размеры и visibility восстановились из localStorage.
- Проверить, что ribbon показывает только реализованные shell-модули, а planned-модули из registry не появляются без отдельного renderer.

## Внешние референсы по drag/drop

- MDN `dragover`: drop target должен отменять `dragover`, чтобы получить `drop`: `https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragover_event`
- MDN HTML Drag and Drop API: custom draggable elements должны сериализовать данные через `dataTransfer.setData(...)`, а drop target читает их в `drop`: `https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API`
- MDN Drag operations: `types.includes(...)` можно использовать для conditional drop targets; drop считается успешным только при валидном target/effect и отмененном `drop`: `https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Drag_operations`
- Dockview: docking layout manager для React использует pointer-events backend для drag/drop панелей: `https://dockview.dev/`
- dnd-kit Pointer Sensor: drag стартует от `pointerdown` и может иметь distance activation, что подходит для pane headers: `https://docs.dndkit.com/api-documentation/sensors/pointer`
