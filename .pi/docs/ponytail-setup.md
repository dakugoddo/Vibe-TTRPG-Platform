# Ponytail Codex plugin setup

> Дата: 2026-06-15.
> Назначение: зафиксировать локальную установку Ponytail для будущих Codex-сессий.

## Что установлено

Ponytail установлен как Codex plugin вне workspace проекта, чтобы не загрязнять код приложения.

- Repository / marketplace: `https://github.com/DietrichGebert/ponytail`
- Version: `4.6.0`
- Plugin root: `C:\Users\GOD\.codex\plugins\cache\ponytail\ponytail\4.6.0`
- Config entry: `[plugins."ponytail@ponytail"] enabled = true`

Команды установки:

```powershell
& 'C:\Users\GOD\AppData\Local\OpenAI\Codex\bin\f1c7ee7a13db5fed\codex.exe' plugin marketplace add DietrichGebert/ponytail
& 'C:\Users\GOD\AppData\Local\OpenAI\Codex\bin\f1c7ee7a13db5fed\codex.exe' plugin add ponytail@ponytail
```

Доступные skills после перезапуска Codex-сессии:

- `ponytail`
- `ponytail-audit`
- `ponytail-debt`
- `ponytail-help`
- `ponytail-review`

## Как использовать в этом проекте

Ponytail полезен как дополнительный фильтр против лишней сложности:

- сначала использовать существующий код проекта, стандартную библиотеку и уже установленные зависимости;
- не добавлять новую абстракцию, если она не убирает реальную сложность;
- делать минимальный проверяемый срез вместо большого speculative foundation;
- для нетривиальной логики оставлять один focused check/test.

## Границы

Ponytail не отменяет проектные правила:

- `AGENTS.md`, `.pi/DEVELOPMENT_PLAN.md`, `.pi/planning/*` и профильные `.pi/docs/*` остаются главнее;
- нельзя упрощать права доступа, синхронизацию, сохранение файлов, валидацию на trust boundary, безопасность, accessibility basics и защиту от потери данных;
- крупные изменения по sync, permissions, `.md` формату, desktop packaging, plugin/mod API и глобальному UX всё равно проходят architecture/product gate;
- если пользователь явно просит полноценную реализацию, Ponytail может подсказать минимальный первый срез, но не должен спорить с утвержденным продуктовым решением.

## Примечание по hooks

В установленном plugin root есть папка `hooks`, но в `.codex-plugin` на момент установки виден только `plugin.json`. Поэтому для Vibe TTRPG Platform Ponytail считается skill/instruction plugin. Если будущая версия начнет регистрировать Codex lifecycle hooks, нужно отдельно проверить их поведение и trusted hashes перед тем, как полагаться на автоматическую активацию.
