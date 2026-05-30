import assert from 'node:assert/strict';
import { getEntityDropActions, resolveEntityStorageSlot } from './entityDropRouter';

const gm = { role: 'gm' as const, canModifySource: true, canModifyTarget: true };
const playerWritable = { role: 'player' as const, canModifySource: true, canModifyTarget: true };
const playerReadOnlyTarget = { role: 'player' as const, canModifySource: true, canModifyTarget: false };

assert.equal(
  resolveEntityStorageSlot('object', { kind: 'entity', entityId: 'character-a', entityType: 'character' }),
  'inventory'
);

assert.equal(
  resolveEntityStorageSlot('attack', { kind: 'entity', entityId: 'character-a', entityType: 'character' }),
  null
);

assert.equal(
  resolveEntityStorageSlot('attack', { kind: 'entity', entityId: 'object-a', entityType: 'object' }),
  'attacks'
);

assert.deepEqual(
  getEntityDropActions(
    { id: 'object-a', type: 'object' },
    { kind: 'canvas', canvasId: 'canvas-a' },
    gm
  ).map((action) => action.id),
  ['place-token', 'place-card', 'copy-entity', 'move-entity']
);

assert.deepEqual(
  getEntityDropActions(
    { id: 'object-a', type: 'object' },
    { kind: 'canvas', canvasId: 'canvas-a' },
    playerReadOnlyTarget
  ).map((action) => action.id),
  ['place-token', 'place-card']
);

assert.deepEqual(
  getEntityDropActions(
    { id: 'object-a', type: 'object' },
    { kind: 'entity', entityId: 'character-a', entityType: 'character' },
    playerWritable
  ).map((action) => action.id),
  ['copy-entity']
);

assert.deepEqual(
  getEntityDropActions(
    { id: 'attack-a', type: 'attack' },
    { kind: 'entity', entityId: 'character-a', entityType: 'character' },
    gm
  ),
  []
);

assert.deepEqual(
  getEntityDropActions(
    { id: 'object-a', type: 'object' },
    { kind: 'entity', entityId: 'object-a', entityType: 'object' },
    gm
  ),
  []
);

console.log('entityDropRouter tests passed');

