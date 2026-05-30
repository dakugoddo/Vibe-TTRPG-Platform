# GM audio desk

> Status: accepted working spec for `FEAT-AUDIO-002/003`; foundation in progress.
> Date: 2026-05-28.

## Goal

The GM needs a dedicated audio module for running a session: bottom persistent player, music playlists, ambience loops, one-shot SFX buttons, optional player-facing SFX buttons, channel volumes, fades, and eventually reconnect-safe session state.

This must not turn the asset browser or right database drawer into the music UI. `AssetBrowser` remains the file library: upload, browse, delete, reveal in Explorer, drag images/models/audio metadata later. The audio module becomes a focused control surface built on top of stable asset IDs and the shared `audioPlayback` service.

## Owner Feedback 2026-05-25

- Audio should be its own menu/module, not a database tab and not controls inside `Файлы`.
- Music must keep playing while the user switches between database/chat/dice/canvas UI.
- Target UI: thin stylish bottom-center player, collapsible to a translucent play/music button.
- A separate mixer/control desk opens from that player.
- `music`: one primary track at a time, normal player controls and progress.
- `ambience`: multiple looped background sounds, each with its own volume.
- `sfx`: one-shot buttons.
- `voice`: allowed for now, but should be easy to remove.
- Drag/drop audio into the player and assign/change category.
- Players with permissions, not only GM, may control audio later.
- URL tracks, starting with YouTube links, require research and explicit approval before implementation.
- Complex/global features must pass Architecture/Product gate before final UI or API choices are coded.
- 2026-05-26: owner confirmed that mixer channel volume now changes already playing sound.

## Accepted Direction 2026-05-28

- Audio is a standalone optional module, not a tab inside the database/files UI.
- Local uploaded files are the core source for the MVP.
- The bottom dock stays mounted outside drawers/windows so music survives UI tab switches.
- Compact mode is a translucent orb; expanded mode is the music transport.
- The GM desk/mixer opens from the dock and owns cue management.
- `music` allows one active track; `ambience` allows many looped sounds; `sfx` is one-shot; `voice` stays experimental/easy to remove.
- Players must explicitly enable session audio, and disabling it stops local playback.
- YouTube is deferred to a future extension, not core.
- SoundCloud is a future extension candidate only after official API/policy review.
- Remaining product gates are world-level persistence, reconnect-safe snapshots, player delegation/permissions, final visual design, and external source APIs.

## Research Anchors

- [MDN: HTMLMediaElement.play](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play): `play()` returns a Promise and can reject when browser autoplay policy blocks script-started playback.
- [MDN: Web Audio API best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices): create/resume `AudioContext` from a user gesture; keep Web Audio for short decoded effects.
- [MDN: MediaSession](https://developer.mozilla.org/en-US/docs/Web/API/MediaSession): useful later for OS-level media metadata/actions, not required for the first VTT desk slice.
- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference): official path for embedding/controlling YouTube playback through an iframe player; not raw audio extraction.
- [YouTube Data API Overview](https://developers.google.com/youtube/v3/getting-started): metadata/search API needs Google project/API setup and uses quotas.
- [YouTube API Services Terms](https://developers.google.com/youtube/terms/api-services-terms-of-service): YouTube integration must comply with the API agreement; do not implement unofficial stream extraction.

## YouTube Integration Notes

Current conclusion: support for “track by YouTube link” should start as an approved design, not an immediate code slice.

Reasoning:

- The safe/official playback route is embedded YouTube player control through the IFrame Player API.
- The Data API is useful for metadata/search/playlists, but it is quota-bound and requires API credentials.
- Extracting raw audio from YouTube links is not the route for this app; it is legally/product-wise risky and conflicts with the local-first asset model.
- Browser autoplay policy still applies. Player clients may need an explicit opt-in/gesture before session audio starts.
- Sync design should store `source: 'youtube'`, `videoId`, `startedAt`, `offset`, `channel`, `loop/volume`, and then each client controls its own iframe player.

## Product Direction

The desk should feel like a compact GM control panel, not a consumer music player:

- dense, scan-friendly controls;
- explicit channel separation: `music`, `ambience`, `sfx`, `voice`;
- clear distinction between local preview and broadcast to opted-in players;
- no surprise autoplay for players; the current `Звук сессии` opt-in remains required;
- session-state commands reference asset IDs/paths, never raw audio streams;
- player-delegated buttons are permissions/policy data, not a separate audio path.

## UI Shape

First stable layout:

1. Bottom dock: thin persistent player, centered, unobtrusive, with collapse button.
2. Bottom dock collapsed state: translucent play/music button.
3. Main player strip: current music track, progress, play/pause/stop/prev/next, volume.
4. Mixer popup: channel sliders, global stop, active ambience loops, SFX board.
5. Library picker inside mixer: audio assets and URL tracks; not inside `Файлы`.
6. Optional scenes/presets later.

No nested cards inside cards. The desk should be a full-width popup/tool surface triggered by the bottom player, with repeated cue buttons as cards.

## Data Model Draft

```ts
type AudioCueMode = 'track' | 'loop' | 'oneshot';

interface AudioCue {
  id: string;
  assetId: string;
  assetPath: string;
  assetName: string;
  channel: AudioChannel;
  mode: AudioCueMode;
  volume: number;
  loop: boolean;
  fadeMs: number;
  label?: string;
  color?: string;
  delegatedRoleIds?: string[];
}

interface AudioDeckPlaylist {
  id: string;
  name: string;
  cueIds: string[];
  channel: AudioChannel;
  mode: 'sequential' | 'shuffle';
  loop: boolean;
  crossfadeMs: number;
}

interface AudioDeckScene {
  id: string;
  name: string;
  playlistIds: string[];
  cueIds: string[];
}
```

The first implementation can persist this locally in GM `localStorage` while the shared session state contract is stabilized. The next implementation should move session-facing state into Yjs/world config.

## Sync Contract

Current `AudioSessionCommand` is enough for single play/stop commands. GM audio desk needs a second layer:

- command events: play cue, stop channel, stop all, set channel volume, start playlist;
- state snapshot: current channel playback, playlist position, loop/crossfade/fade settings;
- reconnect behavior: players that opted into audio can reconstruct active `music`/`ambience` from snapshot using `startedAt` offsets;
- SFX commands remain short-lived events and should not replay after the current age window.

Do not stream raw audio in the first serious slice. The local-first model is: every client fetches the same asset from the host server and starts at the commanded offset.

## Implementation Slices

### Slice A: Pure deck model

- [x] Add pure helpers for normalized cues/playlists/scenes.
- [x] Clamp volume/fade/crossfade.
- [x] Dedupe cue IDs and cap list sizes.
- [x] Add focused tests.

### Slice B: Dedicated UI shell

- [x] Add first `AudioDesk` component.
- [x] Move `AudioDesk` out of the right drawer into a separate bottom `AudioControlDock`.
- [x] Remove live playback/queue/playlist controls from `AssetBrowser`.
- [x] Use existing `audioPlayback`, `useAudioChannelVolumes`, `useAudioSessionEnabled`.
- [x] Active playback handles react to channel volume changes, so mixer sliders affect already playing tracks/SFX.
- [x] Owner QA passed 2026-05-26 for live mixer volume changes.
- [x] Store the first deck locally in GM `localStorage`.
- [x] Compact dock is a translucent orb; expanded dock owns the music transport and opens the full desk.
- [x] Drag/drop audio files onto the desk uploads them into `assets/` and creates a cue in the currently selected channel.
- [x] `ambience` supports multiple simultaneous local loops and individual broadcast stop commands.
- [ ] Redesign bottom player and mixer popup after product approval.
- [ ] Add playlist lanes and session scenes.

### Slice B2: Remaining product gates for final audio module

- [x] Confirm bottom dock direction: root-level dock, collapsible to orb, outside drawers/files.
- [x] Confirm local-first core and defer YouTube/SoundCloud to extensions.
- [ ] Confirm final z-index/mobile behavior with windows/drawers during UI redesign.
- [ ] Confirm world-level module enablement in addition to current local-user toggle.
- [ ] Confirm player permission model: who can upload tracks, play SFX, control music, control ambience.
- [x] Confirm URL track policy for now: no external source in core; YouTube long-term extension only; SoundCloud candidate extension only.
- [ ] Confirm persistence: local GM deck vs world-level deck vs session-only deck.

### Slice C: Session playlist commands

- [x] Keep current command contract compatible while adding per-channel receiver behavior.
- [x] Add stop channel / stop all behavior through existing `stop` command semantics.
- [ ] Extend audio command contract for start playlist without breaking current commands.
- Keep player opt-in and browser autoplay guard.

### Slice D: Shared session state

- Add Yjs state snapshot for active channels and playlist positions.
- Restore `music` and all active `ambience` loops after reconnect using offset.
- Keep `sfx` one-shots event-only.

### Slice E: Delegation and permissions

- Add player-facing SFX buttons only after role/player identity is stable.
- Store delegation as role/player policy.
- Never expose GM-only asset browsing through delegated buttons; expose only allowed cue actions.

## Acceptance Criteria

- GM can start/stop music, ambience, and SFX from one desk.
- Players hear only after enabling session audio.
- Long tracks resume with offset after reconnect; one-shot SFX do not replay late.
- Asset IDs remain the stable reference.
- The desk can survive future Tauri/Steam wrapping because it does not depend on browser-only file paths beyond current asset URLs.
- The asset browser stays usable as a file browser and does not become the primary live-session mixer.
