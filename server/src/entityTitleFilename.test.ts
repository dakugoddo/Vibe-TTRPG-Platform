import assert from 'node:assert/strict';
import {
    entityTitleToFilename,
    getAvailableEntityTitleFilename,
    normalizeWindowsFilenameKey,
    sanitizeEntityTitleForFilename,
} from './entityTitleFilename.js';

const fallback = { type: 'note' as const, id: '20260524120000001' };

assert.equal(sanitizeEntityTitleForFilename('  Кошка  ', fallback), 'Кошка');
assert.equal(sanitizeEntityTitleForFilename('Кошка: пилот/меха?', fallback), 'Кошка пилот меха');
assert.equal(sanitizeEntityTitleForFilename('...', fallback), 'note-20260524120000001');
assert.equal(sanitizeEntityTitleForFilename('CON', fallback), 'CON_');

assert.equal(entityTitleToFilename('Кошка', fallback), 'Кошка.md');

assert.equal(
    getAvailableEntityTitleFilename('Кошка', ['Кошка.md', 'Кошка (1).md'], fallback),
    'Кошка (2).md'
);

assert.equal(
    getAvailableEntityTitleFilename('Кошка', ['кошка.md'], fallback),
    'Кошка (1).md'
);

assert.equal(
    getAvailableEntityTitleFilename('Кошка', ['Кошка.md'], fallback, { currentFilename: 'кошка.md' }),
    'Кошка.md'
);

assert.equal(normalizeWindowsFilenameKey('  КОШКА.MD  '), 'кошка.md');

console.log('entityTitleFilename tests passed');
