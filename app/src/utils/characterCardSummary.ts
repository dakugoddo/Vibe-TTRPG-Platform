import type { Entity } from '../types';
import { getEntityActionRollFormula } from './entityActionRollModel';
import { normalizeResources } from './resourceModel';

export interface CharacterCompactMetric {
    id: string;
    label: string;
    value: number;
}

export interface CharacterCompactResource {
    id: string;
    label: string;
    current: number;
    max: number;
    ratio: number;
}

export interface CharacterCompactAction {
    id: string;
    kind: 'attack' | 'ability';
    name: string;
    formula: string;
    parentName?: string;
}

export interface CharacterCompactInventoryItem {
    id: string;
    name: string;
    category: string;
    equipped: boolean;
}

export interface CharacterCompactSummary {
    metrics: CharacterCompactMetric[];
    resources: CharacterCompactResource[];
    actions: CharacterCompactAction[];
    inventory: CharacterCompactInventoryItem[];
    inventoryCount: number;
    abilityCount: number;
    attackCount: number;
}

const ATTRIBUTE_LABELS: Record<string, string> = {
    strength: 'СИЛ',
    dexterity: 'ЛОВ',
    constitution: 'ВЫН',
    cognition: 'КОГ',
    physique: 'ФИЗ',
    mind: 'РАЗ',
    speed: 'СКР',
    hunger: 'ГОЛ',
};

const PREFERRED_ATTRIBUTE_ORDER = [
    'strength',
    'dexterity',
    'constitution',
    'physique',
    'cognition',
    'mind',
    'speed',
    'hunger',
];

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (isRecord(value)) {
        for (const key of ['total', 'base', 'current', 'rank']) {
            const parsed = readNumber(value[key]);
            if (parsed !== null) return parsed;
        }
    }
    return null;
}

function stringifyProperty(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
}

function readBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === 'yes' || normalized === 'equipped' || normalized === 'да';
    }
    return false;
}

function readNestedRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
    return isRecord(record[key]) ? record[key] : {};
}

function readInventoryCategory(item: Entity): string {
    const properties = item.properties ?? {};
    return (
        stringifyProperty(properties.category)
        || stringifyProperty(properties.slot)
        || stringifyProperty(properties.kind)
        || 'Предмет'
    );
}

function readWoundsResource(character: Entity): CharacterCompactResource | null {
    const attributes = readNestedRecord(character.properties ?? {}, 'attributes');
    const wounds = readNestedRecord(attributes, 'wounds');
    const current = readNumber(wounds.current);
    const limit = readNumber(wounds.limit);
    if (current === null && limit === null) return null;

    const max = Math.max(0, (limit ?? 0) * 2);
    const safeCurrent = Math.max(0, current ?? 0);
    return {
        id: 'wounds',
        label: 'Раны',
        current: safeCurrent,
        max,
        ratio: max > 0 ? Math.min(1, safeCurrent / max) : 0,
    };
}

function readMetricCandidates(character: Entity): CharacterCompactMetric[] {
    const properties = character.properties ?? {};
    const legacyStats = readNestedRecord(properties, 'stats');
    const attributes = readNestedRecord(properties, 'attributes');
    const source = {
        ...legacyStats,
        ...Object.fromEntries(Object.entries(attributes).filter(([key]) => key !== 'wounds')),
    };

    const orderedKeys = [
        ...PREFERRED_ATTRIBUTE_ORDER.filter((key) => Object.prototype.hasOwnProperty.call(source, key)),
        ...Object.keys(source).filter((key) => !PREFERRED_ATTRIBUTE_ORDER.includes(key)),
    ];

    return orderedKeys
        .map((key) => {
            const value = readNumber(source[key]);
            if (value === null) return null;
            return {
                id: key,
                label: ATTRIBUTE_LABELS[key] ?? key.slice(0, 3).toUpperCase(),
                value,
            };
        })
        .filter((metric): metric is CharacterCompactMetric => Boolean(metric))
        .slice(0, 4);
}

export function buildCharacterCompactSummary(character: Entity, allEntities: readonly Entity[]): CharacterCompactSummary {
    const entityById = new Map(allEntities.map((entity) => [entity.id, entity]));
    const children = allEntities.filter((entity) => entity.parentId === character.id);
    const inventory = children.filter((entity) => entity.type === 'object');
    const inventoryIds = new Set(inventory.map((entity) => entity.id));
    const abilities = children.filter((entity) => entity.type === 'ability');
    const attacks = allEntities.filter((entity) => (
        entity.type === 'attack'
        && (entity.parentId === character.id || (entity.parentId ? inventoryIds.has(entity.parentId) : false))
    ));

    const resources = normalizeResources(character.properties?.resources);
    const resourceSummaries = Object.entries(resources)
        .map(([id, resource]) => ({
            id,
            label: resource.label?.trim() || id,
            current: resource.current,
            max: resource.max,
            ratio: resource.max > 0 ? Math.min(1, Math.max(0, resource.current / resource.max)) : 0,
        }))
        .slice(0, 2);

    const wounds = readWoundsResource(character);
    const actionSummaries: CharacterCompactAction[] = [
        ...attacks.map((attack) => ({
            id: attack.id,
            kind: 'attack' as const,
            name: attack.name?.trim() || 'Атака',
            formula: getEntityActionRollFormula(attack, 'attack'),
            parentName: attack.parentId && attack.parentId !== character.id ? entityById.get(attack.parentId)?.name : undefined,
        })),
        ...abilities.map((ability) => ({
            id: ability.id,
            kind: 'ability' as const,
            name: ability.name?.trim() || 'Способность',
            formula: getEntityActionRollFormula(ability, 'ability'),
        })),
    ].slice(0, 8);

    const inventorySummaries = inventory
        .map((item) => ({
            id: item.id,
            name: item.name?.trim() || 'Предмет',
            category: readInventoryCategory(item),
            equipped: readBoolean(item.properties?.equipped ?? item.properties?.isEquipped),
        }))
        .slice(0, 6);

    return {
        metrics: readMetricCandidates(character),
        resources: wounds ? [wounds, ...resourceSummaries].slice(0, 3) : resourceSummaries,
        actions: actionSummaries,
        inventory: inventorySummaries,
        inventoryCount: inventory.length,
        abilityCount: abilities.length,
        attackCount: attacks.length,
    };
}
