/**
 * renameManager.ts — Atomic entity renaming (Problem #2)
 *
 * Renaming an entity is the most dangerous file operation because it cascades:
 * 1. The .md file itself needs a new filename
 * 2. The Matryoshka child folder (if any) needs renaming
 * 3. ALL wiki-links [[oldName]] across ALL .md files need updating
 * 4. ALL tags referencing oldName need updating
 * 5. ALL source: oldName in User/GM DB copies need updating
 *
 * Strategy: "Create first, then delete"
 * - We write the new file before deleting the old one
 * - If any step fails, the old file is still on disk (safe rollback)
 */

import fs from 'node:fs';
import path from 'node:path';
import { getDbPath, getCurrentWorldPath } from './worldManager.js';
import {
    sanitizeFilename,
    entityToFilename,
    markAsOurWrite,
    parseEntityFile,
    serializeEntity,
    filenameToEntityName,
} from './fileManager.js';
import type { DatabaseType } from './shared/types.js';

interface RenameResult {
    success: boolean;
    oldName: string;
    newName: string;
    updatedFiles: string[];
    errors: string[];
}

/**
 * Find all .md files recursively in a directory.
 */
function findAllMdFiles(dir: string): string[] {
    const result: string[] = [];
    if (!fs.existsSync(dir)) return result;

    function walk(d: string) {
        const entries = fs.readdirSync(d, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(d, entry.name);
            if (entry.isFile() && entry.name.endsWith('.md')) {
                result.push(fullPath);
            } else if (entry.isDirectory()) {
                walk(fullPath);
            }
        }
    }

    walk(dir);
    return result;
}

/**
 * Find the .md file for an entity by name within a database.
 */
function findEntityFile(dbRoot: string, entityName: string): string | null {
    const filename = entityToFilename(entityName);

    function search(dir: string): string | null {
        if (!fs.existsSync(dir)) return null;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile() && entry.name === filename) {
                return path.join(dir, entry.name);
            }
        }
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const found = search(path.join(dir, entry.name));
                if (found) return found;
            }
        }
        return null;
    }

    return search(dbRoot);
}

/**
 * Atomically rename an entity and cascade all references.
 *
 * Steps:
 * 1. Read old .md file → parse entity
 * 2. Update entity name → serialize → write NEW .md file
 * 3. If old name had a child folder → rename folder to new name
 * 4. Grep ALL .md files in the world → update references
 * 5. Delete old .md file
 * 6. If any step fails → the old file is still there (safe state)
 */
export function renameEntity(
    db: DatabaseType,
    oldName: string,
    newName: string
): RenameResult {
    const result: RenameResult = {
        success: false,
        oldName,
        newName,
        updatedFiles: [],
        errors: [],
    };

    const worldPath = getCurrentWorldPath();
    if (!worldPath) {
        result.errors.push('No world is currently open');
        return result;
    }

    const dbRoot = getDbPath(db);
    const sanitizedNew = sanitizeFilename(newName);

    if (sanitizedNew === oldName) {
        result.success = true; // No change needed
        return result;
    }

    // Step 1: Find and read the old file
    const oldFilePath = findEntityFile(dbRoot, oldName);
    if (!oldFilePath) {
        result.errors.push(`Entity file not found: ${oldName}`);
        return result;
    }

    const oldContent = fs.readFileSync(oldFilePath, 'utf-8');
    const entity = parseEntityFile(oldContent, oldName, dbRoot, oldFilePath, db);

    // Step 2: Create new .md file with new name
    entity.name = sanitizedNew;
    entity.id = sanitizedNew; // In General DB, id = name

    const newFilename = entityToFilename(sanitizedNew);
    const newFilePath = path.join(path.dirname(oldFilePath), newFilename);

    // Check for collision
    if (fs.existsSync(newFilePath)) {
        result.errors.push(`Entity "${sanitizedNew}" already exists`);
        return result;
    }

    try {
        const newContent = serializeEntity(entity);
        markAsOurWrite(newFilePath);
        fs.writeFileSync(newFilePath, newContent, 'utf-8');
        result.updatedFiles.push(newFilePath);
    } catch (err) {
        result.errors.push(`Failed to write new file: ${(err as Error).message}`);
        return result; // Old file untouched — safe state
    }

    // Step 3: Rename child folder (Matryoshka)
    const oldFolderName = sanitizeFilename(oldName);
    const oldFolderPath = path.join(path.dirname(oldFilePath), oldFolderName);
    const newFolderPath = path.join(path.dirname(oldFilePath), sanitizedNew);

    if (fs.existsSync(oldFolderPath) && fs.statSync(oldFolderPath).isDirectory()) {
        try {
            fs.renameSync(oldFolderPath, newFolderPath);
            result.updatedFiles.push(newFolderPath);
        } catch (err) {
            result.errors.push(`Failed to rename child folder: ${(err as Error).message}`);
            // Continue — the entity was renamed, just the folder failed
            // This is recoverable: user can rename folder manually
        }
    }

    // Step 4: Update ALL references across the entire world
    const allMdFiles = findAllMdFiles(worldPath);

    for (const mdFile of allMdFiles) {
        // Skip the old file (we'll delete it) and the new file (we just wrote it)
        if (mdFile === oldFilePath || mdFile === newFilePath) continue;

        try {
            let content = fs.readFileSync(mdFile, 'utf-8');
            let modified = false;

            // 4a: Update wiki-links: [[oldName]] → [[newName]]
            const wikiLinkOld = `[[${oldName}]]`;
            const wikiLinkNew = `[[${sanitizedNew}]]`;
            if (content.includes(wikiLinkOld)) {
                content = content.split(wikiLinkOld).join(wikiLinkNew);
                modified = true;
            }

            // 4b: Update tags in YAML frontmatter
            // tags: [oldName, другой_тег] → tags: [newName, другой_тег]
            const tagRegexInline = new RegExp(
                `(tags:\\s*\\[)([^\\]]*)\\b${escapeRegExp(oldName)}\\b([^\\]]*)(\\])`,
                'g'
            );
            if (tagRegexInline.test(content)) {
                content = content.replace(tagRegexInline, `$1$2${sanitizedNew}$3$4`);
                modified = true;
            }

            // 4c: Update source: oldName → source: newName (User/GM DB copies)
            const sourceRegex = new RegExp(
                `^(source:\\s*)${escapeRegExp(oldName)}\\s*$`,
                'gm'
            );
            if (sourceRegex.test(content)) {
                content = content.replace(sourceRegex, `$1${sanitizedNew}`);
                modified = true;
            }

            if (modified) {
                markAsOurWrite(mdFile);
                fs.writeFileSync(mdFile, content, 'utf-8');
                result.updatedFiles.push(mdFile);
            }
        } catch (err) {
            result.errors.push(`Failed to update ${path.basename(mdFile)}: ${(err as Error).message}`);
            // Continue with other files — partial update is better than nothing
        }
    }

    // Step 5: Delete the old file
    try {
        markAsOurWrite(oldFilePath);
        fs.unlinkSync(oldFilePath);
    } catch (err) {
        result.errors.push(`Failed to delete old file: ${(err as Error).message}`);
        // Not critical — old file might confuse things but new file exists
    }

    result.success = result.errors.length === 0;
    console.log(
        `📝 Renamed "${oldName}" → "${sanitizedNew}" ` +
        `(${result.updatedFiles.length} files updated` +
        `${result.errors.length > 0 ? `, ${result.errors.length} errors` : ''})`
    );

    return result;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
