import type { Entity } from '../types';
import { getAbilityFormula } from './abilityModel';

export type EntityActionRollKind = 'attack' | 'ability';

function stringifyProperty(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
}

export function getAttackFormula(attack: Entity): string {
    return stringifyProperty(attack.properties?.diceFormula ?? attack.properties?.dice);
}

export function getEntityActionRollFormula(entity: Entity, kind: EntityActionRollKind): string {
    return kind === 'ability' ? getAbilityFormula(entity) : getAttackFormula(entity);
}
