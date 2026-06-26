import type { DrawLineMode } from '../types/canvasTypes';

export interface CanvasLineModeOption {
  id: DrawLineMode;
  label: string;
  description: string;
}

export const CANVAS_LINE_MODE_OPTIONS: CanvasLineModeOption[] = [
  {
    id: 'straight',
    label: 'Прямая',
    description: 'Ломаная без сглаживания: точная схема, маршруты, границы.',
  },
  {
    id: 'curved',
    label: 'Кривая',
    description: 'Сглаженная линия для свободных связей и рукописных набросков.',
  },
  {
    id: 'elbow',
    label: 'Угол',
    description: 'Ортогональная трассировка с прямыми углами для графов и схем.',
  },
];

export function getLineMode(mode: DrawLineMode | undefined, pointCount: number): DrawLineMode {
  if (mode) return mode;
  return pointCount > 2 ? 'curved' : 'straight';
}

function appendPoint(target: number[], x: number, y: number): void {
  const len = target.length;
  if (len >= 2 && target[len - 2] === x && target[len - 1] === y) return;
  target.push(x, y);
}

export function getRoutedLinePoints(points: number[], mode?: DrawLineMode): number[] {
  if (points.length < 4) return points;
  const resolved = getLineMode(mode, points.length / 2);
  if (resolved !== 'elbow') return points;

  const routed: number[] = [];
  appendPoint(routed, points[0], points[1]);

  for (let i = 2; i < points.length; i += 2) {
    const fromX = points[i - 2];
    const fromY = points[i - 1];
    const toX = points[i];
    const toY = points[i + 1];
    const midX = fromX + (toX - fromX) / 2;

    appendPoint(routed, midX, fromY);
    appendPoint(routed, midX, toY);
    appendPoint(routed, toX, toY);
  }

  return routed;
}

export function insertLinePointAtClosestSegment(points: number[], point: { x: number; y: number }): number[] {
  if (points.length < 4) return points;

  let closestDist = Infinity;
  let insertIdx = 1;

  for (let i = 0; i < points.length - 2; i += 2) {
    const ax = points[i];
    const ay = points[i + 1];
    const bx = points[i + 2];
    const by = points[i + 3];
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - ax) * dx + (point.y - ay) * dy) / lenSq));
    const projX = ax + t * dx;
    const projY = ay + t * dy;
    const dist = Math.hypot(point.x - projX, point.y - projY);

    if (dist < closestDist) {
      closestDist = dist;
      insertIdx = i / 2 + 1;
    }
  }

  const nextPoints = [...points];
  nextPoints.splice(insertIdx * 2, 0, point.x, point.y);
  return nextPoints;
}

export function removeLinePointAtIndex(points: number[], pointIndex: number): number[] {
  const pointCount = points.length / 2;
  if (pointCount <= 2) return points;
  if (pointIndex <= 0 || pointIndex >= pointCount - 1) return points;

  const nextPoints = [...points];
  nextPoints.splice(pointIndex * 2, 2);
  return nextPoints.length >= 4 ? nextPoints : points;
}

export function findEditableLinePointNear(points: number[], point: { x: number; y: number }, radius: number): number | null {
  const pointCount = points.length / 2;
  if (pointCount <= 2 || radius <= 0) return null;

  const radiusSq = radius * radius;
  let bestIndex: number | null = null;
  let bestDistSq = radiusSq;

  for (let i = 2; i < points.length - 2; i += 2) {
    const dx = points[i] - point.x;
    const dy = points[i + 1] - point.y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= bestDistSq) {
      bestDistSq = distSq;
      bestIndex = i / 2;
    }
  }

  return bestIndex;
}

export function getLineTension(points: number[], mode?: DrawLineMode): number {
  const resolved = getLineMode(mode, points.length / 2);
  return resolved === 'curved' && points.length > 4 ? 0.35 : 0;
}
