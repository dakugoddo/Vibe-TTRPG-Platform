import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowDownAZ, Box, CheckSquare, File, FolderOpen, Image, Music, RefreshCw, Search, Trash2, Upload, Video, Wand2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { deleteAssetFile, getAssetUrl, getIsHost, listAssetRecords, showAssetInExplorer, uploadAsset, uploadAssetFile, uploadAssetFileToHost, type AssetRecord } from '../../services/fileApi';
import { loadAudioDuration } from '../../services/audioPlayback';
import { yjsStore } from '../../store/yjsStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useUIStore } from '../../store/uiStore';
import { useAppModuleEnabled } from '../../hooks/useAppModuleEnablement';
import { useMediaLoadState } from '../../hooks/useMediaLoadState';
import { writeAssetDragPayload } from '../../utils/assetDrag';
import { findCanvasInlineImages, replaceInlineCanvasImage } from '../../utils/canvasInlineImageMigration';
import { dataUrlToBase64 } from '../../utils/fileRead';
import { LARGE_ASSET_UPLOAD_APPROVAL_BYTES, formatNotificationFileSize } from '../../utils/notificationModel';
import { createLargeUploadApprovalRequest } from '../../utils/sessionNotificationModel';
import { glass } from '../../utils/theme';
import type { Entity, SessionNotificationEvent } from '../../types';

type AssetKind = 'all' | 'image' | 'audio' | 'model' | 'video' | 'pdf' | 'other';
type AssetSort = 'name' | 'modified' | 'size' | 'type';

type AssetItem = AssetRecord & { kind: Exclude<AssetKind, 'all'> };

const FILTERS: { id: AssetKind; labelKey: string }[] = [
    { id: 'all', labelKey: 'assetBrowser.filters.all' },
    { id: 'image', labelKey: 'assetBrowser.filters.image' },
    { id: 'audio', labelKey: 'assetBrowser.filters.audio' },
    { id: 'model', labelKey: 'assetBrowser.filters.model' },
    { id: 'video', labelKey: 'assetBrowser.filters.video' },
    { id: 'pdf', labelKey: 'assetBrowser.filters.pdf' },
    { id: 'other', labelKey: 'assetBrowser.filters.other' },
];

const SORT_OPTIONS: Array<{ id: AssetSort; labelKey: string }> = [
    { id: 'name', labelKey: 'assetBrowser.sort.name' },
    { id: 'modified', labelKey: 'assetBrowser.sort.modified' },
    { id: 'size', labelKey: 'assetBrowser.sort.size' },
    { id: 'type', labelKey: 'assetBrowser.sort.type' },
];

const MAX_BINARY_UPLOAD_BYTES = 250 * 1024 * 1024;
const assetPanelClass = 'rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] p-4 shadow-[var(--vibe-shadow-block)]';
const assetToolbarButtonClass = 'flex h-8 w-8 items-center justify-center rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)] disabled:opacity-40';
const assetDangerButtonClass = 'border-[color-mix(in_srgb,var(--vibe-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--vibe-danger)_12%,transparent)] text-[var(--vibe-danger)] hover:bg-[color-mix(in_srgb,var(--vibe-danger)_20%,transparent)]';
const assetSuccessPanelClass = 'border-[color-mix(in_srgb,var(--vibe-success)_24%,transparent)] bg-[color-mix(in_srgb,var(--vibe-success)_10%,transparent)]';
const assetWarningPanelClass = 'border-[color-mix(in_srgb,var(--vibe-warning)_28%,transparent)] bg-[color-mix(in_srgb,var(--vibe-warning)_12%,transparent)]';

function getAssetKind(filename: string): AssetItem['kind'] {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'svg'].includes(ext)) return 'image';
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)) return 'audio';
    if (['glb', 'gltf', 'fbx', 'obj', 'stl'].includes(ext)) return 'model';
    if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
    if (ext === 'pdf') return 'pdf';
    return 'other';
}

function getAssetIcon(kind: AssetItem['kind']) {
    if (kind === 'image') return Image;
    if (kind === 'audio') return Music;
    if (kind === 'model') return Box;
    if (kind === 'video') return Video;
    return File;
}

function formatAudioDuration(duration: number | null | undefined): string | null {
    if (duration == null) return null;
    const totalSeconds = Math.max(0, Math.round(duration));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
}

interface AssetMediaPreviewProps {
    asset: AssetItem;
    icon: LucideIcon;
    pdfPreviewEnabled: boolean;
}

function AssetMediaPreview({ asset, icon: Icon, pdfPreviewEnabled }: AssetMediaPreviewProps) {
    const { t } = useTranslation();
    const canPreviewMedia = asset.kind === 'image' || asset.kind === 'video' || (asset.kind === 'pdf' && pdfPreviewEnabled);
    const media = useMediaLoadState(canPreviewMedia ? asset.url : '');

    if (!canPreviewMedia) {
        return <Icon size={34} className="text-[var(--vibe-text-faint)]" />;
    }

    return (
        <>
            {asset.kind === 'image' ? (
                <img
                    src={media.mediaSrc}
                    alt=""
                    onLoad={media.markReady}
                    onError={media.markError}
                    className={`h-full w-full object-cover transition-all duration-300 group-hover:scale-105 ${media.isLoading ? 'opacity-35' : 'opacity-100'}`}
                />
            ) : asset.kind === 'video' ? (
                <video
                    src={media.mediaSrc}
                    className={`h-full w-full object-cover transition-opacity duration-300 ${media.isLoading ? 'opacity-35' : 'opacity-100'}`}
                    muted
                    controls
                    preload="metadata"
                    onLoadedMetadata={media.markReady}
                    onError={media.markError}
                    onClick={(event) => event.stopPropagation()}
                />
            ) : (
                <iframe
                    src={media.mediaSrc}
                    title={asset.name}
                    onLoad={media.markReady}
                    className={`h-full w-full border-0 bg-white transition-opacity duration-300 ${media.isLoading ? 'opacity-35' : 'opacity-100'}`}
                />
            )}

            {media.isLoading && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-[color-mix(in_srgb,var(--vibe-body-bg)_42%,transparent)] text-[var(--vibe-text-faint)] backdrop-blur-sm">
                    <RefreshCw size={18} className="mb-1.5 animate-spin" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">{t('assetBrowser.preview.loading')}</span>
                </div>
            )}

            {media.isError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[color-mix(in_srgb,var(--vibe-body-bg)_72%,transparent)] p-3 text-center text-[var(--vibe-danger)] backdrop-blur-sm">
                    <AlertTriangle size={22} className="mb-1.5" />
                    <div className="mb-2 max-w-full text-[10px] font-bold leading-snug">
                        {t('assetBrowser.preview.failed')}
                    </div>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            media.retry();
                        }}
                        className="inline-flex items-center gap-1 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-danger)_34%,transparent)] bg-[color-mix(in_srgb,var(--vibe-danger)_12%,transparent)] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-danger)_20%,transparent)]"
                    >
                        <RefreshCw size={11} />
                        {t('common.retry')}
                    </button>
                </div>
            )}
        </>
    );
}

export function AssetBrowser() {
    const { t, i18n } = useTranslation();
    const [assets, setAssets] = useState<AssetRecord[]>([]);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<AssetKind>('all');
    const [sortBy, setSortBy] = useState<AssetSort>('name');
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isMigratingInlineImages, setIsMigratingInlineImages] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [entitySnapshot, setEntitySnapshot] = useState<Entity[]>(() => Array.from(yjsStore.entitiesMap.values()));
    const [audioDurations, setAudioDurations] = useState<Record<string, number | null>>({});
    const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
    const [lastSelectedAssetId, setLastSelectedAssetId] = useState<string | null>(null);
    const { openConfirm } = useUIStore();
    const addNotification = useNotificationStore((state) => state.addNotification);
    const updateNotification = useNotificationStore((state) => state.updateNotification);
    const updateNotificationProgress = useNotificationStore((state) => state.updateProgress);
    const registerAbortCallback = useNotificationStore((state) => state.registerAbortCallback);
    const unregisterAbortCallback = useNotificationStore((state) => state.unregisterAbortCallback);
    const registerRetryCallback = useNotificationStore((state) => state.registerRetryCallback);
    const unregisterRetryCallback = useNotificationStore((state) => state.unregisterRetryCallback);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const pendingPlayerUploadFilesRef = useRef<Map<string, File>>(new Map());
    const uploadProgressThrottleRef = useRef<Map<string, { percent: number; updatedAt: number }>>(new Map());
    const [pdfPreviewEnabled] = useAppModuleEnabled('pdfViewer');
    const isHost = getIsHost();

    const loadAssets = useCallback(async () => {
        if (!isHost) return;
        setIsLoading(true);
        setError(null);
        try {
            setAssets(await listAssetRecords());
        } catch (err) {
            setError((err as Error).message);
            setAssets([]);
        } finally {
            setIsLoading(false);
        }
    }, [isHost]);

    const performHostUpload = useCallback(async (file: File, notificationId: string) => {
        const controller = new AbortController();
        registerAbortCallback(notificationId, () => {
            controller.abort();
        });

        pendingPlayerUploadFilesRef.current.set(notificationId, file);
        unregisterRetryCallback(notificationId);

        updateNotification(notificationId, {
            status: 'pending',
            kind: 'progress',
            progress: 0,
            actions: [{ id: 'cancel-upload', label: t('common.cancel'), tone: 'danger' }],
        });

        try {
            await uploadAssetFile(file, {
                signal: controller.signal,
                onProgress: (progress) => updateNotificationProgress(notificationId, progress.percent),
            });
            updateNotification(notificationId, {
                kind: 'success',
                status: 'done',
                title: t('assetBrowser.upload.fileUploaded'),
                message: `${file.name} • ${formatNotificationFileSize(file.size)}`,
                progress: 100,
                actions: [],
            });
            unregisterAbortCallback(notificationId);
            pendingPlayerUploadFilesRef.current.delete(notificationId);
            await loadAssets();
        } catch (err) {
            unregisterAbortCallback(notificationId);
            const isAbort = (err as Error).name === 'AbortError';
            if (isAbort) {
                updateNotification(notificationId, {
                    kind: 'warning',
                    status: 'failed',
                    title: t('assetBrowser.upload.cancelled'),
                    message: `${file.name}`,
                    actions: [{ id: 'retry-upload', label: t('common.retry'), tone: 'primary' }],
                });
            } else {
                updateNotification(notificationId, {
                    kind: 'error',
                    status: 'failed',
                    title: t('assetBrowser.upload.failed'),
                    message: `${file.name}: ${(err as Error).message}`,
                    actions: [{ id: 'retry-upload', label: t('common.retry'), tone: 'primary' }],
                });
            }

            registerRetryCallback(notificationId, () => {
                void performHostUpload(file, notificationId);
            });
        }
    }, [registerAbortCallback, unregisterAbortCallback, registerRetryCallback, unregisterRetryCallback, t, updateNotification, updateNotificationProgress, loadAssets]);

    const performPlayerDirectUpload = useCallback(async (file: File, notificationId: string) => {
        const controller = new AbortController();
        registerAbortCallback(notificationId, () => {
            controller.abort();
        });

        pendingPlayerUploadFilesRef.current.set(notificationId, file);
        unregisterRetryCallback(notificationId);

        updateNotification(notificationId, {
            status: 'pending',
            kind: 'progress',
            progress: 0,
            actions: [{ id: 'cancel-upload', label: t('common.cancel'), tone: 'danger' }],
        });

        try {
            await uploadAssetFileToHost(file, {
                signal: controller.signal,
                onProgress: (progress) => updateNotificationProgress(notificationId, progress.percent),
            });
            updateNotification(notificationId, {
                kind: 'success',
                status: 'done',
                title: t('assetBrowser.upload.fileUploaded'),
                message: `${file.name} • ${formatNotificationFileSize(file.size)}`,
                progress: 100,
                actions: [],
            });
            unregisterAbortCallback(notificationId);
            pendingPlayerUploadFilesRef.current.delete(notificationId);
        } catch (err) {
            unregisterAbortCallback(notificationId);
            const isAbort = (err as Error).name === 'AbortError';
            if (isAbort) {
                updateNotification(notificationId, {
                    kind: 'warning',
                    status: 'failed',
                    title: t('assetBrowser.upload.cancelled'),
                    message: `${file.name}`,
                    actions: [{ id: 'retry-upload', label: t('common.retry'), tone: 'primary' }],
                });
            } else {
                updateNotification(notificationId, {
                    kind: 'error',
                    status: 'failed',
                    title: t('assetBrowser.upload.failed'),
                    message: `${file.name}: ${(err as Error).message}`,
                    actions: [{ id: 'retry-upload', label: t('common.retry'), tone: 'primary' }],
                });
            }

            registerRetryCallback(notificationId, () => {
                void performPlayerDirectUpload(file, notificationId);
            });
        }
    }, [registerAbortCallback, unregisterAbortCallback, registerRetryCallback, unregisterRetryCallback, t, updateNotification, updateNotificationProgress]);

    const performPlayerApprovedUpload = useCallback(async (file: File, sessionNotificationId: string) => {
        const localId = `session-${sessionNotificationId}`;
        const controller = new AbortController();

        registerAbortCallback(localId, () => {
            controller.abort();
        });
        unregisterRetryCallback(localId);

        pendingPlayerUploadFilesRef.current.set(sessionNotificationId, file);

        try {
            yjsStore.updateSessionNotification(sessionNotificationId, {
                status: 'uploading',
                payload: { uploadProgress: 0 },
            });

            const uploaded = await uploadAssetFileToHost(file, {
                signal: controller.signal,
                onProgress: (progress) => {
                    const previous = uploadProgressThrottleRef.current.get(sessionNotificationId);
                    const now = Date.now();
                    const percentDelta = previous ? Math.abs(progress.percent - previous.percent) : 100;
                    const elapsed = previous ? now - previous.updatedAt : Number.POSITIVE_INFINITY;
                    const shouldSendProgress = progress.percent >= 100 || percentDelta >= 2 || elapsed >= 500;
                    if (!shouldSendProgress) return;

                    uploadProgressThrottleRef.current.set(sessionNotificationId, {
                        percent: progress.percent,
                        updatedAt: now,
                    });
                    yjsStore.updateSessionNotification(sessionNotificationId, {
                        status: 'uploading',
                        payload: {
                            uploadProgress: progress.percent,
                            uploadedBytes: progress.loaded,
                            totalBytes: progress.total,
                        },
                    });
                },
            });

            yjsStore.updateSessionNotification(sessionNotificationId, {
                status: 'done',
                message: `${file.name} • ${formatNotificationFileSize(file.size)}`,
                payload: {
                    uploadProgress: 100,
                    uploadedAssetPath: uploaded.filename,
                },
            });
            unregisterAbortCallback(localId);
            uploadProgressThrottleRef.current.delete(sessionNotificationId);
            pendingPlayerUploadFilesRef.current.delete(sessionNotificationId);
        } catch (err) {
            unregisterAbortCallback(localId);
            uploadProgressThrottleRef.current.delete(sessionNotificationId);

            const isAbort = (err as Error).name === 'AbortError';
            const errorMsg = isAbort ? t('assetBrowser.upload.cancelled') : (err as Error).message;

            yjsStore.updateSessionNotification(sessionNotificationId, {
                status: 'failed',
                message: `${file.name}: ${errorMsg}`,
                payload: {
                    uploadError: errorMsg,
                },
            });

            registerRetryCallback(localId, () => {
                void performPlayerApprovedUpload(file, sessionNotificationId);
            });
        }
    }, [registerAbortCallback, unregisterAbortCallback, registerRetryCallback, unregisterRetryCallback, t]);

    useEffect(() => {
        void loadAssets();
    }, [loadAssets]);

    useEffect(() => {
        const handleEntityChange = () => setEntitySnapshot(Array.from(yjsStore.entitiesMap.values()));
        yjsStore.entitiesMap.observe(handleEntityChange);
        return () => yjsStore.entitiesMap.unobserve(handleEntityChange);
    }, []);

    useEffect(() => {
        const handleSessionNotification = (notification: SessionNotificationEvent) => {
            if (notification.type !== 'large-upload-approval') return;
            if (isHost) {
                if (notification.status === 'done') void loadAssets();
                return;
            }

            if (notification.status === 'rejected') {
                const isMine = Boolean(
                    (notification.actorId && notification.actorId === yjsStore.localPlayerId)
                    || (notification.actorName && notification.actorName === yjsStore.localPlayerName)
                );
                if (isMine) {
                    pendingPlayerUploadFilesRef.current.delete(notification.id);
                }
                return;
            }

            if (notification.status !== 'approved') return;
            const isMine = Boolean(
                (notification.actorId && notification.actorId === yjsStore.localPlayerId)
                || (notification.actorName && notification.actorName === yjsStore.localPlayerName)
            );
            if (!isMine) return;

            const file = pendingPlayerUploadFilesRef.current.get(notification.id);
            if (!file) return;
            pendingPlayerUploadFilesRef.current.delete(notification.id);
            uploadProgressThrottleRef.current.delete(notification.id);

            void performPlayerApprovedUpload(file, notification.id);
        };

        return yjsStore.observeSessionNotifications(handleSessionNotification);
    }, [isHost, loadAssets, performPlayerApprovedUpload]);

    const items = useMemo<AssetItem[]>(() => {
        return assets.map((asset) => {
            const ext = asset.ext || (asset.name.includes('.') ? asset.name.split('.').pop()?.toLowerCase() || '' : '');
            return {
                ...asset,
                ext,
                kind: asset.type || getAssetKind(asset.name),
                path: asset.path || asset.relativePath || asset.name,
                relativePath: asset.relativePath || asset.path || asset.name,
                url: asset.url || getAssetUrl(asset.path || asset.relativePath || asset.name),
            };
        });
    }, [assets]);

    const visibleItems = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        const sortLocale = i18n.language || undefined;
        const filteredItems = items.filter((item) => {
            if (filter !== 'all' && item.kind !== filter) return false;
            if (!normalizedQuery) return true;
            return item.name.toLowerCase().includes(normalizedQuery)
                || item.path.toLowerCase().includes(normalizedQuery)
                || item.id.toLowerCase().includes(normalizedQuery)
                || item.ext.includes(normalizedQuery);
        });

        return [...filteredItems].sort((left, right) => {
            if (sortBy === 'modified') {
                return Date.parse(right.modifiedAt || right.createdAt || '') - Date.parse(left.modifiedAt || left.createdAt || '');
            }
            if (sortBy === 'size') {
                return right.size - left.size || left.name.localeCompare(right.name, sortLocale);
            }
            if (sortBy === 'type') {
                return left.kind.localeCompare(right.kind, sortLocale) || left.name.localeCompare(right.name, sortLocale);
            }
            return left.name.localeCompare(right.name, sortLocale);
        });
    }, [filter, i18n.language, items, query, sortBy]);

    const visibleAssetIds = useMemo(() => visibleItems.map(item => item.id), [visibleItems]);

    const selectedAssets = useMemo(() => {
        return selectedAssetIds
            .map(id => visibleItems.find(item => item.id === id))
            .filter((asset): asset is AssetItem => Boolean(asset));
    }, [selectedAssetIds, visibleItems]);

    const selectedAssetIdSet = useMemo(() => new Set(selectedAssets.map(asset => asset.id)), [selectedAssets]);

    const counts = useMemo(() => {
        return items.reduce<Record<AssetKind, number>>((acc, item) => {
            acc.all += 1;
            acc[item.kind] += 1;
            return acc;
        }, { all: 0, image: 0, audio: 0, model: 0, video: 0, pdf: 0, other: 0 });
    }, [items]);
    const inlineCanvasImages = useMemo(() => findCanvasInlineImages(entitySnapshot), [entitySnapshot]);
    const inlineCanvasImagesSizeKb = useMemo(() => {
        return Math.ceil(inlineCanvasImages.reduce((total, image) => total + image.sizeBytes, 0) / 1024);
    }, [inlineCanvasImages]);

    useEffect(() => {
        if (filter !== 'audio') return;

        const pendingAudioItems = visibleItems
            .filter((asset) => asset.kind === 'audio' && !(asset.id in audioDurations))
            .slice(0, 8);

        if (pendingAudioItems.length === 0) return;

        let cancelled = false;
        void Promise.all(pendingAudioItems.map(async (asset) => [asset.id, await loadAudioDuration(asset.url)] as const))
            .then((loadedDurations) => {
                if (cancelled) return;
                setAudioDurations((current) => {
                    const next = { ...current };
                    for (const [assetId, duration] of loadedDurations) {
                        if (!(assetId in next)) next[assetId] = duration;
                    }
                    return next;
                });
            });

        return () => {
            cancelled = true;
        };
    }, [audioDurations, filter, visibleItems]);

    const clearAssetSelection = useCallback(() => {
        setSelectedAssetIds([]);
        setLastSelectedAssetId(null);
    }, []);

    const handleAssetSelectionClick = useCallback((assetId: string, event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (target.closest('button,input,a')) return;

        if (event.shiftKey && lastSelectedAssetId) {
            const fromIndex = visibleAssetIds.indexOf(lastSelectedAssetId);
            const toIndex = visibleAssetIds.indexOf(assetId);
            if (fromIndex >= 0 && toIndex >= 0) {
                const start = Math.min(fromIndex, toIndex);
                const end = Math.max(fromIndex, toIndex);
                const rangeIds = visibleAssetIds.slice(start, end + 1);
                setSelectedAssetIds((current) => Array.from(new Set([...current, ...rangeIds])));
            } else {
                setSelectedAssetIds([assetId]);
            }
        } else if (event.ctrlKey || event.metaKey) {
            setSelectedAssetIds((current) => {
                if (current.includes(assetId)) return current.filter(id => id !== assetId);
                return [...current, assetId];
            });
        } else {
            setSelectedAssetIds([assetId]);
        }

        setLastSelectedAssetId(assetId);
    }, [lastSelectedAssetId, visibleAssetIds]);

    const handleUploadFiles = useCallback(async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;

        setIsUploading(true);
        setError(null);
        try {
            for (const file of Array.from(fileList)) {
                if (!isHost) {
                    if (file.size > MAX_BINARY_UPLOAD_BYTES) {
                        addNotification({
                            kind: 'warning',
                            scope: 'local',
                            title: t('assetBrowser.upload.fileTooLarge'),
                            message: t('assetBrowser.upload.fileTooLargeMessage', {
                                file: file.name,
                                size: formatNotificationFileSize(file.size),
                            }),
                        });
                        continue;
                    }

                    if (file.size <= LARGE_ASSET_UPLOAD_APPROVAL_BYTES) {
                        const uploadNotification = addNotification({
                            kind: 'progress',
                            scope: 'player',
                            status: 'pending',
                            title: t('assetBrowser.upload.fileUpload'),
                            message: `${file.name} • ${formatNotificationFileSize(file.size)}`,
                            progress: 0,
                            payload: {
                                fileName: file.name,
                                size: file.size,
                            },
                        });
                        void performPlayerDirectUpload(file, uploadNotification.id);
                        continue;
                    }

                    const request = yjsStore.sendSessionNotification(createLargeUploadApprovalRequest({
                        fileName: file.name,
                        fileSize: file.size,
                        mime: file.type,
                        destination: 'assets',
                        source: 'asset-browser',
                    }));
                    pendingPlayerUploadFilesRef.current.set(request.id, file);
                    continue;
                }

                if (file.size > MAX_BINARY_UPLOAD_BYTES) {
                    throw new Error(t('assetBrowser.upload.fastTooLargeError', { file: file.name }));
                }

                const isLargeUpload = file.size > LARGE_ASSET_UPLOAD_APPROVAL_BYTES;
                const uploadNotification = addNotification({
                    kind: 'progress',
                    scope: 'local',
                    status: 'pending',
                    title: isLargeUpload ? t('assetBrowser.upload.largeFile') : t('assetBrowser.upload.fileUpload'),
                    message: `${file.name} • ${formatNotificationFileSize(file.size)}`,
                    progress: 0,
                    payload: {
                        fileName: file.name,
                        size: file.size,
                        requiresGmApproval: isLargeUpload,
                    },
                });
                void performHostUpload(file, uploadNotification.id);
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [addNotification, isHost, performHostUpload, performPlayerDirectUpload, t]);

    const handleMigrateInlineCanvasImages = useCallback(async () => {
        if (inlineCanvasImages.length === 0) return;

        setIsMigratingInlineImages(true);
        setError(null);
        try {
            let migrated = 0;
            const latestCanvasById = new Map<string, Entity>();

            for (const inlineImage of inlineCanvasImages) {
                const currentCanvas = latestCanvasById.get(inlineImage.canvasId) || yjsStore.entitiesMap.get(inlineImage.canvasId);
                if (!currentCanvas) continue;

                const uploaded = await uploadAsset(inlineImage.filename, dataUrlToBase64(inlineImage.dataUrl));
                const replacement = replaceInlineCanvasImage(currentCanvas, inlineImage.elementId, uploaded.filename);
                if (!replacement) continue;

                if (yjsStore.updateEntity(inlineImage.canvasId, { properties: replacement.entity.properties })) {
                    latestCanvasById.set(inlineImage.canvasId, replacement.entity);
                    migrated += 1;
                }
            }

            if (migrated > 0) {
                yjsStore.sendMessage(t('assetBrowser.inline.migratedMessage', { count: migrated }), t('common.system'), true);
                await loadAssets();
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsMigratingInlineImages(false);
        }
    }, [inlineCanvasImages, loadAssets, t]);

    const handleShowAssetInExplorer = useCallback(async (asset: AssetItem) => {
        setError(null);
        try {
            await showAssetInExplorer(asset.path);
        } catch (err) {
            setError((err as Error).message);
        }
    }, []);

    const handleDeleteAsset = useCallback((asset: AssetItem) => {
        openConfirm({
            title: t('assetBrowser.delete.title'),
            description: t('assetBrowser.delete.description', { name: asset.name }),
            confirmText: t('common.delete'),
            isDestructive: true,
            onConfirm: () => {
                void (async () => {
                    setError(null);
                    try {
                        await deleteAssetFile(asset.path);
                        await loadAssets();
                    } catch (err) {
                        setError((err as Error).message);
                    }
                })();
            },
        });
    }, [loadAssets, openConfirm, t]);

    const handleDeleteSelectedAssets = useCallback(() => {
        if (selectedAssets.length === 0) return;

        const previewNames = selectedAssets.slice(0, 4).map(asset => asset.name).join(', ');
        const hiddenCount = Math.max(0, selectedAssets.length - 4);

        openConfirm({
            title: t('assetBrowser.deleteSelected.title'),
            description: t('assetBrowser.deleteSelected.description', {
                count: selectedAssets.length,
                names: previewNames,
                hidden: hiddenCount > 0 ? t('assetBrowser.deleteSelected.hiddenSuffix', { count: hiddenCount }) : '',
            }),
            confirmText: t('assetBrowser.deleteSelected.confirm'),
            isDestructive: true,
            onConfirm: () => {
                void (async () => {
                    setError(null);
                    try {
                        for (const asset of selectedAssets) {
                            await deleteAssetFile(asset.path);
                        }

                        clearAssetSelection();
                        await loadAssets();
                    } catch (err) {
                        setError((err as Error).message);
                    }
                })();
            },
        });
    }, [clearAssetSelection, loadAssets, openConfirm, selectedAssets, t]);

    if (!isHost) {
        return (
            <div className="flex h-full min-h-0 flex-col bg-[var(--vibe-surface-block)] p-4 text-[var(--vibe-text-muted)]">
                <div className={`${assetPanelClass} text-sm leading-relaxed`}>
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                        <FolderOpen size={14} />
                        {t('assetBrowser.worldFiles')}
                    </div>
                    <p className="mb-4 text-[var(--vibe-text-muted)]">
                        {t('assetBrowser.hostOnlyDescription')}
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => void handleUploadFiles(event.target.files)}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="inline-flex items-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--vibe-accent)] transition-colors hover:bg-[var(--vibe-surface-hover)] disabled:opacity-40"
                    >
                        <Upload size={14} />
                        {t('assetBrowser.uploadOrRequest')}
                    </button>
                    <div className="mt-2 text-[10px] leading-snug text-[var(--vibe-text-faint)]">
                        {t('assetBrowser.uploadHint')}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col bg-[var(--vibe-surface-block)]">
            <div className="border-b border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-header)] p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">{t('assetBrowser.worldFiles')}</div>
                        <div className="text-xs text-[var(--vibe-text-faint)]">{t('assetBrowser.headerSubtitle')}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(event) => void handleUploadFiles(event.target.files)}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className={`${assetToolbarButtonClass} hover:text-[var(--vibe-success)]`}
                            title={t('assetBrowser.addFiles')}
                        >
                            <Upload size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => void loadAssets()}
                            disabled={isLoading || isUploading}
                            className={assetToolbarButtonClass}
                            title={t('assetBrowser.refreshList')}
                        >
                            <RefreshCw size={14} className={isLoading || isUploading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {inlineCanvasImages.length > 0 && (
                    <div className={`mb-3 rounded-[var(--vibe-radius-md)] border p-2.5 ${assetWarningPanelClass}`}>
                        <div className="mb-2 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-warning)]">
                                    <Wand2 size={13} />
                                    {t('assetBrowser.inline.title')}
                                </div>
                                <div className="mt-1 text-[10px] leading-snug text-[var(--vibe-text-muted)]">
                                    {t('assetBrowser.inline.summary', { count: inlineCanvasImages.length, kb: inlineCanvasImagesSizeKb })}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => void handleMigrateInlineCanvasImages()}
                                disabled={isMigratingInlineImages || isUploading}
                                className="flex h-8 flex-shrink-0 items-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-warning)_32%,transparent)] bg-[color-mix(in_srgb,var(--vibe-warning)_12%,transparent)] px-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-warning)] transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-warning)_20%,transparent)] disabled:opacity-40"
                                title={t('assetBrowser.inline.migrateTitle')}
                            >
                                <Wand2 size={12} />
                                {isMigratingInlineImages ? t('assetBrowser.inline.migrating') : t('assetBrowser.inline.toAssets')}
                            </button>
                        </div>
                    </div>
                )}

                <div className="relative mb-3">
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vibe-text-faint)]" />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t('assetBrowser.searchPlaceholder')}
                        className={`${glass.input} h-9 w-full pl-9 pr-3 text-xs`}
                    />
                </div>

                <div className="flex flex-wrap gap-1">
                    {FILTERS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setFilter(item.id)}
                            className={`rounded-[var(--vibe-radius-sm)] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                filter === item.id
                                    ? 'bg-[var(--vibe-accent-soft)] text-[var(--vibe-text-primary)] shadow-md'
                                    : 'bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                            }`}
                        >
                            {t(item.labelKey)} <span className="text-[var(--vibe-text-faint)]">{counts[item.id]}</span>
                        </button>
                    ))}
                </div>

                <div className="mt-2 flex items-center gap-1 overflow-x-auto no-scrollbar">
                    <div className="mr-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                        <ArrowDownAZ size={12} />
                        {t('assetBrowser.sortLabel')}
                    </div>
                    {SORT_OPTIONS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setSortBy(item.id)}
                            className={`rounded-[var(--vibe-radius-sm)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                sortBy === item.id
                                    ? 'border border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-text-primary)]'
                                    : 'border border-transparent bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                            }`}
                        >
                            {t(item.labelKey)}
                        </button>
                    ))}
                </div>

                {selectedAssets.length > 0 && (
                    <div className={`mt-3 flex items-center justify-between gap-3 rounded-[var(--vibe-radius-md)] border px-3 py-2 shadow-[var(--vibe-shadow-block)] ${assetSuccessPanelClass}`}>
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-success)]">
                                {t('assetBrowser.selectedCount', { count: selectedAssets.length })}
                            </div>
                            <div className="mt-0.5 truncate text-[9px] font-medium text-[var(--vibe-text-faint)]">
                                {selectedAssets.slice(0, 3).map(asset => asset.name).join(', ')}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => selectedAssets[0] && void handleShowAssetInExplorer(selectedAssets[0])}
                                disabled={selectedAssets.length !== 1}
                                className={`${assetToolbarButtonClass} disabled:cursor-not-allowed disabled:opacity-35`}
                                title={t('assetBrowser.showInExplorer')}
                            >
                                <FolderOpen size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteSelectedAssets}
                                className={`inline-flex h-8 items-center gap-1.5 rounded-[var(--vibe-radius-sm)] border px-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${assetDangerButtonClass}`}
                                title={t('assetBrowser.deleteSelected.title')}
                            >
                                <Trash2 size={13} />
                                {t('common.delete')}
                            </button>
                            <button
                                type="button"
                                onClick={clearAssetSelection}
                                className={assetToolbarButtonClass}
                                title={t('assetBrowser.clearSelection')}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-8 custom-scrollbar">
                {error && (
                    <div className="mb-3 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--vibe-danger)_12%,transparent)] p-3 text-xs text-[var(--vibe-danger)]">
                        {error}
                    </div>
                )}

                {visibleItems.length === 0 ? (
                    <div className="rounded-[var(--vibe-radius-md)] border border-dashed border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-5 text-center text-xs italic text-[var(--vibe-text-faint)]">
                        {isLoading || isUploading ? t('assetBrowser.loadingFiles') : t('assetBrowser.filesNotFound')}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        {visibleItems.map((asset) => {
                            const Icon = getAssetIcon(asset.kind);
                            const durationLabel = asset.kind === 'audio' ? formatAudioDuration(audioDurations[asset.id]) : null;
                            const isSelected = selectedAssetIdSet.has(asset.id);
                            return (
                                <div
                                    key={asset.id}
                                    draggable={asset.kind === 'image'}
                                    onClick={(event) => handleAssetSelectionClick(asset.id, event)}
                                    onDragStart={(event) => {
                                        if (asset.kind !== 'image') return;
                                        writeAssetDragPayload(event.dataTransfer, {
                                            id: asset.id,
                                            name: asset.name,
                                            path: asset.path,
                                            url: asset.url,
                                            type: asset.kind,
                                        });
                                    }}
                                    className={`group overflow-hidden rounded-[var(--vibe-radius-md)] border shadow-inner transition-all ${
                                        isSelected
                                            ? 'border-[color-mix(in_srgb,var(--vibe-success)_45%,transparent)] bg-[color-mix(in_srgb,var(--vibe-success)_14%,transparent)] shadow-[var(--vibe-shadow-block)]'
                                            : 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]'
                                    } ${
                                        asset.kind === 'image' ? 'cursor-grab active:cursor-grabbing' : ''
                                    }`}
                                    title={asset.kind === 'image' ? t('assetBrowser.dragToCanvas') : asset.path}
                                >
                                    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[var(--vibe-surface-block)]">
                                        <AssetMediaPreview asset={asset} icon={Icon} pdfPreviewEnabled={pdfPreviewEnabled} />
                                        <div className="absolute left-2 top-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[color-mix(in_srgb,var(--vibe-body-bg)_55%,transparent)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--vibe-text-muted)] backdrop-blur">
                                            {asset.ext || asset.kind}
                                        </div>
                                        <div
                                            className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border backdrop-blur transition-all ${
                                                isSelected
                                                    ? 'border-[color-mix(in_srgb,var(--vibe-success)_50%,transparent)] bg-[color-mix(in_srgb,var(--vibe-success)_18%,transparent)] text-[var(--vibe-success)]'
                                                    : 'border-[var(--vibe-border-subtle)] bg-[color-mix(in_srgb,var(--vibe-body-bg)_45%,transparent)] text-[var(--vibe-text-faint)] opacity-0 group-hover:opacity-45'
                                            }`}
                                        >
                                            <CheckSquare size={14} strokeWidth={2.3} />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 p-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-xs font-bold text-[var(--vibe-text-primary)]" title={asset.path}>{asset.name}</div>
                                            <div className="text-[10px] uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                                {asset.kind}
                                                {asset.size > 0 && <span className="ml-1 text-[var(--vibe-text-faint)]">{Math.ceil(asset.size / 1024)} KB</span>}
                                                {durationLabel && <span className="ml-1 text-[var(--vibe-success)]">{durationLabel}</span>}
                                            </div>
                                            {asset.path !== asset.name && (
                                                <div className="truncate text-[10px] text-[var(--vibe-text-faint)]" title={asset.path}>
                                                    {asset.path}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void handleShowAssetInExplorer(asset)}
                                            className={`${assetToolbarButtonClass} h-7 w-7 flex-shrink-0`}
                                            title={t('assetBrowser.showInExplorer')}
                                        >
                                            <FolderOpen size={13} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteAsset(asset)}
                                            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[var(--vibe-radius-sm)] border transition-colors ${assetDangerButtonClass}`}
                                            title={t('assetBrowser.deleteFile')}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
