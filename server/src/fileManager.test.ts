/**
 * fileManager.test.ts
 *
 * Focused server-side tests for .md Entity parsing/serialization.
 * Run with: npx tsx server/src/fileManager.test.ts
 */

import path from 'node:path';
import { parseEntityFile, serializeEntity } from './fileManager.js';
import { CURRENT_ENTITY_SCHEMA_VERSION } from './entitySchema.js';
import type { Entity } from './shared/types.js';

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

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

console.log('\nServer FileManager Tests\n');

console.log('Test 1: Legacy general entity without schemaVersion');
{
    const dbRoot = path.resolve('test-world/general');
    const filePath = path.join(dbRoot, 'characters', 'Старый Герой.md');
    const legacyMd = [
        '---',
        'type: character',
        'tags: [legacy, player]',
        'stats:',
        '  strength: 12',
        'resources:',
        '  hp: { max: 20, current: 8 }',
        '---',
        '',
        '# Старый Герой',
        '',
        'Файл создан до появления schemaVersion.',
    ].join('\n');

    const entity = parseEntityFile(legacyMd, 'fallback-id', dbRoot, filePath, 'general');

    assert(entity.id === 'Старый Герой', 'General DB uses title/name as id');
    assert(entity.schemaVersion === CURRENT_ENTITY_SCHEMA_VERSION, 'Missing schemaVersion normalizes to current');
    assert(entity.type === 'character', 'Type preserved');
    assert(entity.database === 'general', 'Database is preserved');
    assert(asRecord(entity.properties.strength).base === 12, 'Stat is preserved');
    assert(asRecord(entity.properties.hp).current === 8, 'Resource current is preserved');

    const migratedMd = serializeEntity(entity);
    assert(migratedMd.includes(`schemaVersion: ${CURRENT_ENTITY_SCHEMA_VERSION}`), 'Serialized legacy entity writes schemaVersion');
}

console.log('\nTest 2: Legacy user entity keeps uid');
{
    const dbRoot = path.resolve('test-world/users/player-one');
    const filePath = path.join(dbRoot, 'objects', 'Зелье.md');
    const legacyMd = [
        '---',
        'type: object',
        'uid: item-001',
        'tags: [consumable]',
        'properties:',
        '  charges: 2',
        '---',
        '',
        '# Зелье',
        '',
        'Старый предмет в пользовательской базе.',
    ].join('\n');

    const entity = parseEntityFile(legacyMd, 'fallback-id', dbRoot, filePath, 'user');

    assert(entity.id === 'item-001', 'User DB keeps uid as id');
    assert(entity.schemaVersion === CURRENT_ENTITY_SCHEMA_VERSION, 'User legacy entity normalizes schemaVersion');
    assert(entity.database === 'user', 'User database is preserved');
    assert(entity.properties.charges === 2, 'Generic properties are preserved');

    const migratedMd = serializeEntity(entity, { includeUid: true });
    assert(migratedMd.includes('uid: item-001'), 'Serialized user entity keeps uid');
    assert(migratedMd.includes(`schemaVersion: ${CURRENT_ENTITY_SCHEMA_VERSION}`), 'Serialized user entity writes schemaVersion');
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    process.exit(1);
}
