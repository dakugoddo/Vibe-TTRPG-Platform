import { create } from 'zustand';
import { useCanvasDrawStore } from './canvasDrawStore';
import { useCanvasSyncStore } from './canvasSyncStore';
import { useUIStore } from './uiStore';

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
            useUIStore.getState().openConfirm({
                title: 'Переход между областями',
                description: 'История отмены для текущей области будет очищена. Продолжить?',
                confirmText: 'Продолжить',
                onConfirm: () => {
                    const latest = get();
                    if (latest.activeCanvasId === canvasId) return;
                    useCanvasSyncStore.getState().clearHistory();
                    set({
                        activeCanvasId: canvasId,
                        canvasHistory: [...latest.canvasHistory, latest.activeCanvasId],
                        scale: 1,
                        offset: { x: 0, y: 0 },
                    });
                },
            });
            return;
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
            useUIStore.getState().openConfirm({
                title: 'Возврат к прошлой области',
                description: 'История отмены для текущей области будет очищена. Продолжить?',
                confirmText: 'Вернуться',
                onConfirm: () => {
                    const latest = get();
                    if (latest.canvasHistory.length === 0) return;
                    useCanvasSyncStore.getState().clearHistory();
                    const newHistory = [...latest.canvasHistory];
                    const prevCanvas = newHistory.pop()!;
                    set({
                        activeCanvasId: prevCanvas,
                        canvasHistory: newHistory,
                        scale: 1,
                        offset: { x: 0, y: 0 },
                    });
                },
            });
            return;
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
        const current = get();
        if (
            Math.abs(current.scale - scale) < 0.0001 &&
            Math.abs(current.offset.x - x) < 0.1 &&
            Math.abs(current.offset.y - y) < 0.1
        ) {
            return;
        }
        set({ scale, offset: { x, y } });
    }
}));
