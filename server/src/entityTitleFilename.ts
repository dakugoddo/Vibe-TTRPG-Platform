import type { EntityType } from './shared/types.js';

const MAX_ENTITY_FILENAME_BASE_LENGTH = 80;
const WINDOWS_RESERVED_NAMES = new Set([
    'con',
    'prn',
    'aux',
    'nul',
    'com1',
    'com2',
    'com3',
    'com4',
    'com5',
    'com6',
    'com7',
    'com8',
    'com9',
    'lpt1',
    'lpt2',
    'lpt3',
    'lpt4',
    'lpt5',
    'lpt6',
    'lpt7',
    'lpt8',
    'lpt9',
]);

export function normalizeWindowsFilenameKey(filename: string): string {
    return filename.trim().toLocaleLowerCase('ru-RU');
}

export function sanitizeEntityTitleForFilename(title: string, fallback: { type: EntityType; id: string }): string {
    let base = title
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[ .]+$/g, '');

    if (!base) {
        base = `${fallback.type}-${fallback.id}`.trim();
    }

    if (WINDOWS_RESERVED_NAMES.has(base.toLocaleLowerCase('en-US'))) {
        base = `${base}_`;
    }

    if (base.length > MAX_ENTITY_FILENAME_BASE_LENGTH) {
        base = base.slice(0, MAX_ENTITY_FILENAME_BASE_LENGTH).trim().replace(/[ .]+$/g, '');
    }

    return base || `${fallback.type}-${fallback.id}`;
}

export function entityTitleToFilename(title: string, fallback: { type: EntityType; id: string }, extension = '.md'): string {
    return `${sanitizeEntityTitleForFilename(title, fallback)}${extension}`;
}

export interface AvailableEntityTitleFilenameOptions {
    extension?: string;
    currentFilename?: string | null;
}

export function getAvailableEntityTitleFilename(
    title: string,
    existingFilenames: Iterable<string>,
    fallback: { type: EntityType; id: string },
    options: AvailableEntityTitleFilenameOptions = {},
): string {
    const extension = options.extension ?? '.md';
    const base = sanitizeEntityTitleForFilename(title, fallback);
    const currentKey = options.currentFilename ? normalizeWindowsFilenameKey(options.currentFilename) : null;
    const occupied = new Set(
        Array.from(existingFilenames)
            .map(normalizeWindowsFilenameKey)
            .filter((filename) => filename !== currentKey)
    );

    let candidate = `${base}${extension}`;
    let suffix = 1;
    while (occupied.has(normalizeWindowsFilenameKey(candidate))) {
        candidate = `${base} (${suffix})${extension}`;
        suffix += 1;
    }

    return candidate;
}
