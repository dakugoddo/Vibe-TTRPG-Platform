import type { CanvasAnchorId, DrawElement, DrawElementBinding, DrawElementType } from '../types/canvasTypes';
import { getElementBounds } from '../types/canvasTypes';

export interface CanvasAnchorPoint {
  id: CanvasAnchorId;
  elementId: string;
  elementType: DrawElementType;
  x: number;
  y: number;
  focus?: number;
}

export interface CanvasAnchorSnap {
  anchor: CanvasAnchorPoint;
  point: { x: number; y: number };
  distance: number;
}

interface FindNearestCanvasAnchorOptions {
  radius: number;
  excludeIds?: Iterable<string>;
}

function normalizeBounds(bounds: { x: number; y: number; w: number; h: number }) {
  const x1 = Math.min(bounds.x, bounds.x + bounds.w);
  const y1 = Math.min(bounds.y, bounds.y + bounds.h);
  const x2 = Math.max(bounds.x, bounds.x + bounds.w);
  const y2 = Math.max(bounds.y, bounds.y + bounds.h);
  return {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function canUseElementAnchors(element: DrawElement): boolean {
  return element.type === 'rectangle'
    || element.type === 'ellipse'
    || element.type === 'image'
    || element.type === 'entityToken'
    || element.type === 'frame'
    || element.type === 'text';
}

export function getCanvasAnchorPoints(element: DrawElement): CanvasAnchorPoint[] {
  if (!canUseElementAnchors(element)) return [];

  const bounds = normalizeBounds(getElementBounds(element));
  if (bounds.w <= 0 || bounds.h <= 0) return [];

  const left = bounds.x;
  const right = bounds.x + bounds.w;
  const top = bounds.y;
  const bottom = bounds.y + bounds.h;
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;

  const base = {
    elementId: element.id,
    elementType: element.type,
  };

  return [
    { ...base, id: 'center', x: cx, y: cy },
    { ...base, id: 'top', x: cx, y: top },
    { ...base, id: 'right', x: right, y: cy },
    { ...base, id: 'bottom', x: cx, y: bottom },
    { ...base, id: 'left', x: left, y: cy },
    { ...base, id: 'topLeft', x: left, y: top },
    { ...base, id: 'topRight', x: right, y: top },
    { ...base, id: 'bottomRight', x: right, y: bottom },
    { ...base, id: 'bottomLeft', x: left, y: bottom },
  ];
}

export function getCanvasAnchorPoint(element: DrawElement, anchorId: CanvasAnchorId, focus?: number): CanvasAnchorPoint | null {
  if (focus !== undefined && (anchorId === 'top' || anchorId === 'right' || anchorId === 'bottom' || anchorId === 'left')) {
    const bounds = normalizeBounds(getElementBounds(element));
    if (bounds.w <= 0 || bounds.h <= 0) return null;
    const left = bounds.x;
    const right = bounds.x + bounds.w;
    const top = bounds.y;
    const bottom = bounds.y + bounds.h;
    const t = clamp01(focus);
    const base = { elementId: element.id, elementType: element.type, id: anchorId, focus: t };

    if (anchorId === 'top') return { ...base, x: left + bounds.w * t, y: top };
    if (anchorId === 'bottom') return { ...base, x: left + bounds.w * t, y: bottom };
    if (anchorId === 'right') return { ...base, x: right, y: top + bounds.h * t };
    return { ...base, x: left, y: top + bounds.h * t };
  }

  return getCanvasAnchorPoints(element).find((anchor) => anchor.id === anchorId) || null;
}

export function resolveCanvasBinding(elements: DrawElement[], binding: DrawElementBinding | undefined): CanvasAnchorPoint | null {
  if (!binding) return null;
  const target = elements.find((element) => element.id === binding.elementId);
  return target ? getCanvasAnchorPoint(target, binding.anchor, binding.focus) : null;
}

function getNearestEdgeAnchor(point: { x: number; y: number }, element: DrawElement): CanvasAnchorSnap | null {
  if (!canUseElementAnchors(element)) return null;
  const bounds = normalizeBounds(getElementBounds(element));
  if (bounds.w <= 0 || bounds.h <= 0) return null;

  const left = bounds.x;
  const right = bounds.x + bounds.w;
  const top = bounds.y;
  const bottom = bounds.y + bounds.h;
  const candidates: Array<{ id: CanvasAnchorId; x: number; y: number; focus: number }> = [
    { id: 'top', x: Math.max(left, Math.min(right, point.x)), y: top, focus: clamp01((point.x - left) / bounds.w) },
    { id: 'bottom', x: Math.max(left, Math.min(right, point.x)), y: bottom, focus: clamp01((point.x - left) / bounds.w) },
    { id: 'right', x: right, y: Math.max(top, Math.min(bottom, point.y)), focus: clamp01((point.y - top) / bounds.h) },
    { id: 'left', x: left, y: Math.max(top, Math.min(bottom, point.y)), focus: clamp01((point.y - top) / bounds.h) },
  ];

  let nearest: CanvasAnchorSnap | null = null;
  for (const candidate of candidates) {
    const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
    if (!nearest || distance < nearest.distance) {
      nearest = {
        anchor: {
          id: candidate.id,
          elementId: element.id,
          elementType: element.type,
          x: candidate.x,
          y: candidate.y,
          focus: candidate.focus,
        },
        point: { x: candidate.x, y: candidate.y },
        distance,
      };
    }
  }
  return nearest;
}

export function updateBoundLineEndpoints(elements: DrawElement[], movedElementIds?: Iterable<string>): DrawElement[] {
  const moved = movedElementIds ? new Set(movedElementIds) : null;
  let changedAny = false;

  const updated = elements.map((element) => {
    if ((element.type !== 'line' && element.type !== 'arrow') || !element.points || element.points.length < 4) {
      return element;
    }

    const points = [...element.points];
    let changed = false;
    const startBinding = element.startBinding;
    const endBinding = element.endBinding;

    if (startBinding && (!moved || moved.has(startBinding.elementId))) {
      const anchor = resolveCanvasBinding(elements, startBinding);
      if (anchor && (points[0] !== anchor.x || points[1] !== anchor.y)) {
        points[0] = anchor.x;
        points[1] = anchor.y;
        changed = true;
      }
    }

    if (endBinding && (!moved || moved.has(endBinding.elementId))) {
      const anchor = resolveCanvasBinding(elements, endBinding);
      const xIndex = points.length - 2;
      const yIndex = points.length - 1;
      if (anchor && (points[xIndex] !== anchor.x || points[yIndex] !== anchor.y)) {
        points[xIndex] = anchor.x;
        points[yIndex] = anchor.y;
        changed = true;
      }
    }

    if (!changed) return element;
    changedAny = true;
    return { ...element, points };
  });

  return changedAny ? updated : elements;
}

export function findNearestCanvasAnchor(
  point: { x: number; y: number },
  elements: DrawElement[],
  options: FindNearestCanvasAnchorOptions
): CanvasAnchorSnap | null {
  const excludeIds = new Set(options.excludeIds || []);
  let nearest: CanvasAnchorSnap | null = null;

  for (const element of elements) {
    if (excludeIds.has(element.id)) continue;
    const edgeSnap = getNearestEdgeAnchor(point, element);
    if (edgeSnap && edgeSnap.distance <= options.radius) {
      nearest = edgeSnap;
    }
    for (const anchor of getCanvasAnchorPoints(element)) {
      const distance = Math.hypot(point.x - anchor.x, point.y - anchor.y);
      if (distance > options.radius) continue;
      if (!nearest || distance < nearest.distance) {
        nearest = {
          anchor,
          point: { x: anchor.x, y: anchor.y },
          distance,
        };
      }
    }
  }

  return nearest;
}
