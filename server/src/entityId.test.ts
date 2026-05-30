import { strict as assert } from 'node:assert';
import { formatEntityTimestampId, generateEntityId } from './entityId.js';

function test(name: string, fn: () => void) {
    try {
        fn();
        console.log(`ok - ${name}`);
    } catch (error) {
        console.error(`not ok - ${name}`);
        throw error;
    }
}

test('formatEntityTimestampId pads date parts and milliseconds', () => {
    const id = formatEntityTimestampId(new Date(2026, 0, 2, 3, 4, 5, 6));
    assert.equal(id, '20260102030405006');
});

test('generateEntityId produces monotonic unique ids', () => {
    const first = generateEntityId();
    const second = generateEntityId([first]);

    assert.match(first, /^\d{17}$/);
    assert.match(second, /^\d{17}$/);
    assert.notEqual(second, first);
    assert(second > first);
});
