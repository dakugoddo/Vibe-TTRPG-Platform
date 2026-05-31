/**
 * index.ts — Main entry point for the Vibe TTRPG File Server.
 * 
 * Express REST API + WebSocket for real-time file change notifications.
 * Runs on port 3001 alongside the Vite dev server (port 5173).
 * 
 * This server is ONLY started by the host (GM).
 * Players connect via Yjs/WebRTC and never touch this server directly.
 */

import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { setupWSConnection } = require('y-websocket/bin/utils');

import { createWorld, openWorld, getCurrentWorldPath, getCurrentWorldName, getAssetsPath, saveWorldIndex, getDbPath, loadAudioDeck, saveAudioDeck } from './worldManager.js';
import { resolveAssetPath } from './assetManager.js';
import { claimPlayerProfile, listPlayerProfiles, updatePlayerProfileRole } from './playerProfiles.js';
import {
    listEntities,
    readEntity,
    writeEntity,
    deleteEntity,
    importRawMarkdown,
    serializeEntity,
    migrateEntityIds,
} from './fileManager.js';
import { startWatching, stopWatching, addWsClient, getClientCount } from './fileWatcher.js';
import { renameEntity } from './renameManager.js';
import type { Entity, DatabaseType, UserRole } from './shared/types.js';

const PORT = 3001;
const app = express();
const server = createServer(app);

// ─── Middleware ───

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Access Logging Middleware
app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} from ${ip}`);
    next();
});

// ─── World Management ───

app.get('/api/world/status', (_req, res) => {
    const worldPath = getCurrentWorldPath();
    res.json({
        isOpen: !!worldPath,
        path: worldPath,
        worldName: getCurrentWorldName(),
        watcherClients: getClientCount(),
    });
});

app.post('/api/world/create', (req, res) => {
    try {
        const { path: worldPath, name } = req.body;
        if (!worldPath || !name) {
            res.status(400).json({ error: 'path and name are required' });
            return;
        }
        const meta = createWorld(worldPath, name);
        startWatching();
        res.json(meta);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

app.post('/api/world/open', (req, res) => {
    try {
        const { path: worldPath } = req.body;
        if (!worldPath) {
            res.status(400).json({ error: 'path is required' });
            return;
        }
        const meta = openWorld(worldPath);
        startWatching();
        res.json(meta);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

app.get('/api/world/audio-deck', (_req, res) => {
    try {
        const worldPath = getCurrentWorldPath();
        if (!worldPath) {
            res.status(400).json({ error: 'No world open' });
            return;
        }
        const data = loadAudioDeck();
        res.json(data || {});
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

app.post('/api/world/audio-deck', (req, res) => {
    try {
        const worldPath = getCurrentWorldPath();
        if (!worldPath) {
            res.status(400).json({ error: 'No world open' });
            return;
        }
        saveAudioDeck(req.body);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

app.post('/api/world/migrate/entity-ids', (req, res) => {
    try {
        const dryRun = req.body.dryRun !== false; // По умолчанию dryRun = true для безопасности
        const database = req.body.database || 'general';
        const player = req.body.player;

        if (database === 'all') {
            const results = [];
            
            // 1. General DB
            results.push(migrateEntityIds('general', undefined, { dryRun }));
            
            // 2. GM DB
            results.push(migrateEntityIds('gm', undefined, { dryRun }));
            
            // 3. Все базы игроков (users/*)
            const worldPath = getCurrentWorldPath();
            if (worldPath) {
                const usersDir = path.join(worldPath, 'users');
                if (fs.existsSync(usersDir)) {
                    const players = fs.readdirSync(usersDir).filter(f => {
                        return fs.statSync(path.join(usersDir, f)).isDirectory() && !f.startsWith('.');
                    });
                    for (const p of players) {
                        results.push(migrateEntityIds('user', p, { dryRun }));
                    }
                }
            }
            
            res.json({
                success: true,
                dryRun,
                results
            });
            return;
        }

        const result = migrateEntityIds(database as DatabaseType, player, { dryRun });
        res.json({
            success: true,
            dryRun,
            result
        });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

// ─── Players List ───

app.get('/api/players', (_req, res) => {
    try {
        const worldPath = getCurrentWorldPath();
        if (!worldPath) {
            res.status(400).json({ error: 'No world open' });
            return;
        }
        const usersPath = path.join(worldPath, 'users');
        if (!fs.existsSync(usersPath)) {
            res.json([]);
            return;
        }
        const players = fs.readdirSync(usersPath, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);
        res.json(players);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

app.get('/api/player-profiles', (_req, res) => {
    try {
        const worldPath = getCurrentWorldPath();
        if (!worldPath) {
            res.status(400).json({ error: 'No world open' });
            return;
        }
        res.json(listPlayerProfiles(worldPath));
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

app.post('/api/player-profiles/claim', (req, res) => {
    try {
        const worldPath = getCurrentWorldPath();
        if (!worldPath) {
            res.status(400).json({ error: 'No world open' });
            return;
        }

        const displayName = typeof req.body.displayName === 'string' ? req.body.displayName : '';
        if (!displayName.trim()) {
            res.status(400).json({ error: 'displayName is required' });
            return;
        }

        const requestedPlayerId = typeof req.body.requestedPlayerId === 'string' ? req.body.requestedPlayerId : undefined;
        res.json(claimPlayerProfile(worldPath, displayName, { requestedPlayerId }));
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

app.patch('/api/player-profiles/:playerId', (req, res) => {
    try {
        const worldPath = getCurrentWorldPath();
        if (!worldPath) {
            res.status(400).json({ error: 'No world open' });
            return;
        }

        const assignedRole = req.body.assignedRole as UserRole | undefined;
        if (!assignedRole) {
            res.status(400).json({ error: 'assignedRole is required' });
            return;
        }

        res.json(updatePlayerProfileRole(worldPath, req.params.playerId, assignedRole));
    } catch (err) {
        const message = (err as Error).message;
        res.status(message.includes('not found') ? 404 : 400).json({ error: message });
    }
});

// ─── Entity CRUD ───

app.get('/api/entities', (req, res) => {
    try {
        const db = (req.query.db as DatabaseType) || 'general';
        const player = req.query.player as string | undefined;
        const entities = listEntities(db, player);
        // Update .index.json for fast delta loading next time
        if (db === 'general') {
            const dbRoot = getDbPath(db, player);
            saveWorldIndex(entities as Array<{ id: string; name: string; type: string }>, dbRoot);
        }
        res.json(entities);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

app.get('/api/entities/:id', (req, res) => {
    try {
        const db = (req.query.db as DatabaseType) || 'general';
        const player = req.query.player as string | undefined;
        const entity = readEntity(db, req.params.id, player);
        if (!entity) {
            res.status(404).json({ error: `Entity not found: ${req.params.id}` });
            return;
        }
        res.json(entity);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

app.post('/api/entities', (req, res) => {
    try {
        const db = (req.query.db as DatabaseType) || 'general';
        const player = req.query.player as string | undefined;
        const entity = req.body as Entity;

        if (!entity.name || !entity.type) {
            res.status(400).json({ error: 'name and type are required' });
            return;
        }

        writeEntity(db, entity, player);
        res.status(201).json({ success: true, id: entity.id || entity.name });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

app.put('/api/entities/:id', (req, res) => {
    try {
        const db = (req.query.db as DatabaseType) || 'general';
        const player = req.query.player as string | undefined;
        const entity = req.body as Entity;

        writeEntity(db, entity, player);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

app.delete('/api/entities/:id', (req, res) => {
    try {
        const db = (req.query.db as DatabaseType) || 'general';
        const player = req.query.player as string | undefined;
        const deleted = deleteEntity(db, req.params.id, player);

        if (!deleted) {
            res.status(404).json({ error: `Entity not found: ${req.params.id}` });
            return;
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

// ─── Import: raw .md → Entity ───
// NOTE: This route MUST be before /api/entities/:id to avoid Express matching 'import' as :id

app.post('/api/entities/import', (req, res) => {
    try {
        const { content, filename } = req.body;
        const db = (req.query.db as DatabaseType) || 'general';

        if (!content || !filename) {
            res.status(400).json({ error: 'content and filename are required' });
            return;
        }

        const entity = importRawMarkdown(content, filename, db);
        res.status(201).json(entity);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

// ─── Rename (Problem #2: Atomic cascading rename) ───

app.post('/api/entities/:id/rename', (req, res) => {
    try {
        const db = (req.query.db as DatabaseType) || 'general';
        const { newName } = req.body;

        if (!newName) {
            res.status(400).json({ error: 'newName is required' });
            return;
        }

        const result = renameEntity(db, req.params.id, newName);

        if (!result.success && result.errors.length > 0) {
            res.status(result.errors[0].includes('not found') ? 404 : 500).json({
                error: result.errors.join('; '),
                updatedFiles: result.updatedFiles,
            });
            return;
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

// ─── Assets ───

app.get('/api/assets', (req, res) => {
    try {
        const assetsDir = getAssetsPath();
        if (!fs.existsSync(assetsDir)) {
            res.json([]);
            return;
        }
        const files = fs.readdirSync(assetsDir).filter(f => !f.startsWith('.'));
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

app.post('/api/assets/upload', (req, res) => {
    try {
        const { filename, base64 } = req.body;
        if (!filename || !base64) {
            res.status(400).json({ error: 'filename and base64 string are required' });
            return;
        }
        const assetsDir = getAssetsPath();
        if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true });
        }
        
        // ensure unique filename
        let finalFilename = filename;
        let counter = 1;
        while (fs.existsSync(path.join(assetsDir, finalFilename))) {
            const ext = path.extname(filename);
            const base = path.basename(filename, ext);
            finalFilename = `${base}_${counter}${ext}`;
            counter++;
        }

        const buffer = Buffer.from(base64, 'base64');
        const filePath = path.join(assetsDir, finalFilename);
        fs.writeFileSync(filePath, buffer);

        res.json({ success: true, filename: finalFilename, url: `/api/assets/${finalFilename}` });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

app.get('/api/assets/file', (req, res) => {
    try {
        const assetsDir = getAssetsPath();
        const requestedPath = req.query.path as string;
        if (!requestedPath) {
            res.status(400).json({ error: 'path query parameter is required' });
            return;
        }
        const filePath = resolveAssetPath(assetsDir, requestedPath);
        if (!filePath) {
            res.status(403).json({ error: 'Access denied or invalid path' });
            return;
        }
        if (!fs.existsSync(filePath)) {
            res.status(404).json({ error: 'File not found' });
            return;
        }
        res.sendFile(filePath);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

// Middleware для бинарных потоков
const rawOctetMiddleware = express.raw({ type: 'application/octet-stream', limit: '300mb' });

app.post('/api/assets/upload-binary', rawOctetMiddleware, (req, res) => {
    try {
        const filename = req.query.filename as string;
        if (!filename) {
            res.status(400).json({ error: 'filename query parameter is required' });
            return;
        }
        const assetsDir = getAssetsPath();
        if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true });
        }

        // Обеспечим уникальное имя в папке назначения
        const folder = req.query.folder as string || '';
        let targetDir = assetsDir;
        if (folder) {
            // Поддержка папок
            const resolvedFolder = resolveAssetPath(assetsDir, folder);
            if (resolvedFolder) {
                targetDir = resolvedFolder;
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }
            }
        }

        let finalFilename = filename;
        let counter = 1;
        while (fs.existsSync(path.join(targetDir, finalFilename))) {
            const ext = path.extname(filename);
            const base = path.basename(filename, ext);
            finalFilename = `${base}_${counter}${ext}`;
            counter++;
        }

        const buffer = req.body as Buffer;
        if (!buffer || buffer.length === 0) {
            res.status(400).json({ error: 'Empty file body' });
            return;
        }

        const targetPath = path.join(targetDir, finalFilename);
        fs.writeFileSync(targetPath, buffer);

        // Формируем относительный путь ассета (для сохранения на канвас или сущности)
        const relativeAssetPath = path.relative(assetsDir, targetPath).replace(/\\/g, '/');

        res.json({
            success: true,
            filename: finalFilename,
            path: relativeAssetPath,
            url: `/api/assets/file?path=${encodeURIComponent(relativeAssetPath)}`
        });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

// Временный каталог для чанков
function getChunksTempDir(uploadId: string): string {
    const assetsDir = getAssetsPath();
    return path.join(assetsDir, '.chunks', uploadId);
}

// 1. Инициализация сессии загрузки чанков
app.post('/api/assets/upload-chunk/start', (req, res) => {
    try {
        const { filename, fileSize } = req.body;
        if (!filename) {
            res.status(400).json({ error: 'filename is required in body' });
            return;
        }
        
        // Генерируем уникальный uploadId
        const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const tempDir = getChunksTempDir(uploadId);
        fs.mkdirSync(tempDir, { recursive: true });

        // Записываем метаданные во временный файл
        fs.writeFileSync(path.join(tempDir, 'metadata.json'), JSON.stringify({
            filename,
            fileSize,
            createdAt: Date.now()
        }));

        res.json({ uploadId, success: true });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

// 2. Загрузка чанка
app.post('/api/assets/upload-chunk', rawOctetMiddleware, (req, res) => {
    try {
        const uploadId = req.query.uploadId as string;
        const chunkIndexStr = req.query.chunkIndex as string;

        if (!uploadId || !chunkIndexStr) {
            res.status(400).json({ error: 'uploadId and chunkIndex parameters are required' });
            return;
        }

        const chunkIndex = parseInt(chunkIndexStr, 10);
        const tempDir = getChunksTempDir(uploadId);

        if (!fs.existsSync(tempDir)) {
            res.status(404).json({ error: 'Upload session not found or expired' });
            return;
        }

        const buffer = req.body as Buffer;
        if (!buffer || buffer.length === 0) {
            res.status(400).json({ error: 'Chunk buffer is empty' });
            return;
        }

        const chunkPath = path.join(tempDir, `chunk_${chunkIndex}`);
        fs.writeFileSync(chunkPath, buffer);

        res.json({ success: true, chunkIndex });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

// 3. Сборка файла из чанков
app.post('/api/assets/upload-chunk/assemble', (req, res) => {
    try {
        const { uploadId } = req.body;
        if (!uploadId) {
            res.status(400).json({ error: 'uploadId is required in body' });
            return;
        }

        const tempDir = getChunksTempDir(uploadId);
        if (!fs.existsSync(tempDir)) {
            res.status(404).json({ error: 'Upload session not found' });
            return;
        }

        // Читаем метаданные
        const metadataPath = path.join(tempDir, 'metadata.json');
        if (!fs.existsSync(metadataPath)) {
            res.status(400).json({ error: 'Metadata file is missing in upload session' });
            return;
        }
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        const filename = metadata.filename;

        const assetsDir = getAssetsPath();
        if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true });
        }

        // Ищем чанки в папке
        const files = fs.readdirSync(tempDir);
        const chunkFiles = files
            .filter(f => f.startsWith('chunk_'))
            .sort((a, b) => {
                const idxA = parseInt(a.split('_')[1], 10);
                const idxB = parseInt(b.split('_')[1], 10);
                return idxA - idxB;
            });

        if (chunkFiles.length === 0) {
            res.status(400).json({ error: 'No chunks found to assemble' });
            return;
        }

        // Обеспечим уникальное имя
        let finalFilename = filename;
        let counter = 1;
        while (fs.existsSync(path.join(assetsDir, finalFilename))) {
            const ext = path.extname(filename);
            const base = path.basename(filename, ext);
            finalFilename = `${base}_${counter}${ext}`;
            counter++;
        }

        const targetPath = path.join(assetsDir, finalFilename);
        const writeStream = fs.createWriteStream(targetPath);

        // Последовательно склеиваем чанки
        for (const chunkFile of chunkFiles) {
            const chunkPath = path.join(tempDir, chunkFile);
            const chunkBuffer = fs.readFileSync(chunkPath);
            writeStream.write(chunkBuffer);
        }
        writeStream.end();

        // Удаляем временную папку
        fs.rmSync(tempDir, { recursive: true, force: true });

        // Если итоговая директория .chunks осталась пустой — вычистим её
        const chunksParent = path.join(assetsDir, '.chunks');
        if (fs.existsSync(chunksParent) && fs.readdirSync(chunksParent).length === 0) {
            fs.rmdirSync(chunksParent);
        }

        res.json({
            success: true,
            filename: finalFilename,
            path: finalFilename,
            url: `/api/assets/file?path=${encodeURIComponent(finalFilename)}`
        });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

// 4. Отмена сессии и удаление временных файлов
app.post('/api/assets/upload-chunk/cancel', (req, res) => {
    try {
        const { uploadId } = req.body;
        if (!uploadId) {
            res.status(400).json({ error: 'uploadId is required' });
            return;
        }
        const tempDir = getChunksTempDir(uploadId);
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

app.get('/api/assets/:filename', (req, res) => {
    try {
        const assetsDir = getAssetsPath();
        const filePath = path.join(assetsDir, req.params.filename);

        // Security: prevent path traversal
        if (!path.resolve(filePath).startsWith(path.resolve(assetsDir))) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        if (!fs.existsSync(filePath)) {
            res.status(404).json({ error: 'Asset not found' });
            return;
        }

        res.sendFile(filePath);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

// ─── WebSocket for file change notifications ───

const watchWss = new WebSocketServer({ noServer: true });

watchWss.on('connection', (ws) => {
    console.log('🔌 File Watcher WebSocket connected');
    addWsClient(ws);

    ws.on('close', () => {
        console.log('🔌 File Watcher WebSocket disconnected');
    });
});

// ─── Yjs WebSocket Sync ───

const yjsWss = new WebSocketServer({ noServer: true });

yjsWss.on('connection', (ws, req) => {
    console.log(`📡 Yjs WebSockets connection established on path ${req.url}`);
    setupWSConnection(ws, req);
});

// ─── Upgrade Server Manually ───

server.on('upgrade', (request, socket, head) => {
    const pathname = request.url;

    if (pathname === '/ws/watch') {
        watchWss.handleUpgrade(request, socket, head, (ws) => {
            watchWss.emit('connection', ws, request);
        });
    } else if (pathname?.startsWith('/ws/world') || pathname?.startsWith('/ws/canvas/')) {
        yjsWss.handleUpgrade(request, socket, head, (ws) => {
            yjsWss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});

// ─── Graceful shutdown (Problem #4.4) ───

function shutdown() {
    console.log('\n🛑 Shutting down...');
    stopWatching();
    watchWss.close();
    yjsWss.close();
    server.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ─── Start ───

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════╗
║   🎲 Vibe TTRPG File Server             ║
║   Port: ${PORT}                            ║
║   Status: Running                        ║
╚══════════════════════════════════════════╝
    `);
    console.log('Endpoints:');
    console.log('  POST /api/world/create   — Create new world');
    console.log('  POST /api/world/open     — Open existing world');
    console.log('  GET  /api/entities       — List entities');
    console.log('  WS   /ws/watch           — File change notifications');
    console.log('  WS   /ws/world           — Global Yjs sync');
    console.log('  WS   /ws/canvas/<id>     — Canvas Yjs sync');
    console.log('');
});
