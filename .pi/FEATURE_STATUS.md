# Vibe TTRPG Platform: статус фич

> Дата: 2026-05-20

## Готово и подтверждено сборкой

- React/Vite frontend собирается через `npm run build`.
- Server TypeScript проходит `tsc --noEmit --project tsconfig.json`.
- Базовая Entity-модель, файловый сервер, Yjs-синхронизация и окно сущности уже существуют.
- Canvas имеет pan/zoom, drawing tools, pinned windows, snap, portals, fog of war, cursors и ping.
- Multiplayer вручную подтвержден владельцем проекта через Radmin/Hamachi: подключение работает, курсоры видны, перемещение объектов синхронизируется после отпускания.
- CharacterSheet содержит статы, инвентарь, заметки, навыки, компетенции и интерактивное изменение ран.
- MarkdownRenderer поддерживает `[[wiki-ссылки]]`, inline `!roll`, блоки `stats`, `inventory`, `gm-only`.
- Чат умеет отправлять сообщения, показывать историю бросков и отдельную вкладку событий для системных игровых действий.

## Принято как направление

- Ввести явный контракт версий Entity-схемы.
- Разделить синхронизацию на persistent, ephemeral и awareness слои.
- Вынести все броски в единый Roll Engine.
- Сохранять игровые механики модульными до отдельного проектирования полной системы.
- Усилить GM-only, права доступа и проверку записей.
- Оптимизировать canvas до расширения тяжелых функций.
- Поддерживать `.pi` как живую документацию.
- Проверять разработку через вертикальный игровой сценарий.

## Сейчас в работе

- Canvas stabilization: `BUG-CANVAS-001` lasso tool исправлен кодом; нужен ручной UI QA.

## Только что добавлено

- Entity `schemaVersion` как top-level поле и YAML frontmatter `schemaVersion: 1`.
- Совместимое чтение старых `.md` файлов без `schemaVersion`.
- Единые schema helpers на клиенте и сервере.
- Миграционные focused tests для legacy `.md` без `schemaVersion` добавлены на клиенте (`entitySerializer.test.ts`) и сервере (`fileManager.test.ts`).
- `competency` и `attack` добавлены в валидные типы parser'ов.
- Полный `npm run lint` в `app` теперь проходит.
- Vite build chunking оптимизирован: canvas и markdown зависимости вынесены в отдельные chunks, основной JS chunk уменьшен примерно с 1.23 MB до 306 KB.
- Store-level permission guard добавлен в `yjsStore` для add/update/delete/clone.
- View-level permission helper `canViewEntity` добавлен и подключен к `EntityDatabase`, чтобы игроки не видели GM-базу и чужие user-сущности в UI.
- `EntityDatabase` скрывает или блокирует UI-действия записи без прав: создание, импорт, переименование, удаление, выдачу игроку и drag/drop перемещения.
- `CompetenciesBlock` скрывает редактирование компетенций без прав: добавление, изменение ранга и удаление; бросок и открытие сущности остаются доступными.
- `ObjectSheet` и `AttackSheet` переходят в read-only без прав: свойства читаются, но редактирование, теги, создание/перетаскивание/удаление атак скрываются или блокируются.
- `EntityWindow`, `CharacterSheet` notes и `EntityImageBlock` скрывают rename/delete/description/tag/image edit для read-only сущностей, сохраняя чтение Markdown и открытие ссылок.
- `SkillsBlock` скрывает изменение ранга навыков без прав, но оставляет броски через Roll Engine.
- `InventoryBlock` скрывает equip/quantity/delete/drag/drop без прав; move/copy в user inventory проставляет owner marker на предмет и дочерние сущности.
- `AttributeBlock` переводит статы, раны, мощь и статусы в read-only без прав; логи ран/статусов не отправляются при заблокированной записи.
- Legacy `PropertiesBlock` и `StatusBlock` также проверяют права перед tag-edit/drop, чтобы их можно было безопасно подключать позже.
- В контекстное меню сущностей добавлено дублирование: копия создается рядом с исходной сущностью вместе с дочерними элементами и сразу открывается в окне.
- В контекстное меню сущностей добавлено копирование `[[wiki-ссылки]]` для быстрого связывания заметок и сущностей.
- В `EntityDatabase` добавлен поиск по имени, типу, описанию, тегам и properties; найденные вложенные сущности показываются вместе с родителями, а сущности с дочерними элементами можно раскрывать стрелкой.
- В контекстное меню сущностей добавлены quick-create действия: персонаж может быстро создать дочерний предмет или компетенцию, предмет может быстро создать дочернюю атаку.
- Принята доверенная privacy модель: UI должен скрывать GM-only и чужие user-данные, но отдельные sync boundaries пока не внедряются.
- Текущие `Entity.properties` по типам описаны в `.pi/docs/entity-properties.md`.
- Canvas sync layers описаны в `.pi/docs/sync-layers.md`.
- Рабочий контур Codex-maxxing для проекта описан в `.pi/docs/codex-maxxing-workflow.md`.
- Canvas `drawElements` и `fogReveals` зеркалятся из canvas Y.Doc в canvas entity properties с debounce.
- YAML serializer/parser на клиенте и сервере теперь проходит roundtrip для массивов объектов в canvas properties.
- Select-drag, point edit, resize, rotate и fog brush оптимизированы: live-изменения работают как локальный preview, persistent Yjs получает итоговое состояние только на завершении действия.
- Canvas draw/fog write paths теперь проверяют права на canvas entity перед записью, undo/redo и persistence writeback; read-only canvas показывает только безопасный select/navigation UI, toolbar style/z-order не обходит этот guard, а drag/delete порталов и drag токенов блокируются без прав на соответствующую сущность.
- `EntityWindow` показывает read-only блок быстрых связей: родитель, дочерние сущности, теги и обратные `[[wiki-ссылки]]`. Блок фильтрует связанные сущности через `canViewEntity`, поэтому игрок не получает UI-ссылки на GM-only и чужие user-данные.
- Контекстное меню `EntityWindow` получило быстрые действия: дублирование редактируемой сущности рядом с оригиналом и копирование `[[wiki-ссылки]]`; clipboard fallback вынесен в общий helper `utils/clipboard.ts`.
- В `EntityDatabase` и меню `EntityWindow` доступны quick-create действия для текущих flexible blocks: у персонажа можно создать дочерний предмет, компетенцию или способность, у предмета — дочернюю атаку; созданная сущность сразу открывается в окне там, где действие вызвано из окна.
- Раны в CharacterSheet редактируются кнопками ±1/±5 или ручным вводом прямо в блоке здоровья; изменения логируются системным сообщением в чат.
- Добавлены focused tests для `diceParser`, `rollEngine` и permission helper; permission logic вынесена в чистый `utils/permissions.ts`.
- "Выдать игроку" теперь создает копию в `user` базе выбранного игрока, не переносит мастер-сущность из `general`, и file sync сохраняет user-сущности по `_playerOwner`.
- В ChatPanel добавлена вкладка "События": раны, статусы, выдача предметов и другие не-dice системные сообщения можно смотреть отдельно от обычного чата и истории бросков.
- В CharacterSheet добавлена вкладка "Способности": дочерние ability-сущности можно создавать, открывать, настраивать через `cost.base`/`range`/`area`/`diceFormula` и бросать через Roll Engine.
- В CharacterSheet добавлена вкладка "Ресурсы": гибкие счетчики `properties.resources` можно создавать и менять без привязки к финальной игровой системе.
- Resource normalization/clamp logic вынесена в `utils/resourceModel.ts` и покрыта focused test `resourceModel.test.ts`.
- `.pi/PRODUCT_VISION.md` и `.pi/ARCHITECTURE.md` обновлены под текущий канон: bug triage, abilities/resources, ручной multiplayer QA и правило дорогого поиска.
- Повторный runtime-анализ оформлен в `.pi/docs/platform-runtime-decision.md`: не переписывать фундамент сейчас, позже проверять Tauri shell + sidecar прототипом.
- Добавлен `.pi/docs/code-map.md`: карта владельцев логики для canvas, Entity/KB, character blocks, stores, server и focused tests.

## Известный технический долг

- В Codex-среде foreground dev servers стартуют, но фоновые `Start-Process` запуски ранее не удерживались. Для ручной проверки используйте обычные терминалы или `start.bat`.
- Permission/view guard требует ручной проверки в настоящей GM/player multiplayer сессии.
- `root` canvas создается как системная canvas entity с id/name `root`, а UI продолжает показывать локализованный fake root.
- External edit `.md` -> Entity -> уже открытый canvas Y.Doc поддержан для `drawElements` и `fogReveals`, но требует ручного QA с внешним редактором.
- Canvas local-preview optimization частично подтверждена ручной GM/player проверкой: remote-клиент получает перемещение объекта после завершения drag; lasso selection исправлен кодом, но еще требует ручного UI QA.
- `BUG-CANVAS-001`: кодовый фикс внесен 2026-05-21; ручная проверка по `.pi/docs/testing-multiplayer.md`, тест №10, шаг 19.

## Отложено до отдельного обсуждения

- Полный дизайн игровой системы.
- Сложные взаимодействия способностей, статусов, атак, ресурсов и условий.
- random.org provider с реальным API-ключом и сетевой политикой.
- Tauri, Steam, 3D-режим: решение на сейчас - отложить rewrite и проверять отдельными prototype branches.
