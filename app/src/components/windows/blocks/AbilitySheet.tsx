import type { Entity } from '../../../types';
import { yjsStore } from '../../../store/yjsStore';
import { rollEngine } from '../../../services/rollEngine';
import { getAbilityCostBase, getAbilityFormula, setAbilityCostBase } from '../../../utils/abilityModel';
import { glass } from '../../../utils/theme';
import { Dices } from 'lucide-react';
import clsx from 'clsx';

interface AbilitySheetProps {
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

export function AbilitySheet({ entity }: AbilitySheetProps) {
    const canEditAbility = canEditEntity(entity);
    const formula = getAbilityFormula(entity);
    const costBase = getAbilityCostBase(entity);
    const canRoll = formula.length > 0;

    return (
        <div className="space-y-4 animate-in fade-in duration-200 mt-4">
            <div className={`${glass.blockBg} border-cyan-500/20 shadow-[inset_0_0_20px_rgba(34,211,238,0.05)]`}>
                <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className={glass.blockHeader + ' text-cyan-300 border-cyan-500/20 mb-0'}>
                        Параметры способности
                    </h3>
                    <button
                        onClick={() => sendAbilityRollToChat(entity)}
                        disabled={!canRoll}
                        title={canRoll ? `Бросить ${formula}` : 'Укажите формулу броска'}
                        className={clsx(
                            'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition-all border',
                            canRoll
                                ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/30 hover:bg-cyan-500/35 hover:border-cyan-400/50'
                                : 'bg-white/5 text-white/20 border-transparent cursor-not-allowed'
                        )}
                    >
                        <Dices size={14} /> Бросок
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <label className="min-w-0">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-white/30 block mb-1">Стоимость</span>
                        <input
                            type="number"
                            value={costBase}
                            min={0}
                            readOnly={!canEditAbility}
                            onChange={(e) => updateAbilityProperty(entity, 'cost', setAbilityCostBase(entity, Number(e.target.value) || 0))}
                            className="w-full bg-black/25 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 outline-none focus:border-cyan-400/50 read-only:text-white/40 read-only:cursor-default"
                        />
                    </label>
                    <label className="min-w-0">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-white/30 block mb-1">Формула</span>
                        <input
                            type="text"
                            value={formula}
                            readOnly={!canEditAbility}
                            onChange={(e) => updateAbilityProperty(entity, 'diceFormula', e.target.value)}
                            placeholder="2d6+1"
                            className="w-full bg-black/25 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 outline-none focus:border-cyan-400/50 read-only:text-white/40 read-only:cursor-default"
                        />
                    </label>
                    <label className="min-w-0">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-white/30 block mb-1">Дистанция</span>
                        <input
                            type="text"
                            value={stringifyProperty(entity.properties?.range)}
                            readOnly={!canEditAbility}
                            onChange={(e) => updateAbilityProperty(entity, 'range', e.target.value)}
                            placeholder="ближняя"
                            className="w-full bg-black/25 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 outline-none focus:border-cyan-400/50 read-only:text-white/40 read-only:cursor-default"
                        />
                    </label>
                    <label className="min-w-0">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-white/30 block mb-1">Область</span>
                        <input
                            type="text"
                            value={stringifyProperty(entity.properties?.area)}
                            readOnly={!canEditAbility}
                            onChange={(e) => updateAbilityProperty(entity, 'area', e.target.value)}
                            placeholder="цель"
                            className="w-full bg-black/25 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 outline-none focus:border-cyan-400/50 read-only:text-white/40 read-only:cursor-default"
                        />
                    </label>
                </div>
            </div>
        </div>
    );
}
