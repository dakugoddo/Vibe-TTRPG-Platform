import { strict as assert } from 'node:assert';
import type { Entity } from '../types';
import { findCanvasInlineImages, replaceInlineCanvasImage } from './canvasInlineImageMigration';

const inlinePng = 'data:image/png;base64,aGVsbG8=';

const canvasEntity: Entity = {
    id: 'canvas_1',
    parentId: null,
    type: 'canvas',
    name: 'Тестовый Canvas',
    description: '',
    properties: {
        drawElements: [
            {
                id: 'image_1',
                type: 'image',
                x: 10,
                y: 20,
                width: 120,
                height: 80,
                stroke: '#ffffff',
                strokeWidth: 1,
                strokeStyle: 'solid',
                opacity: 1,
                startCap: 'none',
                endCap: 'none',
                zIndex: 0,
                objectName: 'Меха арт',
                imageUrl: inlinePng,
            },
            {
                id: 'image_2',
                type: 'image',
                x: 20,
                y: 40,
                width: 120,
                height: 80,
                stroke: '#ffffff',
                strokeWidth: 1,
                strokeStyle: 'solid',
                opacity: 1,
                startCap: 'none',
                endCap: 'none',
                zIndex: 1,
                imageUrl: inlinePng,
                imageAssetPath: 'already-in-assets.png',
            },
        ],
    },
    tags: [],
};

const refs = findCanvasInlineImages([canvasEntity]);
assert.equal(refs.length, 1);
assert.equal(refs[0].canvasId, 'canvas_1');
assert.equal(refs[0].elementId, 'image_1');
assert.equal(refs[0].sizeBytes, 5);
assert.match(refs[0].filename, /^canvas_Тестовый_Canvas_Меха_арт\.png$/);

const replacement = replaceInlineCanvasImage(canvasEntity, 'image_1', 'canvas_1.png');
assert(replacement, 'replacement should be created');

const updatedElements = replacement.entity.properties.drawElements;
assert(Array.isArray(updatedElements));
const updatedImage = updatedElements.find((element) => element.id === 'image_1');
assert(updatedImage);
assert.equal(updatedImage.imageAssetPath, 'canvas_1.png');
assert.equal(updatedImage.imageUrl, undefined);

assert.equal(replaceInlineCanvasImage(canvasEntity, 'missing', 'asset.png'), null);
