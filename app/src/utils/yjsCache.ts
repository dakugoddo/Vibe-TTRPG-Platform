export const YJS_INDEXEDDB_CACHE_VERSION = 'v2-no-inline-canvas-payloads';

export function getYjsPersistenceKey(roomName: string): string {
    return `${roomName}:${YJS_INDEXEDDB_CACHE_VERSION}`;
}
