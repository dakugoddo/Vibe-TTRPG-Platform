import assert from 'node:assert/strict';
import {
  addAssetToPlaylist,
  createAudioPlaylistFromQueue,
  dedupeAudioAssetIds,
  getNextQueuedAudioAssetId,
  normalizeAudioPlaylist,
  normalizeAudioPlaylists,
  removeAssetFromPlaylist,
  removeAudioPlaylist,
  upsertAudioPlaylist,
} from './audioPlaylists';

const now = new Date('2026-05-23T10:20:30.000Z');

assert.deepEqual(dedupeAudioAssetIds(['a', 'a', '', ' b ', 42, 'c']), ['a', 'b', 'c']);

const created = createAudioPlaylistFromQueue('  Boss Fight  ', ['kick', 'kick', 'sting'], now, 'playlist-test');
assert.deepEqual(created, {
  id: 'playlist-test',
  name: 'Boss Fight',
  assetIds: ['kick', 'sting'],
  createdAt: '2026-05-23T10:20:30.000Z',
  updatedAt: '2026-05-23T10:20:30.000Z',
});

assert.equal(normalizeAudioPlaylist(null), null);
assert.deepEqual(
  normalizeAudioPlaylist({ id: ' saved ', name: '', assetIds: ['one', 'one'], createdAt: 'bad-date' }, now),
  {
    id: 'saved',
    name: 'Audio Playlist',
    assetIds: ['one'],
    createdAt: '2026-05-23T10:20:30.000Z',
    updatedAt: '2026-05-23T10:20:30.000Z',
  },
);

const older = createAudioPlaylistFromQueue('Older', ['old'], new Date('2026-05-22T10:20:30.000Z'), 'older');
const newer = createAudioPlaylistFromQueue('Newer', ['new'], new Date('2026-05-23T10:20:30.000Z'), 'newer');
assert.deepEqual(normalizeAudioPlaylists([older, newer]).map((playlist) => playlist.id), ['newer', 'older']);

const replaced = upsertAudioPlaylist([older, newer], { ...older, name: 'Updated', updatedAt: now.toISOString() });
assert.deepEqual(replaced.map((playlist) => playlist.name), ['Updated', 'Newer']);

const withAsset = addAssetToPlaylist([created], 'playlist-test', 'sting', now);
assert.deepEqual(withAsset[0]?.assetIds, ['kick', 'sting']);

const withNewAsset = addAssetToPlaylist([created], 'playlist-test', 'boom', now);
assert.deepEqual(withNewAsset[0]?.assetIds, ['kick', 'sting', 'boom']);

const withoutAsset = removeAssetFromPlaylist(withNewAsset, 'playlist-test', 'sting', now);
assert.deepEqual(withoutAsset[0]?.assetIds, ['kick', 'boom']);

assert.deepEqual(removeAudioPlaylist([created, older], 'playlist-test').map((playlist) => playlist.id), ['older']);

assert.equal(getNextQueuedAudioAssetId(['a', 'b', 'c'], 'a'), 'b');
assert.equal(getNextQueuedAudioAssetId(['a', 'b', 'c'], 'c'), null);
assert.equal(getNextQueuedAudioAssetId(['a', 'b', 'c'], 'c', true), 'a');
assert.equal(getNextQueuedAudioAssetId(['a', 'b', 'c'], 'missing'), null);

console.log('ok - audio playlists normalize, save and edit');
