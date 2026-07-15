import { useCallback, useSyncExternalStore } from 'react';
import type { WorldSheetSnapshot } from '../types';
import { getWorldSheetSnapshot, subscribeWorldSheetSnapshots } from '../utils/worldSheetRuntime';

export function useWorldSheetSnapshot(worldScope: string, sheetId: string): WorldSheetSnapshot | null {
    const getSnapshot = useCallback(() => getWorldSheetSnapshot(worldScope, sheetId), [sheetId, worldScope]);
    return useSyncExternalStore(subscribeWorldSheetSnapshots, getSnapshot, () => null);
}
