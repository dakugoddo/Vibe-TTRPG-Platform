import { useEffect, useMemo, useState } from 'react';
import { Box, Eye, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { useEntities } from '../../../hooks/useEntities';
import { listAssetRecords, type AssetRecord } from '../../../services/fileApi';
import { yjsStore } from '../../../store/yjsStore';
import { buildCharacterCompactOptions } from '../../../utils/characterCardSummary';
import {
    buildCharacterCompactCardDefaultsPatch,
    CHARACTER_COMPACT_CARD_PROPERTY,
    getCharacterCompactCardDefaults,
    hasCharacterCompactCardDefaults,
    type CharacterCompactCardDefaults,
    type CharacterCompactNotesMode,
} from '../../../utils/characterCompactCardDefaults';
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

type CompactListKey = 'metricIds' | 'resourceIds' | 'actionIds' | 'inventoryIds';

function getAssetOptionValue(asset: AssetRecord): string {
    return asset.path || asset.relativePath || asset.name;
}

function toggleId(ids: string[], id: string): string[] {
    return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function buildAutoCompactDefaults(options: ReturnType<typeof buildCharacterCompactOptions>): CharacterCompactCardDefaults {
    return {
        metricIds: options.metrics.slice(0, 4).map((item) => item.id),
        resourceIds: options.resources.slice(0, 3).map((item) => item.id),
        actionIds: options.actions.slice(0, 8).map((item) => item.id),
        inventoryIds: options.inventory.slice(0, 6).map((item) => item.id),
        notesMode: 'short',
    };
}

export function EntityCanvasTokenSettings({ entity, canEdit }: EntityCanvasTokenSettingsProps) {
    const allEntities = useEntities();
    const [imageAssets, setImageAssets] = useState<AssetRecord[]>([]);
    const defaults = getEntityCanvasTokenDefaults(entity);
    const compactOptions = useMemo(
        () => entity.type === 'character' ? buildCharacterCompactOptions(entity, allEntities) : null,
        [allEntities, entity]
    );
    const compactConfigured = hasCharacterCompactCardDefaults(entity);
    const storedCompactDefaults = getCharacterCompactCardDefaults(entity);
    const effectiveCompactDefaults = compactOptions
        ? compactConfigured ? storedCompactDefaults : buildAutoCompactDefaults(compactOptions)
        : storedCompactDefaults;
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

    const updateCompactDefaults = (patch: Partial<CharacterCompactCardDefaults>) => {
        if (!canEdit || !compactOptions) return;
        const current = compactConfigured
            ? buildCharacterCompactCardDefaultsPatch(entity, patch)
            : { ...effectiveCompactDefaults, ...patch };

        yjsStore.updateEntity(entity.id, {
            properties: {
                ...entity.properties,
                [CHARACTER_COMPACT_CARD_PROPERTY]: current,
            },
        });
    };

    const resetCompactDefaults = () => {
        if (!canEdit) return;
        const nextProperties = { ...entity.properties };
        delete nextProperties[CHARACTER_COMPACT_CARD_PROPERTY];
        yjsStore.updateEntity(entity.id, { properties: nextProperties });
    };

    const updateSize = (key: typeof activeWidthKey | typeof activeHeightKey, value: string) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return;
        updateDefaults({ [key]: numeric });
    };

    const toggleCompactListValue = (key: CompactListKey, id: string) => {
        updateCompactDefaults({ [key]: toggleId(effectiveCompactDefaults[key], id) });
    };

    const updateNotesMode = (notesMode: CharacterCompactNotesMode) => {
        updateCompactDefaults({ notesMode });
    };

    const renderCompactOption = (
        key: CompactListKey,
        id: string,
        label: string,
        meta?: string
    ) => {
        const selected = effectiveCompactDefaults[key].includes(id);
        return (
            <label
                key={id}
                className={`flex min-w-0 items-center gap-2 rounded-[var(--vibe-radius-sm)] border px-2 py-1.5 text-left transition-colors ${
                    selected
                        ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-text-primary)]'
                        : 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)]'
                } ${canEdit ? 'cursor-pointer hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]' : 'cursor-default opacity-70'}`}
            >
                <input
                    type="checkbox"
                    checked={selected}
                    disabled={!canEdit}
                    onChange={() => toggleCompactListValue(key, id)}
                    className="h-3.5 w-3.5 shrink-0 accent-[var(--vibe-accent)]"
                />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-bold">{label}</span>
                    {meta && <span className="block truncate text-[9px] uppercase tracking-wider text-[var(--vibe-text-faint)]">{meta}</span>}
                </span>
            </label>
        );
    };

    return (
        <section className="rounded-xl border border-white/10 bg-black/20 p-3 shadow-inner">
            <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/45">
                    <Box size={14} />
                    Настройки на канвасе
                </div>
                {!canEdit && <span className="text-[10px] font-bold uppercase tracking-wider text-white/25">read-only</span>}
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_1.2fr]">
                <div>
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/35">Режим</div>
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
                                    className={`inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                        selected
                                            ? 'border-cyan-200/35 bg-cyan-300/15 text-cyan-50'
                                            : 'border-white/10 bg-white/[0.03] text-white/40 hover:border-white/20 hover:text-white/70'
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
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/35">Рамка</div>
                    <div className="flex flex-wrap gap-1.5">
                        {ENTITY_TOKEN_FRAME_OPTIONS.map((frame) => {
                            const selected = defaults.frame === frame.id;
                            return (
                                <button
                                    key={frame.id}
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => updateDefaults({ frame: frame.id as EntityTokenFrame })}
                                    className={`h-8 rounded-lg border px-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                        selected
                                            ? 'border-amber-200/35 bg-amber-300/15 text-amber-50'
                                            : 'border-white/10 bg-white/[0.03] text-white/40 hover:border-white/20 hover:text-white/70'
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
                <label className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/55">
                    <input
                        type="checkbox"
                        checked={defaults.showName}
                        disabled={!canEdit}
                        onChange={(event) => updateDefaults({ showName: event.target.checked })}
                        className="h-4 w-4 accent-cyan-300"
                    />
                    <Eye size={12} />
                    Имя на канвасе
                </label>

                <label className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/55">
                    <span>Цвет рамки</span>
                    <input
                        type="color"
                        value={defaults.stroke.startsWith('#') ? defaults.stroke : '#a5b4fc'}
                        disabled={!canEdit}
                        onChange={(event) => updateDefaults({ stroke: event.target.value })}
                        className="h-7 w-9 rounded border border-white/10 bg-black/30 p-0.5"
                    />
                </label>

                <label className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/55">
                    <span>W</span>
                    <input
                        type="number"
                        min={defaults.mode === 'art' ? 64 : 32}
                        max={defaults.mode === 'art' ? 1200 : 512}
                        value={defaults.width}
                        disabled={!canEdit}
                        onChange={(event) => updateSize(activeWidthKey, event.target.value)}
                        className="h-7 w-16 rounded border border-white/10 bg-black/30 px-2 text-xs text-white/75 outline-none focus:border-cyan-200/35 disabled:opacity-60"
                    />
                </label>

                <label className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/55">
                    <span>H</span>
                    <input
                        type="number"
                        min={defaults.mode === 'art' ? 64 : 32}
                        max={defaults.mode === 'art' ? 1200 : 512}
                        value={defaults.height}
                        disabled={!canEdit}
                        onChange={(event) => updateSize(activeHeightKey, event.target.value)}
                        className="h-7 w-16 rounded border border-white/10 bg-black/30 px-2 text-xs text-white/75 outline-none focus:border-cyan-200/35 disabled:opacity-60"
                    />
                </label>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
                <label className="min-w-0">
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/35">Фото фишки</div>
                    <select
                        value={defaults.tokenImage}
                        disabled={!canEdit}
                        onChange={(event) => updateDefaults({ tokenImage: event.target.value })}
                        className="h-8 w-full rounded-lg border border-white/10 bg-black/30 px-2 text-[10px] font-semibold text-white/70 outline-none focus:border-cyan-200/35 disabled:opacity-60"
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
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/35">Фото карточки</div>
                    <select
                        value={defaults.artImage}
                        disabled={!canEdit}
                        onChange={(event) => updateDefaults({ artImage: event.target.value })}
                        className="h-8 w-full rounded-lg border border-white/10 bg-black/30 px-2 text-[10px] font-semibold text-white/70 outline-none focus:border-cyan-200/35 disabled:opacity-60"
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

            {compactOptions && (
                <div className="mt-3 rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] p-3">
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-accent)]">
                                <Eye size={13} />
                                Compact card
                            </div>
                            <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                {compactConfigured ? 'Настроено' : 'Авто-подбор'}
                            </div>
                        </div>
                        <button
                            type="button"
                            disabled={!canEdit || !compactConfigured}
                            onClick={resetCompactDefaults}
                            className="flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-muted)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)] disabled:cursor-not-allowed disabled:opacity-45"
                            title="Вернуть автоматический подбор полей"
                        >
                            <RotateCcw size={12} />
                            Авто
                        </button>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-2">
                        <div>
                            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">Статы</div>
                            <div className="grid max-h-36 gap-1.5 overflow-y-auto pr-1 custom-scrollbar">
                                {compactOptions.metrics.length > 0
                                    ? compactOptions.metrics.map((metric) => renderCompactOption('metricIds', metric.id, `${metric.label}: ${metric.value}`, metric.id))
                                    : <div className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] p-2 text-center text-[11px] text-[var(--vibe-text-faint)]">Статов пока нет.</div>}
                            </div>
                        </div>

                        <div>
                            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">Ресурсы</div>
                            <div className="grid max-h-36 gap-1.5 overflow-y-auto pr-1 custom-scrollbar">
                                {compactOptions.resources.length > 0
                                    ? compactOptions.resources.map((resource) => renderCompactOption('resourceIds', resource.id, resource.label, `${resource.current}/${resource.max || '∞'}`))
                                    : <div className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] p-2 text-center text-[11px] text-[var(--vibe-text-faint)]">Ресурсов пока нет.</div>}
                            </div>
                        </div>

                        <div>
                            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">Действия</div>
                            <div className="grid max-h-44 gap-1.5 overflow-y-auto pr-1 custom-scrollbar">
                                {compactOptions.actions.length > 0
                                    ? compactOptions.actions.map((action) => renderCompactOption('actionIds', action.id, action.name, action.parentName || (action.kind === 'attack' ? 'атака' : 'способность')))
                                    : <div className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] p-2 text-center text-[11px] text-[var(--vibe-text-faint)]">Действий пока нет.</div>}
                            </div>
                        </div>

                        <div>
                            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">Вещи</div>
                            <div className="grid max-h-44 gap-1.5 overflow-y-auto pr-1 custom-scrollbar">
                                {compactOptions.inventory.length > 0
                                    ? compactOptions.inventory.map((item) => renderCompactOption('inventoryIds', item.id, item.name, item.equipped ? `${item.category} / надето` : item.category))
                                    : <div className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] p-2 text-center text-[11px] text-[var(--vibe-text-faint)]">Вещей пока нет.</div>}
                            </div>
                        </div>
                    </div>

                    <div className="mt-3">
                        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">Заметки</div>
                        <div className="grid grid-cols-3 gap-1.5">
                            {(['hidden', 'short', 'full'] as CharacterCompactNotesMode[]).map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => updateNotesMode(mode)}
                                    className={`h-8 rounded-[var(--vibe-radius-sm)] border px-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                        effectiveCompactDefaults.notesMode === mode
                                            ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-text-primary)]'
                                            : 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)] hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]'
                                    } disabled:cursor-not-allowed disabled:opacity-60`}
                                >
                                    {mode === 'hidden' ? 'Скрыть' : mode === 'short' ? 'Кратко' : 'Полностью'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
