import assert from 'node:assert/strict';
import {
    buildNotesWorkspaceLinkedViews,
    extractNotesWorkspaceOutline,
    extractNotesWorkspaceWikiLinks,
    hasNotesWorkspaceWikiLinkToEntity,
} from './notesWorkspaceLinks';
import type { Entity } from '../types';

const target: Entity = {
    id: 'note-target',
    parentId: null,
    type: 'note',
    name: 'Target Note',
    description: '# Target\n\nText',
    properties: {},
    tags: [],
    database: 'general',
};

const source: Entity = {
    id: 'note-source',
    parentId: null,
    type: 'note',
    name: 'Source Note',
    description: [
        '# Intro',
        'Text [[note-target|Target alias]] and [[Missing#Part]].',
        '```',
        '# Ignored code heading',
        '```',
        '## Details',
    ].join('\n'),
    properties: {},
    tags: [],
    database: 'general',
};

const outline = extractNotesWorkspaceOutline(source.description);
assert.deepEqual(outline.map((heading) => [heading.level, heading.text, heading.line]), [
    [1, 'Intro', 1],
    [2, 'Details', 6],
]);

const links = extractNotesWorkspaceWikiLinks(source.description, [target, source]);
assert.equal(links.length, 2);
assert.equal(links[0].target, 'note-target');
assert.equal(links[0].label, 'Target alias');
assert.equal(links[0].resolvedEntityId, 'note-target');
assert.equal(links[1].target, 'Missing');
assert.equal(links[1].heading, 'Part');
assert.equal(links[1].resolvedEntityId, undefined);

assert.equal(hasNotesWorkspaceWikiLinkToEntity(source, target), true);
assert.equal(hasNotesWorkspaceWikiLinkToEntity(target, source), false);

const linkedViews = buildNotesWorkspaceLinkedViews(target, [target, source]);
assert.equal(linkedViews.backlinks.length, 1);
assert.equal(linkedViews.backlinks[0].id, 'note-source');
assert.equal(linkedViews.outline.length, 1);

console.log('notes workspace links tests passed');
