import type { Entity } from '../types';

export interface WikiLinkAutocompleteTrigger {
    start: number;
    query: string;
    kind: 'link' | 'embed';
}

export interface WikiLinkAutocompleteCompletion {
    value: string;
    caret: number;
}

export function findWikiLinkAutocompleteTrigger(
    value: string,
    caret: number
): WikiLinkAutocompleteTrigger | null {
    const beforeCaret = value.slice(0, caret);
    const openIndex = beforeCaret.lastIndexOf('[[');
    if (openIndex === -1) return null;

    const lastCloseIndex = beforeCaret.lastIndexOf(']]');
    if (lastCloseIndex > openIndex) return null;

    const query = beforeCaret.slice(openIndex + 2);
    if (query.includes('[') || query.includes(']') || query.includes('\n') || query.includes('|')) return null;

    return {
        start: openIndex,
        query,
        kind: openIndex > 0 && value[openIndex - 1] === '!' ? 'embed' : 'link',
    };
}

function getSuggestionScore(entity: Entity, normalizedQuery: string): number | null {
    if (!normalizedQuery) return 0;

    const id = entity.id.trim().toLowerCase();
    const name = entity.name.trim().toLowerCase();
    if (id === normalizedQuery) return 0;
    if (name === normalizedQuery) return 1;
    if (name.startsWith(normalizedQuery)) return 2;
    if (id.startsWith(normalizedQuery)) return 3;
    if (name.includes(normalizedQuery)) return 4;
    if (id.includes(normalizedQuery)) return 5;
    return null;
}

export function getWikiLinkAutocompleteSuggestions(
    entities: readonly Entity[],
    query: string,
    limit = 8
): Entity[] {
    const normalizedQuery = query.trim().toLowerCase();

    return entities
        .map((entity) => ({ entity, score: getSuggestionScore(entity, normalizedQuery) }))
        .filter((candidate): candidate is { entity: Entity; score: number } => candidate.score !== null)
        .sort((left, right) => (
            left.score - right.score
            || left.entity.name.localeCompare(right.entity.name, undefined, { sensitivity: 'base' })
            || left.entity.id.localeCompare(right.entity.id, undefined, { sensitivity: 'base' })
        ))
        .slice(0, limit)
        .map(({ entity }) => entity);
}

export function completeWikiLinkAutocomplete(
    value: string,
    caret: number,
    trigger: WikiLinkAutocompleteTrigger,
    entityId: string
): WikiLinkAutocompleteCompletion {
    const replacement = `[[${entityId}]]`;
    return {
        value: `${value.slice(0, trigger.start)}${replacement}${value.slice(caret)}`,
        caret: trigger.start + replacement.length,
    };
}
