import { create } from 'zustand';
import {
    getNextWorkspaceMode,
    getStoredWorkspaceMode,
    saveStoredWorkspaceMode,
    type WorkspaceMode,
} from '../utils/workspaceMode';

interface WorkspaceModeStoreState {
    mode: WorkspaceMode;
    setMode: (mode: WorkspaceMode) => void;
    toggleMode: () => void;
}

export const useWorkspaceModeStore = create<WorkspaceModeStoreState>((set, get) => ({
    mode: getStoredWorkspaceMode(),

    setMode: (mode) => {
        set({ mode: saveStoredWorkspaceMode(mode) });
    },

    toggleMode: () => {
        const nextMode = getNextWorkspaceMode(get().mode);
        set({ mode: saveStoredWorkspaceMode(nextMode) });
    },
}));
