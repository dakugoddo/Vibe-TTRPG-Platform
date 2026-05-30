import type { Entity } from '../types';

function normalizeKey(value: string): string {
    return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function getRecordValue(record: unknown, key: string): unknown {
    if (!record || typeof record !== 'object') return undefined;
    const source = record as Record<string, unknown>;
    const exact = source[key];
    if (exact !== undefined) return exact;

    const normalizedKey = normalizeKey(key);
    const entry = Object.entries(source).find(([entryKey]) => normalizeKey(entryKey) === normalizedKey);
    return entry?.[1];
}

export function coerceRollVariableValue(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const rank = coerceRollVariableValue(record.rank);
        if (rank !== null) return rank;

        const base = coerceRollVariableValue(record.base) ?? 0;
        const adhoc = coerceRollVariableValue(record.adhoc) ?? 0;
        if (record.base !== undefined || record.adhoc !== undefined) return base + adhoc;

        const valueField = coerceRollVariableValue(record.value);
        if (valueField !== null) return valueField;
    }

    return null;
}

export function findRollVariableValue(source: unknown, desiredKey: string, depth = 0): number | null {
    if (!source || typeof source !== 'object' || depth > 5) return null;

    const record = source as Record<string, unknown>;
    const direct = getRecordValue(record, desiredKey);
    const directValue = coerceRollVariableValue(direct);
    if (directValue !== null) return directValue;

    for (const [key, value] of Object.entries(record)) {
        if (normalizeKey(key) === normalizeKey(desiredKey)) {
            const valueNumber = coerceRollVariableValue(value);
            if (valueNumber !== null) return valueNumber;
        }
    }

    for (const value of Object.values(record)) {
        const nested = findRollVariableValue(value, desiredKey, depth + 1);
        if (nested !== null) return nested;
    }

    return null;
}

export function createEntityRollVariableResolver(primaryEntity?: Entity, relatedEntities: Entity[] = []) {
    const orderedEntities = [
        ...(primaryEntity ? [primaryEntity] : []),
        ...relatedEntities.filter(entity => entity.id !== primaryEntity?.id),
    ];

    return (variableName: string): number | null => {
        for (const entity of orderedEntities) {
            const skills = getRecordValue(entity.properties, 'skills');
            const skillValue = findRollVariableValue(skills, variableName);
            if (skillValue !== null) return skillValue;

            const propertyValue = findRollVariableValue(entity.properties, variableName);
            if (propertyValue !== null) return propertyValue;
        }

        return null;
    };
}
