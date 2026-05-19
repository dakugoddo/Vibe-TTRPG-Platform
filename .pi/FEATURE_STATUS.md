# Vibe TTRPG Platform: статус фич

> Дата: 2026-05-18

## Готово и подтверждено сборкой

- React/Vite frontend собирается через `npm run build`.
- Server TypeScript проходит `tsc --noEmit --project tsconfig.json`.
- Базовая Entity-модель, файловый сервер, Yjs-синхронизация и окно сущности уже существуют.
- Canvas имеет pan/zoom, drawing tools, pinned windows, snap, portals, fog of war, cursors и ping.
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

- Детализация Entity `properties` по типам.
- Подготовка миграционных тестов для Entity schema.

## Только что добавлено

- Entity `schemaVersion` как top-level поле и YAML frontmatter `schemaVersion: 1`.
- Совместимое чтение старых `.md` файлов без `schemaVersion`.
- Единые schema helpers на клиенте и сервере.
- `competency` и `attack` добавлены в валидные типы parser'ов.
- Полный `npm run lint` в `app` теперь проходит.
- Vite build chunking оптимизирован: canvas и markdown зависимости вынесены в отдельные chunks, основной JS chunk уменьшен примерно с 1.23 MB до 306 KB.
- Store-level permission guard добавлен в `yjsStore` для add/update/delete/clone.
- Принята доверенная privacy модель: UI должен скрывать GM-only и чужие user-данные, но отдельные sync boundaries пока не внедряются.
- Текущие `Entity.properties` по типам описаны в `.pi/docs/entity-properties.md`.
- Canvas sync layers описаны в `.pi/docs/sync-layers.md`.
- Рабочий контур Codex-maxxing для проекта описан в `.pi/docs/codex-maxxing-workflow.md`.
- Canvas `drawElements` и `fogReveals` зеркалятся из canvas Y.Doc в canvas entity properties с debounce.
- YAML serializer/parser на клиенте и сервере теперь проходит roundtrip для массивов объектов в canvas properties.
- Раны в CharacterSheet редактируются кнопками ±1/±5 или ручным вводом прямо в блоке здоровья; изменения логируются системным сообщением в чат.
- Добавлены focused tests для `diceParser`, `rollEngine` и permission helper; permission logic вынесена в чистый `utils/permissions.ts`.
- "Выдать игроку" теперь создает копию в `user` базе выбранного игрока, не переносит мастер-сущность из `general`, и file sync сохраняет user-сущности по `_playerOwner`.
- В ChatPanel добавлена вкладка "События": раны, статусы, выдача предметов и другие не-dice системные сообщения можно смотреть отдельно от обычного чата и истории бросков.

## Известный технический долг

- В Codex-среде foreground dev servers стартуют, но фоновые `Start-Process` запуски ранее не удерживались. Для ручной проверки используйте обычные терминалы или `start.bat`.
- Permission guard требует ручной проверки в настоящей GM/player multiplayer сессии.
- Entity schema все еще требует отдельных миграционных тестов на legacy `.md`.
- `root` canvas создается как системная canvas entity с id/name `root`, а UI продолжает показывать локализованный fake root.
- External edit `.md` -> Entity -> уже открытый canvas Y.Doc поддержан для `drawElements` и `fogReveals`, но требует ручного QA с внешним редактором.

## Отложено до отдельного обсуждения

- Полный дизайн игровой системы.
- Сложные взаимодействия способностей, статусов, атак, ресурсов и условий.
- random.org provider с реальным API-ключом и сетевой политикой.
- Tauri, Steam, 3D-режим.
