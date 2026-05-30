import type { Entity } from '../types';
import type { DrawElement } from '../types/canvasTypes';
import { CANVAS_DRAW_ELEMENTS_PROPERTY, readCanvasDrawElements } from './canvasPersistence';
import { dataUrlToBase64 } from './fileRead';

export interface CanvasInlineImageRef {
    canvasId: string;
    canvasName: string;
    elementId: string;
    elementName: string;
    dataUrl: string;
    filename: string;
    sizeBytes: number;
}

export interface CanvasInlineImageReplacement {
    entity: Entity;
    element: DrawElement;
}

const INLINE_IMAGE_DATA_URL_RE = /^data:image\/([a-z0-9.+-]+);base64,/i;

export function isInlineImageDataUrl(value: unknown): value is string {
    return typeof value === 'string' && INLINE_IMAGE_DATA_URL_RE.test(value);
}

export function estimateDataUrlBytes(dataUrl: string): number {
    const base64 = dataUrlToBase64(dataUrl).replace(/\s/g, '');
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function getInlineImageExtension(dataUrl: string): string {
    const match = dataUrl.match(INLINE_IMAGE_DATA_URL_RE);
    const mimeExt = match?.[1]?.toLowerCase() || 'png';
    if (mimeExt === 'jpeg') return 'jpg';
    if (mimeExt === 'svg+xml') return 'svg';
    return mimeExt.replace(/[^a-z0-9]+/g, '') || 'png';
}

function sanitizeFilenamePart(value: string): string {
    const safe = value
        .split('')
        .filter((char) => {
            const code = char.charCodeAt(0);
            return code >= 32 && code !== 127;
        })
        .join('')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^[_ .-]+|[_ .-]+$/g, '');
    return (safe || 'canvas').slice(0, 72);
}

function buildInlineImageFilename(canvas: Entity, element: DrawElement, dataUrl: string): string {
    const canvasPart = sanitizeFilenamePart(canvas.name || canvas.id);
    const elementPart = sanitizeFilenamePart(element.objectName || element.id);
    return `canvas_${canvasPart}_${elementPart}.${getInlineImageExtension(dataUrl)}`;
}

export function findCanvasInlineImages(entities: Entity[]): CanvasInlineImageRef[] {
    const refs: CanvasInlineImageRef[] = [];

    for (const entity of entities) {
        if (entity.type !== 'canvas') continue;
        const elements = readCanvasDrawElements(entity.properties);

        for (const element of elements) {
            if (element.type !== 'image') continue;
            if (typeof element.imageAssetPath === 'string' && element.imageAssetPath.trim()) continue;
            if (!isInlineImageDataUrl(element.imageUrl)) continue;

            refs.push({
                canvasId: entity.id,
                canvasName: entity.name,
                elementId: element.id,
                elementName: element.objectName || element.id,
                dataUrl: element.imageUrl,
                filename: buildInlineImageFilename(entity, element, element.imageUrl),
                sizeBytes: estimateDataUrlBytes(element.imageUrl),
            });
        }
    }

    return refs;
}

export function replaceInlineCanvasImage(entity: Entity, elementId: string, assetPath: string): CanvasInlineImageReplacement | null {
    if (entity.type !== 'canvas') return null;

    let replacedElement: DrawElement | null = null;
    const elements = readCanvasDrawElements(entity.properties);
    const updatedElements = elements.map((element) => {
        if (element.id !== elementId || element.type !== 'image') return element;
        const updatedElement: DrawElement = {
            ...element,
            imageAssetPath: assetPath,
        };
        delete updatedElement.imageUrl;
        replacedElement = updatedElement;
        return replacedElement;
    });

    if (!replacedElement) return null;

    return {
        entity: {
            ...entity,
            properties: {
                ...entity.properties,
                [CANVAS_DRAW_ELEMENTS_PROPERTY]: updatedElements,
            },
        },
        element: replacedElement,
    };
}
