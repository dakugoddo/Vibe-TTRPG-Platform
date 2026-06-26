import assert from 'node:assert/strict';
import { getTopLevelEntityIds } from './entityTreeSelection';
import type { Entity } from '../types';

const entities: Entity[] = [
  { id: 'parent', parentId: null, type: 'character', name: 'Parent', description: '', tags: [] },
  { id: 'child-a', parentId: 'parent', type: 'object', name: 'Child A', description: '', tags: [] },
  { id: 'child-b', parentId: 'parent', type: 'object', name: 'Child B', description: '', tags: [] },
  { id: 'nested', parentId: 'child-a', type: 'attack', name: 'Nested', description: '', tags: [] },
  { id: 'sibling', parentId: null, type: 'note', name: 'Sibling', description: '', tags: [] },
];

assert.deepEqual(
  getTopLevelEntityIds(['child-a', 'parent', 'nested', 'sibling'], entities),
  ['parent', 'sibling']
);

assert.deepEqual(
  getTopLevelEntityIds(['child-a', 'child-a', 'nested', 'child-b'], entities),
  ['child-a', 'child-b']
);

assert.deepEqual(
  getTopLevelEntityIds(['missing', 'child-b'], entities),
  ['missing', 'child-b']
);

console.log('entityTreeSelection tests passed');
