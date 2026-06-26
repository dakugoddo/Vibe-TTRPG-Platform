import { create } from 'zustand';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { Entity } from '../types';
import type { DrawElement, FogReveal } from '../types/canvasTypes';
import { fogRevealsOverlap } from '../types/canvasTypes';
import {
    CANVAS_DRAW_ELEMENTS_PROPERTY,
    CANVAS_FOG_REVEALS_PROPERTY,
    readCanvasDrawElements,
    readCanvasFogReveals,
    normalizeDrawElementsForSharedSync,
    sanitizeDrawElementForSharedSync,
    sanitizeFogRevealForPersistence,
} from '../utils/canvasPersistence';
import { getYjsPersistenceKey } from '../utils/yjsCache';
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
const awarenessHandlers = new WeakMap<WebsocketProvider, () => void>();
const entityChangeHandlers = new WeakMap<Y.Doc, (event: Y.YMapEvent<Entity>) => void>();
const CANVAS_ENTITY_WRITEBACK_DELAY_MS = 1000;
const canvasEntityWriteTimers = new Map<string, ReturnType<typeof setTimeout>>();
const hydratingCanvasIds = new Set<string>();
const mirroringCanvasIds = new Set<string>();
const CANVAS_LOCAL_CHANGE_ORIGIN = 'canvas-local-change';
const CURSOR_AWARENESS_MIN_INTERVAL_MS = 50;
let lastCursorAwarenessAt = 0;
let cursorAwarenessTimer: ReturnType<typeof setTimeout> | null = null;
let pendingCursorAwareness: { provider: WebsocketProvider; x: number; y: number } | null = null;

/** Deterministic color from player ID */
function getPlayerColor(playerId: string): string {
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
        hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

function writeLocalCursorAwareness(provider: WebsocketProvider, x: number, y: number): void {
    const existing = provider.awareness.getLocalState()?.cursor || {};
    provider.awareness.setLocalStateField('cursor', {
        ...existing,
        x,
        y,
        name: yjsStore.localPlayerName,
        color: getPlayerColor(yjsStore.localPlayerId),
        role: yjsStore.localRole,
    });
    lastCursorAwarenessAt = Date.now();
}

function scheduleLocalCursorAwareness(provider: WebsocketProvider, x: number, y: number): void {
    const now = Date.now();
    const elapsed = now - lastCursorAwarenessAt;
    pendingCursorAwareness = { provider, x, y };

    if (elapsed >= CURSOR_AWARENESS_MIN_INTERVAL_MS) {
        const pending = pendingCursorAwareness;
        pendingCursorAwareness = null;
        if (pending) writeLocalCursorAwareness(pending.provider, pending.x, pending.y);
        return;
    }

    if (cursorAwarenessTimer) return;
    cursorAwarenessTimer = setTimeout(() => {
        cursorAwarenessTimer = null;
        const pending = pendingCursorAwareness;
        pendingCursorAwareness = null;
        if (pending) writeLocalCursorAwareness(pending.provider, pending.x, pending.y);
    }, Math.max(0, CURSOR_AWARENESS_MIN_INTERVAL_MS - elapsed));
}

function getCanvasEntity(canvasId: string) {
    const entity = yjsStore.entitiesMap.get(canvasId);
    return entity?.type === 'canvas' ? entity : null;
}

function getEntityOwnerId(entity: Entity): string | undefined {
    const owner = entity.properties?._playerOwner;
    return typeof owner === 'string' ? owner : undefined;
}

function canModifyCanvas(canvasId: string | null): boolean {
    if (!canvasId) return false;
    const entity = getCanvasEntity(canvasId);
    return entity ? yjsStore.canModify(entity.database, getEntityOwnerId(entity)) : true;
}

function seedCanvasDocFromEntity(
    canvasId: string,
    doc: Y.Doc,
    elementsMap: Y.Map<DrawElement>,
    fogMap: Y.Map<FogReveal>
): void {
    const entity = getCanvasEntity(canvasId);
    if (!entity) return;

    const drawElements = readCanvasDrawElements(entity.properties);
    const fogReveals = readCanvasFogReveals(entity.properties);
    if (drawElements.length === 0 && fogReveals.length === 0) return;

    hydratingCanvasIds.add(canvasId);
    try {
        doc.transact(() => {
            if (elementsMap.size === 0) {
                for (const element of drawElements) {
                    elementsMap.set(element.id, sanitizeDrawElementForSharedSync(element));
                }
            }
            if (fogMap.size === 0) {
                for (const reveal of fogReveals) {
                    fogMap.set(reveal.id, sanitizeFogRevealForPersistence(reveal));
                }
            }
        });
    } finally {
        hydratingCanvasIds.delete(canvasId);
    }
}

function replaceCanvasDocFromEntity(
    canvasId: string,
    doc: Y.Doc,
    elementsMap: Y.Map<DrawElement>,
    fogMap: Y.Map<FogReveal>
): void {
    const entity = getCanvasEntity(canvasId);
    if (!entity) return;

    const drawElements = readCanvasDrawElements(entity.properties);
    const fogReveals = readCanvasFogReveals(entity.properties);

    hydratingCanvasIds.add(canvasId);
    try {
        doc.transact(() => {
            syncMapWithSnapshot(elementsMap, drawElements.map(sanitizeDrawElementForSharedSync));
            syncMapWithSnapshot(fogMap, fogReveals.map(sanitizeFogRevealForPersistence));
        });
    } finally {
        hydratingCanvasIds.delete(canvasId);
    }
}

function syncMapWithSnapshot<T extends { id: string }>(map: Y.Map<T>, snapshot: T[]): void {
    const nextKeys = new Set<string>();
    for (const item of snapshot) {
        nextKeys.add(item.id);
        const existing = map.get(item.id);
        if (JSON.stringify(existing) !== JSON.stringify(item)) {
            map.set(item.id, item);
        }
    }
    for (const key of Array.from(map.keys())) {
        if (!nextKeys.has(key)) {
            map.delete(key);
        }
    }
}

function writeCanvasEntitySnapshot(canvasId: string): void {
    const entity = getCanvasEntity(canvasId);
    if (!entity) return;
    if (!canModifyCanvas(canvasId)) return;

    const { elementsMap, fogMap } = useCanvasSyncStore.getState();
    if (!elementsMap || !fogMap) return;

    const drawElements = normalizeDrawElementsForSharedSync(Array.from(elementsMap.values()));
    const fogReveals = Array.from(fogMap.values()).map(sanitizeFogRevealForPersistence);
    const currentDrawElements = normalizeDrawElementsForSharedSync(readCanvasDrawElements(entity.properties));
    const currentFogReveals = readCanvasFogReveals(entity.properties);

    if (
        JSON.stringify(drawElements) === JSON.stringify(currentDrawElements) &&
        JSON.stringify(fogReveals) === JSON.stringify(currentFogReveals)
    ) {
        return;
    }

    mirroringCanvasIds.add(canvasId);
    try {
        yjsStore.updateEntity(canvasId, {
            properties: {
                ...entity.properties,
                [CANVAS_DRAW_ELEMENTS_PROPERTY]: drawElements,
                [CANVAS_FOG_REVEALS_PROPERTY]: fogReveals,
            },
        });
    } finally {
        mirroringCanvasIds.delete(canvasId);
    }
}

function scheduleCanvasEntityWriteback(canvasId: string): void {
    if (hydratingCanvasIds.has(canvasId)) return;
    const existingTimer = canvasEntityWriteTimers.get(canvasId);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
        canvasEntityWriteTimers.delete(canvasId);
        writeCanvasEntitySnapshot(canvasId);
    }, CANVAS_ENTITY_WRITEBACK_DELAY_MS);
    canvasEntityWriteTimers.set(canvasId, timer);
}

function flushCanvasEntityWriteback(canvasId: string | null): void {
    if (!canvasId) return;
    const timer = canvasEntityWriteTimers.get(canvasId);
    if (timer) {
        clearTimeout(timer);
        canvasEntityWriteTimers.delete(canvasId);
    }
    writeCanvasEntitySnapshot(canvasId);
}

function getUndoAvailability(undoManager: Y.UndoManager | null): { canUndo: boolean; canRedo: boolean } {
    return {
        canUndo: Boolean(undoManager && undoManager.undoStack.length > 0),
        canRedo: Boolean(undoManager && undoManager.redoStack.length > 0),
    };
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
    canUndo: boolean;
    canRedo: boolean;

    /** Remote cursors: Map<peerId → RemoteCursor> */
    remoteCursors: Record<string, RemoteCursor>;

    /** Fog of War patches. Historical store name: fogReveals. Empty = no fog. */
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

    /** Fog of War: GM adds a dark fog patch */
    addFogReveal: (reveal: FogReveal) => void;
    /** Fog of War: remove dark fog patches that overlap the given shape */
    removeIntersectingReveals: (shape: FogReveal) => void;
    /** Replace all fog patches in a single persistent transaction. */
    syncFogArray: (reveals: FogReveal[]) => void;
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
    canUndo: false,
    canRedo: false,
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

        const savedIp = localStorage.getItem('vibe_server_ip');
        const locationHost = window.location.hostname || 'localhost';
        const host = savedIp && savedIp.trim() !== '' ? savedIp.trim() : locationHost;
        const roomName = `canvas-${canvasId}`;
        const persistence = new IndexeddbPersistence(getYjsPersistenceKey(roomName), doc);
        seedCanvasDocFromEntity(canvasId, doc, elementsMap, fogMap);
        const provider = new WebsocketProvider(`ws://${host}:3001/ws/canvas/${canvasId}`, roomName, doc, { connect: true });
        const undoManager = new Y.UndoManager(elementsMap, {
            trackedOrigins: new Set([CANVAS_LOCAL_CHANGE_ORIGIN]),
        });

        provider.on('sync', (isSynced: boolean) => {
            set({ isSynced });
        });

        elementsMap.observe(() => {
            const arr = Array.from(elementsMap.values());
            set({ elements: arr });
            scheduleCanvasEntityWriteback(canvasId);
        });

        // Observe fog reveals
        fogMap.observe(() => {
            set({ fogReveals: Array.from(fogMap.values()) });
            scheduleCanvasEntityWriteback(canvasId);
        });

        const handleEntityChange = (event: Y.YMapEvent<Entity>) => {
            if (!event.keysChanged.has(canvasId) || mirroringCanvasIds.has(canvasId)) return;
            replaceCanvasDocFromEntity(canvasId, doc, elementsMap, fogMap);
        };
        yjsStore.entitiesMap.observe(handleEntityChange);
        entityChangeHandlers.set(doc, handleEntityChange);

        // Set isCanvasDirty when local actions add to undo history
        undoManager.on('stack-item-added', () => {
            useCanvasDrawStore.getState().setCanvasDirty(true);
            set(getUndoAvailability(undoManager));
        });
        undoManager.on('stack-item-popped', () => {
            set(getUndoAvailability(undoManager));
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

        awarenessHandlers.set(provider, handleAwarenessChange);

        set({
            canvasId,
            doc,
            elementsMap,
            fogMap,
            undoManager,
            ...getUndoAvailability(undoManager),
            provider,
            persistence,
            elements: Array.from(elementsMap.values()),
            fogReveals: Array.from(fogMap.values()),
            remoteCursors: {},
        });
    },

    leaveCanvas: () => {
        const { canvasId, provider, persistence, doc, undoManager } = get();
        flushCanvasEntityWriteback(canvasId);
        if (provider) {
            // Remove awareness listener
            const handler = awarenessHandlers.get(provider);
            if (handler) provider.awareness.off('change', handler);
            awarenessHandlers.delete(provider);
            provider.destroy();
        }
        if (doc) {
            const handler = entityChangeHandlers.get(doc);
            if (handler) yjsStore.entitiesMap.unobserve(handler);
            entityChangeHandlers.delete(doc);
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
            canUndo: false,
            canRedo: false,
            remoteCursors: {},
            fogReveals: [],
        });
    },

    setElement: (element: DrawElement) => {
        const { canvasId, doc, elementsMap, undoManager } = get();
        if (!canModifyCanvas(canvasId)) return;
        if (doc && elementsMap) {
            doc.transact(() => {
                elementsMap.set(element.id, sanitizeDrawElementForSharedSync(element));
            }, CANVAS_LOCAL_CHANGE_ORIGIN);
            set(getUndoAvailability(undoManager));
        }
    },

    updateElement: (id: string, partial: Partial<DrawElement>) => {
        const { canvasId, doc, elementsMap, undoManager } = get();
        if (!canModifyCanvas(canvasId)) return;
        if (doc && elementsMap) {
            const existing = elementsMap.get(id);
            if (existing) {
                doc.transact(() => {
                    elementsMap.set(id, sanitizeDrawElementForSharedSync({ ...existing, ...partial }));
                }, CANVAS_LOCAL_CHANGE_ORIGIN);
                set(getUndoAvailability(undoManager));
            }
        }
    },

    deleteElement: (id: string) => {
        const { canvasId, doc, elementsMap, undoManager } = get();
        if (!canModifyCanvas(canvasId)) return;
        if (doc && elementsMap) {
            doc.transact(() => {
                elementsMap.delete(id);
            }, CANVAS_LOCAL_CHANGE_ORIGIN);
            set(getUndoAvailability(undoManager));
        }
    },

    deleteElements: (ids: string[]) => {
        const { canvasId, doc, elementsMap, undoManager } = get();
        if (!canModifyCanvas(canvasId)) return;
        if (doc && elementsMap) {
            doc.transact(() => {
                ids.forEach(id => elementsMap.delete(id));
            }, CANVAS_LOCAL_CHANGE_ORIGIN);
            set(getUndoAvailability(undoManager));
        }
    },

    syncElementsArray: (newArray: DrawElement[]) => {
        const { canvasId, doc, elementsMap, undoManager } = get();
        if (!canModifyCanvas(canvasId)) return;
        if (!doc || !elementsMap) return;

        doc.transact(() => {
            const currentKeys = new Set(elementsMap.keys());
            const newKeys = new Set<string>();

            for (const el of newArray) {
                newKeys.add(el.id);
                const existing = elementsMap.get(el.id);
                const cleanElement = sanitizeDrawElementForSharedSync(el);
                if (JSON.stringify(existing) !== JSON.stringify(cleanElement)) {
                    elementsMap.set(el.id, cleanElement);
                }
            }

            for (const key of currentKeys) {
                if (!newKeys.has(key)) {
                    elementsMap.delete(key);
                }
            }
        }, CANVAS_LOCAL_CHANGE_ORIGIN);
        set(getUndoAvailability(undoManager));
    },

    undo: () => {
        const { canvasId, undoManager } = get();
        if (!canModifyCanvas(canvasId)) return;
        if (undoManager) {
            undoManager.undo();
            set(getUndoAvailability(undoManager));
        }
    },

    redo: () => {
        const { canvasId, undoManager } = get();
        if (!canModifyCanvas(canvasId)) return;
        if (undoManager) {
            undoManager.redo();
            set(getUndoAvailability(undoManager));
        }
    },

    clearHistory: () => {
        const { undoManager } = get();
        if (undoManager) undoManager.clear();
        set(getUndoAvailability(undoManager));
        useCanvasDrawStore.getState().setCanvasDirty(false);
    },

    setLocalCursor: (x: number, y: number) => {
        const { provider } = get();
        if (provider?.awareness) {
            scheduleLocalCursorAwareness(provider, x, y);
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
            const existing = (provider.awareness.getLocalState()?.cursor ?? {}) as Record<string, unknown>;
            const rest = { ...existing };
            delete rest.ping;
            provider.awareness.setLocalStateField('cursor', rest);
        }
    },

    // ─── Fog of War (PATCH-BASED MODEL: fog = dark patches drawn on canvas) ───
    // Empty fogMap = no fog at all (clear canvas).
    // Cover tools ADD fog patches. Reveal tools REMOVE fog patches.

    /** Add a fog patch (dark area) — used by Cover tools */
    addFogReveal: (patch: FogReveal) => {
        const { canvasId, fogMap } = get();
        if (!canModifyCanvas(canvasId)) return;
        if (!fogMap) return;
        fogMap.set(patch.id, sanitizeFogRevealForPersistence(patch));
    },

    /** Remove fog patches that overlap the given shape — used by Reveal tools */
    removeIntersectingReveals: (shape: FogReveal) => {
        const { canvasId, fogMap, fogReveals } = get();
        if (!canModifyCanvas(canvasId)) return;
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

    syncFogArray: (reveals: FogReveal[]) => {
        const { canvasId, doc, fogMap } = get();
        if (!canModifyCanvas(canvasId)) return;
        if (!doc || !fogMap) return;

        doc.transact(() => {
            syncMapWithSnapshot(fogMap, reveals.map(sanitizeFogRevealForPersistence));
        });
    },

    /** Cover entire canvas with fog (add one massive fog patch) */
    clearAllFog: () => {
        const { canvasId, fogMap, doc } = get();
        if (!canModifyCanvas(canvasId)) return;
        if (!fogMap || !doc) return;
        doc.transact(() => {
            fogMap.clear();
            fogMap.set('fog_all', {
                id: 'fog_all',
                type: 'rect',
                x: -50000,
                y: -50000,
                width: 100000,
                height: 100000,
            });
        });
    },

    /** Remove all fog patches — canvas is fully visible */
    revealAll: () => {
        const { canvasId, fogMap, doc } = get();
        if (!canModifyCanvas(canvasId)) return;
        if (!fogMap || !doc) return;
        doc.transact(() => {
            fogMap.clear();
        });
    },
}));
