import fs from 'node:fs';
import path from 'node:path';

export interface WorldSheetDiagnostic {
    level: 'error' | 'warning';
    message: string;
}

export interface WorldSheetReadResult {
    sheetId: string;
    exists: boolean;
    schema: Record<string, unknown> | null;
    diagnostics: WorldSheetDiagnostic[];
    hasBackup: boolean;
    size?: number;
    modifiedAt?: string;
}

export interface WorldSheetWriteResult extends WorldSheetReadResult {
    backupCreated: boolean;
}

export interface WorldSheetRollbackResult extends WorldSheetReadResult {
    restored: boolean;
}

export interface WorldSheetResetResult extends WorldSheetReadResult {
    reset: boolean;
}

const WORLD_SHEET_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const SHEET_ENTITY_TYPES = new Set(['character', 'object', 'ability', 'competency', 'tag', 'canvas', 'note', 'portal', 'folder', 'attack']);
const SHEET_DENSITIES = new Set(['inherit', 'compact', 'balanced', 'spacious']);
const SHEET_LAYOUTS = new Set(['column', 'row', 'grid', 'tabs']);
const SHEET_GAPS = new Set(['none', 'sm', 'md', 'lg']);
const SHEET_SURFACES = new Set(['plain', 'subtle', 'raised', 'accent']);
const SHEET_PERMISSIONS = new Set(['view', 'edit']);
const SHEET_FORMATS = new Set(['text', 'number', 'boolean', 'json']);
const SHEET_COLUMNS = new Set([1, 2, 3, 4, 6, 12]);
const FORBIDDEN_BINDING_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_SHEET_DEPTH = 16;
const MAX_SHEET_BLOCKS = 500;
const MAX_BINDING_SEGMENTS = 32;
const MAX_SHEET_BYTES = 256 * 1024;
const MAX_SCHEMA_STRING = 4_096;
const MAX_IDENTIFIER_STRING = 256;

type SheetCacheEntry = {
    size: number;
    modifiedMs: number;
    result: WorldSheetReadResult;
};

const sheetReadCache = new Map<string, SheetCacheEntry>();

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertBoundedString(value: unknown, field: string, maxLength = MAX_SCHEMA_STRING): asserts value is string {
    if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
        throw new Error(`${field} must be a non-empty string up to ${maxLength} characters.`);
    }
}

function assertOptionalStringLimit(value: unknown, field: string, maxLength = MAX_SCHEMA_STRING): void {
    if (typeof value === 'string' && value.length > maxLength) {
        throw new Error(`${field} exceeds ${maxLength} characters.`);
    }
}

function assertSerializedSize(value: unknown): string {
    const serialized = JSON.stringify(value);
    if (Buffer.byteLength(serialized, 'utf-8') > MAX_SHEET_BYTES) {
        throw new Error(`Sheet schema exceeds ${MAX_SHEET_BYTES} bytes.`);
    }
    return serialized;
}

export function isWorldSheetId(value: unknown): value is string {
    return typeof value === 'string' && WORLD_SHEET_ID_PATTERN.test(value);
}

function assertNotSymbolicWorldSheetPath(candidate: string): void {
    if (fs.existsSync(candidate) && fs.lstatSync(candidate).isSymbolicLink()) {
        throw new Error(`World sheet path cannot be a symbolic link or junction: ${candidate}`);
    }
}

export function resolveWorldSheetPath(worldPath: string, sheetId: string): string {
    if (!isWorldSheetId(sheetId)) throw new Error(`Invalid sheet id: ${sheetId}`);
    const vibeDir = path.join(worldPath, '.vibe');
    const sheetsDir = path.join(vibeDir, 'sheets');
    const filePath = path.join(sheetsDir, `${sheetId}.json`);
    [vibeDir, sheetsDir, filePath, `${filePath}.bak`].forEach(assertNotSymbolicWorldSheetPath);
    return filePath;
}

function assertSheetBinding(value: unknown): void {
    if (!isRecord(value) || value.scope !== 'self' || !Array.isArray(value.path)) {
        throw new Error('Sheet binding must use a self path.');
    }
    if (value.path.length === 0
        || value.path.length > MAX_BINDING_SEGMENTS
        || value.path.some((segment) => typeof segment !== 'string' || segment.length > MAX_IDENTIFIER_STRING)) {
        throw new Error('Unsafe sheet binding path.');
    }
    const path = value.path as string[];
    if (path.some((segment) => !segment || FORBIDDEN_BINDING_SEGMENTS.has(segment))) {
        throw new Error('Unsafe sheet binding path.');
    }
    const isDescription = path.length === 1 && path[0] === 'description';
    const isProperty = path[0] === 'properties';
    if (!isDescription && !isProperty) throw new Error('Unsafe sheet binding path.');
}

function assertSheetBlocks(root: unknown): void {
    const seenIds = new Set<string>();
    let blockCount = 0;

    const visit = (value: unknown, depth: number): void => {
        if (!isRecord(value)) throw new Error('Sheet block must be a JSON object.');
        if (depth > MAX_SHEET_DEPTH) throw new Error(`Sheet block depth exceeds ${MAX_SHEET_DEPTH}.`);
        blockCount += 1;
        if (blockCount > MAX_SHEET_BLOCKS) throw new Error(`Sheet block count exceeds ${MAX_SHEET_BLOCKS}.`);
        assertBoundedString(value.id, 'Sheet block id', MAX_IDENTIFIER_STRING);
        assertOptionalStringLimit(value.label, 'Sheet block label');
        assertOptionalStringLimit(value.description, 'Sheet block description');
        assertOptionalStringLimit(value.emptyText, 'Sheet block emptyText');
        const canonicalId = value.id.trim();
        if (seenIds.has(canonicalId)) throw new Error(`Duplicate sheet block id: ${canonicalId}`);
        seenIds.add(canonicalId);

        if (value.type === 'container') {
            if (typeof value.layout !== 'string' || !SHEET_LAYOUTS.has(value.layout) || !Array.isArray(value.children)) {
                throw new Error('Sheet container requires a valid layout and children.');
            }
            value.children.forEach((child) => visit(child, depth + 1));
            return;
        }
        if (value.type === 'markdown' || value.type === 'property-value') {
            assertSheetBinding(value.binding);
            return;
        }
        throw new Error(`Unknown sheet block type: ${String(value.type)}`);
    };

    visit(root, 1);
    if (!isRecord(root) || root.type !== 'container') throw new Error('Sheet schema root must be a container.');
}

function normalizeSheetBlock(value: Record<string, unknown>): Record<string, unknown> {
    const base: Record<string, unknown> = { id: (value.id as string).trim() };
    if (typeof value.label === 'string') base.label = value.label;
    if (typeof value.description === 'string') base.description = value.description;
    if (typeof value.permission === 'string' && SHEET_PERMISSIONS.has(value.permission)) base.permission = value.permission;
    if (typeof value.surface === 'string' && SHEET_SURFACES.has(value.surface)) base.surface = value.surface;

    if (value.type === 'container') {
        const normalized: Record<string, unknown> = {
            ...base,
            type: 'container',
            layout: value.layout,
        };
        if (typeof value.columns === 'number' && SHEET_COLUMNS.has(value.columns)) normalized.columns = value.columns;
        if (typeof value.gap === 'string' && SHEET_GAPS.has(value.gap)) normalized.gap = value.gap;
        normalized.children = (value.children as Record<string, unknown>[]).map(normalizeSheetBlock);
        return normalized;
    }

    const binding = value.binding as Record<string, unknown>;
    const normalizedBinding: Record<string, unknown> = {
        scope: 'self',
        path: [...(binding.path as string[])],
    };
    if (Object.prototype.hasOwnProperty.call(binding, 'fallback')) normalizedBinding.fallback = binding.fallback;
    const normalized: Record<string, unknown> = {
        ...base,
        type: value.type,
        binding: normalizedBinding,
    };
    if (value.type === 'property-value' && typeof value.format === 'string' && SHEET_FORMATS.has(value.format)) normalized.format = value.format;
    if (typeof value.emptyText === 'string') normalized.emptyText = value.emptyText;
    return normalized;
}

function normalizePublishableSheet(sheetId: string, value: unknown): Record<string, unknown> {
    if (!isRecord(value)) throw new Error('Sheet schema must be a JSON object.');
    assertSerializedSize(value);
    if (value.schemaVersion !== 1) throw new Error('Sheet schemaVersion must be 1.');
    if (value.status !== 'published') throw new Error('Sheet schema status must be published.');
    assertBoundedString(value.id, 'Sheet schema id', MAX_IDENTIFIER_STRING);
    assertBoundedString(value.name, 'Sheet schema name', MAX_IDENTIFIER_STRING);
    if (!Number.isInteger(value.revision) || Number(value.revision) < 1) throw new Error('Sheet schema revision must be a positive integer.');
    if (typeof value.density !== 'string' || !SHEET_DENSITIES.has(value.density)) throw new Error('Sheet schema density is invalid.');
    if (!Array.isArray(value.entityTypes)
        || value.entityTypes.length === 0
        || value.entityTypes.length > SHEET_ENTITY_TYPES.size
        || !value.entityTypes.includes(sheetId)
        || !value.entityTypes.every((entityType) => typeof entityType === 'string' && SHEET_ENTITY_TYPES.has(entityType))) {
        throw new Error(`Sheet schema must target entity type: ${sheetId} using valid entity types`);
    }
    if (!isRecord(value.root)) throw new Error('Sheet schema root is required.');
    assertSheetBlocks(value.root);
    const normalized = {
        schemaVersion: 1,
        id: value.id.trim(),
        name: value.name.trim(),
        revision: value.revision,
        status: 'published',
        entityTypes: [...value.entityTypes],
        density: value.density,
        root: normalizeSheetBlock(value.root),
    };
    if (Buffer.byteLength(`${JSON.stringify(normalized, null, 2)}\n`, 'utf-8') > MAX_SHEET_BYTES) {
        throw new Error(`Canonical sheet schema exceeds ${MAX_SHEET_BYTES} bytes.`);
    }
    return normalized;
}

function atomicWrite(filePath: string, content: string): void {
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
        fs.writeFileSync(tempPath, content, 'utf-8');
        fs.renameSync(tempPath, filePath);
    } catch (error) {
        if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true });
        throw error;
    }
}

export function readWorldSheetFile(worldPath: string, sheetId: string): WorldSheetReadResult {
    const filePath = resolveWorldSheetPath(worldPath, sheetId);
    const backupPath = `${filePath}.bak`;
    if (!fs.existsSync(filePath)) {
        sheetReadCache.delete(filePath);
        return {
            sheetId,
            exists: false,
            schema: null,
            diagnostics: [],
            hasBackup: fs.existsSync(backupPath),
        };
    }

    const stat = fs.statSync(filePath);
    const result: WorldSheetReadResult = {
        sheetId,
        exists: true,
        schema: null,
        diagnostics: [],
        hasBackup: fs.existsSync(backupPath),
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
    };
    const cached = sheetReadCache.get(filePath);
    if (cached && cached.size === stat.size && cached.modifiedMs === stat.mtimeMs) {
        return { ...cached.result, hasBackup: result.hasBackup };
    }
    if (stat.size > MAX_SHEET_BYTES) {
        result.diagnostics.push({ level: 'error', message: `Sheet schema exceeds ${MAX_SHEET_BYTES} bytes.` });
        sheetReadCache.set(filePath, { size: stat.size, modifiedMs: stat.mtimeMs, result });
        return result;
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
        result.schema = normalizePublishableSheet(sheetId, parsed);
    } catch (error) {
        result.diagnostics.push({
            level: 'error',
            message: error instanceof Error ? error.message : String(error),
        });
    }
    sheetReadCache.set(filePath, { size: stat.size, modifiedMs: stat.mtimeMs, result });
    return result;
}

export function writeWorldSheetFile(worldPath: string, sheetId: string, schema: unknown): WorldSheetWriteResult {
    const normalizedSchema = normalizePublishableSheet(sheetId, schema);
    const filePath = resolveWorldSheetPath(worldPath, sheetId);
    const backupPath = `${filePath}.bak`;
    const hadExistingFile = fs.existsSync(filePath);
    const hadExistingBackup = fs.existsSync(backupPath);
    let previousContent: string | null = null;
    let previousIsValid = false;
    if (hadExistingFile && fs.statSync(filePath).size <= MAX_SHEET_BYTES) {
        previousContent = fs.readFileSync(filePath, 'utf-8');
        try {
            normalizePublishableSheet(sheetId, JSON.parse(previousContent) as unknown);
            previousIsValid = true;
        } catch {
            previousIsValid = false;
        }
    }
    if (previousIsValid && hadExistingBackup && fs.statSync(backupPath).size > MAX_SHEET_BYTES) {
        throw new Error(`Sheet backup exceeds ${MAX_SHEET_BYTES} bytes.`);
    }
    const previousBackupContent = previousIsValid && hadExistingBackup
        ? fs.readFileSync(backupPath, 'utf-8')
        : null;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    try {
        if (previousIsValid && previousContent !== null) atomicWrite(backupPath, previousContent);
        atomicWrite(filePath, `${JSON.stringify(normalizedSchema, null, 2)}\n`);
        sheetReadCache.delete(filePath);
        return { ...readWorldSheetFile(worldPath, sheetId), backupCreated: previousIsValid };
    } catch (error) {
        const restoreErrors: unknown[] = [];
        try {
            if (previousContent !== null) atomicWrite(filePath, previousContent);
            else if (!hadExistingFile && fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
        } catch (restoreError) {
            restoreErrors.push(restoreError);
        }
        try {
            if (previousIsValid) {
                if (previousBackupContent !== null) atomicWrite(backupPath, previousBackupContent);
                else if (!hadExistingBackup && fs.existsSync(backupPath)) fs.rmSync(backupPath, { force: true });
            }
        } catch (restoreError) {
            restoreErrors.push(restoreError);
        }
        if (restoreErrors.length > 0) throw new AggregateError([error, ...restoreErrors], 'Sheet write and rollback restoration failed.');
        throw error;
    }
}

export function rollbackWorldSheetFile(worldPath: string, sheetId: string): WorldSheetRollbackResult {
    const filePath = resolveWorldSheetPath(worldPath, sheetId);
    const backupPath = `${filePath}.bak`;
    if (!fs.existsSync(backupPath)) throw new Error(`No backup found for sheet: ${sheetId}`);
    if (fs.statSync(backupPath).size > MAX_SHEET_BYTES) throw new Error(`Sheet backup exceeds ${MAX_SHEET_BYTES} bytes.`);
    const backupContent = fs.readFileSync(backupPath, 'utf-8');
    const backupSchema = normalizePublishableSheet(sheetId, JSON.parse(backupContent) as unknown);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    atomicWrite(filePath, `${JSON.stringify(backupSchema, null, 2)}\n`);
    sheetReadCache.delete(filePath);
    return { ...readWorldSheetFile(worldPath, sheetId), restored: true };
}

export function resetWorldSheetFile(worldPath: string, sheetId: string): WorldSheetResetResult {
    const filePath = resolveWorldSheetPath(worldPath, sheetId);
    const backupPath = `${filePath}.bak`;
    if (fs.existsSync(filePath)) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const activeContent = fs.statSync(filePath).size <= MAX_SHEET_BYTES
            ? fs.readFileSync(filePath, 'utf-8')
            : null;
        let activeIsValid = false;
        if (activeContent !== null) {
            try {
                normalizePublishableSheet(sheetId, JSON.parse(activeContent) as unknown);
                activeIsValid = true;
            } catch {
                activeIsValid = false;
            }
        }
        const hadBackupFile = fs.existsSync(backupPath);
        if (activeIsValid && hadBackupFile && fs.statSync(backupPath).size > MAX_SHEET_BYTES) {
            throw new Error(`Sheet backup exceeds ${MAX_SHEET_BYTES} bytes.`);
        }
        const previousBackupContent = activeIsValid && hadBackupFile && fs.statSync(backupPath).size <= MAX_SHEET_BYTES
            ? fs.readFileSync(backupPath, 'utf-8')
            : null;
        try {
            if (activeIsValid && activeContent !== null) atomicWrite(backupPath, activeContent);
            fs.rmSync(filePath);
        } catch (error) {
            try {
                if (activeIsValid) {
                    if (previousBackupContent !== null) atomicWrite(backupPath, previousBackupContent);
                    else if (!hadBackupFile && fs.existsSync(backupPath)) fs.rmSync(backupPath, { force: true });
                }
            } catch (restoreError) {
                throw new AggregateError([error, restoreError], 'Sheet reset and backup restoration failed.');
            }
            throw error;
        }
    }
    sheetReadCache.delete(filePath);
    return { ...readWorldSheetFile(worldPath, sheetId), reset: true };
}
