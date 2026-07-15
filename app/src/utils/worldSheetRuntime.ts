import type { WorldSheetSnapshot } from '../types';

const snapshotsByWorld = new Map<string, Map<string, WorldSheetSnapshot>>();
const listeners = new Set<() => void>();
let requestGeneration = 0;

export function getWorldSheetRequestGeneration(): number {
    return requestGeneration;
}

export function invalidateWorldSheetRequests(): void {
    requestGeneration += 1;
}

export function setWorldSheetSnapshot(worldScope: string, snapshot: Omit<WorldSheetSnapshot, 'issuedAt'>): void {
    let worldSnapshots = snapshotsByWorld.get(worldScope);
    if (!worldSnapshots) {
        worldSnapshots = new Map<string, WorldSheetSnapshot>();
        snapshotsByWorld.set(worldScope, worldSnapshots);
    }
    worldSnapshots.set(snapshot.sheetId, { ...snapshot, issuedAt: Date.now() });
    listeners.forEach((listener) => listener());
}

export function clearWorldSheetSnapshot(worldScope: string, sheetId: string): void {
    const worldSnapshots = snapshotsByWorld.get(worldScope);
    if (!worldSnapshots?.delete(sheetId)) return;
    if (worldSnapshots.size === 0) snapshotsByWorld.delete(worldScope);
    listeners.forEach((listener) => listener());
}

export function getWorldSheetSnapshot(worldScope: string, sheetId: string): WorldSheetSnapshot | null {
    return snapshotsByWorld.get(worldScope)?.get(sheetId) ?? null;
}

export function subscribeWorldSheetSnapshots(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
