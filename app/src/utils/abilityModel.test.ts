/**
 * abilityModel.test.ts
 *
 * Run with: ..\server\node_modules\.bin\tsx.cmd src/utils/abilityModel.test.ts
 */

import type { Entity } from '../types';
import { getAbilityCostBase, getAbilityFormula, normalizeAbilityFormula, setAbilityCostBase } from './abilityModel';

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

function ability(properties: Record<string, unknown>): Entity {
    return {
        id: 'ability-1',
        parentId: null,
        type: 'ability',
        name: 'Ability',
        description: '',
        properties,
        tags: [],
        database: 'general',
    };
}

console.log('\nAbility Model Tests\n');

console.log('Test 1: formula normalization');
{
    assert(normalizeAbilityFormula('/r 2d6+1') === '2d6+1', 'Strips /r prefix');
    assert(normalizeAbilityFormula('/roll d20') === 'd20', 'Strips /roll prefix');
    assert(normalizeAbilityFormula('!roll 1d6') === '1d6', 'Strips !roll prefix');
}

console.log('\nTest 2: diceFormula precedence');
{
    assert(getAbilityFormula(ability({ diceFormula: '2d6', dice: '1d4' })) === '2d6', 'Uses diceFormula first');
    assert(getAbilityFormula(ability({ dice: '1d4+2' })) === '1d4+2', 'Falls back to legacy dice field');
    assert(getAbilityFormula(ability({ diceFormula: '', dice: '1d4' })) === '', 'Empty diceFormula intentionally clears legacy fallback');
}

console.log('\nTest 3: cost base helpers');
{
    assert(getAbilityCostBase(ability({ cost: { base: 3 } })) === 3, 'Reads object cost.base');
    assert(getAbilityCostBase(ability({ cost: '4' })) === 4, 'Reads string cost');
    assert(JSON.stringify(setAbilityCostBase(ability({ cost: { base: 3, mana: 1 } }), 5)) === JSON.stringify({ base: 5, mana: 1 }), 'Preserves extra cost keys');
    assert(JSON.stringify(setAbilityCostBase(ability({ cost: 2 }), -1)) === JSON.stringify({ base: 0 }), 'Clamps negative cost to zero');
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    process.exit(1);
}
