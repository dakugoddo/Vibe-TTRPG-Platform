import type { EntitySheetSchemaV1 } from './entitySheetSchema';

export const GENERIC_NOTE_SHEET_SCHEMA: EntitySheetSchemaV1 = {
    schemaVersion: 1,
    id: 'built-in-generic-note',
    name: 'Generic note',
    revision: 1,
    status: 'published',
    entityTypes: ['note'],
    density: 'inherit',
    root: {
        id: 'root',
        type: 'container',
        layout: 'column',
        gap: 'md',
        children: [{
            id: 'description',
            type: 'markdown',
            binding: { scope: 'self', path: ['description'] },
        }],
    },
};
