import { strict as assert } from 'node:assert';
import type { Entity } from '../types';
import type { DrawElement } from '../types/canvasTypes';
import {
    CANVAS_WINDOW_INSTANCES_PROPERTY,
    normalizeDrawElementsForSharedSync,
    readCanvasWindowInstances,
    removeCanvasWindowInstance,
    sanitizeCanvasEntityForSharedSync,
    sanitizeDrawElementForSharedSync,
    upsertCanvasWindowInstance,
} from './canvasPersistence';

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
        canvasWindowInstances: [
            {
                id: 'win_b',
                entityId: 'character_1',
                mode: 'compact',
                x: 120,
                y: 80,
                width: 420,
                height: 360,
                zIndex: 2,
            },
        ],
    },
    tags: [],
};

const sanitizedEntity = sanitizeCanvasEntityForSharedSync(canvasEntity);
const drawElements = sanitizedEntity.properties.drawElements;
assert(Array.isArray(drawElements));
assert.equal(drawElements[0].imageUrl, undefined);
assert(Array.isArray(sanitizedEntity.properties[CANVAS_WINDOW_INSTANCES_PROPERTY]));

const normalizedOrder = normalizeDrawElementsForSharedSync([
    { ...baseImage, id: 'b', zIndex: 2 },
    { ...baseImage, id: 'a', zIndex: 1 },
    { ...baseImage, id: 'c', zIndex: 2 },
]);
assert.deepEqual(normalizedOrder.map((element) => element.id), ['a', 'b', 'c']);

const rawCanvasWindows = readCanvasWindowInstances({
    canvasWindowInstances: [
        { id: 'bad', entityId: 'entity_1', mode: 'compact', x: 0 },
        { id: 'b', entityId: 'entity_1', mode: 'compact', x: 20, y: 10, width: 300, height: 220, zIndex: 2 },
        { id: 'a', entityId: 'entity_1', mode: 'icon', x: 10, y: 10, width: 64, height: 64, zIndex: 1 },
    ],
});
assert.deepEqual(rawCanvasWindows.map((instance) => instance.id), ['a', 'b']);

const withUpsert = upsertCanvasWindowInstance(rawCanvasWindows, {
    id: 'a',
    entityId: 'entity_1',
    mode: 'full',
    x: 12,
    y: 14,
    width: 500,
    height: 520,
    zIndex: 3,
});
assert.equal(withUpsert.length, 2);
assert.equal(withUpsert.find((instance) => instance.id === 'a')?.mode, 'full');

const withAddedCopy = upsertCanvasWindowInstance(withUpsert, {
    id: 'c',
    entityId: 'entity_1',
    mode: 'compact',
    x: 42,
    y: 44,
    width: 380,
    height: 280,
    zIndex: 4,
});
assert.equal(withAddedCopy.filter((instance) => instance.entityId === 'entity_1').length, 3);
assert.equal(removeCanvasWindowInstance(withAddedCopy, 'b').some((instance) => instance.id === 'b'), false);
