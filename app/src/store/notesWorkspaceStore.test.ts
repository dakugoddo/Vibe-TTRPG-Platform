import assert from 'node:assert/strict';
import { listNotesWorkspaceGroups } from '../utils/notesWorkspaceLayout';
import {
    NOTES_WORKSPACE_LAYOUT_STORAGE_KEY,
    NOTES_WORKSPACE_SHELL_STORAGE_KEY,
    NOTES_WORKSPACE_SHELL_STORAGE_VERSION,
    normalizeStoredNotesWorkspaceShell,
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

useNotesWorkspaceStore.getState().openTabInNewLeaf('leaf-note-1');
let layout = useNotesWorkspaceStore.getState().layout;
let groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups.length, 1);
assert.deepEqual(groups[0].tabs.map((tab) => tab.entityId), ['leaf-note-1']);

useNotesWorkspaceStore.getState().openTabInNewLeaf('leaf-note-2', 'preview');
layout = useNotesWorkspaceStore.getState().layout;
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups.length, 1, 'Store entity-open reuses the active tab block');
assert.deepEqual(groups[0].tabs.map((tab) => tab.entityId), ['leaf-note-1', 'leaf-note-2']);
assert.equal(layout.activeGroupId, groups[0].id);
assert.equal(groups[0].tabs[1].view, 'preview');

useNotesWorkspaceStore.getState().openTabInNewLeaf('leaf-note-1', 'ui');
layout = useNotesWorkspaceStore.getState().layout;
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups.length, 1, 'Store entity-open reuses an existing entity tab');
assert.equal(layout.activeGroupId, groups[0].id);
assert.equal(groups[0].tabs[0].view, 'ui');

useNotesWorkspaceStore.getState().navigateBack();
layout = useNotesWorkspaceStore.getState().layout;
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups[0].tabs.find((tab) => tab.id === groups[0].activeTabId)?.entityId, 'leaf-note-2', 'Back returns to the previously active tab');
assert.equal(groups[0].tabs.find((tab) => tab.id === groups[0].activeTabId)?.view, 'preview');

useNotesWorkspaceStore.getState().navigateForward();
layout = useNotesWorkspaceStore.getState().layout;
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups[0].tabs.find((tab) => tab.id === groups[0].activeTabId)?.entityId, 'leaf-note-1', 'Forward returns to the tab/link visited after Back');
assert.equal(groups[0].tabs.find((tab) => tab.id === groups[0].activeTabId)?.view, 'ui');

useNotesWorkspaceStore.getState().splitActiveGroup('row');
layout = useNotesWorkspaceStore.getState().layout;
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups.length, 2, 'Manual split still creates a second tab block');
assert.equal(layout.activeGroupId, groups[1].id);
useNotesWorkspaceStore.getState().openTabInNewLeaf('leaf-note-3', 'source');
layout = useNotesWorkspaceStore.getState().layout;
groups = listNotesWorkspaceGroups(layout.root);
assert.deepEqual(groups.map((group) => group.tabs.map((tab) => tab.entityId)), [['leaf-note-1', 'leaf-note-2'], ['leaf-note-3']], 'Store opens new entities in the active tab block when several tab blocks exist');

useNotesWorkspaceStore.getState().openTabInNewLeaf('leaf-note-4', 'preview');
layout = useNotesWorkspaceStore.getState().layout;
groups = listNotesWorkspaceGroups(layout.root);
const storeSourceBlockId = groups[0].id;
const storeTargetBlockId = groups[1].id;
useNotesWorkspaceStore.getState().mergeGroup(storeSourceBlockId, storeTargetBlockId);
layout = useNotesWorkspaceStore.getState().layout;
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups.length, 1, 'Store group merge collapses the source block');
assert.deepEqual(
    groups[0].tabs.map((tab) => tab.entityId),
    ['leaf-note-3', 'leaf-note-4', 'leaf-note-1', 'leaf-note-2'],
    'Store group merge transfers every source tab into the target block'
);

store.resetLayout();

useNotesWorkspaceStore.getState().openTab('note-1');
layout = useNotesWorkspaceStore.getState().layout;
groups = listNotesWorkspaceGroups(layout.root);
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
assert.equal(groups.length, 1, 'Moving the last tab out of a pane collapses the empty source pane');
assert.deepEqual(groups[0].tabs.map((tab) => tab.entityId), ['note-1', 'character-1']);

useNotesWorkspaceStore.getState().setActiveTab(groups[0].id, 'missing-tab');
layout = useNotesWorkspaceStore.getState().layout;
assert.equal(layout.activeGroupId, groups[0].id, 'Missing source tab cannot steal focus');

useNotesWorkspaceStore.getState().closeTab(groups[0].id, groups[0].tabs[0].id);
groups = listNotesWorkspaceGroups(useNotesWorkspaceStore.getState().layout.root);
assert.equal(groups[0].tabs.length, 1);

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
assert.equal(groups.length, 1);
assert.deepEqual(groups[0].tabs.map((tab) => tab.entityId), ['character-1']);
assert.equal(useNotesWorkspaceStore.getState().shell.vaultWidth, 300);
assert.equal(useNotesWorkspaceStore.getState().shell.contextWidth, 320);
assert.equal(useNotesWorkspaceStore.getState().shell.audioHeight, 300);
assert.equal(useNotesWorkspaceStore.getState().shell.modules.editor, true);
assert.equal(useNotesWorkspaceStore.getState().shell.modules.vault, true);
assert.equal(useNotesWorkspaceStore.getState().shell.modules.context, true);
assert.equal(useNotesWorkspaceStore.getState().shell.modules.notifications, true);
assert.equal(useNotesWorkspaceStore.getState().shell.modules.search, false);
assert.equal(useNotesWorkspaceStore.getState().shell.modules.graph, false);
assert.equal(useNotesWorkspaceStore.getState().shell.modules.audio, false);
assert.equal(useNotesWorkspaceStore.getState().shell.moduleAreas.editor, 'center');
assert.equal(useNotesWorkspaceStore.getState().shell.moduleAreas.vault, 'left');
assert.equal(useNotesWorkspaceStore.getState().shell.moduleAreas.context, 'right');
assert.equal(useNotesWorkspaceStore.getState().shell.moduleLayouts.left, 'column');
assert.equal(useNotesWorkspaceStore.getState().shell.moduleLayouts.center, 'column');
assert.equal(useNotesWorkspaceStore.getState().shell.moduleLayouts.right, 'column');

useNotesWorkspaceStore.getState().toggleShellModule('editor');
assert.equal(useNotesWorkspaceStore.getState().shell.modules.editor, true, 'Editor module is required and cannot be disabled');
useNotesWorkspaceStore.getState().setShellModuleVisible('editor', false);
assert.equal(useNotesWorkspaceStore.getState().shell.modules.editor, true, 'Editor visibility ignores shell toggle calls');
useNotesWorkspaceStore.getState().moveShellModule('editor', 'right', 'context');
assert.equal(useNotesWorkspaceStore.getState().shell.moduleAreas.editor, 'right');
assert(useNotesWorkspaceStore.getState().shell.moduleOrder.editor < useNotesWorkspaceStore.getState().shell.moduleOrder.context);
useNotesWorkspaceStore.getState().moveShellModule('editor', 'center');
assert.equal(useNotesWorkspaceStore.getState().shell.moduleAreas.editor, 'center');

useNotesWorkspaceStore.getState().toggleShellModule('audio');
useNotesWorkspaceStore.getState().setShellAudioHeight(900);
useNotesWorkspaceStore.getState().moveShellModule('search', 'left', 'vault');
assert.equal(useNotesWorkspaceStore.getState().shell.moduleAreas.search, 'left');
assert(useNotesWorkspaceStore.getState().shell.moduleOrder.search < useNotesWorkspaceStore.getState().shell.moduleOrder.vault);
assert.equal(useNotesWorkspaceStore.getState().shell.moduleLayouts.left, 'column');
useNotesWorkspaceStore.getState().moveShellModule('search', 'center', null, 'row');
assert.equal(useNotesWorkspaceStore.getState().shell.moduleAreas.search, 'center');
assert.equal(useNotesWorkspaceStore.getState().shell.moduleLayouts.center, 'row');

const persistedShell = globalThis.localStorage.getItem(NOTES_WORKSPACE_SHELL_STORAGE_KEY);
assert.ok(persistedShell);
assert.ok(persistedShell.includes(`"version":${NOTES_WORKSPACE_SHELL_STORAGE_VERSION}`));
assert.ok(persistedShell.includes('"contextWidth":320'));
assert.ok(persistedShell.includes('"audioHeight":520'));
assert.ok(persistedShell.includes('"audio":true'));
assert.ok(persistedShell.includes('"moduleAreas"'));
assert.ok(persistedShell.includes('"moduleLayouts"'));

const migratedLegacyShell = normalizeStoredNotesWorkspaceShell({
    modules: {
        editor: false,
        vault: false,
        context: true,
        notifications: false,
        search: true,
        graph: true,
        audio: true,
    },
    moduleAreas: {
        editor: 'right',
        vault: 'right',
        context: 'left',
        notifications: 'center',
        search: 'center',
        graph: 'left',
        audio: 'center',
    },
    moduleOrder: {
        editor: 900,
        vault: 10,
        context: 20,
        notifications: 30,
        search: 40,
        graph: 50,
        audio: 60,
    },
    vaultWidth: 120,
    contextWidth: 900,
    audioHeight: 900,
});
assert.equal(migratedLegacyShell.modules.editor, true, 'Legacy storage cannot disable the required editor');
assert.equal(migratedLegacyShell.modules.vault, false, 'Legacy storage keeps toggleable module visibility');
assert.equal(migratedLegacyShell.modules.search, true, 'Legacy storage keeps enabled optional modules');
assert.equal(migratedLegacyShell.moduleAreas.editor, 'center', 'Legacy storage resets broken editor area');
assert.equal(migratedLegacyShell.moduleAreas.vault, 'left', 'Legacy storage resets broken vault area');
assert.equal(migratedLegacyShell.moduleAreas.context, 'right', 'Legacy storage resets broken context area');
assert.equal(migratedLegacyShell.moduleAreas.audio, 'bottom', 'Legacy storage resets broken bottom module area');
assert.equal(migratedLegacyShell.moduleLayouts.left, 'column');
assert.equal(migratedLegacyShell.moduleLayouts.center, 'column');
assert.equal(migratedLegacyShell.moduleLayouts.right, 'column');
assert.equal(migratedLegacyShell.vaultWidth, 220);
assert.equal(migratedLegacyShell.contextWidth, 460);
assert.equal(migratedLegacyShell.audioHeight, 520);

const migratedV2Shell = normalizeStoredNotesWorkspaceShell({
    version: 2,
    modules: {
        editor: true,
        vault: true,
        context: true,
        notifications: true,
        search: true,
        graph: false,
        audio: false,
    },
    moduleAreas: {
        editor: 'right',
        vault: 'center',
        context: 'left',
        notifications: 'right',
        search: 'center',
        graph: 'right',
        audio: 'bottom',
    },
    moduleOrder: {
        editor: 10,
        vault: 20,
        context: 30,
        notifications: 40,
        search: 50,
        graph: 60,
        audio: 70,
    },
    moduleLayouts: {
        left: 'row',
        center: 'row',
        right: 'row',
    },
});
assert.equal(migratedV2Shell.moduleAreas.editor, 'right', 'v2 storage keeps intentional shell placement');
assert.equal(migratedV2Shell.moduleLayouts.left, 'column', 'v2 storage defaults shell area layout');
assert.equal(migratedV2Shell.moduleLayouts.center, 'column', 'v2 storage defaults shell area layout');
assert.equal(migratedV2Shell.moduleLayouts.right, 'column', 'v2 storage defaults shell area layout');

const restoredVersionedShell = normalizeStoredNotesWorkspaceShell({
    version: NOTES_WORKSPACE_SHELL_STORAGE_VERSION,
    modules: {
        editor: true,
        vault: true,
        context: true,
        notifications: true,
        search: true,
        graph: false,
        audio: false,
    },
    moduleAreas: {
        editor: 'right',
        vault: 'center',
        context: 'left',
        notifications: 'right',
        search: 'center',
        graph: 'right',
        audio: 'bottom',
    },
    moduleOrder: {
        editor: 10,
        vault: 20,
        context: 30,
        notifications: 40,
        search: 50,
        graph: 60,
        audio: 70,
    },
    moduleLayouts: {
        left: 'row',
        center: 'column',
        right: 'row',
    },
});
assert.equal(restoredVersionedShell.moduleAreas.editor, 'right', 'Current storage keeps intentional editor moves');
assert.equal(restoredVersionedShell.moduleAreas.vault, 'center', 'Current storage keeps intentional vault moves');
assert.equal(restoredVersionedShell.moduleAreas.context, 'left', 'Current storage keeps intentional context moves');
assert.equal(restoredVersionedShell.moduleLayouts.left, 'row', 'Current storage keeps intentional side-by-side shell layout');
assert.equal(restoredVersionedShell.moduleLayouts.center, 'column');
assert.equal(restoredVersionedShell.moduleLayouts.right, 'row');

console.log('notes workspace store tests passed');
