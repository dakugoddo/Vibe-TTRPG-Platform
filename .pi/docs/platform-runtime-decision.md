# Platform Runtime Decision

> Дата: 2026-05-21
> Обновлено: 2026-06-06
> Статус: Electron packaging foundation implemented. Browser-first режим остаётся rollback path.

## Текущий вывод

Фундамент проекта не переписывать. React + TypeScript + Vite frontend, Express/Yjs server и local-first `.md` world files остаются основной базой разработки.

Рабочий desktop path на ближайший этап изменён решением владельца 2026-06-05:

1. Закончить UI foundation.
2. После UI сделать Electron migration.
3. После Electron foundation вернуться к полноценному Notes workspace mode и multi-window/multi-monitor workflow.

Актуальный gate: `.pi/docs/electron-desktop-migration-plan.md`.

Обновление 2026-06-06: Electron foundation доведён до packaged desktop path. Внесены shell, preload marker, Vite `base: './'`, desktop scripts, one-command dev launcher, typed preload IPC, native folder dialog, `electron-builder`, `desktop:pack`/`desktop:dist`, compiled `server/dist` и packaged embedded server import из `resources/server/dist`. Собранный exe smoke-test подтвердил `/api/world/status` и освобождение порта после закрытия. Player delivery policy, icon/signing polish и native asset actions ещё не решены.

Прежний Tauri-first вариант считается историческим сравнением, а не ближайшим next step. Возвращаться к Tauri/Rust можно позже отдельным architecture gate, если Electron proof покажет неприемлемые ограничения.

## Почему не переписывать сейчас

- Основная ценность проекта сейчас в Entity model, `.md` source of truth, Roll Engine, canvas, permissions и GM workflow, а не в desktop shell.
- Перепись runtime затронет file manager, world manager, websocket lifecycle, watcher, permissions и packaging одновременно.
- UI foundation ещё стабилизируется; переносить нестабильный UX в desktop shell рано.
- Steam/3D требуют отдельных gates: Workshop, Cloud paths, networking/lobbies, app ID, SDK, deployment, 3D viewport contract.

## Почему Electron выбран ближайшим desktop path

- Текущий проект уже использует Node/Express, поэтому Electron ближе к существующему runtime.
- Chromium runtime снижает риск canvas/audio/DOM overlay отличий относительно текущей разработки в браузере.
- Server lifecycle можно доказать без переписывания backend на Rust.
- Multi-window/multi-monitor логичнее строить после desktop shell proof, а не через browser popout.

Минусы Electron - размер приложения и baseline RAM. На этом этапе это менее опасно, чем преждевременная перепись server/file layer.

## Альтернативы

| Вариант | Выгода | Риск | Текущий статус |
|---------|--------|------|----------------|
| Browser-first + `start.bat` | Минимальный риск, текущая разработка быстрая, игрокам достаточно браузера | Не выглядит как полноценное desktop/Steam app | Оставить обязательным rollback path |
| Electron shell + текущий server | Прямой перенос Node + Chromium, меньше WebView surprises | Больший размер, main/renderer security, server lifecycle | Ближайший desktop path после UI |
| Tauri shell + Node sidecar | Меньший desktop bundle | WebView differences, sidecar/package quirks | Исторический вариант, не ближайший next step |
| Tauri shell + Rust backend | Малый runtime, сильный file/process control | Большая перепись server/file layer | Только после отдельного будущего gate |
| Neutralino | Лёгкий shell | Меньше ecosystem для сложного server/Steam path | Не основной кандидат |
| Godot/Unity | Сильный 3D/game runtime | Полная перепись UI, Entity и web workflow | Не делать для основной платформы |
| Three.js/Babylon.js внутри React | Быстрый 3D prototype без runtime migration | Нужен отдельный viewport contract | Можно как feature prototype позже |

## Практический курс

1. Продолжать foundation-first разработку в текущем web-stack.
2. Electron dependencies уже добавлены как desktop proof; не тянуть Electron APIs в browser runtime.
3. Продолжать Electron малыми proof-срезами: server lifecycle, native dialogs, packaging decision.
4. Сохранить browser-first mode как обязательный rollback path для dev/player clients.
5. После Electron proof вернуться к native windows, multi-monitor и полноценному Notes workspace mode.
6. 3D/Steam вести отдельными design gates, не смешивать с первым Electron proof.

## Что Codex может делать сам

- Поддерживать platform-neutral код.
- Не завязывать app/runtime API на browser-only assumptions без явной причины.
- Подготовить Electron prototype checklist и smoke tests.
- Вести docs/backlog так, чтобы следующий агент не вернулся к устаревшему Tauri-first порядку.

## Что требует отдельного решения владельца

- Когда UI foundation считается достаточно стабильным для Electron prototype.
- Нужна ли поддержка старого browser-only режима после desktop release.
- Какие desktop windows нужны первыми: notes, canvas, assets, player screen или GM dashboard.
- Когда возвращаться к Steamworks SDK, Cloud/Workshop и 3D.

## Проверенные источники для будущего gate

- Electron process model docs: `https://www.electronjs.org/docs/latest/tutorial/process-model`
- Electron security docs: `https://www.electronjs.org/docs/latest/tutorial/security`
- Steamworks docs: `https://partner.steamgames.com/doc/features/workshop/implementation`, `https://partner.steamgames.com/doc/features/cloud`
- Three.js/Babylon docs: `https://threejs.org/manual/en/fundamentals.html`, `https://www.babylonjs.com/specifications`
