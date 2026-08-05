import type { EntityType } from '../types';

export type SheetDensity = 'inherit' | 'compact' | 'balanced' | 'spacious';
export type SheetSurfaceVariant = 'plain' | 'subtle' | 'raised' | 'accent';
export type SheetGap = 'none' | 'sm' | 'md' | 'lg';

export interface SheetBindingV1 {
    scope: 'self';
    path: string[];
    fallback?: unknown;
}

interface SheetBlockBaseV1 {
    id: string;
    label?: string;
    description?: string;
    permission?: 'view' | 'edit';
    surface?: SheetSurfaceVariant;
}

export interface SheetContainerBlockV1 extends SheetBlockBaseV1 {
    type: 'container';
    layout: 'column' | 'row' | 'grid' | 'tabs';
    columns?: 1 | 2 | 3 | 4 | 6 | 12;
    gap?: SheetGap;
    children: SheetBlockV1[];
}

export interface SheetPropertyValueBlockV1 extends SheetBlockBaseV1 {
    type: 'property-value';
    binding: SheetBindingV1;
    format?: 'text' | 'number' | 'boolean' | 'json';
    emptyText?: string;
}

export interface SheetMarkdownBlockV1 extends SheetBlockBaseV1 {
    type: 'markdown';
    binding: SheetBindingV1;
    emptyText?: string;
}

export type SheetBlockV1 = SheetContainerBlockV1 | SheetPropertyValueBlockV1 | SheetMarkdownBlockV1;

export interface EntitySheetSchemaV1 {
    schemaVersion: 1;
    id: string;
    name: string;
    revision: number;
    status: 'draft' | 'published';
    entityTypes: EntityType[];
    density: SheetDensity;
    root: SheetContainerBlockV1;
}

export interface SheetDiagnostic {
    level: 'error' | 'warning';
    code: string;
    message: string;
    path: Array<string | number>;
    blockId?: string;
}

export type SheetSchemaResult =
    | { ok: true; schema: EntitySheetSchemaV1; diagnostics: SheetDiagnostic[] }
    | { ok: false; diagnostics: SheetDiagnostic[] };

export const ENTITY_SHEET_LIMITS = {
    maxDepth: 16,
    maxBlocks: 500,
    maxBindingSegments: 32,
    maxBytes: 256 * 1024,
    maxStringLength: 4_096,
    maxIdentifierLength: 256,
} as const;

const ENTITY_TYPES = new Set<EntityType>(['character', 'object', 'ability', 'competency', 'tag', 'canvas', 'note', 'portal', 'folder', 'attack']);
const DENSITIES = new Set<SheetDensity>(['inherit', 'compact', 'balanced', 'spacious']);
const LAYOUTS = new Set(['column', 'row', 'grid', 'tabs']);
const GAPS = new Set<SheetGap>(['none', 'sm', 'md', 'lg']);
const FORMATS = new Set(['text', 'number', 'boolean', 'json']);
const SURFACES = new Set<SheetSurfaceVariant>(['plain', 'subtle', 'raised', 'accent']);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function normalizeBase(input: Record<string, unknown>): Omit<SheetBlockBaseV1, 'type'> {
    const surface = SURFACES.has(input.surface as SheetSurfaceVariant) ? input.surface as SheetSurfaceVariant : undefined;
    const permission = input.permission === 'view' || input.permission === 'edit' ? input.permission : undefined;
    return {
        id: typeof input.id === 'string' ? input.id.trim() : '',
        ...(optionalString(input.label) !== undefined ? { label: optionalString(input.label) } : {}),
        ...(optionalString(input.description) !== undefined ? { description: optionalString(input.description) } : {}),
        ...(permission ? { permission } : {}),
        ...(surface ? { surface } : {}),
    };
}

function findDepthLimit(
    input: unknown,
    path: Array<string | number>,
    depth: number
): SheetDiagnostic | null {
    if (depth > ENTITY_SHEET_LIMITS.maxDepth) {
        return {
            level: 'error',
            code: 'schema.depth.limit',
            message: `Sheet block depth exceeds ${ENTITY_SHEET_LIMITS.maxDepth}.`,
            path,
        };
    }
    if (!isRecord(input) || input.type !== 'container' || !Array.isArray(input.children)) return null;
    for (let index = 0; index < input.children.length; index += 1) {
        const diagnostic = findDepthLimit(input.children[index], [...path, 'children', index], depth + 1);
        if (diagnostic) return diagnostic;
    }
    return null;
}

function findBlockCountLimit(
    input: unknown,
    path: Array<string | number>,
    state: { count: number }
): SheetDiagnostic | null {
    if (!isRecord(input)) return null;
    state.count += 1;
    if (state.count > ENTITY_SHEET_LIMITS.maxBlocks) {
        return {
            level: 'error',
            code: 'schema.blocks.limit',
            message: `Sheet block count exceeds ${ENTITY_SHEET_LIMITS.maxBlocks}.`,
            path,
        };
    }
    if (input.type !== 'container' || !Array.isArray(input.children)) return null;
    for (let index = 0; index < input.children.length; index += 1) {
        const diagnostic = findBlockCountLimit(input.children[index], [...path, 'children', index], state);
        if (diagnostic) return diagnostic;
    }
    return null;
}

function findUnknownBlockType(input: unknown, path: Array<string | number>): SheetDiagnostic | null {
    if (!isRecord(input)) return null;
    if (input.type !== 'container' && input.type !== 'property-value' && input.type !== 'markdown') {
        return { level: 'error', code: 'block.type.unknown', message: `Unknown block type: ${String(input.type)}`, path: [...path, 'type'] };
    }
    if (input.type === 'container' && Array.isArray(input.children)) {
        for (let index = 0; index < input.children.length; index += 1) {
            const diagnostic = findUnknownBlockType(input.children[index], [...path, 'children', index]);
            if (diagnostic) return diagnostic;
        }
    }
    return null;
}

function normalizeBlock(input: unknown): SheetBlockV1 | null {
    if (!isRecord(input)) return null;
    if (input.type === 'container') {
        if (!LAYOUTS.has(input.layout as string) || !Array.isArray(input.children)) return null;
        const children = input.children.map(normalizeBlock);
        if (children.some((child) => child === null)) return null;
        const gap = GAPS.has(input.gap as SheetGap) ? input.gap as SheetGap : undefined;
        const columns = [1, 2, 3, 4, 6, 12].includes(input.columns as number)
            ? input.columns as SheetContainerBlockV1['columns']
            : undefined;
        return {
            ...normalizeBase(input),
            type: 'container',
            layout: input.layout as SheetContainerBlockV1['layout'],
            ...(columns ? { columns } : {}),
            ...(gap ? { gap } : {}),
            children: children as SheetBlockV1[],
        };
    }
    if (input.type === 'markdown' && isRecord(input.binding)) {
        const binding = input.binding;
        if (binding.scope !== 'self' || !Array.isArray(binding.path) || !binding.path.every((segment) => typeof segment === 'string')) return null;
        return {
            ...normalizeBase(input),
            type: 'markdown',
            binding: {
                scope: 'self',
                path: binding.path as string[],
                ...('fallback' in binding ? { fallback: binding.fallback } : {}),
            },
            ...(optionalString(input.emptyText) !== undefined ? { emptyText: optionalString(input.emptyText) } : {}),
        };
    }
    if (input.type === 'property-value' && isRecord(input.binding)) {
        const binding = input.binding;
        if (binding.scope !== 'self' || !Array.isArray(binding.path) || !binding.path.every((segment) => typeof segment === 'string')) return null;
        const format = FORMATS.has(input.format as string) ? input.format as SheetPropertyValueBlockV1['format'] : undefined;
        return {
            ...normalizeBase(input),
            type: 'property-value',
            binding: {
                scope: 'self',
                path: binding.path as string[],
                ...('fallback' in binding ? { fallback: binding.fallback } : {}),
            },
            ...(format ? { format } : {}),
            ...(optionalString(input.emptyText) !== undefined ? { emptyText: optionalString(input.emptyText) } : {}),
        };
    }
    return null;
}

function findDuplicateBlockId(
    block: SheetBlockV1,
    path: Array<string | number>,
    seen: Set<string>
): SheetDiagnostic | null {
    if (!block.id.trim()) {
        return { level: 'error', code: 'block.id.required', message: 'Block id is required.', path: [...path, 'id'] };
    }
    if (seen.has(block.id)) {
        return { level: 'error', code: 'block.id.duplicate', message: `Duplicate block id: ${block.id}`, path: [...path, 'id'], blockId: block.id };
    }
    seen.add(block.id);
    if (block.type === 'container') {
        for (let index = 0; index < block.children.length; index += 1) {
            const diagnostic = findDuplicateBlockId(block.children[index], [...path, 'children', index], seen);
            if (diagnostic) return diagnostic;
        }
    }
    return null;
}

function findUnsafeBindingPath(
    block: SheetBlockV1,
    path: Array<string | number>
): SheetDiagnostic | null {
    if (block.type === 'property-value' || block.type === 'markdown') {
        const isDescriptionBinding = block.binding.path.length === 1 && block.binding.path[0] === 'description';
        const isPropertiesBinding = block.binding.path[0] === 'properties';
        if (!isDescriptionBinding && !isPropertiesBinding) {
            return {
                level: 'error',
                code: 'binding.path.root',
                message: 'Binding must target description or properties.',
                path: [...path, 'binding', 'path', 0],
                blockId: block.id,
            };
        }
        if (block.binding.path.length > ENTITY_SHEET_LIMITS.maxBindingSegments) {
            return {
                level: 'error',
                code: 'binding.path.limit',
                message: `Binding path exceeds ${ENTITY_SHEET_LIMITS.maxBindingSegments} segments.`,
                path: [...path, 'binding', 'path'],
                blockId: block.id,
            };
        }
        const unsafeIndex = block.binding.path.findIndex((segment) =>
            segment === '__proto__' || segment === 'prototype' || segment === 'constructor'
        );
        if (unsafeIndex >= 0) {
            return {
                level: 'error',
                code: 'binding.path.unsafe',
                message: 'Binding path contains an unsafe segment.',
                path: [...path, 'binding', 'path', unsafeIndex],
                blockId: block.id,
            };
        }
    }
    if (block.type === 'container') {
        for (let index = 0; index < block.children.length; index += 1) {
            const diagnostic = findUnsafeBindingPath(block.children[index], [...path, 'children', index]);
            if (diagnostic) return diagnostic;
        }
    }
    return null;
}

function findStringLimit(input: unknown, path: Array<string | number>): SheetDiagnostic | null {
    if (!isRecord(input)) return null;
    const boundedFields: Array<[string, number]> = [
        ['id', ENTITY_SHEET_LIMITS.maxIdentifierLength],
        ['label', ENTITY_SHEET_LIMITS.maxStringLength],
        ['description', ENTITY_SHEET_LIMITS.maxStringLength],
        ['emptyText', ENTITY_SHEET_LIMITS.maxStringLength],
    ];
    for (const [field, maxLength] of boundedFields) {
        const value = input[field];
        if (typeof value === 'string' && value.length > maxLength) {
            return { level: 'error', code: 'schema.string.limit', message: `${field} exceeds ${maxLength} characters.`, path: [...path, field] };
        }
    }
    if ((input.type === 'property-value' || input.type === 'markdown') && isRecord(input.binding) && Array.isArray(input.binding.path)) {
        const emptySegmentIndex = input.binding.path.findIndex((segment) => segment === '');
        if (emptySegmentIndex >= 0) {
            return {
                level: 'error',
                code: 'binding.path.segment.empty',
                message: 'Binding path contains an empty segment.',
                path: [...path, 'binding', 'path', emptySegmentIndex],
            };
        }
        const segmentIndex = input.binding.path.findIndex((segment) =>
            typeof segment === 'string' && segment.length > ENTITY_SHEET_LIMITS.maxIdentifierLength
        );
        if (segmentIndex >= 0) {
            return {
                level: 'error',
                code: 'binding.path.segment.limit',
                message: `Binding segment exceeds ${ENTITY_SHEET_LIMITS.maxIdentifierLength} characters.`,
                path: [...path, 'binding', 'path', segmentIndex],
            };
        }
    }
    if (input.type === 'container' && Array.isArray(input.children)) {
        for (let index = 0; index < input.children.length; index += 1) {
            const diagnostic = findStringLimit(input.children[index], [...path, 'children', index]);
            if (diagnostic) return diagnostic;
        }
    }
    return null;
}

export function normalizeEntitySheetSchema(input: unknown): SheetSchemaResult {
    const error = (code: string, message: string): SheetSchemaResult => ({
        ok: false,
        diagnostics: [{ level: 'error', code, message, path: [] }],
    });
    if (!isRecord(input)) return error('schema.invalid', 'Sheet schema must be an object.');
    let serializedBytes: number;
    try {
        serializedBytes = new TextEncoder().encode(JSON.stringify(input)).byteLength;
    } catch {
        return error('schema.invalid', 'Sheet schema must be JSON-serializable.');
    }
    if (serializedBytes > ENTITY_SHEET_LIMITS.maxBytes) {
        return error('schema.bytes.limit', `Sheet schema exceeds ${ENTITY_SHEET_LIMITS.maxBytes} bytes.`);
    }
    if (input.schemaVersion !== 1) return error('schema.version', 'Unsupported sheet schema version.');
    if (typeof input.id !== 'string' || !input.id.trim()) return error('schema.id', 'Sheet schema id is required.');
    if (input.id.length > ENTITY_SHEET_LIMITS.maxIdentifierLength) {
        return { ok: false, diagnostics: [{ level: 'error', code: 'schema.string.limit', message: `id exceeds ${ENTITY_SHEET_LIMITS.maxIdentifierLength} characters.`, path: ['id'] }] };
    }
    if (typeof input.name !== 'string' || !input.name.trim()) return error('schema.name', 'Sheet schema name is required.');
    if (input.name.length > ENTITY_SHEET_LIMITS.maxIdentifierLength) {
        return { ok: false, diagnostics: [{ level: 'error', code: 'schema.string.limit', message: `name exceeds ${ENTITY_SHEET_LIMITS.maxIdentifierLength} characters.`, path: ['name'] }] };
    }
    if (!Number.isInteger(input.revision) || (input.revision as number) < 1) return error('schema.revision', 'Sheet schema revision must be a positive integer.');
    if (input.status !== 'draft' && input.status !== 'published') return error('schema.status', 'Invalid sheet schema status.');
    if (!Array.isArray(input.entityTypes) || !input.entityTypes.every((type) => ENTITY_TYPES.has(type as EntityType))) return error('schema.entityTypes', 'Invalid entity type assignment.');
    if (input.entityTypes.length === 0 || input.entityTypes.length > ENTITY_TYPES.size) {
        return error('schema.entityTypes.limit', `Sheet schema must target between 1 and ${ENTITY_TYPES.size} entity types.`);
    }
    if (!DENSITIES.has(input.density as SheetDensity)) return error('schema.density', 'Invalid sheet density.');
    const depthDiagnostic = findDepthLimit(input.root, ['root'], 1);
    if (depthDiagnostic) return { ok: false, diagnostics: [depthDiagnostic] };
    const blockCountDiagnostic = findBlockCountLimit(input.root, ['root'], { count: 0 });
    if (blockCountDiagnostic) return { ok: false, diagnostics: [blockCountDiagnostic] };
    const unknownBlockDiagnostic = findUnknownBlockType(input.root, ['root']);
    if (unknownBlockDiagnostic) return { ok: false, diagnostics: [unknownBlockDiagnostic] };
    const stringLimitDiagnostic = findStringLimit(input.root, ['root']);
    if (stringLimitDiagnostic) return { ok: false, diagnostics: [stringLimitDiagnostic] };
    const root = normalizeBlock(input.root);
    if (!root || root.type !== 'container') return error('schema.root', 'Sheet schema root must be a valid container.');
    const blockIdDiagnostic = findDuplicateBlockId(root, ['root'], new Set());
    if (blockIdDiagnostic) return { ok: false, diagnostics: [blockIdDiagnostic] };
    const bindingDiagnostic = findUnsafeBindingPath(root, ['root']);
    if (bindingDiagnostic) return { ok: false, diagnostics: [bindingDiagnostic] };
    const schema: EntitySheetSchemaV1 = {
        schemaVersion: 1,
        id: input.id.trim(),
        name: input.name.trim(),
        revision: input.revision as number,
        status: input.status,
        entityTypes: input.entityTypes as EntityType[],
        density: input.density as SheetDensity,
        root,
    };
    if (new TextEncoder().encode(serializeEntitySheetSchema(schema)).byteLength > ENTITY_SHEET_LIMITS.maxBytes) {
        return error('schema.bytes.limit', `Canonical sheet schema exceeds ${ENTITY_SHEET_LIMITS.maxBytes} bytes.`);
    }
    return {
        ok: true,
        diagnostics: [],
        schema,
    };
}

export function serializeEntitySheetSchema(schema: EntitySheetSchemaV1): string {
    return `${JSON.stringify(schema, null, 2)}\n`;
}

export function parseEntitySheetSchema(serialized: string): SheetSchemaResult {
    try {
        return normalizeEntitySheetSchema(JSON.parse(serialized));
    } catch {
        return { ok: false, diagnostics: [{ level: 'error', code: 'schema.json', message: 'Sheet schema JSON is invalid.', path: [] }] };
    }
}
