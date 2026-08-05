import assert from 'node:assert/strict';
import { createElement } from 'react';
import ReactMarkdown from 'react-markdown';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Entity } from '../../types';
import type { EntitySheetSchemaV1 } from '../../utils/entitySheetSchema';
import { EntitySheetBoundary } from './EntitySheetBoundary';
import { EntitySheetRenderer } from './EntitySheetRenderer';

const TestMarkdownRenderer = ({ content }: { content: string; entityId: string }) => (
    createElement(ReactMarkdown, null, content)
);

const entity: Entity = {
    id: 'hero',
    parentId: null,
    type: 'character',
    name: 'Hero',
    description: '**Chronicle**',
    properties: { resources: { hp: 7 } },
    tags: [],
};

const schema: EntitySheetSchemaV1 = {
    schemaVersion: 1,
    id: 'summary',
    name: 'Summary',
    revision: 1,
    status: 'published',
    entityTypes: ['character'],
    density: 'inherit',
    root: {
        id: 'root',
        type: 'container',
        layout: 'column',
        children: [{
            id: 'hp',
            type: 'property-value',
            label: 'Hit points',
            binding: { scope: 'self', path: ['properties', 'resources', 'hp'] },
            format: 'number',
            emptyText: '—',
        }],
    },
};

const html = renderToStaticMarkup(createElement(EntitySheetRenderer, {
    entity,
    schema,
    markdownRenderer: TestMarkdownRenderer,
}));
assert.match(html, /Hit points/);
assert.match(html, />7</);
assert.doesNotMatch(html, /Unknown block/);

const fallbackHtml = renderToStaticMarkup(createElement(EntitySheetBoundary, {
    entity,
    schema: { ...schema, root: { ...schema.root, type: 'script' } },
    fallback: createElement('div', { 'data-hardcoded-fallback': true }, 'Existing character sheet'),
    markdownRenderer: TestMarkdownRenderer,
    showDiagnostics: true,
}));
assert.match(fallbackHtml, /data-hardcoded-fallback="true"/);
assert.match(fallbackHtml, /Existing character sheet/);
assert.match(fallbackHtml, /block\.type\.unknown/);
assert.doesNotMatch(fallbackHtml, /data-entity-sheet-schema="summary"/);

const markdownSchema = {
    ...schema,
    id: 'generic-note',
    entityTypes: ['note'],
    root: {
        ...schema.root,
        children: [{
            id: 'description',
            type: 'markdown',
            binding: { scope: 'self', path: ['description'] },
            emptyText: 'Nothing written yet.',
        }],
    },
};
const markdownHtml = renderToStaticMarkup(createElement(EntitySheetBoundary, {
    entity: { ...entity, type: 'note' },
    schema: markdownSchema,
    fallback: createElement('div', null, 'Legacy note fallback'),
    markdownRenderer: TestMarkdownRenderer,
    showDiagnostics: true,
}));
assert.match(markdownHtml, /<strong>Chronicle<\/strong>/);
assert.doesNotMatch(markdownHtml, /Legacy note fallback/);
assert.doesNotMatch(markdownHtml, /data-entity-sheet-diagnostics/);

console.log('entity sheet renderer tests passed');
