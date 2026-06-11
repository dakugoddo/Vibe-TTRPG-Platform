import { useEffect, useMemo, useState } from 'react';
import { Box, Eye, Image as ImageIcon } from 'lucide-react';
import { listAssetRecords, type AssetRecord } from '../../../services/fileApi';
import { yjsStore } from '../../../store/yjsStore';
import { buildEntityCanvasTokenDefaultsPatch, ENTITY_CANVAS_TOKEN_DEFAULTS_PROPERTY, getEntityCanvasTokenDefaults } from '../../../utils/entityCanvasDefaults';
import { ENTITY_TOKEN_FRAME_OPTIONS } from '../../../utils/canvasEntityTokenFrame';
import type { Entity } from '../../../types';
import type { EntityTokenFrame, EntityTokenMode } from '../../../types/canvasTypes';

interface EntityCanvasTokenSettingsProps {
    entity: Entity;
    canEdit: boolean;
}

const TOKEN_MODES: Array<{ id: EntityTokenMode; label: string; icon: typeof Box }> = [
    { id: 'token', label: 'Фишка', icon: Box },
    { id: 'art', label: 'Карточка', icon: ImageIcon },
];

function getAssetOptionValue(asset: AssetRecord): string {
    return asset.path || asset.relativePath || asset.name;
}

export function EntityCanvasTokenSettings({ entity, canEdit }: EntityCanvasTokenSettingsProps) {
    const [imageAssets, setImageAssets] = useState<AssetRecord[]>([]);
    const defaults = getEntityCanvasTokenDefaults(entity);
    const activeWidthKey = defaults.mode === 'art' ? 'artWidth' : 'tokenWidth';
    const activeHeightKey = defaults.mode === 'art' ? 'artHeight' : 'tokenHeight';
    const configuredImages = useMemo(() => {
        return new Set(imageAssets.map(getAssetOptionValue));
    }, [imageAssets]);

    useEffect(() => {
        if (!canEdit) return;
        let cancelled = false;
        void listAssetRecords()
            .then((records) => {
                if (cancelled) return;
                setImageAssets(records.filter((asset) => asset.type === 'image'));
            })
            .catch(() => {
                if (!cancelled) setImageAssets([]);
            });

        return () => {
            cancelled = true;
        };
    }, [canEdit]);

    const updateDefaults = (patch: Parameters<typeof buildEntityCanvasTokenDefaultsPatch>[1]) => {
        if (!canEdit) return;
        yjsStore.updateEntity(entity.id, {
            properties: {
                ...entity.properties,
                [ENTITY_CANVAS_TOKEN_DEFAULTS_PROPERTY]: buildEntityCanvasTokenDefaultsPatch(entity, patch),
            },
        });
    };

    const updateSize = (key: typeof activeWidthKey | typeof activeHeightKey, value: string) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return;
        updateDefaults({ [key]: numeric });
    };

    return (
        <section className="rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] p-3 shadow-[var(--vibe-shadow-block)]">
            <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                    <Box size={14} />
                    Настройки на канвасе
                </div>
                {!canEdit && <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">read-only</span>}
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_1.2fr]">
                <div>
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">Режим</div>
                    <div className="flex gap-1.5">
                        {TOKEN_MODES.map((mode) => {
                            const Icon = mode.icon;
                            const selected = defaults.mode === mode.id;
                            return (
                                <button
                                    key={mode.id}
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => updateDefaults({ mode: mode.id })}
                                    className={`inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[var(--vibe-radius-sm)] border px-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                        selected
                                            ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-text-primary)]'
                                            : 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)] hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                                    } ${!canEdit ? 'cursor-default opacity-70' : ''}`}
                                >
                                    <Icon size={12} />
                                    {mode.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">Рамка</div>
                    <div className="flex flex-wrap gap-1.5">
                        {ENTITY_TOKEN_FRAME_OPTIONS.map((frame) => {
                            const selected = defaults.frame === frame.id;
                            return (
                                <button
                                    key={frame.id}
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => updateDefaults({ frame: frame.id as EntityTokenFrame })}
                                    className={`h-8 rounded-[var(--vibe-radius-sm)] border px-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                        selected
                                            ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-text-primary)]'
                                            : 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)] hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                                    } ${!canEdit ? 'cursor-default opacity-70' : ''}`}
                                    title={frame.description}
                                >
                                    {frame.shortLabel}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--vibe-text-muted)]">
                    <input
                        type="checkbox"
                        checked={defaults.showName}
                        disabled={!canEdit}
                        onChange={(event) => updateDefaults({ showName: event.target.checked })}
                        className="h-4 w-4 accent-[var(--vibe-accent)]"
                    />
                    <Eye size={12} />
                    Имя на канвасе
                </label>

                <label className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--vibe-text-muted)]">
                    <span>Цвет рамки</span>
                    <input
                        type="color"
                        value={defaults.stroke.startsWith('#') ? defaults.stroke : '#a5b4fc'}
                        disabled={!canEdit}
                        onChange={(event) => updateDefaults({ stroke: event.target.value })}
                        className="h-7 w-9 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-0.5"
                    />
                </label>

                <label className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--vibe-text-muted)]">
                    <span>W</span>
                    <input
                        type="number"
                        min={defaults.mode === 'art' ? 64 : 32}
                        max={defaults.mode === 'art' ? 1200 : 512}
                        value={defaults.width}
                        disabled={!canEdit}
                        onChange={(event) => updateSize(activeWidthKey, event.target.value)}
                        className="h-7 w-16 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 text-xs text-[var(--vibe-text-primary)] outline-none focus:border-[var(--vibe-border-strong)] disabled:opacity-60"
                    />
                </label>

                <label className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--vibe-text-muted)]">
                    <span>H</span>
                    <input
                        type="number"
                        min={defaults.mode === 'art' ? 64 : 32}
                        max={defaults.mode === 'art' ? 1200 : 512}
                        value={defaults.height}
                        disabled={!canEdit}
                        onChange={(event) => updateSize(activeHeightKey, event.target.value)}
                        className="h-7 w-16 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 text-xs text-[var(--vibe-text-primary)] outline-none focus:border-[var(--vibe-border-strong)] disabled:opacity-60"
                    />
                </label>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
                <label className="min-w-0">
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">Фото фишки</div>
                    <select
                        value={defaults.tokenImage}
                        disabled={!canEdit}
                        onChange={(event) => updateDefaults({ tokenImage: event.target.value })}
                        className="h-8 w-full rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 text-[10px] font-semibold text-[var(--vibe-text-primary)] outline-none focus:border-[var(--vibe-border-strong)] disabled:opacity-60"
                        title="Пусто = использовать основное фото сущности"
                    >
                        <option value="">Основное фото</option>
                        {defaults.tokenImage && !configuredImages.has(defaults.tokenImage) && (
                            <option value={defaults.tokenImage}>{defaults.tokenImage}</option>
                        )}
                        {imageAssets.map((asset) => (
                            <option key={asset.id} value={getAssetOptionValue(asset)}>
                                {asset.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="min-w-0">
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">Фото карточки</div>
                    <select
                        value={defaults.artImage}
                        disabled={!canEdit}
                        onChange={(event) => updateDefaults({ artImage: event.target.value })}
                        className="h-8 w-full rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 text-[10px] font-semibold text-[var(--vibe-text-primary)] outline-none focus:border-[var(--vibe-border-strong)] disabled:opacity-60"
                        title="Пусто = использовать основное фото сущности"
                    >
                        <option value="">Основное фото</option>
                        {defaults.artImage && !configuredImages.has(defaults.artImage) && (
                            <option value={defaults.artImage}>{defaults.artImage}</option>
                        )}
                        {imageAssets.map((asset) => (
                            <option key={asset.id} value={getAssetOptionValue(asset)}>
                                {asset.name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
        </section>
    );
}
