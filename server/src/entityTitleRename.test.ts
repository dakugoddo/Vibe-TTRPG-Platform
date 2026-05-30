import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openWorld } from './worldManager.js';
import { renameEntityFileToTitle } from './entityTitleRename.js';

function writeEntityFile(filePath: string, id: string, title: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, [
        '---',
        'type: character',
        'schemaVersion: 1',
        `id: "${id}"`,
        '---',
        '',
        `# ${title}`,
        '',
        'Body.',
        '',
    ].join('\n'), 'utf-8');
}

const worldPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-title-rename-'));

try {
    openWorld(worldPath);
    const charactersDir = path.join(worldPath, 'general', 'characters');
    const sourceFile = path.join(charactersDir, 'character.md');
    const sourceFolder = path.join(charactersDir, 'character');
    const childFile = path.join(sourceFolder, 'item.md');

    writeEntityFile(sourceFile, '20260524150000001', 'character');
    fs.mkdirSync(sourceFolder, { recursive: true });
    writeEntityFile(childFile, '20260524150000002', 'item');

    const dryRun = renameEntityFileToTitle('general', '20260524150000001', 'Кошка', undefined, { dryRun: true });
    assert.equal(dryRun.success, true);
    assert.equal(dryRun.dryRun, true);
    assert.equal(dryRun.changed, true);
    assert.equal(path.basename(dryRun.newFilePath), 'Кошка.md');
    assert.equal(path.basename(dryRun.newFolderPath ?? ''), 'Кошка');
    assert.equal(fs.existsSync(sourceFile), true, 'dry-run keeps source file in place');

    const applied = renameEntityFileToTitle('general', '20260524150000001', 'Кошка', undefined, { dryRun: false });
    assert.equal(applied.success, true);
    assert.equal(fs.existsSync(sourceFile), false, 'apply removes old source file');
    assert.equal(fs.existsSync(path.join(charactersDir, 'Кошка.md')), true, 'apply creates title file');
    assert.equal(fs.existsSync(path.join(charactersDir, 'Кошка')), true, 'apply renames child folder');
    assert.match(fs.readFileSync(path.join(charactersDir, 'Кошка.md'), 'utf-8'), /# Кошка/);
    assert.match(fs.readFileSync(path.join(charactersDir, 'Кошка.md'), 'utf-8'), /id: "20260524150000001"/);

    writeEntityFile(path.join(charactersDir, 'character.md'), '20260524150000003', 'character');
    const collision = renameEntityFileToTitle('general', '20260524150000003', 'Кошка', undefined, { dryRun: true });
    assert.equal(path.basename(collision.newFilePath), 'Кошка (1).md');

    writeEntityFile(path.join(charactersDir, 'cat.md'), '20260524150000004', 'Cat');
    const caseOnly = renameEntityFileToTitle('general', '20260524150000004', 'Cat', undefined, { dryRun: true });
    assert.equal(caseOnly.changed, true, 'case-only filename rename is treated as a change');
    assert.equal(path.basename(caseOnly.newFilePath), 'Cat.md');

    console.log('entityTitleRename tests passed');
} finally {
    fs.rmSync(worldPath, { recursive: true, force: true });
}
