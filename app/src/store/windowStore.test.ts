import assert from 'node:assert/strict';
import {
    deleteNamedWindowLayoutSnapshot,
    listNamedWindowLayoutSnapshots,
    loadWindowLayout,
    resetCurrentWindowLayout,
    restoreNamedWindowLayoutSnapshot,
    saveNamedWindowLayoutSnapshot,
    useWindowStore,
} from './windowStore';

class MemoryStorage {
    private data = new Map<string, string>();

    getItem(key: string): string | null {
        return this.data.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.data.set(key, value);
    }

    removeItem(key: string): void {
        this.data.delete(key);
    }
}

Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
});

function resetWindowStore(): void {
    useWindowStore.setState({
        windows: {},
        focusedWindowId: null,
        highestZIndex: 10,
    });
}

resetWindowStore();

useWindowStore.getState().openWindow('entity-1', 100, 120);
let state = useWindowStore.getState();
assert.equal(Object.keys(state.windows).length, 1);
assert.equal(state.windows['entity-1']?.isPinned, false);
assert.equal(state.focusedWindowId, 'entity-1');

useWindowStore.setState({
    windows: {
        ...state.windows,
        'canvas-window-1': {
            id: 'canvas-window-1',
            entityId: 'entity-1',
            mode: 'compact',
            x: 40,
            y: 50,
            width: 320,
            height: 240,
            zIndex: 20,
            isPinned: true,
            canvasId: 'canvas-1',
        },
    },
    highestZIndex: 20,
});

useWindowStore.getState().openWindow('entity-1', 300, 320);
state = useWindowStore.getState();
assert.equal(Object.values(state.windows).filter((win) => !win.isPinned && win.entityId === 'entity-1').length, 1);
assert.equal(Object.values(state.windows).filter((win) => win.isPinned && win.entityId === 'entity-1').length, 1);
assert.equal(state.windows['entity-1']?.x, 100);
assert.equal(state.focusedWindowId, 'entity-1');

useWindowStore.setState({
    windows: {
        'entity-2': {
            id: 'entity-2',
            entityId: 'entity-2',
            mode: 'compact',
            x: 10,
            y: 10,
            width: 320,
            height: 240,
            zIndex: 11,
            isPinned: true,
            canvasId: 'canvas-1',
        },
    },
    focusedWindowId: 'entity-2',
    highestZIndex: 11,
});

useWindowStore.getState().openWindow('entity-2', 220, 240);
state = useWindowStore.getState();
assert.equal(Boolean(state.windows['entity-2']?.isPinned), true);
assert.equal(state.windows['entity-2_screen']?.isPinned, false);
assert.equal(state.windows['entity-2_screen']?.entityId, 'entity-2');
assert.equal(state.focusedWindowId, 'entity-2_screen');

loadWindowLayout('window-store-test');
resetWindowStore();
useWindowStore.getState().openWindow('entity-3', 100, 120);
useWindowStore.getState().openWindow('entity-4', 300, 340);

const savedSnapshot = saveNamedWindowLayoutSnapshot('Rules prep');
assert.ok(savedSnapshot);
assert.equal(savedSnapshot.name, 'Rules prep');
assert.equal(savedSnapshot.windowCount, 2);
assert.equal(listNamedWindowLayoutSnapshots().length, 1);

useWindowStore.getState().closeWindow('entity-3');
assert.equal(Object.values(useWindowStore.getState().windows).filter((win) => !win.isPinned).length, 1);

assert.equal(restoreNamedWindowLayoutSnapshot(savedSnapshot.id), true);
assert.equal(Object.values(useWindowStore.getState().windows).filter((win) => !win.isPinned).length, 2);

assert.equal(deleteNamedWindowLayoutSnapshot(savedSnapshot.id), true);
assert.equal(listNamedWindowLayoutSnapshots().length, 0);

loadWindowLayout('window-store-reset-test');
resetWindowStore();
useWindowStore.setState({
    windows: {
        screen: {
            id: 'screen',
            entityId: 'screen-entity',
            mode: 'compact',
            x: 10,
            y: 20,
            width: 320,
            height: 240,
            zIndex: 12,
            isPinned: false,
        },
        pinned: {
            id: 'pinned',
            entityId: 'pinned-entity',
            mode: 'compact',
            x: 40,
            y: 50,
            width: 320,
            height: 240,
            zIndex: 18,
            isPinned: true,
            canvasId: 'canvas-1',
        },
    },
    focusedWindowId: 'screen',
    highestZIndex: 18,
});
localStorage.setItem('vibe-ttrpg-windows-window-store-reset-test', '{"windows":{}}');
resetCurrentWindowLayout();
state = useWindowStore.getState();
assert.deepEqual(Object.keys(state.windows), ['pinned']);
assert.equal(state.focusedWindowId, null);
assert.equal(state.highestZIndex, 18);
assert.equal(localStorage.getItem('vibe-ttrpg-windows-window-store-reset-test'), null);

console.log('window store tests passed');
