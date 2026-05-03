import { useEffect } from 'react';
import { useWindowStore } from '../../store/windowStore';
import { useCanvasStore } from '../../store/canvasStore';
import { useEntities } from '../../hooks/useEntities';
import { EntityWindow } from './EntityWindow';

export function WindowManager() {
    const windows = useWindowStore((state) => state.windows);
    const hydrateWindow = useWindowStore((state) => state.hydrateWindow);
    const activeCanvasId = useCanvasStore((state) => state.activeCanvasId);
    const entities = useEntities();

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

    const pinnedWindows = visibleWindows.filter(win => win.isPinned);
    const unpinnedWindows = visibleWindows.filter(win => !win.isPinned);

    const stageScale = useCanvasStore(s => s.scale);
    const stageOffset = useCanvasStore(s => s.offset);

    return (
        <>
            {/* Pinned Window Layer (Scaled with Canvas) - Layer 10 */}
            <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
                <div
                    className="absolute origin-top-left"
                    style={{
                        transform: `translate(${stageOffset.x}px, ${stageOffset.y}px) scale(${stageScale})`,
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
