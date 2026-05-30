import { strict as assert } from 'node:assert';
import { isAnimatedGifSource } from './imageSource';

assert.equal(isAnimatedGifSource('giphy.gif'), true);
assert.equal(isAnimatedGifSource('/assets/GIPHY.GIF'), true);
assert.equal(isAnimatedGifSource('http://localhost:3001/api/assets/file?path=giphy.gif'), true);
assert.equal(isAnimatedGifSource('http://localhost:3001/api/assets/file?path=folder%2Fgiphy.gif'), true);
assert.equal(isAnimatedGifSource('data:image/gif;base64,R0lGODlh'), true);
assert.equal(isAnimatedGifSource('cat.png'), false);
assert.equal(isAnimatedGifSource('http://localhost:3001/api/assets/file?path=cat.png'), false);

console.log('imageSource tests passed');
