import { useState, useCallback, useMemo } from 'react';
import type { Entity } from '../../../types';
import { yjsStore } from '../../../store/yjsStore';
import { useEntitiesByParent } from '../../../hooks/useEntities';
import { rollEngine } from '../../../services/rollEngine';
import { CompetencyRollPopup } from './CompetencyRollPopup';
import { Dices, Minus, Plus } from 'lucide-react';
import { glass } from '../../../utils/theme';
import clsx from 'clsx';

interface SkillsBlockProps {
    entity: Entity;
}

export const SKILLS = [
    { key: 'agility',      name: 'Ловкость' },
    { key: 'attention',    name: 'Внимательность' },
    { key: 'intuition',    name: 'Интуиция' },
    { key: 'logic',        name: 'Логика' },
    { key: 'creativity',   name: 'Креативность' },
    { key: 'empathy',      name: 'Эмпатия' },
    { key: 'charisma',     name: 'Харизма' },
    { key: 'selfcontrol',  name: 'Самообладание' },
] as const;

const RANK_MIN = -2;
const RANK_MAX = 3;

function getEntityOwnerId(entity: Entity): string | undefined {
    const owner = entity.properties?._playerOwner;
    return typeof owner === 'string' ? owner : undefined;
}

/**
 * Formats a dice roll result and sends it to chat.
 */
function sendRollToChat(
    skillName: string,
    skillRank: number,
    competencyName: string | null,
    competencyRank: number,
    diceCount: number
) {
    const compStr = competencyName ? ` + ${competencyName}(${competencyRank})` : '';
    const expression = `${skillName}(${skillRank})${compStr}`;
    const result = rollEngine.rollD6Pool(diceCount, expression);

    if (result.error) {
        yjsStore.sendMessage(`Ошибка броска: ${result.error}`, 'Система', true);
        return;
    }

    yjsStore.sendMessage(rollEngine.formatRollMessage(expression, result), 'Система', true);
}

export function SkillsBlock({ entity }: SkillsBlockProps) {
    const properties = useMemo(() => entity.properties ?? {}, [entity.properties]);
    const skills = properties.skills || {};
    const competencies = useEntitiesByParent(entity.id).filter(e => e.type === 'competency');
    const canEditSkills = yjsStore.canModify(entity.database, getEntityOwnerId(entity));

    const [rollPopup, setRollPopup] = useState<{
        skillKey: string;
        skillName: string;
        skillRank: number;
    } | null>(null);

    const handleUpdateSkillRank = useCallback((skillKey: string, newRank: number) => {
        if (!canEditSkills) return;
        const clamped = Math.max(RANK_MIN, Math.min(RANK_MAX, newRank));
        const newSkills = { ...(properties.skills || {}) };
        newSkills[skillKey] = { ...(newSkills[skillKey] || {}), rank: clamped };
        yjsStore.updateEntity(entity.id, { properties: { ...properties, skills: newSkills } });
    }, [canEditSkills, entity.id, properties]);

    const handleRollClick = useCallback((skillKey: string, skillName: string, skillRank: number) => {
        if (skillRank <= 0) return; // Can't roll with 0 or negative rank

        if (competencies.length === 0) {
            // No competencies — roll directly
            sendRollToChat(skillName, skillRank, null, 0, skillRank);
        } else {
            // Show competency selection popup
            setRollPopup({ skillKey, skillName, skillRank });
        }
    }, [competencies]);

    const handleCompetencySelect = useCallback((competencyId: string | null) => {
        if (!rollPopup) return;

        let compRank = 0;
        let compName: string | null = null;

        if (competencyId) {
            const comp = competencies.find(c => c.id === competencyId);
            if (comp) {
                compRank = comp.properties?.rank || 0;
                compName = comp.name;
            }
        }

        const diceCount = rollPopup.skillRank + compRank;
        if (diceCount <= 0) return;

        sendRollToChat(rollPopup.skillName, rollPopup.skillRank, compName, compRank, diceCount);
        setRollPopup(null);
    }, [rollPopup, competencies]);

    return (
        <div className="space-y-4">
            {/* SKILLS BLOCK */}
            <div className={glass.blockBg}>
                <h4 className={glass.blockHeader}>Навыки</h4>
                <div className="grid grid-cols-1 gap-1.5">
                    {SKILLS.map(({ key, name }) => {
                        const skillData = skills[key] || {};
                        const rank: number = skillData.rank ?? 0;
                        const canRoll = rank > 0;

                        return (
                            <div
                                key={key}
                                className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-transparent hover:bg-white/10 hover:border-white/10 transition-all group"
                            >
                                {/* Skill name */}
                                <span className="text-xs text-white/70 font-medium min-w-[120px] group-hover:text-white/90 transition-colors">
                                    {name}
                                </span>

                                {/* Rank controls */}
                                <div className="flex items-center gap-1.5">
                                    {canEditSkills && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdateSkillRank(key, rank - 1);
                                            }}
                                            disabled={rank <= RANK_MIN}
                                            className="p-0.5 rounded text-white/30 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                        >
                                            <Minus size={12} />
                                        </button>
                                    )}

                                    <span className={clsx(
                                        "w-7 text-center text-sm font-bold font-mono tabular-nums",
                                        rank > 0 ? "text-emerald-400" :
                                        rank < 0 ? "text-red-400/70" :
                                        "text-white/40"
                                    )}>
                                        {rank >= 0 ? `+${rank}` : rank}
                                    </span>

                                    {canEditSkills && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdateSkillRank(key, rank + 1);
                                            }}
                                            disabled={rank >= RANK_MAX}
                                            className="p-0.5 rounded text-white/30 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                        >
                                            <Plus size={12} />
                                        </button>
                                    )}
                                </div>

                                {/* Roll button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRollClick(key, name, rank);
                                    }}
                                    disabled={!canRoll}
                                    title={canRoll
                                        ? `Бросить ${rank}d6`
                                        : 'Ранг должен быть > 0 для броска'
                                    }
                                    className={clsx(
                                        'ml-2 p-1.5 rounded-lg transition-all flex items-center gap-1',
                                        canRoll
                                            ? 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/40 hover:text-violet-100 border border-violet-500/30 hover:border-violet-400/50 shadow-sm hover:shadow-md'
                                            : 'bg-white/5 text-white/20 border border-transparent cursor-not-allowed'
                                    )}
                                >
                                    <Dices size={14} />
                                    {canRoll && (
                                        <span className="text-[10px] font-bold tabular-nums">{rank}d6</span>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Competency Roll Popup */}
            {rollPopup && (
                <CompetencyRollPopup
                    skillName={rollPopup.skillName}
                    skillRank={rollPopup.skillRank}
                    competencies={competencies}
                    onSelect={handleCompetencySelect}
                    onClose={() => setRollPopup(null)}
                />
            )}
        </div>
    );
}
