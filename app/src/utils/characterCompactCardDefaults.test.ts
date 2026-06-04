import assert from 'node:assert/strict';
import type { Entity } from '../types';
import {
    buildCharacterCompactCardDefaultsPatch,
    CHARACTER_COMPACT_CARD_PROPERTY,
    getCharacterCompactCardDefaults,
    hasCharacterCompactCardDefaults,
} from './characterCompactCardDefaults';

function entity(properties: Record<string, unknown> = {}): Entity {
    return {
        id: 'hero',
        parentId: null,
        type: 'character',
        name: 'Hero',
        description: '',
        properties,
        tags: [],
        database: 'general',
    };
}

const empty = entity();
assert.equal(hasCharacterCompactCardDefaults(empty), false);
assert.deepEqual(getCharacterCompactCardDefaults(empty), {
    metricIds: [],
    resourceIds: [],
    actionIds: [],
    inventoryIds: [],
    notesMode: 'short',
});

const configured = entity({
    [CHARACTER_COMPACT_CARD_PROPERTY]: {
        metricIds: ['strength', 'dexterity', 'strength', ''],
        resourceIds: ['wounds'],
        actionIds: ['slash'],
        inventoryIds: ['sword'],
        notesMode: 'full',
    },
});
assert.equal(hasCharacterCompactCardDefaults(configured), true);
assert.deepEqual(getCharacterCompactCardDefaults(configured), {
    metricIds: ['strength', 'dexterity'],
    resourceIds: ['wounds'],
    actionIds: ['slash'],
    inventoryIds: ['sword'],
    notesMode: 'full',
});

assert.deepEqual(buildCharacterCompactCardDefaultsPatch(configured, { notesMode: 'hidden', actionIds: [] }), {
    metricIds: ['strength', 'dexterity'],
    resourceIds: ['wounds'],
    actionIds: [],
    inventoryIds: ['sword'],
    notesMode: 'hidden',
});

console.log('character compact card defaults tests passed');
