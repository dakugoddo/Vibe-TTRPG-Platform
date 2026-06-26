import { strict as assert } from 'node:assert';
import { buildExplorerRevealArgs } from './explorer.js';

const filePath = 'C:\\StableDiffusion\\Vibe TTRPG Platform\\general\\characters\\Кошка.md';
assert.deepEqual(buildExplorerRevealArgs(filePath), ['/select,', filePath]);

console.log('explorer tests passed');
