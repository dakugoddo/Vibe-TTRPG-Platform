import assert from 'node:assert/strict';
import type { Entity } from '../types';
import { getEntityActionRollFormula } from './entityActionRollModel';

function entity(partial: Partial<Entity>): Entity {
    return {
        id: partial.id ?? 'entity',
        parentId: partial.parentId ?? null,
        type: partial.type ?? 'note',
        name: partial.name ?? 'Entity',
        description: partial.description ?? '',
        properties: partial.properties ?? {},
        tags: partial.tags ?? [],
        database: partial.database ?? 'general',
    };
}

const attack = entity({
    type: 'attack',
    properties: {
        diceFormula: '2d6+3',
    },
});
const ability = entity({
    type: 'ability',
    properties: {
        dice: '!roll 1d8+2',
    },
});

assert.equal(getEntityActionRollFormula(attack, 'attack'), '2d6+3');
assert.equal(getEntityActionRollFormula(ability, 'ability'), '1d8+2');

console.log('entity action roll model tests passed');
