export interface AudioPlaylist {
  id: string;
  name: string;
  assetIds: string[];
  createdAt: string;
  updatedAt: string;
}

export const MAX_AUDIO_PLAYLISTS = 24;
export const MAX_AUDIO_PLAYLIST_ASSETS = 128;

function getIsoTimestamp(now: Date): string {
  return Number.isNaN(now.getTime()) ? new Date(0).toISOString() : now.toISOString();
}

function normalizeName(name: unknown): string {
  if (typeof name !== 'string') return 'Audio Playlist';
  const trimmed = name.trim();
  return trimmed || 'Audio Playlist';
}

function normalizeId(id: unknown, now: Date): string {
  if (typeof id === 'string' && id.trim()) return id.trim();
  return `playlist-${now.getTime()}`;
}

function normalizeTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

export function dedupeAudioAssetIds(assetIds: readonly unknown[], maxItems = MAX_AUDIO_PLAYLIST_ASSETS): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of assetIds) {
    if (typeof item !== 'string') continue;
    const assetId = item.trim();
    if (!assetId || seen.has(assetId)) continue;
    seen.add(assetId);
    result.push(assetId);
    if (result.length >= maxItems) break;
  }

  return result;
}

export function normalizeAudioPlaylist(input: unknown, now = new Date()): AudioPlaylist | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<AudioPlaylist>;
  const fallbackTimestamp = getIsoTimestamp(now);
  const createdAt = normalizeTimestamp(candidate.createdAt, fallbackTimestamp);
  const updatedAt = normalizeTimestamp(candidate.updatedAt, createdAt);

  return {
    id: normalizeId(candidate.id, now),
    name: normalizeName(candidate.name),
    assetIds: dedupeAudioAssetIds(Array.isArray(candidate.assetIds) ? candidate.assetIds : []),
    createdAt,
    updatedAt,
  };
}

export function normalizeAudioPlaylists(input: unknown, maxItems = MAX_AUDIO_PLAYLISTS): AudioPlaylist[] {
  if (!Array.isArray(input)) return [];
  const byId = new Map<string, AudioPlaylist>();

  for (const item of input) {
    const playlist = normalizeAudioPlaylist(item);
    if (!playlist) continue;
    byId.set(playlist.id, playlist);
  }

  return [...byId.values()]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, maxItems);
}

export function createAudioPlaylistFromQueue(
  name: string,
  assetIds: readonly string[],
  now = new Date(),
  id = `playlist-${now.getTime()}`,
): AudioPlaylist {
  const timestamp = getIsoTimestamp(now);
  return {
    id,
    name: normalizeName(name),
    assetIds: dedupeAudioAssetIds(assetIds),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function upsertAudioPlaylist(
  playlists: readonly AudioPlaylist[],
  playlist: AudioPlaylist,
  maxItems = MAX_AUDIO_PLAYLISTS,
): AudioPlaylist[] {
  const normalizedPlaylist = normalizeAudioPlaylist(playlist);
  if (!normalizedPlaylist) return normalizeAudioPlaylists(playlists, maxItems);

  const next = [
    normalizedPlaylist,
    ...normalizeAudioPlaylists(playlists, maxItems).filter((item) => item.id !== normalizedPlaylist.id),
  ];

  return next.slice(0, maxItems);
}

export function removeAudioPlaylist(playlists: readonly AudioPlaylist[], playlistId: string): AudioPlaylist[] {
  return normalizeAudioPlaylists(playlists).filter((playlist) => playlist.id !== playlistId);
}

export function addAssetToPlaylist(
  playlists: readonly AudioPlaylist[],
  playlistId: string,
  assetId: string,
  now = new Date(),
): AudioPlaylist[] {
  const normalizedAssetId = assetId.trim();
  if (!normalizedAssetId) return normalizeAudioPlaylists(playlists);
  const timestamp = getIsoTimestamp(now);

  return normalizeAudioPlaylists(playlists).map((playlist) => {
    if (playlist.id !== playlistId) return playlist;
    return {
      ...playlist,
      assetIds: dedupeAudioAssetIds([...playlist.assetIds, normalizedAssetId]),
      updatedAt: timestamp,
    };
  });
}

export function removeAssetFromPlaylist(
  playlists: readonly AudioPlaylist[],
  playlistId: string,
  assetId: string,
  now = new Date(),
): AudioPlaylist[] {
  const timestamp = getIsoTimestamp(now);

  return normalizeAudioPlaylists(playlists).map((playlist) => {
    if (playlist.id !== playlistId) return playlist;
    return {
      ...playlist,
      assetIds: playlist.assetIds.filter((id) => id !== assetId),
      updatedAt: timestamp,
    };
  });
}

export function getNextQueuedAudioAssetId(
  queuedAssetIds: readonly string[],
  currentAssetId: string,
  shouldWrap = false,
): string | null {
  const currentIndex = queuedAssetIds.indexOf(currentAssetId);
  if (currentIndex < 0) return null;

  const nextAssetId = queuedAssetIds[currentIndex + 1];
  if (nextAssetId) return nextAssetId;
  return shouldWrap ? queuedAssetIds[0] ?? null : null;
}
