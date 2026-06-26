/**
 * permissions.test.ts
 *
 * Run with: ..\server\node_modules\.bin\tsx.cmd src/utils/permissions.test.ts
 */

import { BASE_PLAYER_ROLE, canBroadcastAudio, canModifyEntity, canViewEntity, DEFAULT_ROLE_DEFINITIONS, getEffectivePermissions } from './permissions';

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

console.log('\nTest 4: player visibility boundaries');
{
    assert(canViewEntity('player', 'general') === true, 'Player can view general');
    assert(canViewEntity('player', 'gm') === false, 'Player cannot view GM database');
    assert(canViewEntity('player', 'user', 'local-player', 'local-player') === true, 'Player can view own user inventory');
    assert(canViewEntity('player', 'user', 'Игрок', 'local-id', 'Игрок') === true, 'Player can view user inventory owned by display name');
    assert(canViewEntity('player', 'user', 'other-player', 'local-player') === false, 'Player cannot view another user inventory');
    assert(canViewEntity('player', 'user', undefined, 'local-player') === true, 'Player can view legacy unowned user inventory');
}

console.log('\nTest 5: GM visibility');
{
    assert(canViewEntity('gm', 'general') === true, 'GM can view general');
    assert(canViewEntity('gm', 'gm') === true, 'GM can view gm');
    assert(canViewEntity('gm', 'user', 'other-player', 'local-player') === true, 'GM can view every user inventory');
}

console.log('\nTest 6: base player role clamps default player roles');
{
    assert(BASE_PLAYER_ROLE.locked === true, 'Base Player role is locked');
    assert(DEFAULT_ROLE_DEFINITIONS.some(role => role.id === 'base-player'), 'Role matrix includes Base Player');
    assert(getEffectivePermissions('player').editGeneral === true, 'Player keeps shared general editing');
    assert(getEffectivePermissions('spectator').editGeneral === false, 'Spectator remains read-only');
    assert(getEffectivePermissions('trusted-player').editOtherUser === false, 'Trusted Player cannot bypass Base Player deny by default');
    assert(canModifyEntity('trusted-player', 'user', 'other-player', 'local-player') === false, 'Trusted Player cannot edit other inventory without explicit override');
    assert(canBroadcastAudio('gm') === true, 'GM can broadcast audio');
    assert(canBroadcastAudio('player') === false, 'Player cannot broadcast audio by default');
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    process.exit(1);
}
