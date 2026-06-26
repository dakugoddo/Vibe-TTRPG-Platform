export const WORKSPACE_MODE_STORAGE_KEY = 'vibe_workspace_mode';

export const WORKSPACE_MODES = ['canvas', 'notes'] as const;

export type WorkspaceMode = typeof WORKSPACE_MODES[number];

export const DEFAULT_WORKSPACE_MODE: WorkspaceMode = 'canvas';

type WorkspaceModeStorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function normalizeWorkspaceMode(value: unknown): WorkspaceMode {
    return value === 'notes' ? 'notes' : DEFAULT_WORKSPACE_MODE;
}

export function getNextWorkspaceMode(mode: WorkspaceMode): WorkspaceMode {
    return mode === 'canvas' ? 'notes' : 'canvas';
}

function getBrowserStorage(): WorkspaceModeStorageLike | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
}

export function getStoredWorkspaceMode(
    storage: WorkspaceModeStorageLike | null = getBrowserStorage()
): WorkspaceMode {
    if (!storage) return DEFAULT_WORKSPACE_MODE;
    return normalizeWorkspaceMode(storage.getItem(WORKSPACE_MODE_STORAGE_KEY));
}

export function saveStoredWorkspaceMode(
    mode: WorkspaceMode,
    storage: WorkspaceModeStorageLike | null = getBrowserStorage()
): WorkspaceMode {
    const normalized = normalizeWorkspaceMode(mode);
    storage?.setItem(WORKSPACE_MODE_STORAGE_KEY, normalized);
    return normalized;
}
