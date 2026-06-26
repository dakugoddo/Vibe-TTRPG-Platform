export type WindowLayoutPreset =
    | 'left'
    | 'right'
    | 'topLeft'
    | 'topRight'
    | 'bottomLeft'
    | 'bottomRight'
    | 'center'
    | 'wideCenter';

export interface WindowLayoutBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface WindowLayoutRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

const MARGIN = 16;
const TOP_MARGIN = 72;
const GAP = 12;
const MIN_WIDTH = 300;
const MIN_HEIGHT = 220;

export function getScreenWindowLayoutBounds(viewportWidth: number, viewportHeight: number): WindowLayoutBounds {
    const width = Math.max(MIN_WIDTH, viewportWidth - MARGIN * 2);
    const height = Math.max(MIN_HEIGHT, viewportHeight - TOP_MARGIN - MARGIN);
    return {
        x: MARGIN,
        y: Math.min(TOP_MARGIN, Math.max(MARGIN, viewportHeight - MIN_HEIGHT - MARGIN)),
        width,
        height,
    };
}

function clampRect(rect: WindowLayoutRect, bounds: WindowLayoutBounds): WindowLayoutRect {
    const width = Math.max(MIN_WIDTH, Math.min(rect.width, bounds.width));
    const height = Math.max(MIN_HEIGHT, Math.min(rect.height, bounds.height));
    return {
        x: Math.max(bounds.x, Math.min(rect.x, bounds.x + bounds.width - width)),
        y: Math.max(bounds.y, Math.min(rect.y, bounds.y + bounds.height - height)),
        width,
        height,
    };
}

export function getWindowLayoutRect(preset: WindowLayoutPreset, bounds: WindowLayoutBounds): WindowLayoutRect {
    const halfWidth = (bounds.width - GAP) / 2;
    const halfHeight = (bounds.height - GAP) / 2;

    switch (preset) {
        case 'left':
            return clampRect({ x: bounds.x, y: bounds.y, width: halfWidth, height: bounds.height }, bounds);
        case 'right':
            return clampRect({ x: bounds.x + halfWidth + GAP, y: bounds.y, width: halfWidth, height: bounds.height }, bounds);
        case 'topLeft':
            return clampRect({ x: bounds.x, y: bounds.y, width: halfWidth, height: halfHeight }, bounds);
        case 'topRight':
            return clampRect({ x: bounds.x + halfWidth + GAP, y: bounds.y, width: halfWidth, height: halfHeight }, bounds);
        case 'bottomLeft':
            return clampRect({ x: bounds.x, y: bounds.y + halfHeight + GAP, width: halfWidth, height: halfHeight }, bounds);
        case 'bottomRight':
            return clampRect({ x: bounds.x + halfWidth + GAP, y: bounds.y + halfHeight + GAP, width: halfWidth, height: halfHeight }, bounds);
        case 'wideCenter': {
            const width = Math.min(920, bounds.width);
            const height = Math.min(720, bounds.height);
            return clampRect({
                x: bounds.x + (bounds.width - width) / 2,
                y: bounds.y + (bounds.height - height) / 2,
                width,
                height,
            }, bounds);
        }
        case 'center':
        default: {
            const width = Math.min(560, bounds.width);
            const height = Math.min(420, bounds.height);
            return clampRect({
                x: bounds.x + (bounds.width - width) / 2,
                y: bounds.y + (bounds.height - height) / 2,
                width,
                height,
            }, bounds);
        }
    }
}

export function getWindowGridLayoutRects(count: number, bounds: WindowLayoutBounds): WindowLayoutRect[] {
    const safeCount = Math.max(0, count);
    if (safeCount === 0) return [];
    if (safeCount === 1) return [getWindowLayoutRect('center', bounds)];

    const columns = safeCount <= 2 ? safeCount : Math.ceil(Math.sqrt(safeCount));
    const rows = Math.ceil(safeCount / columns);
    const cellWidth = (bounds.width - GAP * (columns - 1)) / columns;
    const cellHeight = (bounds.height - GAP * (rows - 1)) / rows;

    return Array.from({ length: safeCount }, (_item, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        return clampRect({
            x: bounds.x + column * (cellWidth + GAP),
            y: bounds.y + row * (cellHeight + GAP),
            width: cellWidth,
            height: cellHeight,
        }, bounds);
    });
}

export function getWindowCascadeLayoutRects(count: number, bounds: WindowLayoutBounds): WindowLayoutRect[] {
    const safeCount = Math.max(0, count);
    const baseWidth = Math.min(520, bounds.width);
    const baseHeight = Math.min(380, bounds.height);
    const step = 32;

    return Array.from({ length: safeCount }, (_item, index) => clampRect({
        x: bounds.x + (index * step) % Math.max(step, bounds.width - baseWidth + step),
        y: bounds.y + (index * step) % Math.max(step, bounds.height - baseHeight + step),
        width: baseWidth,
        height: baseHeight,
    }, bounds));
}
