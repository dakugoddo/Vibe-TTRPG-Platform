import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type AssetType = 'image' | 'audio' | 'model' | 'video' | 'other';

export interface AssetRecord {
    id: string;
    name: string;
    path: string;
    relativePath: string;
    ext: string;
    type: AssetType;
    mime: string;
    size: number;
    createdAt: string;
    modifiedAt: string;
    url: string;
}

const MIME_BY_EXT: Record<string, string> = {
    aac: 'audio/aac',
    avif: 'image/avif',
    fbx: 'model/fbx',
    flac: 'audio/flac',
    gif: 'image/gif',
    glb: 'model/gltf-binary',
    gltf: 'model/gltf+json',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    m4a: 'audio/mp4',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    obj: 'model/obj',
    ogg: 'audio/ogg',
    png: 'image/png',
    stl: 'model/stl',
    svg: 'image/svg+xml',
    wav: 'audio/wav',
    webm: 'video/webm',
    webp: 'image/webp',
};

export function normalizeAssetPath(assetPath: string): string {
    return assetPath.replace(/\\/g, '/').split('/').filter(Boolean).join('/');
}

export function createAssetId(assetPath: string): string {
    const normalizedPath = normalizeAssetPath(assetPath);
    const hash = crypto.createHash('sha1').update(normalizedPath).digest('hex').slice(0, 16);
    return `asset_${hash}`;
}

export function getAssetType(filename: string): AssetType {
    const ext = path.extname(filename).slice(1).toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'svg'].includes(ext)) return 'image';
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)) return 'audio';
    if (['glb', 'gltf', 'fbx', 'obj', 'stl'].includes(ext)) return 'model';
    if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
    return 'other';
}

export function getAssetMime(filename: string): string {
    const ext = path.extname(filename).slice(1).toLowerCase();
    return MIME_BY_EXT[ext] || 'application/octet-stream';
}

export function resolveAssetPath(assetsDir: string, requestedPath: string): string | null {
    const normalizedPath = normalizeAssetPath(requestedPath);
    const parts = normalizedPath.split('/');

    if (!normalizedPath || parts.some(part => part === '.' || part === '..')) {
        return null;
    }

    const root = path.resolve(assetsDir);
    const filePath = path.resolve(root, ...parts);
    const relative = path.relative(root, filePath);

    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        return null;
    }

    return filePath;
}

function collectAssetFiles(root: string, dir: string, output: string[]): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        const filePath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectAssetFiles(root, filePath, output);
            continue;
        }

        if (entry.isFile()) {
            output.push(normalizeAssetPath(path.relative(root, filePath)));
        }
    }
}

export function listAssetRecords(assetsDir: string): AssetRecord[] {
    if (!fs.existsSync(assetsDir)) return [];

    const relativePaths: string[] = [];
    collectAssetFiles(assetsDir, assetsDir, relativePaths);

    return relativePaths
        .sort((a, b) => a.localeCompare(b))
        .map((assetPath) => {
            const filePath = path.join(assetsDir, ...assetPath.split('/'));
            const stat = fs.statSync(filePath);
            const ext = path.extname(assetPath).slice(1).toLowerCase();

            return {
                id: createAssetId(assetPath),
                name: path.basename(assetPath),
                path: assetPath,
                relativePath: assetPath,
                ext,
                type: getAssetType(assetPath),
                mime: getAssetMime(assetPath),
                size: stat.size,
                createdAt: stat.birthtime.toISOString(),
                modifiedAt: stat.mtime.toISOString(),
                url: `/api/assets/file?path=${encodeURIComponent(assetPath)}`,
            };
        });
}
