import assert from 'node:assert/strict';
import { fitEntityArtSizeToImage } from './entityTokenSizing';

assert.deepEqual(
  fitEntityArtSizeToImage({ width: 220, height: 150 }, { width: 1600, height: 900 }),
  { width: 220, height: 124 }
);

assert.deepEqual(
  fitEntityArtSizeToImage({ width: 220, height: 150 }, { width: 900, height: 1600 }),
  { width: 220, height: 391 }
);

assert.deepEqual(
  fitEntityArtSizeToImage({ width: 2, height: 2 }, { width: 800, height: 400 }),
  { width: 128, height: 64 }
);

assert.deepEqual(
  fitEntityArtSizeToImage({ width: 220, height: 150 }, { width: 0, height: 400 }),
  { width: 220, height: 150 }
);

assert.deepEqual(
  fitEntityArtSizeToImage({ width: 1800, height: 150 }, { width: 600, height: 600 }),
  { width: 1200, height: 1200 }
);

console.log('entityTokenSizing tests passed');
