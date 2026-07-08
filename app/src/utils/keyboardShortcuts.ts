export interface ShortcutKeyboardEventLike {
    key: string;
    code?: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
}

export type UndoRedoShortcutIntent = 'undo' | 'redo';

export function getUndoRedoShortcutIntent(event: ShortcutKeyboardEventLike): UndoRedoShortcutIntent | null {
    if (event.altKey) return null;
    if (!event.ctrlKey && !event.metaKey) return null;

    const physicalCode = event.code;
    const key = event.key.toLowerCase();
    const isPhysicalZ = physicalCode === 'KeyZ';
    const isPhysicalY = physicalCode === 'KeyY';
    const isTextZ = key === 'z';
    const isTextY = key === 'y';

    if (isPhysicalZ || isTextZ) return event.shiftKey ? 'redo' : 'undo';
    if (isPhysicalY || isTextY) return 'redo';
    return null;
}
