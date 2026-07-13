import assert from 'node:assert/strict';
import {
    normalizeEntitySheetSchema,
    parseEntitySheetSchema,
    serializeEntitySheetSchema,
} from './entitySheetSchema';

const input = {
    schemaVersion: 1,
    id: 'generic-summary',
    name: 'Generic summary',
    revision: 1,
    status: 'published',
    entityTypes: ['note'],
    density: 'inherit',
    root: {
        id: 'root',
        type: 'container',
        layout: 'column',
        gap: 'md',
        children: [
            {
                id: 'summary',
                type: 'property-value',
                label: 'Summary',
                binding: { scope: 'self', path: ['properties', 'summary'] },
                format: 'text',
                emptyText: '—',
            },
        ],
    },
};

const normalized = normalizeEntitySheetSchema(input);
assert.equal(normalized.ok, true);
if (!normalized.ok) throw new Error('Expected schema to normalize');

const serialized = serializeEntitySheetSchema(normalized.schema);
const reparsed = parseEntitySheetSchema(serialized);
assert.equal(reparsed.ok, true);
if (!reparsed.ok) throw new Error('Expected serialized schema to parse');

assert.deepEqual(reparsed.schema, normalized.schema);
assert.equal(serializeEntitySheetSchema(reparsed.schema), serialized);

const duplicateIds = structuredClone(input);
(duplicateIds.root.children as unknown[]).push({
    id: 'summary',
    type: 'property-value',
    binding: { scope: 'self', path: ['properties', 'details'] },
});
const duplicateResult = normalizeEntitySheetSchema(duplicateIds);
assert.equal(duplicateResult.ok, false);
assert.equal(duplicateResult.diagnostics[0]?.code, 'block.id.duplicate');
assert.deepEqual(duplicateResult.diagnostics[0]?.path, ['root', 'children', 1, 'id']);

const unsafeBinding = structuredClone(input);
unsafeBinding.root.children[0].binding.path = ['properties', '__proto__', 'polluted'];
const unsafeResult = normalizeEntitySheetSchema(unsafeBinding);
assert.equal(unsafeResult.ok, false);
assert.equal(unsafeResult.diagnostics[0]?.code, 'binding.path.unsafe');
assert.deepEqual(unsafeResult.diagnostics[0]?.path, ['root', 'children', 0, 'binding', 'path', 1]);

const unknownBlock = structuredClone(input);
unknownBlock.root.children[0].type = 'script';
const unknownResult = normalizeEntitySheetSchema(unknownBlock);
assert.equal(unknownResult.ok, false);
assert.equal(unknownResult.diagnostics[0]?.code, 'block.type.unknown');
assert.deepEqual(unknownResult.diagnostics[0]?.path, ['root', 'children', 0, 'type']);

const tooDeep = structuredClone(input);
let depthCursor = tooDeep.root as { children: unknown[] };
for (let depth = 1; depth <= 16; depth += 1) {
    const child = {
        id: `depth-${depth}`,
        type: 'container',
        layout: 'column',
        children: [] as unknown[],
    };
    depthCursor.children = [child];
    depthCursor = child;
}
const depthResult = normalizeEntitySheetSchema(tooDeep);
assert.equal(depthResult.ok, false);
assert.equal(depthResult.diagnostics[0]?.code, 'schema.depth.limit');

const tooManyBlocks = structuredClone(input);
tooManyBlocks.root.children = Array.from({ length: 500 }, (_, index) => ({
    id: `block-${index}`,
    type: 'property-value',
    label: `Block ${index}`,
    binding: { scope: 'self', path: ['properties', `value-${index}`] },
    format: 'text',
    emptyText: '—',
}));
const blockCountResult = normalizeEntitySheetSchema(tooManyBlocks);
assert.equal(blockCountResult.ok, false);
assert.equal(blockCountResult.diagnostics[0]?.code, 'schema.blocks.limit');

const longBinding = structuredClone(input);
longBinding.root.children[0].binding.path = [
    'properties',
    ...Array.from({ length: 32 }, (_, index) => `segment-${index}`),
];
const bindingLengthResult = normalizeEntitySheetSchema(longBinding);
assert.equal(bindingLengthResult.ok, false);
assert.equal(bindingLengthResult.diagnostics[0]?.code, 'binding.path.limit');

console.log('entity sheet schema tests passed');
