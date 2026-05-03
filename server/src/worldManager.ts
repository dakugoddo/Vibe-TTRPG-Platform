/**
 * worldManager.ts
 * 
 * Manages world folder lifecycle: create, open, validate.
 * Ensures the correct directory structure exists.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { WorldMeta } from './shared/types.js';

const WORLD_STRUCTURE = {
    general: ['characters', 'objects', 'abilities', 'tags/hidden', 'tags/statuses', 'tags/properties', 'notes', 'canvases'],
    users: [],
    gm: [],
    assets: [],
} as const;

let currentWorldPath: string | null = null;
let currentWorldName: string | null = null;

export function getCurrentWorldPath(): string | null {
    return currentWorldPath;
}

export function getCurrentWorldName(): string | null {
    return currentWorldName;
}

/**
 * Create a brand-new world with the full folder structure.
 */
export function createWorld(worldPath: string, worldName: string): WorldMeta {
    if (fs.existsSync(worldPath) && fs.readdirSync(worldPath).length > 0) {
        throw new Error(`Directory is not empty: ${worldPath}`);
    }

    // Create root folder
    fs.mkdirSync(worldPath, { recursive: true });

    // Create all subfolders
    for (const [topDir, subDirs] of Object.entries(WORLD_STRUCTURE)) {
        const topPath = path.join(worldPath, topDir);
        fs.mkdirSync(topPath, { recursive: true });
        for (const sub of subDirs) {
            fs.mkdirSync(path.join(topPath, sub), { recursive: true });
        }
    }

    // Create world.yaml
    const meta: WorldMeta = {
        name: worldName,
        path: worldPath,
        createdAt: new Date().toISOString(),
        version: '1.0.0',
    };

    const yamlContent = [
        `name: "${worldName}"`,
        `version: "1.0.0"`,
        `createdAt: "${meta.createdAt}"`,
    ].join('\n');

    fs.writeFileSync(path.join(worldPath, 'world.yaml'), yamlContent, 'utf-8');

    currentWorldPath = worldPath;
    currentWorldName = worldName;
    return meta;
}

/**
 * Open an existing world folder. Validates structure and ensures subfolders exist.
 */
export function openWorld(worldPath: string): WorldMeta {
    if (!fs.existsSync(worldPath)) {
        throw new Error(`World directory does not exist: ${worldPath}`);
    }

    if (!fs.statSync(worldPath).isDirectory()) {
        throw new Error(`Path is not a directory: ${worldPath}`);
    }

    // Ensure all required subfolders exist (create missing ones)
    ensureSubfolders(worldPath);

    // Read world.yaml if it exists
    const yamlPath = path.join(worldPath, 'world.yaml');
    let name = path.basename(worldPath);

    if (fs.existsSync(yamlPath)) {
        const content = fs.readFileSync(yamlPath, 'utf-8');
        const nameMatch = content.match(/name:\s*"?([^"\n]+)"?/);
        if (nameMatch) name = nameMatch[1].trim();
    } else {
        // Create a default world.yaml
        const yamlContent = [
            `name: "${name}"`,
            `version: "1.0.0"`,
            `createdAt: "${new Date().toISOString()}"`,
        ].join('\n');
        fs.writeFileSync(yamlPath, yamlContent, 'utf-8');
    }

    currentWorldPath = worldPath;
    currentWorldName = name;

    return {
        name,
        path: worldPath,
        createdAt: new Date().toISOString(),
        version: '1.0.0',
    };
}

/**
 * Ensure all subfolders exist, creating missing ones.
 */
function ensureSubfolders(worldPath: string): void {
    for (const [topDir, subDirs] of Object.entries(WORLD_STRUCTURE)) {
        const topPath = path.join(worldPath, topDir);
        if (!fs.existsSync(topPath)) {
            fs.mkdirSync(topPath, { recursive: true });
        }
        for (const sub of subDirs) {
            const subPath = path.join(topPath, sub);
            if (!fs.existsSync(subPath)) {
                fs.mkdirSync(subPath, { recursive: true });
            }
        }
    }
}

/**
 * Get the absolute path to a database folder (general, users/playerName, gm).
 */
export function getDbPath(db: string, playerName?: string): string {
    if (!currentWorldPath) throw new Error('No world is currently open');

    if (db === 'general') return path.join(currentWorldPath, 'general');
    if (db === 'gm') return path.join(currentWorldPath, 'gm');
    if (db === 'user' && playerName) {
        const userPath = path.join(currentWorldPath, 'users', playerName);
        if (!fs.existsSync(userPath)) fs.mkdirSync(userPath, { recursive: true });
        return userPath;
    }
    if (db === 'users') return path.join(currentWorldPath, 'users');

    throw new Error(`Unknown database: ${db}`);
}

/**
 * Get the assets folder path.
 */
export function getAssetsPath(): string {
    if (!currentWorldPath) throw new Error('No world is currently open');
    return path.join(currentWorldPath, 'assets');
}

// ─── .index.json for fast startup (Шаг 4.1) ───

interface IndexEntry {
    mtime: number;
    type: string;
}

interface WorldIndex {
    entities: Record<string, IndexEntry>;
    updatedAt: string;
}

function getIndexPath(): string {
    if (!currentWorldPath) throw new Error('No world is currently open');
    return path.join(currentWorldPath, '.index.json');
}

/**
 * Load the world index. Returns null if it doesn't exist yet (first launch).
 */
export function loadWorldIndex(): WorldIndex | null {
    try {
        const indexPath = getIndexPath();
        if (!fs.existsSync(indexPath)) return null;
        const data = fs.readFileSync(indexPath, 'utf-8');
        return JSON.parse(data) as WorldIndex;
    } catch {
        return null;
    }
}

/**
 * Save the world index with current entity metadata.
 */
export function saveWorldIndex(entities: Array<{ id: string; name: string; type: string }>, dbRoot: string): void {
    try {
        const indexPath = getIndexPath();
        const index: WorldIndex = {
            entities: {},
            updatedAt: new Date().toISOString(),
        };

        for (const e of entities) {
            // Find the actual file to get mtime
            const filePath = findFileRecursive(dbRoot, `${e.name}.md`);
            if (filePath) {
                const stat = fs.statSync(filePath);
                index.entities[e.id] = {
                    mtime: stat.mtimeMs,
                    type: e.type,
                };
            }
        }

        fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    } catch (err) {
        console.warn('⚠️ Failed to save .index.json:', (err as Error).message);
    }
}

/**
 * Compare .index.json with real file mtimes to find changed files.
 * Returns list of filenames that need re-parsing (changed or new).
 */
export function getChangedFiles(dbRoot: string): { changed: string[]; deleted: string[]; isFullScan: boolean } {
    const index = loadWorldIndex();

    // First launch — no index, need full scan
    if (!index) {
        return { changed: [], deleted: [], isFullScan: true };
    }

    const changed: string[] = [];
    const deleted: string[] = [];
    const foundFiles = new Set<string>();
    const indexedEntities = index.entities;

    // Walk the file system and compare with index
    function walkDir(dir: string): void {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isFile() && entry.name.endsWith('.md')) {
                const entityName = entry.name.replace(/\.md$/i, '');
                foundFiles.add(entityName);
                const stat = fs.statSync(fullPath);
                const indexed = indexedEntities[entityName];
                if (!indexed || indexed.mtime !== stat.mtimeMs) {
                    changed.push(fullPath);
                }
            } else if (entry.isDirectory()) {
                walkDir(fullPath);
            }
        }
    }

    walkDir(dbRoot);

    // Check for deleted entities (in index but not on disk)
    for (const id of Object.keys(indexedEntities)) {
        if (!foundFiles.has(id)) {
            deleted.push(id);
        }
    }

    return { changed, deleted, isFullScan: false };
}

/**
 * Recursively find a file by name in a directory.
 */
function findFileRecursive(dir: string, filename: string): string | null {
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isFile() && entry.name === filename) {
            return path.join(dir, entry.name);
        }
    }
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const found = findFileRecursive(path.join(dir, entry.name), filename);
            if (found) return found;
        }
    }
    return null;
}
