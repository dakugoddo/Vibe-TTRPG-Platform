import { create } from 'zustand';
import {
    closeNotesWorkspaceTab,
    createEmptyNotesWorkspaceLayout,
    listNotesWorkspaceGroups,
    moveNotesWorkspaceTab,
    openNotesWorkspaceTab,
    setActiveNotesWorkspaceGroup,
    setActiveNotesWorkspaceTab,
    splitActiveNotesWorkspaceGroup,
    type NotesWorkspaceLayout,
    type NotesWorkspaceNode,
    type NotesWorkspaceSplitNode,
    type NotesWorkspaceTab,
    type NotesWorkspaceView,
} from '../utils/notesWorkspaceLayout';

export const NOTES_WORKSPACE_LAYOUT_STORAGE_KEY = 'vibe-ttrpg-notes-workspace-layout-v1';

interface NotesWorkspaceStoreState {
    layout: NotesWorkspaceLayout;
    openTab: (entityId: string, view?: NotesWorkspaceView) => void;
    closeTab: (groupId: string, tabId: string) => void;
    moveTab: (sourceGroupId: string, tabId: string, targetGroupId: string, beforeTabId?: string | null) => void;
    setActiveGroup: (groupId: string) => void;
    setActiveTab: (groupId: string, tabId: string) => void;
    splitActiveGroup: (direction: NotesWorkspaceSplitNode['direction']) => void;
    resetLayout: () => void;
}

const NOTES_WORKSPACE_VIEWS = new Set<NotesWorkspaceView>(['entity', 'markdown', 'graph', 'backlinks', 'outline']);

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isTab(value: unknown): value is NotesWorkspaceTab {
    return isRecord(value)
        && typeof value.id === 'string'
        && typeof value.entityId === 'string'
        && typeof value.view === 'string'
        && NOTES_WORKSPACE_VIEWS.has(value.view as NotesWorkspaceView)
        && (value.pinned === undefined || typeof value.pinned === 'boolean');
}

function isNode(value: unknown): value is NotesWorkspaceNode {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string') return false;

    if (value.type === 'tabs') {
        return (typeof value.activeTabId === 'string' || value.activeTabId === null)
            && Array.isArray(value.tabs)
            && value.tabs.every(isTab);
    }

    if (value.type === 'split') {
        return (value.direction === 'row' || value.direction === 'column')
            && typeof value.ratio === 'number'
            && Number.isFinite(value.ratio)
            && Array.isArray(value.children)
            && value.children.length === 2
            && isNode(value.children[0])
            && isNode(value.children[1]);
    }

    return false;
}

function readStoredNotesWorkspaceLayout(): NotesWorkspaceLayout | null {
    try {
        const data = globalThis.localStorage?.getItem(NOTES_WORKSPACE_LAYOUT_STORAGE_KEY);
        if (!data) return null;

        const parsed = JSON.parse(data);
        if (!isRecord(parsed) || parsed.version !== 1 || typeof parsed.activeGroupId !== 'string' || !isNode(parsed.root)) {
            return null;
        }

        const layout: NotesWorkspaceLayout = {
            version: 1,
            root: parsed.root,
            activeGroupId: parsed.activeGroupId,
        };
        const groups = listNotesWorkspaceGroups(layout.root);
        if (groups.length === 0) return null;
        if (groups.some((group) => group.id === layout.activeGroupId)) return layout;

        return {
            ...layout,
            activeGroupId: groups[0].id,
        };
    } catch {
        return null;
    }
}

function writeStoredNotesWorkspaceLayout(layout: NotesWorkspaceLayout): void {
    try {
        globalThis.localStorage?.setItem(NOTES_WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch {
        // Local UI state should not break the workspace if storage is unavailable.
    }
}

export const useNotesWorkspaceStore = create<NotesWorkspaceStoreState>((set) => ({
    layout: readStoredNotesWorkspaceLayout() ?? createEmptyNotesWorkspaceLayout(),

    openTab: (entityId, view = 'entity') => set((state) => ({
        layout: openNotesWorkspaceTab(state.layout, { entityId, view }),
    })),

    closeTab: (groupId, tabId) => set((state) => ({
        layout: closeNotesWorkspaceTab(state.layout, groupId, tabId),
    })),

    moveTab: (sourceGroupId, tabId, targetGroupId, beforeTabId) => set((state) => ({
        layout: moveNotesWorkspaceTab(state.layout, sourceGroupId, tabId, targetGroupId, beforeTabId),
    })),

    setActiveGroup: (groupId) => set((state) => ({
        layout: setActiveNotesWorkspaceGroup(state.layout, groupId),
    })),

    setActiveTab: (groupId, tabId) => set((state) => ({
        layout: setActiveNotesWorkspaceTab(state.layout, groupId, tabId),
    })),

    splitActiveGroup: (direction) => set((state) => ({
        layout: splitActiveNotesWorkspaceGroup(state.layout, direction),
    })),

    resetLayout: () => set({ layout: createEmptyNotesWorkspaceLayout() }),
}));

useNotesWorkspaceStore.subscribe((state) => {
    writeStoredNotesWorkspaceLayout(state.layout);
});
