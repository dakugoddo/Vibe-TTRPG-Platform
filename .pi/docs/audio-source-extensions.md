# Audio source extensions

> Status: product/API gate note for `FEAT-AUDIO-SOURCES-001`.
> Date: 2026-05-27.
> Related docs: `.pi/docs/gm-audio-desk.md`, `.pi/docs/module-architecture.md`.

## Decision

Core audio stays local-first:

- uploaded local audio assets;
- one active `music` track;
- multiple `ambience` loops;
- one-shot `sfx`;
- optional `voice` channel for later.

External services are not part of the core audio module. They are source extensions on top of the audio module.

## YouTube

Status: deferred to long-term extension.

Reasons:

- Official YouTube playback should use iframe/player integration, not raw stream extraction.
- The product owner does not want to accept a requirement to show video inside the core music player.
- Host-login/Premium assumptions and host-to-player audio/video streaming are a separate high-risk architecture slice.
- A future YouTube extension may support only the `music` channel, because the app model allows one active music track.

Future idea:

- GM logs into YouTube in host context.
- YouTube source is playable only as `music`.
- GM can optionally expose the video window to players.
- If video is enabled, users see an icon near the bottom music player and can open a floating video window.
- Host-streaming audio/video to players would require a WebRTC/media-capture design and a separate legal/product review.

Do not implement YouTube in core audio MVP.

## SoundCloud

Status: candidate extension, not approved for core.

Official references show that SoundCloud has:

- API guide with OAuth 2.1 / PKCE and client credentials flow for public resources;
- Widget API with JavaScript control over embedded players, play/pause/seek/volume/progress events;
- API access process that requires credentials/app approval;
- policy restrictions, including examples that SoundCloud public APIs generally cannot be used for some music-mixing use cases inside games.

Implication for Vibe:

- SoundCloud might be a better fit than YouTube for audio-first UX, but it is not automatically free/open.
- The first version should treat SoundCloud as a branded source extension with visible `SoundCloud` source badge.
- Use official widget/API paths only; do not scrape or store SoundCloud content.
- Do not mix SoundCloud into game playback until the exact allowed-use policy is checked for this product shape.

## Source Extension Model

```ts
type AudioSourceKind = 'local' | 'soundcloud' | 'youtube';

interface AudioSourceDescriptor {
  kind: AudioSourceKind;
  label: string;
  sourceUrl?: string;
  assetPath?: string;
  providerTrackId?: string;
  badgeLabel: string;
  requiresIframe?: boolean;
  allowedChannels: AudioChannel[];
}
```

Core rules:

- `local` is the only source kind in the core MVP.
- `soundcloud` and `youtube` require module/extension enablement.
- The UI must always label external sources by provider.
- External providers cannot be silently converted into local assets.
- External playback sync must use provider-compatible state: source ID/URL, position, volume and play/pause, not raw media bytes.

## Implementation Order

1. Local music player with timeline.
2. Local mixer and deck persistence.
3. Notification/progress foundation for large assets.
4. Source extension registry.
5. SoundCloud proof-of-concept only if API access and policy fit.
6. YouTube extension only after a separate host-streaming/video design.

## References

- https://developers.soundcloud.com/docs/api/
- https://developers.soundcloud.com/docs/api/html5-widget
- https://help.soundcloud.com/hc/en-us/articles/115003446727-SoundCloud-Public-APIs
