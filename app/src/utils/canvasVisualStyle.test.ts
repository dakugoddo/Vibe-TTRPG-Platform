import assert from 'node:assert/strict';
import {
  getCanvasVisualStyleConfig,
  getJitteredLinePoints,
  getVisualStyleOffset,
} from './canvasVisualStyle';

const clean = getCanvasVisualStyleConfig('clean');
assert.equal(clean.id, 'clean');
assert.equal(clean.sketchJitter, 0);

const fallback = getCanvasVisualStyleConfig(undefined);
assert.equal(fallback.id, 'clean');

const points = [0, 0, 100, 50, 120, 80];
const jittered = getJitteredLinePoints(points, 'line-a', 1.4);
assert.deepEqual(getJitteredLinePoints(points, 'line-a', 1.4), jittered);
assert.notDeepEqual(jittered, points);
assert.deepEqual(getJitteredLinePoints(points, 'line-a', 0), points);

const offset = getVisualStyleOffset('rect-a', 'stroke', 1.4);
assert.deepEqual(getVisualStyleOffset('rect-a', 'stroke', 1.4), offset);
assert.notDeepEqual(offset, { x: 0, y: 0 });
assert.deepEqual(getVisualStyleOffset('rect-a', 'stroke', 0), { x: 0, y: 0 });

console.log('canvasVisualStyle tests passed');
