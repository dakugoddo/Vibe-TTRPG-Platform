import type { AssetKind } from '../services/fileApi';

export const ASSET_DRAG_MIME = 'application/x-vibe-asset';

export interface AssetDragPayload {
    id: string;
    name: string;
    path: string;
    url: string;
    type: AssetKind;
}

export function writeAssetDragPayload(dataTransfer: DataTransfer, payload: AssetDragPayload): void {
    dataTransfer.setData(ASSET_DRAG_MIME, JSON.stringify(payload));
    dataTransfer.setData('text/plain', payload.path);
    dataTransfer.effectAllowed = payload.type === 'image' ? 'copy' : 'none';
}

export function readAssetDragPayload(dataTransfer: DataTransfer): AssetDragPayload | null {
    const raw = dataTransfer.getData(ASSET_DRAG_MIME);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as Partial<AssetDragPayload>;
        if (
            typeof parsed.id !== 'string' ||
            typeof parsed.name !== 'string' ||
            typeof parsed.path !== 'string' ||
            typeof parsed.url !== 'string' ||
            typeof parsed.type !== 'string'
        ) {
            return null;
        }

        if (!['image', 'audio', 'model', 'video', 'other'].includes(parsed.type)) return null;

        return {
            id: parsed.id,
            name: parsed.name,
            path: parsed.path,
            url: parsed.url,
            type: parsed.type,
        };
    } catch {
        return null;
    }
}
