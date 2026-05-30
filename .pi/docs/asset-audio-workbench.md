# Asset browser and audio workbench

> Дата: 2026-05-25  
> Статус: research/design draft для `FEAT-ASSETS-001` и аудио foundation; Asset Browser MVP, stable asset IDs, audio duration metadata, Web Audio buffer cache, audio session command foundation, canvas image upload path, inline canvas image migration и host file actions внесены. Live audio controls больше не живут во вкладке `Файлы`.

## Цель

ГМ должен видеть файлы мира из интерфейса: изображения сейчас, позже аудио, 3D-модели и другие ассеты. На этой базе строится аудио-модуль, но сама вкладка `Файлы` остаётся библиотекой ассетов, а не плеером.

## Архитектурное решение

### Asset Browser

MVP:

- server endpoint читает asset-папки мира;
- UI показывает список файлов с типами: `image`, `audio`, `model`, `other`;
- preview для изображений;
- фильтры по типу и поиску;
- сортировка по имени, новизне, размеру и типу;
- копирование asset reference для сущностей/canvas;
- стабильный path-based `asset.id`, чтобы будущий audio sync ссылался на ассет, а не на случайный UI label.
- быстрая загрузка небольших ассетов через Host UI; крупные аудио/модели лучше копировать напрямую в `assets/`, пока upload идёт через JSON/base64.

Внесённый MVP:

- вкладка `Файлы` в правой шторке;
- чтение текущего `/api/assets` для совместимости и нового `/api/assets/index` для metadata;
- рекурсивный индекс `assets/` с `path`, `relativePath`, `id`, MIME, created/modified timestamps;
- фильтры `Все/Фото/Аудио/3D/Видео/Прочее`;
- сортировка `Имя/Новые/Размер/Тип`;
- тип, размер и modified timestamp на сервере;
- preview для изображений;
- `Показать в проводнике` через host-only `/api/assets/show-in-explorer`;
- удаление asset-файла через guarded `DELETE /api/assets/file` с UI-confirm и предупреждением о битых ссылках;
- upload control для небольших файлов с обновлением индекса после загрузки;
- audio duration metadata отображается в списке, но play/queue/playlist controls вынесены из вкладки `Файлы` в отдельный аудио-модуль.
- `EntityImageBlock` использует тот же рекурсивный индекс для выбора изображения сущности и сохраняет `asset.path`.
- Host/ГМ service-блок во вкладке `Файлы` находит старые canvas `imageUrl: data:*` и переносит их в `assets/`, заменяя draw element на `imageAssetPath`.

Текущий индекс:

```ts
interface AssetRecord {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  type: 'image' | 'audio' | 'model' | 'video' | 'other';
  mime: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  url: string;
}
```

Source of truth остаётся файловой системой. Индекс можно кэшировать, но он не должен становиться единственным источником правды.

### Audio Workbench

Рекомендуемый первый подход:

- длинная музыка/эмбиент: `HTMLAudioElement`/media element, потому что браузер уже оптимизирует streaming/buffering;
- короткие SFX: Web Audio API, `AudioContext`, decoded buffers и gain nodes для низкой задержки, громкости и fade;
- микшер: отдельный channel volume per channel (`music`, `ambience`, `sfx`, `voice`), Web Audio path использует gain node;
- синхронизация игрокам: не стримить raw audio на MVP, а отправлять команду через server/Yjs: `play assetId at timestamp, volume, loop, fade`;
- WebRTC оставить для future live-stream/microphone/desktop-audio сценариев, где реально нужен поток.

Внесённый sync foundation:

- `AudioSessionCommand` живёт в глобальном Yjs doc как последнее audio-событие;
- команда содержит `assetId`, `assetPath`, `assetName`, `volume`, `startedAt`, `senderId`;
- Host/GM audio UI должен отправлять `play/stop` команды из отдельного аудио-модуля, а не из `Файлы`;
- команда может содержать `channel`; старые команды без канала считаются `sfx`;
- player-клиент не видит список файлов, но может вручную включить `Звук сессии`;
- `AudioSessionBridge` смонтирован на уровне `App`, поэтому приёмник продолжает работать независимо от правой шторки/файлов;
- старые SFX-команды старше 30 секунд игнорируются, чтобы IndexedDB/Yjs не запускал древние эффекты после переподключения.

Внесённый metadata foundation:

- audio duration читается на клиенте через offscreen `HTMLAudioElement` с `preload="metadata"`;
- сервер не делает ffmpeg/ffprobe-анализ и остаётся быстрым файловым индексом;
- duration хранится только в UI state браузера, потому что это вспомогательная metadata для списка/будущих плейлистов, а не source of truth.

Внесённый playback foundation:

- `app/src/services/audioPlayback.ts` стал общей точкой для `HTMLAudioElement` playback, duration metadata, volume clamp, local fade in/out и audio-output priming;
- service содержит channel foundation: `music`, `ambience`, `sfx`, `voice`, per-channel volume clamp, localStorage persistence и effective volume для media/Web Audio путей;
- `useAudioChannelVolumes()` синхронизирует React UI с channel volumes и служит будущей точкой подключения глобального микшера;
- `AudioDesk`/будущий `AudioControlDock` и `AudioSessionBridge` используют общий playback path;
- player opt-in `Звук сессии` вызывает `primeAudioOutput()`, чтобы заранее возобновить `AudioContext` в user gesture перед будущими SFX-командами.

Внесённый Web Audio foundation:

- короткие SFX определяются через `shouldUseBufferedPlayback`: duration до 12 секунд или маленький файл без duration metadata;
- `preloadAudioBuffer()` загружает audio asset через `fetch`, декодирует через `AudioContext.decodeAudioData` и хранит promise в LRU-like cache до 24 элементов;
- `startBufferedSfxPlayback()` создаёт новый `AudioBufferSourceNode` на каждый play, подключает gain node для громкости и fallback'ится на `HTMLAudioElement`, если Web Audio/fetch недоступны или decode падает;
- Host audio module использует buffered path для коротких SFX, длинные треки остаются на media element;
- player-side `AudioSessionBridge` тоже идёт через buffered path с media fallback, поэтому будущие soundboard-команды будут использовать тот же фундамент.
- текущие команды поддерживают канал; будущие music/ambience плейлисты смогут использовать тот же контракт без изменения формата команды.
- вкладка `Файлы` больше не показывает локальный микшер каналов; микшер должен жить в отдельном аудио-модуле.

## Почему не raw streaming сразу

Для настольной VTT обычно важнее, чтобы все клиенты воспроизводили один и тот же asset синхронно. Это дешевле и стабильнее, чем гонять аудио-поток от ГМа:

- меньше нагрузка на сеть;
- проще работает через Hamachi/Radmin;
- легче сохранять состояние сцены;
- проще повторное подключение игрока.

## Ограничения браузера

- Нужна user gesture для старта аудио: в UI нужен явный `Включить звук`.
- Нужно graceful fallback, если asset отсутствует у клиента или не загрузился с host server.
- Для будущего Steam/Tauri эта модель переносится легче: asset browser и audio commands остаются теми же.

## Срезы

### Slice 1: Asset Browser MVP

- [x] Endpoint list assets.
- [x] Stable path-based asset IDs.
- [x] Recursive folders under `assets/`.
- [x] UI drawer/tab with filters.
- [x] Asset sorting by name, modified date, size and type.
- [x] Image preview.
- [x] Copy/use asset reference.
- [x] Small asset upload through Host UI.
- [x] Drag image assets from Asset Browser onto canvas as path-based image draw elements.
- [x] Show asset in Windows Explorer.
- [x] Delete asset file with confirmation.

### Slice 2: Audio foundation

- [x] Local preview prototype был создан и затем выведен из `Файлы` после product feedback.
- [x] Audio duration metadata через browser media metadata.
- [x] Общий `audioPlayback` service для media playback и audio-output priming.
- [x] Audio enable/session command foundation для multiplayer.
- [x] Web Audio buffer cache for short SFX.
- [x] Audio channel contract (`music`, `ambience`, `sfx`, `voice`) and effective volume helper.
- [x] Compact local channel mixer in Asset Browser.

### Slice 3: Music playlists

- [x] Local track queue.
- [x] Local saved playlists from the current queue.
- [x] Local explicit auto-next for queue/loaded playlist playback.
- [x] Loop and local fade-in/fade-out presets.
- [ ] Crossfade.
- Full session mixer panel, presets and GM/player volume policy.

### Slice 4: Multiplayer sync

- GM sends playback commands.
- Players opt in to audio.
- Reconnect restores currently playing state.

### Slice 5: GM audio desk

- [x] Design draft: `.pi/docs/gm-audio-desk.md`.
- [x] Pure deck model for normalized cues/playlists/scenes: `app/src/utils/audioDeckModel.ts`.
- [x] First dedicated GM desk UI shell: `app/src/components/ui/AudioDesk.tsx`, right drawer tab `Звук`, local cue buttons, channel stop/all-stop, mixer and optional broadcast through the existing audio command bridge.
- [x] Player-side `AudioSessionBridge` now keeps playback handles per audio channel, so music/ambience/SFX commands do not force a single global audio slot.
- [ ] Session playlist commands and shared reconnect-safe channel state.
- [ ] Player-delegated SFX buttons after role/player identity is stable.

## 2026-05-22 update: canvas image asset drop

- `AssetBrowser` image cards now write a typed drag payload (`application/x-vibe-asset`).
- `InfiniteCanvas` accepts that payload, loads natural image dimensions, scales to max 600 px and creates an image draw element.
- The draw element stores `imageAssetPath` and resolves it through `getAssetUrl()` during render, so clients connected by host IP do not persist a stale `localhost` URL.
- Image tool and direct image drop now also try to upload the file into `assets/` on Host and store `imageAssetPath`; if upload fails, they fall back to the old inline data URL path.
- Image tool click now opens `CanvasImagePicker`: Host can search existing image assets and place them on the clicked point, or upload a new file from the same picker.
- Existing canvas images that were already saved as `imageUrl: data:*` are detected by `AssetBrowser`; Host/ГМ can migrate them into `assets/`, and the canvas draw element is rewritten to `imageAssetPath`.
- Focused coverage: `app/src/utils/assetDrag.test.ts`, `app/src/utils/canvasInlineImageMigration.test.ts`.

## 2026-05-22 update: audio channel play/broadcast

- Historical note: Host audio preview prototype had an explicit channel selector (`music`, `ambience`, `sfx`, `voice`) and loop toggle before local play or player broadcast.
- `AudioSessionCommand` carries optional `duration` and `loop` fields, preparing the command contract for playlists and reconnect restoration.
- Player-side `AudioSessionBridge` keeps short SFX on Web Audio where useful, but treats `music` and `ambience` as media playback with a longer reconnect window and offset seeking.
- Historical note: `AssetBrowser` included a local audio queue persisted in `localStorage`; after owner feedback this UI moved out of `Файлы` and into the standalone audio-module plan.

## 2026-05-23 update: local audio playlists

- `app/src/utils/audioPlaylists.ts` stores a pure local playlist model with normalization, dedupe, upsert and edit helpers.
- Historical prototype: `AssetBrowser` could save the current audio queue into `localStorage` playlists, load a saved playlist back into the queue and delete local playlists.
- Playlist rows showed available/total asset counts, so missing files after manual asset cleanup were visible without breaking the UI.
- Audio preview had an explicit auto-next toggle; this belongs in the standalone audio module now.
- Audio preview had fade presets (`Off`, `1s`, `3s`) backed by `audioPlayback` fade helpers for both media playback and Web Audio buffered SFX.
- `AudioSessionCommand.fadeMs` now carries the selected fade to opted-in players, so host play/stop broadcasts can fade without adding shared playlist state.
- Queue/playlists are no longer part of `AssetBrowser`; shared session playlist state, crossfade and reconnect restoration belong to `FEAT-AUDIO-003`.

## 2026-05-25 update: audio UI placement rollback

- Owner feedback: audio controls should be a separate menu/module, not controls inside `Файлы` and not a right-drawer database tab.
- `AssetBrowser` keeps audio metadata/duration, but play/queue/playlist/mixer controls were removed from the file browser UI.
- `AudioDesk` moved to the separate root-level `AudioControlDock`, so right-drawer tab switching no longer unmounts playback.
- 2026-05-28: `AudioControlDock` compact state is a translucent orb; the expanded bar controls only the `music` transport and opens `AudioDesk`.
- 2026-05-28: `AudioDesk` accepts host drag/drop audio uploads into `assets/`, creates a cue in the active channel, and sends upload progress through notifications.
- 2026-05-28: `ambience` uses multiple simultaneous handles instead of a single channel slot. This is command-based only; reconnect-safe ambience snapshots remain future work.
- Full bottom player + mixer popup is tracked as `FEAT-AUDIO-003` and must pass Architecture/Product gate before final implementation.

## 2026-05-24 update: asset file actions

- `AssetBrowser` replaces copy-path action with `Показать в проводнике`; the server resolves the asset path inside `assets/` and launches Windows Explorer with the file selected.
- File deletion is available from the asset card and goes through the shared `ConfirmDialog`.
- Deletion is guarded by `resolveAssetPath`, only deletes files under the current world `assets/` and refreshes the index.
- Current limitation: the UI warns about broken references but does not yet scan every entity/canvas before deletion.

## Acceptance criteria

- [ ] ГМ видит загруженные изображения через UI.
- [x] ГМ может открыть asset в проводнике и удалить временный asset через подтверждение.
- [x] Старые inline canvas images можно безопасно найти и экспортировать в `assets/`.
- [x] Asset browser не ломает `.md` source of truth.
- [x] Audio MVP не требует внешних сервисов.
- [x] Short SFX могут идти через Web Audio buffer cache с fallback на media element.
- [x] Local fade-in/fade-out работает через общий playback service и не меняет `.md` source of truth.
- [ ] Локальные/сессионные очереди и плейлисты будут реализованы в standalone audio module, не во вкладке `Файлы`.
- [x] Игроки не получают доступ к GM-only asset metadata через UI.
- [x] Будущие audio/model asset types не требуют переписывать браузер файлов.
