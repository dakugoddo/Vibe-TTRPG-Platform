import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Entity } from '../../app/src/types.js';
import { readEntity, writeEntity } from './fileManager.js';
import { openWorld } from './worldManager.js';

function note(id: string, name: string, parentId: string | null = null): Entity {
  return {
    id,
    parentId,
    type: 'note',
    name,
    description: `# ${name}`,
    tags: [],
    properties: {},
    database: 'general',
  };
}

const worldPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-parent-move-'));

try {
  openWorld(worldPath);

  writeEntity('general', note('alpha-note', 'Alpha Note'));
  writeEntity('general', note('beta-note', 'Beta Note'));

  const betaBefore = readEntity('general', 'beta-note');
  assert.equal(betaBefore?.parentId, null);
  assert.equal(fs.existsSync(path.join(worldPath, 'general', 'notes', 'Beta Note.md')), true);

  writeEntity('general', note('beta-note', 'Beta Note', 'alpha-note'));

  const betaAfter = readEntity('general', 'beta-note');
  assert.equal(betaAfter?.parentId, 'alpha-note');
  assert.equal(fs.existsSync(path.join(worldPath, 'general', 'notes', 'Beta Note.md')), false);
  assert.equal(fs.existsSync(path.join(worldPath, 'general', 'notes', 'Alpha Note', 'Beta Note.md')), true);

  console.log('entity parent move tests passed');
} finally {
  fs.rmSync(worldPath, { recursive: true, force: true });
}
