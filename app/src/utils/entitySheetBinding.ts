import type { Entity } from '../types';
import type { SheetBindingV1 } from './entitySheetSchema';

export type SheetBindingResolution =
    | { status: 'resolved'; value: unknown }
    | { status: 'missing'; value: undefined };

const UNSAFE_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function resolveEntitySheetBinding(
    entity: Entity,
    binding: SheetBindingV1
): SheetBindingResolution {
    if (binding.scope !== 'self' || binding.path[0] !== 'properties') {
        return { status: 'missing', value: undefined };
    }

    let current: unknown = entity;
    for (const segment of binding.path) {
        if (UNSAFE_PATH_SEGMENTS.has(segment) || !isRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
            return { status: 'missing', value: undefined };
        }
        current = current[segment];
    }

    return current === undefined
        ? { status: 'missing', value: undefined }
        : { status: 'resolved', value: current };
}
