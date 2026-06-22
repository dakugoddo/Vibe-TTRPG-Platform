import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    isWorldLocaleId,
    listWorldLocaleFiles,
    readWorldLocaleFile,
    resolveWorldLocalePath,
} from './worldLocaleManager.js';

const worldPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-world-locales-'));

try {
    fs.mkdirSync(path.join(worldPath, 'locales'), { recursive: true });
    fs.writeFileSync(path.join(worldPath, 'locales', 'ru.json'), JSON.stringify({ 'settings.tabs.audio': 'Звук' }), 'utf-8');
    fs.writeFileSync(path.join(worldPath, 'locales', 'en-US.json'), JSON.stringify({ 'assetBrowser.filters.pdf': 'Books' }), 'utf-8');
    fs.writeFileSync(path.join(worldPath, 'locales', 'bad_locale.json'), '{}', 'utf-8');
    fs.writeFileSync(path.join(worldPath, 'locales', 'fr.json'), '{', 'utf-8');
    fs.writeFileSync(path.join(worldPath, 'locales', 'de.json'), '[]', 'utf-8');

    assert.equal(isWorldLocaleId('ru'), true);
    assert.equal(isWorldLocaleId('en-US'), true);
    assert.equal(isWorldLocaleId('../ru'), false);
    assert.equal(isWorldLocaleId('bad_locale'), false);

    assert.equal(resolveWorldLocalePath(worldPath, 'ru'), path.join(worldPath, 'locales', 'ru.json'));
    assert.throws(() => resolveWorldLocalePath(worldPath, '../ru'), /Invalid locale id/);

    const files = listWorldLocaleFiles(worldPath);
    assert.deepEqual(files.map(file => file.locale), ['de', 'en-US', 'fr', 'ru']);

    const ru = readWorldLocaleFile(worldPath, 'ru');
    assert.equal(ru.exists, true);
    assert.equal(ru.overrides['settings.tabs.audio'], 'Звук');
    assert.deepEqual(ru.diagnostics, []);

    const missing = readWorldLocaleFile(worldPath, 'en');
    assert.equal(missing.exists, false);
    assert.deepEqual(missing.overrides, {});

    const broken = readWorldLocaleFile(worldPath, 'fr');
    assert.equal(broken.exists, true);
    assert.equal(broken.diagnostics[0]?.level, 'error');

    const array = readWorldLocaleFile(worldPath, 'de');
    assert.equal(array.exists, true);
    assert.equal(array.diagnostics[0]?.message, 'Locale file must be a JSON object.');
} finally {
    fs.rmSync(worldPath, { recursive: true, force: true });
}

console.log('world locale manager tests passed');
