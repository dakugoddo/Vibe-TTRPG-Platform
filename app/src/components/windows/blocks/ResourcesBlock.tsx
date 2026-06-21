import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import type { Entity } from '../../../types';
import { yjsStore } from '../../../store/yjsStore';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { glass } from '../../../utils/theme';
import { applyResourcePatch, normalizeResources, type ResourceEntry } from '../../../utils/resourceModel';
import clsx from 'clsx';

interface ResourcesBlockProps {
    entity: Entity;
}

function getEntityOwnerId(entity: Entity): string | undefined {
    const owner = entity.properties?._playerOwner;
    return typeof owner === 'string' ? owner : undefined;
}

function canEditEntity(entity: Entity): boolean {
    return yjsStore.canModify(entity.database, getEntityOwnerId(entity));
}

export function ResourcesBlock({ entity }: ResourcesBlockProps) {
    const { t } = useTranslation();
    const canEditResources = canEditEntity(entity);
    const resources = useMemo(() => normalizeResources(entity.properties?.resources), [entity.properties?.resources]);
    const entries = Object.entries(resources);

    const saveResources = useCallback((nextResources: Record<string, ResourceEntry>) => {
        if (!canEditResources) return;
        yjsStore.updateEntity(entity.id, {
            properties: {
                ...entity.properties,
                resources: nextResources,
            },
        });
    }, [canEditResources, entity.id, entity.properties]);

    const handleAddResource = useCallback(() => {
        if (!canEditResources) return;
        const id = `resource_${uuidv4().slice(0, 8)}`;
        saveResources({
            ...resources,
            [id]: {
                label: t('resourcesBlock.newResource'),
                current: 0,
                max: 0,
            },
        });
    }, [canEditResources, resources, saveResources, t]);

    const handleUpdateResource = useCallback((id: string, patch: Partial<ResourceEntry>) => {
        const previous = resources[id] ?? { current: 0, max: 0 };

        saveResources({
            ...resources,
            [id]: applyResourcePatch(previous, patch),
        });
    }, [resources, saveResources]);

    const handleDeleteResource = useCallback((id: string) => {
        if (!canEditResources) return;
        const nextResources = { ...resources };
        delete nextResources[id];
        saveResources(nextResources);
    }, [canEditResources, resources, saveResources]);

    return (
        <div className="space-y-4">
            <div className={glass.blockBg}>
                <div className="flex items-center justify-between gap-3 mb-4">
                    <h4 className={glass.blockHeader + ' mb-0'}>
                        {t('resourcesBlock.title', { count: entries.length })}
                    </h4>
                    {canEditResources && (
                        <button
                            onClick={handleAddResource}
                            className="flex items-center gap-1 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-success)_34%,transparent)] bg-[color-mix(in_srgb,var(--vibe-success)_14%,transparent)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-success)] transition-all hover:border-[color-mix(in_srgb,var(--vibe-success)_52%,transparent)] hover:bg-[color-mix(in_srgb,var(--vibe-success)_24%,transparent)]"
                        >
                            <Plus size={12} /> {t('entityWindow.add')}
                        </button>
                    )}
                </div>

                {entries.length === 0 ? (
                    <div className="rounded-[var(--vibe-radius-md)] border border-dashed border-[var(--vibe-border-subtle)] py-8 text-center text-xs italic text-[var(--vibe-text-faint)]">
                        {canEditResources ? t('resourcesBlock.emptyEditable') : t('resourcesBlock.empty')}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2">
                        {entries.map(([id, resource]) => {
                            const label = resource.label?.trim() || id;
                            const current = resource.current ?? 0;
                            const max = resource.max ?? 0;
                            const ratio = max > 0 ? Math.min(100, Math.max(0, (current / max) * 100)) : 0;

                            return (
                                <div
                                    key={id}
                                    className="rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3 transition-all hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]"
                                >
                                    <div className="flex items-start gap-3">
                                        <label className="flex-1 min-w-0">
                                            <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('resourcesBlock.name')}</span>
                                            <input
                                                type="text"
                                                value={label}
                                                readOnly={!canEditResources}
                                                onChange={(e) => handleUpdateResource(id, { label: e.target.value })}
                                                className={`${glass.input} w-full text-xs read-only:cursor-default read-only:text-[var(--vibe-text-faint)]`}
                                            />
                                        </label>

                                        <div className="flex items-end gap-1.5">
                                            <button
                                                onClick={() => handleUpdateResource(id, { current: current - 1 })}
                                                disabled={!canEditResources || current <= 0}
                                                className="mb-px rounded-[var(--vibe-radius-sm)] p-1.5 text-[var(--vibe-text-faint)] transition-all hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)] disabled:cursor-not-allowed disabled:opacity-20"
                                                title="-1"
                                            >
                                                <Minus size={13} />
                                            </button>
                                            <label className="w-16">
                                                <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('resourcesBlock.current')}</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={current}
                                                    readOnly={!canEditResources}
                                                    onChange={(e) => handleUpdateResource(id, { current: Number(e.target.value) || 0 })}
                                                    className={`${glass.input} w-full text-center text-xs read-only:cursor-default read-only:text-[var(--vibe-text-faint)]`}
                                                />
                                            </label>
                                            <label className="w-16">
                                                <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('resourcesBlock.max')}</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={max}
                                                    readOnly={!canEditResources}
                                                    onChange={(e) => handleUpdateResource(id, { max: Number(e.target.value) || 0 })}
                                                    className={`${glass.input} w-full text-center text-xs read-only:cursor-default read-only:text-[var(--vibe-text-faint)]`}
                                                />
                                            </label>
                                            <button
                                                onClick={() => handleUpdateResource(id, { current: current + 1 })}
                                                disabled={!canEditResources || (max > 0 && current >= max)}
                                                className="mb-px rounded-[var(--vibe-radius-sm)] p-1.5 text-[var(--vibe-text-faint)] transition-all hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)] disabled:cursor-not-allowed disabled:opacity-20"
                                                title="+1"
                                            >
                                                <Plus size={13} />
                                            </button>
                                            {canEditResources && (
                                                <button
                                                    onClick={() => handleDeleteResource(id)}
                                                    className="mb-px rounded-[var(--vibe-radius-sm)] p-1.5 text-[var(--vibe-text-faint)] transition-all hover:bg-[color-mix(in_srgb,var(--vibe-danger)_18%,transparent)] hover:text-[var(--vibe-danger)]"
                                                    title={t('resourcesBlock.deleteResource')}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] shadow-[var(--vibe-shadow-block)]">
                                        <div
                                            className={clsx(
                                                'h-full rounded-full transition-all duration-200',
                                                max === 0
                                                    ? 'bg-[color-mix(in_srgb,var(--vibe-text-faint)_35%,transparent)]'
                                                    : ratio <= 25
                                                        ? 'bg-[var(--vibe-danger)]'
                                                        : ratio <= 60
                                                            ? 'bg-[var(--vibe-warning)]'
                                                            : 'bg-[var(--vibe-success)]'
                                            )}
                                            style={{ width: max > 0 ? `${ratio}%` : '0%' }}
                                        />
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
