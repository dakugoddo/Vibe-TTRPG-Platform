import { create } from 'zustand';

export interface ConfirmDialogData {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
}

interface UIState {
    confirmDialog: ConfirmDialogData | null;
    openConfirm: (data: ConfirmDialogData) => void;
    closeConfirm: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    confirmDialog: null,
    openConfirm: (data) => set({ confirmDialog: data }),
    closeConfirm: () => set({ confirmDialog: null }),
}));
