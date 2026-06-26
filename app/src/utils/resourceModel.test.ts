/**
 * resourceModel.test.ts
 *
 * Run with: ..\server\node_modules\.bin\tsx.cmd src/utils/resourceModel.test.ts
 */

import { applyResourcePatch, normalizeResource, normalizeResources } from './resourceModel';

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

function assertDeepEqual<T>(actual: T, expected: T, message: string) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    assert(a === e, `${message} (expected ${e}, got ${a})`);
}

console.log('\nResource Model Tests\n');

console.log('Test 1: normalize empty and invalid resources');
{
    assertDeepEqual(normalizeResources(null), {}, 'Null resources become empty map');
    assertDeepEqual(normalizeResources([]), {}, 'Array resources become empty map');
}

console.log('\nTest 2: normalize scalar resource');
{
    assertDeepEqual(normalizeResource(3), { current: 3, max: 3 }, 'Number becomes current/max pair');
    assertDeepEqual(normalizeResource('-2'), { current: 0, max: 0 }, 'Negative scalar clamps to zero');
}

console.log('\nTest 3: normalize resource object');
{
    const result = normalizeResource({ label: 'Фокус', current: '2', max: '5', note: 'scene pool' });
    assertDeepEqual(result, { label: 'Фокус', current: 2, max: 5, note: 'scene pool' }, 'Object values normalize to typed entry');
}

console.log('\nTest 4: apply resource patches');
{
    const base = { label: 'Заряд', current: 2, max: 5 };
    assertDeepEqual(applyResourcePatch(base, { current: 9 }), { label: 'Заряд', current: 5, max: 5 }, 'Current clamps to max');
    assertDeepEqual(applyResourcePatch(base, { current: -3 }), { label: 'Заряд', current: 0, max: 5 }, 'Current clamps to zero');
    assertDeepEqual(applyResourcePatch(base, { max: 1 }), { label: 'Заряд', current: 1, max: 1 }, 'Lower max clamps current');
}

console.log('\nTest 5: normalize resources map');
{
    const result = normalizeResources({
        focus: { label: 'Фокус', current: 1, max: 3 },
        charges: 2,
    });
    assertDeepEqual(result, {
        focus: { label: 'Фокус', current: 1, max: 3 },
        charges: { current: 2, max: 2 },
    }, 'Map preserves ids and normalizes entries');
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    process.exit(1);
}
