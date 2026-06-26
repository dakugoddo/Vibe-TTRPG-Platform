/**
 * assetManager.test.ts
 *
 * Focused tests for server-side asset indexing and path safety.
 * Run with: npx tsx server/src/assetManager.test.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import {
    createAssetId,
    getAssetMime,
    getAssetType,
    listAssetRecords,
    normalizeAssetPath,
    resolveAssetPath,
} from './assetManager.js';

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

console.log('\nAssetManager Tests\n');

const tempRoot = path.resolve('.tmp');
fs.mkdirSync(tempRoot, { recursive: true });
const root = fs.mkdtempSync(path.join(tempRoot, 'vibe-assets-'));

try {
    fs.mkdirSync(path.join(root, 'music', 'sfx'), { recursive: true });
    fs.writeFileSync(path.join(root, 'portrait.png'), 'png');
    fs.writeFileSync(path.join(root, 'music', 'sfx', 'door.mp3'), 'mp3');
    fs.writeFileSync(path.join(root, 'rules.pdf'), 'pdf');
    fs.writeFileSync(path.join(root, '.ignored'), 'hidden');

    console.log('Test 1: Recursive stable asset index');
    {
        const records = listAssetRecords(root);
        const paths = records.map(record => record.path);
        const audio = records.find(record => record.path === 'music/sfx/door.mp3');

        assert(records.length === 3, 'Hidden files are skipped');
        assert(paths.includes('portrait.png'), 'Top-level asset is indexed');
        assert(paths.includes('music/sfx/door.mp3'), 'Nested asset is indexed');
        assert(paths.includes('rules.pdf'), 'PDF asset is indexed');
        assert(audio?.id === createAssetId('music/sfx/door.mp3'), 'Nested asset gets deterministic ID');
        assert(audio?.type === 'audio', 'Audio type is detected');
        assert(audio?.mime === 'audio/mpeg', 'Audio MIME is detected');
        assert(audio?.url === `/api/assets/file?path=${encodeURIComponent('music/sfx/door.mp3')}`, 'Asset URL uses path query');
    }

    console.log('\nTest 2: Type and MIME helpers');
    {
        assert(getAssetType('token.webp') === 'image', 'webp is image');
        assert(getAssetType('battlemap.glb') === 'model', 'glb is model');
        assert(getAssetType('clip.webm') === 'video', 'webm is video');
        assert(getAssetType('rules.pdf') === 'pdf', 'pdf is detected');
        assert(getAssetMime('clip.webm') === 'video/webm', 'webm MIME is known');
        assert(getAssetMime('rules.pdf') === 'application/pdf', 'pdf MIME is known');
        assert(getAssetMime('notes.bin') === 'application/octet-stream', 'Unknown MIME falls back');
    }

    console.log('\nTest 3: Path normalization and traversal safety');
    {
        const safePath = resolveAssetPath(root, 'music\\sfx\\door.mp3');

        assert(normalizeAssetPath('music\\sfx\\door.mp3') === 'music/sfx/door.mp3', 'Backslashes normalize to slash paths');
        assert(safePath === path.join(root, 'music', 'sfx', 'door.mp3'), 'Safe nested path resolves inside assets root');
        assert(resolveAssetPath(root, '../secret.txt') === null, 'Parent traversal is rejected');
        assert(resolveAssetPath(root, 'music/../secret.txt') === null, 'Inline traversal is rejected');
        assert(resolveAssetPath(root, '') === null, 'Empty path is rejected');
    }
} finally {
    fs.rmSync(root, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) {
    process.exit(1);
}
