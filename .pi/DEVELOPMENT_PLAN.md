# Vibe TTRPG Platform: current development plan

> Дата обновления: 2026-05-31
> Назначение: короткий рабочий чеклист. Детальные очереди живут в `.pi/BUG_BACKLOG.md` и `.pi/FEATURE_BACKLOG.md`.

## Правила Вектора

- [x] Разработка идёт foundation-first: контракт, данные, тесты, затем UI.
- [x] Завершённый проверенный срез должен идти отдельным commit, если git доступен.
- [x] `продолжай` значит автономно продолжать до реального блокера.
- [x] Баги проходят через `.pi/BUG_BACKLOG.md`.
- [x] Фичи проходят через `.pi/FEATURE_BACKLOG.md`.
- [x] Крупные изменения проходят Architecture/Product gate: sync, permissions, модули, внешние API, упаковка, 3D, файловый формат.
- [x] Core остаётся local-first: `.md` + YAML frontmatter на диске хоста.

## 1. UI Redesign Gate: ближайший приоритет

- [x] `FEAT-UI-002`: поднять полный UI redesign/theme/i18n/entity-sheet pass в ближайший приоритет перед новой крупной разработкой.
- [x] Создать большой decision-док с анализом, идеями, рисками и вопросами владельцу: `.pi/docs/ui-redesign-master-plan.md`.
- [x] Дать способ увидеть направление интерфейса до внедрения: статический preview-макет `.pi/prototypes/ui-redesign-preview.html`.
- [x] Утвердить визуальное направление: темы как полноценные визуальные столы/workspaces, `balanced` density, без отдельной светлой темы на старте, оба вида списков (table/card), Obsidian-like notes workspace.
- [x] После решений владельца идти foundation-first: theme tokens -> app shell/drawers -> i18n manager -> entity sheets -> asset/audio/settings polish.
- [x] Срез theme tokens: `theme.ts` управляет semantic variables для surface/border/shadow/blur/radius, а SettingsWindow показывает visual theme presets.
- [x] Первый entity UI-срез: EntityWindow frame/header/actions/relations/context menu, CharacterSheet notes и MarkdownRenderer переведены на semantic tokens.
- [x] Core entity block-pass: `AttributeBlock`, `SkillsBlock`, `CompetenciesBlock`, `AbilitiesBlock`, `ResourcesBlock`, `StatTooltip`, `TagPickerPopup` и `EntityImageBlock` переведены на semantic tokens.
- [ ] Следующий entity UI-срез: ObjectSheet, InventoryBlock и AttackSheet surfaces на тот же semantic contract.
- [ ] После block-pass проектировать компактный character card view для canvas.
- [ ] Не фиксировать финальную тему, переводческий формат или новую структуру entity UI без product-gate решения владельца.

## 2. Audio Module: Local-First Core

- [x] Вынести audio UI из RightDrawer.
- [x] Вернуть `Файлы` к роли asset library, а не плеера.
- [x] Починить live mixer volume для уже играющего звука.
- [x] `FEAT-AUDIO-004`: нижний music player показывает current track, время, timeline, seek и stop для канала `music`.
- [x] Добавить волновую индикацию вокруг compact-кнопки, когда звук сессии активен, но игрок ещё не включил audio opt-in.
- [x] Подключить локальный module toggle для `audio`: док и audio receiver не монтируются, если модуль выключен в настройках.
- [ ] Доделать mixer popup для local assets: `music` один трек, `ambience` multi-loop, `sfx` one-shot, `voice` экспериментально.
- [x] Довести базовый transport UX: play/pause/resume, stop, seek и понятное состояние `music`.
- [x] Добавить dock-level volume control для канала `music`.
- [x] Сделать compact mode настоящей полупрозрачной кнопкой-шариком, а не укороченной панелью.
- [x] Убрать дублирующий player opt-in в пульте и останавливать уже играющий звук при отключении session audio игроком.
- [x] Добавить host drag/drop аудио в `AudioDesk`: upload в `assets/`, progress notification и cue в активный канал.
- [x] Добавить базовый `ambience` multi-loop для нескольких одновременных локальных лупов.
- [x] Довести mobile layout нижнего плеера.
- [x] Сохранить локальную деку/кнопки достаточно надёжно до world-level persistence: `gm/audio_deck.json`.
- [ ] Спроектировать track artwork/cover metadata для аудио без новой тяжёлой зависимости.

Принятое решение: аудио развивается как отдельный отключаемый local-first модуль с нижним доком и отдельным пультом/микшером. Core = локальные файлы; YouTube не входит в core; SoundCloud и YouTube идут только как future source extensions. См. `.pi/docs/gm-audio-desk.md` и `.pi/docs/audio-source-extensions.md`.

## 3. Notifications And Large Uploads

- [x] `FEAT-NOTIFICATIONS-001`: pure notification model/store foundation.
- [x] Добавить notification center + toast stack.
- [x] Добавить локальный upload progress UI для host asset uploads.
- [x] Добавить session/Yjs notification metadata channel для player -> GM approval request и GM approve/reject response.
- [x] `FEAT-ASSET-UPLOAD-APPROVAL-001`: player upload больше `50 MB` стартует только после GM approval и показывает session progress.
- [x] Подключить реальный player upload route после approved metadata request для текущего лимита `250 MB`.
- [ ] Добавить mirror в чат/события только как лог, не как source of truth.
- [ ] Спроектировать chunked/resumable upload для файлов больше текущего binary route limit.
- [x] `BUG-UI-004`: убрать notification button из зоны canvas toolbar.
- [x] `BUG-UI-005`: закрепить notification button сверху справа от canvas toolbar, чтобы он не перекрывал боковые панели и рабочую область.
- [x] `BUG-MULTIPLAYER-001`: добавить throttling для cursor awareness и session upload progress.
- [x] `BUG-MULTIPLAYER-001`: защитить Yjs WebSocket от oversized payload crash, версионировать IndexedDB cache и вычистить heavy inline canvas image payloads из shared sync.
- [x] `BUG-MULTIPLAYER-001`: стабилизировать canvas root writeback signatures, добавить no-op save guard и вернуть корректную навигацию canvas: wheel zoom, middle-button pan.
- [x] `BUG-ASSETS-004`: исправить canvas drag/drop image upload: progress notification для любого изображения, GM approval для player uploads больше `50 MB`, вставка canvas element только после успешного asset upload.

См. `.pi/docs/notification-system.md`.

## 4. Canvas And Assets

- [x] `BUG-ASSETS-006`: нормализовать asset URLs через `/api/assets/file?path=...`, чтобы preview файлов, canvas assets и AudioDesk не расходились по разным routes/origins.
- [x] `BUG-CANVAS-007`: защитить fog texture от zero-size render, который мог давать `drawImage` InvalidStateError при старте canvas.
- [x] `BUG-ASSETS-005`: восстановить `/api/assets/index`, чтобы тестовый мир снова показывал файлы во вкладке `Файлы` и в интерфейсе плеера.
- [x] `BUG-CANVAS-006`: GIF на canvas рендерится через DOM overlay поверх Konva, потому что layer redraw не оживил `giphy.gif`; ручная проверка ещё нужна.
- [x] GIF canvas render больше не грузит тот же `.gif` одновременно через `use-image` и DOM overlay; animated sources идут сразу в DOM `<img>`.
- [x] Asset Browser стал менее жадным к аудио: duration metadata грузится только при открытом аудио-фильтре, а не при любом просмотре файлов.
- [x] Добавить upload notifications/progress во все основные host upload входы: AssetBrowser, EntityImageBlock, canvas image tool.
- [x] Добавить video preview во вкладку `Файлы`, чтобы можно было проверять загрузку более тяжёлых media assets.
- [ ] Продолжить Excalidraw-grade canvas plan: advanced connector routing, line handles, binding UX, perf QA.
- [ ] Довести entity tokens/cards: permission matrix, richer hover card, custom frames from asset library.
- [ ] `FEAT-ASSETS-LOAD-001`: унифицировать loading/error states для ассетов у GM и players.
- [ ] `FEAT-PDF-001`: design-doc и первый viewer slice для PDF assets/canvas placement.
- [ ] Проверить manual QA для lasso, line drag/snap, undo/redo, card aspect ratio, drop routing.

## 5. Entity, Roles, Search

- [ ] Manual QA entity ID migration на копии мира.
- [x] Добавить foundation role/player identity: `players/<playerId>.json`, claim по имени, legacy `users/*`, выдача базовой роли через UI ГМа.
- [ ] Довести role/player identity: переименование, конфликт имён online/offline, миграция `_playerOwner` на `playerId`, явная session обратная связь.
- [ ] Довести entity visibility/access guards для private player-owned entities и canvas `i`.
- [ ] Полировать full-text search UX и saved searches.
- [ ] Реализовать `FEAT-I18N-002` внутри нового `FEAT-UI-002` pass: удобный перевод приложения и менеджер пользовательских локализаций.

## 6. UI Design System

- [x] Отдельно обсудить большой UI redesign: темы, palette tokens, entity window layout, скроллы, плотность интерфейса.
- [x] Поддерживать тему через variables/tokens, чтобы будущие custom themes не требовали переписывать компоненты: первый `theme.ts` token foundation и shell pass внесены.
- [ ] Не делать случайную декоративность; интерфейс должен быть рабочим GM/player cockpit.
- [x] Довести EntityWindow frame/context menu и MarkdownRenderer до первого semantic token слоя.
- [x] Довести core entity blocks (`Attribute/Skills/Competencies/Abilities/Resources/StatTooltip/TagPicker/EntityImage`) до semantic tokens.
- [ ] Довести оставшиеся старые hardcoded surfaces в ObjectSheet, InventoryBlock, AttackSheet, AssetBrowser, SettingsWindow и AudioDesk до semantic tokens.

## 7. Platform Future

- [ ] Не начинать Tauri/Rust/Steam/3D миграцию без отдельного решения.
- [ ] Держать код platform-neutral.
- [ ] Future 3D и Steam-friendly modules должны идти через `.pi/docs/platform-runtime-decision.md` и `.pi/3D_FUTURE_ANALYSIS.md`.

## Источники Правды

- `.pi/BUG_BACKLOG.md` — баги, приоритеты, batch keys.
- `.pi/FEATURE_BACKLOG.md` — новые функции, зависимости, acceptance criteria.
- `.pi/docs/gm-audio-desk.md` — принятый контур аудио-модуля, нижнего плеера и GM-пульта.
- `.pi/docs/audio-source-extensions.md` — SoundCloud/YouTube как extensions.
- `.pi/docs/notification-system.md` — уведомления и upload approvals.
- `.pi/docs/testing-multiplayer.md` — ручная QA.

## Следующий Безопасный Срез

1. ✅ Доделать cancel/retry для player uploads — **ГОТОВО**, запушено.
2. ✅ Доделать mobile layout нижнего `music` player и укрепить локальную деку до world-level persistence — **ГОТОВО**.
3. ✅ Спроектировать chunked/resumable upload для файлов больше `250 MB` — **ГОТОВО**, запушено.
4. ✅ Поднять UI redesign gate, внести решения владельца и первый semantic theme foundation — **ГОТОВО**.
5. ✅ EntityWindow/Markdown/notes surfaces на semantic tokens — **ГОТОВО**.
6. ✅ Core entity blocks (Attribute/Skills/Competencies/Abilities/Resources/StatTooltip/TagPicker/EntityImage) на semantic tokens — **ГОТОВО**.
7. [ ] Следующий UI-срез: ObjectSheet, InventoryBlock и AttackSheet surfaces на semantic tokens.
8. [ ] После UI foundation вернуться к Manual QA entity ID migration на копии мира + roles/player identity slice.
