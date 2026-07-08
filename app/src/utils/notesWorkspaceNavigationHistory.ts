import type { NotesWorkspaceView } from './notesWorkspaceLayout';

export interface NotesWorkspaceNavigationEntry {
    groupId: string;
    tabId: string;
    entityId: string;
    view: NotesWorkspaceView;
}

export interface NotesWorkspaceNavigationHistory {
    backStack: NotesWorkspaceNavigationEntry[];
    current: NotesWorkspaceNavigationEntry | null;
    forwardStack: NotesWorkspaceNavigationEntry[];
}

export type NotesWorkspaceNavigationDirection = 'back' | 'forward';

export function createEmptyNotesWorkspaceNavigationHistory(): NotesWorkspaceNavigationHistory {
    return { backStack: [], current: null, forwardStack: [] };
}

function isSameNavigationEntry(left: NotesWorkspaceNavigationEntry | null, right: NotesWorkspaceNavigationEntry | null): boolean {
    if (!left || !right) return false;
    return left.groupId === right.groupId
        && left.tabId === right.tabId
        && left.entityId === right.entityId
        && left.view === right.view;
}

export function recordNotesWorkspaceNavigation(
    history: NotesWorkspaceNavigationHistory,
    entry: NotesWorkspaceNavigationEntry | null
): NotesWorkspaceNavigationHistory {
    if (!entry || isSameNavigationEntry(history.current, entry)) return history;

    return {
        backStack: history.current ? [...history.backStack, history.current] : history.backStack,
        current: entry,
        forwardStack: [],
    };
}

export function getNotesWorkspaceNavigationDirection(
    history: NotesWorkspaceNavigationHistory,
    direction: NotesWorkspaceNavigationDirection
): { history: NotesWorkspaceNavigationHistory; entry: NotesWorkspaceNavigationEntry } | null {
    if (direction === 'back') {
        const entry = history.backStack[history.backStack.length - 1];
        if (!entry) return null;
        return {
            entry,
            history: {
                backStack: history.backStack.slice(0, -1),
                current: entry,
                forwardStack: history.current ? [history.current, ...history.forwardStack] : history.forwardStack,
            },
        };
    }

    const entry = history.forwardStack[0];
    if (!entry) return null;
    return {
        entry,
        history: {
            backStack: history.current ? [...history.backStack, history.current] : history.backStack,
            current: entry,
            forwardStack: history.forwardStack.slice(1),
        },
    };
}
