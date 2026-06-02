import assert from 'node:assert/strict';
import type { Entity } from '../types';
import { buildCharacterCompactSummary } from './characterCardSummary';

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

const character = entity({
    id: 'hero',
    type: 'character',
    name: 'Hero',
    properties: {
        attributes: {
            wounds: { current: 3, limit: { base: 5 } },
            constitution: { base: 2 },
            cognition: { base: 4 },
            speed: { base: 6 },
        },
        stats: {
            strength: 14,
            dexterity: 12,
        },
        resources: {
            focus: { label: 'Фокус', current: 2, max: 5 },
        },
    },
});

const sword = entity({ id: 'sword', name: 'Sword', type: 'object', parentId: 'hero', properties: { category: 'weapon', equipped: true } });
const potion = entity({ id: 'potion', name: 'Potion', type: 'object', parentId: 'hero', properties: { category: 'consumable' } });
const ability = entity({ id: 'blink', name: 'Blink', type: 'ability', parentId: 'hero', properties: { dice: '!roll 1d8' } });
const attack = entity({ id: 'slash', name: 'Slash', type: 'attack', parentId: 'sword', properties: { diceFormula: '2d6+3' } });
const unrelatedAttack = entity({ id: 'hidden', type: 'attack', parentId: 'other' });

const summary = buildCharacterCompactSummary(character, [character, sword, potion, ability, attack, unrelatedAttack]);

assert.deepEqual(summary.metrics, [
    { id: 'strength', label: 'СИЛ', value: 14 },
    { id: 'dexterity', label: 'ЛОВ', value: 12 },
    { id: 'constitution', label: 'ВЫН', value: 2 },
    { id: 'cognition', label: 'КОГ', value: 4 },
]);
assert.deepEqual(summary.resources[0], { id: 'wounds', label: 'Раны', current: 3, max: 10, ratio: 0.3 });
assert.deepEqual(summary.resources[1], { id: 'focus', label: 'Фокус', current: 2, max: 5, ratio: 0.4 });
assert.deepEqual(summary.actions, [
    { id: 'slash', kind: 'attack', name: 'Slash', formula: '2d6+3', parentName: 'Sword' },
    { id: 'blink', kind: 'ability', name: 'Blink', formula: '1d8' },
]);
assert.deepEqual(summary.inventory, [
    { id: 'sword', name: 'Sword', category: 'weapon', equipped: true },
    { id: 'potion', name: 'Potion', category: 'consumable', equipped: false },
]);
assert.equal(summary.inventoryCount, 2);
assert.equal(summary.abilityCount, 1);
assert.equal(summary.attackCount, 1);

console.log('character card summary tests passed');
