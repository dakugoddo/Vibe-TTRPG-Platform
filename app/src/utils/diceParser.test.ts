/**
 * diceParser.test.ts
 *
 * Run with: ..\server\node_modules\.bin\tsx.cmd src/utils/diceParser.test.ts
 */

import { parseAndRollDice, rollD6Pool, type RandomInt } from './diceParser';

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

function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    assert(a === e, `${message}${a === e ? '' : `\n    Expected: ${e}\n    Actual:   ${a}`}`);
}

function sequenceRandom(values: number[]): RandomInt {
    let index = 0;
    return () => values[index++] ?? values[values.length - 1] ?? 1;
}

console.log('\nDice Parser Tests\n');

console.log('Test 1: standard notation');
{
    const result = parseAndRollDice('/r 2d6+3', sequenceRandom([4, 5]));
    assert(result !== null, 'Returns a result for /r command');
    assert(result?.total === 12, 'Calculates total with modifier');
    assertDeepEqual(result?.rolls, [4, 5], 'Stores individual rolls');
    assert(result?.notation === '2d6+3', 'Normalizes notation');
    assert(result?.faces === 6, 'Stores die faces');
    assert(result?.modifier === 3, 'Stores modifier');
}

console.log('\nTest 2: /roll alias and whitespace');
{
    const result = parseAndRollDice('/roll d20 - 2', sequenceRandom([13]));
    assert(result?.total === 11, 'Supports /roll alias');
    assert(result?.notation === '1d20-2', 'Normalizes implicit count and negative modifier');
}

console.log('\nTest 3: command filtering and validation');
{
    assert(parseAndRollDice('hello 1d20') === null, 'Ignores non-roll chat messages');
    assert(parseAndRollDice('/r 101d6')?.error?.includes('Количество') === true, 'Rejects too many dice');
    assert(parseAndRollDice('/r 1d1')?.error?.includes('Грани') === true, 'Rejects invalid faces');
    assert(parseAndRollDice('/r nope')?.error?.includes('Неверный формат') === true, 'Rejects invalid notation');
}

console.log('\nTest 4: RNG clamping and crit flags');
{
    const max = parseAndRollDice('/r 2d6', sequenceRandom([99, 7]));
    assertDeepEqual(max?.rolls, [6, 6], 'Clamps high provider values to die faces');
    assert(max?.isCritMax === true, 'Marks all-max rolls');

    const min = parseAndRollDice('/r 2d6', sequenceRandom([-4, 0]));
    assertDeepEqual(min?.rolls, [1, 1], 'Clamps low provider values to 1');
    assert(min?.isCritMin === true, 'Marks all-min rolls');
}

console.log('\nTest 5: d6 pool helper');
{
    const result = rollD6Pool(3, 'Навык', sequenceRandom([6, 1, 4]));
    assert(result.total === 11, 'Rolls d6 pools');
    assert(result.notation === 'Навык: 3d6', 'Includes optional label');
    assertDeepEqual(result.rolls, [6, 1, 4], 'Stores pool rolls');
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    process.exit(1);
}
