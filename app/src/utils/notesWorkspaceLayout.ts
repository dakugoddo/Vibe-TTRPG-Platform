export type NotesWorkspaceView = 'entity' | 'markdown' | 'graph' | 'backlinks' | 'outline';

export interface NotesWorkspaceTab {
    id: string;
    entityId: string;
    view: NotesWorkspaceView;
    pinned?: boolean;
}

export interface NotesWorkspaceTabsNode {
    type: 'tabs';
    id: string;
    activeTabId: string | null;
    tabs: NotesWorkspaceTab[];
}

export interface NotesWorkspaceSplitNode {
    type: 'split';
    id: string;
    direction: 'row' | 'column';
    ratio: number;
    children: [NotesWorkspaceNode, NotesWorkspaceNode];
}

export type NotesWorkspaceNode = NotesWorkspaceTabsNode | NotesWorkspaceSplitNode;

export interface NotesWorkspaceLayout {
    version: 1;
    root: NotesWorkspaceNode;
    activeGroupId: string;
}

export interface OpenNotesWorkspaceTabInput {
    entityId: string;
    view?: NotesWorkspaceView;
    pinned?: boolean;
}

const MIN_SPLIT_RATIO = 0.18;
const MAX_SPLIT_RATIO = 0.82;
let idCounter = 0;

function createLayoutId(prefix: string): string {
    idCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

function clampSplitRatio(ratio: number): number {
    if (!Number.isFinite(ratio)) return 0.5;
    return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio));
}

export function createEmptyNotesWorkspaceLayout(): NotesWorkspaceLayout {
    const root: NotesWorkspaceTabsNode = {
        type: 'tabs',
        id: createLayoutId('group'),
        activeTabId: null,
        tabs: [],
    };

    return {
        version: 1,
        root,
        activeGroupId: root.id,
    };
}

function createTab(input: OpenNotesWorkspaceTabInput): NotesWorkspaceTab {
    return {
        id: createLayoutId('tab'),
        entityId: input.entityId,
        view: input.view ?? 'entity',
        pinned: input.pinned,
    };
}

function mapNode(node: NotesWorkspaceNode, mapper: (node: NotesWorkspaceNode) => NotesWorkspaceNode): NotesWorkspaceNode {
    const mappedChildren = node.type === 'split'
        ? {
            ...node,
            children: [
                mapNode(node.children[0], mapper),
                mapNode(node.children[1], mapper),
            ] as [NotesWorkspaceNode, NotesWorkspaceNode],
        }
        : node;

    return mapper(mappedChildren);
}

function findTabsNode(node: NotesWorkspaceNode, groupId: string): NotesWorkspaceTabsNode | null {
    if (node.type === 'tabs') return node.id === groupId ? node : null;

    return findTabsNode(node.children[0], groupId) ?? findTabsNode(node.children[1], groupId);
}

function findTabLocation(
    node: NotesWorkspaceNode,
    entityId: string,
    view: NotesWorkspaceView
): { groupId: string; tabId: string } | null {
    if (node.type === 'tabs') {
        const tab = node.tabs.find((candidate) => candidate.entityId === entityId && candidate.view === view);
        return tab ? { groupId: node.id, tabId: tab.id } : null;
    }

    return findTabLocation(node.children[0], entityId, view) ?? findTabLocation(node.children[1], entityId, view);
}

export function openNotesWorkspaceTab(
    layout: NotesWorkspaceLayout,
    input: OpenNotesWorkspaceTabInput,
    options: { reuseExisting?: boolean } = { reuseExisting: true }
): NotesWorkspaceLayout {
    const view = input.view ?? 'entity';
    const existing = options.reuseExisting === false ? null : findTabLocation(layout.root, input.entityId, view);
    if (existing) {
        return {
            ...layout,
            activeGroupId: existing.groupId,
            root: mapNode(layout.root, (node) => {
                if (node.type !== 'tabs' || node.id !== existing.groupId) return node;
                return { ...node, activeTabId: existing.tabId };
            }),
        };
    }

    const activeGroup = findTabsNode(layout.root, layout.activeGroupId) ?? findFirstTabsNode(layout.root);
    const groupId = activeGroup.id;
    const tab = createTab(input);

    return {
        ...layout,
        activeGroupId: groupId,
        root: mapNode(layout.root, (node) => {
            if (node.type !== 'tabs' || node.id !== groupId) return node;
            return {
                ...node,
                tabs: [...node.tabs, tab],
                activeTabId: tab.id,
            };
        }),
    };
}

function findFirstTabsNode(node: NotesWorkspaceNode): NotesWorkspaceTabsNode {
    if (node.type === 'tabs') return node;
    return findFirstTabsNode(node.children[0]);
}

export function setActiveNotesWorkspaceTab(
    layout: NotesWorkspaceLayout,
    groupId: string,
    tabId: string
): NotesWorkspaceLayout {
    const group = findTabsNode(layout.root, groupId);
    if (!group?.tabs.some((tab) => tab.id === tabId)) return layout;

    return {
        ...layout,
        activeGroupId: groupId,
        root: mapNode(layout.root, (node) => {
            if (node.type !== 'tabs' || node.id !== groupId) return node;
            return { ...node, activeTabId: tabId };
        }),
    };
}

export function setActiveNotesWorkspaceGroup(
    layout: NotesWorkspaceLayout,
    groupId: string
): NotesWorkspaceLayout {
    if (!findTabsNode(layout.root, groupId)) return layout;
    return { ...layout, activeGroupId: groupId };
}

export function splitActiveNotesWorkspaceGroup(
    layout: NotesWorkspaceLayout,
    direction: NotesWorkspaceSplitNode['direction']
): NotesWorkspaceLayout {
    const targetGroup = findTabsNode(layout.root, layout.activeGroupId);
    if (!targetGroup) return layout;

    const newGroup: NotesWorkspaceTabsNode = {
        type: 'tabs',
        id: createLayoutId('group'),
        activeTabId: null,
        tabs: [],
    };

    return {
        ...layout,
        activeGroupId: newGroup.id,
        root: mapNode(layout.root, (node) => {
            if (node.type !== 'tabs' || node.id !== targetGroup.id) return node;
            return {
                type: 'split',
                id: createLayoutId('split'),
                direction,
                ratio: 0.5,
                children: [node, newGroup],
            };
        }),
    };
}

export function setNotesWorkspaceSplitRatio(
    layout: NotesWorkspaceLayout,
    splitId: string,
    ratio: number
): NotesWorkspaceLayout {
    let didUpdate = false;
    const nextRatio = clampSplitRatio(ratio);

    const root = mapNode(layout.root, (node) => {
        if (node.type !== 'split' || node.id !== splitId) return node;
        if (node.ratio === nextRatio) return node;

        didUpdate = true;
        return {
            ...node,
            ratio: nextRatio,
        };
    });

    if (!didUpdate) return layout;
    return {
        ...layout,
        root,
    };
}

export function closeNotesWorkspaceTab(
    layout: NotesWorkspaceLayout,
    groupId: string,
    tabId: string
): NotesWorkspaceLayout {
    const group = findTabsNode(layout.root, groupId);
    if (!group?.tabs.some((tab) => tab.id === tabId)) return layout;

    return {
        ...layout,
        root: mapNode(layout.root, (node) => {
            if (node.type !== 'tabs' || node.id !== groupId) return node;

            const nextTabs = node.tabs.filter((tab) => tab.id !== tabId);
            const fallbackActiveTabId = nextTabs.at(-1)?.id ?? null;
            return {
                ...node,
                tabs: nextTabs,
                activeTabId: node.activeTabId === tabId ? fallbackActiveTabId : node.activeTabId,
            };
        }),
    };
}

function insertTabBefore(
    tabs: NotesWorkspaceTab[],
    tab: NotesWorkspaceTab,
    beforeTabId?: string | null
): NotesWorkspaceTab[] {
    if (!beforeTabId) return [...tabs, tab];

    const targetIndex = tabs.findIndex((candidate) => candidate.id === beforeTabId);
    if (targetIndex < 0) return [...tabs, tab];

    return [
        ...tabs.slice(0, targetIndex),
        tab,
        ...tabs.slice(targetIndex),
    ];
}

export function moveNotesWorkspaceTab(
    layout: NotesWorkspaceLayout,
    sourceGroupId: string,
    tabId: string,
    targetGroupId: string,
    beforeTabId?: string | null
): NotesWorkspaceLayout {
    const sourceGroup = findTabsNode(layout.root, sourceGroupId);
    const targetGroup = findTabsNode(layout.root, targetGroupId);
    const movingTab = sourceGroup?.tabs.find((tab) => tab.id === tabId);

    if (!sourceGroup || !targetGroup || !movingTab) return layout;
    if (sourceGroupId === targetGroupId && beforeTabId === tabId) return layout;

    return {
        ...layout,
        activeGroupId: targetGroupId,
        root: mapNode(layout.root, (node) => {
            if (node.type !== 'tabs') return node;

            if (sourceGroupId === targetGroupId && node.id === sourceGroupId) {
                const withoutMovingTab = node.tabs.filter((tab) => tab.id !== tabId);
                const nextTabs = insertTabBefore(withoutMovingTab, movingTab, beforeTabId);
                return {
                    ...node,
                    tabs: nextTabs,
                    activeTabId: movingTab.id,
                };
            }

            if (node.id === sourceGroupId) {
                const nextTabs = node.tabs.filter((tab) => tab.id !== tabId);
                return {
                    ...node,
                    tabs: nextTabs,
                    activeTabId: node.activeTabId === tabId ? nextTabs.at(-1)?.id ?? null : node.activeTabId,
                };
            }

            if (node.id === targetGroupId) {
                return {
                    ...node,
                    tabs: insertTabBefore(node.tabs, movingTab, beforeTabId),
                    activeTabId: movingTab.id,
                };
            }

            return node;
        }),
    };
}

export function listNotesWorkspaceGroups(node: NotesWorkspaceNode): NotesWorkspaceTabsNode[] {
    if (node.type === 'tabs') return [node];
    return [...listNotesWorkspaceGroups(node.children[0]), ...listNotesWorkspaceGroups(node.children[1])];
}
