/**
 * canvasDrawStore.ts — Zustand store for canvas drawing state
 *
 * Manages the active tool, current style, selection, in-progress drawing,
 * element dragging, point editing, undo/redo and clipboard.
 */

import { create } from 'zustand';
import type { CanvasTool, DrawElement, StrokeStyle, LineCap, TextFontFamily, TextAlign } from '../types/canvasTypes';
import { DEFAULT_DRAW_STYLE } from '../types/canvasTypes';

export interface DrawStyleState {
  stroke: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  fill: string;
  opacity: number;
  fillOpacity: number;
  strokeOpacity: number;
  startCap: LineCap;
  endCap: LineCap;
  fontSize: number;
  fontFamily: TextFontFamily;
  textAlign: TextAlign;
  textColor: string;
  textOpacity: number;
}

interface CanvasDrawState {
  // Current tool
  activeTool: CanvasTool;

  // Style applied to new elements
  currentStyle: DrawStyleState;

  // Selected element IDs
  selectedElementIds: string[];

  // Element currently being drawn (preview)
  drawingElement: DrawElement | null;

  // If editing vector points: index of the point being dragged (-1 = none)
  editingPointIndex: number | null;

  // Dragging selected elements in select mode
  isDraggingElement: boolean;
  dragStartPoint: { x: number; y: number } | null;

  // Marquee selection
  marquee: { x: number; y: number; w: number; h: number } | null;

  // Clipboard (for copy/paste)
  clipboard: DrawElement[];

  // Text editing state
  editingTextId: string | null;

  // Frame label editing state
  editingFrameLabelId: string | null;

  // Global drag flag (for UI interference prevention)
  isDraggingGlobal: boolean;

  // Unsaved changes tracking (for navigation confirmation)
  isCanvasDirty: boolean;

  // ─── Fog of War tool ───
  fogTool: 'none' | 'revealBrush' | 'revealRect' | 'coverBrush' | 'coverRect';
  setFogTool: (tool: 'none' | 'revealBrush' | 'revealRect' | 'coverBrush' | 'coverRect') => void;
  /** Fog editing mode: replaces main toolbar, intercepts all mouse events */
  fogEditMode: boolean;
  setFogEditMode: (on: boolean) => void;
  /** GM toggle: show fog overlay for GM preview */
  gmFogVisible: boolean;
  toggleGmFog: () => void;
  /** Player toggle: show fog overlay for players (per-player UI pref) */
  playerFogVisible: boolean;
  togglePlayerFog: () => void;

  // ─── Grid settings ───
  gridEnabled: boolean;
  gridType: 'square' | 'hex';
  gridSpacing: number;
  toggleGrid: () => void;
  setGridType: (type: 'square' | 'hex') => void;
  setGridSpacing: (spacing: number) => void;

  // Actions
  setTool: (tool: CanvasTool) => void;
  setStyle: (partial: Partial<DrawStyleState>) => void;
  selectElement: (id: string, additive?: boolean) => void;
  selectElements: (ids: string[]) => void;
  clearSelection: () => void;
  startDrawing: (element: DrawElement) => void;
  updateDrawing: (element: DrawElement) => void;
  finishDrawing: () => DrawElement | null;
  cancelDrawing: () => void;
  setEditingPointIndex: (index: number | null) => void;
  startDragging: (point: { x: number; y: number }) => void;
  stopDragging: () => void;

  // Marquee
  startMarquee: (x: number, y: number) => void;
  updateMarquee: (w: number, h: number) => void;
  finishMarquee: () => { x: number; y: number; w: number; h: number } | null;

  // Clipboard
  copyToClipboard: (elements: DrawElement[]) => void;
  getClipboard: () => DrawElement[];

  // Text editing
  setEditingTextId: (id: string | null) => void;

  // Frame label editing
  setEditingFrameLabelId: (id: string | null) => void;

  // Global drag flag  
  setDraggingGlobal: (v: boolean) => void;

  // Dirty flag
  setCanvasDirty: (v: boolean) => void;
}

export const useCanvasDrawStore = create<CanvasDrawState>((set, get) => ({
  activeTool: 'select',
  currentStyle: {
    ...DEFAULT_DRAW_STYLE,
    fontSize: 24,
    fontFamily: 'sans' as TextFontFamily,
    textAlign: 'left' as TextAlign,
    textColor: '#e2e8f0', // default light text color
    textOpacity: 1,
    fillOpacity: 1,
    strokeOpacity: 1,
  },
  selectedElementIds: [],
  drawingElement: null,
  editingPointIndex: null,
  isDraggingElement: false,
  dragStartPoint: null,
  marquee: null,
  clipboard: [],
  editingTextId: null,
  editingFrameLabelId: null,
  isDraggingGlobal: false,
  isCanvasDirty: false,

  // ─── Fog tool ───
  fogTool: 'none',
  setFogTool: (tool) => set({ fogTool: tool }),
  fogEditMode: false,
  setFogEditMode: (on) => set({ fogEditMode: on, fogTool: on ? (get().fogTool === 'none' ? 'revealBrush' : get().fogTool) : 'none' }),
  gmFogVisible: false,
  toggleGmFog: () => set((s) => ({ gmFogVisible: !s.gmFogVisible })),
  playerFogVisible: true,
  togglePlayerFog: () => set((s) => ({ playerFogVisible: !s.playerFogVisible })),

  // ─── Grid defaults ───
  gridEnabled: false,
  gridType: 'square',
  gridSpacing: 50,

  toggleGrid: () => set((s) => ({ gridEnabled: !s.gridEnabled })),
  setGridType: (type) => set({ gridType: type }),
  setGridSpacing: (spacing) => set({ gridSpacing: spacing }),

  setTool: (tool) => {
    set({
      activeTool: tool,
      selectedElementIds: [],
      drawingElement: null,
      editingPointIndex: null,
      isDraggingElement: false,
      dragStartPoint: null,
      marquee: null,
      editingTextId: null,
    });
  },

  setStyle: (partial) => {
    const { currentStyle } = get();
    set({ currentStyle: { ...currentStyle, ...partial } });
  },

  selectElement: (id, additive = false) => {
    const { selectedElementIds } = get();
    if (additive) {
      if (selectedElementIds.includes(id)) {
        set({ selectedElementIds: selectedElementIds.filter(eid => eid !== id) });
      } else {
        set({ selectedElementIds: [...selectedElementIds, id] });
      }
    } else {
      set({ selectedElementIds: [id], editingPointIndex: null });
    }
  },

  selectElements: (ids) => {
    set({ selectedElementIds: ids, editingPointIndex: null });
  },

  clearSelection: () => {
    set({ selectedElementIds: [], editingPointIndex: null, isDraggingElement: false, dragStartPoint: null, editingTextId: null });
  },

  startDrawing: (element) => {
    set({ drawingElement: element });
  },

  updateDrawing: (element) => {
    set({ drawingElement: element });
  },

  finishDrawing: () => {
    const { drawingElement } = get();
    set({ drawingElement: null });
    return drawingElement;
  },

  cancelDrawing: () => {
    set({ drawingElement: null });
  },

  setEditingPointIndex: (index) => {
    set({ editingPointIndex: index });
  },

  startDragging: (point) => {
    set({ isDraggingElement: true, dragStartPoint: point });
  },

  stopDragging: () => {
    set({ isDraggingElement: false, dragStartPoint: null });
  },

  // ─── Marquee ───
  startMarquee: (x, y) => {
    set({ marquee: { x, y, w: 0, h: 0 } });
  },

  updateMarquee: (w, h) => {
    const { marquee } = get();
    if (!marquee) return;
    set({ marquee: { ...marquee, w, h } });
  },

  finishMarquee: () => {
    const { marquee } = get();
    set({ marquee: null });
    return marquee;
  },

  // ─── Clipboard ───
  copyToClipboard: (elements) => {
    set({ clipboard: elements.map(el => ({ ...el })) });
  },

  getClipboard: () => {
    return get().clipboard;
  },

  // ─── Text editing ───
  setEditingTextId: (id) => {
    set({ editingTextId: id });
  },

  // ─── Frame label editing ───
  setEditingFrameLabelId: (id) => {
    set({ editingFrameLabelId: id });
  },

  // ─── Global drag flag ───
  setDraggingGlobal: (v) => {
    set({ isDraggingGlobal: v });
  },

  // ─── Dirty flag ───
  setCanvasDirty: (v) => {
    set({ isCanvasDirty: v });
  },
}));
