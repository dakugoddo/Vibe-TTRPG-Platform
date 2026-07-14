import type { SheetBlockV1 } from './entitySheetSchema';

export interface EntitySheetBlockDefinition {
    type: SheetBlockV1['type'];
    category: 'layout' | 'display';
    schemaVersion: 1;
}

const DEFINITIONS: Record<SheetBlockV1['type'], EntitySheetBlockDefinition> = {
    container: { type: 'container', category: 'layout', schemaVersion: 1 },
    'property-value': { type: 'property-value', category: 'display', schemaVersion: 1 },
    markdown: { type: 'markdown', category: 'display', schemaVersion: 1 },
};

export function getEntitySheetBlockDefinition(type: string): EntitySheetBlockDefinition | undefined {
    return DEFINITIONS[type as SheetBlockV1['type']];
}

export function listEntitySheetBlockDefinitions(): EntitySheetBlockDefinition[] {
    return Object.values(DEFINITIONS);
}
