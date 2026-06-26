import type { Entity } from '../types';

function stringifyProperty(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
}

export function normalizeAbilityFormula(raw: string): string {
    return raw
        .replace(/^\/r\s+/i, '')
        .replace(/^\/roll\s+/i, '')
        .replace(/^!roll\s+/i, '')
        .trim();
}

export function getAbilityFormula(ability: Entity): string {
    const properties = ability.properties ?? {};
    const hasDiceFormula = Object.prototype.hasOwnProperty.call(properties, 'diceFormula');
    const raw = hasDiceFormula ? stringifyProperty(properties.diceFormula) : stringifyProperty(properties.dice);
    return normalizeAbilityFormula(raw);
}

export function getAbilityCostBase(ability: Entity): number {
    const cost = ability.properties?.cost;
    if (typeof cost === 'number') return cost;
    if (typeof cost === 'string') return Number(cost) || 0;
    if (cost && typeof cost === 'object' && 'base' in cost) {
        const base = (cost as { base?: unknown }).base;
        return typeof base === 'number' ? base : Number(base) || 0;
    }
    return 0;
}

export function setAbilityCostBase(ability: Entity, nextBase: number): unknown {
    const cost = ability.properties?.cost;
    const safeBase = Math.max(0, Number.isFinite(nextBase) ? nextBase : 0);
    if (cost && typeof cost === 'object' && !Array.isArray(cost)) {
        return { ...cost, base: safeBase };
    }
    return { base: safeBase };
}
