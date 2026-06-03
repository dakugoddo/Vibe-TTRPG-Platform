import type { Entity } from '../types';
import type { CanvasWindowInstance, DrawElement, FogReveal } from '../types/canvasTypes';

export const CANVAS_DRAW_ELEMENTS_PROPERTY = 'drawElements';
export const CANVAS_FOG_REVEALS_PROPERTY = 'fogReveals';
export const CANVAS_WINDOW_INSTANCES_PROPERTY = 'canvasWindowInstances';
const INLINE_IMAGE_DATA_URL_RE = /^data:image\/([a-z0-9.+-]+);base64,/i;
const MAX_INLINE_IMAGE_BYTES_FOR_SHARED_SYNC = 64 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isDrawElement(value: unknown): value is DrawElement {
    if (!isRecord(value)) return false;
    return (
        typeof value.id === 'string' &&
        typeof value.type === 'string' &&
        typeof value.stroke === 'string' &&
        isNumber(value.strokeWidth) &&
        typeof value.strokeStyle === 'string' &&
        isNumber(value.opacity) &&
        typeof value.startCap === 'string' &&
        typeof value.endCap === 'string' &&
        isNumber(value.zIndex)
    );
}

function isFogReveal(value: unknown): value is FogReveal {
    if (!isRecord(value)) return false;
    return (
        typeof value.id === 'string' &&
        (value.type === 'circle' || value.type === 'rect') &&
        isNumber(value.x) &&
        isNumber(value.y) &&
        isNumber(value.width) &&
        isNumber(value.height)
    );
}

function isCanvasWindowMode(value: unknown): value is CanvasWindowInstance['mode'] {
    return value === 'full' || value === 'compact' || value === 'icon';
}

function isCanvasWindowInstance(value: unknown): value is CanvasWindowInstance {
    if (!isRecord(value)) return false;
    return (
        typeof value.id === 'string' &&
        typeof value.entityId === 'string' &&
        isCanvasWindowMode(value.mode) &&
        isNumber(value.x) &&
        isNumber(value.y) &&
        isNumber(value.width) &&
        isNumber(value.height) &&
        isNumber(value.zIndex)
    );
}

export function sanitizeDrawElementForPersistence(element: DrawElement): DrawElement {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(element as unknown as Record<string, unknown>)) {
        if (key.startsWith('_')) continue;
        if (value !== undefined) clean[key] = value;
    }
    return clean as unknown as DrawElement;
}

function isInlineImageDataUrl(value: unknown): value is string {
    return typeof value === 'string' && INLINE_IMAGE_DATA_URL_RE.test(value);
}

function estimateBase64DataUrlBytes(dataUrl: string): number {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0) return dataUrl.length;
    const base64 = dataUrl.slice(commaIndex + 1).replace(/\s/g, '');
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function sanitizeDrawElementForSharedSync(element: DrawElement): DrawElement {
    const clean = sanitizeDrawElementForPersistence(element);
    if (clean.type !== 'image' || !isInlineImageDataUrl(clean.imageUrl)) return clean;

    const hasAssetPath = typeof clean.imageAssetPath === 'string' && clean.imageAssetPath.trim().length > 0;
    const inlineBytes = estimateBase64DataUrlBytes(clean.imageUrl);
    if (hasAssetPath || inlineBytes > MAX_INLINE_IMAGE_BYTES_FOR_SHARED_SYNC) {
        delete clean.imageUrl;
    }

    return clean;
}

export function normalizeDrawElementsForSharedSync(elements: DrawElement[]): DrawElement[] {
    return elements
        .map((element) => sanitizeDrawElementForSharedSync(element))
        .sort((left, right) => {
            const zDiff = (left.zIndex ?? 0) - (right.zIndex ?? 0);
            if (zDiff !== 0) return zDiff;
            return left.id.localeCompare(right.id);
        });
}

export function sanitizeCanvasEntityForSharedSync<T extends Entity>(entity: T): T {
    if (entity.type !== 'canvas') return entity;
    const raw = entity.properties?.[CANVAS_DRAW_ELEMENTS_PROPERTY];
    const rawWindows = entity.properties?.[CANVAS_WINDOW_INSTANCES_PROPERTY];
    if (!Array.isArray(raw) && !Array.isArray(rawWindows)) return entity;

    const drawElements = Array.isArray(raw)
        ? normalizeDrawElementsForSharedSync(raw.filter(isDrawElement))
        : undefined;
    const canvasWindowInstances = Array.isArray(rawWindows)
        ? normalizeCanvasWindowInstancesForPersistence(rawWindows.filter(isCanvasWindowInstance))
        : undefined;

    return {
        ...entity,
        properties: {
            ...entity.properties,
            ...(drawElements ? { [CANVAS_DRAW_ELEMENTS_PROPERTY]: drawElements } : {}),
            ...(canvasWindowInstances ? { [CANVAS_WINDOW_INSTANCES_PROPERTY]: canvasWindowInstances } : {}),
        },
    };
}

export function sanitizeFogRevealForPersistence(reveal: FogReveal): FogReveal {
    return {
        id: reveal.id,
        type: reveal.type,
        x: reveal.x,
        y: reveal.y,
        width: reveal.width,
        height: reveal.height,
    };
}

export function readCanvasDrawElements(properties: Record<string, unknown> | undefined): DrawElement[] {
    const raw = properties?.[CANVAS_DRAW_ELEMENTS_PROPERTY];
    if (!Array.isArray(raw)) return [];
    return raw.filter(isDrawElement).map(sanitizeDrawElementForPersistence);
}

export function readCanvasFogReveals(properties: Record<string, unknown> | undefined): FogReveal[] {
    const raw = properties?.[CANVAS_FOG_REVEALS_PROPERTY];
    if (!Array.isArray(raw)) return [];
    return raw.filter(isFogReveal).map(sanitizeFogRevealForPersistence);
}

export function sanitizeCanvasWindowInstanceForPersistence(instance: CanvasWindowInstance): CanvasWindowInstance {
    return {
        id: instance.id,
        entityId: instance.entityId,
        mode: isCanvasWindowMode(instance.mode) ? instance.mode : 'compact',
        x: instance.x,
        y: instance.y,
        width: instance.width,
        height: instance.height,
        zIndex: instance.zIndex,
    };
}

export function normalizeCanvasWindowInstancesForPersistence(instances: CanvasWindowInstance[]): CanvasWindowInstance[] {
    return instances
        .map(sanitizeCanvasWindowInstanceForPersistence)
        .sort((left, right) => {
            const zDiff = (left.zIndex ?? 0) - (right.zIndex ?? 0);
            if (zDiff !== 0) return zDiff;
            return left.id.localeCompare(right.id);
        });
}

export function readCanvasWindowInstances(properties: Record<string, unknown> | undefined): CanvasWindowInstance[] {
    const raw = properties?.[CANVAS_WINDOW_INSTANCES_PROPERTY];
    if (!Array.isArray(raw)) return [];
    return normalizeCanvasWindowInstancesForPersistence(raw.filter(isCanvasWindowInstance));
}

export function upsertCanvasWindowInstance(
    instances: CanvasWindowInstance[],
    nextInstance: CanvasWindowInstance
): CanvasWindowInstance[] {
    const next = sanitizeCanvasWindowInstanceForPersistence(nextInstance);
    const found = instances.some((instance) => instance.id === next.id);
    return normalizeCanvasWindowInstancesForPersistence(
        found
            ? instances.map((instance) => instance.id === next.id ? next : instance)
            : [...instances, next]
    );
}

export function removeCanvasWindowInstance(
    instances: CanvasWindowInstance[],
    instanceId: string
): CanvasWindowInstance[] {
    return normalizeCanvasWindowInstancesForPersistence(
        instances.filter((instance) => instance.id !== instanceId)
    );
}
