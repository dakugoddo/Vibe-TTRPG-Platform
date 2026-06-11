import assert from 'node:assert/strict';
import { listNotesWorkspaceGroups } from '../utils/notesWorkspaceLayout';
import {
    NOTES_WORKSPACE_LAYOUT_STORAGE_KEY,
    NOTES_WORKSPACE_SHELL_STORAGE_KEY,
    useNotesWorkspaceStore,
} from './notesWorkspaceStore';

class MemoryStorage {
    private data = new Map<string, string>();

    getItem(key: string): string | null {
        return this.data.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.data.set(key, value);
    }
}

Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
});

const store = useNotesWorkspaceStore.getState();
store.resetLayout();

useNotesWorkspaceStore.getState().openTab('note-1');
let layout = useNotesWorkspaceStore.getState().layout;
let groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups.length, 1);
assert.equal(groups[0].tabs.length, 1);
assert.equal(groups[0].tabs[0].entityId, 'note-1');
assert.equal(groups[0].tabs[0].view, 'source');

useNotesWorkspaceStore.getState().setTabView(groups[0].id, groups[0].tabs[0].id, 'preview');
layout = useNotesWorkspaceStore.getState().layout;
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups[0].tabs[0].view, 'preview');

useNotesWorkspaceStore.getState().splitActiveGroup('row');
layout = useNotesWorkspaceStore.getState().layout;
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups.length, 2);
assert.equal(layout.activeGroupId, groups[1].id);
assert.equal(layout.root.type, 'split');

useNotesWorkspaceStore.getState().resizeSplit(layout.root.id, 0.66);
layout = useNotesWorkspaceStore.getState().layout;
assert.equal(layout.root.type, 'split');
assert.equal(layout.root.ratio, 0.66);

useNotesWorkspaceStore.getState().openTab('character-1');
layout = useNotesWorkspaceStore.getState().layout;
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups[1].tabs.length, 1);
assert.equal(groups[1].tabs[0].entityId, 'character-1');

useNotesWorkspaceStore.getState().moveTab(groups[0].id, groups[0].tabs[0].id, groups[1].id, groups[1].tabs[0].id);
layout = useNotesWorkspaceStore.getState().layout;
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups[0].tabs.length, 0);
assert.deepEqual(groups[1].tabs.map((tab) => tab.entityId), ['note-1', 'character-1']);

useNotesWorkspaceStore.getState().setActiveTab(groups[0].id, 'missing-tab');
layout = useNotesWorkspaceStore.getState().layout;
assert.equal(layout.activeGroupId, groups[1].id, 'Missing source tab cannot steal focus');

useNotesWorkspaceStore.getState().closeTab(groups[1].id, groups[1].tabs[0].id);
groups = listNotesWorkspaceGroups(useNotesWorkspaceStore.getState().layout.root);
assert.equal(groups[1].tabs.length, 1);

const persistedLayout = globalThis.localStorage.getItem(NOTES_WORKSPACE_LAYOUT_STORAGE_KEY);
assert.ok(persistedLayout);
assert.ok(persistedLayout.includes('character-1'));

useNotesWorkspaceStore.getState().toggleShellModule('vault');
assert.equal(useNotesWorkspaceStore.getState().shell.modules.vault, false);

useNotesWorkspaceStore.getState().setShellModuleVisible('vault', true);
assert.equal(useNotesWorkspaceStore.getState().shell.modules.vault, true);

useNotesWorkspaceStore.getState().setShellModuleWidth('vault', 120);
assert.equal(useNotesWorkspaceStore.getState().shell.vaultWidth, 220);

useNotesWorkspaceStore.getState().setShellModuleWidth('context', 900);
assert.equal(useNotesWorkspaceStore.getState().shell.contextWidth, 460);

useNotesWorkspaceStore.getState().toggleShellModule('audio');
assert.equal(useNotesWorkspaceStore.getState().shell.modules.audio, true);

useNotesWorkspaceStore.getState().setShellAudioHeight(120);
assert.equal(useNotesWorkspaceStore.getState().shell.audioHeight, 180);

useNotesWorkspaceStore.getState().setShellAudioHeight(900);
assert.equal(useNotesWorkspaceStore.getState().shell.audioHeight, 520);

useNotesWorkspaceStore.getState().resetShell();
groups = listNotesWorkspaceGroups(useNotesWorkspaceStore.getState().layout.root);
assert.equal(groups.length, 2);
assert.deepEqual(groups[1].tabs.map((tab) => tab.entityId), ['character-1']);
assert.equal(useNotesWorkspaceStore.getState().shell.vaultWidth, 300);
assert.equal(useNotesWorkspaceStore.getState().shell.contextWidth, 320);
assert.equal(useNotesWorkspaceStore.getState().shell.audioHeight, 300);
assert.equal(useNotesWorkspaceStore.getState().shell.modules.vault, true);
assert.equal(useNotesWorkspaceStore.getState().shell.modules.context, true);
assert.equal(useNotesWorkspaceStore.getState().shell.modules.notifications, true);
assert.equal(useNotesWorkspaceStore.getState().shell.modules.search, false);
assert.equal(useNotesWorkspaceStore.getState().shell.modules.graph, false);
assert.equal(useNotesWorkspaceStore.getState().shell.modules.audio, false);

useNotesWorkspaceStore.getState().toggleShellModule('audio');
useNotesWorkspaceStore.getState().setShellAudioHeight(900);

const persistedShell = globalThis.localStorage.getItem(NOTES_WORKSPACE_SHELL_STORAGE_KEY);
assert.ok(persistedShell);
assert.ok(persistedShell.includes('"contextWidth":320'));
assert.ok(persistedShell.includes('"audioHeight":520'));
assert.ok(persistedShell.includes('"audio":true'));

console.log('notes workspace store tests passed');
