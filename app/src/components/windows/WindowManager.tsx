import { useEffect, useMemo, useRef } from 'react';
import { useWindowStore } from '../../store/windowStore';
import type { WindowState } from '../../store/windowStore';
import { useCanvasStore } from '../../store/canvasStore';
import { useEntities } from '../../hooks/useEntities';
import { readCanvasWindowInstances } from '../../utils/canvasPersistence';
import { EntityWindow } from './EntityWindow';

interface WindowManagerProps {
    showPinned?: boolean;
}

export function WindowManager({ showPinned = true }: WindowManagerProps) {
    const pinnedLayerRef = useRef<HTMLDivElement | null>(null);
    const windows = useWindowStore((state) => state.windows);
    const hydrateWindow = useWindowStore((state) => state.hydrateWindow);
    const activeCanvasId = useCanvasStore((state) => state.activeCanvasId);
    const entities = useEntities();
    const canvasWindowStates = useMemo<WindowState[]>(() => {
        const activeCanvas = entities.find(entity => entity.id === activeCanvasId && entity.type === 'canvas');
        if (!activeCanvas) return [];

        return readCanvasWindowInstances(activeCanvas.properties).map(instance => ({
            id: instance.id,
            entityId: instance.entityId,
            mode: instance.mode,
            x: instance.x,
            y: instance.y,
            width: instance.width,
            height: instance.height,
            zIndex: instance.zIndex,
            isPinned: true,
            canvasId: activeCanvas.id,
        }));
    }, [activeCanvasId, entities]);

    // Auto-hydrate saved pinned windows from DB
    useEffect(() => {
        entities.forEach(entity => {
            const ws = entity.properties?.windowState;
            if (ws && ws.isPinned && !windows[entity.id]) {
                hydrateWindow({
                    id: entity.id,
                    entityId: entity.id,
                    mode: ws.mode || 'compact',
                    x: ws.x || 100,
                    y: ws.y || 100,
                    width: ws.width || 400,
                    height: ws.height || 300,
                    zIndex: ws.zIndex || 10,
                    isPinned: true,
                    canvasId: ws.canvasId
                });
            }
        });
    }, [entities, windows, hydrateWindow]);

    const visibleWindows = Object.values(windows).filter(win => !win.isPinned || win.canvasId === activeCanvasId);

    const pinnedWindows = showPinned
        ? [
            ...visibleWindows.filter(win => win.isPinned),
            ...canvasWindowStates,
        ].sort((left, right) => left.zIndex - right.zIndex)
        : [];
    const unpinnedWindows = visibleWindows.filter(win => !win.isPinned);

    useEffect(() => {
        const applyCameraTransform = (scale: number, x: number, y: number) => {
            const layer = pinnedLayerRef.current;
            if (!layer) return;
            layer.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        };

        const camera = useCanvasStore.getState();
        applyCameraTransform(camera.scale, camera.offset.x, camera.offset.y);
        window.__vibeSetPinnedLayerCamera = applyCameraTransform;

        const unsubscribe = useCanvasStore.subscribe((state, previous) => {
            if (
                state.scale === previous.scale &&
                state.offset.x === previous.offset.x &&
                state.offset.y === previous.offset.y
            ) {
                return;
            }
            applyCameraTransform(state.scale, state.offset.x, state.offset.y);
        });

        return () => {
            unsubscribe();
            if (window.__vibeSetPinnedLayerCamera === applyCameraTransform) {
                window.__vibeSetPinnedLayerCamera = undefined;
            }
        };
    }, []);

    const camera = useCanvasStore.getState();

    return (
        <>
            {/* Pinned Window Layer (Scaled with Canvas) - Layer 10 */}
            <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
                <div
                    ref={pinnedLayerRef}
                    className="absolute origin-top-left"
                    style={{
                        transform: `translate(${camera.offset.x}px, ${camera.offset.y}px) scale(${camera.scale})`,
                        top: 0, left: 0, right: 0, bottom: 0
                    }}
                >
                    {pinnedWindows.map((win) => (
                        <EntityWindow key={win.id} windowState={win} />
                    ))}
                </div>
            </div>

            {/* Unpinned Window Layer (Screen Space) - Layer 50 */}
            <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
                {unpinnedWindows.map((win) => (
                    <EntityWindow key={win.id} windowState={win} />
                ))}
            </div>
        </>
    );
}
