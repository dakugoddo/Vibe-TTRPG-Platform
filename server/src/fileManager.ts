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
import type { Entity, EntityType, DatabaseType } from './shared/types.js';

// ─── Re-export parser/serializer logic inline (adapted from app/src/utils) ───

const VALID_ENTITY_TYPES: EntityType[] = [
    'character', 'object', 'ability', 'tag', 'canvas', 'note', 'portal', 'folder'
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
        return folderName; // In General DB, name = ID
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
                if (val.startsWith('{')) {
                    result.push(parseInlineObject(val));
                } else if (val.startsWith('[')) {
                    result.push(parseInlineArray(val));
                } else {
                    result.push(parseScalar(val));
                }
                i++;
            } else {
                break;
            }
        }
        return result;
    }

    return parseBlock(0);
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
    const num = Number(value);
    if (!isNaN(num) && value !== '') return num;
    return value;
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

    // ID: in General DB, name is the ID. In User/GM, use uid.
    const id = db === 'general' ? name : ((parsed.uid as string) || fallbackId);

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
        return '\n' + value.map(v => '  '.repeat(indent) + '- ' + toYamlValue(v, indent + 1)).join('\n');
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

export function serializeEntity(entity: Entity, options: { includeUid?: boolean; source?: string } = {}): string {
    const fm: Record<string, any> = {};
    fm.type = entity.type;

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

    // Validation: detect duplicate names in General DB
    if (db === 'general') {
        const nameCount = new Map<string, number>();
        for (const e of entities) {
            const lower = e.name.toLowerCase();
            nameCount.set(lower, (nameCount.get(lower) || 0) + 1);
        }
        const seen = new Map<string, number>();
        for (const e of entities) {
            const lower = e.name.toLowerCase();
            if ((nameCount.get(lower) || 0) > 1) {
                const count = (seen.get(lower) || 0) + 1;
                seen.set(lower, count);
                if (count > 1) {
                    const oldName = e.name;
                    e.name = `${e.name} (${count})`;
                    e.id = e.name;
                    warnings.push(`⚠️ Duplicate name renamed: "${oldName}" → "${e.name}"`);
                }
            }
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

/**
 * Read a single entity by name/id.
 */
export function readEntity(db: DatabaseType, entityId: string, playerName?: string): Entity | null {
    const dbRoot = getDbPath(db, playerName);
    const filePath = findEntityFile(dbRoot, entityId);
    if (!filePath) return null;

    const content = fs.readFileSync(filePath, 'utf-8');
    return parseEntityFile(content, entityId, dbRoot, filePath, db);
}

/**
 * Write (create or update) an entity to disk.
 */
export function writeEntity(db: DatabaseType, entity: Entity, playerName?: string): void {
    const dbRoot = getDbPath(db, playerName);
    const isUserDb = db === 'user' || db === 'gm';

    // Determine target directory
    let targetDir: string;
    if (entity.parentId) {
        // Matryoshka: entity goes inside parent's folder
        const parentFile = findEntityFile(dbRoot, entity.parentId);
        if (parentFile) {
            const parentFolder = path.join(path.dirname(parentFile), sanitizeFilename(entity.parentId));
            ensureChildFolder(parentFolder);
            targetDir = parentFolder;
        } else {
            // Parent not found, fall back to type folder
            targetDir = path.join(dbRoot, entityTypeToFolder(entity.type));
        }
    } else if (isUserDb) {
        // User/GM DB: flat structure
        targetDir = dbRoot;
    } else {
        // General DB: entities go to type folders
        targetDir = path.join(dbRoot, entityTypeToFolder(entity.type));
    }

    fs.mkdirSync(targetDir, { recursive: true });

    const filename = entityToFilename(entity.name);
    const filePath = path.join(targetDir, filename);

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
    const childFolder = path.join(path.dirname(filePath), sanitizeFilename(entityId));
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

    // Ensure it has a valid type (default to 'note')
    if (!entity.type) entity.type = 'note';
    if (!entity.tags) entity.tags = [];

    // Write to disk (will add proper frontmatter)
    writeEntity(db, entity);

    return entity;
}
