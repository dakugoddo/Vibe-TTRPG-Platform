import assert from 'node:assert/strict';
import { parseWorldSheetDraft } from './worldSheetDraft';

const valid = JSON.stringify({
    schemaVersion: 1,
    id: 'gm-note-layout',
    name: 'GM note layout',
    revision: 1,
    status: 'published',
    entityTypes: ['note'],
    density: 'inherit',
    root: {
        id: 'root',
        type: 'container',
        layout: 'column',
        children: [{
            id: 'description',
            type: 'markdown',
            binding: { scope: 'self', path: ['description'] },
        }],
    },
});

const parsed = parseWorldSheetDraft(valid, 'note');
assert.equal(parsed.ok, true);
if (parsed.ok) {
    assert.equal(parsed.schema.status, 'published');
    assert.equal(parsed.canonical.includes('"type": "markdown"'), true);
}

const syntaxError = parseWorldSheetDraft('{ nope', 'note');
assert.equal(syntaxError.ok, false);
assert.equal(syntaxError.diagnostics[0]?.code, 'json.parse');

const wrongType = parseWorldSheetDraft(valid.replace('"note"', '"object"'), 'note');
assert.equal(wrongType.ok, false);
assert.equal(wrongType.diagnostics.some((item) => item.code === 'schema.entityTypes.assignment'), true);

console.log('world sheet draft tests passed');
