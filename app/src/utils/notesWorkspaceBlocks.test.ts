import assert from 'node:assert/strict';
import { buildNotesWorkspaceEmbeddedEntityTree } from './notesWorkspaceBlocks';
import type { Entity } from '../types';

function entity(id: string, parentId: string | null, name: string): Entity {
  return {
    id,
    parentId,
    type: 'note',
    name,
    description: '',
    tags: [],
    properties: {},
    database: 'general',
  };
}

const root = entity('root', null, 'Root');
const childA = entity('child-a', 'root', 'Child A');
const childB = entity('child-b', 'root', 'Child B');
const grandchild = entity('grandchild', 'child-a', 'Grandchild');
const greatGrandchild = entity('great-grandchild', 'grandchild', 'Great grandchild');
const orphan = entity('orphan', 'missing-parent', 'Orphan');
const cycleA = entity('cycle-a', 'cycle-b', 'Cycle A');
const cycleB = entity('cycle-b', 'cycle-a', 'Cycle B');

const tree = buildNotesWorkspaceEmbeddedEntityTree(root, [childB, orphan, grandchild, root, childA, greatGrandchild]);
assert.deepEqual(
  tree.map((node) => ({ id: node.entity.id, depth: node.depth, children: node.children.map((child) => child.entity.id) })),
  [
    { id: 'child-a', depth: 0, children: ['grandchild'] },
    { id: 'child-b', depth: 0, children: [] },
  ],
  'Root embedded blocks should include sorted direct children only at the first level'
);
assert.equal(tree[0].children[0].depth, 1);
assert.equal(tree[0].children[0].children[0].entity.id, 'great-grandchild');
assert.equal(tree[0].children[0].children[0].depth, 2);

const cyclicTree = buildNotesWorkspaceEmbeddedEntityTree(cycleA, [cycleA, cycleB]);
assert.deepEqual(
  cyclicTree.map((node) => ({ id: node.entity.id, childIds: node.children.map((child) => child.entity.id) })),
  [{ id: 'cycle-b', childIds: [] }],
  'Embedded tree builder should stop cycles instead of recursing forever'
);

console.log('notes workspace embedded blocks tests passed');
