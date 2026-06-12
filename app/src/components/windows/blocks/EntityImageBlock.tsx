import { useState, useRef, useEffect } from 'react';
import { yjsStore } from '../../../store/yjsStore';
import type { Entity } from '../../../types';
import { glass } from '../../../utils/theme';
import { Image as ImageIcon, Upload, X, AlertTriangle, User, Box, Sword, Wand2, Map, FileText, Bookmark, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getAssetUrl, getIsHost, listAssetRecords, uploadAssetFile, type AssetRecord } from '../../../services/fileApi';
import { useNotificationStore } from '../../../store/notificationStore';
import { LARGE_ASSET_UPLOAD_APPROVAL_BYTES, formatNotificationFileSize } from '../../../utils/notificationModel';
import { useMediaLoadState } from '../../../hooks/useMediaLoadState';

interface EntityImageBlockProps {
    entity: Entity;
    isWide?: boolean;
}

const TYPE_ICONS: Partial<Record<Entity['type'] | 'spell', LucideIcon>> = {
    character: User,
    object: Box,
    attack: Sword,
    spell: Wand2,
    canvas: Map,
    note: FileText,
    tag: Bookmark,
    folder: Bookmark,
};

function getEntityOwnerId(entity: Entity): string | undefined {
    const owner = entity.properties?._playerOwner;
    return typeof owner === 'string' ? owner : undefined;
}

export function EntityImageBlock({ entity, isWide = false }: EntityImageBlockProps) {
    const isHost = getIsHost();
    const canEditImage = yjsStore.canModify(entity.database, getEntityOwnerId(entity));
    const [isEditing, setIsEditing] = useState(false);
    const [tempUrl, setTempUrl] = useState(entity.icon_url || '');
    const [availableImages, setAvailableImages] = useState<AssetRecord[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const addNotification = useNotificationStore((state) => state.addNotification);
    const updateNotification = useNotificationStore((state) => state.updateNotification);
    const updateNotificationProgress = useNotificationStore((state) => state.updateProgress);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const Icon = TYPE_ICONS[entity.type] || ImageIcon;
    let fullUrl = entity.icon_url;
    if (fullUrl && !fullUrl.startsWith('http') && !fullUrl.startsWith('data:')) {
        fullUrl = getAssetUrl(fullUrl);
    }
    const imageLoadState = useMediaLoadState(entity.icon_url ? fullUrl : '');

    useEffect(() => {
        setTempUrl(entity.icon_url || '');
    }, [entity.icon_url]);

    useEffect(() => {
        if (isEditing && isHost) {
            listAssetRecords()
                .then(data => setAvailableImages(data.filter(asset => asset.type === 'image' || /\.(avif|gif|jpe?g|png|webp)$/i.test(asset.path))))
                .catch(err => console.error("Failed to load assets list", err));
        }
    }, [isEditing, isHost]);

    const handleSave = () => {
        if (!canEditImage) return;
        yjsStore.updateEntity(entity.id, { icon_url: tempUrl });
        setIsEditing(false);
    };

    const handleRemove = () => {
        if (!canEditImage) return;
        yjsStore.updateEntity(entity.id, { icon_url: '' });
        setIsEditing(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !isHost || !canEditImage) return;

        setIsUploading(true);
        setUploadError(null);
        const isLargeUpload = file.size > LARGE_ASSET_UPLOAD_APPROVAL_BYTES;
        const uploadNotification = addNotification({
            kind: 'progress',
            scope: 'local',
            status: 'pending',
            title: isLargeUpload ? 'Крупное фото сущности' : 'Загрузка фото сущности',
            message: `${file.name} • ${formatNotificationFileSize(file.size)}`,
            progress: 0,
            payload: {
                entityId: entity.id,
                fileName: file.name,
                size: file.size,
                requiresGmApproval: isLargeUpload,
            },
        });

        try {
            const data = await uploadAssetFile(file, {
                onProgress: (progress) => updateNotificationProgress(uploadNotification.id, progress.percent),
            });
            const newUrl = data.filename; // Only save the filename for portability
            if (!canEditImage) {
                updateNotification(uploadNotification.id, {
                    kind: 'warning',
                    status: 'failed',
                    title: 'Нет прав на сущность',
                    message: `${file.name} загружен, но не привязан к сущности.`,
                });
                return;
            }
            yjsStore.updateEntity(entity.id, { icon_url: newUrl });
            updateNotification(uploadNotification.id, {
                kind: 'success',
                status: 'done',
                title: 'Фото сущности загружено',
                message: `${file.name} • ${formatNotificationFileSize(file.size)}`,
                progress: 100,
            });
            setIsEditing(false);
        } catch (err) {
            console.error("Upload error", err);
            updateNotification(uploadNotification.id, {
                kind: 'error',
                status: 'failed',
                title: 'Фото не загрузилось',
                message: `${file.name}: ${(err as Error).message}`,
            });
            setUploadError((err as Error).message);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className={`group relative mb-4 flex flex-shrink-0 flex-col items-center justify-center overflow-hidden ${glass.blockBg} border border-[var(--vibe-border-subtle)] shadow-[var(--vibe-shadow-block)] ${isWide ? 'mx-auto h-40 w-full rounded-[var(--vibe-radius-md)]' : 'mx-auto h-48 w-48 rounded-[var(--vibe-radius-lg)]'}`}>
            
            {entity.icon_url ? (
                imageLoadState.isError ? (
                    <div className="flex flex-col items-center justify-center text-[var(--vibe-danger)] opacity-80">
                        <AlertTriangle size={32} className="mb-2" />
                        <span className="text-xs font-bold text-center px-4">Ссылка недействительна или изображение удалено</span>
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                imageLoadState.retry();
                            }}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-danger)_34%,transparent)] bg-[color-mix(in_srgb,var(--vibe-danger)_12%,transparent)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-danger)_20%,transparent)]"
                        >
                            <RefreshCw size={12} />
                            Повторить
                        </button>
                    </div>
                ) : (
                    <>
                        <img
                            src={imageLoadState.mediaSrc}
                            onLoad={imageLoadState.markReady}
                            onError={imageLoadState.markError}
                            alt={entity.name}
                            className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${imageLoadState.isLoading ? 'opacity-35' : 'opacity-100'}`}
                        />
                        {imageLoadState.isLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[color-mix(in_srgb,var(--vibe-body-bg)_38%,transparent)] text-[var(--vibe-text-faint)] backdrop-blur-sm">
                                <RefreshCw size={22} className="mb-2 animate-spin" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Загружаю фото</span>
                            </div>
                        )}
                    </>
                )
            ) : (
                <div className="flex flex-col items-center justify-center text-[var(--vibe-text-faint)]">
                    <Icon size={isWide ? 64 : 48} strokeWidth={1.5} />
                    <span className="text-[10px] mt-2 font-bold tracking-widest uppercase opacity-50">НЕТ ФОТО</span>
                </div>
            )}

            {/* Hover overlay for editing */}
            {canEditImage && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center bg-[color-mix(in_srgb,var(--vibe-body-bg)_70%,transparent)] backdrop-blur-sm transition-all duration-300 ${isEditing ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'}`}>
                
                {!isEditing ? (
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                        className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-strong)] bg-[var(--vibe-surface-input)] px-4 py-2 text-xs font-bold text-[var(--vibe-text-primary)] shadow-[var(--vibe-shadow-block)] backdrop-blur-[var(--vibe-backdrop-blur)] transition-all hover:bg-[var(--vibe-surface-hover)]"
                    >
                        Изменить фото
                    </button>
                ) : (
                    <div className="relative flex h-full w-full flex-col gap-2 bg-[var(--vibe-surface-block)] p-4" onClick={e => e.stopPropagation()}>
                        {/* Close button */}
                        <button onClick={() => setIsEditing(false)} className={`${glass.iconButton} absolute right-2 top-2 rounded-full p-1`} title="Отмена">
                            <X size={14} />
                        </button>

                        <div className="mb-1 pt-2 text-center text-xs font-bold uppercase tracking-wider text-[var(--vibe-text-muted)]">Настройки изображения</div>

                        <div className="flex flex-col gap-2 w-full max-w-sm mx-auto overflow-y-auto custom-scrollbar">
                            {/* URL/Filename input */}
                            <div className="relative">
                                <input
                                    type="text"
                                    value={tempUrl}
                                    onChange={(e) => setTempUrl(e.target.value)}
                                    placeholder="Имя файла или URL..."
                                    className={`${glass.input} w-full text-xs py-1.5 px-2`}
                                />
                            </div>

                            {/* Dropdown for existing files */}
                            {isHost && availableImages.length > 0 && (
                                <select 
                                    className={`${glass.input} w-full cursor-pointer px-2 py-1.5 text-xs`}
                                    onChange={(e) => setTempUrl(e.target.value)}
                                    value=""
                                >
                                    <option value="" disabled>...или выберите существующее</option>
                                    {availableImages.map(asset => (
                                        <option key={asset.id} value={asset.path}>{asset.path}</option>
                                    ))}
                                </select>
                            )}
                            
                            <div className="flex gap-2 mt-1">
                                <button 
                                    onClick={handleSave}
                                    className="flex-1 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] py-1.5 text-xs font-bold text-[var(--vibe-accent)] shadow-sm transition-colors hover:bg-[var(--vibe-surface-hover)]"
                                >
                                    Сохранить ссылку
                                </button>
                                {entity.icon_url && (
                                    <button 
                                        onClick={handleRemove}
                                        className="rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--vibe-danger)_14%,transparent)] px-3 py-1.5 text-xs font-bold text-[var(--vibe-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-danger)_24%,transparent)]"
                                        title="Удалить привязку к фото (файл останется)"
                                    >
                                        Удалить
                                    </button>
                                )}
                            </div>

                            {isHost && (
                                <div className="relative mt-2 border-t border-[var(--vibe-border-subtle)] pt-3">
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleFileUpload} 
                                        accept="image/*" 
                                        className="hidden" 
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading}
                                        className={`flex w-full items-center justify-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] py-1.5 text-xs font-bold text-[var(--vibe-text-primary)] transition-colors ${isUploading ? 'bg-[var(--vibe-surface-input)] opacity-50' : 'bg-[var(--vibe-surface-input)] hover:bg-[var(--vibe-surface-hover)]'}`}
                                    >
                                        <Upload size={14} />
                                        {isUploading ? 'Загрузка...' : 'Загрузить новое фото'}
                                    </button>
                                    {uploadError && (
                                        <div className="mt-2 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--vibe-danger)_12%,transparent)] px-2 py-1.5 text-[10px] font-semibold text-[var(--vibe-danger)]">
                                            {uploadError}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            )}
            
        </div>
    );
}
