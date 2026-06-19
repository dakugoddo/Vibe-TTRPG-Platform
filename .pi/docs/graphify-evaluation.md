# Проверка Graphify

> Дата: 2026-06-19
> Статус: не внедрять как always-on замену `context-mode`

## Что проверено

- Установлен официальный пакет `graphifyy==0.8.43` через `uv tool install graphifyy`.
- Обычный shim `graphify` в текущей Codex/PowerShell среде падает с `Failed to canonicalize script path`.
- Прямой запуск работает:
  `C:\Users\GOD\AppData\Roaming\uv\tools\graphifyy\Scripts\python.exe -m graphify`.
- `graphify hook status` показывает, что post-commit/post-checkout hooks не установлены.
- Пробный code-only extract по `app/src/components` прошёл:
  `417 nodes`, `1522 edges`, без clustering.

## Результат

Graphify полезен как ручной архитектурный инструмент для верхнеуровневых связей между файлами и экспортируемыми функциями.
Для текущей разработки он не заменяет `context-mode`, `.pi/docs/code-map.md` и `rg`, потому что:

- без LLM API key он не анализирует docs/images и останавливается, если в корпусе есть не-code файлы;
- текущий graph по React/TSX не увидел важные вложенные обработчики `startTabPointerDrag` и `handleShellModuleDragStart`;
- query по Notes DnD оказался менее точным, чем прямой поиск по коду и существующие `.pi` guardrails;
- Codex integration изменяет агентские инструкции, а польза пока не доказана.

## Решение

Не включать Graphify hooks и не писать Graphify секцию в `AGENTS.md` сейчас.
Оставить возможность ручного запуска через прямой Python entrypoint для редких архитектурных проверок.

## Когда вернуться

- Если будет доступен LLM backend/API key для semantic extraction.
- Если Graphify начнёт стабильно видеть вложенные React handlers и локальные callback-и.
- Если понадобится отдельный HTML/JSON graph для большого release audit.
