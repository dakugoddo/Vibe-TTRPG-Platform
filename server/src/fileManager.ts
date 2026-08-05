/**
 * fileManager.ts
 *
 * CRUD operations for .md entity files.
 * Handles the Matryoshka (nested folders) pattern.
 * Integrates entityParser/entitySerializer for round-trip .md ↔ Entity.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getDbPath } from './worldManager.js';
import { normalizeEntitySchemaVersion } from './entitySchema.js';
import { generateEntityId } from './entityId.js';
import type { Entity, EntityType, DatabaseType } from './shared/types.js';

// ─── Re-export parser/serializer logic inline (adapted from app/src/utils) ───

const VALID_ENTITY_TYPES: EntityType[] = [
    'character', 'object', 'ability', 'competency', 'tag', 'canvas', 'note', 'portal', 'folder', 'attack'
];

// ─── Track our own writes to prevent sync loops (Problem #3) ───

const recentWrites = new Set<string>();

export function markAsOurWrite(filePath: string): void {
    const normalized = path.resolve(filePath);
    recentWrites.add(normalized);
    setTimeout(() => recentWrites.delete(normalized), 1500);
}

export function isOurWrite(filePath: string): boolean {
    return recentWrites.has(path.resolve(filePath));
}

// ─── Filename Utilities (Problem #5: path length) ───

const MAX_FILENAME_LENGTH = 50;

export function sanitizeFilename(name: string): string {
    let sanitized = name
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();

    if (!sanitized) sanitized = 'Untitled';

    // Truncate long names (Problem #5: Windows path limit)
    if (sanitized.length > MAX_FILENAME_LENGTH) {
        sanitized = sanitized.substring(0, MAX_FILENAME_LENGTH).trim();
    }

    return sanitized;
}

export function entityToFilename(name: string): string {
    return `${sanitizeFilename(name)}.md`;
}

function getAvailableEntityFilePath(targetDir: string, name: string): string {
    const baseName = sanitizeFilename(name);
    let filePath = path.join(targetDir, `${baseName}.md`);
    let counter = 2;

    while (fs.existsSync(filePath)) {
        filePath = path.join(targetDir, `${baseName} (${counter}).md`);
        counter += 1;
    }

    return filePath;
}

export function filenameToEntityName(filename: string): string {
    return filename.replace(/\.md$/i, '');
}

function entityTypeToFolder(type: EntityType): string {
    switch (type) {
        case 'character': return 'characters';
        case 'object': return 'objects';
        case 'ability': return 'abilities';
        case 'tag': return 'tags';
        case 'note': return 'notes';
        case 'canvas': return 'canvases';
        case 'portal': return 'portals';
        case 'competency': return 'competencies';
        case 'folder': return 'folders';
        default: return 'misc';
    }
}

// ─── Matryoshka: parentId from file path ───

/**
 * Determine parentId from file path.
 * If file is in a folder that has a sibling .md file with the same name,
 * then that .md entity is the parent.
 *
 * Example: /general/characters/Торин/Экскалибур.md →
 *   Check: /general/characters/Торин.md exists? → parentId = "Торин"
 */
export function resolveParentId(filePath: string, dbRoot: string): string | null {
    const parentDir = path.dirname(filePath);
    const folderName = path.basename(parentDir);

    // If we're directly in a type folder (characters/, objects/, etc.), no parent
    const dbRootNorm = path.resolve(dbRoot);
    const parentDirNorm = path.resolve(parentDir);

    // Check if the parentDir is one of the top-level type folders
    const relToDb = path.relative(dbRootNorm, parentDirNorm);
    const topLevelFolders = ['characters', 'objects', 'abilities', 'tags', 'notes', 'canvases',
        'portals', 'folders', 'tags/hidden', 'tags/statuses', 'tags/properties'];

    if (topLevelFolders.includes(relToDb) || relToDb === '' || relToDb === '.') {
        return null;
    }

    // Check if a sibling .md file exists with the same name as the folder
    const siblingMd = path.join(path.dirname(parentDir), `${folderName}.md`);
    if (fs.existsSync(siblingMd)) {
        try {
            const content = fs.readFileSync(siblingMd, 'utf-8');
            return readEntityIdentity(content, folderName).id;
        } catch {
            return folderName;
        }
    }

    return null;
}

/**
 * Ensure a child folder exists for an entity (Matryoshka pattern).
 * Called when adding a child entity to a parent.
 */
export function ensureChildFolder(parentPath: string): void {
    if (!fs.existsSync(parentPath)) {
        fs.mkdirSync(parentPath, { recursive: true });
    }
}

/**
 * Clean up empty child folders.
 */
export function cleanupEmptyFolder(folderPath: string): void {
    if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
        const contents = fs.readdirSync(folderPath);
        if (contents.length === 0) {
            fs.rmdirSync(folderPath);
        }
    }
}

// ─── Inline YAML parsing (from entityParser.ts) ───
// We inline this to avoid cross-project imports.
// Full implementation copied from app/src/utils/entityParser.ts

function splitFrontmatter(content: string): { frontmatter: string | null; body: string } {
    const trimmed = content.trim();
    if (!trimmed.startsWith('---')) return { frontmatter: null, body: trimmed };
    const endIdx = trimmed.indexOf('---', 3);
    if (endIdx === -1) return { frontmatter: null, body: trimmed };
    return {
        frontmatter: trimmed.substring(3, endIdx).trim(),
        body: trimmed.substring(endIdx + 3).trim(),
    };
}

function parseSimpleYaml(yamlStr: string): Record<string, any> {
    const lines = yamlStr.split('\n');
    let i = 0;

    /**
     * Recursively parse YAML block at a given indent level.
     * Supports arbitrary nesting depth + inline objects/arrays at any level.
     */
    function parseBlock(minIndent: number): Record<string, any> {
        const result: Record<string, any> = {};

        while (i < lines.length) {
            const line = lines[i];
            if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }

            const indent = line.search(/\S/);
            // If current line is less indented than our block, we're done
            if (indent < minIndent) break;
            // If over-indented, skip (shouldn't happen in well-formed YAML)
            if (indent > minIndent && minIndent >= 0) break;

            const colonIdx = line.indexOf(':');
            if (colonIdx === -1) { i++; continue; }

            const key = line.substring(0, colonIdx).trim();
            const rawValue = line.substring(colonIdx + 1).trim();

            if (rawValue === '' || rawValue === undefined) {
                // Could be a nested block OR a list
                i++;
                // Peek at next non-empty line to determine indent
                let nextIndent = -1;
                let isListNext = false;
                for (let j = i; j < lines.length; j++) {
                    if (lines[j].trim()) {
                        nextIndent = lines[j].search(/\S/);
                        isListNext = lines[j].trim().startsWith('- ');
                        break;
                    }
                }
                if (nextIndent > indent) {
                    if (isListNext) {
                        result[key] = parseList(nextIndent);
                    } else {
                        result[key] = parseBlock(nextIndent);
                    }
                } else {
                    result[key] = null;
                }
            } else if (rawValue.startsWith('[')) {
                result[key] = parseInlineArray(rawValue);
                i++;
            } else if (rawValue.startsWith('{')) {
                result[key] = parseInlineObject(rawValue);
                i++;
            } else {
                result[key] = parseScalar(rawValue);
                i++;
            }
        }

        return result;
    }

    /**
     * Parse a YAML list (lines starting with '- ')
     */
    function parseList(minIndent: number): any[] {
        const result: any[] = [];
        while (i < lines.length) {
            const line = lines[i];
            if (!line.trim()) { i++; continue; }
            const indent = line.search(/\S/);
            if (indent < minIndent) break;

            const trimmed = line.trim();
            if (trimmed.startsWith('- ')) {
                const val = trimmed.substring(2).trim();
                i++;

                if (val === '') {
                    const nextIndent = findNextContentIndent(i);
                    if (nextIndent > indent) {
                        result.push(nextLineStartsList(i) ? parseList(nextIndent) : parseBlock(nextIndent));
                    } else {
                        result.push(null);
                    }
                } else if (val.startsWith('{')) {
                    result.push(parseInlineObject(val));
                } else if (val.startsWith('[')) {
                    result.push(parseInlineArray(val));
                } else if (val.includes(':') && !val.startsWith('"') && !val.startsWith("'")) {
                    const obj: Record<string, any> = {};
                    const colonIdx = val.indexOf(':');
                    const firstKey = val.substring(0, colonIdx).trim();
                    const firstRaw = val.substring(colonIdx + 1).trim();
                    obj[firstKey] = parseInlineOrScalar(firstRaw);

                    while (i < lines.length) {
                        const nextLine = lines[i];
                        if (!nextLine.trim()) { i++; continue; }
                        const nextIndent = nextLine.search(/\S/);
                        if (nextIndent <= indent) break;

                        const nextTrimmed = nextLine.trim();
                        const nextColonIdx = nextTrimmed.indexOf(':');
                        if (nextColonIdx === -1) break;

                        const key = nextTrimmed.substring(0, nextColonIdx).trim();
                        const rawValue = nextTrimmed.substring(nextColonIdx + 1).trim();
                        i++;

                        if (rawValue === '') {
                            const childIndent = findNextContentIndent(i);
                            obj[key] = childIndent > nextIndent
                                ? (nextLineStartsList(i) ? parseList(childIndent) : parseBlock(childIndent))
                                : null;
                        } else {
                            obj[key] = parseInlineOrScalar(rawValue);
                        }
                    }
                    result.push(obj);
                } else {
                    result.push(parseScalar(val));
                }
            } else {
                break;
            }
        }
        return result;
    }

    function findNextContentIndent(start: number): number {
        for (let j = start; j < lines.length; j++) {
            if (lines[j].trim()) return lines[j].search(/\S/);
        }
        return -1;
    }

    function nextLineStartsList(start: number): boolean {
        for (let j = start; j < lines.length; j++) {
            if (lines[j].trim()) return lines[j].trim().startsWith('- ');
        }
        return false;
    }

    return parseBlock(0);
}

function parseInlineOrScalar(raw: string): any {
    if (raw.startsWith('{')) return parseInlineObject(raw);
    if (raw.startsWith('[')) return parseInlineArray(raw);
    return parseScalar(raw);
}

/**
 * Parse an inline YAML array like `[foo, bar, 123]`
 */
function parseInlineArray(raw: string): any[] {
    const inner = raw.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map(s => parseScalar(s.trim()));
}

/**
 * Parse an inline YAML object like `{ key: value, key2: 42 }`
 */
function parseInlineObject(raw: string): Record<string, any> {
    const inner = raw.slice(1, -1).trim();
    const obj: Record<string, any> = {};
    if (!inner) return obj;
    for (const pair of inner.split(',')) {
        const ci = pair.indexOf(':');
        if (ci !== -1) {
            const k = pair.substring(0, ci).trim();
            const v = pair.substring(ci + 1).trim();
            if (v.startsWith('{')) {
                obj[k] = parseInlineObject(v);
            } else if (v.startsWith('[')) {
                obj[k] = parseInlineArray(v);
            } else {
                obj[k] = parseScalar(v);
            }
        }
    }
    return obj;
}

function parseScalar(value: string): any {
    if (!value) return null;
    // Quoted string
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null' || value === '~') return null;
    if (/^\d{16,}$/.test(value)) return value;
    const num = Number(value);
    if (!isNaN(num) && value !== '') return num;
    return value;
}

function readEntityIdentity(content: string, fallbackId: string): { id: string; name: string } {
    const { frontmatter, body } = splitFrontmatter(content);
    const parsed = frontmatter ? parseSimpleYaml(frontmatter) : {};
    const titleMatch = body.match(/^#\s+(.+)$/m);
    const name = titleMatch ? titleMatch[1].trim() : fallbackId;
    const rawId = parsed.id ?? parsed.uid;
    const id = rawId !== undefined && rawId !== null && String(rawId).trim()
        ? String(rawId)
        : fallbackId;
    return { id, name };
}

interface RawFrontmatter {
    frontmatter: string;
    body: string;
    lineEnding: string;
}

function splitRawFrontmatter(content: string): RawFrontmatter | null {
    const normalized = content.replace(/^\uFEFF/, '');
    const lineEnding = normalized.includes('\r\n') ? '\r\n' : '\n';
    const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/);
    if (!match) return null;

    return {
        frontmatter: match[1],
        body: normalized.slice(match[0].length),
        lineEnding,
    };
}

function normalizeFrontmatterId(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const id = String(value).trim();
    return id ? id : null;
}

function quoteYamlString(value: string): string {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function injectEntityIdIntoMarkdown(content: string, id: string, entity?: Pick<Entity, 'type' | 'schemaVersion'>): string {
    const raw = splitRawFrontmatter(content);
    const quotedId = quoteYamlString(id);

    if (!raw) {
        const type = entity?.type && VALID_ENTITY_TYPES.includes(entity.type) ? entity.type : 'note';
        const schemaVersion = normalizeEntitySchemaVersion(entity?.schemaVersion);
        const frontmatter = [
            '---',
            `type: ${type}`,
            `schemaVersion: ${schemaVersion}`,
            `id: ${quotedId}`,
            '---',
            '',
        ].join('\n');
        return `${frontmatter}${content.trimStart()}`;
    }

    const lines = raw.frontmatter.split(/\r?\n/);
    const existingIdIndex = lines.findIndex(line => /^\s*id\s*:/.test(line));

    if (existingIdIndex >= 0) {
        lines[existingIdIndex] = `id: ${quotedId}`;
    } else {
        const schemaIndex = lines.findIndex(line => /^\s*schemaVersion\s*:/.test(line));
        const typeIndex = lines.findIndex(line => /^\s*type\s*:/.test(line));
        const insertAfter = schemaIndex >= 0 ? schemaIndex : typeIndex;
        lines.splice(insertAfter >= 0 ? insertAfter + 1 : 0, 0, `id: ${quotedId}`);
    }

    return ['---', lines.join(raw.lineEnding), '---', raw.body].join(raw.lineEnding);
}

// ─── Parse .md → Entity ───

export function parseEntityFile(content: string, fallbackId: string, dbRoot: string, filePath: string, db: DatabaseType): Entity {
    const { frontmatter, body } = splitFrontmatter(content);
    const parsed = frontmatter ? parseSimpleYaml(frontmatter) : {};

    // Extract title from body
    const titleMatch = body.match(/^#\s+(.+)$/m);
    const name = titleMatch ? titleMatch[1].trim() : fallbackId;
    const description = titleMatch ? body.replace(/^#\s+.+\n?/, '').trim() : body.trim();

    // Type
    const type = (VALID_ENTITY_TYPES.includes(parsed.type as EntityType) ? parsed.type : 'note') as EntityType;

    const rawId = parsed.id ?? parsed.uid;
    const id = rawId !== undefined && rawId !== null && String(rawId).trim()
        ? String(rawId)
        : fallbackId;

    // Tags
    const tags = Array.isArray(parsed.tags) ? parsed.tags.map(String) : [];

    // Image
    const imageId = parsed.image as string | undefined;

    // Build properties
    const properties: Record<string, any> = {};

    if (type === 'character' && parsed.stats && typeof parsed.stats === 'object') {
        for (const [key, value] of Object.entries(parsed.stats as Record<string, any>)) {
            properties[key] = { base: value };
        }
    }
    if (type === 'character' && parsed.resources && typeof parsed.resources === 'object') {
        Object.assign(properties, parsed.resources);
    }
    if (parsed.properties && typeof parsed.properties === 'object') {
        Object.assign(properties, parsed.properties);
    }

    // Type-specific fields
    const typeFieldMap: Record<string, string[]> = {
        tag: ['category', 'modifiers', 'duration', 'icon'],
        ability: ['cost', 'range', 'area', 'dice', 'save'],
        canvas: ['grid', 'tokens', 'portals'],
    };
    if (typeFieldMap[type]) {
        for (const field of typeFieldMap[type]) {
            if (parsed[field] !== undefined) properties[field] = parsed[field];
        }
    }

    // parentId from path (Matryoshka)
    const parentId = resolveParentId(filePath, dbRoot);

    return {
        id,
        parentId,
        schemaVersion: normalizeEntitySchemaVersion(parsed.schemaVersion),
        type,
        name,
        description,
        tags,
        properties,
        database: db,
        ...(imageId ? { imageId } : {}),
    };
}

// ─── Serialize Entity → .md ───

function toYamlValue(value: any, indent = 0): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
        if (value.includes(':') || value.includes('#') || value.includes('"') ||
            value.includes("'") || value.includes('\n') || value.trim() !== value ||
            value === '' || value === 'true' || value === 'false' || !isNaN(Number(value))) {
            return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
        }
        return value;
    }
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        if (value.every(v => typeof v !== 'object')) {
            const items = value.map(v => toYamlValue(v)).join(', ');
            if (items.length < 80) return `[${items}]`;
        }
        return '\n' + value.map(v => {
            const serialized = toYamlValue(v, indent + 1);
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                const lines = deindentSerializedBlock(serialized);
                return '  '.repeat(indent) + '- ' + lines[0] +
                    (lines.length > 1
                        ? '\n' + lines.slice(1).map(line => '  '.repeat(indent) + '  ' + line).join('\n')
                        : '');
            }
            return '  '.repeat(indent) + '- ' + serialized;
        }).join('\n');
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value);
        if (entries.length === 0) return '{}';
        if (entries.every(([, v]) => typeof v !== 'object' || v === null)) {
            const inline = entries.map(([k, v]) => `${k}: ${toYamlValue(v)}`).join(', ');
            if (inline.length < 60) return `{ ${inline} }`;
        }
        return '\n' + entries.map(([k, v]) => {
            const ser = toYamlValue(v, indent + 1);
            return '  '.repeat(indent) + (ser.startsWith('\n') ? `${k}:${ser}` : `${k}: ${ser}`);
        }).join('\n');
    }
    return String(value);
}

function leadingSpaces(str: string): number {
    return str.match(/^\s*/)?.[0].length ?? 0;
}

function deindentSerializedBlock(serialized: string): string[] {
    const raw = serialized.startsWith('\n') ? serialized.slice(1) : serialized;
    const lines = raw.split('\n');
    const contentLines = lines.filter(line => line.trim().length > 0);
    const baseIndent = contentLines.length > 0
        ? Math.min(...contentLines.map(leadingSpaces))
        : 0;
    return lines.map(line => line.slice(Math.min(leadingSpaces(line), baseIndent)));
}

export function serializeEntity(entity: Entity, options: { includeUid?: boolean; source?: string } = {}): string {
    const fm: Record<string, any> = {};
    fm.type = entity.type;
    fm.schemaVersion = normalizeEntitySchemaVersion(entity.schemaVersion);
    fm.id = entity.id;

    if (options.includeUid) fm.uid = entity.id;
    if (options.source) fm.source = options.source;
    if (entity.imageId) fm.image = entity.imageId;
    if (entity.tags?.length > 0) fm.tags = entity.tags;

    // Type-specific property extraction
    const props = { ...entity.properties };
    // Strip UI-only session state — these don't belong in .md files
    delete props.x; delete props.y; delete props.targetCanvasId;
    delete props.windowState;

    if (entity.type === 'character') {
        const stats: Record<string, any> = {};
        const resources: Record<string, any> = {};
        const otherProps: Record<string, any> = {};
        for (const [k, v] of Object.entries(props)) {
            if (v && typeof v === 'object' && 'base' in v) {
                if ('current' in v || 'max' in v) resources[k] = v;
                else stats[k] = v.base;
            } else {
                otherProps[k] = v;
            }
        }
        if (Object.keys(stats).length > 0) fm.stats = stats;
        if (Object.keys(resources).length > 0) fm.resources = resources;
        if (Object.keys(otherProps).length > 0) fm.properties = otherProps;
    } else {
        const typeFieldMap: Record<string, string[]> = {
            tag: ['category', 'modifiers', 'duration', 'icon'],
            ability: ['cost', 'range', 'area', 'dice', 'save'],
            canvas: ['grid', 'tokens', 'portals'],
        };
        if (typeFieldMap[entity.type]) {
            for (const field of typeFieldMap[entity.type]) {
                if (props[field] !== undefined) {
                    fm[field] = props[field];
                    delete props[field];
                }
            }
        }
        if (Object.keys(props).length > 0) fm.properties = props;
    }

    // Build YAML
    const yamlLines: string[] = [];
    for (const [key, value] of Object.entries(fm)) {
        const serialized = toYamlValue(value, 1);
        yamlLines.push(serialized.startsWith('\n') ? `${key}:${serialized}` : `${key}: ${serialized}`);
    }

    const parts = ['---', yamlLines.join('\n'), '---', '', `# ${entity.name}`, ''];
    if (entity.description?.trim()) {
        parts.push(entity.description.trim(), '');
    }
    return parts.join('\n');
}

// ─── CRUD Operations ───

/**
 * Find the file path for an entity by name/id within a database.
 */
function findEntityFile(dbRoot: string, entityName: string): string | null {
    const filename = entityToFilename(entityName);

    function searchDir(dir: string): string | null {
        if (!fs.existsSync(dir)) return null;
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isFile() && entry.name === filename) {
                return path.join(dir, entry.name);
            }
        }
        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

            const fullPath = path.join(dir, entry.name);
            try {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const fallbackId = filenameToEntityName(entry.name);
                const identity = readEntityIdentity(content, fallbackId);
                if (identity.id === entityName || identity.name === entityName) {
                    return fullPath;
                }
            } catch {
                // Ignore corrupt files for lookup.
            }
        }
        // Search subdirectories
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const found = searchDir(path.join(dir, entry.name));
                if (found) return found;
            }
        }
        return null;
    }

    return searchDir(dbRoot);
}

export function getEntityFilePath(db: DatabaseType, entityId: string, playerName?: string): string | null {
    const dbRoot = getDbPath(db, playerName);
    const directPath = findEntityFile(dbRoot, entityId);
    if (directPath) return directPath;

    let found: string | null = null;

    function walkDir(dir: string): void {
        if (found || !fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            if (found) return;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walkDir(fullPath);
                continue;
            }
            if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

            try {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const fallbackId = filenameToEntityName(entry.name);
                const entity = parseEntityFile(content, fallbackId, dbRoot, fullPath, db);
                if (entity.id === entityId || entity.name === entityId) {
                    found = fullPath;
                    return;
                }
            } catch {
                // Ignore corrupt files for this lookup; listEntities reports validation warnings separately.
            }
        }
    }

    walkDir(dbRoot);
    return found;
}

/**
 * List all entities in a database by walking the folder tree.
 * Includes validation (Шаг 4.2): corrupt files, duplicates, missing fields, cyclic parents.
 */
export function listEntities(db: DatabaseType, playerName?: string): Entity[] {
    const dbRoot = getDbPath(db, playerName);
    const entities: Entity[] = [];
    const warnings: string[] = [];

    function walkDir(dir: string): void {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isFile() && entry.name.endsWith('.md')) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    const fallbackId = filenameToEntityName(entry.name);
                    const entity = parseEntityFile(content, fallbackId, dbRoot, fullPath, db);

                    // Validation: ensure required fields
                    if (!entity.type) entity.type = 'note';
                    if (!entity.name) entity.name = fallbackId;
                    if (!entity.tags) entity.tags = [];
                    if (!entity.properties) entity.properties = {};

                    entities.push(entity);
                } catch (err) {
                    // Validation: corrupt .md → warn, don't crash
                    warnings.push(`⚠️ Corrupt file (skipped): ${fullPath} — ${(err as Error).message}`);
                }
            } else if (entry.isDirectory()) {
                walkDir(fullPath);
            }
        }
    }

    walkDir(dbRoot);

    // Validation: detect duplicate names in General DB.
    // Names are display labels now; duplicates are allowed when stable frontmatter IDs differ.
    if (db === 'general') {
        const nameCount = new Map<string, number>();
        for (const e of entities) {
            const lower = e.name.toLowerCase();
            nameCount.set(lower, (nameCount.get(lower) || 0) + 1);
        }
        for (const [name, count] of nameCount) {
            if (count > 1) warnings.push(`⚠️ Duplicate display name allowed: "${name}" (${count})`);
        }
    }

    // Validation: detect cyclic parentId (A→B→A)
    const entityById = new Map(entities.map(e => [e.id, e]));
    for (const e of entities) {
        const visited = new Set<string>();
        let current: string | null = e.parentId;
        while (current) {
            if (visited.has(current)) {
                // Cycle detected — break it
                e.parentId = null;
                warnings.push(`⚠️ Cyclic parentId detected for "${e.name}", reset to root`);
                break;
            }
            visited.add(current);
            current = entityById.get(current)?.parentId || null;
        }
    }

    if (warnings.length > 0) {
        console.warn(`\n📋 Validation warnings (${warnings.length}):`);
        for (const w of warnings) console.warn(`  ${w}`);
    }

    return entities;
}

export interface EntityIdMigrationFile {
    path: string;
    relativePath: string;
    id: string;
    name: string;
    database: DatabaseType;
    player?: string;
    source: 'uid' | 'generated' | 'empty-id-replaced';
}

export interface EntityIdMigrationResult {
    database: DatabaseType;
    player?: string;
    dryRun: boolean;
    scanned: number;
    changed: number;
    skipped: number;
    failed: number;
    files: EntityIdMigrationFile[];
    warnings: string[];
}

function collectMarkdownFiles(root: string): string[] {
    const files: string[] = [];

    function walkDir(dir: string): void {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true })
            .sort((a, b) => a.name.localeCompare(b.name));

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walkDir(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                files.push(fullPath);
            }
        }
    }

    walkDir(root);
    return files;
}

/**
 * Adds stable frontmatter id values to legacy .md entities.
 * Dry-run is the default at API level; this function supports both preview and apply.
 */
export function migrateEntityIds(
    db: DatabaseType,
    playerName?: string,
    options: { dryRun?: boolean } = {},
): EntityIdMigrationResult {
    const dryRun = options.dryRun ?? true;
    const dbRoot = getDbPath(db, playerName);
    const filePaths = collectMarkdownFiles(dbRoot);
    const occupiedIds = new Set<string>();
    const parsedCache = new Map<string, { content: string; parsed: Record<string, any>; raw: RawFrontmatter | null }>();

    for (const filePath of filePaths) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const raw = splitRawFrontmatter(content);
            const parsed = raw ? parseSimpleYaml(raw.frontmatter) : {};
            parsedCache.set(filePath, { content, parsed, raw });

            const existingId = normalizeFrontmatterId(parsed.id ?? parsed.uid);
            if (existingId) occupiedIds.add(existingId);
        } catch {
            // Reported in the migration pass below.
        }
    }

    const result: EntityIdMigrationResult = {
        database: db,
        player: playerName,
        dryRun,
        scanned: 0,
        changed: 0,
        skipped: 0,
        failed: 0,
        files: [],
        warnings: [],
    };

    for (const filePath of filePaths) {
        result.scanned += 1;

        try {
            const cached = parsedCache.get(filePath);
            const content = cached?.content ?? fs.readFileSync(filePath, 'utf-8');
            const raw = cached?.raw ?? splitRawFrontmatter(content);
            const parsed = cached?.parsed ?? (raw ? parseSimpleYaml(raw.frontmatter) : {});
            const idValue = normalizeFrontmatterId(parsed.id);

            if (idValue) {
                result.skipped += 1;
                continue;
            }

            const fallbackId = filenameToEntityName(path.basename(filePath));
            const entity = parseEntityFile(content, fallbackId, dbRoot, filePath, db);
            const uidValue = normalizeFrontmatterId(parsed.uid);
            const generatedId = uidValue ?? generateEntityId(occupiedIds);
            occupiedIds.add(generatedId);

            const migratedContent = injectEntityIdIntoMarkdown(content, generatedId, entity);
            const source: EntityIdMigrationFile['source'] = uidValue
                ? 'uid'
                : parsed.id !== undefined
                    ? 'empty-id-replaced'
                    : 'generated';

            result.changed += 1;
            result.files.push({
                path: filePath,
                relativePath: path.relative(dbRoot, filePath),
                id: generatedId,
                name: entity.name,
                database: db,
                player: playerName,
                source,
            });

            if (!dryRun && migratedContent !== content) {
                markAsOurWrite(filePath);
                fs.writeFileSync(filePath, migratedContent, 'utf-8');
            }
        } catch (err) {
            result.failed += 1;
            result.warnings.push(`${filePath}: ${(err as Error).message}`);
        }
    }

    return result;
}

/**
 * Read a single entity by name/id.
 */
export function readEntity(db: DatabaseType, entityId: string, playerName?: string): Entity | null {
    const dbRoot = getDbPath(db, playerName);
    const filePath = findEntityFile(dbRoot, entityId);
    if (!filePath) return null;

    const content = fs.readFileSync(filePath, 'utf-8');
    const fallbackId = filenameToEntityName(path.basename(filePath));
    return parseEntityFile(content, fallbackId, dbRoot, filePath, db);
}

/**
 * Write (create or update) an entity to disk.
 */
export function writeEntity(db: DatabaseType, entity: Entity, playerName?: string): void {
    const dbRoot = getDbPath(db, playerName);
    const isUserDb = db === 'user' || db === 'gm';
    if (!entity.id) {
        entity.id = generateEntityId();
    }
    const existingFile = findEntityFile(dbRoot, entity.id);

    // Determine target directory from the current entity shape.
    // Important: existing files may move when parentId changes. parentId is derived
    // from the Matryoshka file path on read, so keeping the old directory would
    // silently discard a UI move after reload.
    let targetDir: string;
    if (entity.parentId) {
        const parentFile = findEntityFile(dbRoot, entity.parentId);
        if (parentFile) {
            const parentFolderName = sanitizeFilename(filenameToEntityName(path.basename(parentFile)));
            const parentFolder = path.join(path.dirname(parentFile), parentFolderName);
            ensureChildFolder(parentFolder);
            targetDir = parentFolder;
        } else {
            targetDir = path.join(dbRoot, entityTypeToFolder(entity.type));
        }
    } else if (isUserDb) {
        targetDir = dbRoot;
    } else {
        targetDir = path.join(dbRoot, entityTypeToFolder(entity.type));
    }

    fs.mkdirSync(targetDir, { recursive: true });

    const preferredFilePath = existingFile
        ? path.join(targetDir, path.basename(existingFile))
        : getAvailableEntityFilePath(targetDir, entity.name);
    const filePath = existingFile && path.resolve(existingFile) !== path.resolve(preferredFilePath) && fs.existsSync(preferredFilePath)
        ? getAvailableEntityFilePath(targetDir, filenameToEntityName(path.basename(existingFile)))
        : preferredFilePath;

    if (existingFile && path.resolve(existingFile) !== path.resolve(filePath)) {
        const oldChildFolder = path.join(path.dirname(existingFile), sanitizeFilename(filenameToEntityName(path.basename(existingFile))));
        const newChildFolder = path.join(path.dirname(filePath), sanitizeFilename(filenameToEntityName(path.basename(filePath))));
        markAsOurWrite(existingFile);
        markAsOurWrite(filePath);
        fs.renameSync(existingFile, filePath);
        if (fs.existsSync(oldChildFolder) && !fs.existsSync(newChildFolder)) {
            markAsOurWrite(oldChildFolder);
            markAsOurWrite(newChildFolder);
            fs.renameSync(oldChildFolder, newChildFolder);
        }
        cleanupEmptyFolder(path.dirname(existingFile));
    }

    const options = isUserDb ? { includeUid: true } : {};
    const content = serializeEntity(entity, options);

    markAsOurWrite(filePath);
    fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Delete an entity and its child folder (if any).
 */
export function deleteEntity(db: DatabaseType, entityId: string, playerName?: string): boolean {
    const dbRoot = getDbPath(db, playerName);
    const filePath = findEntityFile(dbRoot, entityId);
    if (!filePath) return false;

    // Delete child folder (Matryoshka)
    const childFolder = path.join(path.dirname(filePath), sanitizeFilename(filenameToEntityName(path.basename(filePath))));
    if (fs.existsSync(childFolder) && fs.statSync(childFolder).isDirectory()) {
        fs.rmSync(childFolder, { recursive: true, force: true });
    }

    // Delete the .md file itself
    markAsOurWrite(filePath);
    fs.unlinkSync(filePath);

    // Clean up empty parent folder
    const parentDir = path.dirname(filePath);
    cleanupEmptyFolder(parentDir);

    return true;
}

/**
 * Import a raw markdown string as a new entity.
 * Fills in missing fields (type, tags, etc).
 */
export function importRawMarkdown(content: string, filename: string, db: DatabaseType = 'general'): Entity {
    const dbRoot = getDbPath(db);
    const fallbackName = filenameToEntityName(filename);

    // Parse whatever we get
    const entity = parseEntityFile(content, fallbackName, dbRoot, path.join(dbRoot, 'notes', filename), db);
    if (entity.id === fallbackName) {
        entity.id = generateEntityId();
    }

    // Ensure it has a valid type (default to 'note')
    if (!entity.type) entity.type = 'note';
    if (!entity.tags) entity.tags = [];

    // Write to disk (will add proper frontmatter)
    writeEntity(db, entity);

    return entity;
}
