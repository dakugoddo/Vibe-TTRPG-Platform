import { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo, memo } from 'react';
import { Stage, Layer, Text, Group, Circle, Line, Rect, Ellipse, RegularPolygon, Image as KonvaImage, Shape } from 'react-konva';
import { Html } from 'react-konva-utils';
import { Box, Copy, Dices, ExternalLink, Eye, EyeOff, Image as ImageIcon, MoveRight, Trash2 } from 'lucide-react';
import Konva from 'konva';
import useImage from 'use-image';
import { useCanvasStore } from '../../store/canvasStore';
import { useCanvasDrawStore } from '../../store/canvasDrawStore';
import { yjsStore } from '../../store/yjsStore';
import { useEntitiesByParent } from '../../hooks/useEntities';
import { useWindowStore } from '../../store/windowStore';
import { useCanvasSyncStore, PING_DURATION_MS } from '../../store/canvasSyncStore';
import { useUIStore } from '../../store/uiStore';
import { useNotificationStore } from '../../store/notificationStore';
import { getAssetUrl, getIsHost, uploadAssetFile, uploadAssetFileToHost, type AssetRecord } from '../../services/fileApi';
import { rollEntityActionToChat } from '../../services/entityActionRoll';
import { canViewEntity } from '../../utils/permissions';
import { readAssetDragPayload } from '../../utils/assetDrag';
import { findNearestCanvasAnchor, updateBoundLineEndpoints } from '../../utils/canvasAnchors';
import { getEntityCanvasTokenDefaults, getEntityCanvasTokenImageSource, type EntityCanvasTokenDefaults } from '../../utils/entityCanvasDefaults';
import { fitEntityArtSizeToImage } from '../../utils/entityTokenSizing';
import { ENTITY_TOKEN_FRAME_OPTIONS, getEntityTokenFrameConfig } from '../../utils/canvasEntityTokenFrame';
import { buildCharacterCompactSummary } from '../../utils/characterCardSummary';
import { getCanvasVisualStyleConfig, getJitteredLinePoints, getVisualStyleOffset } from '../../utils/canvasVisualStyle';
import { findEditableLinePointNear, getLineMode, getLineTension, getRoutedLinePoints, insertLinePointAtClosestSegment, removeLinePointAtIndex } from '../../utils/canvasLineRouting';
import { getEntityDropActions } from '../../utils/entityDropRouter';
import { getEntityOwnerId, moveEntityTreeToParent } from '../../utils/entityTreeMutations';
import { isAnimatedGifSource } from '../../utils/imageSource';
import { LARGE_ASSET_UPLOAD_APPROVAL_BYTES, formatNotificationFileSize } from '../../utils/notificationModel';
import { createLargeUploadApprovalRequest } from '../../utils/sessionNotificationModel';
import { CanvasImagePicker } from './CanvasImagePicker';
import type { DatabaseType, Entity, SessionNotificationEvent } from '../../types';
import type { DrawElement, DrawElementBinding, EntityTokenFrame, EntityTokenMode, LineCap, StrokeStyle } from '../../types/canvasTypes';
import { getKonvaDash, getArrowPoints, translateElement, elementsInRect, getKonvaFontFamily, getElementBounds, getChildrenOfFrame, fogRevealsOverlap } from '../../types/canvasTypes';
import type { FogReveal } from '../../types/canvasTypes';

const SCALE_BY = 1.1;
const POINT_HANDLE_RADIUS = 5;
const RESIZE_HANDLE_SIZE = 7;
const MIN_PEN_POINT_DISTANCE = 8; // Minimum px between pen points during drawing
const RDP_EPSILON = 3; // Ramer-Douglas-Peucker simplification tolerance
const OBJECT_SNAP_SCREEN_RADIUS = 18;
const MAX_CANVAS_IMAGE_UPLOAD_BYTES = 250 * 1024 * 1024;

type CharacterCompactTab = 'stats' | 'actions' | 'resources' | 'notes';

const CHARACTER_COMPACT_TABS: Array<{ id: CharacterCompactTab; label: string }> = [
  { id: 'stats', label: 'Статы' },
  { id: 'actions', label: 'Действия' },
  { id: 'resources', label: 'Ресурсы' },
  { id: 'notes', label: 'Заметки' },
];

interface CanvasImageTarget {
  canvasId: string;
  canvasX: number;
  canvasY: number;
  screenX: number;
  screenY: number;
}

type CanvasImageUploadHandler = (
  file: File,
  target: CanvasImageTarget,
  centerOnPoint?: boolean,
  sessionNotificationId?: string,
  existingNotificationId?: string,
) => Promise<void>;

interface EntityDropChoiceTarget {
  entityId: string;
  canvasPoint: { x: number; y: number };
  screenX: number;
  screenY: number;
}

interface LinePointSnapResult {
  point: { x: number; y: number };
  binding?: DrawElementBinding;
}

// ─── Utility: Simple throttle for drag operations ───

function throttle<Args extends unknown[]>(fn: (...args: Args) => void, limitMs: number): (...args: Args) => void {
  let lastCall = 0;
  let rafId: number | null = null;
  let pendingArgs: Args | null = null;
  return ((...args: Args) => {
    pendingArgs = args;
    if (rafId !== null) return;
    const now = Date.now();
    const elapsed = now - lastCall;
    if (elapsed >= limitMs) {
      lastCall = now;
      fn(...args);
    } else {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (pendingArgs) {
          lastCall = Date.now();
          fn(...pendingArgs);
        }
      });
    }
  });
}

// ─── Utility: Point-in-polygon test (ray casting) ───

function pointInPolygon(px: number, py: number, polygon: number[]): boolean {
  let inside = false;
  const n = polygon.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i * 2], yi = polygon[i * 2 + 1];
    const xj = polygon[j * 2], yj = polygon[j * 2 + 1];
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// ─── Helper: Generate unique ID for draw elements ───

function generateDrawId(): string {
  return `draw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getScaledImageDimensions(width: number, height: number, maxDim = 600): { width: number; height: number } {
  let scaledWidth = width;
  let scaledHeight = height;
  if (scaledWidth > maxDim || scaledHeight > maxDim) {
    const ratio = Math.min(maxDim / scaledWidth, maxDim / scaledHeight);
    scaledWidth = Math.round(scaledWidth * ratio);
    scaledHeight = Math.round(scaledHeight * ratio);
  }
  return { width: scaledWidth, height: scaledHeight };
}

function loadBrowserImage(sourceUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = sourceUrl;
  });
}

function resolveCanvasImageSource(rawImageSource: string): string {
  if (!rawImageSource) return '';
  return rawImageSource.startsWith('http') || rawImageSource.startsWith('data:')
    ? rawImageSource
    : getAssetUrl(rawImageSource);
}

function isPointerOverNonCanvasUi(clientX: number, clientY: number, canvasRoot: HTMLElement | null): boolean {
  const topElement = document.elementFromPoint(clientX, clientY);
  return Boolean(topElement && canvasRoot && !canvasRoot.contains(topElement));
}

function getPlainEntityDescription(entity: Entity): string {
  return (entity.description || '')
    .replace(/[#*_`>\-[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getEntityTokenCanvasSize(
  entity: Entity,
  mode: EntityTokenMode,
  defaults: EntityCanvasTokenDefaults
): Promise<{ width: number; height: number }> {
  if (mode !== 'art') {
    return { width: defaults.width, height: defaults.height };
  }

  const imageSource = resolveCanvasImageSource(getEntityCanvasTokenImageSource(entity, 'art'));
  if (!imageSource) {
    return { width: defaults.width, height: defaults.height };
  }

  try {
    const image = await loadBrowserImage(imageSource);
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    if (naturalWidth <= 0 || naturalHeight <= 0) {
      return { width: defaults.width, height: defaults.height };
    }

    return fitEntityArtSizeToImage(
      { width: defaults.artWidth, height: defaults.artHeight },
      { width: naturalWidth, height: naturalHeight }
    );
  } catch {
    return { width: defaults.width, height: defaults.height };
  }
}

function snapPointToConfiguredGrid(
  point: { x: number; y: number },
  gridEnabled: boolean,
  gridType: 'square' | 'hex',
  gridSpacing: number,
  disabled = false
): { x: number; y: number } {
  if (!gridEnabled || disabled || gridSpacing <= 0) return point;

  if (gridType === 'square') {
    return {
      x: Math.round(point.x / gridSpacing) * gridSpacing,
      y: Math.round(point.y / gridSpacing) * gridSpacing,
    };
  }

  const hexH = gridSpacing * 0.866;
  const hexStepX = gridSpacing * 0.75;
  const approxCol = Math.round(point.x / hexStepX);
  const approxRow = Math.round(point.y / hexH);
  let best = point;
  let bestDist = Infinity;

  for (let col = approxCol - 2; col <= approxCol + 2; col++) {
    for (let row = approxRow - 2; row <= approxRow + 2; row++) {
      const cx = col * hexStepX;
      const cy = row * hexH + (col % 2 === 0 ? 0 : hexH / 2);
      const dist = Math.hypot(point.x - cx, point.y - cy);
      if (dist < bestDist) {
        bestDist = dist;
        best = { x: cx, y: cy };
      }
    }
  }

  return best;
}

// ─── Ramer-Douglas-Peucker line simplification ───

function canEditEntity(entity: Entity): boolean {
  return yjsStore.canModify(entity.database, getEntityOwnerId(entity));
}

function canViewCanvasEntity(entity?: Entity): entity is Entity {
  if (!entity) return false;
  return canViewEntity(
    yjsStore.localRole,
    entity.database,
    getEntityOwnerId(entity),
    yjsStore.localPlayerId,
    yjsStore.localPlayerName
  );
}

function canEditCanvasEntityById(canvasId: string | null): boolean {
  if (!canvasId) return false;
  const entity = yjsStore.entitiesMap.get(canvasId);
  if (!entity || entity.type !== 'canvas') return true;
  return canEditEntity(entity);
}

function getCanvasTargetDatabase(canvasId: string | null, fallback?: DatabaseType): DatabaseType {
  const canvasEntity = canvasId ? yjsStore.entitiesMap.get(canvasId) : undefined;
  return canvasEntity?.database || fallback || 'general';
}

function perpendicularDistance(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function rdpSimplify(points: number[], epsilon: number): number[] {
  if (points.length <= 4) return points; // 2 or fewer points — nothing to simplify

  const firstX = points[0], firstY = points[1];
  const lastX = points[points.length - 2], lastY = points[points.length - 1];

  let maxDist = 0;
  let maxIdx = 0;

  for (let i = 2; i < points.length - 2; i += 2) {
    const dist = perpendicularDistance(points[i], points[i + 1], firstX, firstY, lastX, lastY);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, maxIdx + 2), epsilon);
    const right = rdpSimplify(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -2), ...right];
  } else {
    return [firstX, firstY, lastX, lastY];
  }
}

// ─── Helper: Get/save draw elements from canvas entity ───

function getDrawElements(_activeCanvasId: string): DrawElement[] {
  void _activeCanvasId;
  return useCanvasSyncStore.getState().elements;
}

function saveDrawElements(_activeCanvasId: string, elements: DrawElement[]): void {
  void _activeCanvasId;
  useCanvasSyncStore.getState().syncElementsArray(elements);
}

// ─── Sub-component: Render a line cap (arrowhead / circle / diamond / square) ───

function LineCapDecoration({
  cap,
  fromX,
  fromY,
  toX,
  toY,
  stroke,
  size,
}: {
  cap: LineCap;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  stroke: string;
  size: number;
}) {
  if (cap === 'none') return null;

  if (cap === 'arrow') {
    const pts = getArrowPoints(fromX, fromY, toX, toY, size);
    return (
      <Line
        points={pts}
        stroke={stroke}
        strokeWidth={Math.max(size / 6, 1.5)}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
    );
  }

  if (cap === 'circle') {
    return (
      <Circle
        x={toX}
        y={toY}
        radius={size / 3}
        fill={stroke}
        listening={false}
      />
    );
  }

  if (cap === 'diamond') {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    return (
      <RegularPolygon
        x={toX}
        y={toY}
        sides={4}
        radius={size / 2.5}
        fill={stroke}
        rotation={(angle * 180) / Math.PI + 45}
        listening={false}
      />
    );
  }

  if (cap === 'square') {
    const s = size / 3;
    return (
      <Rect
        x={toX - s}
        y={toY - s}
        width={s * 2}
        height={s * 2}
        fill={stroke}
        listening={false}
      />
    );
  }

  return null;
}

// ─── Sub-component: Render a single DrawElement ───

const DrawElementNode = memo(function DrawElementNode({
  element,
  isSelected,
  onSelect,
  isEditingText,
  onDblClickText,
  onOpenLinkedEntity,
  onShowLinkedEntityInfo,
  isEntityInfoOpen,
}: {
  element: DrawElement;
  isSelected: boolean;
  onSelect: (id: string, shiftKey: boolean) => void;
  isEditingText?: boolean;
  onDblClickText?: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onOpenLinkedEntity?: (entityId: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onShowLinkedEntityInfo?: (elementId: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  isEntityInfoOpen?: boolean;
}) {
  const bounds = getElementBounds(element);
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;

  const commonProps = {
    opacity: element.opacity,
    onClick: (e: Konva.KonvaEventObject<MouseEvent>) => onSelect(element.id, e.evt.shiftKey),
    onTap: () => onSelect(element.id, false),
    x: cx,
    y: cy,
    offsetX: cx,
    offsetY: cy,
    rotation: element.rotation || 0,
  };

  const dash = getKonvaDash(element.strokeStyle, element.strokeWidth);
  const isLineType = element.type === 'line' || element.type === 'arrow';
  const visualStyle = getCanvasVisualStyleConfig(element.visualStyle);

  if (isLineType) {
    if (!element.points || element.points.length < 4) return null;
    const rawPts = element.points;
    const lineMode = getLineMode(element.lineMode, rawPts.length / 2);
    const pts = getRoutedLinePoints(rawPts, lineMode);
    const capSize = Math.max(element.strokeWidth * 4, 12);

    // Start cap direction
    const startFrom = { x: pts[2], y: pts[3] };
    const startTo = { x: pts[0], y: pts[1] };

    // End cap direction
    const endIdx = pts.length;
    const endFrom = { x: pts[endIdx - 4], y: pts[endIdx - 3] };
    const endTo = { x: pts[endIdx - 2], y: pts[endIdx - 1] };

    const useTension = getLineTension(rawPts, lineMode);

    // Compute stroke opacity
    const sOpacity = element.strokeOpacity ?? 1;
    const sketchPts = visualStyle.sketchJitter > 0
      ? getJitteredLinePoints(pts, element.id, visualStyle.sketchJitter)
      : null;

    return (
      <Group {...commonProps}>
        {isSelected && (
          <Line
            points={pts}
            stroke="rgba(167,139,250,0.4)"
            strokeWidth={element.strokeWidth + 6}
            lineCap="round"
            lineJoin="round"
            tension={useTension}
            listening={false}
          />
        )}
        {visualStyle.softStrokeWidth > 0 && (
          <Line
            points={pts}
            stroke={element.stroke}
            strokeWidth={element.strokeWidth + visualStyle.softStrokeWidth}
            dash={dash}
            lineCap="round"
            lineJoin="round"
            tension={useTension}
            opacity={sOpacity * visualStyle.softStrokeOpacity}
            listening={false}
          />
        )}
        <Line
          points={pts}
          stroke={element.stroke}
          strokeWidth={element.strokeWidth}
          dash={dash}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={Math.max(element.strokeWidth, 10)}
          tension={useTension}
          opacity={sOpacity}
        />
        {sketchPts && (
          <Line
            points={sketchPts}
            stroke={element.stroke}
            strokeWidth={Math.max(1, element.strokeWidth * 0.9)}
            dash={dash}
            lineCap="round"
            lineJoin="round"
            tension={useTension}
            opacity={sOpacity * visualStyle.sketchStrokeOpacity}
            listening={false}
          />
        )}
        {/* Start cap */}
        <LineCapDecoration
          cap={element.startCap}
          fromX={startFrom.x}
          fromY={startFrom.y}
          toX={startTo.x}
          toY={startTo.y}
          stroke={element.stroke}
          size={capSize}
        />
        {/* End cap */}
        <LineCapDecoration
          cap={element.endCap}
          fromX={endFrom.x}
          fromY={endFrom.y}
          toX={endTo.x}
          toY={endTo.y}
          stroke={element.stroke}
          size={capSize}
        />
        {/* Line label (objectName) at center */}
        {element.objectName && (() => {
          // Calculate midpoint of the line
          const midI = Math.floor(pts.length / 4) * 2;
          const nextI = Math.min(midI + 2, pts.length - 2);
          const mx = (pts[midI] + pts[nextI]) / 2;
          const my = (pts[midI + 1] + pts[nextI + 1]) / 2;
          const labelW = Math.max(element.objectName.length * 8 + 20, 50);
          return (
            <>
              <Rect
                x={mx - labelW / 2}
                y={my - 22}
                width={labelW}
                height={20}
                fill="rgba(0,0,0,0.65)"
                cornerRadius={6}
                listening={false}
              />
              <Text
                x={mx - labelW / 2}
                y={my - 19}
                width={labelW}
                text={element.objectName}
                fontSize={11}
                fontStyle="bold"
                fill="#e2e8f0"
                align="center"
                listening={false}
              />
            </>
          );
        })()}
      </Group>
    );
  }

  if (element.type === 'rectangle') {
    const rx = element.x || 0;
    const ry = element.y || 0;
    const rw = element.width || 0;
    const rh = element.height || 0;
    const fOpacity = element.fillOpacity ?? 1;
    const sOpacity = element.strokeOpacity ?? 1;
    const sketchOffset = getVisualStyleOffset(element.id, 'rectangle-stroke', visualStyle.sketchJitter);
    return (
      <Group {...commonProps}>
        {isSelected && (
          <Rect
            x={rx - 3}
            y={ry - 3}
            width={rw + 6}
            height={rh + 6}
            stroke="rgba(167,139,250,0.4)"
            strokeWidth={2}
            dash={[4, 4]}
            listening={false}
          />
        )}
        {/* Fill layer */}
        {element.fill && (
          <Rect
            x={rx}
            y={ry}
            width={rw}
            height={rh}
            fill={element.fill}
            opacity={fOpacity}
            cornerRadius={2}
            stroke={undefined}
            strokeWidth={0}
            listening={false}
          />
        )}
        {visualStyle.softStrokeWidth > 0 && (
          <Rect
            x={rx}
            y={ry}
            width={rw}
            height={rh}
            stroke={element.stroke}
            strokeWidth={element.strokeWidth + visualStyle.softStrokeWidth}
            opacity={sOpacity * visualStyle.softStrokeOpacity}
            dash={dash}
            cornerRadius={2}
            fill="transparent"
            listening={false}
          />
        )}
        {/* Stroke layer */}
        <Rect
          x={rx}
          y={ry}
          width={rw}
          height={rh}
          stroke={element.stroke}
          strokeWidth={element.strokeWidth}
          opacity={sOpacity}
          dash={dash}
          cornerRadius={2}
          fill="transparent"
        />
        {visualStyle.sketchJitter > 0 && (
          <Rect
            x={rx + sketchOffset.x}
            y={ry + sketchOffset.y}
            width={rw}
            height={rh}
            stroke={element.stroke}
            strokeWidth={Math.max(1, element.strokeWidth * 0.9)}
            opacity={sOpacity * visualStyle.sketchStrokeOpacity}
            dash={dash}
            cornerRadius={2}
            fill="transparent"
            listening={false}
          />
        )}
        {/* Object name above the shape */}
        {element.objectName && element.showName !== false && (
          <Text
            x={rx}
            y={ry - 18}
            width={rw}
            text={element.objectName}
            fontSize={11}
            fontStyle="bold"
            fill="rgba(255,255,255,0.6)"
            align="center"
            listening={false}
          />
        )}
        {/* Description text inside the shape */}
        {element.description && (
          <Text
            x={rx + 6}
            y={ry + 6}
            width={rw - 12}
            height={rh - 12}
            text={element.description}
            fontSize={element.fontSize || 16}
            fontFamily={getKonvaFontFamily(element.fontFamily || 'sans')}
            fill={element.textColor || '#e2e8f0'}
            opacity={element.textOpacity ?? 1}
            align={element.textAlign || 'center'}
            verticalAlign="middle"
            wrap="word"
            listening={false}
          />
        )}
      </Group>
    );
  }

  if (element.type === 'ellipse') {
    const ecx = (element.x || 0) + (element.width || 0) / 2;
    const ecy = (element.y || 0) + (element.height || 0) / 2;
    const erx = Math.abs((element.width || 0) / 2);
    const ery = Math.abs((element.height || 0) / 2);
    const fOpacity = element.fillOpacity ?? 1;
    const sOpacity = element.strokeOpacity ?? 1;
    const sketchOffset = getVisualStyleOffset(element.id, 'ellipse-stroke', visualStyle.sketchJitter);
    return (
      <Group {...commonProps}>
        {isSelected && (
          <Ellipse
            x={ecx}
            y={ecy}
            radiusX={erx + 3}
            radiusY={ery + 3}
            stroke="rgba(167,139,250,0.4)"
            strokeWidth={2}
            dash={[4, 4]}
            listening={false}
          />
        )}
        {/* Fill layer */}
        {element.fill && (
          <Ellipse
            x={ecx}
            y={ecy}
            radiusX={erx}
            radiusY={ery}
            fill={element.fill}
            opacity={fOpacity}
            strokeWidth={0}
            listening={false}
          />
        )}
        {visualStyle.softStrokeWidth > 0 && (
          <Ellipse
            x={ecx}
            y={ecy}
            radiusX={erx}
            radiusY={ery}
            stroke={element.stroke}
            strokeWidth={element.strokeWidth + visualStyle.softStrokeWidth}
            opacity={sOpacity * visualStyle.softStrokeOpacity}
            dash={dash}
            fill="transparent"
            listening={false}
          />
        )}
        {/* Stroke layer */}
        <Ellipse
          x={ecx}
          y={ecy}
          radiusX={erx}
          radiusY={ery}
          stroke={element.stroke}
          strokeWidth={element.strokeWidth}
          opacity={sOpacity}
          dash={dash}
          fill="transparent"
        />
        {visualStyle.sketchJitter > 0 && (
          <Ellipse
            x={ecx + sketchOffset.x}
            y={ecy + sketchOffset.y}
            radiusX={erx}
            radiusY={ery}
            stroke={element.stroke}
            strokeWidth={Math.max(1, element.strokeWidth * 0.9)}
            opacity={sOpacity * visualStyle.sketchStrokeOpacity}
            dash={dash}
            fill="transparent"
            listening={false}
          />
        )}
        {/* Object name above the shape */}
        {element.objectName && element.showName !== false && (
          <Text
            x={(element.x || 0)}
            y={(element.y || 0) - 18}
            width={(element.width || 0)}
            text={element.objectName}
            fontSize={11}
            fontStyle="bold"
            fill="rgba(255,255,255,0.6)"
            align="center"
            listening={false}
          />
        )}
        {/* Description text inside the shape */}
        {element.description && (
          <Text
            x={(element.x || 0) + 16}
            y={(element.y || 0) + 16}
            width={(element.width || 0) - 32}
            height={(element.height || 0) - 32}
            text={element.description}
            fontSize={element.fontSize || 16}
            fontFamily={getKonvaFontFamily(element.fontFamily || 'sans')}
            fill={element.textColor || '#e2e8f0'}
            opacity={element.textOpacity ?? 1}
            align={element.textAlign || 'center'}
            verticalAlign="middle"
            wrap="word"
            listening={false}
          />
        )}
      </Group>
    );
  }

  if (element.type === 'text') {
    const tx = element.x || 0;
    const ty = element.y || 0;
    const tw = element.width || 200;
    const fSize = element.fontSize || 24;
    const fFamily = getKonvaFontFamily(element.fontFamily || 'sans');
    const tAlign = element.textAlign || 'left';

    return (
      <Group {...commonProps} onDblClick={(e) => onDblClickText && onDblClickText(element.id, e)}>
        {isSelected && !isEditingText && (
          <Rect
            x={tx - 3}
            y={ty - 3}
            width={tw + 6}
            height={(element.height || fSize * 1.4) + 6}
            stroke="rgba(167,139,250,0.4)"
            strokeWidth={2}
            dash={[4, 4]}
            listening={false}
          />
        )}
        <Text
          x={tx}
          y={ty}
          text={isEditingText ? '' : element.text || ''}
          fontSize={fSize}
          fontFamily={fFamily}
          fill={element.stroke}
          opacity={element.opacity}
          align={tAlign}
          width={tw}
          wrap="word"
        />
      </Group>
    );
  }

  if (element.type === 'entityToken') {
    const ex = element.x || 0;
    const ey = element.y || 0;
    const ew = element.width || 72;
    const eh = element.height || 92;
    const linkedEntity = element.linkedEntityId ? yjsStore.entitiesMap.get(element.linkedEntityId) : undefined;
    const canViewLinked = canViewCanvasEntity(linkedEntity);
    const mode = element.entityTokenMode || 'token';
    const frame = getEntityTokenFrameConfig(element.entityTokenFrame);
    const showEntityName = element.showName !== false;
    const displayName = canViewLinked ? linkedEntity.name : 'Скрыто';
    const initial = displayName.trim().charAt(0).toUpperCase() || '?';
    const accentStroke = canViewLinked ? element.stroke || '#a5b4fc' : 'rgba(248,113,113,0.65)';
    const tokenFill = canViewLinked ? element.fill || 'rgba(30,41,59,0.96)' : 'rgba(63,23,23,0.9)';
    const glowBlur = frame.glowOpacity > 0 ? 14 : 0;
    const rawImageSource = canViewLinked ? getEntityCanvasTokenImageSource(linkedEntity, mode) : '';
    const imageSource = resolveCanvasImageSource(rawImageSource);
    const strokeOpacity = element.strokeOpacity ?? 1;
    const entityStrokeWidth = Math.max(0, element.strokeWidth ?? (mode === 'art' ? frame.artStrokeWidth : frame.tokenStrokeWidth));
    const entityDash = getKonvaDash(element.strokeStyle ?? 'solid', Math.max(1, entityStrokeWidth));

    const openLinkedEntity = (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      if (canViewLinked && element.linkedEntityId) onOpenLinkedEntity?.(element.linkedEntityId, e);
    };

    if (mode === 'art') {
      return (
        <Group {...commonProps} onDblClick={openLinkedEntity}>
          {isSelected && (
            <Rect
              x={ex - 3}
              y={ey - 3}
              width={ew + 6}
              height={eh + 6}
              stroke="rgba(167,139,250,0.4)"
              strokeWidth={2}
              dash={[4, 4]}
              listening={false}
            />
          )}
          <Rect
            x={ex}
            y={ey}
            width={ew}
            height={eh}
            fill="rgba(15,23,42,0.86)"
            cornerRadius={frame.id === 'plain' ? 4 : 8}
            listening={false}
          />
          {imageSource ? (
            <ImageNode url={imageSource} x={ex} y={ey} width={ew} height={eh} fit="contain" />
          ) : (
            <Text
              x={ex}
              y={ey + eh / 2 - 18}
              width={ew}
              text={initial}
              fontSize={36}
              fontStyle="bold"
              fill="rgba(226,232,240,0.72)"
              align="center"
              listening={false}
            />
          )}
          <Rect
            x={ex}
            y={ey}
            width={ew}
            height={eh}
            fill="transparent"
            stroke={canViewLinked ? accentStroke : 'rgba(248,113,113,0.45)'}
            strokeWidth={entityStrokeWidth}
            dash={entityDash}
            opacity={strokeOpacity}
            cornerRadius={frame.id === 'plain' ? 4 : 8}
            shadowColor={accentStroke}
            shadowBlur={glowBlur}
            shadowOpacity={frame.glowOpacity * strokeOpacity}
            shadowOffsetY={2}
            listening={false}
          />
          {frame.id === 'ring' && (
            <Rect
              x={ex + 5}
              y={ey + 5}
              width={Math.max(0, ew - 10)}
              height={Math.max(0, eh - 10)}
              stroke={accentStroke}
              strokeWidth={1}
              opacity={0.36 * strokeOpacity}
              cornerRadius={6}
              listening={false}
            />
          )}
          {frame.id === 'badge' && (
            <Rect
              x={ex + 8}
              y={ey + 8}
              width={Math.max(0, ew - 16)}
              height={Math.max(0, eh - 16)}
              stroke={accentStroke}
              strokeWidth={1}
              dash={[8, 6]}
              opacity={0.3 * strokeOpacity}
              cornerRadius={5}
              listening={false}
            />
          )}
          {frame.id === 'hex' && (
            <Line
              points={[
                ex + 16, ey + 3,
                ex + ew - 16, ey + 3,
                ex + ew - 3, ey + 16,
                ex + ew - 3, ey + eh - 16,
                ex + ew - 16, ey + eh - 3,
                ex + 16, ey + eh - 3,
                ex + 3, ey + eh - 16,
                ex + 3, ey + 16,
              ]}
              closed
              stroke={accentStroke}
              strokeWidth={1.5}
              opacity={0.52 * strokeOpacity}
              listening={false}
            />
          )}
          {showEntityName && (
            <>
              <Rect
                x={ex}
                y={ey + eh - 30}
                width={ew}
                height={30}
                fill="rgba(2,6,23,0.72)"
                cornerRadius={frame.id === 'plain' ? [0, 0, 4, 4] : [0, 0, 8, 8]}
                listening={false}
              />
              <Text
                x={ex + 8}
                y={ey + eh - 22}
                width={ew - 16}
                text={displayName}
                fontSize={12}
                fontStyle="bold"
                fill="rgba(241,245,249,0.9)"
                align="center"
                listening={false}
              />
            </>
          )}
          {isEntityInfoOpen && canViewLinked && linkedEntity && (
            <>
              <Rect
                x={ex}
                y={ey}
                width={ew}
                height={eh}
                fill="rgba(2,6,23,0.78)"
                cornerRadius={frame.id === 'plain' ? 4 : 8}
                listening={false}
              />
              <Text
                x={ex + 12}
                y={ey + 14}
                width={Math.max(20, ew - 24)}
                text={linkedEntity.name}
                fontSize={Math.min(18, Math.max(12, ew / 12))}
                fontStyle="bold"
                fill="rgba(241,245,249,0.96)"
                wrap="word"
                listening={false}
              />
              <Text
                x={ex + 12}
                y={ey + 42}
                width={Math.max(20, ew - 24)}
                height={Math.max(24, eh - 58)}
                text={getPlainEntityDescription(linkedEntity) || 'Описание пока пустое.'}
                fontSize={Math.min(13, Math.max(10, ew / 18))}
                fill="rgba(226,232,240,0.74)"
                lineHeight={1.25}
                wrap="word"
                ellipsis
                listening={false}
              />
            </>
          )}
          {canViewLinked && (
            <Group
              x={ex + ew - 22}
              y={ey + eh - 22}
              onClick={(e) => {
                e.cancelBubble = true;
                onShowLinkedEntityInfo?.(element.id, e);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                onShowLinkedEntityInfo?.(element.id, e);
              }}
            >
              <Circle radius={10} fill={isEntityInfoOpen ? "rgba(14,165,233,0.72)" : "rgba(2,6,23,0.72)"} stroke="rgba(255,255,255,0.28)" strokeWidth={1} />
              <Text x={-5} y={-7} width={10} text="i" fontSize={12} fontStyle="bold" fill="#e0f2fe" align="center" />
            </Group>
          )}
        </Group>
      );
    }

    const tokenSize = Math.min(ew, Math.max(40, eh - 24));
    const radius = tokenSize / 2;
    const cxToken = ex + ew / 2;
    const cyToken = showEntityName ? ey + radius : ey + eh / 2;

    return (
      <Group {...commonProps} onDblClick={openLinkedEntity}>
        {isSelected && (
          <Rect
            x={ex - 3}
            y={ey - 3}
            width={ew + 6}
            height={eh + 6}
            stroke="rgba(167,139,250,0.4)"
            strokeWidth={2}
            dash={[4, 4]}
            listening={false}
          />
        )}
        {frame.id === 'badge' && (
          <Rect
            x={ex}
            y={ey + Math.max(0, radius * 0.55)}
            width={ew}
            height={Math.max(28, eh - radius * 0.55)}
            fill="rgba(15,23,42,0.72)"
            stroke={accentStroke}
            strokeWidth={1}
            cornerRadius={12}
            opacity={0.92}
            listening={false}
          />
        )}
        {frame.id === 'hex' && (
          <RegularPolygon
            x={cxToken}
            y={cyToken}
            sides={6}
            radius={radius + 7}
            rotation={30}
            fill="rgba(15,23,42,0.82)"
            stroke={accentStroke}
            strokeWidth={2}
            opacity={0.95}
            listening={false}
          />
        )}
        {frame.id === 'ring' && (
          <Circle
            x={cxToken}
            y={cyToken}
            radius={radius + 5}
            fill="rgba(15,23,42,0.42)"
            stroke={accentStroke}
            strokeWidth={2}
            opacity={0.78}
            listening={false}
          />
        )}
        <Circle
          x={cxToken}
          y={cyToken}
          radius={radius}
          fill={tokenFill}
          stroke={accentStroke}
          strokeWidth={frame.tokenStrokeWidth}
          shadowColor="#000000"
          shadowBlur={frame.id === 'plain' ? 0 : 12}
          shadowOpacity={frame.id === 'plain' ? 0 : 0.5}
          shadowOffsetY={2}
        />
        {imageSource ? (
          <Group
            clipFunc={(ctx) => {
              ctx.arc(cxToken, cyToken, Math.max(0, radius - 2), 0, Math.PI * 2, false);
            }}
          >
            <ImageNode url={imageSource} x={cxToken - radius} y={cyToken - radius} width={tokenSize} height={tokenSize} fit="cover" />
          </Group>
        ) : (
          <Text
            text={initial}
            x={cxToken - radius}
            y={cyToken - 14}
            fill="rgba(241,245,249,0.9)"
            fontSize={28}
            fontStyle="bold"
            align="center"
            width={tokenSize}
            listening={false}
          />
        )}
        <Circle
          x={cxToken}
          y={cyToken}
          radius={radius}
          stroke={accentStroke}
          strokeWidth={Math.max(1, frame.tokenStrokeWidth)}
          fill="transparent"
          listening={false}
        />
        {showEntityName && (
          <Text
            text={displayName}
            x={ex - 24}
            y={ey + tokenSize + 7}
            fill="rgba(203,213,225,0.88)"
            fontSize={12}
            fontStyle="bold"
            align="center"
            width={ew + 48}
            listening={false}
          />
        )}
        {canViewLinked && (
          <Group
            x={cxToken + radius - 10}
            y={cyToken + radius - 10}
            onClick={(e) => {
              e.cancelBubble = true;
              onShowLinkedEntityInfo?.(element.id, e);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              onShowLinkedEntityInfo?.(element.id, e);
            }}
          >
            <Circle radius={10} fill="rgba(2,6,23,0.76)" stroke="rgba(255,255,255,0.28)" strokeWidth={1} />
            <Text x={-5} y={-7} width={10} text="i" fontSize={12} fontStyle="bold" fill="#e0f2fe" align="center" />
          </Group>
        )}
      </Group>
    );
  }

  if (element.type === 'image') {
    const ix = element.x || 0;
    const iy = element.y || 0;
    const iw = element.width || 200;
    const ih = element.height || 200;
    const imageSource = element.imageAssetPath ? getAssetUrl(element.imageAssetPath) : element.imageUrl || '';
    const sOpacity = element.strokeOpacity ?? 1;
    const sketchOffset = getVisualStyleOffset(element.id, 'image-stroke', visualStyle.sketchJitter);

    return (
      <Group {...commonProps}>
        {isSelected && (
          <Rect
            x={ix - 3}
            y={iy - 3}
            width={iw + 6}
            height={ih + 6}
            stroke="rgba(167,139,250,0.4)"
            strokeWidth={2}
            dash={[4, 4]}
            listening={false}
          />
        )}
        <ImageNode url={imageSource} x={ix} y={iy} width={iw} height={ih} />
        {element.strokeWidth > 0 && element.stroke !== 'transparent' && (
          <>
            {visualStyle.softStrokeWidth > 0 && (
              <Rect
                x={ix}
                y={iy}
                width={iw}
                height={ih}
                stroke={element.stroke}
                strokeWidth={element.strokeWidth + visualStyle.softStrokeWidth}
                opacity={sOpacity * visualStyle.softStrokeOpacity}
                dash={getKonvaDash(element.strokeStyle, element.strokeWidth)}
                listening={false}
              />
            )}
            <Rect
              x={ix}
              y={iy}
              width={iw}
              height={ih}
              stroke={element.stroke}
              strokeWidth={element.strokeWidth}
              opacity={sOpacity}
              dash={getKonvaDash(element.strokeStyle, element.strokeWidth)}
              listening={false}
            />
            {visualStyle.sketchJitter > 0 && (
              <Rect
                x={ix + sketchOffset.x}
                y={iy + sketchOffset.y}
                width={iw}
                height={ih}
                stroke={element.stroke}
                strokeWidth={Math.max(1, element.strokeWidth * 0.9)}
                opacity={sOpacity * visualStyle.sketchStrokeOpacity}
                dash={getKonvaDash(element.strokeStyle, element.strokeWidth)}
                listening={false}
              />
            )}
          </>
        )}
      </Group>
    );
  }

  if (element.type === 'frame') {
    const fx = element.x || 0;
    const fy = element.y || 0;
    const fw = element.width || 300;
    const fh = element.height || 200;
    const label = element.frameLabel || 'Frame';

    // Derive header color from element's fill or stroke
    const baseColor = element.fill && element.fill !== '' ? element.fill : (element.stroke || 'rgba(99,102,241,0.25)');
    // Make a slightly more opaque version for the header
    const headerFill = baseColor.includes('rgba') ? baseColor.replace(/[\d.]+\)$/, '0.15)') : baseColor + '26';
    const labelColor = baseColor.includes('rgba') ? baseColor.replace(/[\d.]+\)$/, '0.7)') : baseColor;
    const dash = getKonvaDash(element.strokeStyle, element.strokeWidth);
    const sOpacity = element.strokeOpacity ?? 1;
    const sketchOffset = getVisualStyleOffset(element.id, 'frame-stroke', visualStyle.sketchJitter);

    return (
      <Group {...commonProps}>
        {/* Selection outline */}
        {isSelected && (
          <Rect
            x={fx - 3}
            y={fy - 23}
            width={fw + 6}
            height={fh + 26}
            stroke="rgba(167,139,250,0.4)"
            strokeWidth={2}
            dash={[4, 4]}
            listening={false}
          />
        )}
        {/* Frame label header — this is the drag handle */}
        <Rect
          x={fx}
          y={fy - 20}
          width={fw}
          height={18}
          fill={headerFill}
          cornerRadius={[4, 4, 0, 0]}
        />
        <Text
          x={fx + 6}
          y={fy - 18}
          text={label}
          fontSize={11}
          fontStyle="bold"
          fill={labelColor}
          listening={false}
        />
        {visualStyle.softStrokeWidth > 0 && (
          <Rect
            x={fx}
            y={fy}
            width={fw}
            height={fh}
            stroke={element.stroke || 'rgba(165,180,252,0.25)'}
            strokeWidth={(element.strokeWidth || 1) + visualStyle.softStrokeWidth}
            opacity={sOpacity * visualStyle.softStrokeOpacity}
            dash={dash || [8, 4]}
            cornerRadius={[0, 0, 4, 4]}
            listening={false}
          />
        )}
        {/* Frame body — transparent to clicks, let inner objects be clicked */}
        <Rect
          x={fx}
          y={fy}
          width={fw}
          height={fh}
          fill={element.fill || 'rgba(99,102,241,0.04)'}
          stroke={element.stroke || 'rgba(165,180,252,0.25)'}
          strokeWidth={element.strokeWidth || 1}
          dash={dash || [8, 4]}
          cornerRadius={[0, 0, 4, 4]}
          listening={false}
        />
        {visualStyle.sketchJitter > 0 && (
          <Rect
            x={fx + sketchOffset.x}
            y={fy + sketchOffset.y}
            width={fw}
            height={fh}
            stroke={element.stroke || 'rgba(165,180,252,0.25)'}
            strokeWidth={Math.max(1, (element.strokeWidth || 1) * 0.9)}
            opacity={sOpacity * visualStyle.sketchStrokeOpacity}
            dash={dash || [8, 4]}
            cornerRadius={[0, 0, 4, 4]}
            listening={false}
          />
        )}
      </Group>
    );
  }

  return null;
});

// ─── Sub-component: Render a Konva image from URL (uses hook) ───

function ImageNode(props: {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fit?: 'stretch' | 'contain' | 'cover';
}) {
  if (isAnimatedGifSource(props.url)) {
    return <AnimatedGifImageNode {...props} />;
  }

  return <StaticImageNode {...props} />;
}

function AnimatedGifImageNode({
  url,
  x,
  y,
  width,
  height,
  fit = 'stretch',
}: {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fit?: 'stretch' | 'contain' | 'cover';
}) {
  return (
    <Group>
      <Rect x={x} y={y} width={width} height={height} fill="rgba(0,0,0,0.001)" />
      <Html
        groupProps={{ x, y, listening: false }}
        divProps={{
          style: {
            width: `${Math.max(1, width)}px`,
            height: `${Math.max(1, height)}px`,
            overflow: 'hidden',
            pointerEvents: 'none',
            userSelect: 'none',
          },
        }}
      >
        <img
          src={url}
          alt=""
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            objectFit: fit === 'cover' ? 'cover' : fit === 'contain' ? 'contain' : 'fill',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
      </Html>
    </Group>
  );
}

function StaticImageNode({
  url,
  x,
  y,
  width,
  height,
  fit = 'stretch',
}: {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fit?: 'stretch' | 'contain' | 'cover';
}) {
  const [img] = useImage(url, 'anonymous');
  const imageRef = useRef<Konva.Image>(null);
  const isAnimatedGif = isAnimatedGifSource(url);

  const renderAnimatedGif = (nodeX: number, nodeY: number, nodeWidth: number, nodeHeight: number) => (
    <Group>
      <Rect x={nodeX} y={nodeY} width={nodeWidth} height={nodeHeight} fill="rgba(0,0,0,0.001)" />
      <Html
        groupProps={{ x: nodeX, y: nodeY, listening: false }}
        divProps={{
          style: {
            width: `${Math.max(1, nodeWidth)}px`,
            height: `${Math.max(1, nodeHeight)}px`,
            overflow: 'hidden',
            pointerEvents: 'none',
            userSelect: 'none',
          },
        }}
      >
        <img
          src={url}
          alt=""
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            objectFit: 'fill',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
      </Html>
    </Group>
  );

  useEffect(() => {
    if (!img || !isAnimatedGif) return;
    let frameId = 0;
    const drawFrame = () => {
      imageRef.current?.getLayer()?.batchDraw();
      frameId = window.requestAnimationFrame(drawFrame);
    };
    frameId = window.requestAnimationFrame(drawFrame);
    return () => window.cancelAnimationFrame(frameId);
  }, [img, isAnimatedGif]);

  if (!img) {
    // Placeholder while loading
    return (
      <Group>
        <Rect x={x} y={y} width={width} height={height} fill="rgba(167,139,250,0.08)" stroke="rgba(167,139,250,0.3)" strokeWidth={1} dash={[4, 4]} cornerRadius={4} />
        <Text x={x} y={y + height / 2 - 8} width={width} text="⏳" fontSize={16} align="center" fill="rgba(255,255,255,0.4)" />
      </Group>
    );
  }

  if (fit === 'stretch') {
    if (isAnimatedGif) return renderAnimatedGif(x, y, width, height);
    return <KonvaImage ref={imageRef} image={img} x={x} y={y} width={width} height={height} />;
  }

  const imageWidth = img.naturalWidth || img.width;
  const imageHeight = img.naturalHeight || img.height;
  if (!imageWidth || !imageHeight || !width || !height) {
    if (isAnimatedGif) return renderAnimatedGif(x, y, width, height);
    return <KonvaImage ref={imageRef} image={img} x={x} y={y} width={width} height={height} />;
  }

  const scale = fit === 'cover'
    ? Math.max(width / imageWidth, height / imageHeight)
    : Math.min(width / imageWidth, height / imageHeight);
  const fittedWidth = imageWidth * scale;
  const fittedHeight = imageHeight * scale;

  if (isAnimatedGif) {
    return renderAnimatedGif(x + (width - fittedWidth) / 2, y + (height - fittedHeight) / 2, fittedWidth, fittedHeight);
  }

  return (
    <KonvaImage
      ref={imageRef}
      image={img}
      x={x + (width - fittedWidth) / 2}
      y={y + (height - fittedHeight) / 2}
      width={fittedWidth}
      height={fittedHeight}
    />
  );
}

// ─── Sub-component: Point handles for vector editing ───

function PointHandles({
  element,
  onPointDragStart,
  onPointDragMove,
  onPointDragEnd,
  onPointDoubleClick,
}: {
  element: DrawElement;
  onPointDragStart: (idx: number) => void;
  onPointDragMove: (idx: number, x: number, y: number, shiftKey?: boolean) => void;
  onPointDragEnd: () => void;
  onPointDoubleClick: (idx: number) => void;
}) {
  if (!element.points || element.points.length < 4) return null;

  const handles: { x: number; y: number; idx: number }[] = [];
  for (let i = 0; i < element.points.length; i += 2) {
    handles.push({ x: element.points[i], y: element.points[i + 1], idx: i / 2 });
  }

  return (
    <>
      {handles.map((h) => (
        <Circle
          key={h.idx}
          x={h.x}
          y={h.y}
          radius={POINT_HANDLE_RADIUS}
          fill="#a78bfa"
          stroke="white"
          strokeWidth={1.5}
          draggable
          onDragStart={() => onPointDragStart(h.idx)}
          onDragMove={(e) => {
            const pos = e.target.position();
            onPointDragMove(h.idx, pos.x, pos.y, e.evt.shiftKey);
          }}
          onDragEnd={onPointDragEnd}
          onDblClick={(e) => {
            e.cancelBubble = true;
            onPointDoubleClick(h.idx);
          }}
          onMouseEnter={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'move';
          }}
          onMouseLeave={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'default';
          }}
        />
      ))}
    </>
  );
}

// ─── Sub-component: Resize handles for shapes ───

function ResizeHandles({
  element,
  onResizeDragMove,
  onResizeDragEnd,
}: {
  element: DrawElement;
  onResizeDragMove: (corner: string, x: number, y: number) => void;
  onResizeDragEnd: () => void;
}) {
  if (element.type !== 'rectangle' && element.type !== 'ellipse' && element.type !== 'text' && element.type !== 'image' && element.type !== 'entityToken' && element.type !== 'frame') return null;

  const ex = element.x || 0;
  const ey = element.y || 0;
  const ew = element.width || (element.type === 'text' ? 200 : element.type === 'image' || element.type === 'entityToken' ? 200 : element.type === 'frame' ? 300 : 0);
  const eh = element.height || (element.type === 'text' ? (element.fontSize || 24) * 1.4 : element.type === 'image' || element.type === 'entityToken' ? 200 : element.type === 'frame' ? 200 : 0);

  const corners = [
    { id: 'tl', x: ex, y: ey, cursor: 'nwse-resize' },
    { id: 'tr', x: ex + ew, y: ey, cursor: 'nesw-resize' },
    { id: 'bl', x: ex, y: ey + eh, cursor: 'nesw-resize' },
    { id: 'br', x: ex + ew, y: ey + eh, cursor: 'nwse-resize' },
  ];

  const cx = ex + ew / 2;
  const cy = ey + eh / 2;

  return (
    <Group x={cx} y={cy} offsetX={cx} offsetY={cy} rotation={element.rotation || 0}>
      {corners.map((c) => (
        <Rect
          key={c.id}
          x={c.x - RESIZE_HANDLE_SIZE / 2}
          y={c.y - RESIZE_HANDLE_SIZE / 2}
          width={RESIZE_HANDLE_SIZE}
          height={RESIZE_HANDLE_SIZE}
          fill="white"
          stroke="#a78bfa"
          strokeWidth={1.5}
          cornerRadius={1}
          draggable
          onDragMove={(e) => {
            const pos = e.target.position();
            onResizeDragMove(c.id, pos.x + RESIZE_HANDLE_SIZE / 2, pos.y + RESIZE_HANDLE_SIZE / 2);
          }}
          onDragEnd={onResizeDragEnd}
          onMouseEnter={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = c.cursor;
          }}
          onMouseLeave={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'default';
          }}
        />
      ))}
    </Group>
  );
}

// ─── Sub-component: Rotation handle for shapes and text ───

function RotationHandle({
  element,
  onRotateDragMove,
  onRotateDragEnd,
}: {
  element: DrawElement;
  onRotateDragMove: (angle: number) => void;
  onRotateDragEnd?: () => void;
}) {
  if (element.type === 'line' || element.type === 'arrow') return null;

  const ex = element.x || 0;
  const ey = element.y || 0;
  const ew = element.width || 0;
  const eh = element.height || 0;

  const cx = ex + ew / 2;
  const cy = ey + eh / 2;
  
  // Connect line from top center bounds to rotation handle (30px above)
  const handleX = cx;
  const handleY = ey - 30;

  return (
    <Group x={cx} y={cy} offsetX={cx} offsetY={cy} rotation={element.rotation || 0}>
      <Line points={[cx, ey, cx, handleY]} stroke="#a78bfa" strokeWidth={1} />
      <Circle
        x={handleX}
        y={handleY}
        radius={5}
        fill="white"
        stroke="#a78bfa"
        strokeWidth={1.5}
        draggable
        onDragMove={(e) => {
          // When dragging, we use the absolute pointer position to calculate angle
          // Because local position is constrained by parent's rotation.
          // Better logic: calculate angle relative to element's center from the Stage pointer!
          const stage = e.target.getStage();
          if (!stage) return;
          const transform = stage.getAbsoluteTransform().copy().invert();
          const pointerPos = stage.getPointerPosition();
          if (!pointerPos) return;
          
          const relativePointer = transform.point(pointerPos);
          
          const dx = relativePointer.x - cx;
          const dy = relativePointer.y - cy;
          let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90; // +90 because handle is visually "above"
          
          // Shift → snap to 30° increments
          if (e.evt.shiftKey) {
            angle = Math.round(angle / 30) * 30;
          }

          // Reset circle's local position because we don't actually want it to move locally, 
          // we just want to update the parent Group's rotation!
          e.target.position({ x: handleX, y: handleY });
          
          onRotateDragMove(angle);
        }}
        onDragEnd={() => onRotateDragEnd?.()}
        onMouseEnter={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'grab';
        }}
        onMouseLeave={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'default';
        }}
      />
    </Group>
  );
}

// ─── Sub-component: Pulsating ring for portals ───

function PortalPulseRing() {
  const ringRef = useRef<Konva.Circle>(null);

  useEffect(() => {
    const node = ringRef.current;
    if (!node) return;
    
    let animFrame: number;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const t = (Math.sin(elapsed * 1.5) + 1) / 2; // 0..1 oscillation
      const scale = 1.0 + t * 0.15;
      const opacity = 0.15 + t * 0.35;
      node.scaleX(scale);
      node.scaleY(scale);
      node.opacity(opacity);
      node.getLayer()?.batchDraw();
      animFrame = requestAnimationFrame(animate);
    };
    
    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, []);

  return (
    <Circle
      ref={ringRef}
      radius={48}
      stroke="#818cf8"
      strokeWidth={2}
      dash={[12, 6]}
      opacity={0.3}
      listening={false}
    />
  );
}

// ─── Sub-component: Ping pulse animation ───

function PingPulse({ color }: { color: string }) {
  const circleRef = useRef<Konva.Circle>(null);
  const ringRef = useRef<Konva.Circle>(null);

  useEffect(() => {
    const circle = circleRef.current;
    const ring = ringRef.current;
    if (!circle || !ring) return;

    const startTime = Date.now();
    const duration = PING_DURATION_MS;
    let animFrame: number;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out: ring expands and fades
      const ringScale = 1 + progress * 4; // 1x → 5x
      const ringOpacity = 0.7 * (1 - progress); // 0.7 → 0
      const ringWidth = 3 * (1 - progress * 0.8); // 3 → 0.6

      // Center dot: fade slower, then fade out
      const dotOpacity = progress < 0.3 ? 1 : 1 - (progress - 0.3) / 0.7;

      ring.scaleX(ringScale);
      ring.scaleY(ringScale);
      ring.opacity(ringOpacity);
      ring.strokeWidth(ringWidth);
      circle.opacity(dotOpacity);

      ring.getLayer()?.batchDraw();

      if (progress < 1) {
        animFrame = requestAnimationFrame(animate);
      }
    };

    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, []);

  return (
    <>
      {/* Expanding ring */}
      <Circle
        ref={ringRef}
        radius={14}
        stroke={color}
        strokeWidth={3}
        opacity={0.7}
        listening={false}
      />
      {/* Center dot */}
      <Circle
        ref={circleRef}
        radius={5}
        fill={color}
        shadowColor={color}
        shadowBlur={12}
        opacity={1}
        listening={false}
      />
    </>
  );
}

// ─── Sub-component: Fog of War layer ───
// Renders a WORLD-SPACE fog texture using an offscreen canvas as Konva Image source.
// The texture always covers ≥2× the viewport in world units so fog never runs out on any monitor.
// Uses the canvas element directly (no data-url roundtrip) to avoid flicker.

const FOG_COLOR = '#1e1e2e';
const FOG_GM_OPACITY = 0.35;
/** Texture covers viewport × PAD_FACTOR world area in both axes */
const FOG_PAD_FACTOR = 2.5;
/** Maximum texture dimension in pixels (balance quality vs memory) */
const FOG_MAX_TEX = 4096;
const SHARED_FOG_CANVAS = typeof document !== 'undefined' ? document.createElement('canvas') : null;

function FogOfWarLayer({
  fogReveals,
  isGM,
  stageWidth,
  stageHeight,
  stageScale,
  stageX,
  stageY,
}: {
  fogReveals: FogReveal[];
  isGM: boolean;
  stageWidth: number;
  stageHeight: number;
  stageScale: number;
  stageX: number;
  stageY: number;
}) {
  const gmFogVisible = useCanvasDrawStore((s) => s.gmFogVisible);
  const playerFogVisible = useCanvasDrawStore((s) => s.playerFogVisible);
  const shouldShow = isGM ? gmFogVisible : playerFogVisible;
  const fogLayerRef = useRef<Konva.Layer>(null);

  // Persistent offscreen canvas (reused, not recreated)
  const fogCanvas = SHARED_FOG_CANVAS;
  const safeStageScale = Number.isFinite(stageScale) && stageScale > 0 ? stageScale : 1;

  // ── Calculate world area ──
  // Viewport in world coords
  const viewWorldW = stageWidth / safeStageScale;
  const viewWorldH = stageHeight / safeStageScale;
  // Texture covers PAD_FACTOR × viewport
  const worldW = viewWorldW * FOG_PAD_FACTOR;
  const worldH = viewWorldH * FOG_PAD_FACTOR;
  // Center on current viewport
  const viewCxWorld = (-stageX + stageWidth / 2) / safeStageScale;
  const viewCyWorld = (-stageY + stageHeight / 2) / safeStageScale;
  const worldLeft = viewCxWorld - worldW / 2;
  const worldTop = viewCyWorld - worldH / 2;

  // ── Texture pixel size ──
  // Maintain roughly 1:1 screen-to-texture pixel ratio, capped
  const texW = Math.min(Math.round(stageWidth * FOG_PAD_FACTOR * 0.8), FOG_MAX_TEX);
  const texH = Math.min(Math.round(stageHeight * FOG_PAD_FACTOR * 0.8), FOG_MAX_TEX);
  const hasDrawableFogTexture = Boolean(
    shouldShow
    && fogCanvas
    && stageWidth > 0
    && stageHeight > 0
    && worldW > 0
    && worldH > 0
    && texW > 0
    && texH > 0
  );

  // ── Draw fog onto offscreen canvas (useLayoutEffect for synchronous update before paint) ──
  useLayoutEffect(() => {
    if (!hasDrawableFogTexture || !fogCanvas) return;
    const canvas = fogCanvas;
    if (canvas.width !== texW || canvas.height !== texH) {
      canvas.width = texW;
      canvas.height = texH;
    }
    const ctx = canvas.getContext('2d')!;

    // Clear canvas to transparent (PATCH-BASED MODEL: we paint fog on top)
    ctx.clearRect(0, 0, texW, texH);

    // If no fog patches, canvas stays transparent (no fog at all)
    if (!fogReveals || fogReveals.length === 0) {
      fogLayerRef.current?.batchDraw();
      return;
    }

    // World → texture pixel helpers
    const worldToTexX = (wx: number) => ((wx - worldLeft) / worldW) * texW;
    const worldToTexY = (wy: number) => ((wy - worldTop) / worldH) * texH;
    const worldSizeToTex = (ws: number) => (ws / worldW) * texW;

    // Draw fog patches as dark areas
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = FOG_COLOR;
    for (const r of fogReveals) {
      const tx = worldToTexX(r.x);
      const ty = worldToTexY(r.y);
      if (r.type === 'circle') {
        const tr = worldSizeToTex(r.width / 2);
        ctx.beginPath();
        ctx.arc(tx, ty, tr, 0, Math.PI * 2);
        ctx.fill();
      } else if (r.type === 'rect') {
        const tw = worldSizeToTex(r.width);
        const th = (r.height / worldH) * texH;
        ctx.beginPath();
        ctx.rect(tx, ty, tw, th);
        ctx.fill();
      }
    }
    fogLayerRef.current?.batchDraw();
  }, [hasDrawableFogTexture, fogReveals, worldLeft, worldTop, worldW, worldH, texW, texH, fogCanvas]);

  if (!hasDrawableFogTexture || !fogCanvas) return null;

  return (
    <Layer ref={fogLayerRef} listening={false} opacity={isGM ? FOG_GM_OPACITY : 1}>
      <KonvaImage
        image={fogCanvas}
        x={worldLeft}
        y={worldTop}
        width={worldW}
        height={worldH}
        listening={false}
      />
    </Layer>
  );
}

// ─── Main Component ───

export function InfiniteCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [imagePickerTarget, setImagePickerTarget] = useState<CanvasImageTarget | null>(null);
  const [entityDropChoice, setEntityDropChoice] = useState<EntityDropChoiceTarget | null>(null);
  const { activeCanvasId, setTransform, navigate } = useCanvasStore();
  const { openWindow } = useWindowStore();
  const {
    activeTool,
    currentStyle,
    drawingElement,
    selectedElementIds,
    isDraggingElement,
    dragStartPoint,
    marquee,
    editingTextId,
    editingFrameLabelId,
    startDrawing,
    updateDrawing,
    finishDrawing,
    selectElement,
    selectElements,
    clearSelection,
    setTool,
    setEditingPointIndex,
    startDragging,
    stopDragging,
    startMarquee,
    updateMarquee,
    finishMarquee,
    copyToClipboard,
    getClipboard,
    setEditingTextId,
    setEditingFrameLabelId,
    setDraggingGlobal,
  } = useCanvasDrawStore();
  const { openConfirm } = useUIStore();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const upsertNotification = useNotificationStore((state) => state.upsertNotification);
  const updateNotification = useNotificationStore((state) => state.updateNotification);
  const updateNotificationProgress = useNotificationStore((state) => state.updateProgress);
  const registerAbortCallback = useNotificationStore((state) => state.registerAbortCallback);
  const unregisterAbortCallback = useNotificationStore((state) => state.unregisterAbortCallback);
  const registerRetryCallback = useNotificationStore((state) => state.registerRetryCallback);
  const unregisterRetryCallback = useNotificationStore((state) => state.unregisterRetryCallback);
  const pendingCanvasImageUploadsRef = useRef<Map<string, { file: File; target: CanvasImageTarget; centerOnPoint: boolean }>>(new Map());
  const uploadAndInsertCanvasImageRef = useRef<CanvasImageUploadHandler | null>(null);
  const uploadProgressThrottleRef = useRef<Map<string, { percent: number; updatedAt: number }>>(new Map());
  
  // ─── Grid settings ───
  const gridEnabled = useCanvasDrawStore((s) => s.gridEnabled);
  const gridType = useCanvasDrawStore((s) => s.gridType);
  const gridSpacing = useCanvasDrawStore((s) => s.gridSpacing);

  // ─── Fog of War ───
  const fogReveals = useCanvasSyncStore((s) => s.fogReveals);
  const syncFogArray = useCanvasSyncStore((s) => s.syncFogArray);
  const fogTool = useCanvasDrawStore((s) => s.fogTool);
  const playerFogVisible = useCanvasDrawStore((s) => s.playerFogVisible);
  const togglePlayerFog = useCanvasDrawStore((s) => s.togglePlayerFog);
  const isGM = yjsStore.localRole === 'gm';
  const fogDrawingRef = useRef(false);
  const fogBrushTipRef = useRef({ x: 0, y: 0 });
  const [fogPreview, setFogPreview] = useState<{ canvasId: string; reveals: FogReveal[] } | null>(null);
  const fogPreviewRef = useRef<{ canvasId: string; reveals: FogReveal[] } | null>(null);
  const renderedFogReveals = fogPreview?.canvasId === activeCanvasId ? fogPreview.reveals : fogReveals;
  
  const { joinCanvas, leaveCanvas, syncElementsArray: pushHistory, undo, redo } = useCanvasSyncStore();
  const [portalMenu, setPortalMenu] = useState<{
    x: number;
    y: number;
    portal: Entity;
  } | null>(null);
  const [entityTokenInfo, setEntityTokenInfo] = useState<{
    x: number;
    y: number;
    elementId: string;
  } | null>(null);
  const [entityTokenInfoTab, setEntityTokenInfoTab] = useState<CharacterCompactTab>('stats');
  const [entityTokenMenu, setEntityTokenMenu] = useState<{
    x: number;
    y: number;
    elementId: string;
  } | null>(null);
  const canvasElements = useEntitiesByParent(activeCanvasId);

  // ─── Awareness: remote cursors ───
  const remoteCursors = useCanvasSyncStore((s) => s.remoteCursors);
  const setLocalCursor = useCanvasSyncStore((s) => s.setLocalCursor);
  const sendPing = useCanvasSyncStore((s) => s.sendPing);
  const cursorThrottleRef = useRef(0);
  const [cursorNow, setCursorNow] = useState(() => Date.now());
  const hasRemotePings = useMemo(
    () => Object.values(remoteCursors).some(cursor => Boolean(cursor.ping)),
    [remoteCursors]
  );

  useEffect(() => {
    if (!hasRemotePings) return;
    const timer = window.setInterval(() => setCursorNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [hasRemotePings]);

  const setCanvasFogPreview = useCallback((preview: { canvasId: string; reveals: FogReveal[] }) => {
    fogPreviewRef.current = preview;
    setFogPreview(preview);
  }, []);

  const clearCanvasFogPreview = useCallback(() => {
    fogPreviewRef.current = null;
    setFogPreview(null);
  }, []);

  const applyFogBrushOperation = useCallback(
    (tool: 'revealBrush' | 'coverBrush', patch: FogReveal) => {
      const currentPreview = fogPreviewRef.current;
      const base = currentPreview?.canvasId === activeCanvasId
        ? currentPreview.reveals
        : useCanvasSyncStore.getState().fogReveals;
      const reveals = tool === 'coverBrush'
        ? [...base, patch]
        : base.filter((reveal) => !fogRevealsOverlap(reveal, patch));
      setCanvasFogPreview({ canvasId: activeCanvasId, reveals });
    },
    [activeCanvasId, setCanvasFogPreview]
  );

  const commitCanvasFogPreview = useCallback(() => {
    const preview = fogPreviewRef.current;
    if (!preview || preview.canvasId !== activeCanvasId) {
      clearCanvasFogPreview();
      return false;
    }
    syncFogArray(preview.reveals);
    clearCanvasFogPreview();
    return true;
  }, [activeCanvasId, syncFogArray, clearCanvasFogPreview]);
  
  // ─── Ping: 'G' key hold state ───
  const pingKeyRef = useRef(false);

  useEffect(() => {
    if (activeCanvasId) {
      joinCanvas(activeCanvasId);
    } else {
      leaveCanvas();
    }
  }, [activeCanvasId, joinCanvas, leaveCanvas]);

  useEffect(() => {
    if (activeTool === 'image') return;
    const timeoutId = window.setTimeout(() => setImagePickerTarget(null), 0);
    return () => window.clearTimeout(timeoutId);
  }, [activeTool]);

  // Force re-render when draw elements change in Yjs
  const [, setDrawVer] = useState(0);
  useEffect(() => {
    const handler = () => setDrawVer((v) => v + 1);
    yjsStore.entitiesMap.observe(handler);
    return () => yjsStore.entitiesMap.unobserve(handler);
  }, []);

  const drawElements = useCanvasSyncStore((s) => s.elements);
  const [dragPreview, setDragPreview] = useState<{ canvasId: string; elements: DrawElement[] } | null>(null);
  const [objectSnapPreview, setObjectSnapPreview] = useState<{ x: number; y: number } | null>(null);
  const renderedDrawElements = dragPreview?.canvasId === activeCanvasId ? dragPreview.elements : drawElements;
  const dragPreviewRef = useRef<{ canvasId: string; elements: DrawElement[] } | null>(null);

  const setCanvasDragPreview = useCallback((preview: { canvasId: string; elements: DrawElement[] }) => {
    dragPreviewRef.current = preview;
    setDragPreview(preview);
  }, []);

  const clearCanvasDragPreview = useCallback(() => {
    dragPreviewRef.current = null;
    setDragPreview(null);
  }, []);

  const commitCanvasDragPreview = useCallback(() => {
    const preview = dragPreviewRef.current;
    if (!preview || preview.canvasId !== activeCanvasId) return false;
    saveDrawElements(activeCanvasId, preview.elements);
    clearCanvasDragPreview();
    return true;
  }, [activeCanvasId, clearCanvasDragPreview]);

  const insertImageElement = useCallback((options: {
    sourceUrl: string;
    assetPath?: string;
    objectName?: string;
    canvasX: number;
    canvasY: number;
    naturalWidth: number;
    naturalHeight: number;
    centerOnPoint?: boolean;
  }) => {
    const { width, height } = getScaledImageDimensions(options.naturalWidth, options.naturalHeight);
    const elements = getDrawElements(activeCanvasId);
    pushHistory(elements);
    const newEl: DrawElement = {
      id: generateDrawId(),
      type: 'image',
      x: options.centerOnPoint ? options.canvasX - width / 2 : options.canvasX,
      y: options.centerOnPoint ? options.canvasY - height / 2 : options.canvasY,
      width,
      height,
      imageUrl: options.assetPath ? undefined : options.sourceUrl,
      imageAssetPath: options.assetPath,
      objectName: options.objectName,
      stroke: 'transparent',
      strokeWidth: 0,
      strokeStyle: 'solid',
      visualStyle: currentStyle.visualStyle,
      opacity: 1,
      startCap: 'none',
      endCap: 'none',
      zIndex: elements.length,
    };
    saveDrawElements(activeCanvasId, [...elements, newEl]);
    setTool('select');
    selectElement(newEl.id);
  }, [activeCanvasId, currentStyle.visualStyle, pushHistory, selectElement, setTool]);

  const insertEntityTokenElement = useCallback(async (entityId: string, point: { x: number; y: number }, mode?: EntityTokenMode): Promise<boolean> => {
    if (!canEditCanvasEntityById(activeCanvasId)) return false;
    const entity = yjsStore.entitiesMap.get(entityId);
    if (!entity || entity.type === 'canvas' || entity.type === 'folder') return false;
    if (!canViewCanvasEntity(entity)) return false;

    const defaults = getEntityCanvasTokenDefaults(entity, mode);
    const size = await getEntityTokenCanvasSize(entity, defaults.mode, defaults);
    const elements = getDrawElements(activeCanvasId);
    pushHistory(elements);

    const newEl: DrawElement = {
      id: generateDrawId(),
      type: 'entityToken',
      x: point.x - size.width / 2,
      y: point.y - size.height / 2,
      width: size.width,
      height: size.height,
      linkedEntityId: entity.id,
      entityTokenMode: defaults.mode,
      entityTokenFrame: defaults.frame,
      objectName: entity.name,
      showName: defaults.showName,
      stroke: defaults.stroke,
      strokeWidth: 2,
      strokeStyle: 'solid',
      visualStyle: 'clean',
      fill: defaults.fill,
      opacity: 1,
      fillOpacity: 1,
      strokeOpacity: 1,
      startCap: 'none',
      endCap: 'none',
      zIndex: elements.length,
    };

    saveDrawElements(activeCanvasId, [...elements, newEl]);
    setTool('select');
    selectElement(newEl.id);
    return true;
  }, [activeCanvasId, pushHistory, selectElement, setTool]);

  const uploadAndInsertCanvasImage = useCallback(async (
    file: File,
    target: CanvasImageTarget,
    centerOnPoint = false,
    sessionNotificationId?: string,
    existingNotificationId?: string,
  ) => {
    if (!file.type.startsWith('image/')) {
      addNotification({
        kind: 'warning',
        scope: 'local',
        status: 'failed',
        title: 'Неподдерживаемый файл canvas',
        message: `${file.name}: нужен image-файл.`,
      });
      return;
    }

    if (file.size > MAX_CANVAS_IMAGE_UPLOAD_BYTES) {
      addNotification({
        kind: 'warning',
        scope: 'local',
        status: 'failed',
        title: 'Файл слишком большой',
        message: `${file.name} • ${formatNotificationFileSize(file.size)}. Быстрый canvas upload сейчас ограничен 250 MB.`,
      });
      return;
    }

    const isLargeUpload = file.size > LARGE_ASSET_UPLOAD_APPROVAL_BYTES;
    const notificationInput = {
      id: existingNotificationId,
      kind: 'progress' as const,
      scope: 'local' as const,
      status: 'pending' as const,
      title: isLargeUpload ? 'Загрузка крупного изображения' : 'Загрузка изображения на canvas',
      message: `${file.name} • ${formatNotificationFileSize(file.size)}`,
      progress: 0,
      actions: [{ id: 'cancel-upload', label: 'Отменить', tone: 'danger' as const }],
      payload: {
        canvasId: target.canvasId,
        fileName: file.name,
        size: file.size,
        requiresGmApproval: isLargeUpload,
        sessionNotificationId,
      },
    };

    const uploadNotification = existingNotificationId
      ? upsertNotification(notificationInput)
      : addNotification(notificationInput);

    const notificationId = uploadNotification.id;

    pendingCanvasImageUploadsRef.current.set(notificationId, { file, target, centerOnPoint });
    unregisterRetryCallback(notificationId);

    const controller = new AbortController();
    registerAbortCallback(notificationId, () => {
      controller.abort();
    });

    const updateSessionProgress = (loaded: number, total: number, percent: number) => {
      if (!sessionNotificationId) return;
      const previous = uploadProgressThrottleRef.current.get(sessionNotificationId);
      const now = Date.now();
      const percentDelta = previous ? Math.abs(percent - previous.percent) : 100;
      const elapsed = previous ? now - previous.updatedAt : Number.POSITIVE_INFINITY;
      if (percent < 100 && percentDelta < 2 && elapsed < 500) return;

      uploadProgressThrottleRef.current.set(sessionNotificationId, { percent, updatedAt: now });
      yjsStore.updateSessionNotification(sessionNotificationId, {
        status: 'uploading',
        payload: {
          uploadProgress: percent,
          uploadedBytes: loaded,
          totalBytes: total,
        },
      });
    };

    try {
      if (sessionNotificationId) {
        yjsStore.updateSessionNotification(sessionNotificationId, {
          status: 'uploading',
          payload: { uploadProgress: 0 },
        });
      }

      const uploaded = await (getIsHost() ? uploadAssetFile : uploadAssetFileToHost)(file, {
        signal: controller.signal,
        onProgress: (progress) => {
          updateNotificationProgress(notificationId, progress.percent);
          updateSessionProgress(progress.loaded, progress.total, progress.percent);
        },
      });

      const sourceUrl = getAssetUrl(uploaded.filename);
      const img = await loadBrowserImage(sourceUrl);

      updateNotification(notificationId, {
        kind: 'success',
        status: 'done',
        title: 'Изображение загружено',
        message: `${file.name} • ${formatNotificationFileSize(file.size)}`,
        progress: 100,
        actions: [],
      });

      unregisterAbortCallback(notificationId);
      pendingCanvasImageUploadsRef.current.delete(notificationId);

      if (sessionNotificationId) {
        yjsStore.updateSessionNotification(sessionNotificationId, {
          status: 'done',
          message: `${file.name} • ${formatNotificationFileSize(file.size)}`,
          payload: {
            uploadProgress: 100,
            uploadedAssetPath: uploaded.filename,
          },
        });
        uploadProgressThrottleRef.current.delete(sessionNotificationId);
      }

      if (target.canvasId !== activeCanvasId) {
        addNotification({
          kind: 'warning',
          scope: 'local',
          status: 'done',
          title: 'Файл загружен, но canvas сменился',
          message: `${file.name}: открой исходный canvas и перетащи файл из браузера файлов.`,
        });
        return;
      }

      insertImageElement({
        sourceUrl,
        assetPath: uploaded.filename,
        objectName: file.name,
        canvasX: target.canvasX,
        canvasY: target.canvasY,
        naturalWidth: img.width,
        naturalHeight: img.height,
        centerOnPoint,
      });
    } catch (err) {
      unregisterAbortCallback(notificationId);
      const isAbort = (err as Error).name === 'AbortError';
      const message = isAbort ? 'Загрузка отменена' : ((err as Error).message || 'Unknown upload error');

      console.warn('Canvas image upload/insert failed.', {
        fileName: file.name,
        fileSize: file.size,
        canvasId: target.canvasId,
        sessionNotificationId,
        error: err,
      });

      if (isAbort) {
        updateNotification(notificationId, {
          kind: 'warning',
          status: 'failed',
          title: 'Загрузка отменена',
          message: `${file.name}`,
          actions: [{ id: 'retry-upload', label: 'Повторить', tone: 'primary' }],
        });
      } else {
        updateNotification(notificationId, {
          kind: 'error',
          status: 'failed',
          title: 'Canvas upload не удался',
          message: `${file.name}: ${message}`,
          actions: [{ id: 'retry-upload', label: 'Повторить', tone: 'primary' }],
        });
      }

      registerRetryCallback(notificationId, () => {
        void uploadAndInsertCanvasImageRef.current?.(file, target, centerOnPoint, sessionNotificationId, notificationId);
      });

      if (sessionNotificationId) {
        yjsStore.updateSessionNotification(sessionNotificationId, {
          status: 'failed',
          message: `${file.name}: ${message}`,
          payload: { uploadError: message },
        });
        uploadProgressThrottleRef.current.delete(sessionNotificationId);
      }
    }
  }, [
    activeCanvasId,
    addNotification,
    upsertNotification,
    updateNotification,
    updateNotificationProgress,
    registerAbortCallback,
    unregisterAbortCallback,
    registerRetryCallback,
    unregisterRetryCallback,
    insertImageElement,
  ]);

  useEffect(() => {
    uploadAndInsertCanvasImageRef.current = uploadAndInsertCanvasImage;
  }, [uploadAndInsertCanvasImage]);

  const insertFileImageAtPoint = useCallback((file: File, target: CanvasImageTarget, centerOnPoint = false) => {
    if (!getIsHost() && file.size > LARGE_ASSET_UPLOAD_APPROVAL_BYTES) {
      const request = yjsStore.sendSessionNotification(createLargeUploadApprovalRequest({
        fileName: file.name,
        fileSize: file.size,
        mime: file.type,
        destination: `assets/canvas/${target.canvasId}`,
        source: 'canvas-drop',
      }));

      pendingCanvasImageUploadsRef.current.set(request.id, { file, target, centerOnPoint });
      addNotification({
        kind: 'approval',
        scope: 'player',
        status: 'pending',
        title: 'Запрос отправлен ГМу',
        message: `${file.name} • ${formatNotificationFileSize(file.size)}`,
        payload: {
          canvasId: target.canvasId,
          sessionNotificationId: request.id,
        },
      });
      return;
    }

    void uploadAndInsertCanvasImage(file, target, centerOnPoint);
  }, [addNotification, uploadAndInsertCanvasImage]);

  useEffect(() => {
    const handleSessionNotification = (notification: SessionNotificationEvent) => {
      if (notification.type !== 'large-upload-approval') return;

      const pending = pendingCanvasImageUploadsRef.current.get(notification.id);
      if (!pending) return;

      const isMine = Boolean(
        (notification.actorId && notification.actorId === yjsStore.localPlayerId)
        || (notification.actorName && notification.actorName === yjsStore.localPlayerName)
      );
      if (!isMine) return;

      if (notification.status === 'approved') {
        pendingCanvasImageUploadsRef.current.delete(notification.id);
        void uploadAndInsertCanvasImage(pending.file, pending.target, pending.centerOnPoint, notification.id);
        return;
      }

      if (notification.status === 'rejected') {
        pendingCanvasImageUploadsRef.current.delete(notification.id);
        uploadProgressThrottleRef.current.delete(notification.id);
        addNotification({
          kind: 'warning',
          scope: 'player',
          status: 'rejected',
          title: 'Загрузка отклонена',
          message: `${pending.file.name} • ${formatNotificationFileSize(pending.file.size)}`,
          payload: {
            canvasId: pending.target.canvasId,
            sessionNotificationId: notification.id,
          },
        });
      }
    };

    return yjsStore.observeSessionNotifications(handleSessionNotification);
  }, [addNotification, uploadAndInsertCanvasImage]);

  const insertAssetImageAtPoint = useCallback((asset: AssetRecord, target: CanvasImageTarget, centerOnPoint = false) => {
    const sourceUrl = asset.url || getAssetUrl(asset.path);
    void loadBrowserImage(sourceUrl)
      .then((img) => {
        insertImageElement({
          sourceUrl,
          assetPath: asset.path,
          objectName: asset.name,
          canvasX: target.canvasX,
          canvasY: target.canvasY,
          naturalWidth: img.width,
          naturalHeight: img.height,
          centerOnPoint,
        });
      })
      .catch((err) => console.warn('Canvas asset image insert failed.', err));
  }, [insertImageElement]);

  // Track drawing and middle-click pan state
  const isDrawingRef = useRef(false);
  const isMiddlePanRef = useRef(false);
  const suppressMiddleAuxClickUntilRef = useRef(0);
  const middlePanStartRef = useRef({ x: 0, y: 0, stageX: 0, stageY: 0 });
  const dragElementSnapshotRef = useRef<DrawElement[] | null>(null);
  const lastDragDeltaRef = useRef({ dx: 0, dy: 0 });

  // Lasso selection state
  const lassoPointsRef = useRef<number[]>([]);
  const [lassoPoints, setLassoPoints] = useState<number[]>([]);
  const dragWindowSnapshotRef = useRef<Record<string, {x: number, y: number}> | null>(null);

  // Refs for direct Konva manipulation (avoid React re-renders during pan)
  const stageRef = useRef<Konva.Stage>(null);
  const snapLinesRef = useRef<{ x?: number; y?: number }[]>([]);
  const snapLinesGroupRef = useRef<Konva.Group | null>(null);
  const lastSnapKeyRef = useRef<string>('');

  const updateSnapLines = useCallback(() => {
    const group = snapLinesGroupRef.current;
    if (!group) return;
    const layer = group.getLayer();
    if (!layer) return;

    group.destroyChildren();
    const lines = snapLinesRef.current;
    const stage = layer.getStage();
    if (!stage) return;
    const scale = stage.scaleX();

    for (const line of lines) {
      if (line.x !== undefined) {
        // Draw in WORLD coords — Stage transform handles the rest
        group.add(new Konva.Line({
          points: [line.x, -99999, line.x, 99999],
          stroke: 'rgba(167, 139, 250, 0.5)',
          strokeWidth: 1 / scale,
          dash: [5 / scale, 5 / scale],
          listening: false,
        }));
      }
      if (line.y !== undefined) {
        group.add(new Konva.Line({
          points: [-99999, line.y, 99999, line.y],
          stroke: 'rgba(167, 139, 250, 0.5)',
          strokeWidth: 1 / scale,
          dash: [5 / scale, 5 / scale],
          listening: false,
        }));
      }
    }
    layer.batchDraw();
  }, []);

  const snapCanvasPoint = useCallback(
    (point: { x: number; y: number }, disabled = false) =>
      snapPointToConfiguredGrid(point, gridEnabled, gridType, gridSpacing, disabled),
    [gridEnabled, gridType, gridSpacing]
  );

  const snapLinePoint = useCallback(
    (point: { x: number; y: number }, options?: { disabled?: boolean; excludeIds?: string[] }) => {
      const snappedGridPoint = snapCanvasPoint(point, options?.disabled);
      if (options?.disabled) {
        setObjectSnapPreview(null);
        return { point: snappedGridPoint } satisfies LinePointSnapResult;
      }

      const scale = stageRef.current?.scaleX() || useCanvasStore.getState().scale || 1;
      const radius = OBJECT_SNAP_SCREEN_RADIUS / Math.max(0.1, scale);
      const anchorSnap = findNearestCanvasAnchor(snappedGridPoint, renderedDrawElements, {
        radius,
        excludeIds: options?.excludeIds,
      });

      if (!anchorSnap) {
        setObjectSnapPreview(null);
        return { point: snappedGridPoint } satisfies LinePointSnapResult;
      }

      setObjectSnapPreview(anchorSnap.point);
      return {
        point: anchorSnap.point,
        binding: {
          elementId: anchorSnap.anchor.elementId,
          anchor: anchorSnap.anchor.id,
        },
      } satisfies LinePointSnapResult;
    },
    [renderedDrawElements, snapCanvasPoint]
  );

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // ─── Module-level callback for external camera control (used by CanvasToolbar.centerOn) ───
  useEffect(() => {
    // Register a global handler so CanvasToolbar can directly control the stage
    const handler = (scale: number, x: number, y: number) => {
      const stage = stageRef.current;
      if (stage) {
        stage.scale({ x: scale, y: scale });
        stage.position({ x, y });
        stage.batchDraw();
      }
    };
    // Store on window for cross-component access (avoids prop drilling)
    window.__vibeSetStageCamera = handler;
    return () => { delete window.__vibeSetStageCamera; };
  }, []);

  const deleteSelectedCanvasElements = useCallback(() => {
    if (selectedElementIds.length === 0) return;

    const elements = getDrawElements(activeCanvasId);
    const selected = elements.filter((el) => selectedElementIds.includes(el.id));
    if (selected.length === 0) {
      clearSelection();
      return;
    }

    const deleteSelection = () => {
      pushHistory(elements);
      saveDrawElements(
        activeCanvasId,
        elements.filter((el) => !selectedElementIds.includes(el.id))
      );
      clearSelection();
    };

    const entityPlacements = selected.filter((el) => el.type === 'entityToken');
    if (entityPlacements.length === 0) {
      deleteSelection();
      return;
    }

    openConfirm({
      title: 'Удаление сущности с канваса',
      description:
        entityPlacements.length === selected.length
          ? `Удалить ${entityPlacements.length} карточк(у/и) или фишк(у/и) сущности с канваса?`
          : `В выделении есть ${entityPlacements.length} карточк(а/и) или фишк(а/и) сущности. Удалить всё выделение с канваса?`,
      confirmText: 'Удалить',
      isDestructive: true,
      onConfirm: deleteSelection,
    });
  }, [activeCanvasId, clearSelection, openConfirm, pushHistory, selectedElementIds]);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y — undo/redo
      if (ctrl && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if (ctrl && key === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // Escape — exit fog edit mode
      if (key === 'escape') {
        const fogOn = useCanvasDrawStore.getState().fogEditMode;
        if (fogOn) {
          e.preventDefault();
          useCanvasDrawStore.getState().setFogEditMode(false);
          return;
        }
      }

      // Ctrl+C — copy
      if (ctrl && key === 'c') {
        if (selectedElementIds.length > 0) {
          e.preventDefault();
          const elements = getDrawElements(activeCanvasId);
          const selected = elements.filter(el => selectedElementIds.includes(el.id));
          copyToClipboard(selected);
        }
        return;
      }

      // Ctrl+V — paste
      if (ctrl && key === 'v') {
        const clip = getClipboard();
        if (clip.length > 0) {
          e.preventDefault();
          const elements = getDrawElements(activeCanvasId);
          pushHistory(elements);
          const newElements = clip.map(el => ({
            ...el,
            id: generateDrawId(),
            x: el.x !== undefined ? el.x + 20 : undefined,
            y: el.y !== undefined ? el.y + 20 : undefined,
            points: el.points ? el.points.map((v, i) => i % 2 === 0 ? v + 20 : v + 20) : undefined,
          }));
          saveDrawElements(activeCanvasId, [...elements, ...newElements]);
          selectElements(newElements.map(el => el.id));
          // Update clipboard offset for repeated paste
          copyToClipboard(newElements);
        }
        return;
      }

      // Ctrl+D — duplicate in-place
      if (ctrl && key === 'd') {
        if (selectedElementIds.length > 0) {
          e.preventDefault();
          const elements = getDrawElements(activeCanvasId);
          pushHistory(elements);
          const selected = elements.filter(el => selectedElementIds.includes(el.id));
          const dupes = selected.map(el => ({
            ...el,
            id: generateDrawId(),
            x: el.x !== undefined ? el.x + 20 : undefined,
            y: el.y !== undefined ? el.y + 20 : undefined,
            points: el.points ? el.points.map((v, i) => i % 2 === 0 ? v + 20 : v + 20) : undefined,
          }));
          saveDrawElements(activeCanvasId, [...elements, ...dupes]);
          selectElements(dupes.map(el => el.id));
        }
        return;
      }

      // Ctrl+A — select all
      if (ctrl && key === 'a') {
        e.preventDefault();
        const elements = getDrawElements(activeCanvasId);
        if (useCanvasDrawStore.getState().activeTool !== 'select') setTool('select');
        selectElements(elements.map(el => el.id));
        return;
      }

      // No-modifier tool shortcuts
      if (ctrl) return;

      switch (key) {
        case 'v': setTool('select'); break;
        case 'p': setTool('pen'); break;
        case 'l': setTool('line'); break;
        case 'r': setTool('rect'); break;
        case 'o': setTool('ellipse'); break;
        case 't': setTool('rect'); break;
        case 'i': setTool('image'); break;
        case 'f': setTool('frame'); break;
        case 'escape':
          clearSelection();
          setTool('select');
          break;
        case 'g':
          // Hold 'G' for ping mode — don't prevent default to allow text input elsewhere
          pingKeyRef.current = true;
          break;
        case 'delete':
        case 'backspace':
          if (selectedElementIds.length > 0) {
            e.preventDefault();
            deleteSelectedCanvasElements();
          }
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 'g') pingKeyRef.current = false;
    };
    window.addEventListener('keyup', onKeyUp);
    
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [activeCanvasId, selectedElementIds, setTool, clearSelection, undo, redo, pushHistory, copyToClipboard, getClipboard, selectElements, deleteSelectedCanvasElements]);

  // ─── Wheel zoom ───
  // ─── Wheel zoom (throttled store sync for smooth pinned windows) ───
  const throttledSetTransform = useMemo(
    () => throttle((s: number, x: number, y: number) => setTransform(s, x, y), 32),
    [setTransform]
  );

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    let newScale =
      e.evt.deltaY > 0 ? oldScale / SCALE_BY : oldScale * SCALE_BY;
    newScale = Math.max(0.1, Math.min(newScale, 5));

    stage.scale({ x: newScale, y: newScale });
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
    // Use throttled store sync so pinned windows don't lag during rapid zoom
    throttledSetTransform(newScale, newPos.x, newPos.y);
  };

  const handleDragMove = () => {
    // Sync store during hand-tool pan so pinned windows follow camera
    const stage = stageRef.current;
    if (stage) {
      throttledSetTransform(stage.scaleX(), stage.x(), stage.y());
    }
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target === e.target.getStage()) {
      const stage = e.target.getStage()!;
      setTransform(stage.scaleX(), stage.x(), stage.y());
    }
  };

  // ─── Canvas point helper ───

  const getCanvasPoint = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>): { x: number; y: number } | null => {
      const stage = e.target.getStage();
      if (!stage) return null;
      const pointer = stage.getPointerPosition();
      if (!pointer) return null;
      const scale = stage.scaleX();
      return {
        x: (pointer.x - stage.x()) / scale,
        y: (pointer.y - stage.y()) / scale,
      };
    },
    []
  );

  // ─── Middle-click pan (works in ALL modes) ───

  const setMiddlePanCursor = useCallback((cursor: string) => {
    const stage = stageRef.current;
    const container = stage?.container();
    if (container) container.style.cursor = cursor;
    document.documentElement.style.cursor = cursor;
    document.body.style.cursor = cursor;
  }, []);

  const clearMiddlePanCursor = useCallback(() => {
    const stage = stageRef.current;
    const container = stage?.container();
    if (container) container.style.cursor = '';
    document.documentElement.style.cursor = '';
    document.body.style.cursor = '';
  }, []);

  const applyMiddlePanMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isMiddlePanRef.current) return;
      const stage = stageRef.current;
      if (!stage) return;

      const dx = clientX - middlePanStartRef.current.x;
      const dy = clientY - middlePanStartRef.current.y;
      const newX = middlePanStartRef.current.stageX + dx;
      const newY = middlePanStartRef.current.stageY + dy;

      stage.position({ x: newX, y: newY });
      stage.batchDraw();
      // Sync store so pinned windows follow in real-time.
      throttledSetTransform(stage.scaleX(), newX, newY);
    },
    [throttledSetTransform]
  );

  const handleMiddlePanEnd = useCallback(() => {
    if (!isMiddlePanRef.current) return;
    isMiddlePanRef.current = false;
    clearMiddlePanCursor();

    const stage = stageRef.current;
    if (stage) {
      // Sync Zustand state after pan ends.
      setTransform(stage.scaleX(), stage.x(), stage.y());
    }
  }, [clearMiddlePanCursor, setTransform]);

  const handleMiddlePanStart = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.evt.button !== 1) return;
      e.evt.preventDefault();
      e.evt.stopPropagation();
      const stage = e.target.getStage();
      if (!stage) return;

      isMiddlePanRef.current = true;
      suppressMiddleAuxClickUntilRef.current = Date.now() + 1000;
      middlePanStartRef.current = {
        x: e.evt.clientX,
        y: e.evt.clientY,
        stageX: stage.x(),
        stageY: stage.y(),
      };
      setMiddlePanCursor('grabbing');
    },
    [setMiddlePanCursor]
  );

  useEffect(() => {
    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (!isMiddlePanRef.current) return;

      if ((event.buttons & 4) !== 4) {
        handleMiddlePanEnd();
        return;
      }

      event.preventDefault();
      applyMiddlePanMove(event.clientX, event.clientY);
    };

    const handleGlobalMouseUp = (event: MouseEvent) => {
      if (!isMiddlePanRef.current) return;
      if (event.button !== 1 && (event.buttons & 4) === 4) return;

      event.preventDefault();
      handleMiddlePanEnd();
    };

    const handleGlobalAuxClick = (event: MouseEvent) => {
      if (event.button !== 1) return;
      if (isMiddlePanRef.current || Date.now() <= suppressMiddleAuxClickUntilRef.current) {
        event.preventDefault();
        event.stopPropagation();
        handleMiddlePanEnd();
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove, true);
    window.addEventListener('mouseup', handleGlobalMouseUp, true);
    window.addEventListener('auxclick', handleGlobalAuxClick, true);
    window.addEventListener('blur', handleMiddlePanEnd);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove, true);
      window.removeEventListener('mouseup', handleGlobalMouseUp, true);
      window.removeEventListener('auxclick', handleGlobalAuxClick, true);
      window.removeEventListener('blur', handleMiddlePanEnd);
      handleMiddlePanEnd();
    };
  }, [applyMiddlePanMove, handleMiddlePanEnd]);

  // ─── Select mode: drag to move selected elements ───

  const handleSelectDragStart = useCallback(
    (point: { x: number; y: number }) => {
      // Read from store directly (not closure) to get latest selection
      const currentSelectedIds = useCanvasDrawStore.getState().selectedElementIds;
      if (currentSelectedIds.length === 0) return;
      
      // Reset drag delta so stale values from previous drag don't apply
      lastDragDeltaRef.current = { dx: 0, dy: 0 };
      clearCanvasDragPreview();
      
      // Record undo history before drag-move
      const elements = getDrawElements(activeCanvasId);
      pushHistory(elements);
      
      // Build snapshot: selected elements + frame children
      const selectedSet = new Set(currentSelectedIds);
      const frameChildIds = new Set<string>();
      const frameRects: {x: number, y: number, w: number, h: number}[] = [];
      
      elements.filter(el => selectedSet.has(el.id) && el.type === 'frame').forEach(frame => {
        const b = getElementBounds(frame);
        frameRects.push({ x: b.x, y: b.y, w: b.w, h: b.h });
        getChildrenOfFrame(frame, elements).forEach(childId => frameChildIds.add(childId));
      });
      
      // Snapshot includes selected + frame children
      const toSnapshot = new Set([...selectedSet, ...frameChildIds]);
      dragElementSnapshotRef.current = elements.filter((el) => toSnapshot.has(el.id));
      
      // Snapshot pinned windows inside frames
      const windows = useWindowStore.getState().windows;
      const movingWindows: Record<string, {x: number, y: number}> = {};
      Object.values(windows).forEach(w => {
         if (w.isPinned && w.canvasId === activeCanvasId) {
            for (const r of frameRects) {
               if (w.x >= r.x && w.x <= r.x + r.w && w.y >= r.y && w.y <= r.y + r.h) {
                  movingWindows[w.id] = { x: w.x, y: w.y };
                  break;
               }
            }
         }
      });
      dragWindowSnapshotRef.current = movingWindows;
      
      startDragging(point);
      setDraggingGlobal(true);
    },
    [startDragging, activeCanvasId, pushHistory, setDraggingGlobal, clearCanvasDragPreview]
  );

  const handleSelectDragMove = useCallback(
    (point: { x: number; y: number }, shiftKey?: boolean) => {
      if (!isDraggingElement || !dragStartPoint || !dragElementSnapshotRef.current) return;

      let dx = point.x - dragStartPoint.x;
      let dy = point.y - dragStartPoint.y;

      if (shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }

      const elements = getDrawElements(activeCanvasId);
      const newSnapLines: { x?: number; y?: number }[] = [];
      const currentScale = useCanvasStore.getState().scale;

      // ─── Snap-to-Grid (before element-to-element smart snap) ───
      if (gridEnabled && !shiftKey && dragElementSnapshotRef.current) {
        const snapEl = dragElementSnapshotRef.current.find(s => s.id === selectedElementIds[0]);
        if (snapEl) {
          const threshold = 8 / currentScale;
          const spacing = gridSpacing;
          const b = getElementBounds(translateElement(snapEl, dx, dy));

          if (gridType === 'square') {
            // Snap top-left corner to nearest grid intersection
            const snappedX = Math.round(b.x / spacing) * spacing;
            const snappedY = Math.round(b.y / spacing) * spacing;
            if (Math.abs(snappedX - b.x) < threshold) dx += snappedX - b.x;
            if (Math.abs(snappedY - b.y) < threshold) dy += snappedY - b.y;
          } else {
            // Hex grid: snap center of element to nearest hex center
            const hexW = spacing;
            const hexH = spacing * 0.866;
            const hexStepX = hexW * 0.75;
            const elCx = b.x + b.w / 2;
            const elCy = b.y + b.h / 2;
            // Find nearest hex center
            const col = Math.round(elCx / hexStepX);
            const rowOffset = col % 2 === 0 ? 0 : hexH / 2;
            const row = Math.round((elCy - rowOffset) / hexH);
            const hexCx = col * hexStepX;
            const hexCy = row * hexH + (col % 2 === 0 ? 0 : hexH / 2);
            if (Math.abs(hexCx - elCx) < threshold * 2) dx += hexCx - elCx;
            if (Math.abs(hexCy - elCy) < threshold * 2) dy += hexCy - elCy;
          }
        }
      }

      // Smart Snapping — ALL element types
      if (selectedElementIds.length === 1 && !shiftKey) {
        const threshold = 5 / currentScale;
        const elSnap = dragElementSnapshotRef.current!.find(s => s.id === selectedElementIds[0]);
        
        if (elSnap) {
          const eb = getElementBounds(translateElement(elSnap, dx, dy));
          const myX = [eb.x, eb.x + eb.w / 2, eb.x + eb.w];
          const myY = [eb.y, eb.y + eb.h / 2, eb.y + eb.h];
          const others = elements.filter(e => !selectedElementIds.includes(e.id));
          let snappedX = false, snappedY = false;
          
          for (const other of others) {
            const ob = getElementBounds(other);
            const otherX = [ob.x, ob.x + ob.w / 2, ob.x + ob.w];
            const otherY = [ob.y, ob.y + ob.h / 2, ob.y + ob.h];
            if (!snappedX) {
              for (const mx of myX) {
                for (const tx of otherX) {
                  if (Math.abs(mx - tx) < threshold) {
                    dx += (tx - mx);
                    newSnapLines.push({ x: tx });
                    snappedX = true;
                    break;
                  }
                }
                if (snappedX) break;
              }
            }
            if (!snappedY) {
              for (const my of myY) {
                for (const ty of otherY) {
                  if (Math.abs(my - ty) < threshold) {
                    dy += (ty - my);
                    newSnapLines.push({ y: ty });
                    snappedY = true;
                    break;
                  }
                }
                if (snappedY) break;
              }
            }
          }
        }
      }

      // Update snap lines via Konva (no React re-render)
      const snapKey = JSON.stringify(newSnapLines);
      if (snapKey !== lastSnapKeyRef.current) {
        lastSnapKeyRef.current = snapKey;
        snapLinesRef.current = newSnapLines;
        updateSnapLines();
      }

      // Update element positions locally while dragging. Persistent Yjs write happens on drag end.
      lastDragDeltaRef.current = { dx, dy };
      const movedElementIds = dragElementSnapshotRef.current.map((snapshot) => snapshot.id);
      const updated = elements.map((el) => {
        const snapshot = dragElementSnapshotRef.current!.find((s) => s.id === el.id);
        if (!snapshot) return el;
        return translateElement(snapshot, dx, dy);
      });
      setCanvasDragPreview({ canvasId: activeCanvasId, elements: updateBoundLineEndpoints(updated, movedElementIds) });
      
      if (dragWindowSnapshotRef.current) {
         Object.entries(dragWindowSnapshotRef.current).forEach(([wId, snapXy]) => {
            useWindowStore.getState().updateWindow(wId, {
               x: snapXy.x + dx,
               y: snapXy.y + dy
            });
         });
      }
    },
    [isDraggingElement, dragStartPoint, activeCanvasId, selectedElementIds, updateSnapLines, gridEnabled, gridType, gridSpacing, setCanvasDragPreview]
  );

  const handleSelectDragEnd = useCallback(() => {
    // Save FINAL position using last known delta (avoids race with throttled saves)
    if (dragElementSnapshotRef.current) {
      const { dx, dy } = lastDragDeltaRef.current;
      const elements = getDrawElements(activeCanvasId);
      const movedElementIds = dragElementSnapshotRef.current.map((snapshot) => snapshot.id);
      const updatedElements = elements.map((el) => {
        const snapshot = dragElementSnapshotRef.current!.find((s) => s.id === el.id);
        if (!snapshot) return el;
        return translateElement(snapshot, dx, dy);
      });
      saveDrawElements(activeCanvasId, updateBoundLineEndpoints(updatedElements, movedElementIds));
    }
    
    dragElementSnapshotRef.current = null;
    dragWindowSnapshotRef.current = null;
    clearCanvasDragPreview();
    stopDragging();
    setDraggingGlobal(false);
    snapLinesRef.current = [];
    lastSnapKeyRef.current = '';
    updateSnapLines();
  }, [stopDragging, setDraggingGlobal, activeCanvasId, updateSnapLines, clearCanvasDragPreview]);

  // ─── Point editing handlers ───

  const handlePointDragStart = useCallback(
    (idx: number) => {
      // Record undo history before point editing
      const elements = getDrawElements(activeCanvasId);
      pushHistory(elements);
      clearCanvasDragPreview();
      setEditingPointIndex(idx);
    },
    [setEditingPointIndex, activeCanvasId, pushHistory, clearCanvasDragPreview]
  );

  const handlePointDragMove = useCallback(
    (idx: number, x: number, y: number, shiftKey?: boolean) => {
      if (selectedElementIds.length !== 1) return;
      const id = selectedElementIds[0];
      const snapped = snapLinePoint({ x, y }, { disabled: shiftKey, excludeIds: [id] });
      const elements = getDrawElements(activeCanvasId);
      const updated = elements.map((el) => {
        if (el.id !== id || !el.points) return el;
        const pts = [...el.points];
        pts[idx * 2] = snapped.point.x;
        pts[idx * 2 + 1] = snapped.point.y;
        const next: DrawElement = { ...el, points: pts };
        if (idx === 0) {
          if (snapped.binding) next.startBinding = snapped.binding;
          else delete next.startBinding;
        }
        if (idx === Math.floor(pts.length / 2) - 1) {
          if (snapped.binding) next.endBinding = snapped.binding;
          else delete next.endBinding;
        }
        return next;
      });
      setCanvasDragPreview({ canvasId: activeCanvasId, elements: updated });
    },
    [selectedElementIds, activeCanvasId, setCanvasDragPreview, snapLinePoint]
  );

  const handlePointDragEnd = useCallback(() => {
    commitCanvasDragPreview();
    setObjectSnapPreview(null);
    setEditingPointIndex(null);
  }, [setEditingPointIndex, commitCanvasDragPreview]);

  const handlePointDoubleClick = useCallback(
    (idx: number) => {
      if (selectedElementIds.length !== 1) return;
      const id = selectedElementIds[0];
      const elements = getDrawElements(activeCanvasId);
      const target = elements.find((el) => el.id === id);
      if (!target || (target.type !== 'line' && target.type !== 'arrow') || !target.points) return;
      const nextPoints = removeLinePointAtIndex(target.points, idx);
      if (nextPoints === target.points) return;

      pushHistory(elements);
      saveDrawElements(
        activeCanvasId,
        elements.map((el) => el.id === id ? { ...el, points: nextPoints } : el)
      );
      setEditingPointIndex(null);
    },
    [activeCanvasId, pushHistory, selectedElementIds, setEditingPointIndex]
  );

  // ─── Resize handles for shapes ───

  const resizeSnapshotRef = useRef<DrawElement | null>(null);

  const handleResizeDragMove = useCallback(
    (corner: string, x: number, y: number) => {
      if (selectedElementIds.length !== 1) return;
      const id = selectedElementIds[0];
      const elements = getDrawElements(activeCanvasId);
      const el = elements.find((e) => e.id === id);
      if (!el) return;

      if (!resizeSnapshotRef.current) {
        // Record undo history before first resize move
        pushHistory(elements);
        resizeSnapshotRef.current = { ...el };
      }
      const snap = resizeSnapshotRef.current;
      const sx = snap.x || 0;
      const sy = snap.y || 0;
      const sw = snap.width || 0;
      const sh = snap.height || 0;

      let newX = sx, newY = sy, newW = sw, newH = sh;

      switch (corner) {
        case 'tl':
          newX = x; newY = y;
          newW = sx + sw - x; newH = sy + sh - y;
          break;
        case 'tr':
          newY = y;
          newW = x - sx; newH = sy + sh - y;
          break;
        case 'bl':
          newX = x;
          newW = sx + sw - x; newH = y - sy;
          break;
        case 'br':
          newW = x - sx; newH = y - sy;
          break;
      }

      if (snap.type === 'entityToken' && (snap.entityTokenMode || 'token') === 'art') {
        const aspect = Math.abs(sw / sh) || 1;
        const minSide = 32;
        const signW = newW < 0 ? -1 : 1;
        const signH = newH < 0 ? -1 : 1;
        let absW = Math.max(minSide, Math.abs(newW));
        let absH = Math.max(minSide, Math.abs(newH));

        if (absW / aspect >= absH) {
          absH = absW / aspect;
        } else {
          absW = absH * aspect;
        }

        newW = absW * signW;
        newH = absH * signH;

        switch (corner) {
          case 'tl':
            newX = sx + sw - newW;
            newY = sy + sh - newH;
            break;
          case 'tr':
            newX = sx;
            newY = sy + sh - newH;
            break;
          case 'bl':
            newX = sx + sw - newW;
            newY = sy;
            break;
          case 'br':
            newX = sx;
            newY = sy;
            break;
        }
      }

      const updated = elements.map((e) =>
        e.id === id ? { ...e, x: newX, y: newY, width: newW, height: newH } : e
      );
      setCanvasDragPreview({ canvasId: activeCanvasId, elements: updated });
    },
    [selectedElementIds, activeCanvasId, pushHistory, setCanvasDragPreview]
  );

  const handleResizeDragEnd = useCallback(() => {
    resizeSnapshotRef.current = null;
    if (selectedElementIds.length !== 1) {
      clearCanvasDragPreview();
      return;
    }
    const id = selectedElementIds[0];
    const preview = dragPreviewRef.current;
    const elements = preview?.canvasId === activeCanvasId ? preview.elements : getDrawElements(activeCanvasId);
    const updated = elements.map((el) => {
      if (el.id !== id) return el;
      let { x, y, width, height } = el;
      x = x || 0; y = y || 0; width = width || 0; height = height || 0;
      if (width < 0) { x += width; width = Math.abs(width); }
      if (height < 0) { y += height; height = Math.abs(height); }
      return { ...el, x, y, width, height };
    });
    saveDrawElements(activeCanvasId, updated);
    clearCanvasDragPreview();
  }, [selectedElementIds, activeCanvasId, clearCanvasDragPreview]);

  // ─── Rotation handle ───

  const rotateHistoryPushedRef = useRef(false);

  const handleRotateDragMove = useCallback(
    (angle: number) => {
      if (selectedElementIds.length !== 1) return;
      const id = selectedElementIds[0];
      const elements = getDrawElements(activeCanvasId);
      // Record undo history before first rotation move
      if (!rotateHistoryPushedRef.current) {
        pushHistory(elements);
        rotateHistoryPushedRef.current = true;
      }
      const updated = elements.map(el =>
        el.id === id ? { ...el, rotation: angle } : el
      );
      setCanvasDragPreview({ canvasId: activeCanvasId, elements: updated });
    },
    [selectedElementIds, activeCanvasId, pushHistory, setCanvasDragPreview]
  );

  const handleRotateDragEnd = useCallback(() => {
    commitCanvasDragPreview();
    rotateHistoryPushedRef.current = false;
  }, [commitCanvasDragPreview]);

  // ─── Drawing handlers (LEFT CLICK ONLY) ───

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Middle-click pan (in any mode)
      if (e.evt.button === 1) {
        handleMiddlePanStart(e);
        return;
      }

      // Only left-click
      if (e.evt.button !== 0) return;

      // ─── Ping: 'G' + click sends a pulse to all players ───
      if (pingKeyRef.current) {
        const pt = getCanvasPoint(e);
        if (pt) {
          sendPing(pt.x, pt.y);
          pingKeyRef.current = false;
        }
        return;
      }

      // ─── Fog Edit Mode (GM only) — intercepts ALL clicks, regardless of target ───
      if (isGM && useCanvasDrawStore.getState().fogEditMode) {
        const currentFogTool = useCanvasDrawStore.getState().fogTool;
        if (currentFogTool === 'none') return;
        const pt = getCanvasPoint(e);
        if (!pt) return;
        if (currentFogTool === 'revealBrush' || currentFogTool === 'coverBrush') {
          fogDrawingRef.current = true;
          fogBrushTipRef.current = { x: pt.x, y: pt.y };
          const id = `fog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const reveal: FogReveal = { id, type: 'circle', x: pt.x, y: pt.y, width: 80, height: 80 };
          // Cover tools ADD fog patches, Reveal tools REMOVE fog patches
          applyFogBrushOperation(currentFogTool, reveal);
          return;
        }
        if (currentFogTool === 'revealRect' || currentFogTool === 'coverRect') {
          fogDrawingRef.current = true;
          fogBrushTipRef.current = { x: pt.x, y: pt.y };
          return;
        }
        return;
      }

      const point = getCanvasPoint(e);
      if (!point) return;
      const drawPoint = snapCanvasPoint(point, e.evt.shiftKey);

      // Lasso selection starts anywhere on the canvas, including over existing draw elements.
      if (activeTool === 'lasso') {
        clearSelection();
        isDrawingRef.current = true;
        lassoPointsRef.current = [point.x, point.y];
        setLassoPoints([...lassoPointsRef.current]);
        return;
      }

      // Only empty-stage clicks start normal drawing or marquee selection.
      if (e.target !== e.target.getStage()) return;

      if (activeTool === 'select') {
        // Start marquee selection (rubber-band) on empty canvas
        clearSelection();
        isDrawingRef.current = true;
        startMarquee(point.x, point.y);
        return;
      }

      if (activeTool === 'pen' || activeTool === 'line') {
        isDrawingRef.current = true;
        const startSnap = activeTool === 'pen'
          ? { point }
          : snapLinePoint(point, { disabled: e.evt.shiftKey });
        const newElement: DrawElement = {
          id: generateDrawId(),
          type: 'line',
          points: [startSnap.point.x, startSnap.point.y, startSnap.point.x, startSnap.point.y],
          stroke: currentStyle.stroke,
          strokeWidth: currentStyle.strokeWidth,
          strokeStyle: currentStyle.strokeStyle,
          visualStyle: currentStyle.visualStyle,
          lineMode: activeTool === 'pen' ? 'curved' : currentStyle.lineMode,
          opacity: currentStyle.opacity,
          strokeOpacity: currentStyle.strokeOpacity,
          startCap: currentStyle.startCap,
          endCap: currentStyle.endCap,
          zIndex: drawElements.length,
        };
        if (startSnap.binding) newElement.startBinding = startSnap.binding;
        startDrawing(newElement);
        return;
      }

      if (activeTool === 'rect' || activeTool === 'ellipse' || activeTool === 'frame') {
        isDrawingRef.current = true;
        const newElement: DrawElement = {
          id: generateDrawId(),
          type: activeTool === 'rect' ? 'rectangle' : activeTool === 'frame' ? 'frame' : 'ellipse',
          x: drawPoint.x,
          y: drawPoint.y,
          width: 0,
          height: 0,
          stroke: activeTool === 'frame' ? 'rgba(165,180,252,0.25)' : currentStyle.stroke,
          strokeWidth: activeTool === 'frame' ? 1 : currentStyle.strokeWidth,
          strokeStyle: activeTool === 'frame' ? 'dashed' as StrokeStyle : currentStyle.strokeStyle,
          visualStyle: currentStyle.visualStyle,
          fill: activeTool === 'frame' ? 'rgba(99,102,241,0.04)' : (currentStyle.fill || undefined),
          opacity: currentStyle.opacity,
          fillOpacity: currentStyle.fillOpacity,
          strokeOpacity: currentStyle.strokeOpacity,
          startCap: currentStyle.startCap,
          endCap: currentStyle.endCap,
          fontSize: currentStyle.fontSize,
          fontFamily: currentStyle.fontFamily,
          textAlign: currentStyle.textAlign,
          textColor: currentStyle.textColor,
          textOpacity: currentStyle.textOpacity,
          zIndex: drawElements.length,
          frameLabel: activeTool === 'frame' ? 'Frame' : undefined,
        };
        startDrawing(newElement);
        return;
      }

      // Image tool: choose an existing asset or upload a new file
      if (activeTool === 'image') {
        setImagePickerTarget({
          canvasId: activeCanvasId,
          canvasX: drawPoint.x,
          canvasY: drawPoint.y,
          screenX: e.evt.clientX,
          screenY: e.evt.clientY,
        });
        return;
      }

      // Text tool: create inline textarea
      if (activeTool === 'text') {
        const stage = e.target.getStage();
        if (!stage) return;
        const container = stage.container();
        const rect = container.getBoundingClientRect();
        const scale = stage.scaleX();

        // Screen position of the click
        const screenX = drawPoint.x * scale + stage.x() + rect.left;
        const screenY = drawPoint.y * scale + stage.y() + rect.top;

        const textarea = document.createElement('textarea');
        textarea.style.position = 'fixed';
        textarea.style.left = `${screenX}px`;
        textarea.style.top = `${screenY}px`;
        textarea.style.minWidth = '120px';
        textarea.style.minHeight = '36px';
        textarea.style.fontSize = `${currentStyle.fontSize * scale}px`;
        textarea.style.fontFamily = getKonvaFontFamily(currentStyle.fontFamily);
        textarea.style.color = currentStyle.stroke;
        textarea.style.background = 'rgba(0,0,0,0.4)';
        textarea.style.backdropFilter = 'blur(20px)';
        textarea.style.border = '1px solid rgba(167,139,250,0.5)';
        textarea.style.borderRadius = '8px';
        textarea.style.padding = '6px 8px';
        textarea.style.outline = 'none';
        textarea.style.resize = 'both';
        textarea.style.zIndex = '99999';
        textarea.style.overflow = 'hidden';
        textarea.placeholder = 'Введите текст...';

        document.body.appendChild(textarea);
        setTimeout(() => {
          textarea.focus();
          textarea.addEventListener('blur', commitText, { once: true });
        }, 50);

        const commitText = () => {
          const text = textarea.value.trim();
          textarea.remove();
          if (!text) return;

          const elements = getDrawElements(activeCanvasId);
          pushHistory(elements);
          const newEl: DrawElement = {
            id: generateDrawId(),
            type: 'text',
            x: drawPoint.x,
            y: drawPoint.y,
            width: 200,
            text,
            fontSize: currentStyle.fontSize,
            fontFamily: currentStyle.fontFamily,
            textAlign: currentStyle.textAlign,
            stroke: currentStyle.stroke,
            strokeWidth: 0,
            strokeStyle: 'solid',
            visualStyle: currentStyle.visualStyle,
            opacity: currentStyle.opacity,
            startCap: 'none',
            endCap: 'none',
            zIndex: elements.length,
          };
          saveDrawElements(activeCanvasId, [...elements, newEl]);
        };

        textarea.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter' && !ke.shiftKey) {
            ke.preventDefault();
            textarea.blur();
          }
          if (ke.key === 'Escape') {
            textarea.value = '';
            textarea.blur();
          }
        });
        return;
      }
    },
    [activeTool, currentStyle, drawElements.length, getCanvasPoint, startDrawing, clearSelection, handleMiddlePanStart, activeCanvasId, pushHistory, startMarquee, sendPing, isGM, applyFogBrushOperation, snapCanvasPoint, snapLinePoint]
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // ─── Awareness: update local cursor position (throttled to ~30fps) ───
      const now = Date.now();
      if (now - cursorThrottleRef.current >= 33) {
        cursorThrottleRef.current = now;
        const pt = getCanvasPoint(e);
        if (pt) setLocalCursor(pt.x, pt.y);
      }

      // Middle-click pan is handled by global window listeners after it starts.
      if (isMiddlePanRef.current) return;

      // ─── Fog edit mode: block all other handlers, only process fog ───
      if (isGM && useCanvasDrawStore.getState().fogEditMode) {
        if (fogDrawingRef.current) {
          const currentFogTool = useCanvasDrawStore.getState().fogTool;
          if (currentFogTool === 'revealBrush' || currentFogTool === 'coverBrush') {
            const fogPt = getCanvasPoint(e);
            if (fogPt) {
              const dx = fogPt.x - fogBrushTipRef.current.x;
              const dy = fogPt.y - fogBrushTipRef.current.y;
              const dist = Math.hypot(dx, dy);
              if (dist >= 20) {
                fogBrushTipRef.current = { x: fogPt.x, y: fogPt.y };
                const id = `fog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                const reveal: FogReveal = { id, type: 'circle', x: fogPt.x, y: fogPt.y, width: 80, height: 80 };
                applyFogBrushOperation(currentFogTool, reveal);
              }
            }
          }
        }
        return;
      }

      // ─── Fog brush drag ───
      if (fogDrawingRef.current) {
        const currentFogTool = useCanvasDrawStore.getState().fogTool;
        if (currentFogTool === 'revealBrush' || currentFogTool === 'coverBrush') {
          const pt = getCanvasPoint(e);
          if (pt) {
            const dx = pt.x - fogBrushTipRef.current.x;
            const dy = pt.y - fogBrushTipRef.current.y;
            const dist = Math.hypot(dx, dy);
            if (dist >= 20) {
              fogBrushTipRef.current = { x: pt.x, y: pt.y };
              const id = `fog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const reveal: FogReveal = { id, type: 'circle', x: pt.x, y: pt.y, width: 80, height: 80 };
              applyFogBrushOperation(currentFogTool, reveal);
            }
          }
          return;
        }
        // Not a brush tool dragging — continue to other handlers
      }

      // Select mode drag
      if (isDraggingElement && activeTool === 'select') {
        const pt = getCanvasPoint(e);
        if (pt) handleSelectDragMove(pt, e.evt.shiftKey);
        return;
      }

      // Marquee selection drag
      if (activeTool === 'select' && isDrawingRef.current && useCanvasDrawStore.getState().marquee) {
        const pt = getCanvasPoint(e);
        if (pt) {
          const m = useCanvasDrawStore.getState().marquee!;
          updateMarquee(pt.x - m.x, pt.y - m.y);
        }
        return;
      }

      // Lasso drag
      if (activeTool === 'lasso' && isDrawingRef.current) {
        const pt = getCanvasPoint(e);
        if (pt && lassoPointsRef.current.length >= 2) {
          const lastX = lassoPointsRef.current[lassoPointsRef.current.length - 2];
          const lastY = lassoPointsRef.current[lassoPointsRef.current.length - 1];
          const dist = Math.hypot(pt.x - lastX, pt.y - lastY);
          if (dist >= 8) {
            lassoPointsRef.current = [...lassoPointsRef.current, pt.x, pt.y];
            // Force re-render for lasso visualization
            setLassoPoints([...lassoPointsRef.current]);
          }
        }
        return;
      }

      if (!isDrawingRef.current || !drawingElement) return;

      const rawPoint = getCanvasPoint(e);
      if (!rawPoint) return;
      const snappedLinePoint = activeTool === 'line'
        ? snapLinePoint(rawPoint, { disabled: e.evt.shiftKey, excludeIds: drawingElement.id ? [drawingElement.id] : undefined })
        : null;
      const point = activeTool === 'pen'
        ? rawPoint
        : activeTool === 'line'
          ? snappedLinePoint!.point
          : snapCanvasPoint(rawPoint, e.evt.shiftKey);

      if (drawingElement.type === 'line' || drawingElement.type === 'arrow') {
        const pts = drawingElement.points ? [...drawingElement.points] : [];

        if (activeTool === 'pen') {
          // Only add point if far enough from last point (min distance)
          const lastX = pts[pts.length - 2];
          const lastY = pts[pts.length - 1];
          const dist = Math.hypot(point.x - lastX, point.y - lastY);
          if (dist >= MIN_PEN_POINT_DISTANCE) {
            pts.push(point.x, point.y);
          }
        } else {
          pts[pts.length - 2] = point.x;
          pts[pts.length - 1] = point.y;
        }

        const nextElement: DrawElement = { ...drawingElement, points: pts };
        if (activeTool === 'line') {
          if (snappedLinePoint?.binding) nextElement.endBinding = snappedLinePoint.binding;
          else delete nextElement.endBinding;
        }
        updateDrawing(nextElement);
      }

      if (drawingElement.type === 'rectangle' || drawingElement.type === 'ellipse' || drawingElement.type === 'frame') {
        const startX = drawingElement.x || 0;
        const startY = drawingElement.y || 0;
        updateDrawing({
          ...drawingElement,
          width: point.x - startX,
          height: point.y - startY,
        });
      }
    },
    [activeTool, drawingElement, getCanvasPoint, updateDrawing, isDraggingElement, handleSelectDragMove, updateMarquee, setLocalCursor, isGM, applyFogBrushOperation, snapCanvasPoint, snapLinePoint]
  );

  const handleMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      setObjectSnapPreview(null);

      // End middle-click pan
      if (isMiddlePanRef.current) {
        handleMiddlePanEnd();
        return;
      }

      // ─── Fog rect/brush end ───
      if (fogDrawingRef.current) {
        const currentFogTool = useCanvasDrawStore.getState().fogTool;
        if (currentFogTool === 'revealRect' || currentFogTool === 'coverRect') {
          fogDrawingRef.current = false;
          const pt = getCanvasPoint(e);
          if (pt) {
            const sx = Math.min(fogBrushTipRef.current.x, pt.x);
            const sy = Math.min(fogBrushTipRef.current.y, pt.y);
            const sw = Math.abs(pt.x - fogBrushTipRef.current.x);
            const sh = Math.abs(pt.y - fogBrushTipRef.current.y);
            if (sw > 10 && sh > 10) {
              const id = `fog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const reveal: FogReveal = { id, type: 'rect', x: sx, y: sy, width: sw, height: sh };
              if (currentFogTool === 'coverRect') useCanvasSyncStore.getState().addFogReveal(reveal);
              else useCanvasSyncStore.getState().removeIntersectingReveals(reveal);
            }
          }
          return;
        }
        if (currentFogTool === 'revealBrush' || currentFogTool === 'coverBrush') {
          fogDrawingRef.current = false;
          commitCanvasFogPreview();
          return;
        }
      }

      // End select drag
      if (isDraggingElement) {
        handleSelectDragEnd();
        return;
      }

      // End marquee selection
      if (activeTool === 'select' && isDrawingRef.current) {
        isDrawingRef.current = false;
        const rect = finishMarquee();
        if (rect && (Math.abs(rect.w) > 5 || Math.abs(rect.h) > 5)) {
          const elements = getDrawElements(activeCanvasId);
          const hits = elementsInRect(elements, rect.x, rect.y, rect.w, rect.h);
          const validHits = hits.filter(el => el.type !== 'frame');
          if (validHits.length > 0) {
            selectElements(validHits.map(el => el.id));
          }
        }
        return;
      }

      // End lasso selection
      if (activeTool === 'lasso' && isDrawingRef.current) {
        isDrawingRef.current = false;
        const pts = [...lassoPointsRef.current];
        lassoPointsRef.current = [];
        setLassoPoints([]);
        if (pts.length >= 6) {
          // Pre-calculate lasso bounding box for fast intersection rejection
          let lxMin = Infinity, lyMin = Infinity, lxMax = -Infinity, lyMax = -Infinity;
          for (let i = 0; i < pts.length; i += 2) {
            lxMin = Math.min(lxMin, pts[i]);
            lxMax = Math.max(lxMax, pts[i]);
            lyMin = Math.min(lyMin, pts[i + 1]);
            lyMax = Math.max(lyMax, pts[i + 1]);
          }

          const elements = getDrawElements(activeCanvasId);
          const selected = elements.filter(el => {
            if (el.type === 'frame') return false;

            const b = getElementBounds(el);
            let ex = b.x, ey = b.y, ew = b.w, eh = b.h;
            // Normalize width/height
            if (ew < 0) { ex += ew; ew = Math.abs(ew); }
            if (eh < 0) { ey += eh; eh = Math.abs(eh); }

            // 1. Fast rejection: if bounding boxes don't intersect, it's definitely false
            if (ex > lxMax || ex + ew < lxMin || ey > lyMax || ey + eh < lyMin) return false;

            // 2. See if any lasso point falls inside the element's box (lasso drawn THROUGH element)
            for (let i = 0; i < pts.length; i += 2) {
              const lx = pts[i], ly = pts[i + 1];
              if (lx >= ex && lx <= ex + ew && ly >= ey && ly <= ey + eh) return true;
            }

            // 3. Point-in-polygon checks for element center and corners
            const cx = ex + ew / 2, cy = ey + eh / 2;
            if (pointInPolygon(cx, cy, pts)) return true;
            if (pointInPolygon(ex, ey, pts)) return true;
            if (pointInPolygon(ex + ew, ey, pts)) return true;
            if (pointInPolygon(ex, ey + eh, pts)) return true;
            if (pointInPolygon(ex + ew, ey + eh, pts)) return true;

            // 4. For lines, check every point
            if (el.points && el.points.length > 0) {
              for (let i = 0; i < el.points.length; i += 2) {
                if (pointInPolygon(el.points[i], el.points[i + 1], pts)) return true;
              }
            }
            return false;
          });
          if (selected.length > 0) {
            setTool('select');
            selectElements(selected.map(el => el.id));
          } else {
            clearSelection();
          }
        }
        return;
      }

      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;

      const finished = finishDrawing();
      if (!finished) return;

      // Validate and simplify lines
      if ((finished.type === 'line' || finished.type === 'arrow') && finished.points) {
        if (finished.points.length < 4) return;
        const dx = finished.points[0] - finished.points[finished.points.length - 2];
        const dy = finished.points[1] - finished.points[finished.points.length - 1];
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && finished.points.length <= 4) return;

        // Simplify pen-drawn lines with RDP algorithm
        if (activeTool === 'pen' && finished.points.length > 6) {
          finished.points = rdpSimplify(finished.points, RDP_EPSILON);
        }
      }

      // Validate shapes and frames
      if (finished.type === 'rectangle' || finished.type === 'ellipse' || finished.type === 'frame') {
        if (finished.width !== undefined && finished.width < 0) {
          finished.x = (finished.x || 0) + finished.width;
          finished.width = Math.abs(finished.width);
        }
        if (finished.height !== undefined && finished.height < 0) {
          finished.y = (finished.y || 0) + finished.height;
          finished.height = Math.abs(finished.height);
        }
        if ((finished.width || 0) < 3 && (finished.height || 0) < 3) return;

        // Frame: start with default label, user enters inline after creation
        if (finished.type === 'frame') {
          finished.frameLabel = 'Frame';
        }
      }

      const elements = getDrawElements(activeCanvasId);
      pushHistory(elements);
      saveDrawElements(activeCanvasId, [...elements, finished]);

      // If frame, select it and open inline label editing
      if (finished.type === 'frame') {
        setTool('select');
        selectElement(finished.id);
        // Delay to allow re-render, then start editing label inline
        setTimeout(() => {
          setEditingFrameLabelId(finished.id);
        }, 100);
      }
    },
    [activeCanvasId, activeTool, finishDrawing, handleMiddlePanEnd, isDraggingElement, handleSelectDragEnd, finishMarquee, selectElements, pushHistory, selectElement, setTool, setEditingFrameLabelId, clearSelection, getCanvasPoint, commitCanvasFogPreview]
  );

  const handleMouseLeave = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // During middle-button camera pan, the pointer may cross DOM windows,
      // drawers or canvas HTML overlays. Only the real global release ends it.
      if (isMiddlePanRef.current) return;
      handleMouseUp(e);
    },
    [handleMouseUp]
  );

  // ─── Select mode: double click to edit text ───
  const handleTextDblClick = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      if (activeTool !== 'select') return;
      const elements = getDrawElements(activeCanvasId);
      const textEl = elements.find(el => el.id === id);
      if (!textEl || textEl.type !== 'text') return;

      const stage = e.target.getStage();
      if (!stage) return;
      const container = stage.container();
      const rect = container.getBoundingClientRect();
      const scale = stage.scaleX();

      const screenX = (textEl.x || 0) * scale + stage.x() + rect.left;
      const screenY = (textEl.y || 0) * scale + stage.y() + rect.top;

      setEditingTextId(id);

      const textarea = document.createElement('textarea');
      textarea.value = textEl.text || '';
      textarea.style.position = 'fixed';
      textarea.style.left = `${screenX}px`;
      textarea.style.top = `${screenY}px`;
      textarea.style.minWidth = '120px';
      textarea.style.minHeight = '36px';
      textarea.style.width = `${(textEl.width || 200) * scale}px`;
      textarea.style.height = `${(textEl.height || textEl.fontSize! * 1.4) * scale}px`;
      textarea.style.fontSize = `${textEl.fontSize! * scale}px`;
      textarea.style.fontFamily = getKonvaFontFamily(textEl.fontFamily || 'sans');
      textarea.style.color = textEl.stroke;
      textarea.style.background = 'transparent';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.resize = 'both';
      textarea.style.zIndex = '99999';
      textarea.style.overflow = 'hidden';

      document.body.appendChild(textarea);
      setTimeout(() => {
        textarea.focus();
        textarea.addEventListener('blur', commitEdit, { once: true });
      }, 50);

      const commitEdit = () => {
        const newText = textarea.value.trim();
        textarea.remove();
        setEditingTextId(null);
        if (newText !== textEl.text) {
          const els = getDrawElements(activeCanvasId);
          pushHistory(els);
          const updated = els.map(el =>
            el.id === id ? { ...el, text: newText } : el
          );
          saveDrawElements(activeCanvasId, updated);
        }
      };

      textarea.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter' && !ke.shiftKey) {
          ke.preventDefault();
          textarea.blur();
        }
        if (ke.key === 'Escape') {
          textarea.value = textEl.text || ''; // cancel
          textarea.blur();
        }
      });
    },
    [activeTool, activeCanvasId, setEditingTextId, pushHistory]
  );

  // ─── Select mode: double click on shape to edit description ───

  const handleShapeDblClick = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      if (activeTool !== 'select') return;
      const elements = getDrawElements(activeCanvasId);
      const shapeEl = elements.find(el => el.id === id);
      if (!shapeEl || (shapeEl.type !== 'rectangle' && shapeEl.type !== 'ellipse')) return;

      const stage = e.target.getStage();
      const stageRect = containerRef.current?.getBoundingClientRect();
      if (!stage || !stageRect) return;
      const scale = stage.scaleX();

      const sx = (shapeEl.x || 0) * scale + stage.x() + stageRect.left;
      const sy = (shapeEl.y || 0) * scale + stage.y() + stageRect.top;
      const sw = (shapeEl.width || 100) * scale;
      const sh = (shapeEl.height || 100) * scale;

      const textarea = document.createElement('textarea');
      textarea.value = shapeEl.description || '';
      textarea.placeholder = 'Введите описание...';
      textarea.style.position = 'fixed';
      textarea.style.left = `${sx + 6 * scale}px`;
      textarea.style.top = `${sy + 6 * scale}px`;
      textarea.style.width = `${sw - 12 * scale}px`;
      textarea.style.height = `${sh - 12 * scale}px`;
      textarea.style.fontSize = `${12 * scale}px`;
      textarea.style.color = 'rgba(255,255,255,0.8)';
      textarea.style.background = 'rgba(0,0,0,0.3)';
      textarea.style.backdropFilter = 'blur(10px)';
      textarea.style.border = '1px solid rgba(167,139,250,0.3)';
      textarea.style.borderRadius = '4px';
      textarea.style.outline = 'none';
      textarea.style.resize = 'none';
      textarea.style.zIndex = '99999';
      textarea.style.overflow = 'auto';
      textarea.style.padding = '4px';
      textarea.style.textAlign = 'center';

      document.body.appendChild(textarea);
      setTimeout(() => textarea.focus(), 50);

      const commitEdit = () => {
        const newDesc = textarea.value.trim();
        textarea.remove();
        const els = getDrawElements(activeCanvasId);
        pushHistory(els);
        const updated = els.map(el =>
          el.id === id ? { ...el, description: newDesc || undefined } : el
        );
        saveDrawElements(activeCanvasId, updated);
      };

      textarea.addEventListener('blur', commitEdit, { once: true });
      textarea.addEventListener('keydown', (ke) => {
        if (ke.key === 'Escape') {
          textarea.value = shapeEl.description || '';
          textarea.blur();
        }
        ke.stopPropagation();
      });
    },
    [activeTool, activeCanvasId, pushHistory]
  );

  // ─── Select mode: double click on line to add intermediate point ───

  const handleLineDblClick = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      if (activeTool !== 'select') return;
      const elements = getDrawElements(activeCanvasId);
      const lineEl = elements.find(el => el.id === id);
      if (!lineEl || (lineEl.type !== 'line' && lineEl.type !== 'arrow')) return;
      if (!lineEl.points || lineEl.points.length < 4) return;

      const pt = getCanvasPoint(e);
      if (!pt) return;

      const stage = e.target.getStage();
      const scale = stage?.scaleX() || 1;
      const pointHitRadius = Math.max(POINT_HANDLE_RADIUS * 1.75, 10 / Math.max(0.1, scale));
      const deletePointIndex = findEditableLinePointNear(lineEl.points, pt, pointHitRadius);
      const newPts = deletePointIndex == null
        ? insertLinePointAtClosestSegment(lineEl.points, pt)
        : removeLinePointAtIndex(lineEl.points, deletePointIndex);

      if (newPts === lineEl.points) return;

      pushHistory(elements);
      const updated = elements.map(el =>
        el.id === id ? { ...el, points: newPts } : el
      );
      saveDrawElements(activeCanvasId, updated);
    },
    [activeTool, activeCanvasId, getCanvasPoint, pushHistory]
  );

  // ─── Double click on element to edit objectName ───

  const handleElementNameDblClick = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      if (activeTool !== 'select') return;
      const elements = getDrawElements(activeCanvasId);
      const el = elements.find(el => el.id === id);
      if (!el) return;
      // Only for shapes and lines (not text, not frame — those have their own dbl-click)
      if (el.type === 'text' || el.type === 'frame' || el.type === 'image') return;

      const stage = e.target.getStage();
      const stageRect = containerRef.current?.getBoundingClientRect();
      if (!stage || !stageRect) return;
      const scale = stage.scaleX();

      const bounds = getElementBounds(el);
      const screenX = bounds.x * scale + stage.x() + stageRect.left;
      const screenY = (bounds.y - 20) * scale + stage.y() + stageRect.top;
      const screenW = Math.max(bounds.w * scale, 100);

      const input = document.createElement('input');
      input.type = 'text';
      input.value = el.objectName || '';
      input.placeholder = 'Название объекта...';
      input.style.position = 'fixed';
      input.style.left = `${screenX}px`;
      input.style.top = `${screenY}px`;
      input.style.width = `${screenW}px`;
      input.style.height = `${16 * scale}px`;
      input.style.fontSize = `${11 * scale}px`;
      input.style.fontWeight = 'bold';
      input.style.color = 'rgba(255,255,255,0.8)';
      input.style.background = 'rgba(0,0,0,0.5)';
      input.style.backdropFilter = 'blur(20px)';
      input.style.border = '1px solid rgba(167,139,250,0.4)';
      input.style.borderRadius = '4px';
      input.style.padding = '0 6px';
      input.style.outline = 'none';
      input.style.zIndex = '99999';
      input.style.textAlign = 'center';
      input.style.boxSizing = 'border-box';

      document.body.appendChild(input);
      setTimeout(() => input.focus(), 50);

      const commit = () => {
        const newName = input.value.trim();
        input.remove();
        const els = getDrawElements(activeCanvasId);
        pushHistory(els);
        const updated = els.map(el2 =>
          el2.id === id ? { ...el2, objectName: newName || undefined, showName: !!newName } : el2
        );
        saveDrawElements(activeCanvasId, updated);
      };

      input.addEventListener('blur', commit, { once: true });
      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') input.blur();
        if (ke.key === 'Escape') {
          input.value = el.objectName || '';
          input.blur();
        }
        ke.stopPropagation();
      });
    },
    [activeTool, activeCanvasId, pushHistory]
  );

  // ─── Select mode: click on element ───

  const handleSelectDrawElement = useCallback(
    (id: string, shiftKey: boolean) => {
      if (activeTool === 'select') {
        selectElement(id, shiftKey);
        const el = drawElements.find((e) => e.id === id);
        if (el) {
          useCanvasDrawStore.getState().setStyle({
            stroke: el.stroke,
            strokeWidth: el.strokeWidth,
            strokeStyle: el.strokeStyle,
            visualStyle: el.visualStyle ?? 'clean',
            lineMode: getLineMode(el.lineMode, (el.points?.length || 0) / 2),
            entityTokenFrame: el.entityTokenFrame ?? 'ring',
            opacity: el.opacity,
            fillOpacity: el.fillOpacity ?? 1,
            strokeOpacity: el.strokeOpacity ?? 1,
            startCap: el.startCap,
            endCap: el.endCap,
            fill: el.fill || '',
            fontSize: el.fontSize ?? 24,
            fontFamily: el.fontFamily ?? 'sans',
            textAlign: el.textAlign ?? 'center',
            textColor: el.textColor ?? '#e2e8f0',
            textOpacity: el.textOpacity ?? 1,
          });
        }
      }
    },
    [activeTool, selectElement, drawElements]
  );

  const updateEntityTokenRepresentation = useCallback(
    (elementId: string, patch: Partial<DrawElement>) => {
      if (!canEditCanvasEntityById(activeCanvasId)) return;
      const elements = getDrawElements(activeCanvasId);
      const target = elements.find((element) => element.id === elementId);
      if (!target || target.type !== 'entityToken') return;

      pushHistory(elements);
      saveDrawElements(activeCanvasId, elements.map((element) => (
        element.id === elementId ? { ...element, ...patch } : element
      )));
    },
    [activeCanvasId, pushHistory]
  );

  const switchEntityTokenMode = useCallback(
    async (element: DrawElement, mode: EntityTokenMode) => {
      if (!element.linkedEntityId) return;
      const linkedEntity = yjsStore.entitiesMap.get(element.linkedEntityId);
      if (!linkedEntity) return;
      const defaults = getEntityCanvasTokenDefaults(linkedEntity, mode);
      const size = await getEntityTokenCanvasSize(linkedEntity, mode, defaults);
      const currentWidth = element.width || size.width;
      const currentHeight = element.height || size.height;
      updateEntityTokenRepresentation(element.id, {
        entityTokenMode: mode,
        x: (element.x || 0) + (currentWidth - size.width) / 2,
        y: (element.y || 0) + (currentHeight - size.height) / 2,
        width: size.width,
        height: size.height,
      });
    },
    [updateEntityTokenRepresentation]
  );

  const applyEntityTokenFramePreset = useCallback(
    (sourceElementId: string, frame: EntityTokenFrame) => {
      if (!canEditCanvasEntityById(activeCanvasId)) return;
      const elements = getDrawElements(activeCanvasId);
      const selection = selectedElementIds.includes(sourceElementId) ? selectedElementIds : [sourceElementId];
      const targetIds = new Set(selection.filter((id) => elements.some((element) => element.id === id && element.type === 'entityToken')));
      if (targetIds.size === 0) return;

      pushHistory(elements);
      saveDrawElements(activeCanvasId, elements.map((element) => (
        targetIds.has(element.id) ? { ...element, entityTokenFrame: frame } : element
      )));
    },
    [activeCanvasId, pushHistory, selectedElementIds]
  );

  // ─── Frame label double-click to rename ───

  const handleFrameLabelDblClick = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      if (activeTool !== 'select') return;
      const elements = getDrawElements(activeCanvasId);
      const frameEl = elements.find(el => el.id === id);
      if (!frameEl || frameEl.type !== 'frame') return;

      // Check that click is on header area
      const pt = getCanvasPoint(e);
      if (!pt) return;
      const fy = frameEl.y || 0;
      if (pt.y < fy - 20 || pt.y > fy) return;

      setEditingFrameLabelId(id);
    },
    [activeTool, activeCanvasId, getCanvasPoint, setEditingFrameLabelId]
  );

  // ─── Select mode: mousedown on element to start drag ───

  const handleElementMouseDown = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      if (activeTool !== 'select' || e.evt.button !== 0) return;
      e.cancelBubble = true;

      // For frames: only allow drag from header area (fy - 20 to fy)
      const el_check = drawElements.find((el) => el.id === id);
      if (el_check && el_check.type === 'frame') {
        const pt = getCanvasPoint(e);
        if (pt) {
          const fy = el_check.y || 0;
          const headerTop = fy - 20;
          const headerBottom = fy;
          // If click is NOT on the header, don't start a frame drag
          if (pt.y < headerTop || pt.y > headerBottom) {
            // Still select, but don't start drag
            if (!selectedElementIds.includes(id)) {
              selectElement(id);
              useCanvasDrawStore.getState().setStyle({
                stroke: el_check.stroke,
                strokeWidth: el_check.strokeWidth,
                strokeStyle: el_check.strokeStyle,
                visualStyle: el_check.visualStyle ?? 'clean',
                lineMode: getLineMode(el_check.lineMode, (el_check.points?.length || 0) / 2),
                entityTokenFrame: el_check.entityTokenFrame ?? 'ring',
                opacity: el_check.opacity,
                startCap: el_check.startCap,
                endCap: el_check.endCap,
                fill: el_check.fill || '',
              });
            }
            return;
          }
        }
      }

      if (e.evt.shiftKey && selectedElementIds.includes(id)) {
        selectElement(id, true);
        return;
      }

      if (!selectedElementIds.includes(id)) {
        selectElement(id, e.evt.shiftKey);
        const el = drawElements.find((el) => el.id === id);
        if (el) {
          useCanvasDrawStore.getState().setStyle({
            stroke: el.stroke,
            strokeWidth: el.strokeWidth,
            strokeStyle: el.strokeStyle,
            visualStyle: el.visualStyle ?? 'clean',
            lineMode: getLineMode(el.lineMode, (el.points?.length || 0) / 2),
            entityTokenFrame: el.entityTokenFrame ?? 'ring',
            opacity: el.opacity,
            startCap: el.startCap,
            endCap: el.endCap,
            fill: el.fill || '',
          });
        }
      }

      const point = getCanvasPoint(e);
      if (point) {
        handleSelectDragStart(point);
      }
    },
    [activeTool, selectedElementIds, selectElement, drawElements, getCanvasPoint, handleSelectDragStart]
  );

  // ─── Bug fix #2: cursor change on hover over selected elements ───

  const handleElementMouseEnter = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (activeTool !== 'select') return;
      const container = e.target.getStage()?.container();
      if (container) container.style.cursor = 'move';
    },
    [activeTool]
  );

  const handleElementMouseLeave = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (activeTool !== 'select') return;
      const container = e.target.getStage()?.container();
      if (container) container.style.cursor = getCursorForTool(activeTool, fogTool);
    },
    [activeTool, fogTool]
  );

  // ─── Determine stage behaviour ───

  const isHandTool = false; // pan is now via middle mouse button only
  const getCursor = (): string => getCursorForTool(activeTool, fogTool);

  const portals = canvasElements.filter((e) => e.type === 'portal');
  const tokens = canvasElements.filter(
    (e) => e.type !== 'portal' && e.type !== 'canvas'
  );

  const stageScale = useCanvasStore((s) => s.scale);
  const stageX = useCanvasStore((s) => s.offset.x);
  const stageY = useCanvasStore((s) => s.offset.y);

  const singleSelectedElement =
    selectedElementIds.length === 1
      ? renderedDrawElements.find((el) => el.id === selectedElementIds[0]) || null
      : null;

  // ─── Drag-and-drop images onto canvas ───

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (isPointerOverNonCanvasUi(e.clientX, e.clientY, containerRef.current)) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = useCanvasStore.getState().scale;
    const offsetX = useCanvasStore.getState().offset.x;
    const offsetY = useCanvasStore.getState().offset.y;
    const rawCanvasPoint = {
      x: (e.clientX - rect.left - offsetX) / scale,
      y: (e.clientY - rect.top - offsetY) / scale,
    };
    const canvasPoint = snapCanvasPoint(rawCanvasPoint, e.shiftKey);

    const draggedEntityId = e.dataTransfer.getData('application/entity-id');
    if (draggedEntityId) {
      const draggedEntity = yjsStore.entitiesMap.get(draggedEntityId);
      if (
        draggedEntity &&
        draggedEntity.type !== 'canvas' &&
        draggedEntity.type !== 'folder' &&
        canViewCanvasEntity(draggedEntity) &&
        canEditCanvasEntityById(activeCanvasId)
      ) {
        setEntityDropChoice({
          entityId: draggedEntityId,
          canvasPoint,
          screenX: e.clientX,
          screenY: e.clientY,
        });
      }
      return;
    }

    const assetPayload = readAssetDragPayload(e.dataTransfer);
    if (assetPayload?.type === 'image') {
      const sourceUrl = assetPayload.url || getAssetUrl(assetPayload.path);
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        insertImageElement({
          sourceUrl,
          assetPath: assetPayload.path,
          objectName: assetPayload.name,
          canvasX: canvasPoint.x,
          canvasY: canvasPoint.y,
          naturalWidth: img.width,
          naturalHeight: img.height,
          centerOnPoint: true,
        });
      };
      img.src = sourceUrl;
      return;
    }

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addNotification({
        kind: 'warning',
        scope: 'local',
        status: 'failed',
        title: 'Файл не добавлен на canvas',
        message: `${file.name}: canvas drag/drop сейчас принимает изображения.`,
      });
      return;
    }

    insertFileImageAtPoint(file, {
      canvasId: activeCanvasId,
      canvasX: canvasPoint.x,
      canvasY: canvasPoint.y,
      screenX: e.clientX,
      screenY: e.clientY,
    }, true);
  }, [activeCanvasId, addNotification, insertFileImageAtPoint, insertImageElement, snapCanvasPoint]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (isPointerOverNonCanvasUi(e.clientX, e.clientY, containerRef.current)) return;

    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleImagePickerSelectAsset = useCallback((asset: AssetRecord) => {
    if (!imagePickerTarget) return;
    const target = imagePickerTarget;
    setImagePickerTarget(null);
    insertAssetImageAtPoint(asset, target);
  }, [imagePickerTarget, insertAssetImageAtPoint]);

  const handleImagePickerUpload = useCallback((file: File) => {
    if (!imagePickerTarget) return;
    const target = imagePickerTarget;
    setImagePickerTarget(null);
    insertFileImageAtPoint(file, target);
  }, [imagePickerTarget, insertFileImageAtPoint]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-x-0 bottom-0 top-0 overflow-hidden bg-transparent"
      style={{ zIndex: 0 }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        ref={stageRef}
        onWheel={handleWheel}
        draggable={isHandTool}
        onDragEnd={handleDragEnd}
        onDragMove={handleDragMove}
        style={{ cursor: getCursor() }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Layer 0: Grid + Snap lines */}
        <Layer>
          {/* Configurable grid (square or hex), auto-transforms with stage */}
          {gridEnabled && (
            <Shape
              listening={false}
              sceneFunc={(context, shape) => {
                const stage = shape.getStage();
                if (!stage) return;
                const w = stage.width();
                const h = stage.height();
                const scale = stage.scaleX();
                const offX = stage.x();
                const offY = stage.y();

                // Adaptive density: skip if grid cells are too small on screen (< 15px)
                const minScreenSpacing = 15;
                let effectiveSpacing = gridSpacing;
                while (effectiveSpacing * scale < minScreenSpacing && effectiveSpacing < 1024) {
                  effectiveSpacing *= 2;
                }
                if (effectiveSpacing * scale < minScreenSpacing / 2) return;

                // Visible area in world coords
                const worldLeft = -offX / scale - effectiveSpacing;
                const worldTop = -offY / scale - effectiveSpacing;
                const worldRight = (w - offX) / scale + effectiveSpacing;
                const worldBottom = (h - offY) / scale + effectiveSpacing;

                const spacing = effectiveSpacing;
                context.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                context.lineWidth = 1 / scale;

                if (gridType === 'square') {
                  const startX = Math.floor(worldLeft / spacing) * spacing;
                  const startY = Math.floor(worldTop / spacing) * spacing;

                  context.beginPath();
                  for (let wx = startX; wx <= worldRight; wx += spacing) {
                    context.moveTo(wx, worldTop);
                    context.lineTo(wx, worldBottom);
                  }
                  for (let wy = startY; wy <= worldBottom; wy += spacing) {
                    context.moveTo(worldLeft, wy);
                    context.lineTo(worldRight, wy);
                  }
                  context.stroke();
                } else {
                  // Hex grid: flat-top hexagons
                  const hexW = spacing;
                  const hexH = spacing * 0.866;
                  const hexStepX = hexW * 0.75;

                  const startCol = Math.floor(worldLeft / hexStepX);
                  const endCol = Math.ceil(worldRight / hexStepX);
                  const startRow = Math.floor(worldTop / hexH) - 1;
                  const endRow = Math.ceil(worldBottom / hexH) + 1;

                  const colCount = endCol - startCol + 1;
                  const rowCount = endRow - startRow + 1;
                  // Safety cap: if still too many after adaptive spacing, skip
                  if (colCount * rowCount > 5000) return;

                  context.beginPath();
                  for (let row = startRow; row <= endRow; row++) {
                    for (let col = startCol; col <= endCol; col++) {
                      const cx = col * hexStepX;
                      const cy = row * hexH + (col % 2 === 0 ? 0 : hexH / 2);
                      const r = hexW / 2;

                      // Quick bounding-box cull
                      if (cx + r < worldLeft || cx - r > worldRight) continue;
                      if (cy + r < worldTop || cy - r > worldBottom) continue;

                      for (let i = 0; i < 6; i++) {
                        const angle = (Math.PI / 180) * (60 * i);
                        const x = cx + r * Math.cos(angle);
                        const y = cy + r * Math.sin(angle);
                        if (i === 0) context.moveTo(x, y);
                        else context.lineTo(x, y);
                      }
                      context.closePath();
                    }
                  }
                  context.stroke();
                }
                context.fillStrokeShape(shape);
              }}
            />
          )}
          <Group ref={(node) => { snapLinesGroupRef.current = node; }} listening={false} />
        </Layer>

        {/* Layer 1: Draw elements (sorted by zIndex) */}
        <Layer>
          {[...renderedDrawElements].sort((a, b) => a.zIndex - b.zIndex).map((element) => (
            <Group
              key={element.id}
              onMouseDown={(e) => handleElementMouseDown(element.id, e)}
              onDblClick={(e) => {
                if (element.type === 'frame') handleFrameLabelDblClick(element.id, e);
                else if (element.type === 'text') handleTextDblClick(element.id, e);
                else if (element.type === 'line' || element.type === 'arrow') {
                  if (e.evt.altKey) {
                    // Alt+DblClick on line → edit name
                    handleElementNameDblClick(element.id, e);
                  } else {
                    // DblClick on line → add intermediate point
                    handleLineDblClick(element.id, e);
                  }
                }
                else if (element.type === 'rectangle' || element.type === 'ellipse') {
                  if (e.evt.altKey) {
                    // Alt+DblClick on shape → edit name
                    handleElementNameDblClick(element.id, e);
                  } else {
                    // DblClick on shape → edit description (text inside)
                    handleShapeDblClick(element.id, e);
                  }
                }
              }}
              onMouseEnter={handleElementMouseEnter}
              onMouseLeave={handleElementMouseLeave}
              onContextMenu={(e) => {
                if (element.type !== 'entityToken') return;
                e.evt.preventDefault();
                e.cancelBubble = true;
                handleSelectDrawElement(element.id, false);
                setEntityTokenMenu({ elementId: element.id, x: e.evt.clientX, y: e.evt.clientY });
              }}
            >
              <DrawElementNode
                element={element}
                isSelected={selectedElementIds.includes(element.id)}
                isEditingText={editingTextId === element.id}
                onSelect={handleSelectDrawElement}
                onDblClickText={handleTextDblClick}
                onOpenLinkedEntity={(entityId, e) => openWindow(entityId, e.evt.clientX, e.evt.clientY)}
                onShowLinkedEntityInfo={(elementId, e) => {
                  const nativeEvent = e.evt;
                  const touch = 'changedTouches' in nativeEvent ? nativeEvent.changedTouches[0] : null;
                  if (entityTokenInfo?.elementId === elementId) {
                    setEntityTokenInfo(null);
                    return;
                  }
                  setEntityTokenInfoTab('stats');
                  setEntityTokenInfo({
                    elementId,
                    x: 'clientX' in nativeEvent ? nativeEvent.clientX : touch?.clientX ?? window.innerWidth / 2,
                    y: 'clientY' in nativeEvent ? nativeEvent.clientY : touch?.clientY ?? window.innerHeight / 2,
                  });
                }}
                isEntityInfoOpen={entityTokenInfo?.elementId === element.id}
              />
            </Group>
          ))}

          {/* Preview of element being drawn */}
          {drawingElement && (
            <DrawElementNode
              element={drawingElement}
              isSelected={false}
              onSelect={() => {}}
              isEntityInfoOpen={false}
            />
          )}

          {objectSnapPreview && (
            <Group listening={false}>
              <Circle
                x={objectSnapPreview.x}
                y={objectSnapPreview.y}
                radius={9 / Math.max(0.1, stageScale)}
                fill="rgba(34, 211, 238, 0.14)"
                stroke="rgba(165, 243, 252, 0.85)"
                strokeWidth={1.5 / Math.max(0.1, stageScale)}
              />
              <Circle
                x={objectSnapPreview.x}
                y={objectSnapPreview.y}
                radius={2.5 / Math.max(0.1, stageScale)}
                fill="rgba(165, 243, 252, 0.95)"
              />
            </Group>
          )}

          {/* Editing handles for selected element */}
          {singleSelectedElement && activeTool === 'select' && (
            <>
              {(singleSelectedElement.type === 'line' || singleSelectedElement.type === 'arrow') && (
                <PointHandles
                  element={singleSelectedElement}
                  onPointDragStart={handlePointDragStart}
                  onPointDragMove={handlePointDragMove}
                  onPointDragEnd={handlePointDragEnd}
                  onPointDoubleClick={handlePointDoubleClick}
                />
              )}

              {(singleSelectedElement.type === 'rectangle' || singleSelectedElement.type === 'ellipse' || singleSelectedElement.type === 'text' || singleSelectedElement.type === 'image' || singleSelectedElement.type === 'frame' || singleSelectedElement.type === 'entityToken') && (
                <ResizeHandles
                  element={singleSelectedElement}
                  onResizeDragMove={handleResizeDragMove}
                  onResizeDragEnd={handleResizeDragEnd}
                />
              )}

              {/* Rotation Handle for shapes and text */}
              {(singleSelectedElement.type === 'rectangle' || singleSelectedElement.type === 'ellipse' || singleSelectedElement.type === 'text' || singleSelectedElement.type === 'image' || singleSelectedElement.type === 'frame') && (
                <RotationHandle
                  element={singleSelectedElement}
                  onRotateDragMove={handleRotateDragMove}
                  onRotateDragEnd={handleRotateDragEnd}
                />
              )}
            </>
          )}

          {/* Group bounding box for multi-selection */}
          {selectedElementIds.length > 1 && activeTool === 'select' && (() => {
            const selectedEls = renderedDrawElements.filter(el => selectedElementIds.includes(el.id));
            if (selectedEls.length < 2) return null;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const el of selectedEls) {
              const b = getElementBounds(el);
              minX = Math.min(minX, b.x);
              minY = Math.min(minY, b.y);
              maxX = Math.max(maxX, b.x + b.w);
              maxY = Math.max(maxY, b.y + b.h);
            }
            return (
              <Rect
                x={minX - 6}
                y={minY - 6}
                width={maxX - minX + 12}
                height={maxY - minY + 12}
                stroke="rgba(167,139,250,0.35)"
                strokeWidth={1.5}
                dash={[6, 4]}
                cornerRadius={4}
                listening={false}
              />
            );
          })()}

          {/* Marquee selection rectangle */}
          {marquee && (
            <Rect
              x={marquee.w < 0 ? marquee.x + marquee.w : marquee.x}
              y={marquee.h < 0 ? marquee.y + marquee.h : marquee.y}
              width={Math.abs(marquee.w)}
              height={Math.abs(marquee.h)}
              fill="rgba(167,139,250,0.08)"
              stroke="rgba(167,139,250,0.5)"
              strokeWidth={1}
              dash={[6, 3]}
              listening={false}
            />
          )}

          {/* Lasso selection polygon */}
          {lassoPoints.length >= 4 && (
            <Line
              points={lassoPoints}
              stroke="rgba(167,139,250,0.6)"
              strokeWidth={1.5}
              dash={[4, 4]}
              fill="rgba(167,139,250,0.06)"
              closed
              listening={false}
            />
          )}

          {/* Smart Snapping Guides - rendered via Konva directly (no React re-render) */}
          <Group ref={(node) => { snapLinesGroupRef.current = node; }} listening={false} />
        </Layer>

        {/* Layer 2.5: Remote player cursors + ping pulses (Awareness) */}
        <Layer listening={false}>
          {Object.entries(remoteCursors).map(([peerId, cursor]) => {
            const pingActive = cursor.ping && (cursorNow - cursor.ping.timestamp < PING_DURATION_MS);
            return (
              <Group key={peerId}>
                {/* Ping pulse at ping location */}
                {pingActive && cursor.ping && (
                  <Group x={cursor.ping.x} y={cursor.ping.y}>
                    <PingPulse color={cursor.color} />
                    <Text
                      x={-40}
                      y={-30}
                      width={80}
                      text={cursor.name}
                      fontSize={11}
                      fontStyle="bold"
                      fill={cursor.color}
                      align="center"
                      listening={false}
                    />
                  </Group>
                )}
                {/* Regular cursor dot (separate from ping location) */}
                <Group x={cursor.x} y={cursor.y}>
                  <Circle
                    radius={4}
                    fill={cursor.color}
                    shadowColor={cursor.color}
                    shadowBlur={8}
                    listening={false}
                  />
                  <Text
                    x={8}
                    y={-20}
                    text={cursor.name}
                    fontSize={11}
                    fontStyle="bold"
                    fill={cursor.color}
                    listening={false}
                  />
                  {cursor.role === 'gm' && (
                    <>
                      <Rect
                        x={8}
                        y={-4}
                        width={20}
                        height={13}
                        fill="rgba(239,68,68,0.8)"
                        cornerRadius={3}
                        listening={false}
                      />
                      <Text
                        x={8}
                        y={-3}
                        width={20}
                        text="ГМ"
                        fontSize={8}
                        fontStyle="bold"
                        fill="white"
                        align="center"
                        listening={false}
                      />
                    </>
                  )}
                </Group>
              </Group>
            );
          })}
        </Layer>

        {/* Layer 2: Portals and Tokens */}
        <Layer>
          {/* Origin Marker */}
          <Group x={0} y={0} listening={false}>
            <Circle radius={10} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
            <Circle radius={2} fill="rgba(255,255,255,0.5)" />
            <Text text="(0,0)" fill="rgba(255,255,255,0.3)" fontSize={10} x={15} y={-5} />
          </Group>

          {/* Portals */}
          {portals.map((portal) => {
            const canEditPortal = canEditEntity(portal);
            const targetCanvasId = typeof portal.properties?.targetCanvasId === 'string' ? portal.properties.targetCanvasId : '';
            const targetCanvas = targetCanvasId ? yjsStore.entitiesMap.get(targetCanvasId) : undefined;
            const canViewTargetCanvas = canViewCanvasEntity(targetCanvas);
            const targetName = canViewTargetCanvas ? targetCanvas.name : '';
            return (
              <Group
                key={portal.id}
                x={portal.properties.x || 0}
                y={portal.properties.y || 0}
                opacity={canViewTargetCanvas ? 1 : 0.5}
                draggable={canEditPortal}
                onDragEnd={(e) => {
                  if (!canEditPortal) return;
                  yjsStore.updateEntity(portal.id, {
                    properties: { ...portal.properties, x: e.target.x(), y: e.target.y() },
                  });
                }}
                onDblClick={(e) => {
                  e.cancelBubble = true;
                  if (targetCanvasId && canViewTargetCanvas) navigate(targetCanvasId);
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  e.cancelBubble = true;
                  if (targetCanvasId && canViewTargetCanvas) {
                    setPortalMenu({ x: e.evt.clientX, y: e.evt.clientY, portal });
                  }
                }}
                onMouseEnter={(e) => {
                  const c = e.target.getStage()?.container();
                  if (c) c.style.cursor = canViewTargetCanvas ? 'pointer' : getCursor();
                }}
                onMouseLeave={(e) => {
                  const c = e.target.getStage()?.container();
                  if (c) c.style.cursor = getCursor();
                }}
              >
                {/* Outer pulsating ring */}
                <PortalPulseRing />
                {/* Inner solid circle */}
                <Circle
                  radius={40}
                  fill="#4338ca"
                  stroke="#818cf8"
                  strokeWidth={3}
                  shadowColor="#6366f1"
                  shadowBlur={25}
                  shadowOffsetY={2}
                />
                {/* Swirl decoration */}
                <Circle
                  radius={28}
                  stroke="rgba(165,180,252,0.25)"
                  strokeWidth={2}
                  dash={[8, 8]}
                />
                {/* Center icon */}
                <Text
                  text="🌀"
                  fontSize={24}
                  x={-12}
                  y={-12}
                  listening={false}
                />
                {/* Portal name */}
                <Text
                  text={portal.name}
                  x={-50}
                  y={48}
                  fill="white"
                  fontSize={13}
                  fontStyle="bold"
                  align="center"
                  width={100}
                  listening={false}
                />
                {/* Target canvas label */}
                {targetName && (
                  <Text
                    text={`→ ${targetName}`}
                    x={-50}
                    y={64}
                    fill="rgba(165,180,252,0.6)"
                    fontSize={10}
                    align="center"
                    width={100}
                    listening={false}
                  />
                )}
              </Group>
            );
          })}

          {/* Tokens */}
          {tokens.map((token) => {
            const canEditToken = canEditEntity(token);

            return (
              <Group
                key={token.id}
                x={token.properties.x || 0}
                y={token.properties.y || 0}
                draggable={canEditToken}
                onDragEnd={(e) => {
                  if (!canEditToken) return;
                  yjsStore.updateEntity(token.id, {
                    properties: { ...token.properties, x: e.target.x(), y: e.target.y() },
                  });
                }}
                onDblClick={(e) => {
                  e.cancelBubble = true;
                  openWindow(token.id, e.evt.clientX, e.evt.clientY);
                }}
                onMouseEnter={(e) => {
                  const c = e.target.getStage()?.container();
                  if (c) c.style.cursor = 'pointer';
                }}
                onMouseLeave={(e) => {
                  const c = e.target.getStage()?.container();
                  if (c) c.style.cursor = getCursor();
                }}
              >
              <Circle
                radius={30}
                fill="#1f2937"
                stroke="#4b5563"
                strokeWidth={3}
                shadowColor="#000000"
                shadowBlur={10}
                shadowOffsetY={2}
              />
              <Text
                text={token.name.charAt(0).toUpperCase()}
                x={-15}
                y={-12}
                fill="#d1d5db"
                fontSize={24}
                fontStyle="bold"
                align="center"
                width={30}
              />
              <Text
                text={token.name}
                x={-60}
                y={35}
                fill="#9ca3af"
                fontSize={12}
                fontStyle="bold"
                align="center"
                width={120}
              />
              </Group>
            );
          })}
        </Layer>

        {/* Layer 3: Fog of War */}
        <FogOfWarLayer
          fogReveals={renderedFogReveals}
          isGM={isGM}
          stageWidth={dimensions.width}
          stageHeight={dimensions.height}
          stageScale={stageScale}
          stageX={stageX}
          stageY={stageY}
        />
      </Stage>

      {/* Image tool asset picker */}
      {imagePickerTarget && (
        <CanvasImagePicker
          x={imagePickerTarget.screenX}
          y={imagePickerTarget.screenY}
          onClose={() => setImagePickerTarget(null)}
          onSelectAsset={handleImagePickerSelectAsset}
          onUploadFile={handleImagePickerUpload}
        />
      )}

      {entityDropChoice && (() => {
        const linkedEntity = yjsStore.entitiesMap.get(entityDropChoice.entityId);
        if (!linkedEntity || !canViewCanvasEntity(linkedEntity)) return null;
        const menuWidth = 260;
        const left = Math.min(entityDropChoice.screenX + 12, window.innerWidth - menuWidth - 12);
        const top = Math.min(entityDropChoice.screenY + 12, window.innerHeight - 236);
        const actions = getEntityDropActions(
          {
            id: linkedEntity.id,
            type: linkedEntity.type,
            database: linkedEntity.database,
            parentId: linkedEntity.parentId,
          },
          { kind: 'canvas', canvasId: activeCanvasId || 'root' },
          {
            role: yjsStore.localRole,
            canModifySource: canEditEntity(linkedEntity),
            canModifyTarget: canEditCanvasEntityById(activeCanvasId),
          }
        );
        const canPlaceToken = actions.some((action) => action.id === 'place-token');
        const canPlaceCard = actions.some((action) => action.id === 'place-card');
        const copyAction = actions.find((action) => action.id === 'copy-entity');
        const moveAction = actions.find((action) => action.id === 'move-entity');
        const insertRepresentation = (mode: EntityTokenMode) => {
          const target = entityDropChoice;
          setEntityDropChoice(null);
          void insertEntityTokenElement(target.entityId, target.canvasPoint, mode);
        };
        const copyEntityToCanvas = () => {
          if (!activeCanvasId) return;
          const targetDb = getCanvasTargetDatabase(activeCanvasId, linkedEntity.database);
          yjsStore.cloneEntity(linkedEntity.id, activeCanvasId, targetDb);
          setEntityDropChoice(null);
        };
        const moveEntityToCanvas = () => {
          if (!activeCanvasId) return;
          const targetDb = getCanvasTargetDatabase(activeCanvasId, linkedEntity.database);
          moveEntityTreeToParent(linkedEntity.id, activeCanvasId, targetDb);
          setEntityDropChoice(null);
        };

        return (
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setEntityDropChoice(null)}
              onContextMenu={(event) => {
                event.preventDefault();
                setEntityDropChoice(null);
              }}
            />
            <div
              className="fixed z-[9999] w-[260px] overflow-hidden rounded-xl border border-white/10 bg-[#101722]/95 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
              style={{ left, top }}
            >
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold uppercase tracking-widest text-white/35">Вставить сущность</div>
                  <div className="truncate text-sm font-bold text-white/90">{linkedEntity.name}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEntityDropChoice(null)}
                  className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/45 transition-colors hover:border-white/25 hover:text-white"
                >
                  ×
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {canPlaceToken && (
                  <button
                    type="button"
                    onClick={() => insertRepresentation('token')}
                    className="flex h-16 flex-col items-center justify-center gap-1 rounded-lg border border-cyan-200/20 bg-cyan-300/10 text-cyan-50 transition-colors hover:border-cyan-200/40 hover:bg-cyan-300/18"
                  >
                    <Box size={18} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Фишка</span>
                  </button>
                )}
                {canPlaceCard && (
                  <button
                    type="button"
                    onClick={() => insertRepresentation('art')}
                    className="flex h-16 flex-col items-center justify-center gap-1 rounded-lg border border-amber-200/20 bg-amber-300/10 text-amber-50 transition-colors hover:border-amber-200/40 hover:bg-amber-300/18"
                  >
                    <ImageIcon size={18} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Карточка</span>
                  </button>
                )}
              </div>
              {(copyAction || moveAction) && (
                <div className="mt-2 grid gap-2 border-t border-white/10 pt-2">
                  {copyAction && (
                    <button
                      type="button"
                      onClick={copyEntityToCanvas}
                      className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-left text-xs font-bold uppercase tracking-wider text-white/70 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white"
                    >
                      <Copy size={15} />
                      <span className="truncate">{copyAction.label}</span>
                    </button>
                  )}
                  {moveAction && (
                    <button
                      type="button"
                      onClick={moveEntityToCanvas}
                      className="flex h-10 items-center gap-2 rounded-lg border border-amber-200/20 bg-amber-300/10 px-3 text-left text-xs font-bold uppercase tracking-wider text-amber-50 transition-colors hover:border-amber-200/40 hover:bg-amber-300/18"
                    >
                      <MoveRight size={15} />
                      <span className="truncate">{moveAction.label}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        );
      })()}

      {entityTokenInfo && (() => {
        const element = renderedDrawElements.find((el) => el.id === entityTokenInfo.elementId);
        const linkedEntity = element?.linkedEntityId ? yjsStore.entitiesMap.get(element.linkedEntityId) : undefined;
        if (!element || !linkedEntity || !canViewCanvasEntity(linkedEntity)) return null;
        const mode = element.entityTokenMode || 'token';
        const rawImageSource = getEntityCanvasTokenImageSource(linkedEntity, mode);
        const imageSource = resolveCanvasImageSource(rawImageSource);
        const visibleTags = linkedEntity.tags.slice(0, 3);
        const description = getPlainEntityDescription(linkedEntity);
        const allEntitiesForCard = Array.from(yjsStore.entitiesMap.values());
        const characterSummary = linkedEntity.type === 'character'
          ? buildCharacterCompactSummary(linkedEntity, allEntitiesForCard)
          : null;
        const cardWidth = characterSummary ? 340 : 280;
        const cardMaxHeight = characterSummary ? 460 : 240;
        const safeCardWidth = Math.max(240, Math.min(cardWidth, window.innerWidth - 24));
        const left = Math.max(12, Math.min(entityTokenInfo.x + 12, window.innerWidth - safeCardWidth - 12));
        const top = Math.max(12, Math.min(entityTokenInfo.y + 12, window.innerHeight - cardMaxHeight - 12));
        return (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setEntityTokenInfo(null)} />
            <div
              className="fixed z-[9999] overflow-y-auto rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-window)] p-3 text-[var(--vibe-text-primary)] shadow-[var(--vibe-shadow-window)] backdrop-blur-[var(--vibe-backdrop-blur)] custom-scrollbar"
              style={{ left, top, width: safeCardWidth, maxHeight: `min(${cardMaxHeight}px, calc(100vh - 24px))` }}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)]">
                    {imageSource ? (
                      <img src={imageSource} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-base font-bold text-[var(--vibe-text-muted)]">{linkedEntity.name.trim().charAt(0).toUpperCase() || '?'}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-[var(--vibe-text-primary)]">{linkedEntity.name}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-widest text-[var(--vibe-text-faint)]">{linkedEntity.type}</div>
                    {visibleTags.length > 0 && (
                      <div className="mt-1 flex min-w-0 flex-wrap gap-1">
                        {visibleTags.map((tag) => (
                          <span key={tag} className="max-w-[72px] truncate rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEntityTokenInfo(null)}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                >
                  ×
                </button>
              </div>

              {characterSummary ? (
                <div className="mb-2 space-y-2">
                  <div className="grid grid-cols-4 gap-1 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-1">
                    {CHARACTER_COMPACT_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setEntityTokenInfoTab(tab.id)}
                        className={`h-7 rounded-[var(--vibe-radius-sm)] text-[10px] font-bold uppercase tracking-wider transition-colors ${entityTokenInfoTab === tab.id
                          ? 'bg-[var(--vibe-accent-soft)] text-[var(--vibe-text-primary)] shadow-[inset_0_0_0_1px_var(--vibe-border-strong)]'
                          : 'text-[var(--vibe-text-faint)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {entityTokenInfoTab === 'stats' && (
                    <div className="space-y-2">
                      {characterSummary.metrics.length > 0 ? (
                        <div className="grid grid-cols-4 gap-1.5">
                          {characterSummary.metrics.map((metric) => (
                            <div key={metric.id} className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1.5 text-center">
                              <div className="text-[8px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{metric.label}</div>
                              <div className="font-mono text-sm font-bold text-[var(--vibe-text-primary)]">{metric.value}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3 text-center text-[11px] text-[var(--vibe-text-faint)]">
                          Быстрые статы пока не заполнены.
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          ['Атаки', characterSummary.attackCount],
                          ['Способ.', characterSummary.abilityCount],
                          ['Вещи', characterSummary.inventoryCount],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-accent-soft)] px-2 py-1.5 text-center">
                            <div className="text-[8px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{label}</div>
                            <div className="font-mono text-sm font-bold text-[var(--vibe-accent)]">{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {entityTokenInfoTab === 'actions' && (
                    <div className="space-y-1.5">
                      {characterSummary.actions.length > 0 ? characterSummary.actions.map((action) => {
                        const actionEntity = yjsStore.entitiesMap.get(action.id);
                        const parentEntity = actionEntity?.parentId ? yjsStore.entitiesMap.get(actionEntity.parentId) : undefined;
                        const relatedEntities = [
                          ...(parentEntity && parentEntity.id !== linkedEntity.id ? [parentEntity] : []),
                          linkedEntity,
                        ];
                        const canRollAction = Boolean(actionEntity && action.formula);

                        return (
                          <div key={action.id} className="flex items-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1.5">
                            <span className={`flex h-6 w-9 flex-shrink-0 items-center justify-center rounded-[var(--vibe-radius-sm)] border text-[9px] font-black uppercase tracking-wider ${action.kind === 'attack'
                              ? 'border-[color-mix(in_srgb,var(--vibe-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--vibe-danger)_14%,transparent)] text-[var(--vibe-danger)]'
                              : 'border-[color-mix(in_srgb,var(--vibe-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--vibe-accent)_14%,transparent)] text-[var(--vibe-accent)]'
                            }`}>
                              {action.kind === 'attack' ? 'АТК' : 'СП'}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-bold text-[var(--vibe-text-primary)]">{action.name}</div>
                              <div className="truncate text-[10px] text-[var(--vibe-text-faint)]">{action.parentName || (action.kind === 'attack' ? 'Атака персонажа' : 'Способность')}</div>
                            </div>
                            <div className="max-w-[86px] truncate rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-1.5 py-1 font-mono text-[10px] text-[var(--vibe-text-muted)]">
                              {action.formula || 'без формулы'}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (!actionEntity) return;
                                rollEntityActionToChat(actionEntity, action.kind, relatedEntities);
                              }}
                              disabled={!canRollAction}
                              title={canRollAction ? `Бросить ${action.formula}` : 'Укажите формулу броска'}
                              className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-[var(--vibe-radius-sm)] border transition-colors ${canRollAction
                                ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)] hover:bg-[var(--vibe-surface-hover)]'
                                : 'cursor-not-allowed border-transparent bg-[var(--vibe-surface-block)] text-[var(--vibe-text-faint)]'
                              }`}
                            >
                              <Dices size={13} />
                            </button>
                          </div>
                        );
                      }) : (
                        <div className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3 text-center text-[11px] text-[var(--vibe-text-faint)]">
                          Атаки и способности пока не добавлены.
                        </div>
                      )}
                    </div>
                  )}

                  {entityTokenInfoTab === 'resources' && (
                    <div className="space-y-2">
                      {characterSummary.resources.length > 0 && (
                        <div className="grid gap-1.5">
                          {characterSummary.resources.map((resource) => (
                            <div key={resource.id} className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1.5">
                              <div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                <span className="truncate">{resource.label}</span>
                                <span className="font-mono text-[var(--vibe-text-muted)]">{resource.current}/{resource.max || '∞'}</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)]">
                                <div
                                  className={`h-full rounded-full ${resource.id === 'wounds' ? 'bg-[var(--vibe-danger)]' : 'bg-[var(--vibe-accent)]'}`}
                                  style={{ width: `${Math.max(4, resource.ratio * 100)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {characterSummary.inventory.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[9px] font-black uppercase tracking-widest text-[var(--vibe-text-faint)]">Инвентарь</div>
                          {characterSummary.inventory.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1.5">
                              <div className="min-w-0">
                                <div className="truncate text-xs font-bold text-[var(--vibe-text-primary)]">{item.name}</div>
                                <div className="truncate text-[10px] text-[var(--vibe-text-faint)]">{item.category}</div>
                              </div>
                              {item.equipped && (
                                <span className="flex-shrink-0 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--vibe-success)_14%,transparent)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-success)]">
                                  надето
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {characterSummary.resources.length === 0 && characterSummary.inventory.length === 0 && (
                        <div className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3 text-center text-[11px] text-[var(--vibe-text-faint)]">
                          Ресурсы и вещи пока не заполнены.
                        </div>
                      )}
                    </div>
                  )}

                  {entityTokenInfoTab === 'notes' && (
                    <div className="max-h-32 overflow-y-auto rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-2 text-[11px] leading-relaxed text-[var(--vibe-text-muted)] custom-scrollbar">
                      {description || 'Описание пока пустое.'}
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-h-24 overflow-hidden rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-2 text-[11px] leading-relaxed text-[var(--vibe-text-muted)]">
                  {description || 'Описание пока пустое.'}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  openWindow(linkedEntity.id, entityTokenInfo.x, entityTokenInfo.y);
                  setEntityTokenInfo(null);
                }}
                className="mt-3 h-8 w-full rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-xs font-bold uppercase tracking-wider text-[var(--vibe-text-primary)] transition-colors hover:bg-[var(--vibe-surface-hover)]"
              >
                Открыть сущность
              </button>
            </div>
          </>
        );
      })()}

      {/* Inline frame label editing overlay */}
      {editingFrameLabelId && (() => {
        const frameEl = drawElements.find(el => el.id === editingFrameLabelId);
        if (!frameEl || frameEl.type !== 'frame') return null;
        const fx = frameEl.x || 0;
        const fy = frameEl.y || 0;
        const fw = frameEl.width || 300;
        // We assume the canvas covers the full viewport (left:0, top:0) 
        // to avoid reading containerRef.current during render
        const rectLeft = 0;
        const rectTop = 0;
        const screenX = fx * stageScale + stageX + rectLeft;
        const screenY = (fy - 20) * stageScale + stageY + rectTop;
        const screenW = fw * stageScale;

        return (
          <input
            autoFocus
            type="text"
            defaultValue={frameEl.frameLabel || 'Frame'}
            style={{
              position: 'fixed',
              left: `${screenX}px`,
              top: `${screenY}px`,
              width: `${screenW}px`,
              height: `${18 * stageScale}px`,
              fontSize: `${11 * stageScale}px`,
              fontWeight: 'bold',
              color: '#a5b4fc',
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(167,139,250,0.5)',
              borderRadius: '4px',
              padding: `0 ${6 * stageScale}px`,
              outline: 'none',
              zIndex: 99999,
              boxSizing: 'border-box',
            }}
            onBlur={(ev) => {
              const newLabel = ev.target.value.trim() || 'Frame';
              const elements = getDrawElements(activeCanvasId);
              pushHistory(elements);
              const updated = elements.map(el =>
                el.id === editingFrameLabelId ? { ...el, frameLabel: newLabel } : el
              );
              saveDrawElements(activeCanvasId, updated);
              setEditingFrameLabelId(null);
            }}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') {
                (ev.target as HTMLInputElement).blur();
              }
              if (ev.key === 'Escape') {
                setEditingFrameLabelId(null);
              }
              ev.stopPropagation();
            }}
            onClick={(ev) => ev.stopPropagation()}
          />
        );
      })()}

      {/* Entity Token Context Menu Overlay */}
      {entityTokenMenu && (() => {
        const element = renderedDrawElements.find((drawElement) => drawElement.id === entityTokenMenu.elementId);
        if (!element || element.type !== 'entityToken') return null;
        const linkedEntity = element.linkedEntityId ? yjsStore.entitiesMap.get(element.linkedEntityId) : undefined;
        const canOpenLinked = canViewCanvasEntity(linkedEntity);
        const canEditRepresentation = canEditCanvasEntityById(activeCanvasId);
        const nextMode: EntityTokenMode = element.entityTokenMode === 'art' ? 'token' : 'art';
        const nextModeLabel = nextMode === 'art' ? 'Показать как карточку' : 'Показать как фишку';

        return (
          <>
            <div
              className="fixed inset-0 z-[99998]"
              onClick={() => setEntityTokenMenu(null)}
              onContextMenu={(e) => { e.preventDefault(); setEntityTokenMenu(null); }}
            />
            <div
              className="fixed z-[99999] min-w-[220px] overflow-hidden rounded-xl border border-white/10 bg-[#151c2b]/70 py-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-100"
              style={{
                left: entityTokenMenu.x + 220 > window.innerWidth ? entityTokenMenu.x - 220 : entityTokenMenu.x,
                top: entityTokenMenu.y + 150 > window.innerHeight ? entityTokenMenu.y - 150 : entityTokenMenu.y,
              }}
            >
              <div className="mb-1 select-none border-b border-white/5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-white/30 pointer-events-none">
                Linked entity
              </div>

              {canOpenLinked && (
                <button
                  type="button"
                  className="group flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    openWindow(linkedEntity.id, entityTokenMenu.x, entityTokenMenu.y);
                    setEntityTokenMenu(null);
                  }}
                >
                  <ExternalLink size={14} className="text-white/40 transition-colors group-hover:text-white/80" />
                  Открыть сущность
                </button>
              )}

              {canEditRepresentation && (
                <>
                  <div className="mx-2 my-1 border-t border-white/5" />
                  <button
                    type="button"
                    className="group flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      void switchEntityTokenMode(element, nextMode);
                      setEntityTokenMenu(null);
                    }}
                  >
                    <ImageIcon size={14} className="text-white/40 transition-colors group-hover:text-white/80" />
                    {nextModeLabel}
                  </button>
                  <button
                    type="button"
                    className="group flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      updateEntityTokenRepresentation(element.id, { showName: element.showName === false });
                      setEntityTokenMenu(null);
                    }}
                  >
                    {element.showName === false ? (
                      <Eye size={14} className="text-white/40 transition-colors group-hover:text-white/80" />
                    ) : (
                      <EyeOff size={14} className="text-white/40 transition-colors group-hover:text-white/80" />
                    )}
                    {element.showName === false ? 'Показать имя' : 'Скрыть имя'}
                  </button>
                  <div className="mx-2 my-1 border-t border-white/5" />
                  <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white/25">
                    Рамка
                  </div>
                  <div className="grid grid-cols-2 gap-1 px-2 pb-1">
                    {ENTITY_TOKEN_FRAME_OPTIONS.map((frame) => {
                      const selected = (element.entityTokenFrame ?? 'ring') === frame.id;
                      return (
                        <button
                          key={frame.id}
                          type="button"
                          className={`rounded-lg border px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                            selected
                              ? 'border-amber-200/35 bg-amber-300/15 text-amber-50'
                              : 'border-white/10 bg-white/[0.03] text-white/45 hover:border-white/20 hover:text-white/80'
                          }`}
                          title={frame.description}
                          onClick={() => {
                            applyEntityTokenFramePreset(element.id, frame.id);
                            setEntityTokenMenu(null);
                          }}
                        >
                          {frame.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </>
        );
      })()}

      {/* Portal Context Menu Overlay */}
      {portalMenu && (() => {
        const canDeletePortal = canEditEntity(portalMenu.portal);
        const targetCanvasId = typeof portalMenu.portal.properties?.targetCanvasId === 'string' ? portalMenu.portal.properties.targetCanvasId : '';
        const targetCanvas = targetCanvasId ? yjsStore.entitiesMap.get(targetCanvasId) : undefined;
        const canOpenTarget = canViewCanvasEntity(targetCanvas);

        return (
        <>
          <div
            className="fixed inset-0 z-[99998]"
            onClick={() => setPortalMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setPortalMenu(null); }}
          />
          <div
            className="fixed rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10 py-1.5 min-w-[200px] overflow-hidden backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-100 bg-[#151c2b]/70 z-[99999]"
            style={{
              left: portalMenu.x + 200 > window.innerWidth ? portalMenu.x - 200 : portalMenu.x,
              top: portalMenu.y + 100 > window.innerHeight ? portalMenu.y - 100 : portalMenu.y,
            }}
          >
            <div className="px-3 py-1.5 text-[9px] font-bold text-white/30 uppercase tracking-widest border-b border-white/5 mb-1 select-none pointer-events-none">
              ПОРТАЛ
            </div>
            {canOpenTarget && (
              <button
                className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 group"
                onClick={() => {
                  openWindow(targetCanvasId, portalMenu.x, portalMenu.y);
                  setPortalMenu(null);
                }}
              >
                <ExternalLink size={14} className="text-white/40 group-hover:text-white/80 transition-colors" />{' '}
                Открыть окно области
              </button>
            )}
            {canDeletePortal && (
              <>
                <div className="border-t border-white/5 my-1 mx-2" />
                <button
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors flex items-center gap-2 group"
                  onClick={() => {
                    const portalToDelete = portalMenu.portal;
                    setPortalMenu(null);
                    openConfirm({
                      title: 'Удаление портала',
                      description: `Вы уверены, что хотите удалить портал «${portalToDelete.name}»?`,
                      confirmText: 'Удалить',
                      isDestructive: true,
                      onConfirm: () => {
                        if (canEditEntity(portalToDelete)) {
                          yjsStore.deleteEntity(portalToDelete.id);
                        }
                      }
                    });
                  }}
                >
                  <Trash2 size={14} className="text-red-500/50 group-hover:text-red-400 transition-colors" />{' '}
                  Удалить портал
                </button>
              </>
            )}
          </div>
        </>
        );
      })()}

      {/* Bottom-left hints: ping + pan + player fog toggle */}
      <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2">
        {/* Ping hint */}
        <div className="pointer-events-none bg-black/30 backdrop-blur-md rounded-lg border border-white/5 px-3 py-1.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white/50 animate-pulse shadow-[0_0_6px_rgba(255,255,255,0.3)]" />
          <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider select-none">
            G + клик = пинг
          </span>
        </div>
        {/* Middle-mouse pan hint */}
        <div className="pointer-events-none bg-black/30 backdrop-blur-md rounded-lg border border-white/5 px-3 py-1.5 flex items-center gap-2">
          <span className="text-[10px] text-white/20 select-none">🖱️</span>
          <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider select-none">
            средняя кнопка = панорама
          </span>
        </div>
        {/* Player fog toggle */}
        {!isGM && (
          <button
            onClick={togglePlayerFog}
            className="pointer-events-auto bg-black/30 backdrop-blur-md rounded-lg border border-white/5 px-2.5 py-1.5 flex items-center gap-1.5 transition-all hover:bg-white/10 cursor-pointer"
            title="Показать/скрыть туман войны"
          >
            <span className={`w-2 h-2 rounded-full transition-colors ${playerFogVisible ? 'bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.5)]' : 'bg-white/20'}`} />
            <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider select-none">
              Туман
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Utility ───

function getCursorForTool(tool: string, fogTool?: string): string {
  if (fogTool === 'revealBrush') return 'cell';
  if (fogTool === 'revealRect') return 'crosshair';
  if (fogTool === 'coverBrush') return 'cell';
  if (fogTool === 'coverRect') return 'crosshair';
  switch (tool) {
    case 'select': return 'default';
    case 'text': return 'text';
    case 'image': return 'copy';
    case 'pen': case 'line': case 'rect': case 'ellipse': case 'frame': case 'lasso': return 'crosshair';
    default: return 'default';
  }
}
