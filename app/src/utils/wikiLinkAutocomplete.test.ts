import assert from 'node:assert/strict';
import {
    completeWikiLinkAutocomplete,
    findWikiLinkAutocompleteTrigger,
    getWikiLinkAutocompleteSuggestions,
} from './wikiLinkAutocomplete';
import type { Entity } from '../types';

function entity(id: string, name: string): Entity {
    return {
        id,
        parentId: null,
        type: 'note',
        name,
        description: '',
        properties: {},
        tags: [],
        database: 'general',
    };
}

const alpha = entity('note-alpha', 'Alpha Gate');
const mira = entity('preview-character-mira', 'Mira Ashen');
const compass = entity('preview-object-compass', 'Sunsteel Compass');

const linkSource = 'Before [[mi';
assert.deepEqual(
    findWikiLinkAutocompleteTrigger(linkSource, linkSource.length),
    { start: 7, query: 'mi', kind: 'link' },
    'Typing an unfinished wiki link should expose the query at the caret'
);

const embedSource = '![[sun';
assert.deepEqual(
    findWikiLinkAutocompleteTrigger(embedSource, embedSource.length),
    { start: 1, query: 'sun', kind: 'embed' },
    'Embed syntax should use the same autocomplete while preserving the leading exclamation mark'
);
assert.equal(
    findWikiLinkAutocompleteTrigger('Before [[Mira Ashen]] after', 27),
    null,
    'Completed wiki links should not keep autocomplete open'
);

assert.deepEqual(
    getWikiLinkAutocompleteSuggestions([alpha, compass, mira], 'mira').map((candidate) => candidate.id),
    ['preview-character-mira'],
    'Entity names should be searchable case-insensitively'
);
assert.deepEqual(
    getWikiLinkAutocompleteSuggestions([alpha, compass, mira], 'preview').map((candidate) => candidate.id),
    ['preview-character-mira', 'preview-object-compass'],
    'Stable entity IDs should be searchable and deterministically ranked'
);
assert.deepEqual(
    getWikiLinkAutocompleteSuggestions([
        entity('mira', 'Other'),
        entity('note-mira', 'Mira'),
        entity('contains-mira-id', 'Third'),
    ], 'mira').map((candidate) => candidate.id),
    ['mira', 'note-mira', 'contains-mira-id'],
    'Exact ID, exact name, and substring matches should be ranked in Obsidian-like order'
);

assert.deepEqual(
    completeWikiLinkAutocomplete(linkSource, linkSource.length, { start: 7, query: 'mi', kind: 'link' }, mira.id),
    { value: 'Before [[preview-character-mira]]', caret: 33 },
    'Choosing a suggestion should replace only the active unfinished wiki link'
);
assert.deepEqual(
    completeWikiLinkAutocomplete(embedSource, embedSource.length, { start: 1, query: 'sun', kind: 'embed' }, compass.id),
    { value: '![[preview-object-compass]]', caret: 27 },
    'Choosing an embed suggestion should preserve ! and complete the inner wiki link'
);

console.log('wiki link autocomplete tests passed');
