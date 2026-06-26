/**
 * rollVariables.test.ts
 *
 * Run with: ..\server\node_modules\.bin\tsx.cmd src/utils/rollVariables.test.ts
 */

import { createEntityRollVariableResolver } from './rollVariables';
import type { Entity } from '../types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
    if (condition) {
        console.log(`  OK ${message}`);
        passed++;
    } else {
        console.error(`  FAIL ${message}`);
        failed++;
    }
}

function entity(partial: Partial<Entity>): Entity {
    return {
        id: partial.id ?? 'entity',
        parentId: partial.parentId ?? null,
        type: partial.type ?? 'note',
        name: partial.name ?? 'Entity',
        description: partial.description ?? '',
        properties: partial.properties ?? {},
        tags: partial.tags ?? [],
        database: partial.database,
    };
}

console.log('\nRoll Variables Tests\n');

const attack = entity({
    id: 'attack',
    type: 'attack',
    properties: {
        урон: 4,
        hit_bonus: { base: 2, adhoc: 1 },
    },
});
const parent = entity({
    id: 'weapon',
    type: 'object',
    properties: {
        quality: 3,
        skills: {
            ловкость: { rank: 2 },
        },
    },
});

const resolve = createEntityRollVariableResolver(attack, [parent]);

assert(resolve('урон') === 4, 'Resolves localized direct property from primary entity');
assert(resolve('hit bonus') === 3, 'Normalizes spaces/hyphens and sums base+adhoc');
assert(resolve('quality') === 3, 'Falls back to related parent entity');
assert(resolve('ловкость') === 2, 'Resolves localized skill rank from related entity');
assert(resolve('missing') === null, 'Unknown variable returns null');

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    process.exit(1);
}
