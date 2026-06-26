import type { DrawVisualStyle } from '../types/canvasTypes';

export interface CanvasVisualStyleConfig {
  id: DrawVisualStyle;
  label: string;
  description: string;
  softStrokeWidth: number;
  softStrokeOpacity: number;
  sketchJitter: number;
  sketchStrokeOpacity: number;
}

export const CANVAS_VISUAL_STYLE_OPTIONS: CanvasVisualStyleConfig[] = [
  {
    id: 'clean',
    label: 'Ровно',
    description: 'Чистая геометрия для схем, карт и аккуратных UI-блоков.',
    softStrokeWidth: 0,
    softStrokeOpacity: 0,
    sketchJitter: 0,
    sketchStrokeOpacity: 0,
  },
  {
    id: 'soft',
    label: 'Мягко',
    description: 'Легкий рукописный дубль: две почти совпадающие линии.',
    softStrokeWidth: 0,
    softStrokeOpacity: 0,
    sketchJitter: 1.1,
    sketchStrokeOpacity: 0.42,
  },
  {
    id: 'sketch',
    label: 'Скетч',
    description: 'Стабильный рукописный дубль обводки без случайного мерцания.',
    softStrokeWidth: 0,
    softStrokeOpacity: 0,
    sketchJitter: 3.2,
    sketchStrokeOpacity: 0.62,
  },
];

export function getCanvasVisualStyleConfig(style?: DrawVisualStyle): CanvasVisualStyleConfig {
  return CANVAS_VISUAL_STYLE_OPTIONS.find((option) => option.id === style) ?? CANVAS_VISUAL_STYLE_OPTIONS[0];
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function jitterUnit(seed: string): number {
  const x = Math.sin(hashString(seed)) * 10000;
  return (x - Math.floor(x)) * 2 - 1;
}

export function getVisualStyleOffset(elementId: string, key: string, amount: number): { x: number; y: number } {
  if (amount <= 0) return { x: 0, y: 0 };
  return {
    x: jitterUnit(`${elementId}:${key}:x`) * amount,
    y: jitterUnit(`${elementId}:${key}:y`) * amount,
  };
}

export function getJitteredLinePoints(points: number[], elementId: string, amount: number): number[] {
  if (amount <= 0) return points;
  return points.map((coord, index) => coord + jitterUnit(`${elementId}:point:${index}`) * amount);
}
