import { create } from 'zustand';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { DrawElement, FogReveal } from '../types/canvasTypes';
import { fogRevealsOverlap } from '../types/canvasTypes';
import { useCanvasDrawStore } from './canvasDrawStore';
import { yjsStore } from './yjsStore';

// ─── Awareness: remote cursor state ───

export interface RemoteCursor {
    x: number;
    y: number;
    name: string;
    color: string;
    role: string;
    /** Ping pulse at a specific location (ephemeral, auto-expires on clients) */
    ping?: { x: number; y: number; timestamp: number };
}

/** How long a ping pulse is visible (ms) */
export const PING_DURATION_MS = 2500;

const CURSOR_COLORS = [
    '#f87171', '#fb923c', '#facc15', '#4ade80', '#22d3ee',
    '#60a5fa', '#a78bfa', '#f472b6', '#94a3b8', '#e879f9',
];

/** Deterministic color from player ID */
function getPlayerColor(playerId: string): string {
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
        hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

export interface CanvasSyncState {
    canvasId: string | null;
    elements: DrawElement[];
    isSynced: boolean;
    provider: WebsocketProvider | null;
    persistence: IndexeddbPersistence | null;
    doc: Y.Doc | null;
    elementsMap: Y.Map<DrawElement> | null;
    undoManager: Y.UndoManager | null;

    /** Remote cursors: Map<peerId → RemoteCursor> */
    remoteCursors: Record<string, RemoteCursor>;

    /** Fog of War: revealed areas (holes in fog). Empty = full fog (default). */
    fogReveals: FogReveal[];
    fogMap: Y.Map<FogReveal> | null;

    joinCanvas: (canvasId: string) => void;
    leaveCanvas: () => void;
    setElement: (element: DrawElement) => void;
    updateElement: (id: string, partial: Partial<DrawElement>) => void;
    deleteElement: (id: string) => void;
    deleteElements: (ids: string[]) => void;
    syncElementsArray: (newArray: DrawElement[]) => void;
    undo: () => void;
    redo: () => void;
    clearHistory: () => void;

    /** Update local cursor position via awareness */
    setLocalCursor: (x: number, y: number) => void;
    /** Send a ping pulse at given canvas coordinates (visible to all players) */
    sendPing: (x: number, y: number) => void;
    /** Remove local ping from awareness (auto-called after expiry) */
    clearLocalPing: () => void;

    /** Fog of War: GM adds a reveal (hole in fog) */
    addFogReveal: (reveal: FogReveal) => void;
    /** Fog of War: remove all reveals that overlap the given shape (cover tools) */
    removeIntersectingReveals: (shape: FogReveal) => void;
    /** Fog of War: clear all reveals (full fog — default state) */
    clearAllFog: () => void;
    /** Fog of War: add a massive reveal to show everything (Сбросить всё) */
    revealAll: () => void;
}

export const useCanvasSyncStore = create<CanvasSyncState>((set, get) => ({
    canvasId: null,
    elements: [],
    isSynced: false,
    provider: null,
    persistence: null,
    doc: null,
    elementsMap: null,
    undoManager: null,
    remoteCursors: {},
    fogReveals: [],
    fogMap: null,

    joinCanvas: (canvasId: string) => {
        const current = get();
        if (current.canvasId === canvasId) return;
        
        current.leaveCanvas(); // cleanup

        const doc = new Y.Doc();
        const elementsMap = doc.getMap<DrawElement>('elements');
        const fogMap = doc.getMap<FogReveal>('fogReveals');
        const undoManager = new Y.UndoManager(elementsMap);

        const savedIp = localStorage.getItem('vibe_server_ip');
        const host = savedIp && savedIp.trim() !== '' ? savedIp.trim() : window.location.hostname;
        const roomName = `canvas-${canvasId}`;
        const provider = new WebsocketProvider(`ws://${host}:3001/ws/canvas/${canvasId}`, roomName, doc, { connect: true });
        const persistence = new IndexeddbPersistence(roomName, doc);

        provider.on('sync', (isSynced: boolean) => {
            set({ isSynced });
        });

        elementsMap.observe(() => {
            const arr = Array.from(elementsMap.values());
            set({ elements: arr });
        });

        // Observe fog reveals
        fogMap.observe(() => {
            set({ fogReveals: Array.from(fogMap.values()) });
        });

        // Set isCanvasDirty when local actions add to undo history
        undoManager.on('stack-item-added', () => {
            useCanvasDrawStore.getState().setCanvasDirty(true);
        });

        // ─── Awareness: track remote cursors ───
        const awareness = provider.awareness;

        // Announce local player info (name, role, color)
        const playerId = yjsStore.localPlayerId;
        const playerName = yjsStore.localPlayerName;
        const playerRole = yjsStore.localRole;
        const playerColor = getPlayerColor(playerId);
        
        awareness.setLocalStateField('cursor', {
            x: 0,
            y: 0,
            name: playerName,
            color: playerColor,
            role: playerRole,
        });

        // Listen for remote cursor updates
        const handleAwarenessChange = () => {
            const states = awareness.getStates();
            const cursors: Record<string, RemoteCursor> = {};
            states.forEach((state, peerId) => {
                // Skip local peer
                if (peerId === provider.awareness.clientID) return;
                const cursor = state.cursor as RemoteCursor | undefined;
                if (cursor && typeof cursor.x === 'number' && typeof cursor.y === 'number') {
                    cursors[peerId.toString()] = cursor;
                }
            });
            set({ remoteCursors: cursors });
        };

        awareness.on('change', handleAwarenessChange);
        // Initial sync
        handleAwarenessChange();

        // Store cleanup ref
        (provider as any).__awarenessHandler = handleAwarenessChange;

        set({
            canvasId,
            doc,
            elementsMap,
            fogMap,
            undoManager,
            provider,
            persistence,
            elements: Array.from(elementsMap.values()),
            fogReveals: Array.from(fogMap.values()),
            remoteCursors: {},
        });
    },

    leaveCanvas: () => {
        const { provider, persistence, doc, undoManager } = get();
        if (provider) {
            // Remove awareness listener
            const handler = (provider as any).__awarenessHandler;
            if (handler) provider.awareness.off('change', handler);
            provider.destroy();
        }
        if (persistence) persistence.destroy();
        if (doc) doc.destroy();
        if (undoManager) undoManager.destroy();
        
        set({
            canvasId: null,
            elements: [],
            isSynced: false,
            provider: null,
            persistence: null,
            doc: null,
            elementsMap: null,
            fogMap: null,
            undoManager: null,
            remoteCursors: {},
            fogReveals: [],
        });
    },

    setElement: (element: DrawElement) => {
        const { elementsMap } = get();
        if (elementsMap) elementsMap.set(element.id, { ...element });
    },

    updateElement: (id: string, partial: Partial<DrawElement>) => {
        const { elementsMap } = get();
        if (elementsMap) {
            const existing = elementsMap.get(id);
            if (existing) {
                elementsMap.set(id, { ...existing, ...partial });
            }
        }
    },

    deleteElement: (id: string) => {
        const { elementsMap } = get();
        if (elementsMap) elementsMap.delete(id);
    },

    deleteElements: (ids: string[]) => {
        const { doc, elementsMap } = get();
        if (doc && elementsMap) {
            doc.transact(() => {
                ids.forEach(id => elementsMap.delete(id));
            });
        }
    },

    syncElementsArray: (newArray: DrawElement[]) => {
        const { doc, elementsMap } = get();
        if (!doc || !elementsMap) return;
        
        doc.transact(() => {
            const currentKeys = new Set(elementsMap.keys());
            const newKeys = new Set<string>();
            
            for (const el of newArray) {
                newKeys.add(el.id);
                const existing = elementsMap.get(el.id);
                if (JSON.stringify(existing) !== JSON.stringify(el)) {
                    elementsMap.set(el.id, { ...el });
                }
            }
            
            for (const key of currentKeys) {
                if (!newKeys.has(key)) {
                    elementsMap.delete(key);
                }
            }
        });
    },

    undo: () => {
        const { undoManager } = get();
        if (undoManager) {
            undoManager.undo();
        }
    },

    redo: () => {
        const { undoManager } = get();
        if (undoManager) {
            undoManager.redo();
        }
    },
    
    clearHistory: () => {
        const { undoManager } = get();
        if (undoManager) undoManager.clear();
        useCanvasDrawStore.getState().setCanvasDirty(false);
    },

    setLocalCursor: (x: number, y: number) => {
        const { provider } = get();
        if (provider?.awareness) {
            const existing = provider.awareness.getLocalState()?.cursor || {};
            provider.awareness.setLocalStateField('cursor', {
                ...existing,
                x,
                y,
                name: yjsStore.localPlayerName,
                color: getPlayerColor(yjsStore.localPlayerId),
                role: yjsStore.localRole,
            });
        }
    },

    sendPing: (x: number, y: number) => {
        const { provider } = get();
        if (provider?.awareness) {
            const existing = provider.awareness.getLocalState()?.cursor || {};
            provider.awareness.setLocalStateField('cursor', {
                x: existing.x ?? x,
                y: existing.y ?? y,
                name: yjsStore.localPlayerName,
                color: getPlayerColor(yjsStore.localPlayerId),
                role: yjsStore.localRole,
                ping: { x, y, timestamp: Date.now() },
            });
            // Auto-clear ping after duration
            setTimeout(() => {
                get().clearLocalPing();
            }, PING_DURATION_MS);
        }
    },

    clearLocalPing: () => {
        const { provider } = get();
        if (provider?.awareness) {
            const existing = provider.awareness.getLocalState()?.cursor || {};
            const { ping, ...rest } = existing;
            provider.awareness.setLocalStateField('cursor', rest);
        }
    },

    // ─── Fog of War ───

    addFogReveal: (reveal: FogReveal) => {
        const { fogMap } = get();
        if (!fogMap) return;
        fogMap.set(reveal.id, { ...reveal });
    },

    removeIntersectingReveals: (shape: FogReveal) => {
        const { fogMap, fogReveals } = get();
        if (!fogMap) return;
        const toRemove: string[] = [];
        for (const r of fogReveals) {
            if (fogRevealsOverlap(r, shape)) {
                toRemove.push(r.id);
            }
        }
        if (toRemove.length > 0) {
            for (const id of toRemove) {
                fogMap.delete(id);
            }
        }
    },

    clearAllFog: () => {
        const { fogMap, doc } = get();
        if (!fogMap || !doc) return;
        doc.transact(() => {
            // Clear all reveals — empty = full fog (default)
            fogMap.clear();
        });
    },

    revealAll: () => {
        const { fogMap, doc } = get();
        if (!fogMap || !doc) return;
        doc.transact(() => {
            // Single massive reveal covering the entire plausible play area
            fogMap.clear();
            fogMap.set('reveal_all', {
                id: 'reveal_all',
                type: 'rect',
                x: -10000,
                y: -10000,
                width: 20000,
                height: 20000,
            });
        });
    },
}));
