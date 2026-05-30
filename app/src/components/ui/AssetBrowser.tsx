import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { ArrowDownAZ, Box, CheckSquare, File, FolderOpen, Image, Music, RefreshCw, Search, Trash2, Upload, Video, Wand2, X } from 'lucide-react';
import { deleteAssetFile, getAssetUrl, getIsHost, listAssetRecords, showAssetInExplorer, uploadAsset, uploadAssetFile, uploadAssetFileToHost, type AssetRecord } from '../../services/fileApi';
import { loadAudioDuration } from '../../services/audioPlayback';
import { yjsStore } from '../../store/yjsStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useUIStore } from '../../store/uiStore';
import { writeAssetDragPayload } from '../../utils/assetDrag';
import { findCanvasInlineImages, replaceInlineCanvasImage } from '../../utils/canvasInlineImageMigration';
import { dataUrlToBase64 } from '../../utils/fileRead';
import { LARGE_ASSET_UPLOAD_APPROVAL_BYTES, formatNotificationFileSize } from '../../utils/notificationModel';
import { createLargeUploadApprovalRequest } from '../../utils/sessionNotificationModel';
import type { Entity, SessionNotificationEvent } from '../../types';

type AssetKind = 'all' | 'image' | 'audio' | 'model' | 'video' | 'other';
type AssetSort = 'name' | 'modified' | 'size' | 'type';

type AssetItem = AssetRecord & { kind: Exclude<AssetKind, 'all'> };

const FILTERS: { id: AssetKind; label: string }[] = [
    { id: 'all', label: 'Все' },
    { id: 'image', label: 'Фото' },
    { id: 'audio', label: 'Аудио' },
    { id: 'model', label: '3D' },
    { id: 'video', label: 'Видео' },
    { id: 'other', label: 'Прочее' },
];

const SORT_OPTIONS: Array<{ id: AssetSort; label: string }> = [
    { id: 'name', label: 'Имя' },
    { id: 'modified', label: 'Новые' },
    { id: 'size', label: 'Размер' },
    { id: 'type', label: 'Тип' },
];

const MAX_BINARY_UPLOAD_BYTES = 250 * 1024 * 1024;

function getAssetKind(filename: string): AssetItem['kind'] {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'svg'].includes(ext)) return 'image';
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)) return 'audio';
    if (['glb', 'gltf', 'fbx', 'obj', 'stl'].includes(ext)) return 'model';
    if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
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

export function AssetBrowser() {
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
            actions: [{ id: 'cancel-upload', label: 'Отменить', tone: 'danger' }],
        });

        try {
            await uploadAssetFile(file, {
                signal: controller.signal,
                onProgress: (progress) => updateNotificationProgress(notificationId, progress.percent),
            });
            updateNotification(notificationId, {
                kind: 'success',
                status: 'done',
                title: 'Файл загружен',
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
                    title: 'Загрузка отменена',
                    message: `${file.name}`,
                    actions: [{ id: 'retry-upload', label: 'Повторить', tone: 'primary' }],
                });
            } else {
                updateNotification(notificationId, {
                    kind: 'error',
                    status: 'failed',
                    title: 'Загрузка не удалась',
                    message: `${file.name}: ${(err as Error).message}`,
                    actions: [{ id: 'retry-upload', label: 'Повторить', tone: 'primary' }],
                });
            }

            registerRetryCallback(notificationId, () => {
                void performHostUpload(file, notificationId);
            });
        }
    }, [registerAbortCallback, unregisterAbortCallback, registerRetryCallback, unregisterRetryCallback, updateNotification, updateNotificationProgress, loadAssets]);

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
            actions: [{ id: 'cancel-upload', label: 'Отменить', tone: 'danger' }],
        });

        try {
            await uploadAssetFileToHost(file, {
                signal: controller.signal,
                onProgress: (progress) => updateNotificationProgress(notificationId, progress.percent),
            });
            updateNotification(notificationId, {
                kind: 'success',
                status: 'done',
                title: 'Файл загружен',
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
                    title: 'Загрузка отменена',
                    message: `${file.name}`,
                    actions: [{ id: 'retry-upload', label: 'Повторить', tone: 'primary' }],
                });
            } else {
                updateNotification(notificationId, {
                    kind: 'error',
                    status: 'failed',
                    title: 'Загрузка не удалась',
                    message: `${file.name}: ${(err as Error).message}`,
                    actions: [{ id: 'retry-upload', label: 'Повторить', tone: 'primary' }],
                });
            }

            registerRetryCallback(notificationId, () => {
                void performPlayerDirectUpload(file, notificationId);
            });
        }
    }, [registerAbortCallback, unregisterAbortCallback, registerRetryCallback, unregisterRetryCallback, updateNotification, updateNotificationProgress]);

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
            const errorMsg = isAbort ? 'Загрузка отменена' : (err as Error).message;

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
    }, [registerAbortCallback, unregisterAbortCallback, registerRetryCallback, unregisterRetryCallback]);

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
                return right.size - left.size || left.name.localeCompare(right.name, 'ru');
            }
            if (sortBy === 'type') {
                return left.kind.localeCompare(right.kind, 'ru') || left.name.localeCompare(right.name, 'ru');
            }
            return left.name.localeCompare(right.name, 'ru');
        });
    }, [filter, items, query, sortBy]);

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
        }, { all: 0, image: 0, audio: 0, model: 0, video: 0, other: 0 });
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
                            title: 'Файл слишком большой',
                            message: `${file.name} • ${formatNotificationFileSize(file.size)}. Быстрая загрузка сейчас ограничена 250 MB.`,
                        });
                        continue;
                    }

                    if (file.size <= LARGE_ASSET_UPLOAD_APPROVAL_BYTES) {
                        const uploadNotification = addNotification({
                            kind: 'progress',
                            scope: 'player',
                            status: 'pending',
                            title: 'Загрузка файла',
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
                    throw new Error(`Файл "${file.name}" слишком большой для быстрой загрузки. Скопируй крупные аудио/модели прямо в папку assets/.`);
                }

                const isLargeUpload = file.size > LARGE_ASSET_UPLOAD_APPROVAL_BYTES;
                const uploadNotification = addNotification({
                    kind: 'progress',
                    scope: 'local',
                    status: 'pending',
                    title: isLargeUpload ? 'Крупный файл' : 'Загрузка файла',
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
    }, [addNotification, isHost, performHostUpload, performPlayerDirectUpload]);

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
                yjsStore.sendMessage(`Перенесено canvas-изображений в assets/: ${migrated}`, 'Система', true);
                await loadAssets();
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsMigratingInlineImages(false);
        }
    }, [inlineCanvasImages, loadAssets]);

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
            title: 'Удаление файла',
            description: `Удалить «${asset.name}» из assets/? Если файл уже используется на канвасе или в сущности, ссылка на него станет битой.`,
            confirmText: 'Удалить',
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
    }, [loadAssets, openConfirm]);

    const handleDeleteSelectedAssets = useCallback(() => {
        if (selectedAssets.length === 0) return;

        const previewNames = selectedAssets.slice(0, 4).map(asset => asset.name).join(', ');
        const hiddenCount = Math.max(0, selectedAssets.length - 4);

        openConfirm({
            title: 'Массовое удаление файлов',
            description: `Удалить выбранные файлы (${selectedAssets.length}) из assets/? ${previewNames}${hiddenCount > 0 ? ` и ещё ${hiddenCount}` : ''}. Если они уже используются на canvas или в сущностях, ссылки станут битыми.`,
            confirmText: 'Удалить выбранные',
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
    }, [clearAssetSelection, loadAssets, openConfirm, selectedAssets]);

    if (!isHost) {
        return (
            <div className="flex h-full min-h-0 flex-col bg-black/20 p-4 text-white/60">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-relaxed">
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/45">
                        <FolderOpen size={14} />
                        Файлы мира
                    </div>
                    <p className="mb-4 text-white/55">
                        Браузер файлов доступен на стороне Host/ГМа, потому что source of truth лежит на диске хоста. Звук вынесен в отдельный модуль и не управляется из вкладки файлов.
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
                        className="inline-flex items-center gap-2 rounded-lg border border-cyan-200/20 bg-cyan-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-cyan-100 transition-colors hover:bg-cyan-300/15 disabled:opacity-40"
                    >
                        <Upload size={14} />
                        Загрузить / запросить
                    </button>
                    <div className="mt-2 text-[10px] leading-snug text-white/35">
                        До 50 MB файл загружается сразу. Больше 50 MB отправляется заявка ГМу, а передача начинается после одобрения.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col bg-black/20">
            <div className="border-b border-white/10 bg-white/5 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-white/45">Файлы мира</div>
                        <div className="text-xs text-white/35">assets/ сейчас, аудио и 3D позже</div>
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
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/55 transition-colors hover:border-emerald-300/30 hover:bg-emerald-400/10 hover:text-emerald-100 disabled:opacity-40"
                            title="Добавить файлы"
                        >
                            <Upload size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => void loadAssets()}
                            disabled={isLoading || isUploading}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/55 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white disabled:opacity-40"
                            title="Обновить список"
                        >
                            <RefreshCw size={14} className={isLoading || isUploading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {inlineCanvasImages.length > 0 && (
                    <div className="mb-3 rounded-xl border border-amber-300/20 bg-amber-400/10 p-2.5">
                        <div className="mb-2 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-100/80">
                                    <Wand2 size={13} />
                                    Старые canvas-изображения
                                </div>
                                <div className="mt-1 text-[10px] leading-snug text-amber-50/55">
                                    {inlineCanvasImages.length} inline-файл(ов), примерно {inlineCanvasImagesSizeKb} KB
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => void handleMigrateInlineCanvasImages()}
                                disabled={isMigratingInlineImages || isUploading}
                                className="flex h-8 flex-shrink-0 items-center gap-2 rounded-lg border border-amber-200/25 bg-amber-300/10 px-2.5 text-[10px] font-bold uppercase tracking-wider text-amber-100 transition-colors hover:bg-amber-300/15 disabled:opacity-40"
                                title="Перенести старые картинки из canvas в assets/"
                            >
                                <Wand2 size={12} />
                                {isMigratingInlineImages ? 'Переношу' : 'В assets'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="relative mb-3">
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Поиск файлов..."
                        className="h-9 w-full rounded-lg border border-white/10 bg-black/25 pl-9 pr-3 text-xs text-white/80 outline-none transition-colors placeholder:text-white/30 focus:border-white/25 focus:bg-black/35"
                    />
                </div>

                <div className="flex flex-wrap gap-1">
                    {FILTERS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setFilter(item.id)}
                            className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                filter === item.id
                                    ? 'bg-white/20 text-white shadow-md'
                                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/90'
                            }`}
                        >
                            {item.label} <span className="text-white/35">{counts[item.id]}</span>
                        </button>
                    ))}
                </div>

                <div className="mt-2 flex items-center gap-1 overflow-x-auto no-scrollbar">
                    <div className="mr-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/30">
                        <ArrowDownAZ size={12} />
                        Сорт
                    </div>
                    {SORT_OPTIONS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setSortBy(item.id)}
                            className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                sortBy === item.id
                                    ? 'border border-emerald-300/25 bg-emerald-400/15 text-emerald-100'
                                    : 'border border-transparent bg-white/5 text-white/45 hover:bg-white/10 hover:text-white/80'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {selectedAssets.length > 0 && (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200/15 bg-emerald-300/[0.08] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-50/75">
                                Выбрано <span className="font-mono text-emerald-50">{selectedAssets.length}</span>
                            </div>
                            <div className="mt-0.5 truncate text-[9px] font-medium text-white/35">
                                {selectedAssets.slice(0, 3).map(asset => asset.name).join(', ')}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => selectedAssets[0] && void handleShowAssetInExplorer(selectedAssets[0])}
                                disabled={selectedAssets.length !== 1}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-white/45 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                                title="Показать в проводнике"
                            >
                                <FolderOpen size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteSelectedAssets}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-300/20 bg-red-400/10 px-2.5 text-[10px] font-bold uppercase tracking-wider text-red-100/80 transition-colors hover:border-red-200/35 hover:bg-red-400/20 hover:text-white"
                                title="Удалить выбранные файлы"
                            >
                                <Trash2 size={13} />
                                Удалить
                            </button>
                            <button
                                type="button"
                                onClick={clearAssetSelection}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-white/45 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                                title="Сбросить выделение"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-8 custom-scrollbar">
                {error && (
                    <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
                        {error}
                    </div>
                )}

                {visibleItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-5 text-center text-xs italic text-white/35">
                        {isLoading || isUploading ? 'Загружаю файлы...' : 'Файлы не найдены'}
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
                                    className={`group overflow-hidden rounded-xl border shadow-inner transition-all ${
                                        isSelected
                                            ? 'border-emerald-200/45 bg-emerald-400/15 shadow-[0_0_0_1px_rgba(110,231,183,0.16),0_14px_34px_rgba(16,185,129,0.10)]'
                                            : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]'
                                    } ${
                                        asset.kind === 'image' ? 'cursor-grab active:cursor-grabbing' : ''
                                    }`}
                                    title={asset.kind === 'image' ? 'Перетащить на канвас' : asset.path}
                                >
                                    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-black/25">
                                        {asset.kind === 'image' ? (
                                            <img src={asset.url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                        ) : asset.kind === 'video' ? (
                                            <video
                                                src={asset.url}
                                                className="h-full w-full object-cover"
                                                muted
                                                controls
                                                preload="metadata"
                                                onClick={(event) => event.stopPropagation()}
                                            />
                                        ) : (
                                            <Icon size={34} className="text-white/25" />
                                        )}
                                        <div className="absolute left-2 top-2 rounded-md border border-white/10 bg-black/45 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white/55 backdrop-blur">
                                            {asset.ext || asset.kind}
                                        </div>
                                        <div
                                            className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border backdrop-blur transition-all ${
                                                isSelected
                                                    ? 'border-emerald-200/50 bg-emerald-300/20 text-emerald-50'
                                                    : 'border-white/10 bg-black/35 text-white/25 opacity-0 group-hover:opacity-45'
                                            }`}
                                        >
                                            <CheckSquare size={14} strokeWidth={2.3} />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 p-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-xs font-bold text-white/80" title={asset.path}>{asset.name}</div>
                                            <div className="text-[10px] uppercase tracking-wider text-white/30">
                                                {asset.kind}
                                                {asset.size > 0 && <span className="ml-1 text-white/20">{Math.ceil(asset.size / 1024)} KB</span>}
                                                {durationLabel && <span className="ml-1 text-emerald-200/35">{durationLabel}</span>}
                                            </div>
                                            {asset.path !== asset.name && (
                                                <div className="truncate text-[10px] text-white/25" title={asset.path}>
                                                    {asset.path}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void handleShowAssetInExplorer(asset)}
                                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-white/45 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white"
                                            title="Показать в проводнике"
                                        >
                                            <FolderOpen size={13} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteAsset(asset)}
                                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-red-300/55 transition-colors hover:border-red-300/30 hover:bg-red-500/15 hover:text-red-100"
                                            title="Удалить файл"
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
