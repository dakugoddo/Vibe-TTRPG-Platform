import assert from 'node:assert/strict';
import { useWindowStore } from './windowStore';

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

console.log('window store tests passed');
