export const CURRENT_ENTITY_SCHEMA_VERSION = 1;

export function normalizeEntitySchemaVersion(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
    return CURRENT_ENTITY_SCHEMA_VERSION;
}
