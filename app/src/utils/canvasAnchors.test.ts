import { strict as assert } from 'node:assert';
import type { DrawElement } from '../types/canvasTypes';
import { findNearestCanvasAnchor, getCanvasAnchorPoints, updateBoundLineEndpoints } from './canvasAnchors';

function element(partial: Partial<DrawElement>): DrawElement {
  return {
    id: partial.id || 'shape_1',
    type: partial.type || 'rectangle',
    x: partial.x ?? 100,
    y: partial.y ?? 80,
    width: partial.width ?? 120,
    height: partial.height ?? 60,
    stroke: '#fff',
    strokeWidth: 1,
    strokeStyle: 'solid',
    opacity: 1,
    startCap: 'none',
    endCap: 'none',
    zIndex: 0,
    ...partial,
  };
}

const rect = element({ id: 'rect_1' });
const anchors = getCanvasAnchorPoints(rect);
assert.equal(anchors.length, 9);
assert.deepEqual(
  anchors.find((anchor) => anchor.id === 'top'),
  { id: 'top', elementId: 'rect_1', elementType: 'rectangle', x: 160, y: 80 }
);
assert.deepEqual(
  anchors.find((anchor) => anchor.id === 'left'),
  { id: 'left', elementId: 'rect_1', elementType: 'rectangle', x: 100, y: 110 }
);

const nearest = findNearestCanvasAnchor({ x: 162, y: 78 }, [rect], { radius: 8 });
assert(nearest, 'near top anchor should snap');
assert.equal(nearest.anchor.id, 'top');
assert.deepEqual(nearest.point, { x: 162, y: 80 });

const edgeNearest = findNearestCanvasAnchor({ x: 130, y: 83 }, [rect], { radius: 8 });
assert(edgeNearest, 'near top edge should snap');
assert.equal(edgeNearest.anchor.id, 'top');
assert.equal(edgeNearest.anchor.focus, 0.25);
assert.deepEqual(edgeNearest.point, { x: 130, y: 80 });

const outside = findNearestCanvasAnchor({ x: 162, y: 60 }, [rect], { radius: 8 });
assert.equal(outside, null);

const excluded = findNearestCanvasAnchor({ x: 162, y: 78 }, [rect], { radius: 8, excludeIds: ['rect_1'] });
assert.equal(excluded, null);

const line = element({ id: 'line_1', type: 'line', points: [0, 0, 10, 10] });
assert.equal(getCanvasAnchorPoints(line).length, 0);

const negative = element({ id: 'negative_1', x: 200, y: 200, width: -100, height: -60 });
const negativeCenter = getCanvasAnchorPoints(negative).find((anchor) => anchor.id === 'center');
assert.deepEqual(negativeCenter, { id: 'center', elementId: 'negative_1', elementType: 'rectangle', x: 150, y: 170 });

const boundLine = element({
  id: 'bound_line',
  type: 'line',
  points: [0, 0, 10, 10],
  startBinding: { elementId: 'rect_1', anchor: 'left' },
  endBinding: { elementId: 'rect_1', anchor: 'bottomRight' },
});
const updated = updateBoundLineEndpoints([rect, boundLine], ['rect_1']);
const updatedLine = updated.find((item) => item.id === 'bound_line');
assert(updatedLine?.points);
assert.deepEqual(updatedLine.points, [100, 110, 220, 140]);

const unchanged = updateBoundLineEndpoints(updated, ['other']);
assert.equal(unchanged, updated, 'returns same array when moved IDs do not affect bindings');

const focusedLine = element({
  id: 'focused_line',
  type: 'line',
  points: [0, 0, 10, 10],
  startBinding: { elementId: 'rect_1', anchor: 'top', focus: 0.25 },
});
const focusedUpdated = updateBoundLineEndpoints([rect, focusedLine], ['rect_1']);
const updatedFocusedLine = focusedUpdated.find((item) => item.id === 'focused_line');
assert.deepEqual(updatedFocusedLine?.points, [130, 80, 10, 10]);

console.log('ok - canvas anchors and nearest snap');
