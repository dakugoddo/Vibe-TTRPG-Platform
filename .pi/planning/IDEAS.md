# Идеи и направления

> Здесь хранится смысл идей и результат их критической оценки. Реализация появляется в `../DEVELOPMENT_PLAN.md` только после статуса `Принято` или решения владельца.

## Требуют решения владельца

### IDEA-SHEETS-001 — Что развивать после первого конструктора заметок

- **Исходная идея:** превратить hardcoded entity sheets в настраиваемые интерфейсы сущностей.
- **Что уже доказано:** JSON-схема, безопасный renderer, layout заметки, публикация/backup/rollback и доставка игрокам.
- **Критическая оценка:** нельзя одновременно строить визуальный редактор, formula engine и мигрировать все sheets — получится большой внутренний фреймворк без законченного workflow.
- **Статус:** `Нужно решение владельца`; варианты и рекомендация находятся в [`QUESTION-001`](QUESTIONS.md).
- **Связано:** `.pi/docs/entity-ui-sheet-builder-architecture.md`.

### IDEA-NOTES-001 — Настоящий WYSIWYG-редактор Markdown

- **Проблема:** текущие source/preview/split и toolbar могут быть менее естественными, чем прямое редактирование форматированного текста.
- **Критическая оценка:** WYSIWYG затрагивает Markdown round-trip, embeds/wiki-links, undo и новую тяжёлую зависимость. Это не «полировка toolbar».
- **Статус:** `Отложено до QA`; условие возврата и следующий выбор находятся в [`QUESTION-003`](QUESTIONS.md).
- **Связано:** `.pi/docs/notes-workspace-rich-search-polish.md`.

### IDEA-PDF-001 — Расширенный PDF viewer

Старый ID: `FEAT-PDF-001`.

- **Что уже есть:** лёгкое нативное preview и optional-module gate.
- **Критическая оценка:** тяжёлая viewer-зависимость не оправдана без подтверждённого игрового workflow.
- **Статус:** `Нужно уточнение перед design-doc`; варианты и рекомендация находятся в [`QUESTION-004`](QUESTIONS.md).

### IDEA-AUDIO-001 — Следующий уровень аудио-модуля

Старый ID: `FEAT-AUDIO-003`.

- **Кандидаты:** reconnect-safe snapshots, делегирование управления, permissions, artwork metadata.
- **Критическая оценка:** это три разные пользовательские задачи. Их нельзя объединять в один «audio polish» срез.
- **Рекомендация:** сначала надёжное восстановление playback/session state, затем отдельно permissions/delegation, artwork — только при явной пользе.
- **Статус:** `Принято по частям`, не поставлено в ближайший этап.

### IDEA-ROLES-001 — Player identity и role lifecycle

- **Что уже есть:** базовая player identity и role assignment.
- **Незавершённое:** rename, online/offline conflicts, миграция `_playerOwner → playerId`, явный feedback пользователю.
- **Критическая оценка:** затрагивает permissions и ownership, поэтому нельзя делать как косметический rename; нужен отдельный GM/player сценарий и migration gate.
- **Статус:** `Принято, отложено до multiplayer QA`.
- **Старый ID:** `FEAT-ROLES-PLAYERS-001`.

### IDEA-DESKTOP-001 — Native multi-window / multi-monitor

- **Ценность:** отдельные окна для canvas, заметок и панелей на нескольких мониторах.
- **Риск:** lifecycle Electron, shared state, focus, persistence и player packaging.
- **Решение:** не начинать до clean-machine Electron QA и отдельного architecture gate.
- **Статус:** `Отложено по зависимости`.

## Принятые направления

### IDEA-RELEASE-001 — Подготовка следующего публичного релиза

Старый ID: `FEAT-RELEASE-001`.

- Двуязычные README и GitHub changelog должны обновляться вместе.
- Публичный `main` остаётся app-only: без `.pi`, test worlds, agent files, Graphify output, секретов и generated artifacts.
- Перед следующим tag нужны clean-machine QA, installer/portable smoke и список known issues.
- **Статус:** `Принято`, отражено в roadmap.

### IDEA-I18N-001 — Локальные переводы мира

- Мир может переопределять поддерживаемые `ru/en` строки без изменения приложения.
- Unsupported locale files остаются будущими data-pack файлами, а не автоматически включёнными языками UI.
- **Статус:** foundation реализован; остаётся owner/manual QA и точечный UX polish.

### IDEA-MODULES-001 — Core / optional built-in / future mod

Старый ID: `FEAT-MODULES-001`.

- Каждая крупная функция сначала классифицируется.
- Не добавлять пустые toggles и registry entries без реального mount point/consumer.
- Graph, combat tracker, automation и 3D не считаются запланированной реализацией только потому, что упомянуты как возможные модули.
- **Статус:** `Принято как product gate`.

## Отклонённые или запрещённые подходы

- Произвольный JavaScript/CSS в пользовательских sheet blocks — риск безопасности и несовместимости.
- Параллельная модель данных для Notes blocks вместо существующей Entity/`parentId` Matryoshka — дублирование source of truth.
- Konva Stage overscan для скрытия edge clipping — подтверждённая потеря FPS.
- Внутренние tracer/demo-функции без пользовательской ценности — после проверки должны удаляться.
- Копирование Obsidian как визуального шаблона — используем поведенческие UX-паттерны, сохраняя темы Eternity Table.
