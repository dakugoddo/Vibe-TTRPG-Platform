/**
 * fileApi.ts — Client API for communicating with the Vibe TTRPG File Server.
 * 
 * IMPORTANT: Only the HOST (GM) calls these functions.
 * Players get all data via Yjs/WebRTC sync.
 * 
 * The `shouldCallFileApi()` check prevents players from making
 * unnecessary requests to a server that may not even be running.
 */

import type { Entity, PlayerProfile, UserRole } from '../types';
import type { AudioDeckState } from '../utils/audioDeckModel';
import { showAssetInFolder as showDesktopAssetInFolder } from './desktopBridge';

const LOCAL_FILE_SERVER_URL = 'http://localhost:3001';

export type DatabaseType = 'general' | 'user' | 'gm';

export interface WorldMeta {
    name: string;
    path: string;
    createdAt: string;
    version: string;
}

export interface WorldLocaleFile {
    locale: string;
    filename: string;
    size: number;
    modifiedAt: string;
}

export interface WorldLocaleDiagnostic {
    level: 'error' | 'warning';
    message: string;
}

export interface WorldLocaleReadResult {
    locale: string;
    exists: boolean;
    overrides: Record<string, unknown>;
    diagnostics: WorldLocaleDiagnostic[];
    size?: number;
    modifiedAt?: string;
}

export interface WorldLocaleWriteResult extends WorldLocaleReadResult {
    backupCreated: boolean;
}

// ─── Host detection ───
// Only the host (who created/opened the room) has a file server running.

let _isHost = false;
let _serverAvailable: boolean | null = null;

export function setIsHost(isHost: boolean): void {
    _isHost = isHost;
}

export function getIsHost(): boolean {
    return _isHost;
}

/**
 * Check if we should call the file API.
 * Returns false if not host or server unavailable.
 */
async function shouldCallFileApi(): Promise<boolean> {
    if (!_isHost) return false;

    // Cache server availability check
    if (_serverAvailable === null) {
        try {
            const res = await fetch(`${getFileServerUrl()}/api/world/status`, {
                signal: AbortSignal.timeout(2000),
            });
            _serverAvailable = res.ok;
        } catch {
            _serverAvailable = false;
        }
    }
    return _serverAvailable;
}

/**
 * Reset the server availability cache (e.g., when retrying connection).
 */
export function resetServerCache(): void {
    _serverAvailable = null;
}

// ─── Helper ───

async function apiFetchFrom<T>(baseUrl: string, path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    return apiFetchFrom(getFileServerUrl(), path, options);
}

// ─── World Management ───

export async function getWorldStatus(): Promise<{
    isOpen: boolean;
    path: string | null;
    watcherClients: number;
}> {
    return apiFetch('/api/world/status');
}

export async function createWorld(worldPath: string, name: string): Promise<WorldMeta> {
    return apiFetch('/api/world/create', {
        method: 'POST',
        body: JSON.stringify({ path: worldPath, name }),
    });
}

export async function openWorld(worldPath: string): Promise<WorldMeta> {
    return apiFetch('/api/world/open', {
        method: 'POST',
        body: JSON.stringify({ path: worldPath }),
    });
}

export async function getAudioDeck(): Promise<Partial<AudioDeckState> | null> {
    if (!(await shouldCallFileApi())) return null;
    return apiFetch('/api/world/audio-deck');
}

export async function saveAudioDeck(data: AudioDeckState): Promise<void> {
    if (!(await shouldCallFileApi())) return;
    return apiFetch('/api/world/audio-deck', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function listWorldLocaleFiles(): Promise<WorldLocaleFile[]> {
    if (!(await shouldCallFileApi())) return [];
    const data = await apiFetch<{ locales: WorldLocaleFile[] }>('/api/world/locales');
    return data.locales || [];
}

export async function readWorldLocaleFile(locale: string): Promise<WorldLocaleReadResult | null> {
    if (!(await shouldCallFileApi())) return null;
    return apiFetch<WorldLocaleReadResult>(`/api/world/locales/${encodeURIComponent(locale)}`);
}

export async function writeWorldLocaleFile(locale: string, overrides: Record<string, unknown>): Promise<WorldLocaleWriteResult | null> {
    if (!(await shouldCallFileApi())) return null;
    return apiFetch<WorldLocaleWriteResult>(`/api/world/locales/${encodeURIComponent(locale)}`, {
        method: 'PUT',
        body: JSON.stringify({ overrides }),
    });
}

// ─── Players ───

export async function listPlayers(): Promise<string[]> {
    if (!(await shouldCallFileApi())) return [];
    try {
        return await apiFetch('/api/players');
    } catch {
        return [];
    }
}

export async function listPlayerProfiles(): Promise<PlayerProfile[]> {
    if (!(await shouldCallFileApi())) return [];
    try {
        return await apiFetch('/api/player-profiles');
    } catch {
        return [];
    }
}

export async function claimPlayerProfile(serverHost: string, displayName: string, requestedPlayerId?: string): Promise<PlayerProfile> {
    const host = serverHost.trim() || window.location.hostname;
    return apiFetchFrom<PlayerProfile>(`http://${host}:3001`, '/api/player-profiles/claim', {
        method: 'POST',
        body: JSON.stringify({ displayName, requestedPlayerId }),
    });
}

export async function updatePlayerProfileRole(playerId: string, assignedRole: UserRole): Promise<PlayerProfile> {
    if (!(await shouldCallFileApi())) {
        throw new Error('File API is available only for the host');
    }
    return apiFetch(`/api/player-profiles/${encodeURIComponent(playerId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ assignedRole }),
    });
}

// ─── Entity CRUD ───

export async function listEntities(db: DatabaseType = 'general', player?: string): Promise<Entity[]> {
    if (!(await shouldCallFileApi())) return [];

    const params = new URLSearchParams({ db });
    if (player) params.append('player', player);

    return apiFetch(`/api/entities?${params}`);
}

export async function getEntity(db: DatabaseType, id: string, player?: string): Promise<Entity | null> {
    if (!(await shouldCallFileApi())) return null;

    const params = new URLSearchParams({ db });
    if (player) params.append('player', player);

    try {
        return await apiFetch(`/api/entities/${encodeURIComponent(id)}?${params}`);
    } catch {
        return null;
    }
}

export async function saveEntity(db: DatabaseType, entity: Entity, player?: string): Promise<void> {
    if (!(await shouldCallFileApi())) return;

    const params = new URLSearchParams({ db });
    if (player) params.append('player', player);

    // Check if it exists first (to use PUT vs POST)
    const existing = await getEntity(db, entity.id || entity.name, player);

    if (existing) {
        await apiFetch(`/api/entities/${encodeURIComponent(entity.id || entity.name)}?${params}`, {
            method: 'PUT',
            body: JSON.stringify(entity),
        });
    } else {
        await apiFetch(`/api/entities?${params}`, {
            method: 'POST',
            body: JSON.stringify(entity),
        });
    }
}

export async function deleteEntity(db: DatabaseType, id: string, player?: string): Promise<boolean> {
    if (!(await shouldCallFileApi())) return false;

    const params = new URLSearchParams({ db });
    if (player) params.append('player', player);

    try {
        await apiFetch(`/api/entities/${encodeURIComponent(id)}?${params}`, {
            method: 'DELETE',
        });
        return true;
    } catch {
        return false;
    }
}

export async function importMarkdown(content: string, filename: string, db: DatabaseType = 'general'): Promise<Entity> {
    return apiFetch(`/api/entities/import?db=${db}`, {
        method: 'POST',
        body: JSON.stringify({ content, filename }),
    });
}

// ─── Assets ───

export function getFileServerUrl(): string {
    if (typeof window === 'undefined') return LOCAL_FILE_SERVER_URL;

    const savedHost = window.localStorage.getItem('vibe_server_ip')?.trim();
    const host = savedHost || window.location.hostname || 'localhost';
    return `http://${host}:3001`;
}

function normalizeAssetPath(assetPath: string): string {
    return assetPath.replace(/\\/g, '/').split('/').filter(Boolean).join('/');
}

export function getAssetUrl(assetPathOrUrl: string): string {
    const raw = assetPathOrUrl.trim();
    if (!raw) return '';
    if (/^(data:|blob:)/i.test(raw)) return raw;

    const serverUrl = getFileServerUrl();

    if (/^https?:\/\//i.test(raw)) {
        try {
            const parsed = new URL(raw);
            const server = new URL(serverUrl);
            const isFileServerAsset = parsed.host === server.host || parsed.port === server.port;
            if (isFileServerAsset && parsed.pathname.startsWith('/api/assets/') && parsed.pathname !== '/api/assets/file') {
                return getAssetUrl(decodeURIComponent(parsed.pathname.replace(/^\/api\/assets\//, '')));
            }
        } catch {
            // Keep external or malformed URLs unchanged.
        }
        return raw;
    }

    if (raw.startsWith('/api/assets/file')) return `${serverUrl}${raw}`;
    if (raw.startsWith('/api/assets/')) {
        return getAssetUrl(decodeURIComponent(raw.replace(/^\/api\/assets\//, '')));
    }

    const assetPath = normalizeAssetPath(raw);
    return `${serverUrl}/api/assets/file?path=${encodeURIComponent(assetPath)}`;
}

// ─── WebSocket: File change notifications ───

let ws: WebSocket | null = null;
type FileChangeHandler = (event: {
    type: 'add' | 'change' | 'unlink';
    entity: Entity | null;
    entityId: string;
    database: DatabaseType;
}) => void;

const changeHandlers = new Set<FileChangeHandler>();

export function onFileChange(handler: FileChangeHandler): () => void {
    changeHandlers.add(handler);
    return () => changeHandlers.delete(handler);
}

export function connectFileWatcher(): void {
    if (!_isHost) return;
    if (ws) return;

    const wsUrl = `ws://localhost:3001/ws/watch`;

    try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('🔌 File watcher connected');
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data as string);
                for (const handler of changeHandlers) {
                    handler(data);
                }
            } catch (e) {
                console.warn('⚠️ Failed to parse file change event:', e);
            }
        };

        ws.onclose = () => {
            console.log('🔌 File watcher disconnected');
            ws = null;
            // Auto-reconnect after 3 seconds
            if (_isHost) {
                setTimeout(connectFileWatcher, 3000);
            }
        };

        ws.onerror = () => {
            // Will trigger onclose
        };
    } catch {
        console.warn('⚠️ File watcher connection failed, will retry...');
        setTimeout(connectFileWatcher, 3000);
    }
}

export function disconnectFileWatcher(): void {
    if (ws) {
        ws.close();
        ws = null;
    }
}

export interface AssetRecord {
    id: string;
    name: string;
    path: string;
    relativePath: string;
    ext: string;
    type: 'image' | 'audio' | 'model' | 'video' | 'pdf' | 'other';
    mime: string;
    size: number;
    createdAt: string;
    modifiedAt: string;
    url: string;
}

export type AssetKind = 'all' | 'image' | 'audio' | 'model' | 'video' | 'pdf' | 'other';

export interface UploadAssetFileOptions {
    onProgress?: (progress: { loaded: number; total: number; percent: number }) => void;
    signal?: AbortSignal;
}

export async function listAssetRecords(): Promise<AssetRecord[]> {
    if (!(await shouldCallFileApi())) return [];
    const records = await apiFetch<AssetRecord[]>('/api/assets/index');
    return records.map((record) => {
        const assetPath = record.path || record.relativePath || record.name;
        return {
            ...record,
            path: assetPath,
            relativePath: record.relativePath || assetPath,
            url: getAssetUrl(record.url || assetPath),
        };
    });
}

export async function deleteAssetFile(assetPath: string): Promise<void> {
    if (!(await shouldCallFileApi())) return;
    const params = new URLSearchParams({ path: assetPath });
    await apiFetch(`/api/assets/file?${params}`, {
        method: 'DELETE',
    });
}

export async function showAssetInExplorer(assetPath: string): Promise<boolean> {
    if (!(await shouldCallFileApi())) return false;
    try {
        if (await showDesktopAssetInFolder(assetPath)) return true;
    } catch {
        // Fall back to the file server route when native desktop reveal is unavailable.
    }
    await apiFetch('/api/assets/show-in-explorer', {
        method: 'POST',
        body: JSON.stringify({ path: assetPath }),
    });
    return true;
}

export async function showEntityInExplorer(db: DatabaseType, id: string, player?: string): Promise<boolean> {
    if (!(await shouldCallFileApi())) return false;
    const params = new URLSearchParams({ db });
    if (player) params.append('player', player);
    await apiFetch(`/api/entities/${encodeURIComponent(id)}/show-in-explorer?${params}`, {
        method: 'POST',
    });
    return true;
}

export async function renameEntityFileToTitle(db: DatabaseType, id: string, title: string, player?: string, options?: { dryRun?: boolean }): Promise<unknown | null> {
    if (!(await shouldCallFileApi())) return null;
    const params = new URLSearchParams({ db });
    if (player) params.append('player', player);
    return apiFetch(`/api/entities/${encodeURIComponent(id)}/rename-path?${params}`, {
        method: 'POST',
        body: JSON.stringify({ title, dryRun: options?.dryRun }),
    });
}

export async function uploadAsset(filename: string, base64: string): Promise<{ filename: string; url: string }> {
    if (!(await shouldCallFileApi())) {
        throw new Error('File API is available only for the host');
    }
    const data = await apiFetch<{ success?: boolean; filename?: string; url?: string }>('/api/assets/upload', {
        method: 'POST',
        body: JSON.stringify({ filename, base64 }),
    });
    if (!data.filename) {
        throw new Error('Asset upload did not return a filename');
    }
    return {
        filename: data.filename,
        url: getAssetUrl(data.url || data.filename),
    };
}

export async function uploadAssetFile(file: File, options: UploadAssetFileOptions = {}): Promise<{ filename: string; url: string }> {
    if (!(await shouldCallFileApi())) {
        throw new Error('File API is available only for the host');
    }
    return uploadAssetFileToHost(file, options);
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunk
const CHUNK_THRESHOLD = 20 * 1024 * 1024; // 20 MB threshold

export async function uploadAssetFileToHost(file: File, options: UploadAssetFileOptions = {}): Promise<{ filename: string; url: string }> {
    if (file.size <= CHUNK_THRESHOLD) {
        return uploadAssetFileToHostSingle(file, options);
    }
    return uploadAssetFileToHostChunks(file, options);
}

async function uploadAssetFileToHostSingle(file: File, options: UploadAssetFileOptions = {}): Promise<{ filename: string; url: string }> {
    const params = new URLSearchParams({ filename: file.name });
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const cleanup = () => {
            options.signal?.removeEventListener('abort', handleAbort);
        };
        const handleAbort = () => {
            xhr.abort();
            cleanup();
            reject(new DOMException('Upload aborted', 'AbortError'));
        };

        xhr.open('POST', `${getFileServerUrl()}/api/assets/upload-binary?${params}`);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');

        xhr.upload.onprogress = (event) => {
            const total = event.lengthComputable ? event.total : file.size;
            const loaded = event.loaded;
            const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((loaded / total) * 100))) : 0;
            options.onProgress?.({ loaded, total, percent });
        };

        xhr.onload = () => {
            cleanup();
            let data: { success?: boolean; filename?: string; path?: string; url?: string; error?: string } = {};
            try {
                data = JSON.parse(xhr.responseText || '{}');
            } catch {
                data = {};
            }
            if (xhr.status < 200 || xhr.status >= 300) {
                reject(new Error(data.error || xhr.statusText || `HTTP ${xhr.status}`));
                return;
            }
            if (!data.filename) {
                reject(new Error('Asset upload did not return a filename'));
                return;
            }
            options.onProgress?.({ loaded: file.size, total: file.size, percent: 100 });
            resolve({
                filename: data.filename,
                url: getAssetUrl(data.url || data.path || data.filename),
            });
        };

        xhr.onerror = () => {
            cleanup();
            reject(new Error(xhr.statusText || 'Asset upload failed'));
        };

        xhr.onabort = () => {
            cleanup();
            reject(new DOMException('Upload aborted', 'AbortError'));
        };

        if (options.signal?.aborted) {
            handleAbort();
            return;
        }
        options.signal?.addEventListener('abort', handleAbort, { once: true });
        xhr.send(file);
    });
}

async function uploadAssetFileToHostChunks(file: File, options: UploadAssetFileOptions = {}): Promise<{ filename: string; url: string }> {
    const totalSize = file.size;
    const chunkCount = Math.ceil(totalSize / CHUNK_SIZE);
    
    // 1. Инициализируем чанковую сессию на сервере
    let startData: { uploadId?: string; error?: string } = {};
    try {
        startData = await apiFetch<{ uploadId?: string; error?: string }>('/api/assets/upload-chunk/start', {
            method: 'POST',
            body: JSON.stringify({ filename: file.name, fileSize: totalSize }),
            signal: options.signal
        });
    } catch (err) {
        throw new Error(`Failed to start chunked upload: ${(err as Error).message}`);
    }
    
    const uploadId = startData.uploadId;
    if (!uploadId) {
        throw new Error(startData.error || 'Server did not return an uploadId');
    }
    
    try {
        // 2. Отправляем чанки по очереди
        for (let i = 0; i < chunkCount; i++) {
            if (options.signal?.aborted) {
                throw new DOMException('Upload aborted', 'AbortError');
            }
            
            const startByte = i * CHUNK_SIZE;
            const endByte = Math.min(startByte + CHUNK_SIZE, totalSize);
            const chunkBlob = file.slice(startByte, endByte);
            
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const cleanup = () => {
                    options.signal?.removeEventListener('abort', handleAbort);
                };
                
                const handleAbort = () => {
                    xhr.abort();
                    cleanup();
                    reject(new DOMException('Upload aborted', 'AbortError'));
                };
                
                const params = new URLSearchParams({ uploadId, chunkIndex: i.toString() });
                xhr.open('POST', `${getFileServerUrl()}/api/assets/upload-chunk?${params}`);
                xhr.setRequestHeader('Content-Type', 'application/octet-stream');
                
                xhr.upload.onprogress = (event) => {
                    const loadedInChunk = event.loaded;
                    const overallDelta = startByte + loadedInChunk;
                    const overallPercent = Math.max(0, Math.min(99, Math.round((overallDelta / totalSize) * 100)));
                    options.onProgress?.({ loaded: overallDelta, total: totalSize, percent: overallPercent });
                };
                
                xhr.onload = () => {
                    cleanup();
                    if (xhr.status < 200 || xhr.status >= 300) {
                        let errMsg = `Chunk ${i} upload failed with HTTP ${xhr.status}`;
                        try {
                            const resObj = JSON.parse(xhr.responseText || '{}');
                            if (resObj.error) errMsg = resObj.error;
                        } catch {
                            // Keep the HTTP fallback message when the response is not JSON.
                        }
                        reject(new Error(errMsg));
                        return;
                    }
                    resolve();
                };
                
                xhr.onerror = () => {
                    cleanup();
                    reject(new Error(`Network error during chunk ${i} upload`));
                };
                
                xhr.onabort = () => {
                    cleanup();
                    reject(new DOMException('Upload aborted', 'AbortError'));
                };
                
                if (options.signal?.aborted) {
                    handleAbort();
                    return;
                }
                
                options.signal?.addEventListener('abort', handleAbort, { once: true });
                xhr.send(chunkBlob);
            });
        }
        
        // 3. Отправляем запрос на сборку файла
        if (options.signal?.aborted) {
            throw new DOMException('Upload aborted', 'AbortError');
        }
        
        const assembleData = await apiFetch<{ success?: boolean; filename?: string; url?: string; error?: string }>('/api/assets/upload-chunk/assemble', {
            method: 'POST',
            body: JSON.stringify({ uploadId }),
            signal: options.signal
        });
        
        if (!assembleData.filename) {
            throw new Error(assembleData.error || 'Server failed to assemble asset chunks');
        }
        
        options.onProgress?.({ loaded: totalSize, total: totalSize, percent: 100 });
        return {
            filename: assembleData.filename,
            url: getAssetUrl(assembleData.url || assembleData.filename)
        };
        
    } catch (err) {
        // В случае любой ошибки/отмены отправляем запрос очистки
        await apiFetch('/api/assets/upload-chunk/cancel', {
            method: 'POST',
            body: JSON.stringify({ uploadId })
        }).catch(() => undefined);
        throw err;
    }
}

export interface EntityIdMigrationResult {
    database: string;
    player?: string;
    dryRun: boolean;
    scanned: number;
    changed: number;
    skipped: number;
    failed: number;
    files: Array<{
        path: string;
        relativePath: string;
        id: string;
        name: string;
        database: string;
        player?: string;
        source: string;
    }>;
    warnings: string[];
}

export interface BulkMigrationResult {
    success: boolean;
    dryRun: boolean;
    results?: EntityIdMigrationResult[];
    result?: EntityIdMigrationResult;
}

export async function migrateEntityIds(options: { dryRun?: boolean; database?: string; player?: string } = {}): Promise<BulkMigrationResult> {
    return apiFetch<BulkMigrationResult>('/api/world/migrate/entity-ids', {
        method: 'POST',
        body: JSON.stringify({
            dryRun: options.dryRun !== false,
            database: options.database || 'general',
            player: options.player
        })
    });
}
