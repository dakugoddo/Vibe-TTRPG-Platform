import { strict as assert } from 'node:assert';
import type { Entity } from '../types';
import type { DrawElement } from '../types/canvasTypes';
import { normalizeDrawElementsForSharedSync, sanitizeCanvasEntityForSharedSync, sanitizeDrawElementForSharedSync } from './canvasPersistence';

const baseImage: DrawElement = {
    id: 'image_1',
    type: 'image',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    stroke: '#fff',
    strokeWidth: 1,
    strokeStyle: 'solid',
    opacity: 1,
    startCap: 'none',
    endCap: 'none',
    zIndex: 0,
};

const smallInline = 'data:image/png;base64,aGVsbG8=';
const largeInline = `data:image/png;base64,${'a'.repeat(90 * 1024)}`;

assert.equal(sanitizeDrawElementForSharedSync({
    ...baseImage,
    imageUrl: smallInline,
}).imageUrl, smallInline);

assert.equal(sanitizeDrawElementForSharedSync({
    ...baseImage,
    imageUrl: smallInline,
    imageAssetPath: 'canvas/image.png',
}).imageUrl, undefined);

assert.equal(sanitizeDrawElementForSharedSync({
    ...baseImage,
    imageUrl: largeInline,
}).imageUrl, undefined);

const canvasEntity: Entity = {
    id: 'canvas_1',
    parentId: null,
    type: 'canvas',
    name: 'Canvas',
    description: '',
    properties: {
        drawElements: [{ ...baseImage, imageUrl: largeInline }],
    },
    tags: [],
};

const sanitizedEntity = sanitizeCanvasEntityForSharedSync(canvasEntity);
const drawElements = sanitizedEntity.properties.drawElements;
assert(Array.isArray(drawElements));
assert.equal(drawElements[0].imageUrl, undefined);

const normalizedOrder = normalizeDrawElementsForSharedSync([
    { ...baseImage, id: 'b', zIndex: 2 },
    { ...baseImage, id: 'a', zIndex: 1 },
    { ...baseImage, id: 'c', zIndex: 2 },
]);
assert.deepEqual(normalizedOrder.map((element) => element.id), ['a', 'b', 'c']);
