/**
 * fileSyncService.ts — Bridges the File Server ↔ Yjs Store
 * 
 * This service handles:
 * 1. Loading world from files into Yjs (on startup, host only)
 * 2. Debounced writeback: Yjs changes → .md files (host only)
 * 3. External file changes → Yjs updates (via WebSocket, host only)
 * 
 * KEY RULE: Only the HOST runs this service.
 * Players receive all data passively through Yjs/WebRTC sync.
 */

import type { Entity } from '../types';
import {
    listEntities,
    saveEntity,
    deleteEntity as deleteEntityFile,
    openWorld,
    createWorld,
    onFileChange,
    connectFileWatcher,
    disconnectFileWatcher,
    getIsHost,
    type DatabaseType,
    type WorldMeta
} from './fileApi';
import { yjsStore } from '../store/yjsStore';

// ─── Debounced writeback ───

/** Entities that have been changed in Yjs but not yet written to disk */
const dirtyEntities = new Map<string, { entity: Entity; db: DatabaseType }>();

/** Timer for debounced flush */
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Delay before writing changes to disk (ms) */
const WRITEBACK_DELAY_MS = 2000;

/** Flag to prevent re-entrant observe calls during loading */
let _isLoading = false;

/** Track if sync service is active */
let _isActive = false;

/** Current player name (for user DB folder) */
let _playerName: string = 'host';

// ─── Callbacks ───

type ProgressCallback = (loaded: number, total: number) => void;
type StatusCallback = (status: 'idle' | 'saving' | 'saved' | 'error', message?: string) => void;

let _onProgress: ProgressCallback | null = null;
let _onStatus: StatusCallback | null = null;

export function onSyncProgress(cb: ProgressCallback): void {
    _onProgress = cb;
}

export function onSyncStatus(cb: StatusCallback): void {
    _onStatus = cb;
}

export function setPlayerName(name: string): void {
    _playerName = name.trim() || 'host';
}

function setStatus(status: 'idle' | 'saving' | 'saved' | 'error', msg?: string) {
    _onStatus?.(status, msg);
}

// ─── World Loading ───

/**
 * Open (or create) a world and load all entities into Yjs.
 * This is ONLY called by the host.
 */
export async function loadWorld(
    worldPath: string,
    options: { create?: boolean; worldName?: string } = {}
): Promise<WorldMeta | null> {
    if (!getIsHost()) {
        console.warn('⚠️ loadWorld called on non-host client, ignoring');
        return null;
    }

    _isLoading = true;
    setStatus('saving', 'Loading world...');

    try {
        // Open or create the world
        let meta: WorldMeta;
        if (options.create && options.worldName) {
            meta = await createWorld(worldPath, options.worldName);
        } else {
            meta = await openWorld(worldPath);
        }

        // Load all entities from general DB
        const generalEntities = await listEntities('general');
        console.log(`📂 Loaded ${generalEntities.length} entities from general DB`);

        // Load user (personal inventory) entities
        const userEntities = await listEntities('user', _playerName);
        console.log(`📂 Loaded ${userEntities.length} entities from user DB (${_playerName})`);

        // Load GM entities
        const gmEntities = await listEntities('gm');
        console.log(`📂 Loaded ${gmEntities.length} entities from GM DB`);

        // Load all into Yjs (this triggers sync to all connected players)
        yjsStore.doc.transact(() => {
            let loaded = 0;
            const allEntities = [
                ...generalEntities.map(e => ({ ...e, database: 'general' as const })),
                ...userEntities.map(e => ({ ...e, database: 'user' as const })),
                ...gmEntities.map(e => ({ ...e, database: 'gm' as const })),
            ];
            const total = allEntities.length;

            for (const entity of allEntities) {
                const id = entity.id || entity.name;
                const existingEntity = yjsStore.entitiesMap.get(id);

                // Only update if entity doesn't exist or has changed
                if (!existingEntity || JSON.stringify(existingEntity) !== JSON.stringify(entity)) {
                    yjsStore.entitiesMap.set(id, {
                        ...entity,
                        id, // Ensure ID is consistent
                    });
                }

                loaded++;
                _onProgress?.(loaded, total);
            }
        });

        // Start watching for external changes
        connectFileWatcher();
        setupFileChangeHandler();

        // Start observing Yjs for writeback
        setupYjsObserver();

        _isActive = true;
        setStatus('saved', `World loaded: ${meta.name}`);
        console.log(`✅ World loaded: ${meta.name} (${generalEntities.length + userEntities.length + gmEntities.length} entities)`);

        return meta;
    } catch (err) {
        setStatus('error', (err as Error).message);
        console.error('❌ Failed to load world:', err);
        return null;
    } finally {
        _isLoading = false;
    }
}

// ─── Yjs Observer → Writeback ───

let _observerSetup = false;

function setupYjsObserver(): void {
    if (_observerSetup) return;
    _observerSetup = true;

    yjsStore.entitiesMap.observe((event) => {
        // Don't write back during loading (we're the ones filling Yjs)
        if (_isLoading || !getIsHost()) return;

        // Collect changed entities
        for (const [key, change] of event.changes.keys) {
            if (change.action === 'add' || change.action === 'update') {
                const entity = yjsStore.entitiesMap.get(key);
                if (entity) {
                    // Determine which DB this entity belongs to
                    const db = entity.database || 'general';

                    // If it was moved between databases, delete the old file
                    if (change.action === 'update' && change.oldValue) {
                        const oldEntity = change.oldValue as Entity;
                        const oldDb = oldEntity.database || 'general';
                        if (oldDb !== db) {
                            const player = oldDb === 'user' ? _playerName : undefined;
                            deleteEntityFile(oldDb, key, player).catch((err) => {
                                console.warn(`⚠️ Failed to delete old file after moving DB for ${key}:`, err);
                            });
                        }
                    }

                    dirtyEntities.set(key, { entity, db });
                }
            } else if (change.action === 'delete') {
                // Entity was deleted from Yjs → delete the file
                // We need to check dirty map for the db, or default to general
                const prevDirty = dirtyEntities.get(key);
                const db = prevDirty?.db || 'general';
                dirtyEntities.delete(key);
                const player = db === 'user' ? _playerName : undefined;
                deleteEntityFile(db, key, player).catch((err) => {
                    console.warn(`⚠️ Failed to delete file for ${key}:`, err);
                });
            }
        }

        // Schedule a debounced flush
        scheduleDirtyFlush();
    });
}

/**
 * Schedule a flush of dirty entities to disk after WRITEBACK_DELAY_MS.
 */
function scheduleDirtyFlush(): void {
    if (flushTimer) clearTimeout(flushTimer);

    setStatus('saving');

    flushTimer = setTimeout(async () => {
        await flushDirtyEntities();
    }, WRITEBACK_DELAY_MS);
}

/**
 * Write all dirty entities to disk.
 */
async function flushDirtyEntities(): Promise<void> {
    if (dirtyEntities.size === 0) {
        setStatus('saved');
        return;
    }

    const batch = new Map(dirtyEntities);
    dirtyEntities.clear();

    console.log(`💾 Writing ${batch.size} entities to disk...`);

    let errors = 0;
    for (const { entity, db } of batch.values()) {
        try {
            const player = db === 'user' ? _playerName : undefined;
            await saveEntity(db, entity, player);
        } catch (err) {
            errors++;
            console.warn(`⚠️ Failed to save ${entity.name}:`, err);
        }
    }

    if (errors > 0) {
        setStatus('error', `${errors} entities failed to save`);
    } else {
        setStatus('saved');
    }
}

// ─── External File Change Handler ───

let _fileChangeCleanup: (() => void) | null = null;

function setupFileChangeHandler(): void {
    if (_fileChangeCleanup) return;

    _fileChangeCleanup = onFileChange((event) => {
        _isLoading = true; // Prevent writeback loop

        try {
            if (event.type === 'unlink') {
                // File was deleted externally
                const entityId = event.entityId;
                if (yjsStore.entitiesMap.has(entityId)) {
                    console.log(`🗑️ External delete: ${entityId}`);
                    yjsStore.entitiesMap.delete(entityId);
                }
            } else if (event.entity) {
                // File was added or changed externally
                const entity = event.entity;
                const id = entity.id || entity.name;
                console.log(`📝 External ${event.type}: ${entity.name}`);
                yjsStore.entitiesMap.set(id, { ...entity, id });
            }
        } finally {
            // Re-enable writeback after a short delay 
            // (to let Yjs observer settle)
            setTimeout(() => {
                _isLoading = false;
            }, 500);
        }
    });
}

// ─── Cleanup ───

/**
 * Stop the sync service, flush remaining changes, disconnect watcher.
 */
export async function stopSync(): Promise<void> {
    if (!_isActive) return;

    // Flush remaining dirty entities
    if (dirtyEntities.size > 0) {
        console.log('💾 Flushing remaining changes before shutdown...');
        await flushDirtyEntities();
    }

    // Clean up timers
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }

    // Disconnect file watcher
    if (_fileChangeCleanup) {
        _fileChangeCleanup();
        _fileChangeCleanup = null;
    }
    disconnectFileWatcher();

    _isActive = false;
    _observerSetup = false;
    console.log('🛑 File sync service stopped');
}

/**
 * Force flush all pending changes (e.g., before closing).
 */
export async function forceFlush(): Promise<void> {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    await flushDirtyEntities();
}

/**
 * Check if the sync service is currently active.
 */
export function isSyncActive(): boolean {
    return _isActive;
}
