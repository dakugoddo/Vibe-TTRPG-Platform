import type { Entity } from '../types';

export const CHARACTER_COMPACT_CARD_PROPERTY = 'compactCard';

export type CharacterCompactNotesMode = 'hidden' | 'short' | 'full';

export interface CharacterCompactCardDefaults {
    metricIds: string[];
    resourceIds: string[];
    actionIds: string[];
    inventoryIds: string[];
    notesMode: CharacterCompactNotesMode;
}

export type CharacterCompactCardDefaultsPatch = Partial<CharacterCompactCardDefaults>;

const DEFAULT_COMPACT_CARD_DEFAULTS: CharacterCompactCardDefaults = {
    metricIds: [],
    resourceIds: [],
    actionIds: [],
    inventoryIds: [],
    notesMode: 'short',
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)));
}

function readNotesMode(value: unknown): CharacterCompactNotesMode {
    return value === 'hidden' || value === 'short' || value === 'full' ? value : DEFAULT_COMPACT_CARD_DEFAULTS.notesMode;
}

export function hasCharacterCompactCardDefaults(entity: Entity): boolean {
    return isRecord(entity.properties?.[CHARACTER_COMPACT_CARD_PROPERTY]);
}

export function getCharacterCompactCardDefaults(entity: Entity): CharacterCompactCardDefaults {
    const raw = isRecord(entity.properties?.[CHARACTER_COMPACT_CARD_PROPERTY])
        ? entity.properties[CHARACTER_COMPACT_CARD_PROPERTY]
        : {};

    return {
        metricIds: readStringArray(raw.metricIds),
        resourceIds: readStringArray(raw.resourceIds),
        actionIds: readStringArray(raw.actionIds),
        inventoryIds: readStringArray(raw.inventoryIds),
        notesMode: readNotesMode(raw.notesMode),
    };
}

export function buildCharacterCompactCardDefaultsPatch(
    entity: Entity,
    patch: CharacterCompactCardDefaultsPatch
): CharacterCompactCardDefaults {
    return {
        ...getCharacterCompactCardDefaults(entity),
        ...patch,
    };
}
