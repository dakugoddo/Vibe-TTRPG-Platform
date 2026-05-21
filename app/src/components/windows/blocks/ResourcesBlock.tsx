import { useCallback, useMemo } from 'react';
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
                label: 'Новый ресурс',
                current: 0,
                max: 0,
            },
        });
    }, [canEditResources, resources, saveResources]);

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
                        Ресурсы ({entries.length})
                    </h4>
                    {canEditResources && (
                        <button
                            onClick={handleAddResource}
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-300 hover:text-emerald-100 hover:bg-emerald-500/30 hover:border-emerald-400/50 transition-all text-[10px] font-bold uppercase tracking-wider"
                        >
                            <Plus size={12} /> Добавить
                        </button>
                    )}
                </div>

                {entries.length === 0 ? (
                    <div className="text-center text-white/30 text-xs py-8 italic border border-dashed border-white/10 rounded-xl">
                        {canEditResources ? 'Нет ресурсов. Добавьте запас, заряд, фокус или другой счетчик.' : 'Ресурсы пока не добавлены.'}
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
                                    className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all"
                                >
                                    <div className="flex items-start gap-3">
                                        <label className="flex-1 min-w-0">
                                            <span className="text-[9px] uppercase font-bold tracking-wider text-white/30 block mb-1">Название</span>
                                            <input
                                                type="text"
                                                value={label}
                                                readOnly={!canEditResources}
                                                onChange={(e) => handleUpdateResource(id, { label: e.target.value })}
                                                className="w-full bg-black/25 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 outline-none focus:border-emerald-400/50 read-only:text-white/40 read-only:cursor-default"
                                            />
                                        </label>

                                        <div className="flex items-end gap-1.5">
                                            <button
                                                onClick={() => handleUpdateResource(id, { current: current - 1 })}
                                                disabled={!canEditResources || current <= 0}
                                                className="mb-px p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                                title="-1"
                                            >
                                                <Minus size={13} />
                                            </button>
                                            <label className="w-16">
                                                <span className="text-[9px] uppercase font-bold tracking-wider text-white/30 block mb-1">Текущее</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={current}
                                                    readOnly={!canEditResources}
                                                    onChange={(e) => handleUpdateResource(id, { current: Number(e.target.value) || 0 })}
                                                    className="w-full bg-black/25 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 text-center outline-none focus:border-emerald-400/50 read-only:text-white/40 read-only:cursor-default"
                                                />
                                            </label>
                                            <label className="w-16">
                                                <span className="text-[9px] uppercase font-bold tracking-wider text-white/30 block mb-1">Макс.</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={max}
                                                    readOnly={!canEditResources}
                                                    onChange={(e) => handleUpdateResource(id, { max: Number(e.target.value) || 0 })}
                                                    className="w-full bg-black/25 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 text-center outline-none focus:border-emerald-400/50 read-only:text-white/40 read-only:cursor-default"
                                                />
                                            </label>
                                            <button
                                                onClick={() => handleUpdateResource(id, { current: current + 1 })}
                                                disabled={!canEditResources || (max > 0 && current >= max)}
                                                className="mb-px p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                                title="+1"
                                            >
                                                <Plus size={13} />
                                            </button>
                                            {canEditResources && (
                                                <button
                                                    onClick={() => handleDeleteResource(id)}
                                                    className="mb-px p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/20 transition-all"
                                                    title="Удалить ресурс"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="h-2 w-full bg-black/30 rounded-full overflow-hidden border border-white/5 mt-3 shadow-inner">
                                        <div
                                            className={clsx(
                                                'h-full rounded-full transition-all duration-200',
                                                max === 0 ? 'bg-white/15' : ratio <= 25 ? 'bg-red-400/80' : ratio <= 60 ? 'bg-amber-400/80' : 'bg-emerald-400/80'
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
