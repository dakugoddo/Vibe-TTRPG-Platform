import { strict as assert } from 'node:assert';
import type { Entity } from '../types';
import { buildEntityCanvasTokenDefaultsPatch, getEntityCanvasTokenDefaults, getEntityCanvasTokenImageSource } from './entityCanvasDefaults';

const entity: Entity = {
  id: '20260523120000000',
  parentId: null,
  type: 'character',
  name: 'Mecha Pilot',
  description: '',
  icon_url: 'portraits/mecha-main.png',
  tags: [],
  database: 'general',
  properties: {
    canvasToken: {
      mode: 'art',
      frame: 'hex',
      showName: false,
      stroke: '#22d3ee',
      tokenImage: 'tokens/mecha-token.png',
      artImage: 'art/mecha-full.png',
      tokenWidth: 84,
      tokenHeight: 96,
      artWidth: 260,
      artHeight: 180,
    },
  },
};

const artDefaults = getEntityCanvasTokenDefaults(entity);
assert.equal(artDefaults.mode, 'art');
assert.equal(artDefaults.frame, 'hex');
assert.equal(artDefaults.showName, false);
assert.equal(artDefaults.stroke, '#22d3ee');
assert.equal(artDefaults.artImage, 'art/mecha-full.png');
assert.equal(artDefaults.width, 260);
assert.equal(artDefaults.height, 180);

const tokenDefaults = getEntityCanvasTokenDefaults(entity, 'token');
assert.equal(tokenDefaults.mode, 'token');
assert.equal(tokenDefaults.tokenImage, 'tokens/mecha-token.png');
assert.equal(tokenDefaults.width, 84);
assert.equal(tokenDefaults.height, 96);
assert.equal(getEntityCanvasTokenImageSource(entity, 'token'), 'tokens/mecha-token.png');
assert.equal(getEntityCanvasTokenImageSource(entity, 'art'), 'art/mecha-full.png');
assert.equal(getEntityCanvasTokenImageSource({ ...entity, properties: {} }, 'art'), 'portraits/mecha-main.png');

const fallbackDefaults = getEntityCanvasTokenDefaults({ ...entity, properties: { canvasToken: { mode: 'bad', tokenWidth: 2 } } });
assert.equal(fallbackDefaults.mode, 'token');
assert.equal(fallbackDefaults.tokenWidth, 32);
assert.equal(fallbackDefaults.frame, 'ring');

const patch = buildEntityCanvasTokenDefaultsPatch(entity, { frame: 'badge', showName: true });
assert.deepEqual(patch, {
  mode: 'art',
  frame: 'badge',
  showName: true,
  stroke: '#22d3ee',
  tokenImage: 'tokens/mecha-token.png',
  artImage: 'art/mecha-full.png',
  tokenWidth: 84,
  tokenHeight: 96,
  artWidth: 260,
  artHeight: 180,
});

console.log('ok - entity canvas token defaults normalize and patch');
