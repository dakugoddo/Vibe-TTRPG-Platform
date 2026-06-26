import assert from 'node:assert/strict';
import {
    DEFAULT_WORKSPACE_MODE,
    WORKSPACE_MODE_STORAGE_KEY,
    getNextWorkspaceMode,
    getStoredWorkspaceMode,
    normalizeWorkspaceMode,
    saveStoredWorkspaceMode,
} from './workspaceMode';

class MemoryStorage {
    private data = new Map<string, string>();

    getItem(key: string): string | null {
        return this.data.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.data.set(key, value);
    }
}

assert.equal(normalizeWorkspaceMode('canvas'), 'canvas');
assert.equal(normalizeWorkspaceMode('notes'), 'notes');
assert.equal(normalizeWorkspaceMode('unknown'), DEFAULT_WORKSPACE_MODE);
assert.equal(normalizeWorkspaceMode(null), DEFAULT_WORKSPACE_MODE);

assert.equal(getNextWorkspaceMode('canvas'), 'notes');
assert.equal(getNextWorkspaceMode('notes'), 'canvas');

const storage = new MemoryStorage();
assert.equal(getStoredWorkspaceMode(storage), 'canvas');
storage.setItem(WORKSPACE_MODE_STORAGE_KEY, 'notes');
assert.equal(getStoredWorkspaceMode(storage), 'notes');
assert.equal(saveStoredWorkspaceMode('canvas', storage), 'canvas');
assert.equal(storage.getItem(WORKSPACE_MODE_STORAGE_KEY), 'canvas');

console.log('workspaceMode tests passed');
