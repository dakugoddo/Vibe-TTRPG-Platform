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

import { createWorld, openWorld, getCurrentWorldPath, getCurrentWorldName, getAssetsPath, saveWorldIndex, getDbPath } from './worldManager.js';
import {
    listEntities,
    readEntity,
    writeEntity,
    deleteEntity,
    importRawMarkdown,
    serializeEntity,
} from './fileManager.js';
import { startWatching, stopWatching, addWsClient, getClientCount } from './fileWatcher.js';
import { renameEntity } from './renameManager.js';
import type { Entity, DatabaseType } from './shared/types.js';

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
