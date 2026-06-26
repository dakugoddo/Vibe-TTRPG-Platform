import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    claimPlayerProfile,
    listPlayerProfiles,
    normalizePlayerDisplayName,
    sanitizePlayerStorageRoot,
    updatePlayerProfileRole,
} from './playerProfiles.js';

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

console.log('\nPlayer Profile Tests\n');

const worldPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-player-profiles-'));

try {
    console.log('Test 1: display names and storage roots are normalized');
    {
        assert(normalizePlayerDisplayName('  Вася   Пупкин  ') === 'Вася Пупкин', 'Display name whitespace is collapsed');
        assert(sanitizePlayerStorageRoot('Alice:Wizard?') === 'Alice_Wizard_', 'Windows-unsafe storage characters are replaced');
    }

    console.log('\nTest 2: new player claim creates profile and user storage');
    {
        const profile = claimPlayerProfile(worldPath, 'Вася', { requestedPlayerId: 'player_local' });
        assert(profile.playerId === 'player_local', 'Safe requested player id is accepted for first claim');
        assert(profile.displayName === 'Вася', 'Profile keeps display name');
        assert(profile.assignedRole === 'player', 'New profile starts as Player');
        assert(fs.existsSync(path.join(worldPath, 'users', profile.storageRoot)), 'User storage folder is created');
    }

    console.log('\nTest 3: same name restores the same profile');
    {
        const first = claimPlayerProfile(worldPath, 'Вася');
        const second = claimPlayerProfile(worldPath, '  вася  ');
        assert(first.playerId === second.playerId, 'Case-insensitive name lookup restores profile');
        assert(second.lastSeenAt !== undefined, 'Restored profile records lastSeenAt');
    }

    console.log('\nTest 4: role updates are persisted for non-GM player roles');
    {
        const profile = claimPlayerProfile(worldPath, 'Петя');
        const updated = updatePlayerProfileRole(worldPath, profile.playerId, 'spectator');
        const listed = listPlayerProfiles(worldPath).find((candidate) => candidate.playerId === profile.playerId);
        assert(updated.assignedRole === 'spectator', 'Role update returns updated profile');
        assert(listed?.assignedRole === 'spectator', 'Role update persists to disk');

        let rejected = false;
        try {
            updatePlayerProfileRole(worldPath, profile.playerId, 'gm');
        } catch {
            rejected = true;
        }
        assert(rejected, 'GM assignment is rejected for player profiles');
    }

    console.log('\nTest 5: legacy user folders are visible until claimed');
    {
        fs.mkdirSync(path.join(worldPath, 'users', 'Old Player'), { recursive: true });
        fs.mkdirSync(path.join(worldPath, 'users', 'Alice_Wizard_'), { recursive: true });
        const beforeClaim = listPlayerProfiles(worldPath).filter((profile) => profile.displayName === 'Old Player');
        assert(beforeClaim.length === 1 && beforeClaim[0].legacy === true, 'Legacy folder is surfaced as a legacy profile');

        const claimed = claimPlayerProfile(worldPath, 'Old Player');
        const sanitizedCollision = claimPlayerProfile(worldPath, 'Alice:Wizard?');
        const afterClaim = listPlayerProfiles(worldPath).filter((profile) => profile.displayName === 'Old Player');
        assert(claimed.storageRoot === 'Old Player', 'Claimed legacy folder keeps existing storage root');
        assert(sanitizedCollision.storageRoot !== 'Alice_Wizard_', 'Sanitized storage collision gets a unique folder');
        assert(afterClaim.length === 1 && afterClaim[0].legacy !== true, 'Legacy duplicate disappears after claim');
    }
} finally {
    fs.rmSync(worldPath, { recursive: true, force: true });
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    process.exit(1);
}
