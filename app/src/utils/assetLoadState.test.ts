import assert from 'node:assert/strict';
import { appendAssetRetryParam } from './assetLoadState';

assert.equal(
    appendAssetRetryParam('http://localhost:3001/api/assets/file?path=maps%2Fmap.png', 2),
    'http://localhost:3001/api/assets/file?path=maps%2Fmap.png&retry=2'
);

assert.equal(
    appendAssetRetryParam('/api/assets/file?path=maps%2Fmap.png', 3),
    'http://localhost/api/assets/file?path=maps%2Fmap.png&retry=3'
);

assert.equal(
    appendAssetRetryParam('portraits/hero.png', 4),
    'http://localhost/portraits/hero.png?retry=4'
);

assert.equal(
    appendAssetRetryParam('data:image/png;base64,abc', 5),
    'data:image/png;base64,abc'
);

assert.equal(
    appendAssetRetryParam('http://localhost:3001/api/assets/file?path=maps%2Fmap.png', 0),
    'http://localhost:3001/api/assets/file?path=maps%2Fmap.png'
);

console.log('asset load state tests passed');
