# Проверка и установка Graphify

> Дата: 2026-06-19
> Статус: установлен project-scoped для Codex, первый полный граф ещё не построен

## Что проверено

- Установлен официальный пакет `graphifyy==0.8.43` через `uv tool install graphifyy`.
- Обычный shim `graphify` в текущей Codex/PowerShell среде падает с `Failed to canonicalize script path`.
- Прямой запуск работает:
  `C:\Users\GOD\AppData\Roaming\uv\tools\graphifyy\Scripts\python.exe -m graphify`.
- Пробный code-only extract по `app/src/components` прошёл:
  `417 nodes`, `1522 edges`, без clustering.
- Project-scoped Codex install выполнен через:
  `python -m graphify install --project --platform codex`.

## Что установлено

- `.codex/skills/graphify/SKILL.md`
- `.codex/skills/graphify/references/`
- `.codex/hooks.json`
- Graphify section в `AGENTS.md`
- В `C:\Users\GOD\.codex\config.toml` добавлено `multi_agent = true` в `[features]`
- `.gitignore` оставляет `.codex` локальным, но разрешает версионировать только `.codex/hooks.json` и `.codex/skills/graphify/**`

Installer создал hook на `C:\Users\GOD\.local\bin\graphify.EXE`, но этот shim у нас не работает.
Hook вручную исправлен на рабочий Python entrypoint:

```powershell
C:\Users\GOD\AppData\Roaming\uv\tools\graphifyy\Scripts\python.exe -m graphify hook-check
```

## Решение

Graphify установлен как дополнительный project-scoped инструмент для Codex.
Он не заменяет `context-mode`, потому что `context-mode` всё ещё нужен для session memory и обработки больших outputs.

Полная польза Graphify начнётся после первого полноценного `graphify-out/graph.json`.
Для Codex команда из README: `$graphify .`.

## Следующий шаг после перезапуска Codex

1. Перезапустить Codex, чтобы подхватились `.codex/skills/graphify` и `.codex/hooks.json`.
2. После перезапуска проверить, что Graphify skill виден в списке навыков.
3. Запустить в проекте:
   `$graphify .`
4. После построения графа использовать:
   - `graphify query "<вопрос>"`
   - `graphify explain "<узел>"`
   - `graphify path "<A>" "<B>"`

## Риски

- Без LLM backend/API key или работающей host-agent semantic extraction первый полный граф может быть только code-heavy.
- Большой full-project graph может занять заметное время и создать много файлов в `graphify-out/`.
- `graphify-out/` нужно отдельно решить: коммитить как артефакт или держать локальным generated output.
