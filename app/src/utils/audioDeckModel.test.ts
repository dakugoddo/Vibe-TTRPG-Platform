import assert from 'node:assert/strict';
import {
  dedupeAudioDeckRefs,
  MAX_AUDIO_CROSSFADE_MS,
  normalizeAudioCue,
  normalizeAudioDeckPlaylist,
  normalizeAudioDeckScene,
  normalizeAudioDeckState,
} from './audioDeckModel';

const now = new Date('2026-05-25T12:34:56.000Z');

assert.deepEqual(dedupeAudioDeckRefs(['a', ' a ', '', 'b', 'a', 7]), ['a', 'b']);

assert.equal(normalizeAudioCue(null, now), null);
assert.equal(normalizeAudioCue({ assetId: 'missing-path' }, now), null);

assert.deepEqual(
  normalizeAudioCue({
    id: ' cue-1 ',
    assetId: 'asset-music',
    assetPath: 'music/battle.mp3',
    assetName: '',
    channel: 'music',
    mode: 'loop',
    volume: 2,
    loop: undefined,
    fadeMs: 1250.4,
    label: '  Boss loop  ',
    color: ' #ffaa00 ',
    delegatedRoleIds: ['player', 'player', '', 'trusted'],
  }, now),
  {
    id: 'cue-1',
    assetId: 'asset-music',
    assetPath: 'music/battle.mp3',
    assetName: 'battle.mp3',
    channel: 'music',
    mode: 'loop',
    volume: 1,
    loop: true,
    fadeMs: 1250,
    label: 'Boss loop',
    color: '#ffaa00',
    delegatedRoleIds: ['player', 'trusted'],
  },
);

assert.deepEqual(
  normalizeAudioCue({
    assetId: 'asset-sfx',
    assetPath: 'sfx/boom.wav',
  }, now),
  {
    id: 'cue-1779712496000',
    assetId: 'asset-sfx',
    assetPath: 'sfx/boom.wav',
    assetName: 'boom.wav',
    channel: 'sfx',
    mode: 'oneshot',
    volume: 0.75,
    loop: false,
    fadeMs: 0,
    label: undefined,
    color: undefined,
    delegatedRoleIds: [],
  },
);

assert.equal(normalizeAudioDeckPlaylist({ cueIds: [] }, now), null);
assert.deepEqual(
  normalizeAudioDeckPlaylist({
    id: 'p1',
    name: '  Session Mix  ',
    cueIds: ['cue-1', 'cue-1', 'cue-2'],
    channel: 'ambience',
    mode: 'shuffle',
    loop: true,
    crossfadeMs: MAX_AUDIO_CROSSFADE_MS + 1000,
  }, now),
  {
    id: 'p1',
    name: 'Session Mix',
    cueIds: ['cue-1', 'cue-2'],
    channel: 'ambience',
    mode: 'shuffle',
    loop: true,
    crossfadeMs: MAX_AUDIO_CROSSFADE_MS,
  },
);

assert.equal(normalizeAudioDeckScene({ cueIds: [], playlistIds: [] }, now), null);
assert.deepEqual(
  normalizeAudioDeckScene({
    name: '',
    playlistIds: ['p1', 'p1'],
    cueIds: ['cue-1'],
  }, now),
  {
    id: 'scene-1779712496000',
    name: 'Audio Scene',
    playlistIds: ['p1'],
    cueIds: ['cue-1'],
  },
);

assert.deepEqual(
  normalizeAudioDeckState({
    cues: [{ assetId: 'asset', assetPath: 'sfx/click.ogg' }, { bad: true }],
    playlists: [{ id: 'p1', cueIds: ['cue-1779712496000'] }, { cueIds: [] }],
    scenes: [{ id: 'scene-1', playlistIds: ['p1'] }, { cueIds: [] }],
  }, now),
  {
    cues: [
      {
        id: 'cue-1779712496000',
        assetId: 'asset',
        assetPath: 'sfx/click.ogg',
        assetName: 'click.ogg',
        channel: 'sfx',
        mode: 'oneshot',
        volume: 0.75,
        loop: false,
        fadeMs: 0,
        label: undefined,
        color: undefined,
        delegatedRoleIds: [],
      },
    ],
    playlists: [
      {
        id: 'p1',
        name: 'Audio Playlist',
        cueIds: ['cue-1779712496000'],
        channel: 'music',
        mode: 'sequential',
        loop: false,
        crossfadeMs: 0,
      },
    ],
    scenes: [
      {
        id: 'scene-1',
        name: 'Audio Scene',
        playlistIds: ['p1'],
        cueIds: [],
      },
    ],
    updatedAt: '2026-05-25T12:34:56.000Z',
  },
);

console.log('ok - audio deck model normalization');
