import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Entity } from '../../../types';
import { yjsStore } from '../../../store/yjsStore';
import { useEntitiesByParent, getEntitiesSnapshot } from '../../../hooks/useEntities';
import { useWindowStore } from '../../../store/windowStore';
import { useUIStore } from '../../../store/uiStore';
import { rollEngine } from '../../../services/rollEngine';
import { Dices, Plus, Minus, Trash2, ExternalLink } from 'lucide-react';
import { glass } from '../../../utils/theme';
import clsx from 'clsx';

const RANK_MIN = 0;
const RANK_MAX = 5;

interface CompetenciesBlockProps {
    entity: Entity;
}

function sendRollToChat(compName: string, rank: number, diceCount: number) {
    const expression = `${compName}(${rank})`;
    const result = rollEngine.rollD6Pool(diceCount, expression);

    if (result.error) {
        yjsStore.sendMessage(`Ошибка броска: ${result.error}`, 'Система', true);
        return;
    }

    yjsStore.sendMessage(rollEngine.formatRollMessage(expression, result), 'Система', true);
}

export function CompetenciesBlock({ entity }: CompetenciesBlockProps) {
    const competencies = useEntitiesByParent(entity.id).filter(e => e.type === 'competency');
    const { openWindow } = useWindowStore();
    const { openConfirm } = useUIStore();

    const handleAddCompetency = useCallback(() => {
        const id = uuidv4();
        const newComp: Entity = {
            id,
            parentId: entity.id,
            type: 'competency',
            name: 'Новая компетенция',
            description: '',
            properties: { rank: 0 },
            tags: [],
            database: entity.database,
        };
        yjsStore.addEntity(newComp);
    }, [entity.id, entity.database]);

    const handleUpdateRank = useCallback((compId: string, newRank: number) => {
        const comp = getEntitiesSnapshot()[compId];
        if (!comp) return;
        const clamped = Math.max(RANK_MIN, Math.min(RANK_MAX, newRank));
        yjsStore.updateEntity(compId, {
            properties: { ...comp.properties, rank: clamped }
        });
    }, []);

    const handleDelete = useCallback((compId: string, compName: string) => {
        openConfirm({
            title: 'Удаление компетенции',
            description: `Вы уверены, что хотите удалить компетенцию «${compName}»?`,
            confirmText: 'Удалить',
            isDestructive: true,
            onConfirm: () => {
                yjsStore.deleteEntity(compId);
            }
        });
    }, [openConfirm]);

    const handleRollComp = useCallback((compName: string, rank: number) => {
        if (rank <= 0) return;
        sendRollToChat(compName, rank, rank);
    }, []);

    return (
        <div className="space-y-4">
            {/* COMPETENCIES BLOCK */}
            <div className={glass.blockBg}>
                <div className="flex items-center justify-between mb-4">
                    <h4 className={glass.blockHeader + " mb-0"}>
                        Компетенции ({competencies.length})
                    </h4>
                    <button
                        onClick={handleAddCompetency}
                        className="flex items-center gap-1 px-2 py-1 bg-violet-500/15 border border-violet-500/30 rounded-lg text-violet-300 hover:text-violet-100 hover:bg-violet-500/30 hover:border-violet-400/50 transition-all text-[10px] font-bold uppercase tracking-wider"
                    >
                        <Plus size={12} /> Добавить
                    </button>
                </div>

                {competencies.length === 0 ? (
                    <div className="text-center text-white/30 text-xs py-8 italic border border-dashed border-white/10 rounded-xl">
                        Нет компетенций. Нажмите «Добавить» чтобы создать первую.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2">
                        {competencies.map(comp => {
                            const rank: number = comp.properties?.rank || 0;
                            const canRoll = rank > 0;

                            return (
                                <div
                                    key={comp.id}
                                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group"
                                >
                                    {/* Rank badge */}
                                    <div className={clsx(
                                        "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold font-mono flex-shrink-0 border",
                                        rank > 0 ? "bg-violet-500/20 text-violet-200 border-violet-500/30" :
                                        "bg-white/5 text-white/30 border-white/10"
                                    )}>
                                        +{rank}
                                    </div>

                                    {/* Name + description */}
                                    <div className="flex-1 min-w-0">
                                        <div
                                            className="text-sm font-medium text-white/80 truncate cursor-pointer hover:text-white transition-colors"
                                            onClick={() => openWindow(comp.id, Math.random() * 200 + 100, Math.random() * 200 + 100)}
                                        >
                                            {comp.name}
                                        </div>
                                        {comp.description && (
                                            <div className="text-[10px] text-white/30 truncate mt-0.5">
                                                {comp.description.substring(0, 60)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Rank controls */}
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdateRank(comp.id, rank - 1);
                                            }}
                                            disabled={rank <= RANK_MIN}
                                            className="p-0.5 rounded text-white/30 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                        >
                                            <Minus size={12} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdateRank(comp.id, rank + 1);
                                            }}
                                            disabled={rank >= RANK_MAX}
                                            className="p-0.5 rounded text-white/30 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                        >
                                            <Plus size={12} />
                                        </button>
                                    </div>

                                    {/* Roll button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRollComp(comp.name, rank);
                                        }}
                                        disabled={!canRoll}
                                        title={canRoll ? `Бросить ${rank}d6` : 'Ранг должен быть > 0'}
                                        className={clsx(
                                            'p-1.5 rounded-lg transition-all flex-shrink-0',
                                            canRoll
                                                ? 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/40 hover:text-violet-100 border border-violet-500/30'
                                                : 'bg-white/5 text-white/20 border border-transparent cursor-not-allowed'
                                        )}
                                    >
                                        <Dices size={14} />
                                    </button>

                                    {/* Open window */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openWindow(comp.id, Math.random() * 200 + 100, Math.random() * 200 + 100);
                                        }}
                                        className="p-1.5 rounded-lg text-white/20 hover:text-white/70 hover:bg-white/10 transition-all flex-shrink-0"
                                        title="Открыть окно"
                                    >
                                        <ExternalLink size={14} />
                                    </button>

                                    {/* Delete */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(comp.id, comp.name);
                                        }}
                                        className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/20 transition-all flex-shrink-0"
                                        title="Удалить"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
