import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    readWorldSheetFile,
    resetWorldSheetFile,
    rollbackWorldSheetFile,
    writeWorldSheetFile,
} from './worldSheetManager.js';

const worldPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-world-sheet-'));
const baseSchema = {
    schemaVersion: 1,
    id: 'custom-note',
    name: 'Custom note',
    revision: 1,
    status: 'published',
    entityTypes: ['note'],
    density: 'inherit',
    root: {
        id: 'root',
        type: 'container',
        layout: 'column',
        children: [{
            id: 'description',
            type: 'markdown',
            binding: { scope: 'self', path: ['description'] },
        }],
    },
};

try {
    assert.throws(() => readWorldSheetFile(worldPath, '../note'), /Invalid sheet id/);

    const first = writeWorldSheetFile(worldPath, 'note', baseSchema);
    assert.equal(first.exists, true);
    assert.equal(first.backupCreated, false);
    assert.equal(first.hasBackup, false);
    assert.deepEqual(first.schema, baseSchema);
    assert.equal(fs.existsSync(path.join(worldPath, '.vibe', 'sheets', 'note.json')), true);

    const updatedSchema = { ...baseSchema, revision: 2, name: 'Updated note' };
    const second = writeWorldSheetFile(worldPath, 'note', updatedSchema);
    assert.equal(second.backupCreated, true);
    assert.equal(second.hasBackup, true);
    assert.equal(second.schema?.revision, 2);

    const restored = rollbackWorldSheetFile(worldPath, 'note');
    assert.equal(restored.restored, true);
    assert.equal(restored.schema?.revision, 1);
    assert.equal(JSON.parse(fs.readFileSync(path.join(worldPath, '.vibe', 'sheets', 'note.json.bak'), 'utf-8')).revision, 1);

    const reset = resetWorldSheetFile(worldPath, 'note');
    assert.equal(reset.exists, false);
    assert.equal(reset.reset, true);
    assert.equal(reset.hasBackup, true);
    assert.equal(fs.existsSync(path.join(worldPath, '.vibe', 'sheets', 'note.json')), false);

    const restoredAfterReset = rollbackWorldSheetFile(worldPath, 'note');
    assert.equal(restoredAfterReset.exists, true);
    assert.equal(restoredAfterReset.schema?.revision, 1);

    const symlinkWorldPath = path.join(worldPath, 'symlink-world');
    const externalSheetDir = path.join(worldPath, 'external-sheets');
    fs.mkdirSync(symlinkWorldPath, { recursive: true });
    fs.mkdirSync(externalSheetDir, { recursive: true });
    fs.symlinkSync(externalSheetDir, path.join(symlinkWorldPath, '.vibe'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(
        () => writeWorldSheetFile(symlinkWorldPath, 'note', baseSchema),
        /symbolic link or junction/
    );

    assert.throws(
        () => writeWorldSheetFile(worldPath, 'note', { ...baseSchema, entityTypes: ['object'] }),
        /must target entity type: note/
    );
    assert.throws(
        () => writeWorldSheetFile(worldPath, 'note', { ...baseSchema, entityTypes: ['note', 'unknown'] }),
        /using valid entity types/
    );
    const parityWorldPath = path.join(worldPath, 'parity');
    const parityResult = writeWorldSheetFile(parityWorldPath, 'note', {
        ...baseSchema,
        ignoredTopLevel: 'strip-me',
        root: {
            ...baseSchema.root,
            gap: ['sm'],
            columns: '2',
            permission: ['view'],
            surface: ['raised'],
            ignoredRootField: true,
            children: [{
                id: 'all-properties',
                type: 'property-value',
                format: ['text'],
                permission: ['edit'],
                surface: ['sunken'],
                ignoredBlockField: true,
                binding: { scope: 'self', path: ['properties'] },
            }],
        },
    });
    assert.equal('ignoredTopLevel' in (parityResult.schema ?? {}), false);
    const parityRoot = parityResult.schema?.root as Record<string, unknown>;
    assert.equal('ignoredRootField' in parityRoot, false);
    assert.equal('gap' in parityRoot, false);
    assert.equal('columns' in parityRoot, false);
    assert.equal('permission' in parityRoot, false);
    assert.equal('surface' in parityRoot, false);
    const parityChild = (parityRoot.children as Record<string, unknown>[])[0];
    assert.equal('format' in parityChild, false);
    assert.equal('permission' in parityChild, false);
    assert.equal('surface' in parityChild, false);
    assert.throws(
        () => writeWorldSheetFile(parityWorldPath, 'note', { ...baseSchema, density: ['inherit'] }),
        /density is invalid/
    );
    assert.throws(
        () => writeWorldSheetFile(parityWorldPath, 'note', { ...baseSchema, root: { ...baseSchema.root, layout: ['column'] } }),
        /valid layout/
    );
    assert.throws(
        () => writeWorldSheetFile(parityWorldPath, 'note', { ...baseSchema, ignored: 'x'.repeat(300_000) }),
        /exceeds 262144 bytes/
    );
    const prettyExpandedSchema = {
        ...baseSchema,
        root: {
            ...baseSchema.root,
            children: Array.from({ length: 499 }, (_, index) => ({
                id: `pretty-${index}`,
                type: 'markdown',
                label: 'x'.repeat(320),
                binding: { scope: 'self', path: ['description'] },
            })),
        },
    };
    assert.ok(Buffer.byteLength(JSON.stringify(prettyExpandedSchema)) <= 256 * 1024);
    assert.ok(Buffer.byteLength(`${JSON.stringify(prettyExpandedSchema, null, 2)}\n`) > 256 * 1024);
    assert.throws(
        () => writeWorldSheetFile(parityWorldPath, 'note', prettyExpandedSchema),
        /exceeds 262144 bytes/
    );
    assert.throws(
        () => writeWorldSheetFile(parityWorldPath, 'note', { ...baseSchema, entityTypes: Array.from({ length: 11 }, () => 'note') }),
        /using valid entity types/
    );
    assert.throws(
        () => writeWorldSheetFile(parityWorldPath, 'note', {
            ...baseSchema,
            root: {
                ...baseSchema.root,
                children: [
                    { id: ' duplicate ', type: 'markdown', binding: { scope: 'self', path: ['description'] } },
                    { id: 'duplicate', type: 'markdown', binding: { scope: 'self', path: ['description'] } },
                ],
            },
        }),
        /Duplicate sheet block id: duplicate/
    );
    assert.throws(
        () => writeWorldSheetFile(parityWorldPath, 'note', {
            ...baseSchema,
            root: {
                ...baseSchema.root,
                children: [{ id: 'empty-segment', type: 'property-value', binding: { scope: 'self', path: ['properties', ''] } }],
            },
        }),
        /Unsafe sheet binding path/
    );
    const oversizedWorldPath = path.join(worldPath, 'oversized');
    const oversizedSheetPath = path.join(oversizedWorldPath, '.vibe', 'sheets', 'note.json');
    fs.mkdirSync(path.dirname(oversizedSheetPath), { recursive: true });
    fs.writeFileSync(oversizedSheetPath, 'x'.repeat(300_000), 'utf-8');
    const oversizedRead = readWorldSheetFile(oversizedWorldPath, 'note');
    assert.equal(oversizedRead.schema, null);
    assert.match(oversizedRead.diagnostics[0]?.message ?? '', /exceeds 262144 bytes/);
    assert.throws(
        () => writeWorldSheetFile(worldPath, 'note', {
            ...baseSchema,
            root: { ...baseSchema.root, children: [{ id: 'bad', type: 'script' }] },
        }),
        /Unknown sheet block type: script/
    );
    assert.throws(
        () => writeWorldSheetFile(worldPath, 'note', {
            ...baseSchema,
            root: {
                ...baseSchema.root,
                children: [{ id: 'bad-binding', type: 'markdown', binding: { scope: 'self', path: ['__proto__'] } }],
            },
        }),
        /Unsafe sheet binding path/
    );

    const sheetPath = path.join(worldPath, '.vibe', 'sheets', 'note.json');
    const backupPath = `${sheetPath}.bak`;
    writeWorldSheetFile(worldPath, 'note', updatedSchema);
    const activeBeforeWriteFailure = fs.readFileSync(sheetPath, 'utf-8');
    const backupBeforeWriteFailure = fs.readFileSync(backupPath, 'utf-8');
    const originalRenameSync = fs.renameSync;
    let failActiveRename = true;
    fs.renameSync = ((oldPath, newPath) => {
        if (failActiveRename && String(newPath) === sheetPath) {
            failActiveRename = false;
            throw new Error('injected active rename failure');
        }
        return originalRenameSync(oldPath, newPath);
    }) as typeof fs.renameSync;
    try {
        assert.throws(
            () => writeWorldSheetFile(worldPath, 'note', { ...updatedSchema, revision: 3 }),
            /injected active rename failure/
        );
    } finally {
        fs.renameSync = originalRenameSync;
    }
    assert.equal(fs.readFileSync(sheetPath, 'utf-8'), activeBeforeWriteFailure);
    assert.equal(fs.readFileSync(backupPath, 'utf-8'), backupBeforeWriteFailure);

    const originalRmSync = fs.rmSync;
    fs.rmSync = ((targetPath, options) => {
        if (String(targetPath) === sheetPath) throw new Error('injected active reset failure');
        return originalRmSync(targetPath, options as never);
    }) as typeof fs.rmSync;
    try {
        assert.throws(() => resetWorldSheetFile(worldPath, 'note'), /injected active reset failure/);
    } finally {
        fs.rmSync = originalRmSync;
    }
    assert.equal(fs.readFileSync(sheetPath, 'utf-8'), activeBeforeWriteFailure);
    assert.equal(fs.readFileSync(backupPath, 'utf-8'), backupBeforeWriteFailure);

    const activeBeforeBadBackup = fs.readFileSync(sheetPath, 'utf-8');
    fs.writeFileSync(backupPath, '{}\n', 'utf-8');
    assert.throws(() => rollbackWorldSheetFile(worldPath, 'note'), /schemaVersion must be 1/);
    assert.equal(fs.readFileSync(sheetPath, 'utf-8'), activeBeforeBadBackup);

    const knownGoodBackup = `${JSON.stringify(baseSchema, null, 2)}\n`;
    fs.writeFileSync(backupPath, knownGoodBackup, 'utf-8');
    fs.writeFileSync(sheetPath, '{}\n', 'utf-8');
    const repaired = writeWorldSheetFile(worldPath, 'note', updatedSchema);
    assert.equal(repaired.schema?.revision, 2);
    assert.equal(repaired.backupCreated, false);
    assert.equal(fs.readFileSync(backupPath, 'utf-8'), knownGoodBackup);

    fs.writeFileSync(sheetPath, '{}\n', 'utf-8');
    const resetMalformedActive = resetWorldSheetFile(worldPath, 'note');
    assert.equal(resetMalformedActive.exists, false);
    assert.equal(fs.readFileSync(backupPath, 'utf-8'), knownGoodBackup);
    assert.equal(rollbackWorldSheetFile(worldPath, 'note').schema?.revision, 1);

    console.log('world sheet manager tests passed');
} finally {
    fs.rmSync(worldPath, { recursive: true, force: true });
}
