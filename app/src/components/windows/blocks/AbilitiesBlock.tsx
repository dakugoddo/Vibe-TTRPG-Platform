import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Entity } from '../../../types';
import { yjsStore } from '../../../store/yjsStore';
import { useEntitiesByParent, getEntitiesSnapshot } from '../../../hooks/useEntities';
import { useWindowStore } from '../../../store/windowStore';
import { useUIStore } from '../../../store/uiStore';
import { rollEngine } from '../../../services/rollEngine';
import { Dices, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { glass } from '../../../utils/theme';
import clsx from 'clsx';

interface AbilitiesBlockProps {
    entity: Entity;
}

function getEntityOwnerId(entity: Entity): string | undefined {
    const owner = entity.properties?._playerOwner;
    return typeof owner === 'string' ? owner : undefined;
}

function canEditEntity(entity: Entity): boolean {
    return yjsStore.canModify(entity.database, getEntityOwnerId(entity));
}

function stringifyProperty(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
}

function getAbilityFormula(ability: Entity): string {
    const properties = ability.properties ?? {};
    const hasDiceFormula = Object.prototype.hasOwnProperty.call(properties, 'diceFormula');
    const raw = hasDiceFormula ? stringifyProperty(properties.diceFormula) : stringifyProperty(properties.dice);
    return raw
        .replace(/^\/r\s+/i, '')
        .replace(/^\/roll\s+/i, '')
        .replace(/^!roll\s+/i, '')
        .trim();
}

function getCostBase(ability: Entity): number {
    const cost = ability.properties?.cost;
    if (typeof cost === 'number') return cost;
    if (typeof cost === 'string') return Number(cost) || 0;
    if (cost && typeof cost === 'object' && 'base' in cost) {
        const base = (cost as { base?: unknown }).base;
        return typeof base === 'number' ? base : Number(base) || 0;
    }
    return 0;
}

function updateAbilityProperty(ability: Entity, key: string, value: unknown) {
    if (!canEditEntity(ability)) return;
    yjsStore.updateEntity(ability.id, {
        properties: {
            ...ability.properties,
            [key]: value,
        },
    });
}

function sendAbilityRollToChat(ability: Entity) {
    const formula = getAbilityFormula(ability);
    if (!formula) return;

    const result = rollEngine.rollDiceNotation(formula);
    if (result.error) {
        yjsStore.sendMessage(`Ошибка броска ${ability.name}: ${result.error}`, 'Система', true);
        return;
    }

    yjsStore.sendMessage(rollEngine.formatRollMessage(`${ability.name}: ${formula}`, result), 'Система', true);
}

export function AbilitiesBlock({ entity }: AbilitiesBlockProps) {
    const abilities = useEntitiesByParent(entity.id).filter(e => e.type === 'ability');
    const { openWindow } = useWindowStore();
    const { openConfirm } = useUIStore();
    const canEditParent = canEditEntity(entity);

    const handleAddAbility = useCallback(() => {
        if (!canEditParent) return;
        const ownerId = getEntityOwnerId(entity);
        const newAbility: Entity = {
            id: uuidv4(),
            parentId: entity.id,
            type: 'ability',
            name: 'Новая способность',
            description: '',
            properties: {
                cost: { base: 0 },
                range: '',
                area: '',
                diceFormula: '',
                ...(ownerId ? { _playerOwner: ownerId } : {}),
            },
            tags: [],
            database: entity.database,
        };
        yjsStore.addEntity(newAbility);
        openWindow(newAbility.id, Math.random() * 200 + 100, Math.random() * 200 + 100);
    }, [canEditParent, entity, openWindow]);

    const handleDelete = useCallback((abilityId: string, abilityName: string) => {
        const ability = getEntitiesSnapshot()[abilityId];
        if (!ability || !canEditEntity(ability)) return;

        openConfirm({
            title: 'Удаление способности',
            description: `Вы уверены, что хотите удалить способность «${abilityName}»?`,
            confirmText: 'Удалить',
            isDestructive: true,
            onConfirm: () => {
                yjsStore.deleteEntity(abilityId);
            },
        });
    }, [openConfirm]);

    return (
        <div className="space-y-4">
            <div className={glass.blockBg}>
                <div className="flex items-center justify-between gap-3 mb-4">
                    <h4 className={glass.blockHeader + ' mb-0'}>
                        Способности ({abilities.length})
                    </h4>
                    {canEditParent && (
                        <button
                            onClick={handleAddAbility}
                            className="flex items-center gap-1 px-2 py-1 bg-cyan-500/15 border border-cyan-500/30 rounded-lg text-cyan-300 hover:text-cyan-100 hover:bg-cyan-500/30 hover:border-cyan-400/50 transition-all text-[10px] font-bold uppercase tracking-wider"
                        >
                            <Plus size={12} /> Добавить
                        </button>
                    )}
                </div>

                {abilities.length === 0 ? (
                    <div className="text-center text-white/30 text-xs py-8 italic border border-dashed border-white/10 rounded-xl">
                        {canEditParent ? 'Нет способностей. Нажмите «Добавить» чтобы создать первую.' : 'Способности пока не добавлены.'}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2">
                        {abilities.map(ability => {
                            const canEditAbility = canEditEntity(ability);
                            const formula = getAbilityFormula(ability);
                            const canRoll = formula.length > 0;
                            const costBase = getCostBase(ability);

                            return (
                                <div
                                    key={ability.id}
                                    className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold font-mono flex-shrink-0 border bg-cyan-500/15 text-cyan-200 border-cyan-500/30">
                                            {costBase}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <button
                                                onClick={() => openWindow(ability.id, Math.random() * 200 + 100, Math.random() * 200 + 100)}
                                                className="block text-left text-sm font-medium text-white/85 truncate hover:text-white transition-colors"
                                            >
                                                {ability.name}
                                            </button>
                                            {ability.description && (
                                                <div className="text-[10px] text-white/30 truncate mt-0.5">
                                                    {ability.description.substring(0, 80)}
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                sendAbilityRollToChat(ability);
                                            }}
                                            disabled={!canRoll}
                                            title={canRoll ? `Бросить ${formula}` : 'Укажите формулу броска'}
                                            className={clsx(
                                                'p-1.5 rounded-lg transition-all flex-shrink-0',
                                                canRoll
                                                    ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/40 hover:text-cyan-100 border border-cyan-500/30'
                                                    : 'bg-white/5 text-white/20 border border-transparent cursor-not-allowed'
                                            )}
                                        >
                                            <Dices size={14} />
                                        </button>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openWindow(ability.id, Math.random() * 200 + 100, Math.random() * 200 + 100);
                                            }}
                                            className="p-1.5 rounded-lg text-white/25 hover:text-white/75 hover:bg-white/10 transition-all flex-shrink-0"
                                            title="Открыть окно"
                                        >
                                            <ExternalLink size={14} />
                                        </button>

                                        {canEditAbility && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(ability.id, ability.name);
                                                }}
                                                className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/20 transition-all flex-shrink-0"
                                                title="Удалить"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mt-3">
                                        <label className="min-w-0">
                                            <span className="text-[9px] uppercase font-bold tracking-wider text-white/30 block mb-1">Стоимость</span>
                                            <input
                                                type="number"
                                                value={costBase}
                                                min={0}
                                                readOnly={!canEditAbility}
                                                onChange={(e) => {
                                                    const nextCost = { ...(typeof ability.properties?.cost === 'object' && ability.properties.cost ? ability.properties.cost : {}), base: Number(e.target.value) || 0 };
                                                    updateAbilityProperty(ability, 'cost', nextCost);
                                                }}
                                                className="w-full bg-black/25 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 outline-none focus:border-cyan-400/50 read-only:text-white/40 read-only:cursor-default"
                                            />
                                        </label>
                                        <label className="min-w-0">
                                            <span className="text-[9px] uppercase font-bold tracking-wider text-white/30 block mb-1">Формула</span>
                                            <input
                                                type="text"
                                                value={formula}
                                                readOnly={!canEditAbility}
                                                onChange={(e) => updateAbilityProperty(ability, 'diceFormula', e.target.value)}
                                                placeholder="2d6+1"
                                                className="w-full bg-black/25 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 outline-none focus:border-cyan-400/50 read-only:text-white/40 read-only:cursor-default"
                                            />
                                        </label>
                                        <label className="min-w-0">
                                            <span className="text-[9px] uppercase font-bold tracking-wider text-white/30 block mb-1">Дистанция</span>
                                            <input
                                                type="text"
                                                value={stringifyProperty(ability.properties?.range)}
                                                readOnly={!canEditAbility}
                                                onChange={(e) => updateAbilityProperty(ability, 'range', e.target.value)}
                                                placeholder="ближняя"
                                                className="w-full bg-black/25 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 outline-none focus:border-cyan-400/50 read-only:text-white/40 read-only:cursor-default"
                                            />
                                        </label>
                                        <label className="min-w-0">
                                            <span className="text-[9px] uppercase font-bold tracking-wider text-white/30 block mb-1">Область</span>
                                            <input
                                                type="text"
                                                value={stringifyProperty(ability.properties?.area)}
                                                readOnly={!canEditAbility}
                                                onChange={(e) => updateAbilityProperty(ability, 'area', e.target.value)}
                                                placeholder="цель"
                                                className="w-full bg-black/25 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 outline-none focus:border-cyan-400/50 read-only:text-white/40 read-only:cursor-default"
                                            />
                                        </label>
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
