import { create } from 'zustand';
import { useCanvasStore } from './canvasStore';

export type WindowMode = 'full' | 'compact' | 'icon';

export interface WindowState {
    id: string; // The window ID (same as entity ID typically)
    entityId: string;
    mode: WindowMode;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
    isPinned: boolean;
    canvasId?: string;
}

interface WindowStoreState {
    windows: Record<string, WindowState>;
    focusedWindowId: string | null;
    highestZIndex: number;
    openWindow: (entityId: string, x?: number, y?: number) => void;
    closeWindow: (id: string) => void;
    updateWindow: (id: string, updates: Partial<WindowState>) => void;
    focusWindow: (id: string) => void;
    setMode: (id: string, mode: WindowMode) => void;
    togglePin: (id: string, canvasId?: string) => void;
    hydrateWindow: (windowState: WindowState) => void;
}

export const useWindowStore = create<WindowStoreState>((set, get) => ({
    windows: {},
    focusedWindowId: null,
    highestZIndex: 10,

    openWindow: (entityId, x = 100, y = 100) => {
        const { windows, highestZIndex, focusWindow } = get();
        const existing = windows[entityId];

        if (existing) {
            if (existing.isPinned) {
                const canvasState = useCanvasStore.getState();
                if (existing.canvasId === canvasState.activeCanvasId) {
                    // SAME canvas: ALWAYS pan camera to the pinned window, then focus it
                    const scale = canvasState.scale;
                    const vw = globalThis.innerWidth;
                    const vh = globalThis.innerHeight;
                    canvasState.setTransform(
                        scale,
                        vw / 2 - existing.x * scale,
                        vh / 2 - existing.y * scale
                    );
                    // Also update Konva Stage directly (no render delay)
                    (window as any).__vibeSetStageCamera?.(scale, vw / 2 - existing.x * scale, vh / 2 - existing.y * scale);
                    // Focus even if already focused (force zIndex bump for visual feedback)
                    const newZIndex = highestZIndex + 1;
                    set({
                        windows: {
                            ...windows,
                            [entityId]: { ...existing, zIndex: newZIndex },
                        },
                        focusedWindowId: entityId,
                        highestZIndex: newZIndex,
                    });
                    return;
                } else {
                    // DIFFERENT canvas: open a new unpinned window on the screen
                    // Use a unique ID so it doesn't conflict with the pinned one
                    const tempId = `${entityId}_screen`;
                    if (windows[tempId]) {
                        focusWindow(tempId);
                        return;
                    }
                    const newZIndex = highestZIndex + 1;
                    set({
                        windows: {
                            ...windows,
                            [tempId]: {
                                id: tempId,
                                entityId,
                                mode: 'compact',
                                x,
                                y,
                                width: 400,
                                height: 300,
                                zIndex: newZIndex,
                                isPinned: false,
                            },
                        },
                        focusedWindowId: tempId,
                        highestZIndex: newZIndex,
                    });
                    return;
                }
            } else {
                // Not pinned, just focus
                focusWindow(entityId);
                return;
            }
        }

        const newZIndex = highestZIndex + 1;
        set({
            windows: {
                ...windows,
                [entityId]: {
                    id: entityId,
                    entityId,
                    mode: 'compact',
                    x,
                    y,
                    width: 400,
                    height: 300,
                    zIndex: newZIndex,
                    isPinned: false,
                },
            },
            focusedWindowId: entityId,
            highestZIndex: newZIndex,
        });
    },

    closeWindow: (id) => {
        const { windows, focusedWindowId } = get();
        const newWindows = { ...windows };
        delete newWindows[id];
        set({
            windows: newWindows,
            focusedWindowId: focusedWindowId === id ? null : focusedWindowId,
        });
    },

    updateWindow: (id, updates) => {
        const { windows } = get();
        if (!windows[id]) return;
        set({
            windows: {
                ...windows,
                [id]: { ...windows[id], ...updates },
            },
        });
    },

    focusWindow: (id) => {
        const { windows, highestZIndex, focusedWindowId } = get();
        if (!windows[id] || focusedWindowId === id) return;

        // Only bump zIndex if we actually change focus
        const newZIndex = highestZIndex + 1;
        set({
            windows: {
                ...windows,
                [id]: { ...windows[id], zIndex: newZIndex },
            },
            focusedWindowId: id,
            highestZIndex: newZIndex,
        });
    },

    setMode: (id, mode) => {
        const { windows } = get();
        const win = windows[id];
        if (!win) return;

        set({
            windows: {
                ...windows,
                [id]: { ...win, mode },
            },
        });
    },

    togglePin: (id, canvasId) => {
        const { windows } = get();
        const win = windows[id];
        if (!win) return;

        const isPinned = !win.isPinned;

        set({
            windows: {
                ...windows,
                [id]: { ...win, isPinned, canvasId: isPinned ? canvasId : undefined },
            },
        });
    },

    hydrateWindow: (windowState) => {
        const { windows, highestZIndex } = get();
        if (windows[windowState.id]) return;

        const zIndex = windowState.zIndex || (highestZIndex + 1);
        set({
            windows: {
                ...windows,
                [windowState.id]: {
                    ...windowState,
                    zIndex
                }
            },
            highestZIndex: Math.max(highestZIndex, zIndex)
        });
    }
}));

// ─── localStorage persistence for window layout ───

const WINDOW_STORAGE_PREFIX = 'vibe-ttrpg-windows-';
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _currentRoom: string | null = null;

/**
 * Save current window layout to localStorage (debounced).
 */
function scheduleSave(): void {
    if (!_currentRoom) return;
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
        if (!_currentRoom) return;
        const { windows, highestZIndex } = useWindowStore.getState();
        const data = JSON.stringify({ windows, highestZIndex });
        try {
            localStorage.setItem(WINDOW_STORAGE_PREFIX + _currentRoom, data);
        } catch { /* localStorage full — ignore */ }
    }, 1000);
}

// Subscribe to store changes for auto-save
useWindowStore.subscribe(scheduleSave);

/**
 * Load window layout for a specific room from localStorage.
 * Call this when joining a room.
 */
export function loadWindowLayout(roomName: string): void {
    _currentRoom = roomName;
    try {
        const data = localStorage.getItem(WINDOW_STORAGE_PREFIX + roomName);
        if (data) {
            const parsed = JSON.parse(data);
            if (parsed?.windows && typeof parsed.windows === 'object') {
                useWindowStore.setState({
                    windows: parsed.windows,
                    highestZIndex: parsed.highestZIndex || 10,
                });
                console.log(`🪟 Restored ${Object.keys(parsed.windows).length} windows from last session`);
            }
        }
    } catch {
        // Corrupt data — ignore
    }
}

/**
 * Clear saved window layout (e.g., when leaving a room).
 */
export function clearWindowLayout(): void {
    if (_currentRoom) {
        // Don't delete — we WANT to restore next time
        // Just stop tracking
        _currentRoom = null;
    }
    if (_saveTimer) {
        clearTimeout(_saveTimer);
        _saveTimer = null;
    }
}
