import { create } from 'zustand';
import { useCanvasDrawStore } from './canvasDrawStore';
import { useCanvasSyncStore } from './canvasSyncStore';

interface CanvasState {
    activeCanvasId: string;
    canvasHistory: string[];
    scale: number;
    offset: { x: number, y: number };

    navigate: (canvasId: string) => void;
    goBack: () => void;
    setTransform: (scale: number, x: number, y: number) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
    activeCanvasId: 'root',
    canvasHistory: [],
    scale: 1,
    offset: { x: 0, y: 0 },

    navigate: (canvasId) => {
        const { activeCanvasId, canvasHistory } = get();
        if (activeCanvasId === canvasId) return;

        const isDirty = useCanvasDrawStore.getState().isCanvasDirty;
        if (isDirty) {
            const confirmed = window.confirm("Вы внесли изменения на этом экране. При переходе история отмен (Undo) для этого экрана будет очищена. Продолжить?");
            if (!confirmed) return;
            useCanvasSyncStore.getState().clearHistory();
        }

        set({
            activeCanvasId: canvasId,
            canvasHistory: [...canvasHistory, activeCanvasId],
            scale: 1,
            offset: { x: 0, y: 0 } // Reset view on navigation
        });
    },

    goBack: () => {
        const { canvasHistory } = get();
        if (canvasHistory.length === 0) return;

        const isDirty = useCanvasDrawStore.getState().isCanvasDirty;
        if (isDirty) {
            const confirmed = window.confirm("Вы внесли изменения на этом экране. При возврате назад история отмен (Undo) для текущего экрана будет очищена. Продолжить?");
            if (!confirmed) return;
            useCanvasSyncStore.getState().clearHistory();
        }

        const newHistory = [...canvasHistory];
        const prevCanvas = newHistory.pop()!;

        set({
            activeCanvasId: prevCanvas,
            canvasHistory: newHistory,
            scale: 1,
            offset: { x: 0, y: 0 }
        });
    },

    setTransform: (scale, x, y) => {
        set({ scale, offset: { x, y } });
    }
}));
