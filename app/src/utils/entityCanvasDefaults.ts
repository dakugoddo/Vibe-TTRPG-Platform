import type { Entity } from '../types';
import type { EntityTokenFrame, EntityTokenMode } from '../types/canvasTypes';

export const ENTITY_CANVAS_TOKEN_DEFAULTS_PROPERTY = 'canvasToken';

export interface EntityCanvasTokenDefaults {
  mode: EntityTokenMode;
  frame: EntityTokenFrame;
  showName: boolean;
  stroke: string;
  fill: string;
  tokenImage: string;
  artImage: string;
  tokenWidth: number;
  tokenHeight: number;
  artWidth: number;
  artHeight: number;
  width: number;
  height: number;
}

export type EntityCanvasTokenDefaultsPatch = Partial<
  Pick<EntityCanvasTokenDefaults, 'mode' | 'frame' | 'showName' | 'stroke' | 'fill' | 'tokenImage' | 'artImage' | 'tokenWidth' | 'tokenHeight' | 'artWidth' | 'artHeight'>
>;

const DEFAULT_ENTITY_CANVAS_TOKEN_DEFAULTS: EntityCanvasTokenDefaults = {
  mode: 'token',
  frame: 'ring',
  showName: true,
  stroke: '#a5b4fc',
  fill: 'rgba(30,41,59,0.96)',
  tokenImage: '',
  artImage: '',
  tokenWidth: 72,
  tokenHeight: 92,
  artWidth: 220,
  artHeight: 150,
  width: 72,
  height: 92,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function readMode(value: unknown, fallback: EntityTokenMode): EntityTokenMode {
  return value === 'token' || value === 'art' ? value : fallback;
}

function readFrame(value: unknown, fallback: EntityTokenFrame): EntityTokenFrame {
  return value === 'plain' || value === 'ring' || value === 'badge' || value === 'hex' ? value : fallback;
}

function readBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readDimension(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function getEntityCanvasTokenDefaults(entity?: Entity, modeOverride?: EntityTokenMode): EntityCanvasTokenDefaults {
  const raw = isRecord(entity?.properties?.[ENTITY_CANVAS_TOKEN_DEFAULTS_PROPERTY])
    ? entity.properties[ENTITY_CANVAS_TOKEN_DEFAULTS_PROPERTY]
    : {};

  const mode = modeOverride ?? readMode(raw.mode, DEFAULT_ENTITY_CANVAS_TOKEN_DEFAULTS.mode);
  const tokenWidth = readDimension(raw.tokenWidth, DEFAULT_ENTITY_CANVAS_TOKEN_DEFAULTS.tokenWidth, 32, 512);
  const tokenHeight = readDimension(raw.tokenHeight, DEFAULT_ENTITY_CANVAS_TOKEN_DEFAULTS.tokenHeight, 32, 512);
  const artWidth = readDimension(raw.artWidth, DEFAULT_ENTITY_CANVAS_TOKEN_DEFAULTS.artWidth, 64, 1200);
  const artHeight = readDimension(raw.artHeight, DEFAULT_ENTITY_CANVAS_TOKEN_DEFAULTS.artHeight, 64, 1200);

  return {
    mode,
    frame: readFrame(raw.frame, DEFAULT_ENTITY_CANVAS_TOKEN_DEFAULTS.frame),
    showName: readBool(raw.showName, DEFAULT_ENTITY_CANVAS_TOKEN_DEFAULTS.showName),
    stroke: readString(raw.stroke, DEFAULT_ENTITY_CANVAS_TOKEN_DEFAULTS.stroke),
    fill: readString(raw.fill, DEFAULT_ENTITY_CANVAS_TOKEN_DEFAULTS.fill),
    tokenImage: readString(raw.tokenImage, DEFAULT_ENTITY_CANVAS_TOKEN_DEFAULTS.tokenImage),
    artImage: readString(raw.artImage, DEFAULT_ENTITY_CANVAS_TOKEN_DEFAULTS.artImage),
    tokenWidth,
    tokenHeight,
    artWidth,
    artHeight,
    width: mode === 'art' ? artWidth : tokenWidth,
    height: mode === 'art' ? artHeight : tokenHeight,
  };
}

export function getEntityCanvasTokenImageSource(entity: Entity | undefined, mode: EntityTokenMode): string {
  if (!entity) return '';
  const defaults = getEntityCanvasTokenDefaults(entity, mode);
  return (mode === 'art' ? defaults.artImage : defaults.tokenImage) || entity.icon_url || '';
}

export function buildEntityCanvasTokenDefaultsPatch(entity: Entity, patch: EntityCanvasTokenDefaultsPatch): Record<string, unknown> {
  const current = isRecord(entity.properties?.[ENTITY_CANVAS_TOKEN_DEFAULTS_PROPERTY])
    ? entity.properties[ENTITY_CANVAS_TOKEN_DEFAULTS_PROPERTY]
    : {};
  return {
    ...current,
    ...patch,
  };
}
