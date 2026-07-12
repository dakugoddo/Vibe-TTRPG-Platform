import { create } from 'zustand';
import {
    closeNotesWorkspaceGroup,
    closeNotesWorkspaceTab,
    createEmptyNotesWorkspaceLayout,
    listNotesWorkspaceGroups,
    mergeNotesWorkspaceGroups,
    moveNotesWorkspaceTab,
    openNotesWorkspaceTab,
    openNotesWorkspaceTabInNewLeaf,
    setActiveNotesWorkspaceGroup,
    setActiveNotesWorkspaceTab,
    setNotesWorkspaceSplitRatio,
    setNotesWorkspaceTabView,
    splitActiveNotesWorkspaceGroup,
    splitNotesWorkspaceGroupFromTab,
    type NotesWorkspaceLayout,
    type NotesWorkspaceNode,
    type NotesWorkspaceSplitNode,
    type NotesWorkspaceSplitPlacement,
    type NotesWorkspaceTab,
    type NotesWorkspaceView,
} from '../utils/notesWorkspaceLayout';
import {
    canToggleNotesShellModule,
    getDefaultNotesShellAreaLayouts,
    getDefaultNotesShellModuleAreas,
    getDefaultNotesShellModuleOrder,
    isNotesWorkspaceDockArea,
    isNotesWorkspaceShellAreaLayout,
    listImplementedNotesShellModules,
    type NotesWorkspaceShellAreaLayout,
    type NotesWorkspaceShellAreaLayouts,
    type NotesWorkspaceDockArea,
    type NotesWorkspaceShellModuleAreas,
    type NotesWorkspaceShellModuleId,
    type NotesWorkspaceShellModuleOrder,
    type NotesWorkspaceShellVisibility,
} from '../utils/notesWorkspaceModules';
import {
    createEmptyNotesWorkspaceNavigationHistory,
    getNotesWorkspaceNavigationDirection,
    recordNotesWorkspaceNavigation,
    type NotesWorkspaceNavigationEntry,
    type NotesWorkspaceNavigationHistory,
} from '../utils/notesWorkspaceNavigationHistory';

export const NOTES_WORKSPACE_LAYOUT_STORAGE_KEY = 'vibe-ttrpg-notes-workspace-layout-v1';
export const NOTES_WORKSPACE_SHELL_STORAGE_KEY = 'vibe-ttrpg-notes-workspace-shell-v1';
export const NOTES_WORKSPACE_SHELL_STORAGE_VERSION = 3;

export interface NotesWorkspaceShellState {
    vaultWidth: number;
    contextWidth: number;
    audioHeight: number;
    modules: NotesWorkspaceShellVisibility;
    moduleAreas: NotesWorkspaceShellModuleAreas;
    moduleOrder: NotesWorkspaceShellModuleOrder;
    moduleLayouts: NotesWorkspaceShellAreaLayouts;
}

interface NotesWorkspaceStoreState {
    layout: NotesWorkspaceLayout;
    shell: NotesWorkspaceShellState;
    navigationHistory: NotesWorkspaceNavigationHistory;
    openTab: (entityId: string, view?: NotesWorkspaceView) => void;
    openTabInNewLeaf: (entityId: string, view?: NotesWorkspaceView) => void;
    closeTab: (groupId: string, tabId: string) => void;
    closeGroup: (groupId: string) => void;
    mergeGroup: (sourceGroupId: string, targetGroupId: string) => void;
    moveTab: (sourceGroupId: string, tabId: string, targetGroupId: string, beforeTabId?: string | null) => void;
    splitTabToGroup: (
        sourceGroupId: string,
        tabId: string,
        targetGroupId: string,
        direction: NotesWorkspaceSplitNode['direction'],
        placement: NotesWorkspaceSplitPlacement
    ) => void;
    resizeSplit: (splitId: string, ratio: number) => void;
    setActiveGroup: (groupId: string) => void;
    setActiveTab: (groupId: string, tabId: string) => void;
    setTabView: (groupId: string, tabId: string, view: NotesWorkspaceView) => void;
    navigateBack: () => void;
    navigateForward: () => void;
    splitActiveGroup: (direction: NotesWorkspaceSplitNode['direction']) => void;
    setShellModuleVisible: (moduleId: NotesWorkspaceShellModuleId, isVisible: boolean) => void;
    toggleShellModule: (moduleId: NotesWorkspaceShellModuleId) => void;
    moveShellModule: (moduleId: NotesWorkspaceShellModuleId, area: NotesWorkspaceDockArea, beforeModuleId?: NotesWorkspaceShellModuleId | null, layout?: NotesWorkspaceShellAreaLayout) => void;
    setShellModuleWidth: (moduleId: 'vault' | 'context', width: number) => void;
    setShellAudioHeight: (height: number) => void;
    resetShell: () => void;
    resetLayout: () => void;
}

const NOTES_WORKSPACE_VIEWS = new Set<NotesWorkspaceView>(['source', 'preview', 'split', 'ui', 'entity', 'graph', 'backlinks', 'outline']);
const MIN_SHELL_MODULE_WIDTH = 220;
const MAX_SHELL_MODULE_WIDTH = 460;
const MIN_AUDIO_MODULE_HEIGHT = 180;
const MAX_AUDIO_MODULE_HEIGHT = 520;

const DEFAULT_NOTES_WORKSPACE_SHELL: NotesWorkspaceShellState = {
    vaultWidth: 300,
    contextWidth: 320,
    audioHeight: 300,
    modules: Object.fromEntries(
        listImplementedNotesShellModules().map((module) => [module.id, module.defaultVisible])
    ) as NotesWorkspaceShellVisibility,
    moduleAreas: getDefaultNotesShellModuleAreas(),
    moduleOrder: getDefaultNotesShellModuleOrder(),
    moduleLayouts: getDefaultNotesShellAreaLayouts(),
};

function createDefaultNotesWorkspaceShell(): NotesWorkspaceShellState {
    return {
        ...DEFAULT_NOTES_WORKSPACE_SHELL,
        modules: { ...DEFAULT_NOTES_WORKSPACE_SHELL.modules },
        moduleAreas: { ...DEFAULT_NOTES_WORKSPACE_SHELL.moduleAreas },
        moduleOrder: { ...DEFAULT_NOTES_WORKSPACE_SHELL.moduleOrder },
        moduleLayouts: { ...DEFAULT_NOTES_WORKSPACE_SHELL.moduleLayouts },
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isTab(value: unknown): value is NotesWorkspaceTab {
    return isRecord(value)
        && typeof value.id === 'string'
        && typeof value.entityId === 'string'
        && typeof value.view === 'string'
        && (NOTES_WORKSPACE_VIEWS.has(value.view as NotesWorkspaceView) || value.view === 'markdown')
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

function migrateLegacyNotesWorkspaceViews(node: NotesWorkspaceNode): NotesWorkspaceNode {
    if (node.type === 'split') {
        return {
            ...node,
            children: [
                migrateLegacyNotesWorkspaceViews(node.children[0]),
                migrateLegacyNotesWorkspaceViews(node.children[1]),
            ] as [NotesWorkspaceNode, NotesWorkspaceNode],
        };
    }

    return {
        ...node,
        tabs: node.tabs.map((tab) => ({
            ...tab,
            view: (tab.view as string) === 'markdown' ? 'preview' : tab.view,
        })),
    };
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
            root: migrateLegacyNotesWorkspaceViews(parsed.root),
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

function clampShellModuleWidth(width: unknown, fallback: number): number {
    if (typeof width !== 'number' || !Number.isFinite(width)) return fallback;
    return Math.min(MAX_SHELL_MODULE_WIDTH, Math.max(MIN_SHELL_MODULE_WIDTH, width));
}

function clampAudioModuleHeight(height: unknown, fallback: number): number {
    if (typeof height !== 'number' || !Number.isFinite(height)) return fallback;
    return Math.min(MAX_AUDIO_MODULE_HEIGHT, Math.max(MIN_AUDIO_MODULE_HEIGHT, height));
}

export function normalizeStoredNotesWorkspaceShell(parsed: unknown): NotesWorkspaceShellState {
    if (!isRecord(parsed) || !isRecord(parsed.modules)) return createDefaultNotesWorkspaceShell();

    const shouldUseStoredModulePlacement = parsed.version === NOTES_WORKSPACE_SHELL_STORAGE_VERSION || parsed.version === 2;
    const shouldUseStoredAreaLayouts = parsed.version === NOTES_WORKSPACE_SHELL_STORAGE_VERSION;
    const modules = { ...DEFAULT_NOTES_WORKSPACE_SHELL.modules };
    const moduleAreas = { ...DEFAULT_NOTES_WORKSPACE_SHELL.moduleAreas };
    const moduleOrder = { ...DEFAULT_NOTES_WORKSPACE_SHELL.moduleOrder };
    const moduleLayouts = { ...DEFAULT_NOTES_WORKSPACE_SHELL.moduleLayouts };
    for (const module of listImplementedNotesShellModules()) {
        const storedVisibility = parsed.modules[module.id];
        modules[module.id] = module.canToggle && typeof storedVisibility === 'boolean'
            ? storedVisibility
            : module.defaultVisible;

        const storedArea = shouldUseStoredModulePlacement && isRecord(parsed.moduleAreas)
            ? parsed.moduleAreas[module.id]
            : undefined;
        moduleAreas[module.id] = isNotesWorkspaceDockArea(storedArea) ? storedArea : module.defaultArea;

        const storedOrder = shouldUseStoredModulePlacement && isRecord(parsed.moduleOrder)
            ? parsed.moduleOrder[module.id]
            : undefined;
        moduleOrder[module.id] = typeof storedOrder === 'number' && Number.isFinite(storedOrder)
            ? storedOrder
            : module.order;
    }

    if (shouldUseStoredAreaLayouts && isRecord(parsed.moduleLayouts)) {
        for (const area of Object.keys(moduleLayouts) as Array<keyof NotesWorkspaceShellAreaLayouts>) {
            const storedLayout = parsed.moduleLayouts[area];
            moduleLayouts[area] = isNotesWorkspaceShellAreaLayout(storedLayout) ? storedLayout : moduleLayouts[area];
        }
    }

    return {
        vaultWidth: clampShellModuleWidth(parsed.vaultWidth, DEFAULT_NOTES_WORKSPACE_SHELL.vaultWidth),
        contextWidth: clampShellModuleWidth(parsed.contextWidth, DEFAULT_NOTES_WORKSPACE_SHELL.contextWidth),
        audioHeight: clampAudioModuleHeight(parsed.audioHeight, DEFAULT_NOTES_WORKSPACE_SHELL.audioHeight),
        modules,
        moduleAreas,
        moduleOrder,
        moduleLayouts,
    };
}

function readStoredNotesWorkspaceShell(): NotesWorkspaceShellState {
    try {
        const data = globalThis.localStorage?.getItem(NOTES_WORKSPACE_SHELL_STORAGE_KEY);
        if (!data) return createDefaultNotesWorkspaceShell();

        return normalizeStoredNotesWorkspaceShell(JSON.parse(data));
    } catch {
        return createDefaultNotesWorkspaceShell();
    }
}

function writeStoredNotesWorkspaceShell(shell: NotesWorkspaceShellState): void {
    try {
        globalThis.localStorage?.setItem(
            NOTES_WORKSPACE_SHELL_STORAGE_KEY,
            JSON.stringify({ version: NOTES_WORKSPACE_SHELL_STORAGE_VERSION, ...shell })
        );
    } catch {
        // Local UI state should not break the workspace if storage is unavailable.
    }
}

function getActiveNotesWorkspaceNavigationEntry(layout: NotesWorkspaceLayout): NotesWorkspaceNavigationEntry | null {
    const group = listNotesWorkspaceGroups(layout.root).find((candidate) => candidate.id === layout.activeGroupId)
        ?? listNotesWorkspaceGroups(layout.root)[0];
    const activeTab = group?.tabs.find((tab) => tab.id === group.activeTabId) ?? group?.tabs[0];
    if (!group || !activeTab) return null;
    return {
        groupId: group.id,
        tabId: activeTab.id,
        entityId: activeTab.entityId,
        view: activeTab.view,
    };
}

function focusNotesWorkspaceNavigationEntry(
    layout: NotesWorkspaceLayout,
    entry: NotesWorkspaceNavigationEntry
): NotesWorkspaceLayout {
    const group = listNotesWorkspaceGroups(layout.root).find((candidate) => candidate.id === entry.groupId);
    const tab = group?.tabs.find((candidate) => candidate.id === entry.tabId);
    if (!group || !tab) return openNotesWorkspaceTab(layout, { entityId: entry.entityId, view: entry.view });

    const activeLayout = setActiveNotesWorkspaceTab(layout, group.id, tab.id);
    return setNotesWorkspaceTabView(activeLayout, group.id, tab.id, entry.view);
}

function recordLayoutNavigation(
    history: NotesWorkspaceNavigationHistory,
    layout: NotesWorkspaceLayout
): NotesWorkspaceNavigationHistory {
    return recordNotesWorkspaceNavigation(history, getActiveNotesWorkspaceNavigationEntry(layout));
}

export const useNotesWorkspaceStore = create<NotesWorkspaceStoreState>((set) => ({
    layout: readStoredNotesWorkspaceLayout() ?? createEmptyNotesWorkspaceLayout(),
    shell: readStoredNotesWorkspaceShell(),
    navigationHistory: createEmptyNotesWorkspaceNavigationHistory(),

    openTab: (entityId, view = 'source') => set((state) => {
        const layout = openNotesWorkspaceTab(state.layout, { entityId, view });
        return { layout, navigationHistory: recordLayoutNavigation(state.navigationHistory, layout) };
    }),

    openTabInNewLeaf: (entityId, view = 'source') => set((state) => {
        const layout = openNotesWorkspaceTabInNewLeaf(state.layout, { entityId, view });
        return { layout, navigationHistory: recordLayoutNavigation(state.navigationHistory, layout) };
    }),

    closeTab: (groupId, tabId) => set((state) => ({
        layout: closeNotesWorkspaceTab(state.layout, groupId, tabId),
    })),

    closeGroup: (groupId) => set((state) => ({
        layout: closeNotesWorkspaceGroup(state.layout, groupId),
    })),

    mergeGroup: (sourceGroupId, targetGroupId) => set((state) => ({
        layout: mergeNotesWorkspaceGroups(state.layout, sourceGroupId, targetGroupId),
    })),

    moveTab: (sourceGroupId, tabId, targetGroupId, beforeTabId) => set((state) => ({
        layout: moveNotesWorkspaceTab(state.layout, sourceGroupId, tabId, targetGroupId, beforeTabId),
    })),

    splitTabToGroup: (sourceGroupId, tabId, targetGroupId, direction, placement) => set((state) => ({
        layout: splitNotesWorkspaceGroupFromTab(state.layout, sourceGroupId, tabId, targetGroupId, direction, placement),
    })),

    resizeSplit: (splitId, ratio) => set((state) => ({
        layout: setNotesWorkspaceSplitRatio(state.layout, splitId, ratio),
    })),

    setActiveGroup: (groupId) => set((state) => {
        const layout = setActiveNotesWorkspaceGroup(state.layout, groupId);
        return { layout, navigationHistory: recordLayoutNavigation(state.navigationHistory, layout) };
    }),

    setActiveTab: (groupId, tabId) => set((state) => {
        const layout = setActiveNotesWorkspaceTab(state.layout, groupId, tabId);
        return { layout, navigationHistory: recordLayoutNavigation(state.navigationHistory, layout) };
    }),

    setTabView: (groupId, tabId, view) => set((state) => {
        const layout = setNotesWorkspaceTabView(state.layout, groupId, tabId, view);
        return { layout, navigationHistory: recordLayoutNavigation(state.navigationHistory, layout) };
    }),

    navigateBack: () => set((state) => {
        const result = getNotesWorkspaceNavigationDirection(state.navigationHistory, 'back');
        if (!result) return state;
        return {
            layout: focusNotesWorkspaceNavigationEntry(state.layout, result.entry),
            navigationHistory: result.history,
        };
    }),

    navigateForward: () => set((state) => {
        const result = getNotesWorkspaceNavigationDirection(state.navigationHistory, 'forward');
        if (!result) return state;
        return {
            layout: focusNotesWorkspaceNavigationEntry(state.layout, result.entry),
            navigationHistory: result.history,
        };
    }),

    splitActiveGroup: (direction) => set((state) => ({
        layout: splitActiveNotesWorkspaceGroup(state.layout, direction),
    })),

    setShellModuleVisible: (moduleId, isVisible) => set((state) => {
        if (!canToggleNotesShellModule(moduleId)) return state;

        return {
            shell: {
                ...state.shell,
                modules: {
                    ...state.shell.modules,
                    [moduleId]: isVisible,
                },
            },
        };
    }),

    toggleShellModule: (moduleId) => set((state) => {
        if (!canToggleNotesShellModule(moduleId)) return state;

        return {
            shell: {
                ...state.shell,
                modules: {
                    ...state.shell.modules,
                    [moduleId]: !state.shell.modules[moduleId],
                },
            },
        };
    }),

    moveShellModule: (moduleId, area, beforeModuleId, layout) => set((state) => {
        const nextAreas = { ...state.shell.moduleAreas, [moduleId]: area };
        const modulesInArea = listImplementedNotesShellModules()
            .map((module) => module.id)
            .filter((id) => id !== moduleId && nextAreas[id] === area)
            .sort((left, right) => state.shell.moduleOrder[left] - state.shell.moduleOrder[right]);
        const insertIndex = beforeModuleId ? modulesInArea.indexOf(beforeModuleId) : -1;
        const nextIds = insertIndex >= 0
            ? [...modulesInArea.slice(0, insertIndex), moduleId, ...modulesInArea.slice(insertIndex)]
            : [...modulesInArea, moduleId];
        const nextOrder = { ...state.shell.moduleOrder };
        nextIds.forEach((id, index) => {
            nextOrder[id] = (index + 1) * 10;
        });

        return {
            shell: {
                ...state.shell,
                moduleAreas: nextAreas,
                moduleOrder: nextOrder,
                moduleLayouts: area !== 'bottom' && layout
                    ? { ...state.shell.moduleLayouts, [area]: layout }
                    : state.shell.moduleLayouts,
            },
        };
    }),

    setShellModuleWidth: (moduleId, width) => set((state) => ({
        shell: {
            ...state.shell,
            [moduleId === 'vault' ? 'vaultWidth' : 'contextWidth']: clampShellModuleWidth(
                width,
                moduleId === 'vault' ? state.shell.vaultWidth : state.shell.contextWidth
            ),
        },
    })),

    setShellAudioHeight: (height) => set((state) => ({
        shell: {
            ...state.shell,
            audioHeight: clampAudioModuleHeight(height, state.shell.audioHeight),
        },
    })),

    resetShell: () => set({ shell: createDefaultNotesWorkspaceShell() }),

    resetLayout: () => set({ layout: createEmptyNotesWorkspaceLayout() }),
}));

useNotesWorkspaceStore.subscribe((state) => {
    writeStoredNotesWorkspaceLayout(state.layout);
    writeStoredNotesWorkspaceShell(state.shell);
});
