/**
 * fileApi.ts — Client API for communicating with the Vibe TTRPG File Server.
 * 
 * IMPORTANT: Only the HOST (GM) calls these functions.
 * Players get all data via Yjs/WebRTC sync.
 * 
 * The `shouldCallFileApi()` check prevents players from making
 * unnecessary requests to a server that may not even be running.
 */

import type { Entity } from '../types';

const SERVER_URL = 'http://localhost:3001';

export type DatabaseType = 'general' | 'user' | 'gm';

export interface WorldMeta {
    name: string;
    path: string;
    createdAt: string;
    version: string;
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
            const res = await fetch(`${SERVER_URL}/api/world/status`, {
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

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${SERVER_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
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

export async function getAudioDeck(): Promise<any> {
    if (!(await shouldCallFileApi())) return null;
    return apiFetch('/api/world/audio-deck');
}

export async function saveAudioDeck(data: any): Promise<void> {
    if (!(await shouldCallFileApi())) return;
    return apiFetch('/api/world/audio-deck', {
        method: 'POST',
        body: JSON.stringify(data),
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

export function getAssetUrl(filename: string): string {
    return `${SERVER_URL}/api/assets/${encodeURIComponent(filename)}`;
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
    type: 'image' | 'audio' | 'model' | 'video' | 'other';
    mime: string;
    size: number;
    createdAt: string;
    modifiedAt: string;
    url: string;
}

export type AssetKind = 'all' | 'image' | 'audio' | 'model' | 'video' | 'other';

export interface UploadAssetFileOptions {
    onProgress?: (progress: { loaded: number; total: number; percent: number }) => void;
    signal?: AbortSignal;
}

export async function listAssetRecords(): Promise<AssetRecord[]> {
    if (!(await shouldCallFileApi())) return [];
    return apiFetch('/api/assets/index');
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

export async function renameEntityFileToTitle(db: DatabaseType, id: string, title: string, player?: string, options?: { dryRun?: boolean }): Promise<any> {
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
        url: data.url || getAssetUrl(data.filename),
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

        xhr.open('POST', `${SERVER_URL}/api/assets/upload-binary?${params}`);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');

        xhr.upload.onprogress = (event) => {
            const total = event.lengthComputable ? event.total : file.size;
            const loaded = event.loaded;
            const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((loaded / total) * 100))) : 0;
            options.onProgress?.({ loaded, total, percent });
        };

        xhr.onload = () => {
            cleanup();
            let data: { success?: boolean; filename?: string; url?: string; error?: string } = {};
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
                url: data.url || getAssetUrl(data.filename),
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
                xhr.open('POST', `${SERVER_URL}/api/assets/upload-chunk?${params}`);
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
                        } catch {}
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
            url: assembleData.url || getAssetUrl(assembleData.filename)
        };
        
    } catch (err) {
        // В случае любой ошибки/отмены отправляем запрос очистки
        try {
            await apiFetch('/api/assets/upload-chunk/cancel', {
                method: 'POST',
                body: JSON.stringify({ uploadId })
            }).catch(() => {});
        } catch {}
        throw err;
    }
}
