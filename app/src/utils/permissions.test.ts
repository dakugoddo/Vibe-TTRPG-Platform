/**
 * permissions.test.ts
 *
 * Run with: ..\server\node_modules\.bin\tsx.cmd src/utils/permissions.test.ts
 */

import { canModifyEntity } from './permissions';

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

console.log('\nPermission Helper Tests\n');

console.log('Test 1: GM can edit every database');
{
    assert(canModifyEntity('gm', 'general') === true, 'GM can edit general');
    assert(canModifyEntity('gm', 'gm') === true, 'GM can edit gm');
    assert(canModifyEntity('gm', 'user', 'other-player', 'local-player') === true, 'GM can edit user inventory');
}

console.log('\nTest 2: spectator is read-only');
{
    assert(canModifyEntity('spectator', 'general') === false, 'Spectator cannot edit general');
    assert(canModifyEntity('spectator', 'user', 'local-player', 'local-player') === false, 'Spectator cannot edit owned user inventory');
}

console.log('\nTest 3: player database boundaries');
{
    assert(canModifyEntity('player', 'general') === true, 'Player can edit shared general entities');
    assert(canModifyEntity('player', 'gm') === false, 'Player cannot edit GM database');
    assert(canModifyEntity('player', 'user', 'local-player', 'local-player') === true, 'Player can edit own user inventory');
    assert(canModifyEntity('player', 'user', 'Игрок', 'local-id', 'Игрок') === true, 'Player can edit user inventory owned by display name');
    assert(canModifyEntity('player', 'user', 'other-player', 'local-player') === false, 'Player cannot edit another user inventory');
    assert(canModifyEntity('player', 'user', undefined, 'local-player') === true, 'Player can edit legacy unowned user inventory');
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    process.exit(1);
}
