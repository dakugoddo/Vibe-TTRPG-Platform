import assert from 'node:assert/strict';
import {
    createMarkdownEntityEmbedInsertion,
    resolveMarkdownEntityEmbed,
    transformMarkdownEntityEmbeds,
} from './markdownEntityEmbeds';
import type { Entity } from '../types';

function entity(id: string, name: string): Entity {
    return {
        id,
        parentId: null,
        type: 'note',
        name,
        description: 'Embedded preview body.',
        properties: {},
        tags: [],
        database: 'general',
    };
}

const alpha = entity('alpha-note', 'Alpha Note');
const beta = entity('beta-note', 'Beta Note');

assert.equal(
    transformMarkdownEntityEmbeds('Before ![[Alpha Note]] after [[Beta Note]].'),
    'Before ![Alpha Note](#entity-embed:Alpha%20Note) after [[Beta Note]].',
    'Embed syntax should transform without consuming ordinary wiki links'
);
assert.equal(
    transformMarkdownEntityEmbeds('![[alpha-note|Compact alpha]]'),
    '![Compact alpha](#entity-embed:alpha-note?label=Compact%20alpha)',
    'Embed aliases should become the rendered card label'
);
assert.equal(
    resolveMarkdownEntityEmbed('ALPHA-NOTE', [alpha, beta])?.id,
    'alpha-note',
    'Embed targets should resolve by stable ID case-insensitively'
);
assert.equal(
    resolveMarkdownEntityEmbed('beta note', [alpha, beta])?.id,
    'beta-note',
    'Embed targets should resolve by entity name case-insensitively'
);
assert.equal(
    resolveMarkdownEntityEmbed('Missing Note', [alpha, beta]),
    undefined,
    'Missing embed targets should remain explicitly unresolved'
);
assert.deepEqual(
    createMarkdownEntityEmbedInsertion('Alpha Note'),
    { text: '![[Alpha Note]]', selectStart: 3, selectEnd: 13 },
    'Selected entity name should be wrapped as a Markdown embed'
);
assert.deepEqual(
    createMarkdownEntityEmbedInsertion(''),
    { text: '![[entity-id]]', selectStart: 3, selectEnd: 12 },
    'Empty selection should insert and select an entity target placeholder'
);

console.log('markdown entity embeds tests passed');
