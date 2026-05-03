/**
 * fileWatcher.ts
 * 
 * Watches the world folder for external changes (Obsidian, VS Code, manual edits).
 * Sends events via WebSocket to connected clients.
 * Prevents sync loops by ignoring our own writes (Problem #3).
 */

import chokidar from 'chokidar';
import path from 'node:path';
import fs from 'node:fs';
import type { WebSocket } from 'ws';
import { getCurrentWorldPath } from './worldManager.js';
import { isOurWrite, parseEntityFile, filenameToEntityName } from './fileManager.js';
import type { FileChangeEvent, DatabaseType } from './shared/types.js';

let watcher: ReturnType<typeof chokidar.watch> | null = null;
const connectedClients = new Set<WebSocket>();

export function addWsClient(ws: WebSocket): void {
    connectedClients.add(ws);
    ws.on('close', () => connectedClients.delete(ws));
}

function broadcast(event: FileChangeEvent): void {
    const data = JSON.stringify(event);
    for (const client of connectedClients) {
        if (client.readyState === 1) { // OPEN
            client.send(data);
        }
    }
}

/**
 * Determine which database a file belongs to based on its path.
 */
function resolveDatabase(filePath: string, worldPath: string): DatabaseType | null {
    const rel = path.relative(worldPath, filePath).replace(/\\/g, '/');
    if (rel.startsWith('general/')) return 'general';
    if (rel.startsWith('users/')) return 'user';
    if (rel.startsWith('gm/')) return 'gm';
    return null;
}

/**
 * Start watching the world folder for changes.
 */
export function startWatching(): void {
    const worldPath = getCurrentWorldPath();
    if (!worldPath) {
        console.warn('⚠️ Cannot start watcher: no world is open');
        return;
    }

    // Stop previous watcher if any
    stopWatching();

    console.log(`👁️ Watching: ${worldPath}`);

    watcher = chokidar.watch(worldPath, {
        ignored: [
            /(^|[/\\])\../, // dotfiles (.index.json, .git, etc)
            '**/node_modules/**',
            '**/world.yaml',
            '**/assets/**', // Don't watch media files for entity changes
        ],
        persistent: true,
        ignoreInitial: true, // Don't fire events for existing files
        awaitWriteFinish: {
            stabilityThreshold: 300,
            pollInterval: 100,
        },
    });

    const handleFileEvent = (eventType: 'add' | 'change' | 'unlink') => (filePath: string) => {
        // Only care about .md files
        if (!filePath.endsWith('.md')) return;

        // Problem #3: Skip our own writes to prevent sync loop
        if (isOurWrite(filePath)) {
            return;
        }

        const db = resolveDatabase(filePath, worldPath);
        if (!db) return;

        const filename = path.basename(filePath);
        const entityName = filenameToEntityName(filename);

        console.log(`📝 External ${eventType}: ${entityName} (${db})`);

        if (eventType === 'unlink') {
            broadcast({
                type: 'unlink',
                entity: null,
                entityId: entityName,
                database: db,
            });
            return;
        }

        // Read and parse the changed file
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const dbRoot = path.join(worldPath, db === 'user' ? 'users' : db === 'gm' ? 'gm' : 'general');
            const entity = parseEntityFile(content, entityName, dbRoot, filePath, db);

            broadcast({
                type: eventType,
                entity,
                entityId: entity.id,
                database: db,
            });
        } catch (err) {
            console.warn(`⚠️ Failed to parse changed file ${filePath}:`, (err as Error).message);
        }
    };

    watcher.on('add', handleFileEvent('add'));
    watcher.on('change', handleFileEvent('change'));
    watcher.on('unlink', handleFileEvent('unlink'));

    watcher.on('error', (err: unknown) => {
        console.error('❌ Watcher error:', err);
    });
}

/**
 * Stop watching.
 */
export function stopWatching(): void {
    if (watcher) {
        watcher.close();
        watcher = null;
        console.log('👁️ Watcher stopped');
    }
}

/**
 * Get the number of connected WebSocket clients.
 */
export function getClientCount(): number {
    return connectedClients.size;
}
