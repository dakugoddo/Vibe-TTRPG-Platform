import { clampVolume, normalizeAudioFadeMs } from '../services/audioPlayback';
import type { AudioChannel } from '../types';

export type AudioCueMode = 'track' | 'loop' | 'oneshot';
export type AudioPlaylistMode = 'sequential' | 'shuffle';

export interface AudioCue {
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
  delegatedRoleIds: string[];
}

export interface AudioDeckPlaylist {
  id: string;
  name: string;
  cueIds: string[];
  channel: AudioChannel;
  mode: AudioPlaylistMode;
  loop: boolean;
  crossfadeMs: number;
}

export interface AudioDeckScene {
  id: string;
  name: string;
  playlistIds: string[];
  cueIds: string[];
}

export interface AudioDeckState {
  cues: AudioCue[];
  playlists: AudioDeckPlaylist[];
  scenes: AudioDeckScene[];
  updatedAt: string;
}

export const MAX_AUDIO_DECK_CUES = 128;
export const MAX_AUDIO_DECK_PLAYLISTS = 32;
export const MAX_AUDIO_DECK_SCENES = 32;
export const MAX_AUDIO_DECK_REFS = 128;
export const MAX_AUDIO_CROSSFADE_MS = 30_000;

const AUDIO_CHANNELS: AudioChannel[] = ['music', 'ambience', 'sfx', 'voice'];
const CUE_MODES: AudioCueMode[] = ['track', 'loop', 'oneshot'];
const PLAYLIST_MODES: AudioPlaylistMode[] = ['sequential', 'shuffle'];

function getIsoTimestamp(now: Date): string {
  return Number.isNaN(now.getTime()) ? new Date(0).toISOString() : now.toISOString();
}

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeId(value: unknown, prefix: string, now: Date): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return `${prefix}-${now.getTime()}`;
}

function normalizeChannel(value: unknown, fallback: AudioChannel): AudioChannel {
  return typeof value === 'string' && AUDIO_CHANNELS.includes(value as AudioChannel)
    ? value as AudioChannel
    : fallback;
}

function normalizeCueMode(value: unknown, fallback: AudioCueMode): AudioCueMode {
  return typeof value === 'string' && CUE_MODES.includes(value as AudioCueMode)
    ? value as AudioCueMode
    : fallback;
}

function normalizePlaylistMode(value: unknown): AudioPlaylistMode {
  return typeof value === 'string' && PLAYLIST_MODES.includes(value as AudioPlaylistMode)
    ? value as AudioPlaylistMode
    : 'sequential';
}

function normalizeCrossfadeMs(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.round(Math.max(0, Math.min(MAX_AUDIO_CROSSFADE_MS, numericValue)));
}

export function dedupeAudioDeckRefs(refs: readonly unknown[], maxItems = MAX_AUDIO_DECK_REFS): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of refs) {
    if (typeof item !== 'string') continue;
    const ref = item.trim();
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    result.push(ref);
    if (result.length >= maxItems) break;
  }

  return result;
}

export function normalizeAudioCue(input: unknown, now = new Date()): AudioCue | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<AudioCue>;
  const assetId = normalizeOptionalText(candidate.assetId);
  const assetPath = normalizeOptionalText(candidate.assetPath);
  if (!assetId || !assetPath) return null;

  const channel = normalizeChannel(candidate.channel, 'sfx');
  const mode = normalizeCueMode(candidate.mode, channel === 'sfx' ? 'oneshot' : 'track');

  return {
    id: normalizeId(candidate.id, 'cue', now),
    assetId,
    assetPath,
    assetName: normalizeText(candidate.assetName, assetPath.split('/').pop() || assetPath),
    channel,
    mode,
    volume: clampVolume(Number(candidate.volume ?? 0.75)),
    loop: typeof candidate.loop === 'boolean' ? candidate.loop : mode === 'loop',
    fadeMs: normalizeAudioFadeMs(Number(candidate.fadeMs ?? 0)),
    label: normalizeOptionalText(candidate.label),
    color: normalizeOptionalText(candidate.color),
    delegatedRoleIds: dedupeAudioDeckRefs(Array.isArray(candidate.delegatedRoleIds) ? candidate.delegatedRoleIds : []),
  };
}

export function normalizeAudioDeckPlaylist(input: unknown, now = new Date()): AudioDeckPlaylist | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<AudioDeckPlaylist>;
  const cueIds = dedupeAudioDeckRefs(Array.isArray(candidate.cueIds) ? candidate.cueIds : []);
  if (cueIds.length === 0) return null;

  return {
    id: normalizeId(candidate.id, 'playlist', now),
    name: normalizeText(candidate.name, 'Audio Playlist'),
    cueIds,
    channel: normalizeChannel(candidate.channel, 'music'),
    mode: normalizePlaylistMode(candidate.mode),
    loop: Boolean(candidate.loop),
    crossfadeMs: normalizeCrossfadeMs(candidate.crossfadeMs),
  };
}

export function normalizeAudioDeckScene(input: unknown, now = new Date()): AudioDeckScene | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<AudioDeckScene>;
  const playlistIds = dedupeAudioDeckRefs(Array.isArray(candidate.playlistIds) ? candidate.playlistIds : []);
  const cueIds = dedupeAudioDeckRefs(Array.isArray(candidate.cueIds) ? candidate.cueIds : []);
  if (playlistIds.length === 0 && cueIds.length === 0) return null;

  return {
    id: normalizeId(candidate.id, 'scene', now),
    name: normalizeText(candidate.name, 'Audio Scene'),
    playlistIds,
    cueIds,
  };
}

export function normalizeAudioDeckState(input: unknown, now = new Date()): AudioDeckState {
  const candidate = input && typeof input === 'object' ? input as Partial<AudioDeckState> : {};

  return {
    cues: (Array.isArray(candidate.cues) ? candidate.cues : [])
      .map(item => normalizeAudioCue(item, now))
      .filter((cue): cue is AudioCue => Boolean(cue))
      .slice(0, MAX_AUDIO_DECK_CUES),
    playlists: (Array.isArray(candidate.playlists) ? candidate.playlists : [])
      .map(item => normalizeAudioDeckPlaylist(item, now))
      .filter((playlist): playlist is AudioDeckPlaylist => Boolean(playlist))
      .slice(0, MAX_AUDIO_DECK_PLAYLISTS),
    scenes: (Array.isArray(candidate.scenes) ? candidate.scenes : [])
      .map(item => normalizeAudioDeckScene(item, now))
      .filter((scene): scene is AudioDeckScene => Boolean(scene))
      .slice(0, MAX_AUDIO_DECK_SCENES),
    updatedAt: getIsoTimestamp(now),
  };
}
