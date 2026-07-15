# Активные баги и обязательная QA

> Здесь остаются только незавершённые дефекты и проверки. После подтверждения исправления запись удаляется отсюда и попадает в `NEXT_RELEASE.md`.

## Как читать приоритет

- `P0` — риск потери данных или приложение не запускается.
- `P1` — сломан основной workflow, права, приватность или multiplayer.
- `P2` — важная нестабильность с обходным путём.
- `P3` — заметная UX/визуальная шероховатость.

## P1 — проверить в первую очередь

### QA-ELECTRON-001 — Производительность и запуск desktop

Связано: `BUG-ELECTRON-002`, `BUG-ELECTRON-003`, `FEAT-PLATFORM-ELECTRON-001`.

- **Что уже подтверждено автоматически:** изолированный `desktop:pack` и `desktop:dist`; полный unpacked artifact с embedded server/locales/preview-world; packaged запуск и открытие временного Preview World; ответы world/entities/assets API; чистый renderer reload без runtime/HTTP errors; graceful exit с остановкой server и освобождением `3001`; fallback dev-port `5173 → 5174`.
- **Что осталось проверить владельцу:** запуск portable и установка/удаление NSIS на действительно чистой Windows-машине, SmartScreen/shortcut UX, субъективная плавность middle-button pan и открытия entity windows.
- **Готово, когда:** portable и installer проходят clean-machine smoke; pan ощущается плавным; launcher корректно выбирает свободный порт.
- **Статус:** автоматический packaged/runtime smoke пройден; `Нужна проверка владельца / clean machine`.

### QA-MULTIPLAYER-001 — Radmin/Hamachi и большие Yjs payload

Связано: `BUG-MULTIPLAYER-001`.

- **Что проверить:** подключение игрока по IP, завершение sync большого мира, responsive cursors, отсутствие server crash.
- **Риск:** основной сетевой сценарий вне локальной машины.
- **Статус:** mitigation есть, `Нужна ручная GM/player QA`.

### QA-PERMISSIONS-001 — Раздельные права окна сущности и её содержимого

- **Что проверить:** игрок может перемещать/закреплять доступное ему окно сущности на canvas только в пределах разрешённых действий с размещением, но это не даёт права редактировать закрытое содержимое самой сущности.
- **Почему важно:** право управлять расположением окна не должно повышать права на игровые данные.
- **Готово, когда:** GM/player smoke подтверждает независимость canvas placement permissions и entity-content permissions для pinned entity windows.
- **Статус:** `Нужна ручная GM/player QA`.

### QA-ASSETS-001 — Media preview на host и player

Связано: `BUG-ASSETS-006`, `FEAT-ASSETS-LOAD-001`.

- **Что проверить:** image/video/audio previews через `/api/assets/file?path=...`, включая пробелы и кириллицу.
- **Статус:** fix есть, `Нужна ручная QA`.

## P2 — тематические QA-пакеты

### QA-USABILITY-001 — Общий pre-release usability pack

Связано: `FEAT-USABILITY-001`.

- Проверить asset loading/error/retry, entity quick actions, Notes discoverability, Audio dock states, canvas card readability, startup clarity и Settings reset controls как один пользовательский smoke.
- **Статус:** automated release QA пройдена; `Нужна ручная проверка перед beta tag`.
- **Чеклист:** `.pi/docs/pre-release-usability-pack.md`.

### QA-NOTES-001 — Notes workspace layout, tabs и shell modules

Объединяет: `BUG-NOTES-001`, `BUG-NOTES-002`, `BUG-NOTES-003`, `BUG-NOTES-004`, `BUG-NOTES-005`, `BUG-NOTES-006`, `BUG-NOTES-007`, `BUG-NOTES-008`, `BUG-NOTES-009`, `BUG-NOTES-010`, `BUG-NOTES-011`, `FEAT-WORKSPACE-001`, `FEAT-WORKSPACE-002`, `FEAT-WORKSPACE-003`, `FEAT-WORKSPACE-004`.

Проверить одним сценарным проходом вместо одиннадцати разрозненных багов:

1. Vault/Search/wiki-link открывают новую сущность отдельным editor leaf; повторное открытие фокусирует существующую.
2. Center-drop объединяет вкладки; edge-drop создаёт split; нет browser ghost и full-pane синего overlay.
3. `Editor`, `Vault`, `Context`, `Notifications`, `Search`, `Graph`, `Audio` перемещаются между left/center/right.
4. Пустые области остаются доступными drop-rails; left/right создаёт row, top/bottom — column; layout переживает reload.
5. Нет лишней `G1`-шапки, scrolling принадлежит модулю, reset не закрывает вкладки.
6. Embedded Audio показывает одну шапку и не останавливает playback при Canvas/Notes switch.
7. Legacy `localStorage` layout безопасно мигрирует в storage v2.

- **Статус:** fixes реализованы, `Нужна owner QA`.
- **Связано:** `.pi/docs/notes-workspace-obsidian-redesign.md`.

### QA-CANVAS-001 — Canvas regressions и drawing behavior

Объединяет: `BUG-CANVAS-007`, `BUG-CANVAS-006B`, `BUG-CANVAS-009`, `BUG-CANVAS-010`, `FEAT-CANVAS-CLIPBOARD-001`, `FEAT-CANVAS-EXCALIDRAW-001`.

- Запуск мира без fog `drawImage InvalidStateError`.
- GIF overlay: playback, selection, drag, resize.
- Stage остаётся viewport-sized; pan не падает к ~10 FPS.
- Двухточечная curved line остаётся прямой; сглаживание начинается с опорной точки.
- После фокуса canvas: paste text создаёт rectangle, PNG/JPG/GIF загружаются как assets; paste в input/entity window ничего не создаёт на canvas.
- Hotkeys `1–7`, resize grid snap и edge line binding работают ожидаемо.
- **Статус:** `Нужна owner QA`.

### QA-I18N-001 — English UI и world locale editor

Связано: `BUG-I18N-003`, `FEAT-I18N-002`.

- English Settings/Notes shell labels без русских stable UI strings.
- Electron-кнопка открывает встроенную папку locales.
- World locale editor: key table, filters, JSON draft, preview, save, `.bak`, rollback, import/export.
- Host публикует supported locale snapshot, player применяет без File API.
- **Статус:** foundation есть, `Нужна QA по .pi/docs/world-locale-editor-qa.md`.

### QA-SHEETS-001 — Published note layout workflow

Связано: `FEAT-ENTITY-UI-BUILDER-001`.

- Валидный/невалидный draft, preview, Apply и видимое применение к обычной заметке.
- Второй publish создаёт `.bak`; rollback и reset не теряют known-good schema.
- Player получает только public runtime schema; mutation/management остаются Host-only и world-bound.
- Reload сохраняет результат, invalid schema безопасно возвращает built-in fallback.
- **Статус:** production-срез реализован, независимо проверен и сохранён в Git; остаётся owner smoke перечисленных сценариев перед переносом в release changelog.

## P3 — polish после основных QA

- Compact card/entity sheet readability на всех themes/densities (`BUG-UI-006`, `FEAT-UI-002`).
- Оставшиеся hardcoded UI surfaces только если это chrome, а не данные мира.
- Manual English smoke основных экранов.

## Закрытые regression-правила

Технические уроки не хранятся здесь. Они перенесены в профильные `.pi/docs`, `.pi/rules` и `skills/*`. Если такой regression повторяется, создаётся новая активная запись с новой проверкой, а не возвращается старая история целиком.
