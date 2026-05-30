import fs from 'node:fs';
import path from 'node:path';
import {
    filenameToEntityName,
    getEntityFilePath,
    markAsOurWrite,
    parseEntityFile,
    serializeEntity,
} from './fileManager.js';
import { getDbPath } from './worldManager.js';
import { getAvailableEntityTitleFilename, normalizeWindowsFilenameKey } from './entityTitleFilename.js';
import type { DatabaseType } from './shared/types.js';

export interface EntityTitleRenameResult {
    success: boolean;
    dryRun: boolean;
    changed: boolean;
    entityId: string;
    oldName: string;
    newName: string;
    oldFilePath: string;
    newFilePath: string;
    oldFolderPath?: string;
    newFolderPath?: string;
    updatedFiles: string[];
    warnings: string[];
    errors: string[];
}

function normalizePathKey(filePath: string): string {
    return normalizeWindowsFilenameKey(path.resolve(filePath));
}

function isSamePathOnWindows(left: string, right: string): boolean {
    return normalizePathKey(left) === normalizePathKey(right);
}

function getTemporarySiblingPath(dir: string, prefix: string): string {
    let candidate = path.join(dir, `.${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`);
    while (fs.existsSync(candidate)) {
        candidate = path.join(dir, `.${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`);
    }
    return candidate;
}

function renamePathSafely(oldPath: string, newPath: string): void {
    if (oldPath === newPath) return;

    markAsOurWrite(oldPath);
    markAsOurWrite(newPath);

    if (isSamePathOnWindows(oldPath, newPath)) {
        const tempPath = getTemporarySiblingPath(path.dirname(oldPath), 'entity-title-rename');
        markAsOurWrite(tempPath);
        fs.renameSync(oldPath, tempPath);
        fs.renameSync(tempPath, newPath);
        return;
    }

    fs.renameSync(oldPath, newPath);
}

function getOccupiedSiblingFilenames(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];

    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) return [entry.name];
        if (entry.isDirectory()) return [`${entry.name}.md`];
        return [];
    });
}

function createTitleRenameResult(
    db: DatabaseType,
    entityId: string,
    title: string,
    playerName: string | undefined,
    dryRun: boolean,
): EntityTitleRenameResult {
    const dbRoot = getDbPath(db, playerName);
    const oldFilePath = getEntityFilePath(db, entityId, playerName);
    if (!oldFilePath) {
        throw new Error(`Entity file not found: ${entityId}`);
    }

    const oldContent = fs.readFileSync(oldFilePath, 'utf-8');
    const oldFileName = path.basename(oldFilePath);
    const currentBaseName = filenameToEntityName(oldFileName);
    const entity = parseEntityFile(oldContent, currentBaseName, dbRoot, oldFilePath, db);
    const newName = title.trim();
    if (!newName) {
        throw new Error('title is required');
    }

    const siblingFilenames = getOccupiedSiblingFilenames(path.dirname(oldFilePath));
    const newFilename = getAvailableEntityTitleFilename(
        newName,
        siblingFilenames,
        { type: entity.type, id: entity.id },
        { currentFilename: oldFileName },
    );
    const newFilePath = path.join(path.dirname(oldFilePath), newFilename);

    const oldFolderPath = path.join(path.dirname(oldFilePath), currentBaseName);
    const hasChildFolder = fs.existsSync(oldFolderPath) && fs.statSync(oldFolderPath).isDirectory();
    const newFolderPath = hasChildFolder
        ? path.join(path.dirname(oldFilePath), filenameToEntityName(newFilename))
        : undefined;

    const errors: string[] = [];
    const warnings: string[] = [];
    const filePathSameKey = isSamePathOnWindows(oldFilePath, newFilePath);
    const filePathChanged = oldFilePath !== newFilePath;
    const folderPathChanged = Boolean(
        newFolderPath && oldFolderPath && oldFolderPath !== newFolderPath
    );
    const nameChanged = entity.name !== newName;

    if (!filePathSameKey && fs.existsSync(newFilePath)) {
        errors.push(`Target file already exists: ${newFilePath}`);
    }
    if (
        folderPathChanged &&
        newFolderPath &&
        !isSamePathOnWindows(oldFolderPath, newFolderPath) &&
        fs.existsSync(newFolderPath)
    ) {
        errors.push(`Target child folder already exists: ${newFolderPath}`);
    }

    if (filePathSameKey && filePathChanged) {
        warnings.push('Case-only filename rename will use a temporary path on Windows.');
    }
    if (newFolderPath && isSamePathOnWindows(oldFolderPath, newFolderPath) && folderPathChanged) {
        warnings.push('Case-only child folder rename will use a temporary path on Windows.');
    }

    return {
        success: errors.length === 0,
        dryRun,
        changed: nameChanged || filePathChanged || folderPathChanged,
        entityId: entity.id,
        oldName: entity.name,
        newName,
        oldFilePath,
        newFilePath,
        oldFolderPath: hasChildFolder ? oldFolderPath : undefined,
        newFolderPath,
        updatedFiles: [],
        warnings,
        errors,
    };
}

export function renameEntityFileToTitle(
    db: DatabaseType,
    entityId: string,
    title: string,
    playerName?: string,
    options: { dryRun?: boolean } = {},
): EntityTitleRenameResult {
    const dryRun = options.dryRun ?? true;
    const result = createTitleRenameResult(db, entityId, title, playerName, dryRun);
    if (dryRun || result.errors.length > 0 || !result.changed) {
        return result;
    }

    const dbRoot = getDbPath(db, playerName);
    const oldContent = fs.readFileSync(result.oldFilePath, 'utf-8');
    const oldFileName = path.basename(result.oldFilePath);
    const entity = parseEntityFile(oldContent, filenameToEntityName(oldFileName), dbRoot, result.oldFilePath, db);
    const renamedEntity = { ...entity, name: result.newName };
    const content = serializeEntity(renamedEntity, { includeUid: db === 'user' || db === 'gm' });
    let fileMoved = false;
    let folderMoved = false;

    try {
        renamePathSafely(result.oldFilePath, result.newFilePath);
        fileMoved = result.oldFilePath !== result.newFilePath;
        markAsOurWrite(result.newFilePath);
        fs.writeFileSync(result.newFilePath, content, 'utf-8');
        result.updatedFiles.push(result.newFilePath);

        if (result.oldFolderPath && result.newFolderPath && result.oldFolderPath !== result.newFolderPath) {
            renamePathSafely(result.oldFolderPath, result.newFolderPath);
            folderMoved = true;
            result.updatedFiles.push(result.newFolderPath);
        }

        result.success = true;
        return result;
    } catch (err) {
        result.success = false;
        result.errors.push((err as Error).message);

        if (folderMoved && result.oldFolderPath && result.newFolderPath && fs.existsSync(result.newFolderPath)) {
            try {
                renamePathSafely(result.newFolderPath, result.oldFolderPath);
            } catch (rollbackErr) {
                result.errors.push(`Folder rollback failed: ${(rollbackErr as Error).message}`);
            }
        }

        if (fileMoved && fs.existsSync(result.newFilePath) && !fs.existsSync(result.oldFilePath)) {
            try {
                renamePathSafely(result.newFilePath, result.oldFilePath);
            } catch (rollbackErr) {
                result.errors.push(`File rollback failed: ${(rollbackErr as Error).message}`);
            }
        }

        return result;
    }
}
