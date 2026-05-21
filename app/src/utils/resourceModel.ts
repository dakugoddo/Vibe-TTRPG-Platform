export interface ResourceEntry {
    label?: string;
    current: number;
    max: number;
    note?: string;
}

export function asResourceNumber(value: unknown, fallback = 0): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeResource(value: unknown): ResourceEntry {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const record = value as Record<string, unknown>;
        return {
            label: typeof record.label === 'string' ? record.label : undefined,
            current: Math.max(0, asResourceNumber(record.current, 0)),
            max: Math.max(0, asResourceNumber(record.max, 0)),
            note: typeof record.note === 'string' ? record.note : undefined,
        };
    }

    const numeric = Math.max(0, asResourceNumber(value, 0));
    return { current: numeric, max: numeric };
}

export function normalizeResources(value: unknown): Record<string, ResourceEntry> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, resource]) => [key, normalizeResource(resource)])
    );
}

export function applyResourcePatch(previous: ResourceEntry, patch: Partial<ResourceEntry>): ResourceEntry {
    const nextMax = patch.max !== undefined ? Math.max(0, asResourceNumber(patch.max, previous.max)) : previous.max;
    const rawCurrent = patch.current !== undefined ? asResourceNumber(patch.current, previous.current) : previous.current;
    const nextCurrent = nextMax > 0 ? Math.max(0, Math.min(nextMax, rawCurrent)) : Math.max(0, rawCurrent);

    return {
        ...previous,
        ...patch,
        current: nextCurrent,
        max: nextMax,
    };
}
