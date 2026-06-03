import { create } from 'zustand';
import {
    getScreenWindowLayoutBounds,
    getWindowCascadeLayoutRects,
    getWindowGridLayoutRects,
    getWindowLayoutRect,
    type WindowLayoutPreset,
} from '../utils/windowLayout';

export type { WindowLayoutPreset } from '../utils/windowLayout';

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
    tileWindow: (id: string, preset: WindowLayoutPreset) => void;
    arrangeVisibleWindowsGrid: () => void;
    cascadeVisibleWindows: () => void;
    hydrateWindow: (windowState: WindowState) => void;
}

function getCurrentLayoutBounds() {
    return getScreenWindowLayoutBounds(globalThis.innerWidth ?? 1200, globalThis.innerHeight ?? 800);
}

function getLayoutTargets(windows: Record<string, WindowState>): WindowState[] {
    return Object.values(windows)
        .filter((win) => !win.isPinned)
        .sort((a, b) => a.zIndex - b.zIndex);
}

function ensureLayoutMode(win: WindowState): WindowMode {
    return win.mode === 'icon' ? 'compact' : win.mode;
}

function findScreenWindowForEntity(windows: Record<string, WindowState>, entityId: string): WindowState | undefined {
    return Object.values(windows)
        .filter((win) => !win.isPinned && win.entityId === entityId)
        .sort((a, b) => b.zIndex - a.zIndex)[0];
}

function getScreenWindowId(entityId: string, windows: Record<string, WindowState>): string {
    const existingByEntityId = windows[entityId];
    if (!existingByEntityId || !existingByEntityId.isPinned) return entityId;

    return `${entityId}_screen`;
}

export const useWindowStore = create<WindowStoreState>((set, get) => ({
    windows: {},
    focusedWindowId: null,
    highestZIndex: 10,

    openWindow: (entityId, x = 100, y = 100) => {
        const { windows, highestZIndex, focusWindow } = get();
        const existingScreenWindow = findScreenWindowForEntity(windows, entityId);

        if (existingScreenWindow) {
            focusWindow(existingScreenWindow.id);
            return;
        }

        const newZIndex = highestZIndex + 1;
        const screenWindowId = getScreenWindowId(entityId, windows);
        set({
            windows: {
                ...windows,
                [screenWindowId]: {
                    id: screenWindowId,
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
            focusedWindowId: screenWindowId,
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

    tileWindow: (id, preset) => {
        const { windows } = get();
        const win = windows[id];
        if (!win || win.isPinned) return;

        const rect = getWindowLayoutRect(preset, getCurrentLayoutBounds());
        set({
            windows: {
                ...windows,
                [id]: { ...win, ...rect, mode: ensureLayoutMode(win) },
            },
            focusedWindowId: id,
        });
    },

    arrangeVisibleWindowsGrid: () => {
        const { windows } = get();
        const targets = getLayoutTargets(windows);
        if (targets.length === 0) return;

        const rects = getWindowGridLayoutRects(targets.length, getCurrentLayoutBounds());
        const nextWindows = { ...windows };
        targets.forEach((win, index) => {
            nextWindows[win.id] = { ...win, ...rects[index], mode: ensureLayoutMode(win) };
        });
        set({ windows: nextWindows });
    },

    cascadeVisibleWindows: () => {
        const { windows } = get();
        const targets = getLayoutTargets(windows);
        if (targets.length === 0) return;

        const rects = getWindowCascadeLayoutRects(targets.length, getCurrentLayoutBounds());
        const nextWindows = { ...windows };
        targets.forEach((win, index) => {
            nextWindows[win.id] = { ...win, ...rects[index], mode: ensureLayoutMode(win) };
        });
        set({ windows: nextWindows });
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

function getWindowSnapshotStorageKey(): string {
    return `${WINDOW_STORAGE_PREFIX}${_currentRoom ?? 'local'}-screen-snapshot`;
}

export function saveCurrentWindowLayoutSnapshot(): boolean {
    const { windows, highestZIndex } = useWindowStore.getState();
    const screenWindows = Object.fromEntries(
        Object.entries(windows).filter(([, win]) => !win.isPinned)
    );

    try {
        localStorage.setItem(getWindowSnapshotStorageKey(), JSON.stringify({
            windows: screenWindows,
            highestZIndex,
            savedAt: new Date().toISOString(),
        }));
        return true;
    } catch {
        return false;
    }
}

export function restoreWindowLayoutSnapshot(): boolean {
    try {
        const data = localStorage.getItem(getWindowSnapshotStorageKey());
        if (!data) return false;
        const parsed = JSON.parse(data);
        if (!parsed?.windows || typeof parsed.windows !== 'object') return false;

        const current = useWindowStore.getState();
        const pinnedWindows = Object.fromEntries(
            Object.entries(current.windows).filter(([, win]) => win.isPinned)
        );
        useWindowStore.setState({
            windows: {
                ...pinnedWindows,
                ...parsed.windows,
            },
            highestZIndex: Math.max(current.highestZIndex, parsed.highestZIndex || 10),
        });
        return true;
    } catch {
        return false;
    }
}
