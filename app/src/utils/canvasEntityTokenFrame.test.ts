import assert from 'node:assert/strict';
import {
  ENTITY_TOKEN_FRAME_OPTIONS,
  getEntityTokenFrameConfig,
} from './canvasEntityTokenFrame';

assert.deepEqual(
  ENTITY_TOKEN_FRAME_OPTIONS.map((option) => option.id),
  ['plain', 'ring', 'badge', 'hex']
);

assert.equal(getEntityTokenFrameConfig('plain').id, 'plain');
assert.equal(getEntityTokenFrameConfig('badge').shortLabel, 'Плашка');
assert.equal(getEntityTokenFrameConfig(undefined).id, 'ring');

console.log('canvasEntityTokenFrame tests passed');
