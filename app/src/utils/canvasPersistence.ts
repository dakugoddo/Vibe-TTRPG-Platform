import type { DrawElement, FogReveal } from '../types/canvasTypes';

export const CANVAS_DRAW_ELEMENTS_PROPERTY = 'drawElements';
export const CANVAS_FOG_REVEALS_PROPERTY = 'fogReveals';

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

export function sanitizeDrawElementForPersistence(element: DrawElement): DrawElement {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(element as unknown as Record<string, unknown>)) {
        if (key.startsWith('_')) continue;
        if (value !== undefined) clean[key] = value;
    }
    return clean as unknown as DrawElement;
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
