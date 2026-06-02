import assert from 'node:assert/strict';
import {
    getScreenWindowLayoutBounds,
    getWindowCascadeLayoutRects,
    getWindowGridLayoutRects,
    getWindowLayoutRect,
} from './windowLayout';

const bounds = getScreenWindowLayoutBounds(1200, 800);
const left = getWindowLayoutRect('left', bounds);
const right = getWindowLayoutRect('right', bounds);
const center = getWindowLayoutRect('center', bounds);

assert.equal(left.x, bounds.x);
assert.ok(right.x > left.x);
assert.ok(center.x > left.x && center.x < right.x);
assert.ok(left.width >= 300);
assert.ok(left.height <= bounds.height);

const grid = getWindowGridLayoutRects(4, bounds);
assert.equal(grid.length, 4);
for (const rect of grid) {
    assert.ok(rect.x >= bounds.x);
    assert.ok(rect.y >= bounds.y);
    assert.ok(rect.x + rect.width <= bounds.x + bounds.width);
    assert.ok(rect.y + rect.height <= bounds.y + bounds.height);
}

const cascade = getWindowCascadeLayoutRects(3, bounds);
assert.equal(cascade.length, 3);
assert.ok(cascade[1].x > cascade[0].x);
assert.ok(cascade[2].y > cascade[1].y);

console.log('window layout tests passed');
