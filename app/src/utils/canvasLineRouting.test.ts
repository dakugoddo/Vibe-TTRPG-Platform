import assert from 'node:assert/strict';
import {
  findEditableLinePointNear,
  getLineMode,
  getLineTension,
  getRoutedLinePoints,
  insertLinePointAtClosestSegment,
  removeLinePointAtIndex,
} from './canvasLineRouting';

assert.equal(getLineMode(undefined, 2), 'straight');
assert.equal(getLineMode(undefined, 3), 'curved');
assert.equal(getLineMode('elbow', 2), 'elbow');

assert.deepEqual(
  getRoutedLinePoints([0, 0, 100, 80], 'elbow'),
  [0, 0, 50, 0, 50, 80, 100, 80]
);

assert.deepEqual(
  getRoutedLinePoints([0, 0, 100, 0], 'elbow'),
  [0, 0, 50, 0, 100, 0]
);

const curved = [0, 0, 50, 50, 100, 0];
assert.deepEqual(getRoutedLinePoints(curved, 'curved'), curved);
assert.equal(getLineTension(curved, 'curved'), 0.35);
assert.equal(getLineTension(curved, 'straight'), 0);
assert.equal(getLineTension(curved, 'elbow'), 0);

assert.deepEqual(
  getRoutedLinePoints([0, 0, 100, 0], 'curved'),
  [0, 0, 100, 0]
);
assert.equal(getLineTension([0, 0, 100, 0], 'curved'), 0);

assert.deepEqual(
  insertLinePointAtClosestSegment([0, 0, 100, 0], { x: 40, y: 20 }),
  [0, 0, 40, 20, 100, 0]
);

assert.deepEqual(
  insertLinePointAtClosestSegment([0, 0, 100, 0, 100, 100], { x: 110, y: 40 }),
  [0, 0, 100, 0, 110, 40, 100, 100]
);

assert.deepEqual(removeLinePointAtIndex([0, 0, 50, 50, 100, 0], 1), [0, 0, 100, 0]);
assert.deepEqual(removeLinePointAtIndex([0, 0, 50, 50, 100, 0], 0), [0, 0, 50, 50, 100, 0]);
assert.deepEqual(removeLinePointAtIndex([0, 0, 50, 50, 100, 0], 2), [0, 0, 50, 50, 100, 0]);

assert.equal(findEditableLinePointNear([0, 0, 50, 50, 100, 0], { x: 52, y: 47 }, 6), 1);
assert.equal(findEditableLinePointNear([0, 0, 50, 50, 100, 0], { x: 75, y: 75 }, 6), null);
assert.equal(findEditableLinePointNear([0, 0, 100, 0], { x: 0, y: 0 }, 10), null);

console.log('canvasLineRouting tests passed');
