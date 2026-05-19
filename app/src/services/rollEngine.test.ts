/**
 * rollEngine.test.ts
 *
 * Run with: ..\server\node_modules\.bin\tsx.cmd src/services/rollEngine.test.ts
 */

import { RandomOrgRandomProvider, rollEngine, type RandomProvider } from './rollEngine';

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

function fixedProvider(values: number[]): RandomProvider {
    let index = 0;
    return {
        id: 'test-fixed',
        label: 'Test fixed',
        nextInt: () => values[index++] ?? values[values.length - 1] ?? 1,
    };
}

console.log('\nRoll Engine Tests\n');

try {
    console.log('Test 1: provider injection');
    {
        rollEngine.setRandomProvider(fixedProvider([3, 4]));
        const result = rollEngine.rollDiceNotation('2d6+1');
        assert(result.total === 8, 'Uses injected provider for notation rolls');
        assert(JSON.stringify(result.rolls) === JSON.stringify([3, 4]), 'Stores provider rolls');
        assert(rollEngine.getRandomProvider().id === 'test-fixed', 'Exposes active provider');
    }

    console.log('\nTest 2: command parsing and errors');
    {
        rollEngine.setRandomProvider(fixedProvider([12]));
        assert(rollEngine.rollDiceCommand('hello') === null, 'Returns null for non-roll chat messages');
        const invalid = rollEngine.rollDiceNotation('oops');
        assert(Boolean(invalid.error), 'Returns error result for invalid notation');
    }

    console.log('\nTest 3: formatted chat message');
    {
        const message = rollEngine.formatRollMessage('2d6+1', {
            rawCommand: '/r 2d6+1',
            total: 8,
            rolls: [3, 4],
            modifier: 1,
            notation: '2d6+1',
            faces: 6,
        });
        assert(message.includes('🎲 2d6+1: **8**'), 'Includes expression and bold total');
        assert(message.includes('[3, 4]'), 'Includes roll list');
        assert(message.includes('(+1)'), 'Includes signed modifier');
    }

    console.log('\nTest 4: random.org placeholder remains explicit');
    {
        rollEngine.setRandomProvider(new RandomOrgRandomProvider());
        const result = rollEngine.rollDiceNotation('1d6');
        assert(result.error?.includes('random.org provider is not configured') === true, 'Reports unconfigured random.org provider');
    }
} finally {
    rollEngine.resetRandomProvider();
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    process.exit(1);
}
