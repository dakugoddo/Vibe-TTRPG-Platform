# Electron player delivery policy

> Дата: 2026-06-07
> Статус: принято как текущий desktop delivery baseline.

## Решение

На текущем этапе Electron build предназначен прежде всего для хоста/ГМа и локального desktop usage. Игроки остаются browser-first: подключаются к хосту по IP через обычный браузер и ничего не устанавливают.

## Почему так

- Local-first source of truth остаётся на машине хоста.
- Игрокам не нужен доступ к файловой системе мира.
- Browser-first путь проще тестировать через Radmin/Hamachi и не требует отдельного installer/update workflow для каждого игрока.
- Electron нужен сейчас для удобства хоста: native folder dialog, локальный server lifecycle, native asset reveal, future multi-window.

## Поддерживаемые артефакты

- `npm.cmd run desktop:pack` — unpacked/portable-like smoke build для быстрой проверки.
- `npm.cmd run desktop:dist` — portable exe и NSIS installer.
- Windows builds пока unsigned. SmartScreen warnings ожидаемы до отдельного signing решения.

## Что не входит в текущий baseline

- Auto-update.
- Code signing certificate.
- Отдельный player desktop client.
- Steam/Steam Networking packaging.
- Native multi-window/multi-monitor workflow.

## Следующий gate

Перед player desktop client нужен отдельный product gate:

- нужен ли игроку desktop вообще;
- как он выбирает сервер/мир;
- какие permissions доступны без host file access;
- как обновлять player app;
- остаётся ли browser client обязательным fallback.
