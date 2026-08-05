import assert from 'node:assert/strict';
import type { Entity } from '../types';
import { resolveEntitySheetBinding } from './entitySheetBinding';

const entity: Entity = {
    id: 'hero',
    parentId: null,
    type: 'character',
    name: 'Hero',
    description: '# Chronicle',
    properties: { resources: { hp: 7 } },
    tags: [],
    database: 'general',
};

assert.deepEqual(
    resolveEntitySheetBinding(entity, { scope: 'self', path: ['properties', 'resources', 'hp'] }),
    { status: 'resolved', value: 7 }
);
assert.deepEqual(
    resolveEntitySheetBinding(entity, { scope: 'self', path: ['properties', 'resources', 'mana'] }),
    { status: 'missing', value: undefined }
);
assert.deepEqual(
    resolveEntitySheetBinding(entity, { scope: 'self', path: ['description'] }),
    { status: 'resolved', value: '# Chronicle' }
);
assert.deepEqual(
    resolveEntitySheetBinding(entity, { scope: 'self', path: ['name'] }),
    { status: 'missing', value: undefined }
);

console.log('entity sheet binding tests passed');
