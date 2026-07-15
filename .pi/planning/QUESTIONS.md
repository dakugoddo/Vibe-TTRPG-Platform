# Вопросы и решения владельца

> Здесь только развилки, где агент не должен угадывать. После ответа решение переносится в `IDEAS.md`/design-doc/roadmap, а закрытый вопрос удаляется отсюда или кратко архивируется в соответствующем документе.

## QUESTION-001 — Следующий пользовательский срез Sheet Builder

**Почему нужен выбор:** foundation и published layout заметки уже доказали архитектуру. Следующий шаг может оптимизировать удобство ГМа или универсальность системы, но делать оба одновременно слишком широко.

**Варианты:**

1. **Визуальные controls для заметки** — добавлять/удалять/reorder Markdown/layout blocks без ручного JSON.
   - Плюс: сразу улучшает существующий GM workflow.
   - Минус: пока не доказывает второй тип сущности.
2. **Второй production entity type** — например object или character section на той же schema/registry.
   - Плюс: проверяет переиспользование архитектуры.
   - Минус: authoring остаётся техническим JSON workflow.
3. **Formula/HP/resource engine сейчас.**
   - Не рекомендуется: большой внутренний фундамент без утверждённого первого пользовательского сценария.

**Рекомендация агента:** вариант 1, затем отдельный минимальный срез второго entity type.

**Статус:** `Ждёт ответа владельца перед следующим Sheet Builder срезом`.

## QUESTION-002 — Windows code signing

**Почему нужен выбор:** следующий публичный installer может показывать предупреждения Windows SmartScreen.

**Нужно решить:** покупать/настраивать signing certificate для ближайшего релиза или явно выпускать unsigned beta с documented warning.

**Рекомендация агента:** для beta допустим unsigned build с честной инструкцией; signing решать до stable/public promotion.

**Статус:** `Не блокирует текущую разработку, блокирует release policy`.

## QUESTION-003 — Нужен ли WYSIWYG после QA текущего Markdown workflow

**Почему не спрашиваем прямо сейчас:** без owner QA неизвестно, является ли current source/preview/split реальной проблемой.

**Следующее действие:** сначала проверить toolbar, autocomplete, embeds и preview. Если редактирование всё ещё неудобно — подготовить сравнение editor dependencies и Markdown round-trip рисков.

**Статус:** `Отложен до QA, не является утверждённой фичей`.

## QUESTION-004 — Расширенный PDF viewer

**Выбор появится только при подтверждённой потребности:**

- лёгкий page preview;
- полноценный zoom/search viewer;
- linked PDF pages/cards на canvas.

**Рекомендация агента:** не добавлять тяжёлую зависимость, пока владелец не назовёт реальный игровой сценарий, который не покрывает native preview.

**Статус:** `Не блокирует roadmap`.

## Закрытые базовые решения

Эти решения уже приняты и не требуют повторного вопроса без новых обстоятельств:

- проект local-first, `.md` + YAML остаются source of truth;
- Obsidian — behavioral UX reference, не визуальный шаблон;
- никакого arbitrary JavaScript в sheet blocks;
- новые зависимости, permission model, storage/sync contracts и plugin/mod architecture требуют явного OK;
- внутренние tracer/demo-функции не остаются в production без пользовательской ценности;
- native multi-window начинается только после Electron clean-machine gate.
