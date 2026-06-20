/**
 * CanvasToolbar.tsx — Unified top-center toolbar
 *
 * Combines navigation (Back, Recenter), drawing tools, and Active Elements.
 * Style panel drops down in compact 2-row layout.
 *
 * Bug fix: Line cap selectors only show for line-type elements, not shapes.
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Redo2, Undo2 } from 'lucide-react';
import { useCanvasDrawStore, type DrawStyleState } from '../../store/canvasDrawStore';
import { useCanvasSyncStore } from '../../store/canvasSyncStore';
import { useCanvasStore } from '../../store/canvasStore';
import { useWindowStore } from '../../store/windowStore';
import { useUIStore } from '../../store/uiStore';
import { useEntitiesByParent, getEntitiesSnapshot } from '../../hooks/useEntities';
import type { CanvasTool, StrokeStyle, LineCap, TextFontFamily, TextAlign, DrawElement, EntityTokenMode } from '../../types/canvasTypes';
import { getElementBounds, reorderElements } from '../../types/canvasTypes';
import { CANVAS_VISUAL_STYLE_OPTIONS } from '../../utils/canvasVisualStyle';
import { CANVAS_LINE_MODE_OPTIONS } from '../../utils/canvasLineRouting';
import { ENTITY_TOKEN_FRAME_OPTIONS } from '../../utils/canvasEntityTokenFrame';
import { getEntityCanvasTokenDefaults, getEntityCanvasTokenImageSource } from '../../utils/entityCanvasDefaults';
import { fitEntityArtSizeToImage } from '../../utils/entityTokenSizing';
import { getAssetUrl } from '../../services/fileApi';
import { yjsStore } from '../../store/yjsStore';
import { glass } from '../../utils/theme';
import type { Entity } from '../../types';
import React from 'react';

interface ToolDef {
  id: CanvasTool;
  labelKey: string;
  shortcut: string;
  icon: React.ReactNode;
}

const tools: ToolDef[] = [
  {
    id: 'select',
    labelKey: 'canvasToolbar.tools.select',
    shortcut: 'V',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        <path d="M13 13l6 6" />
      </svg>
    ),
  },
  {
    id: 'pen',
    labelKey: 'canvasToolbar.tools.pen',
    shortcut: 'P',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.5z" />
        <path d="m15 5 4 4" />
      </svg>
    ),
  },
  {
    id: 'line',
    labelKey: 'canvasToolbar.tools.line',
    shortcut: 'L',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 19L19 5" />
      </svg>
    ),
  },
  {
    id: 'rect',
    labelKey: 'canvasToolbar.tools.rect',
    shortcut: 'R',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <text x="12" y="16" textAnchor="middle" fill="currentColor" stroke="none" fontSize="9" fontWeight="bold" fontFamily="sans-serif">T</text>
      </svg>
    ),
  },
  {
    id: 'ellipse',
    labelKey: 'canvasToolbar.tools.ellipse',
    shortcut: 'O',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
  },
  {
    id: 'image',
    labelKey: 'canvasToolbar.tools.image',
    shortcut: 'I',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    ),
  },
  {
    id: 'frame',
    labelKey: 'canvasToolbar.tools.frame',
    shortcut: 'F',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="14" x="3" y="5" rx="2" />
        <path d="M3 9h18" />
        <path d="M7 5v4" />
      </svg>
    ),
  },
];

const EXTRA_TOOLS: ToolDef[] = [
  {
    id: 'lasso',
    labelKey: 'canvasToolbar.tools.lasso',
    shortcut: '',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 22a5 5 0 0 1-2-4" />
        <path d="M3.3 14A6.8 6.8 0 0 1 2 10c0-4.4 4.5-8 10-8s10 3.6 10 8-4.5 8-10 8a12 12 0 0 1-3.7-.5" />
        <path d="M7 18a7 7 0 0 0 2.5-5" />
      </svg>
    ),
  },
];

// ─── Palettes ───
const PALETTE_COLORS = [
  '#a78bfa', '#f87171', '#fb923c', '#fbbf24', '#34d399',
  '#38bdf8', '#e879f9', '#ffffff', '#94a3b8', '#000000',
];

const FILL_COLORS = [
  '#a78bfa', '#f87171', '#fb923c', '#fbbf24',
  '#34d399', '#38bdf8', '#e879f9', '#94a3b8',
  '#ffffff', '#000000',
];

const STROKE_WIDTHS = [1, 2, 4, 8];

const STROKE_STYLES: { id: StrokeStyle; labelKey: string; preview: string }[] = [
  { id: 'solid', labelKey: 'canvasToolbar.strokeStyles.solid', preview: '———' },
  { id: 'dashed', labelKey: 'canvasToolbar.strokeStyles.dashed', preview: '– – –' },
  { id: 'dotted', labelKey: 'canvasToolbar.strokeStyles.dotted', preview: '• • •' },
];

const LINE_CAPS: { id: LineCap; labelKey: string; icon: React.ReactNode }[] = [
  {
    id: 'none',
    labelKey: 'canvasToolbar.lineCaps.none',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  },
  {
    id: 'arrow',
    labelKey: 'canvasToolbar.lineCaps.arrow',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="15 8 19 12 15 16" /></svg>,
  },
  {
    id: 'circle',
    labelKey: 'canvasToolbar.lineCaps.circle',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="16" y2="12" /><circle cx="19" cy="12" r="3" fill="currentColor" /></svg>,
  },
  {
    id: 'diamond',
    labelKey: 'canvasToolbar.lineCaps.diamond',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="15" y2="12" /><rect x="15" y="8" width="6" height="6" fill="currentColor" transform="rotate(45 18 11)" /></svg>,
  },
];

const TEXT_FONTS: { id: TextFontFamily; label: string }[] = [
  { id: 'sans', label: 'Sans' },
  { id: 'serif', label: 'Serif' },
  { id: 'mono', label: 'Mono' },
  { id: 'handwritten', label: 'Hand' },
];

const TEXT_SIZES = [16, 24, 32, 48, 64];

const TEXT_ALIGNS: { id: TextAlign; icon: React.ReactNode }[] = [
  { id: 'left', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="6" x2="3" y2="6"/><line x1="15" y1="12" x2="3" y2="12"/><line x1="17" y1="18" x2="3" y2="18"/></svg> },
  { id: 'center', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="6" x2="3" y2="6"/><line x1="19" y1="12" x2="5" y2="12"/><line x1="17" y1="18" x2="7" y2="18"/></svg> },
  { id: 'right', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="12" x2="9" y2="12"/><line x1="21" y1="18" x2="7" y2="18"/></svg> },
];

const ALIGN_OPTIONS: { id: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'; titleKey: string; icon: React.ReactNode }[] = [
  { id: 'left', titleKey: 'canvasToolbar.align.left', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="4" x2="4" y2="20"/><rect x="8" y="10" width="12" height="4"/><rect x="8" y="4" width="8" height="4"/></svg> },
  { id: 'center', titleKey: 'canvasToolbar.align.center', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="4" x2="12" y2="20"/><rect x="8" y="10" width="8" height="4"/><rect x="6" y="4" width="12" height="4"/></svg> },
  { id: 'right', titleKey: 'canvasToolbar.align.right', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="20" y1="4" x2="20" y2="20"/><rect x="4" y="10" width="12" height="4"/><rect x="8" y="4" width="8" height="4"/></svg> },
  { id: 'top', titleKey: 'canvasToolbar.align.top', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="4" x2="20" y2="4"/><rect x="10" y="8" width="4" height="12"/><rect x="4" y="8" width="4" height="8"/></svg> },
  { id: 'middle', titleKey: 'canvasToolbar.align.middle', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="12" x2="20" y2="12"/><rect x="10" y="8" width="4" height="8"/><rect x="4" y="6" width="4" height="12"/></svg> },
  { id: 'bottom', titleKey: 'canvasToolbar.align.bottom', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="20" x2="20" y2="20"/><rect x="10" y="4" width="4" height="12"/><rect x="4" y="8" width="4" height="8"/></svg> },
];

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function applyStyleToSelected(
  _activeCanvasId: string,
  selectedIds: string[],
  styleUpdate: Record<string, unknown>
) {
  const { elements, syncElementsArray } = useCanvasSyncStore.getState();
  const selected = new Set(selectedIds);
  const updated = elements.map((element) =>
    selected.has(element.id) ? { ...element, ...styleUpdate } : element
  );
  syncElementsArray(updated);
}

function getSelectedElementType(
  _activeCanvasId: string,
  selectedIds: string[]
): 'line' | 'shape' | 'mixed' | null {
  if (selectedIds.length === 0) return null;
  const elements = useCanvasSyncStore.getState().elements;
  const selected = elements.filter((el: DrawElement) => selectedIds.includes(el.id));
  if (selected.length === 0) return null;

  const hasLine = selected.some((el: DrawElement) => el.type === 'line' || el.type === 'arrow');
  const hasShape = selected.some((el: DrawElement) => el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'frame');

  if (hasLine && !hasShape) return 'line';
  if (hasShape && !hasLine) return 'shape';
  if (hasLine && hasShape) return 'mixed';
  return null;
}

function getEntityOwnerId(entity: Entity): string | undefined {
  const owner = entity.properties?._playerOwner;
  return typeof owner === 'string' ? owner : undefined;
}

function canEditCanvasEntity(canvasId: string | null): boolean {
  if (!canvasId) return false;
  const entity = yjsStore.entitiesMap.get(canvasId);
  if (!entity || entity.type !== 'canvas') return true;
  return yjsStore.canModify(entity.database, getEntityOwnerId(entity));
}

function resolveEntityTokenImageSource(rawImageSource: string): string {
  if (!rawImageSource) return '';
  return rawImageSource.startsWith('http') || rawImageSource.startsWith('data:')
    ? rawImageSource
    : getAssetUrl(rawImageSource);
}

function loadNaturalImageSize(sourceUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    };
    image.onerror = () => reject(new Error('Image failed to load'));
    image.src = sourceUrl;
  });
}

async function getEntityTokenModeSize(element: DrawElement, mode: EntityTokenMode): Promise<{ width: number; height: number }> {
  const linkedEntity = element.linkedEntityId ? getEntitiesSnapshot()[element.linkedEntityId] : undefined;
  if (!linkedEntity) {
    return mode === 'art'
      ? { width: element.width || 220, height: element.height || 150 }
      : { width: 72, height: 92 };
  }

  const defaults = getEntityCanvasTokenDefaults(linkedEntity, mode);
  if (mode !== 'art') {
    return { width: defaults.width, height: defaults.height };
  }

  const imageSource = resolveEntityTokenImageSource(getEntityCanvasTokenImageSource(linkedEntity, 'art'));
  if (!imageSource) {
    return { width: defaults.width, height: defaults.height };
  }

  try {
    const imageSize = await loadNaturalImageSize(imageSource);
    return fitEntityArtSizeToImage(
      { width: defaults.artWidth, height: defaults.artHeight },
      imageSize
    );
  } catch {
    return { width: defaults.width, height: defaults.height };
  }
}

export function CanvasToolbar() {
  const { t } = useTranslation();
  const getToolLabel = useCallback((tool: ToolDef) => t(tool.labelKey), [t]);
  const {
    activeTool,
    setTool,
    currentStyle,
    setStyle,
    selectedElementIds,
    editingTextId,
  } = useCanvasDrawStore();
  const { activeCanvasId, canvasHistory, goBack, setTransform } = useCanvasStore();
  const { windows } = useWindowStore();
  const elements = useCanvasSyncStore(state => state.elements);
  const canUndo = useCanvasSyncStore(state => state.canUndo);
  const canRedo = useCanvasSyncStore(state => state.canRedo);
  const undoCanvas = useCanvasSyncStore(state => state.undo);
  const redoCanvas = useCanvasSyncStore(state => state.redo);

  const [elementsOpen, setElementsOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);

  // ─── Grid settings ───
  const gridEnabled = useCanvasDrawStore((s) => s.gridEnabled);
  const gridType = useCanvasDrawStore((s) => s.gridType);
  const gridSpacing = useCanvasDrawStore((s) => s.gridSpacing);
  const toggleGrid = useCanvasDrawStore((s) => s.toggleGrid);
  const setGridType = useCanvasDrawStore((s) => s.setGridType);
  const setGridSpacing = useCanvasDrawStore((s) => s.setGridSpacing);

  // ─── Fog of War ───
  const fogTool = useCanvasDrawStore((s) => s.fogTool);
  const setFogTool = useCanvasDrawStore((s) => s.setFogTool);
  const fogEditMode = useCanvasDrawStore((s) => s.fogEditMode);
  const setFogEditMode = useCanvasDrawStore((s) => s.setFogEditMode);
  const gmFogVisible = useCanvasDrawStore((s) => s.gmFogVisible);
  const toggleGmFog = useCanvasDrawStore((s) => s.toggleGmFog);
  const clearAllFog = useCanvasSyncStore((s) => s.clearAllFog);
  const revealAll = useCanvasSyncStore((s) => s.revealAll);
  const isGM = yjsStore.localRole === 'gm';
  const { openConfirm } = useUIStore();

  // Active elements data
  const canvasEntities = useEntitiesByParent(activeCanvasId);
  const pinnedWindows = Object.values(windows).filter(w => w.isPinned && w.canvasId === activeCanvasId);
  const portalsOnCurrent = canvasEntities.filter(e => e.type === 'portal');
  const tokensOnCurrent = canvasEntities.filter(e => e.type !== 'portal' && e.type !== 'canvas');
  const drawElementsCount = elements.length;
  const elementCount = pinnedWindows.length + portalsOnCurrent.length + tokensOnCurrent.length + drawElementsCount;

  const centerOn = (x: number, y: number) => {
    const scale = useCanvasStore.getState().scale;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const offsetX = w / 2 - x * scale;
    const offsetY = h / 2 - y * scale;
    useCanvasStore.getState().setTransform(scale, offsetX, offsetY);
    // Also update Konva Stage directly (no render delay)
    window.__vibeSetStageCamera?.(scale, offsetX, offsetY);
    setElementsOpen(false);
  };

  const hasSelection = selectedElementIds.length > 0;
  const canEditActiveCanvas = canEditCanvasEntity(activeCanvasId);
  const visibleTools = canEditActiveCanvas ? tools : tools.filter((tool) => tool.id === 'select');
  const isLineTool = activeTool === 'line' || activeTool === 'pen';
  const isShapeTool = activeTool === 'rect' || activeTool === 'ellipse' || activeTool === 'frame';
  const isTextTool = activeTool === 'text';
  const isDrawTool = isLineTool || isShapeTool || isTextTool;
  const showStylePanel = canEditActiveCanvas && (isDrawTool || (activeTool === 'select' && hasSelection));

  useEffect(() => {
    if (canEditActiveCanvas) return;
    if (activeTool !== 'select') setTool('select');
    if (fogEditMode) setFogEditMode(false);
  }, [activeTool, canEditActiveCanvas, fogEditMode, setFogEditMode, setTool]);

  // Bug fix #1: Only show line caps when a line tool is active OR a line element is selected
  const selectedType = hasSelection ? getSelectedElementType(activeCanvasId, selectedElementIds) : null;
  const isSelectedLine = selectedType === 'line' || selectedType === 'mixed';
  const isSelectedShape = selectedType === 'shape' || selectedType === 'mixed';
  const isSelectedText = hasSelection && elements.some((el: DrawElement) => selectedElementIds.includes(el.id) && el.type === 'text');
  const isSelectedImage = hasSelection && elements.some((el: DrawElement) => selectedElementIds.includes(el.id) && el.type === 'image');
  const selectedEntityTokens = hasSelection
    ? elements.filter((el: DrawElement) => selectedElementIds.includes(el.id) && el.type === 'entityToken')
    : [];
  const isSelectedEntityToken = selectedEntityTokens.length > 0;
  const selectedEntityTokenFrame = selectedEntityTokens[0]?.entityTokenFrame ?? currentStyle.entityTokenFrame ?? 'ring';
  const isSelectedFrame = hasSelection && elements.some((el: DrawElement) => selectedElementIds.includes(el.id) && el.type === 'frame');
  const hasTextDescription = hasSelection && elements.some((el: DrawElement) => selectedElementIds.includes(el.id) && el.description);

  const showLineCaps = isLineTool || (activeTool === 'select' && isSelectedLine);
  const showFillColor = isShapeTool || (activeTool === 'select' && (isSelectedShape || isSelectedFrame));
  const showTextStyles = isTextTool || editingTextId !== null || (activeTool === 'select' && (isSelectedText || hasTextDescription));
  const showStrokeStyles = isLineTool || isShapeTool || (activeTool === 'select' && (isSelectedLine || isSelectedShape || isSelectedFrame || isSelectedImage || isSelectedEntityToken));
  const showStrokeColor = showStrokeStyles;

  // Style change: also apply to selected elements if in select mode
  const handleStyleChange = useCallback(
    (partial: Record<string, unknown>) => {
      setStyle(partial as Partial<DrawStyleState>);
      if (activeTool === 'select' && hasSelection) {
        applyStyleToSelected(activeCanvasId, selectedElementIds, partial);
      }
    },
    [setStyle, activeTool, hasSelection, activeCanvasId, selectedElementIds]
  );

  const handleEntityTokenModeChange = useCallback(
    (mode: EntityTokenMode) => {
      if (activeTool !== 'select' || !hasSelection) return;

      const { elements: currentElements, syncElementsArray } = useCanvasSyncStore.getState();
      const selected = new Set(selectedElementIds);
      const targets = currentElements.filter((element) => selected.has(element.id) && element.type === 'entityToken');
      if (targets.length === 0) return;

      void Promise.all(
        targets.map(async (element) => {
          const size = await getEntityTokenModeSize(element, mode);
          const currentWidth = element.width || size.width;
          const currentHeight = element.height || size.height;
          return {
            ...element,
            entityTokenMode: mode,
            x: (element.x || 0) + (currentWidth - size.width) / 2,
            y: (element.y || 0) + (currentHeight - size.height) / 2,
            width: size.width,
            height: size.height,
          };
        })
      ).then((updatedTargets) => {
        const updates = new Map(updatedTargets.map((element) => [element.id, element]));
        syncElementsArray(currentElements.map((element) => updates.get(element.id) ?? element));
      });
    },
    [activeTool, hasSelection, selectedElementIds]
  );

  const handleAlign = useCallback(
    (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
      if (selectedElementIds.length < 2) return;
      const elements = useCanvasSyncStore.getState().elements;
      const selected = elements.filter((el: DrawElement) => selectedElementIds.includes(el.id));
      if (selected.length < 2) return;

      const bounds = selected.map((el: DrawElement) => {
        let x = el.x || 0; let y = el.y || 0;
        let w = el.width || 0; let h = el.height || 0;
        if (el.type === 'line' || el.type === 'arrow') {
          const pts = el.points || [];
          if (pts.length >= 4) {
            let minX = pts[0], maxX = pts[0], minY = pts[1], maxY = pts[1];
            for (let i = 2; i < pts.length; i += 2) {
              minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]);
              minY = Math.min(minY, pts[i + 1]); maxY = Math.max(maxY, pts[i + 1]);
            }
            x = minX; y = minY; w = maxX - minX; h = maxY - minY;
          }
        } else if (el.type === 'text') {
           w = el.width || 200;
           h = el.height || (el.fontSize || 24) * 1.4;
        }
        return { id: el.id, x, y, w, h, elX: el.x || 0, elY: el.y || 0, type: el.type, points: el.points };
      });

      let targetVal = 0;
      if (alignment === 'left') targetVal = Math.min(...bounds.map((b: { id?: string; x: number; y: number; w: number; h: number }) => b.x));
      if (alignment === 'right') targetVal = Math.max(...bounds.map((b: { id?: string; x: number; y: number; w: number; h: number }) => b.x + b.w));
      if (alignment === 'center') {
         const min = Math.min(...bounds.map((b: { id?: string; x: number; y: number; w: number; h: number }) => b.x));
         const max = Math.max(...bounds.map((b: { id?: string; x: number; y: number; w: number; h: number }) => b.x + b.w));
         targetVal = min + (max - min) / 2;
      }
      if (alignment === 'top') targetVal = Math.min(...bounds.map((b: { id?: string; x: number; y: number; w: number; h: number }) => b.y));
      if (alignment === 'bottom') targetVal = Math.max(...bounds.map((b: { id?: string; x: number; y: number; w: number; h: number }) => b.y + b.h));
      if (alignment === 'middle') {
         const min = Math.min(...bounds.map((b: { id?: string; x: number; y: number; w: number; h: number }) => b.y));
         const max = Math.max(...bounds.map((b: { id?: string; x: number; y: number; w: number; h: number }) => b.y + b.h));
         targetVal = min + (max - min) / 2;
      }

      useCanvasSyncStore.getState().syncElementsArray(elements);

      const updated = elements.map((el: DrawElement) => {
        if (!selectedElementIds.includes(el.id)) return el;
        const b = bounds.find((b: { id?: string; x: number; y: number; w: number; h: number }) => b.id === el.id);
        if (!b) return el;
        let dx = 0, dy = 0;
        if (alignment === 'left') dx = targetVal - b.x;
        if (alignment === 'center') dx = targetVal - (b.x + b.w / 2);
        if (alignment === 'right') dx = targetVal - (b.x + b.w);
        if (alignment === 'top') dy = targetVal - b.y;
        if (alignment === 'middle') dy = targetVal - (b.y + b.h / 2);
        if (alignment === 'bottom') dy = targetVal - (b.y + b.h);

        if (el.type === 'line' || el.type === 'arrow') {
           const pts = [...(el.points || [])];
           for (let i = 0; i < pts.length; i += 2) {
             pts[i] += dx;
             pts[i + 1] += dy;
           }
           return { ...el, points: pts };
        } else {
           return { ...el, x: b.elX + dx, y: b.elY + dy };
        }
      });
      useCanvasSyncStore.getState().syncElementsArray(updated);
    },
    [selectedElementIds]
  );

  const handleZOrder = useCallback(
    (action: 'front' | 'back' | 'forward' | 'backward') => {
      if (selectedElementIds.length === 0) return;
      const elements = useCanvasSyncStore.getState().elements;
      const reordered = reorderElements(elements, selectedElementIds, action);
      useCanvasSyncStore.getState().syncElementsArray(reordered);
    },
    [selectedElementIds]
  );



  const toolbarButtonClass = `flex h-10 w-10 items-center justify-center rounded-[var(--vibe-radius-md)] transition-all ${glass.iconButton}`;
  const toolbarButtonDisabledClass = 'cursor-not-allowed opacity-30 text-[var(--vibe-text-faint)]';
  const toolbarButtonEnabledClass = 'cursor-pointer';
  const toolButtonBaseClass = 'relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--vibe-radius-sm)] border transition-all duration-150';
  const toolButtonActiveClass = glass.tabActive;
  const toolButtonIdleClass = glass.tabIdle;
  const toolbarDividerClass = 'mx-0.5 h-6 w-px bg-[var(--vibe-border-subtle)]';
  const popoverClass = `z-[99] rounded-[var(--vibe-radius-md)] p-2 ${glass.popover}`;
  const toolbarPanelClass = `rounded-[var(--vibe-radius-md)] p-1 ${glass.tabBar}`;
  const menuHeadingClass = 'mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]';
  const menuItemClass = 'cursor-pointer truncate rounded-[var(--vibe-radius-sm)] px-2 py-1.5 text-[var(--vibe-text-muted)] transition-colors hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]';
  const miniActionButtonClass = 'flex items-center justify-center rounded-[var(--vibe-radius-sm)] text-[var(--vibe-text-muted)] transition-all hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]';
  const styleControlTextClass = 'text-[var(--vibe-text-muted)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]';

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center gap-2">
      {/* ─── Main bar ─── */}
      <div className="flex items-center gap-1.5">
        {/* Back Button */}
        <button
          onClick={goBack}
          disabled={canvasHistory.length === 0}
          className={`${toolbarButtonClass}
            ${canvasHistory.length === 0
              ? toolbarButtonDisabledClass
              : toolbarButtonEnabledClass
            }`}
          title={t('common.back')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <button
          onClick={undoCanvas}
          disabled={!canEditActiveCanvas || !canUndo}
          className={`${toolbarButtonClass}
            ${!canEditActiveCanvas || !canUndo
              ? toolbarButtonDisabledClass
              : toolbarButtonEnabledClass
            }`}
          title={t('canvasToolbar.undo')}
        >
          <Undo2 size={18} strokeWidth={2} />
        </button>

        <button
          onClick={redoCanvas}
          disabled={!canEditActiveCanvas || !canRedo}
          className={`${toolbarButtonClass}
            ${!canEditActiveCanvas || !canRedo
              ? toolbarButtonDisabledClass
              : toolbarButtonEnabledClass
            }`}
          title={t('canvasToolbar.redo')}
        >
          <Redo2 size={18} strokeWidth={2} />
        </button>

        <div className={toolbarDividerClass} />

        {/* Drawing Tools */}
        <div className={`${toolbarPanelClass} flex gap-0.5`}>
          {visibleTools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setTool(tool.id)}
              className={`${toolButtonBaseClass}
                ${activeTool === tool.id
                  ? toolButtonActiveClass
                  : toolButtonIdleClass
                }`}
              title={`${getToolLabel(tool)} (${tool.shortcut})`}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        {/* Extra tools overflow */}
        {canEditActiveCanvas && (
        <div className="relative">
          <button
            onClick={() => setExtraOpen(!extraOpen)}
            className={`${toolbarButtonClass} cursor-pointer text-lg ${extraOpen ? glass.iconButtonActive : ''}`}
            title={t('canvasToolbar.moreTools')}
          >
            ⋯
          </button>
          {extraOpen && (
            <>
              <div className="fixed inset-0 z-[98]" onClick={() => setExtraOpen(false)} />
              <div className={`absolute left-0 top-full mt-3 ${popoverClass}`}>
                {EXTRA_TOOLS.map(tool => (
                  <button
                    key={tool.id}
                    onClick={() => {
                      setTool(tool.id as CanvasTool);
                      setExtraOpen(false);
                    }}
                    className={`flex w-full cursor-pointer items-center gap-2.5 rounded-[var(--vibe-radius-sm)] border px-3 py-2 text-sm transition-all
                      ${activeTool === tool.id
                        ? toolButtonActiveClass
                        : toolButtonIdleClass
                      }`}
                    title={tool.shortcut ? `${getToolLabel(tool)} (${tool.shortcut})` : getToolLabel(tool)}
                  >
                    {tool.icon}
                    <span className="whitespace-nowrap">{getToolLabel(tool)}</span>
                    {tool.shortcut && (
                      <span className="ml-auto text-[10px] text-[var(--vibe-text-faint)]">{tool.shortcut}</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        )}

        {/* Grid Toggle + Settings */}
        <div className="relative">
          <button
            onClick={() => setGridOpen(!gridOpen)}
            className={`${toolbarButtonClass} cursor-pointer
              ${gridEnabled
                ? glass.iconButtonActive
                : ''
              }`}
            title={t('canvasToolbar.grid.title', { type: t(gridType === 'square' ? 'canvasToolbar.grid.squareShort' : 'canvasToolbar.grid.hexShort'), spacing: gridSpacing })}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="0.5" />
              <rect x="14" y="3" width="7" height="7" rx="0.5" />
              <rect x="3" y="14" width="7" height="7" rx="0.5" />
              <rect x="14" y="14" width="7" height="7" rx="0.5" />
            </svg>
          </button>
          {gridOpen && (
            <>
              <div className="fixed inset-0 z-[98]" onClick={() => setGridOpen(false)} />
              <div className={`absolute left-0 top-full mt-3 w-56 overflow-hidden ${popoverClass}`}>
                {/* Grid On/Off */}
                <label className="flex items-center justify-between mb-3 cursor-pointer">
                  <span className="text-xs text-[var(--vibe-text-muted)]">{t('canvasToolbar.grid.show')}</span>
                  <button
                    onClick={toggleGrid}
                    className={`relative h-5 w-9 rounded-full transition-colors ${gridEnabled ? 'bg-[var(--vibe-accent)]' : 'bg-[var(--vibe-surface-hover)]'}`}
                  >
                    <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-[var(--vibe-text-primary)] transition-transform ${gridEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </label>

                {/* Grid Type */}
                <div className="mb-3">
                  <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">{t('canvasToolbar.grid.type')}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setGridType('square')}
                      className={`flex-1 cursor-pointer rounded-[var(--vibe-radius-sm)] border px-2 py-1.5 text-xs transition-all ${gridType === 'square' ? toolButtonActiveClass : toolButtonIdleClass}`}
                    >
                      ◻ {t('canvasToolbar.grid.square')}
                    </button>
                    <button
                      onClick={() => setGridType('hex')}
                      className={`flex-1 cursor-pointer rounded-[var(--vibe-radius-sm)] border px-2 py-1.5 text-xs transition-all ${gridType === 'hex' ? toolButtonActiveClass : toolButtonIdleClass}`}
                    >
                      ⬡ {t('canvasToolbar.grid.hex')}
                    </button>
                  </div>
                </div>

                {/* Grid Spacing */}
                <div>
                  <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">{t('canvasToolbar.grid.spacing')}</span>
                  <div className="flex gap-1 flex-wrap">
                    {[25, 50, 75, 100].map((s) => (
                      <button
                        key={s}
                        onClick={() => setGridSpacing(s)}
                        className={`cursor-pointer rounded-[var(--vibe-radius-sm)] border px-3 py-1.5 text-xs transition-all ${gridSpacing === s ? toolButtonActiveClass : toolButtonIdleClass}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Fog of War Button (GM only) — toggles fog edit mode */}
        {isGM && canEditActiveCanvas && (
          <button
            onClick={() => {
              const nextFog = !fogEditMode;
              setFogEditMode(nextFog);
              // Auto-enable GM fog visibility when entering edit mode
              if (nextFog && !gmFogVisible) toggleGmFog();
            }}
            className={`${toolbarButtonClass} cursor-pointer
              ${fogEditMode
                ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)]'
                : gmFogVisible
                  ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-surface-hover)] text-[var(--vibe-accent)]'
                  : ''
              }`}
            title={fogEditMode ? t('canvasToolbar.fog.closeMode') : t('canvasToolbar.fog.title')}
          >
            {fogEditMode ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3c-7 0-10 9-10 9s3 9 10 9 10-9 10-9-3-9-10-9Z" />
                <circle cx="12" cy="12" r="3" />
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
            )}
          </button>
        )}

        <div className={toolbarDividerClass} />

        {/* Active Elements Button */}
        <div className="relative">
          <button
            onClick={() => setElementsOpen(!elementsOpen)}
            className={`${toolbarButtonClass} cursor-pointer ${elementsOpen ? glass.iconButtonActive : ''}`}
            title={`${t('hud.activeElements')} (${elementCount})`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              <line x1="9" y1="3" x2="9" y2="18" />
              <line x1="15" y1="6" x2="15" y2="21" />
            </svg>
            {elementCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[9px] font-bold text-[var(--vibe-text-primary)] backdrop-blur-sm">
                {elementCount}
              </span>
            )}
          </button>

          {/* Active Elements Dropdown */}
          {elementsOpen && (
            <>
              <div className="fixed inset-0 z-[98]" onClick={() => setElementsOpen(false)} />
              <div className={`absolute right-0 top-full mt-3 max-h-[60vh] w-72 overflow-y-auto overflow-x-hidden ${popoverClass}`}>
                {(() => {
                  if (elements.length === 0) return null;

                  const typeIcons: Record<string, string> = {
                    line: '✏️', arrow: '➡️', rectangle: '◻️', ellipse: '⬭',
                    text: '🔤', image: '🖼️', frame: '🔲',
                  };
                  const typeLabels: Record<string, string> = {
                    line: t('canvasToolbar.elementTypes.line'),
                    arrow: t('canvasToolbar.elementTypes.arrow'),
                    rectangle: t('canvasToolbar.elementTypes.rectangle'),
                    ellipse: t('canvasToolbar.elementTypes.ellipse'),
                    text: t('canvasToolbar.elementTypes.text'),
                    image: t('canvasToolbar.elementTypes.image'),
                    frame: t('canvasToolbar.elementTypes.frame'),
                  };

                  return (
                    <>
                      <h4 className={`${menuHeadingClass} flex items-center justify-between`}>
                        <span>{t('canvasToolbar.sections.drawings')}</span>
                        <span className="text-[9px] font-normal text-[var(--vibe-text-faint)]">{elements.length}</span>
                      </h4>
                      {elements.map((el: DrawElement) => {
                        const bounds = getElementBounds(el);
                        const centerX = bounds.x + bounds.w / 2;
                        const centerY = bounds.y + bounds.h / 2;
                        const isSelected = selectedElementIds.includes(el.id);
                        const displayName = el.type === 'frame' ? (el.frameLabel || t('canvasToolbar.elementTypes.frame')) 
                          : el.objectName ? el.objectName 
                          : (typeLabels[el.type] || el.type);
                        return (
                          <div
                            key={el.id}
                            onClick={() => {
                              centerOn(centerX, centerY);
                              useCanvasDrawStore.getState().selectElement(el.id);
                              if (useCanvasDrawStore.getState().activeTool !== 'select') setTool('select');
                            }}
                            className={`flex items-center gap-2 text-xs ${menuItemClass}
                              ${isSelected ? 'bg-[var(--vibe-accent-soft)] text-[var(--vibe-text-primary)]' : ''}`}
                          >
                            <span className="text-sm">{typeIcons[el.type] || '•'}</span>
                            <span>{displayName}</span>
                            {el.type === 'text' && el.text && (
                              <span className="ml-1 max-w-[120px] truncate text-[var(--vibe-text-faint)]">"{el.text.slice(0, 20)}"</span>
                            )}
                            {el.description && (
                              <span className="ml-1 max-w-[80px] truncate text-[10px] text-[var(--vibe-text-faint)]">📝 {el.description.slice(0, 12)}…</span>
                            )}
                          </div>
                        );
                      })}
                      <div className="my-2 border-t border-[var(--vibe-border-subtle)]" />
                    </>
                  );
                })()}

                <h4 className={menuHeadingClass}>{t('hud.pinnedWindows')}</h4>
                {pinnedWindows.length === 0 ? <p className="mb-2 px-2 text-xs italic text-[var(--vibe-text-faint)]">{t('hud.none')}</p> : (
                  pinnedWindows.map(w => {
                    const e = getEntitiesSnapshot()[w.entityId];
                    return (
                      <div key={w.id} onClick={() => centerOn(w.x, w.y)} className={`text-sm ${menuItemClass}`}>
                        📌 {e?.name || t('hud.unknown')}
                      </div>
                    );
                  })
                )}
                <h4 className={`${menuHeadingClass} mt-3`}>{t('canvasToolbar.sections.tokensEntities')}</h4>
                {tokensOnCurrent.length === 0 ? <p className="px-2 text-xs italic text-[var(--vibe-text-faint)]">{t('hud.none')}</p> : (
                  tokensOnCurrent.map(tok => (
                    <div key={tok.id} onClick={() => centerOn(tok.properties.x || 0, tok.properties.y || 0)} className={`text-sm text-[var(--vibe-accent)] ${menuItemClass}`}>
                      ♟ {tok.name}
                    </div>
                  ))
                )}
                <h4 className={`${menuHeadingClass} mt-3`}>{t('hud.portalsHere')}</h4>
                {portalsOnCurrent.length === 0 ? <p className="px-2 text-xs italic text-[var(--vibe-text-faint)]">{t('hud.none')}</p> : (
                  portalsOnCurrent.map(p => (
                    <div key={p.id} onClick={() => centerOn(p.properties.x || 0, p.properties.y || 0)} className={`text-sm ${menuItemClass}`}>
                      🌀 {p.name}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Recenter Button */}
        <button
          onClick={() => {
            const scale = 1;
            const w = window.innerWidth;
            const h = window.innerHeight;
            const offsetX = w / 2;
            const offsetY = h / 2;
            setTransform(scale, offsetX, offsetY);
            // Also update Konva Stage directly
            window.__vibeSetStageCamera?.(scale, offsetX, offsetY);
          }}
          className={`${toolbarButtonClass} cursor-pointer`}
          title={t('canvasToolbar.recenter')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </button>
      </div>

      {/* ─── Fog Tools Panel (GM only, shown when fog edit mode is active) ─── */}
      {fogEditMode && isGM && canEditActiveCanvas && (
        <div className={`${toolbarPanelClass} flex items-center gap-1.5 border-[var(--vibe-border-strong)]`}>
          {/* Reveal Brush */}
          <button
            onClick={() => setFogTool('revealBrush')}
            className={`relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--vibe-radius-sm)] transition-all duration-150
              ${fogTool === 'revealBrush'
                ? 'bg-[color-mix(in_srgb,var(--vibe-success)_24%,transparent)] text-[var(--vibe-success)] shadow-sm'
                : styleControlTextClass
              }`}
            title={t('canvasToolbar.fog.revealBrush')}
          >
            <span className="text-base">🖌️</span>
          </button>

          {/* Reveal Rect */}
          <button
            onClick={() => setFogTool('revealRect')}
            className={`relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--vibe-radius-sm)] transition-all duration-150
              ${fogTool === 'revealRect'
                ? 'bg-[color-mix(in_srgb,var(--vibe-success)_24%,transparent)] text-[var(--vibe-success)] shadow-sm'
                : styleControlTextClass
              }`}
            title={t('canvasToolbar.fog.revealRect')}
          >
            <span className="text-base">◻️</span>
          </button>

          <div className="h-4 w-px bg-[var(--vibe-border-subtle)]" />

          {/* Cover Brush */}
          <button
            onClick={() => setFogTool('coverBrush')}
            className={`relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--vibe-radius-sm)] transition-all duration-150
              ${fogTool === 'coverBrush'
                ? 'bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)] shadow-sm'
                : styleControlTextClass
              }`}
            title={t('canvasToolbar.fog.coverBrush')}
          >
            <span className="text-base">🖌️</span>
          </button>

          {/* Cover Rect */}
          <button
            onClick={() => setFogTool('coverRect')}
            className={`relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--vibe-radius-sm)] transition-all duration-150
              ${fogTool === 'coverRect'
                ? 'bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)] shadow-sm'
                : styleControlTextClass
              }`}
            title={t('canvasToolbar.fog.coverRect')}
          >
            <span className="text-base">◻️</span>
          </button>

          <div className="h-6 w-px bg-[var(--vibe-border-subtle)]" />

          {/* Cover All */}
          <button
            onClick={() => clearAllFog()}
            className={`h-9 w-9 cursor-pointer ${miniActionButtonClass}`}
            title={t('canvasToolbar.fog.coverAll')}
          >
            <span className="text-sm">⬛</span>
          </button>

          {/* Reveal All (Clear All Fog) */}
          <button
            onClick={() => {
              openConfirm({
                title: t('canvasToolbar.fog.clearTitle'),
                description: t('canvasToolbar.fog.clearDescription'),
                confirmText: t('canvasToolbar.fog.clearConfirm'),
                isDestructive: true,
                onConfirm: () => revealAll(),
              });
            }}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--vibe-radius-sm)] text-[var(--vibe-warning)] transition-all hover:bg-[color-mix(in_srgb,var(--vibe-warning)_14%,transparent)]"
            title={t('canvasToolbar.fog.clearTitle')}
          >
            <span className="text-sm">🔓</span>
          </button>

          <div className="h-6 w-px bg-[var(--vibe-border-subtle)]" />

          {/* GM visibility toggle */}
          <button
            onClick={toggleGmFog}
            className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--vibe-radius-sm)] transition-all
              ${gmFogVisible ? 'bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)]' : styleControlTextClass}`}
            title={gmFogVisible ? t('canvasToolbar.fog.hideGmFog') : t('canvasToolbar.fog.showGmFog')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3c-7 0-10 9-10 9s3 9 10 9 10-9 10-9-3-9-10-9Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      )}

      {/* Current fog tool label */}
      {fogEditMode && isGM && canEditActiveCanvas && (
        <div className="select-none rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-window)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)] backdrop-blur-[var(--vibe-backdrop-blur)]">
          {fogTool === 'revealBrush' ? `🟢 ${t('canvasToolbar.fog.revealBrush')}` :
           fogTool === 'revealRect' ? `🟢 ${t('canvasToolbar.fog.revealRect')}` :
           fogTool === 'coverBrush' ? `🟣 ${t('canvasToolbar.fog.coverBrush')}` :
           fogTool === 'coverRect' ? `🟣 ${t('canvasToolbar.fog.coverRect')}` :
           t('canvasToolbar.fog.chooseTool')}
        </div>
      )}

      {/* ─── Style Panel ─── */}
      {showStylePanel && (
        <div className={`rounded-[var(--vibe-radius-md)] px-4 py-3 ${glass.popover}`}>
          
          <div className="flex items-start gap-5">
            
            {/* COLUMN 1: Colors & Opacity */}
            <div className="flex flex-col gap-3">
              {/* Stroke Color */}
              {showStrokeColor && (
                <div>
                  <span className="text-[8px] text-white/25 uppercase font-bold tracking-widest select-none block mb-1.5">{t('canvasToolbar.style.stroke')}</span>
                  <div className="grid grid-cols-5 gap-1.5 w-max">
                    {PALETTE_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => handleStyleChange({ stroke: color })}
                        className={`w-4 h-4 rounded transition-all duration-100 border cursor-pointer
                          ${currentStyle.stroke === color
                            ? 'border-white scale-125 shadow-lg'
                            : 'border-transparent hover:border-white/30 hover:scale-110'
                          }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Fill Color */}
              {showFillColor && (
                <div>
                  <span className="text-[8px] text-white/25 uppercase font-bold tracking-widest select-none block mb-1.5">{t('canvasToolbar.style.fill')}</span>
                  <div className="grid grid-cols-5 gap-1.5 w-max">
                    {FILL_COLORS.map((color) => (
                      <button
                        key={`fill-${color}`}
                        onClick={() => handleStyleChange({ fill: color })}
                        className={`w-4 h-4 rounded transition-all duration-100 border cursor-pointer
                          ${currentStyle.fill === color
                            ? 'border-white scale-125 shadow-lg'
                            : 'border-transparent hover:border-white/30 hover:scale-110'
                          }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Opacity controls */}
              <div className="mt-1 flex flex-col gap-1">
                {/* Stroke Opacity */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[7px] text-white/20 uppercase font-bold tracking-wide select-none w-6">{t('canvasToolbar.style.strokeShort')}</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={currentStyle.strokeOpacity}
                    onChange={(e) => handleStyleChange({ strokeOpacity: parseFloat(e.target.value) })}
                    className="w-14 h-1 bg-white/10 rounded-full appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
                      [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md
                      [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-0"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={clampPercent(currentStyle.strokeOpacity * 100)}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => handleStyleChange({ strokeOpacity: clampPercent(Number(e.target.value)) / 100 })}
                    className="h-5 w-10 rounded border border-white/10 bg-white/[0.04] px-1 text-right text-[9px] font-bold text-white/45 outline-none transition-colors focus:border-white/35 focus:text-white"
                    title={t('canvasToolbar.style.strokeOpacityTitle')}
                    aria-label={t('canvasToolbar.style.strokeOpacityAria')}
                  />
                </div>
                {/* Fill Opacity (only for shapes) */}
                {(showFillColor) && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[7px] text-white/20 uppercase font-bold tracking-wide select-none w-6">{t('canvasToolbar.style.fillShort')}</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={currentStyle.fillOpacity}
                      onChange={(e) => handleStyleChange({ fillOpacity: parseFloat(e.target.value) })}
                      className="w-14 h-1 bg-white/10 rounded-full appearance-none cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
                        [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md
                        [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-0"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={clampPercent(currentStyle.fillOpacity * 100)}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => handleStyleChange({ fillOpacity: clampPercent(Number(e.target.value)) / 100 })}
                      className="h-5 w-10 rounded border border-white/10 bg-white/[0.04] px-1 text-right text-[9px] font-bold text-white/45 outline-none transition-colors focus:border-white/35 focus:text-white"
                      title={t('canvasToolbar.style.fillOpacityTitle')}
                      aria-label={t('canvasToolbar.style.fillOpacityAria')}
                    />
                  </div>
                )}
                {/* Text Opacity (only for text/shapes with text) */}
                {showTextStyles && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[7px] text-white/20 uppercase font-bold tracking-wide select-none w-6">{t('canvasToolbar.style.textShort')}</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={currentStyle.textOpacity}
                      onChange={(e) => handleStyleChange({ textOpacity: parseFloat(e.target.value) })}
                      className="w-14 h-1 bg-white/10 rounded-full appearance-none cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
                        [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md
                        [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-0"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={clampPercent(currentStyle.textOpacity * 100)}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => handleStyleChange({ textOpacity: clampPercent(Number(e.target.value)) / 100 })}
                      className="h-5 w-10 rounded border border-white/10 bg-white/[0.04] px-1 text-right text-[9px] font-bold text-white/45 outline-none transition-colors focus:border-white/35 focus:text-white"
                      title={t('canvasToolbar.style.textOpacityTitle')}
                      aria-label={t('canvasToolbar.style.textOpacityAria')}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="w-px self-stretch bg-white/10" />

            {/* COLUMN 2: Typography (if text) */}
            {showTextStyles && (
              <>
                <div className="flex flex-col gap-3">
                  <div>
                    <span className="text-[8px] text-white/25 uppercase font-bold tracking-widest select-none block mb-1.5">{t('canvasToolbar.style.font')}</span>
                    <div className="flex gap-1">
                      {TEXT_FONTS.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => handleStyleChange({ fontFamily: f.id })}
                          className={`h-6 px-2 rounded flex flex-col items-center justify-center transition-all cursor-pointer
                            ${currentStyle.fontFamily === f.id
                              ? 'bg-white/20 text-white shadow-sm'
                              : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                            }`}
                          title={f.label}
                        >
                          <span className={`text-[11px] ${f.id === 'sans' ? 'font-sans' : f.id === 'serif' ? 'font-serif' : f.id === 'mono' ? 'font-mono' : 'font-caveat'}`}>{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <span className="text-[8px] text-white/25 uppercase font-bold tracking-widest select-none block mb-1.5">{t('canvasToolbar.style.size')}</span>
                      <div className="flex gap-1">
                        {TEXT_SIZES.map((s) => (
                          <button
                            key={s}
                            onClick={() => handleStyleChange({ fontSize: s })}
                            className={`w-6 h-6 rounded flex items-center justify-center transition-all font-bold cursor-pointer text-[10px]
                              ${currentStyle.fontSize === s
                                ? 'bg-white/20 text-white shadow-sm'
                                : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                              }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[8px] text-white/25 uppercase font-bold tracking-widest select-none block mb-1.5">{t('canvasToolbar.style.alignment')}</span>
                      <div className="flex gap-1">
                        {TEXT_ALIGNS.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => handleStyleChange({ textAlign: a.id })}
                            className={`w-6 h-6 rounded flex items-center justify-center transition-all cursor-pointer
                              ${currentStyle.textAlign === a.id
                                ? 'bg-white/20 text-white shadow-sm'
                                : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                              }`}
                          >
                            {a.icon}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="text-[8px] text-white/25 uppercase font-bold tracking-widest select-none block mb-1.5 mt-1">{t('canvasToolbar.style.textColor')}</span>
                    <div className="grid grid-cols-5 gap-1.5 w-max">
                      {PALETTE_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => handleStyleChange({ textColor: color })}
                          className={`w-4 h-4 rounded transition-all duration-100 border cursor-pointer
                            ${currentStyle.textColor === color
                              ? 'scale-125 border-white shadow-md z-10'
                              : 'scale-100 border-black/20 hover:scale-110 hover:shadow-sm z-0'
                            }`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="w-px self-stretch bg-white/10" />
              </>
            )}

            {/* COLUMN 3: Stroke Width & Style */}
            {showStrokeStyles && (
              <div className="flex flex-col gap-3">
                <div>
                  <span className="text-[8px] text-white/25 uppercase font-bold tracking-widest select-none block mb-1.5">{t('canvasToolbar.style.width')}</span>
                  <div className="flex gap-1">
                    {STROKE_WIDTHS.map((w) => (
                      <button
                        key={w}
                        onClick={() => handleStyleChange({ strokeWidth: w })}
                        className={`w-6 h-6 rounded flex items-center justify-center transition-all text-[10px] font-bold cursor-pointer
                          ${currentStyle.strokeWidth === w
                            ? 'bg-white/20 text-white shadow-sm'
                            : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                          }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[8px] text-white/25 uppercase font-bold tracking-widest select-none block mb-1.5">{t('canvasToolbar.style.strokeStyle')}</span>
                  <div className="flex gap-1">
                    {STROKE_STYLES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleStyleChange({ strokeStyle: s.id })}
                        className={`h-6 px-1.5 rounded flex items-center transition-all text-[10px] cursor-pointer
                          ${currentStyle.strokeStyle === s.id
                            ? 'bg-white/20 text-white shadow-sm'
                            : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                          }`}
                        title={t(s.labelKey)}
                      >
                        <span className="font-mono tracking-wider text-[9px]">{s.preview}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[8px] text-white/25 uppercase font-bold tracking-widest select-none block mb-1.5">{t('canvasToolbar.style.visual')}</span>
                  <div className="flex gap-1 rounded-lg bg-white/[0.03] p-0.5">
                    {CANVAS_VISUAL_STYLE_OPTIONS.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => handleStyleChange({ visualStyle: style.id })}
                        className={`h-6 px-2 rounded-md flex items-center transition-all text-[10px] cursor-pointer
                          ${currentStyle.visualStyle === style.id
                            ? 'bg-white/20 text-white shadow-sm'
                            : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                          }`}
                        title={t(`canvasToolbar.visualStyleDescriptions.${style.id}`)}
                      >
                        {t(`canvasToolbar.visualStyles.${style.id}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* COLUMN 4: Line Caps (Stacked Vertically) */}
            {showLineCaps && (
              <>
                <div className="w-px self-stretch bg-white/10" />
                <div className="flex flex-col gap-3 justify-center h-full pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-white/25 uppercase font-bold w-12 select-none tracking-widest text-right">{t('canvasToolbar.style.line')}</span>
                    <div className="flex gap-1 rounded-lg bg-white/[0.03] p-0.5">
                      {CANVAS_LINE_MODE_OPTIONS.map((mode) => (
                        <button
                          key={mode.id}
                          onClick={() => handleStyleChange({ lineMode: mode.id })}
                          className={`h-6 px-2 rounded-md flex items-center transition-all text-[10px] cursor-pointer
                            ${currentStyle.lineMode === mode.id
                              ? 'bg-white/20 text-white shadow-sm'
                              : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                            }`}
                          title={t(`canvasToolbar.lineModeDescriptions.${mode.id}`)}
                        >
                          {t(`canvasToolbar.lineModes.${mode.id}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Start cap */}
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-white/25 uppercase font-bold w-12 select-none tracking-widest text-right">{t('canvasToolbar.style.start')}</span>
                    <div className="flex gap-0.5">
                      {LINE_CAPS.map((cap) => (
                        <button
                          key={`start-${cap.id}`}
                          onClick={() => handleStyleChange({ startCap: cap.id })}
                          className={`w-6 h-6 rounded flex items-center justify-center transition-all cursor-pointer
                            ${currentStyle.startCap === cap.id
                              ? 'bg-white/20 text-white shadow-sm'
                              : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                            }`}
                          title={t(cap.labelKey)}
                        >
                          {cap.icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* End cap */}
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-white/25 uppercase font-bold w-12 select-none tracking-widest text-right">{t('canvasToolbar.style.end')}</span>
                    <div className="flex gap-0.5">
                      {LINE_CAPS.map((cap) => (
                        <button
                          key={`end-${cap.id}`}
                          onClick={() => handleStyleChange({ endCap: cap.id })}
                          className={`w-6 h-6 rounded flex items-center justify-center transition-all cursor-pointer
                            ${currentStyle.endCap === cap.id
                              ? 'bg-white/20 text-white shadow-sm'
                              : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                            }`}
                          title={t(cap.labelKey)}
                        >
                          {cap.icon}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              </>
            )}

            {isSelectedEntityToken && (
              <>
                <div className="w-px self-stretch bg-white/10" />
                <div className="flex flex-col gap-2 justify-center h-full pt-1">
                  <span className="text-[8px] text-white/25 uppercase font-bold tracking-widest select-none block">{t('canvasToolbar.style.entity')}</span>
                  <div className="flex gap-1 rounded-lg bg-white/[0.03] p-0.5">
                    {ENTITY_TOKEN_FRAME_OPTIONS.map((frame) => (
                      <button
                        key={frame.id}
                        onClick={() => handleStyleChange({ entityTokenFrame: frame.id })}
                        className={`h-6 px-2 rounded-md flex items-center transition-all text-[10px] cursor-pointer
                          ${selectedEntityTokenFrame === frame.id
                            ? 'bg-white/20 text-white shadow-sm'
                            : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                          }`}
                        title={t(`canvasToolbar.tokenFrameDescriptions.${frame.id}`)}
                      >
                        {t(`canvasToolbar.tokenFrames.${frame.id}`)}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1 rounded-lg bg-white/[0.03] p-0.5">
                    <button
                      onClick={() => handleEntityTokenModeChange('token')}
                      className={`h-6 px-2 rounded-md flex items-center transition-all text-[10px] cursor-pointer
                        ${elements.some((el: DrawElement) => selectedElementIds.includes(el.id) && el.type === 'entityToken' && (el.entityTokenMode || 'token') === 'token')
                          ? 'bg-white/20 text-white shadow-sm'
                          : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                        }`}
                      title={t('canvasToolbar.entityToken.tokenTitle')}
                    >
                      {t('canvasToolbar.entityToken.token')}
                    </button>
                    <button
                      onClick={() => handleEntityTokenModeChange('art')}
                      className={`h-6 px-2 rounded-md flex items-center transition-all text-[10px] cursor-pointer
                        ${elements.some((el: DrawElement) => selectedElementIds.includes(el.id) && el.type === 'entityToken' && el.entityTokenMode === 'art')
                          ? 'bg-white/20 text-white shadow-sm'
                          : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                        }`}
                      title={t('canvasToolbar.entityToken.cardTitle')}
                    >
                      {t('canvasToolbar.entityToken.card')}
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>

          {/* Alignment options (Bottom Row separate if multiples selected) */}
          {activeTool === 'select' && selectedElementIds.length > 1 && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5 justify-center">
              <span className="text-[8px] text-white/25 uppercase font-bold mr-1.5 select-none tracking-widest">{t('canvasToolbar.style.alignment')}:</span>
              <div className="flex items-center gap-1">
                {ALIGN_OPTIONS.map((align) => (
                  <button
                    key={align.id}
                    onClick={() => handleAlign(align.id)}
                    className="w-7 h-7 rounded flex items-center justify-center transition-all cursor-pointer text-white/50 hover:bg-white/10 hover:text-white"
                    title={t(align.titleKey)}
                  >
                    {align.icon}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Z-order / Layer controls */}
          {activeTool === 'select' && hasSelection && (() => {
            // Get info about selected element for name display
            const firstSelected = selectedElementIds.length === 1 
              ? elements.find((el: DrawElement) => el.id === selectedElementIds[0]) 
              : null;
            const hasName = firstSelected?.objectName || firstSelected?.frameLabel;
            const isNameable = firstSelected && (
              firstSelected.type === 'rectangle' ||
              firstSelected.type === 'ellipse' ||
              firstSelected.type === 'line' ||
              firstSelected.type === 'arrow' ||
              firstSelected.type === 'entityToken'
            );
            const hasDescription = firstSelected?.description;

            return (
              <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-white/5">
                {/* Layer controls row */}
                <div className="flex items-center gap-3 justify-center">
                  <span className="text-[8px] text-white/25 uppercase font-bold mr-1.5 select-none tracking-widest">{t('canvasToolbar.layers.title')}:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleZOrder('back')}
                      className="w-7 h-7 rounded flex items-center justify-center transition-all cursor-pointer text-white/50 hover:bg-white/10 hover:text-white"
                      title={t('canvasToolbar.layers.toBack')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="17 18 12 23 7 18" />
                        <polyline points="17 6 12 11 7 6" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleZOrder('backward')}
                      className="w-7 h-7 rounded flex items-center justify-center transition-all cursor-pointer text-white/50 hover:bg-white/10 hover:text-white"
                      title={t('canvasToolbar.layers.backward')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="17 13 12 18 7 13" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleZOrder('forward')}
                      className="w-7 h-7 rounded flex items-center justify-center transition-all cursor-pointer text-white/50 hover:bg-white/10 hover:text-white"
                      title={t('canvasToolbar.layers.forward')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="17 11 12 6 7 11" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleZOrder('front')}
                      className="w-7 h-7 rounded flex items-center justify-center transition-all cursor-pointer text-white/50 hover:bg-white/10 hover:text-white"
                      title={t('canvasToolbar.layers.toFront')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="17 18 12 13 7 18" />
                        <polyline points="17 6 12 1 7 6" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Element info row (single selection only) */}
                {firstSelected && selectedElementIds.length === 1 && (
                  <div className="flex items-center gap-2 justify-center">
                    {/* Name display */}
                    {hasName && (
                      <span className="text-[9px] text-white/40 truncate max-w-[120px]" title={firstSelected.objectName || firstSelected.frameLabel}>
                        «{firstSelected.objectName || firstSelected.frameLabel}»
                      </span>
                    )}
                    {/* Toggle name visibility for shapes/lines */}
                    {isNameable && firstSelected.objectName && (
                      <button
                        onClick={() => {
                          const newShowName = !firstSelected.showName;
                          applyStyleToSelected(activeCanvasId, selectedElementIds, { showName: newShowName });
                        }}
                        className={`w-6 h-6 rounded flex items-center justify-center transition-all cursor-pointer text-[10px] 
                          ${firstSelected.showName !== false ? 'bg-white/15 text-white' : 'text-white/30 hover:bg-white/10'}`}
                        title={firstSelected.showName !== false ? t('canvasToolbar.entityToken.hideName') : t('canvasToolbar.entityToken.showName')}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          {firstSelected.showName !== false ? (
                            <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                          ) : (
                            <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                          )}
                        </svg>
                      </button>
                    )}
                    {/* Info hints */}
                    {isNameable && !firstSelected.objectName && (
                      <span className="text-[8px] text-white/20 italic select-none">{t('canvasToolbar.entityToken.nameHint')}</span>
                    )}
                    {hasDescription && (
                      <span className="text-[8px] text-white/20 italic select-none truncate max-w-[80px]">📝 {firstSelected.description?.slice(0, 15)}…</span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      )}
    </div>
  );
}
