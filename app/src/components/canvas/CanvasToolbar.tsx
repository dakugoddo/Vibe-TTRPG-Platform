/**
 * CanvasToolbar.tsx — Unified top-center toolbar
 *
 * Combines navigation (Back, Recenter), drawing tools, and Active Elements.
 * Style panel drops down in compact 2-row layout.
 *
 * Bug fix: Line cap selectors only show for line-type elements, not shapes.
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useCanvasDrawStore, type DrawStyleState } from '../../store/canvasDrawStore';
import { useCanvasSyncStore } from '../../store/canvasSyncStore';
import { useCanvasStore } from '../../store/canvasStore';
import { useWindowStore } from '../../store/windowStore';
import { useEntitiesByParent, getEntitiesSnapshot } from '../../hooks/useEntities';
import type { CanvasTool, StrokeStyle, LineCap, TextFontFamily, TextAlign, DrawElement } from '../../types/canvasTypes';
import { getElementBounds, reorderElements } from '../../types/canvasTypes';
import { yjsStore } from '../../store/yjsStore';
import React from 'react';

interface ToolDef {
  id: CanvasTool;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
}

const tools: ToolDef[] = [
  {
    id: 'select',
    label: 'Выбор',
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
    label: 'Перо',
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
    label: 'Линия',
    shortcut: 'L',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 19L19 5" />
      </svg>
    ),
  },
  {
    id: 'rect',
    label: 'Прямоугольник (2×клик → текст)',
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
    label: 'Эллипс',
    shortcut: 'O',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
  },
  {
    id: 'image',
    label: 'Изображение',
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
    label: 'Фрейм',
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
    label: 'Лассо',
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
  '', // no fill
  // Semi-transparent fills (most common for shapes)
  '#a78bfa33', '#f8717133', '#fb923c33', '#fbbf2433',
  '#34d39933', '#38bdf833', '#e879f933', '#ffffff22',
  // Solid fills (for when you want full coverage)
  '#a78bfa', '#f87171', '#fb923c', '#fbbf24',
  '#34d399', '#38bdf8', '#e879f9', '#94a3b8',
];

const STROKE_WIDTHS = [1, 2, 4, 8];

const STROKE_STYLES: { id: StrokeStyle; label: string; preview: string }[] = [
  { id: 'solid', label: 'Сплошная', preview: '———' },
  { id: 'dashed', label: 'Пунктир', preview: '– – –' },
  { id: 'dotted', label: 'Точки', preview: '• • •' },
];

const LINE_CAPS: { id: LineCap; label: string; icon: React.ReactNode }[] = [
  {
    id: 'none',
    label: 'Нет',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  },
  {
    id: 'arrow',
    label: 'Стрелка',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="15 8 19 12 15 16" /></svg>,
  },
  {
    id: 'circle',
    label: 'Круг',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="16" y2="12" /><circle cx="19" cy="12" r="3" fill="currentColor" /></svg>,
  },
  {
    id: 'diamond',
    label: 'Ромб',
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

const ALIGN_OPTIONS: { id: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'; title: string; icon: React.ReactNode }[] = [
  { id: 'left', title: 'По левому краю', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="4" x2="4" y2="20"/><rect x="8" y="10" width="12" height="4"/><rect x="8" y="4" width="8" height="4"/></svg> },
  { id: 'center', title: 'По горизонтали', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="4" x2="12" y2="20"/><rect x="8" y="10" width="8" height="4"/><rect x="6" y="4" width="12" height="4"/></svg> },
  { id: 'right', title: 'По правому краю', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="20" y1="4" x2="20" y2="20"/><rect x="4" y="10" width="12" height="4"/><rect x="8" y="4" width="8" height="4"/></svg> },
  { id: 'top', title: 'По верхнему краю', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="4" x2="20" y2="4"/><rect x="10" y="8" width="4" height="12"/><rect x="4" y="8" width="4" height="8"/></svg> },
  { id: 'middle', title: 'По вертикали', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="12" x2="20" y2="12"/><rect x="10" y="8" width="4" height="8"/><rect x="4" y="6" width="4" height="12"/></svg> },
  { id: 'bottom', title: 'По нижнему краю', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="20" x2="20" y2="20"/><rect x="10" y="4" width="4" height="12"/><rect x="4" y="8" width="4" height="8"/></svg> },
];

function applyStyleToSelected(
  _activeCanvasId: string,
  selectedIds: string[],
  styleUpdate: Record<string, unknown>
) {
  const elementsMap = useCanvasSyncStore.getState().elementsMap;
  if (!elementsMap || !elementsMap.doc) return;
  
  elementsMap.doc.transact(() => {
    for (const id of selectedIds) {
      const existing = elementsMap.get(id);
      if (existing) {
        elementsMap.set(id, { ...existing, ...styleUpdate });
      }
    }
  });
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


export function CanvasToolbar() {
  const { t } = useTranslation();
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
    (window as any).__vibeSetStageCamera?.(scale, offsetX, offsetY);
    setElementsOpen(false);
  };

  const hasSelection = selectedElementIds.length > 0;
  const isLineTool = activeTool === 'line' || activeTool === 'pen';
  const isShapeTool = activeTool === 'rect' || activeTool === 'ellipse' || activeTool === 'frame';
  const isTextTool = activeTool === 'text';
  const isDrawTool = isLineTool || isShapeTool || isTextTool;
  const showStylePanel = isDrawTool || (activeTool === 'select' && hasSelection);

  // Bug fix #1: Only show line caps when a line tool is active OR a line element is selected
  const selectedType = hasSelection ? getSelectedElementType(activeCanvasId, selectedElementIds) : null;
  const isSelectedLine = selectedType === 'line' || selectedType === 'mixed';
  const isSelectedShape = selectedType === 'shape' || selectedType === 'mixed';
  const isSelectedText = hasSelection && elements.some((el: DrawElement) => selectedElementIds.includes(el.id) && el.type === 'text');
  const isSelectedImage = hasSelection && elements.some((el: DrawElement) => selectedElementIds.includes(el.id) && el.type === 'image');
  const isSelectedFrame = hasSelection && elements.some((el: DrawElement) => selectedElementIds.includes(el.id) && el.type === 'frame');
  const hasTextDescription = hasSelection && elements.some((el: DrawElement) => selectedElementIds.includes(el.id) && el.description);

  const showLineCaps = isLineTool || (activeTool === 'select' && isSelectedLine);
  const showFillColor = isShapeTool || (activeTool === 'select' && (isSelectedShape || isSelectedFrame));
  const showTextStyles = isTextTool || editingTextId !== null || (activeTool === 'select' && (isSelectedText || hasTextDescription));
  const showStrokeStyles = isLineTool || isShapeTool || (activeTool === 'select' && (isSelectedLine || isSelectedShape || isSelectedFrame || isSelectedImage));
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

  // ─── Fog Edit Mode Toolbar ───
  if (fogEditMode && isGM) {
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center gap-2">
        {/* Fog editing toolbar */}
        <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-2xl border border-purple-500/30 rounded-xl shadow-[0_10px_30px_rgba(139,92,246,0.15)] p-1">
          {/* Close fog mode */}
          <button
            onClick={() => setFogEditMode(false)}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer text-red-400 hover:bg-red-500/20 hover:text-red-300"
            title="Закрыть режим тумана"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="w-px h-6 bg-white/10" />

          {/* Reveal Brush */}
          <button
            onClick={() => setFogTool('revealBrush')}
            className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer
              ${fogTool === 'revealBrush'
                ? 'bg-emerald-500/30 text-emerald-300 shadow-md'
                : 'text-white/50 hover:text-white hover:bg-white/10'
              }`}
            title="Просвет: Кисть"
          >
            <span className="text-base">🖌️</span>
          </button>

          {/* Reveal Rect */}
          <button
            onClick={() => setFogTool('revealRect')}
            className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer
              ${fogTool === 'revealRect'
                ? 'bg-emerald-500/30 text-emerald-300 shadow-md'
                : 'text-white/50 hover:text-white hover:bg-white/10'
              }`}
            title="Просвет: Область"
          >
            <span className="text-base">◻️</span>
          </button>

          <div className="w-px h-4 bg-white/10" />

          {/* Cover Brush */}
          <button
            onClick={() => setFogTool('coverBrush')}
            className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer
              ${fogTool === 'coverBrush'
                ? 'bg-purple-500/30 text-purple-300 shadow-md'
                : 'text-white/50 hover:text-white hover:bg-white/10'
              }`}
            title="Скрыть: Кисть"
          >
            <span className="text-base">🖌️</span>
          </button>

          {/* Cover Rect */}
          <button
            onClick={() => setFogTool('coverRect')}
            className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer
              ${fogTool === 'coverRect'
                ? 'bg-purple-500/30 text-purple-300 shadow-md'
                : 'text-white/50 hover:text-white hover:bg-white/10'
              }`}
            title="Скрыть: Область"
          >
            <span className="text-base">◻️</span>
          </button>

          <div className="w-px h-6 bg-white/10" />

          {/* Cover All */}
          <button
            onClick={() => clearAllFog()}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer text-white/50 hover:text-white hover:bg-white/10"
            title="Покрыть всё туманом"
          >
            <span className="text-sm">⬛</span>
          </button>

          {/* Reset All */}
          <button
            onClick={() => revealAll()}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
            title="Сбросить весь туман"
          >
            <span className="text-sm">🔓</span>
          </button>

          <div className="w-px h-6 bg-white/10" />

          {/* GM visibility toggle */}
          <button
            onClick={toggleGmFog}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer
              ${gmFogVisible ? 'text-purple-300 bg-purple-500/20' : 'text-white/30 hover:text-white/60 hover:bg-white/10'}`}
            title={gmFogVisible ? 'Скрыть туман ГМа' : 'Показать туман ГМа'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3c-7 0-10 9-10 9s3 9 10 9 10-9 10-9-3-9-10-9Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>

        {/* Current tool label */}
        <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest bg-black/20 backdrop-blur-md rounded-lg px-3 py-1 border border-white/5 select-none">
          {fogTool === 'revealBrush' ? '🟢 Просвет: Кисть' :
           fogTool === 'revealRect' ? '🟢 Просвет: Область' :
           fogTool === 'coverBrush' ? '🟣 Скрыть: Кисть' :
           fogTool === 'coverRect' ? '🟣 Скрыть: Область' :
           'Выберите инструмент'}
        </div>

        {/* Style panel (if applicable) */}
        {showStylePanel && (
          <div className="bg-black/20 backdrop-blur-2xl border border-white/10 rounded-xl shadow-xl p-1.5 flex items-center gap-1">
            {/* Keep the existing style panel rendering */}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center gap-2">
      {/* ─── Main bar ─── */}
      <div className="flex items-center gap-1.5">
        {/* Back Button */}
        <button
          onClick={goBack}
          disabled={canvasHistory.length === 0}
          className={`bg-black/20 backdrop-blur-2xl border border-white/10 w-10 h-10 rounded-xl flex justify-center items-center shadow-xl transition-all
            ${canvasHistory.length === 0
              ? 'opacity-30 cursor-not-allowed text-white/30'
              : 'text-white/70 hover:text-white hover:border-white/30 hover:bg-white/10 cursor-pointer'
            }`}
          title="Назад"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <div className="w-px h-6 bg-white/10 mx-0.5" />

        {/* Drawing Tools */}
        <div className="bg-black/20 backdrop-blur-2xl border border-white/10 rounded-xl shadow-xl p-1 flex gap-0.5">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setTool(tool.id)}
              className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer
                ${activeTool === tool.id
                  ? 'bg-white/20 text-white shadow-md'
                  : 'text-white/50 hover:text-white hover:bg-white/10'
                }`}
              title={`${tool.label} (${tool.shortcut})`}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        {/* Extra tools overflow */}
        <div className="relative">
          <button
            onClick={() => setExtraOpen(!extraOpen)}
            className={`bg-black/20 backdrop-blur-2xl border border-white/10 w-10 h-10 rounded-xl flex justify-center items-center shadow-xl transition-all text-white/50 hover:text-white hover:border-white/30 hover:bg-white/10 cursor-pointer text-lg
              ${extraOpen ? 'bg-white/10 text-white border-white/20' : ''}`}
            title="Ещё инструменты"
          >
            ⋯
          </button>
          {extraOpen && (
            <>
              <div className="fixed inset-0 z-[98]" onClick={() => setExtraOpen(false)} />
              <div className="absolute top-full left-0 mt-3 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] p-1.5 z-[99]">
                {EXTRA_TOOLS.map(tool => (
                  <button
                    key={tool.id}
                    onClick={() => {
                      setTool(tool.id as CanvasTool);
                      setExtraOpen(false);
                    }}
                    className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-all cursor-pointer
                      ${activeTool === tool.id
                        ? 'bg-white/15 text-white'
                        : 'text-white/60 hover:bg-white/10 hover:text-white'
                      }`}
                    title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
                  >
                    {tool.icon}
                    <span className="whitespace-nowrap">{tool.label}</span>
                    {tool.shortcut && (
                      <span className="text-[10px] text-white/30 ml-auto">{tool.shortcut}</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Grid Toggle + Settings */}
        <div className="relative">
          <button
            onClick={() => setGridOpen(!gridOpen)}
            className={`bg-black/20 backdrop-blur-2xl border w-10 h-10 rounded-xl flex justify-center items-center shadow-xl transition-all cursor-pointer
              ${gridEnabled
                ? 'border-white/20 text-white bg-white/10'
                : 'border-white/10 text-white/50 hover:text-white hover:border-white/30 hover:bg-white/10'
              }`}
            title={`Сетка (${gridType === 'square' ? 'квадраты' : 'гексы'}, ${gridSpacing}px)`}
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
              <div className="absolute top-full left-0 mt-3 w-56 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] overflow-hidden p-3 z-[99]">
                {/* Grid On/Off */}
                <label className="flex items-center justify-between mb-3 cursor-pointer">
                  <span className="text-xs text-white/70">Показать сетку</span>
                  <button
                    onClick={toggleGrid}
                    className={`w-9 h-5 rounded-full transition-colors relative ${gridEnabled ? 'bg-indigo-500' : 'bg-white/15'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${gridEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </label>

                {/* Grid Type */}
                <div className="mb-3">
                  <span className="text-[9px] text-white/30 uppercase font-bold tracking-widest mb-1.5 block">Тип сетки</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setGridType('square')}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${gridType === 'square' ? 'bg-white/15 text-white' : 'text-white/40 hover:bg-white/10 hover:text-white/70'}`}
                    >
                      ◻ Квадраты
                    </button>
                    <button
                      onClick={() => setGridType('hex')}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${gridType === 'hex' ? 'bg-white/15 text-white' : 'text-white/40 hover:bg-white/10 hover:text-white/70'}`}
                    >
                      ⬡ Гексы
                    </button>
                  </div>
                </div>

                {/* Grid Spacing */}
                <div>
                  <span className="text-[9px] text-white/30 uppercase font-bold tracking-widest mb-1.5 block">Шаг сетки (px)</span>
                  <div className="flex gap-1 flex-wrap">
                    {[25, 50, 75, 100].map((s) => (
                      <button
                        key={s}
                        onClick={() => setGridSpacing(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${gridSpacing === s ? 'bg-white/15 text-white' : 'text-white/40 hover:bg-white/10 hover:text-white/70'}`}
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

        {/* Fog of War Button (GM only) — enters fog edit mode */}
        {isGM && (
          <button
            onClick={() => setFogEditMode(true)}
            className={`bg-black/20 backdrop-blur-2xl border w-10 h-10 rounded-xl flex justify-center items-center shadow-xl transition-all cursor-pointer
              ${gmFogVisible
                ? 'border-purple-500/40 text-purple-300 bg-purple-500/10'
                : 'border-white/10 text-white/50 hover:text-white hover:border-white/30 hover:bg-white/10'
              }`}
            title="Туман Войны"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3c-7 0-10 9-10 9s3 9 10 9 10-9 10-9-3-9-10-9Z" />
              <circle cx="12" cy="12" r="3" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          </button>
        )}

        <div className="w-px h-6 bg-white/10 mx-0.5" />

        {/* Active Elements Button */}
        <div className="relative">
          <button
            onClick={() => setElementsOpen(!elementsOpen)}
            className={`bg-black/20 backdrop-blur-2xl border border-white/10 w-10 h-10 rounded-xl flex justify-center items-center shadow-xl transition-all text-white/70 hover:text-white hover:border-white/30 hover:bg-white/10 cursor-pointer
              ${elementsOpen ? 'bg-white/10 text-white border-white/20' : ''}`}
            title={`${t('hud.activeElements')} (${elementCount})`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              <line x1="9" y1="3" x2="9" y2="18" />
              <line x1="15" y1="6" x2="15" y2="21" />
            </svg>
            {elementCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white/20 backdrop-blur-sm text-[9px] text-white font-bold rounded-full flex items-center justify-center border border-white/20">
                {elementCount}
              </span>
            )}
          </button>

          {/* Active Elements Dropdown */}
          {elementsOpen && (
            <>
              <div className="fixed inset-0 z-[98]" onClick={() => setElementsOpen(false)} />
              <div className="absolute top-full right-0 mt-3 w-72 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] overflow-hidden p-2 z-[99] max-h-[60vh] overflow-y-auto">
                {(() => {
                  if (elements.length === 0) return null;

                  const typeIcons: Record<string, string> = {
                    line: '✏️', arrow: '➡️', rectangle: '◻️', ellipse: '⬭',
                    text: '🔤', image: '🖼️', frame: '🔲',
                  };
                  const typeLabels: Record<string, string> = {
                    line: 'Линия', arrow: 'Стрелка', rectangle: 'Прямоугольник',
                    ellipse: 'Эллипс', text: 'Текст', image: 'Изображение', frame: 'Фрейм',
                  };

                  return (
                    <>
                      <h4 className="text-[10px] uppercase font-bold text-white/40 mb-2 px-2 tracking-widest flex items-center justify-between">
                        <span>Рисунки</span>
                        <span className="text-[9px] text-white/20 font-normal">{elements.length}</span>
                      </h4>
                      {elements.map((el: DrawElement) => {
                        const bounds = getElementBounds(el);
                        const centerX = bounds.x + bounds.w / 2;
                        const centerY = bounds.y + bounds.h / 2;
                        const isSelected = selectedElementIds.includes(el.id);
                        const displayName = el.type === 'frame' ? (el.frameLabel || 'Фрейм') 
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
                            className={`text-xs hover:bg-white/10 px-2 py-1.5 rounded cursor-pointer truncate transition-colors flex items-center gap-2
                              ${isSelected ? 'bg-white/10 text-white' : 'text-white/60'}`}
                          >
                            <span className="text-sm">{typeIcons[el.type] || '•'}</span>
                            <span>{displayName}</span>
                            {el.type === 'text' && el.text && (
                              <span className="text-white/30 ml-1 truncate max-w-[120px]">"{el.text.slice(0, 20)}"</span>
                            )}
                            {el.description && (
                              <span className="text-white/20 ml-1 truncate max-w-[80px] text-[10px]">📝 {el.description.slice(0, 12)}…</span>
                            )}
                          </div>
                        );
                      })}
                      <div className="border-t border-white/5 my-2" />
                    </>
                  );
                })()}

                <h4 className="text-[10px] uppercase font-bold text-white/40 mb-2 px-2 tracking-widest">{t('hud.pinnedWindows')}</h4>
                {pinnedWindows.length === 0 ? <p className="text-xs text-white/30 px-2 italic mb-2">{t('hud.none')}</p> : (
                  pinnedWindows.map(w => {
                    const e = getEntitiesSnapshot()[w.entityId];
                    return (
                      <div key={w.id} onClick={() => centerOn(w.x, w.y)} className="text-sm text-white/80 hover:bg-white/10 px-2 py-1.5 rounded cursor-pointer truncate transition-colors">
                        📌 {e?.name || t('hud.unknown')}
                      </div>
                    );
                  })
                )}
                <h4 className="text-[10px] uppercase font-bold text-white/40 mb-2 px-2 mt-3 tracking-widest">Токены и Сущности</h4>
                {tokensOnCurrent.length === 0 ? <p className="text-xs text-white/30 px-2 italic">{t('hud.none')}</p> : (
                  tokensOnCurrent.map(tok => (
                    <div key={tok.id} onClick={() => centerOn(tok.properties.x || 0, tok.properties.y || 0)} className="text-sm text-blue-300 hover:bg-white/10 px-2 py-1.5 rounded cursor-pointer truncate transition-colors">
                      ♟ {tok.name}
                    </div>
                  ))
                )}
                <h4 className="text-[10px] uppercase font-bold text-white/40 mb-2 px-2 mt-3 tracking-widest">{t('hud.portalsHere')}</h4>
                {portalsOnCurrent.length === 0 ? <p className="text-xs text-white/30 px-2 italic">{t('hud.none')}</p> : (
                  portalsOnCurrent.map(p => (
                    <div key={p.id} onClick={() => centerOn(p.properties.x || 0, p.properties.y || 0)} className="text-sm text-white/60 hover:bg-white/10 px-2 py-1.5 rounded cursor-pointer truncate transition-colors">
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
            const w = window.innerWidth;
            const h = window.innerHeight;
            setTransform(1, w / 2, h / 2);
          }}
          className="bg-black/20 backdrop-blur-2xl border border-white/10 w-10 h-10 rounded-xl flex justify-center items-center text-white/70 hover:text-white shadow-xl hover:border-white/30 hover:bg-white/10 transition-all cursor-pointer"
          title="Рецентр"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </button>
      </div>

      {/* ─── Style Panel ─── */}
      {showStylePanel && (
        <div className="bg-black/20 backdrop-blur-2xl border border-white/10 rounded-xl shadow-xl px-4 py-3">
          
          <div className="flex items-start gap-5">
            
            {/* COLUMN 1: Colors & Opacity */}
            <div className="flex flex-col gap-3">
              {/* Stroke Color */}
              {showStrokeColor && (
                <div>
                  <span className="text-[8px] text-white/25 uppercase font-bold tracking-widest select-none block mb-1.5">Обводка</span>
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
                  <span className="text-[8px] text-white/25 uppercase font-bold tracking-widest select-none block mb-1.5">Заливка</span>
                  <div className="grid grid-cols-5 gap-1.5 w-max">
                    {FILL_COLORS.slice(0, 9).map((color, i) => (
                      <button
                        key={`fill-${i}`}
                        onClick={() => handleStyleChange({ fill: color })}
                        className={`w-4 h-4 rounded transition-all duration-100 border cursor-pointer
                          ${currentStyle.fill === color
                            ? 'border-white scale-125 shadow-lg'
                            : 'border-transparent hover:border-white/30 hover:scale-110'
                          }`}
                        style={{
                          backgroundColor: color || 'transparent',
                          backgroundImage: color ? undefined : 'linear-gradient(135deg, transparent 40%, #f87171 40%, #f87171 60%, transparent 60%)',
                        }}
                        title={color || 'Без заливки'}
                      />
                    ))}
                  </div>
                  {/* Solid fill row */}
                  <div className="grid grid-cols-5 gap-1.5 w-max mt-1.5">
                    {FILL_COLORS.slice(9).map((color, i) => (
                      <button
                        key={`sfill-${i}`}
                        onClick={() => handleStyleChange({ fill: color })}
                        className={`w-4 h-4 rounded transition-all duration-100 border cursor-pointer
                          ${currentStyle.fill === color
                            ? 'border-white scale-125 shadow-lg'
                            : 'border-transparent hover:border-white/30 hover:scale-110'
                          }`}
                        style={{ backgroundColor: color }}
                        title={`${color} (сплошная)`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Opacity controls */}
              <div className="mt-1 flex flex-col gap-1">
                {/* Stroke Opacity */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[7px] text-white/20 uppercase font-bold tracking-wide select-none w-6">Обв</span>
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
                  <span className="text-[7px] text-white/20 w-7 text-right">{Math.round(currentStyle.strokeOpacity * 100)}%</span>
                </div>
                {/* Fill Opacity (only for shapes) */}
                {(showFillColor) && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[7px] text-white/20 uppercase font-bold tracking-wide select-none w-6">Зал</span>
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
                    <span className="text-[7px] text-white/20 w-7 text-right">{Math.round(currentStyle.fillOpacity * 100)}%</span>
                  </div>
                )}
                {/* Text Opacity (only for text/shapes with text) */}
                {showTextStyles && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[7px] text-white/20 uppercase font-bold tracking-wide select-none w-6">Ткст</span>
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
                    <span className="text-[7px] text-white/20 w-7 text-right">{Math.round(currentStyle.textOpacity * 100)}%</span>
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
                    <span className="text-[8px] text-white/25 uppercase font-bold tracking-widest select-none block mb-1.5">Шрифт</span>
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
                      <span className="text-[8px] text-white/25 uppercase font-bold tracking-widest select-none block mb-1.5">Размер</span>
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
                      <span className="text-[8px] text-white/25 uppercase font-bold tracking-widest select-none block mb-1.5">Выравнивание</span>
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
                    <span className="text-[8px] text-white/25 uppercase font-bold tracking-widest select-none block mb-1.5 mt-1">Цвет текста</span>
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
                  <span className="text-[8px] text-white/25 uppercase font-bold tracking-widest select-none block mb-1.5">Толщина</span>
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
                  <span className="text-[8px] text-white/25 uppercase font-bold tracking-widest select-none block mb-1.5">Стиль</span>
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
                        title={s.label}
                      >
                        <span className="font-mono tracking-wider text-[9px]">{s.preview}</span>
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
                  
                  {/* Start cap */}
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-white/25 uppercase font-bold w-12 select-none tracking-widest text-right">Начало</span>
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
                          title={cap.label}
                        >
                          {cap.icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* End cap */}
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-white/25 uppercase font-bold w-12 select-none tracking-widest text-right">Конец</span>
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
                          title={cap.label}
                        >
                          {cap.icon}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              </>
            )}

          </div>

          {/* Alignment options (Bottom Row separate if multiples selected) */}
          {activeTool === 'select' && selectedElementIds.length > 1 && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5 justify-center">
              <span className="text-[8px] text-white/25 uppercase font-bold mr-1.5 select-none tracking-widest">Выравнивание:</span>
              <div className="flex items-center gap-1">
                {ALIGN_OPTIONS.map((align) => (
                  <button
                    key={align.id}
                    onClick={() => handleAlign(align.id)}
                    className="w-7 h-7 rounded flex items-center justify-center transition-all cursor-pointer text-white/50 hover:bg-white/10 hover:text-white"
                    title={align.title}
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
            const canvasEntity = yjsStore.entitiesMap.get(activeCanvasId);
            const elements = canvasEntity?.properties?.drawElements || [];
            const firstSelected = selectedElementIds.length === 1 
              ? elements.find((el: DrawElement) => el.id === selectedElementIds[0]) 
              : null;
            const hasName = firstSelected?.objectName || firstSelected?.frameLabel;
            const isNameable = firstSelected && (firstSelected.type === 'rectangle' || firstSelected.type === 'ellipse' || firstSelected.type === 'line' || firstSelected.type === 'arrow');
            const hasDescription = firstSelected?.description;

            return (
              <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-white/5">
                {/* Layer controls row */}
                <div className="flex items-center gap-3 justify-center">
                  <span className="text-[8px] text-white/25 uppercase font-bold mr-1.5 select-none tracking-widest">Слои:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleZOrder('back')}
                      className="w-7 h-7 rounded flex items-center justify-center transition-all cursor-pointer text-white/50 hover:bg-white/10 hover:text-white"
                      title="На задний план"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="17 18 12 23 7 18" />
                        <polyline points="17 6 12 11 7 6" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleZOrder('backward')}
                      className="w-7 h-7 rounded flex items-center justify-center transition-all cursor-pointer text-white/50 hover:bg-white/10 hover:text-white"
                      title="Назад"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="17 13 12 18 7 13" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleZOrder('forward')}
                      className="w-7 h-7 rounded flex items-center justify-center transition-all cursor-pointer text-white/50 hover:bg-white/10 hover:text-white"
                      title="Вперёд"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="17 11 12 6 7 11" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleZOrder('front')}
                      className="w-7 h-7 rounded flex items-center justify-center transition-all cursor-pointer text-white/50 hover:bg-white/10 hover:text-white"
                      title="На передний план"
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
                        title={firstSelected.showName !== false ? 'Скрыть название' : 'Показать название'}
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
                      <span className="text-[8px] text-white/20 italic select-none">Alt+2×клик → название</span>
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
