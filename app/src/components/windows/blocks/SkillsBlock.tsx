import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
    { key: 'agility',      nameKey: 'skillsBlock.skills.agility' },
    { key: 'attention',    nameKey: 'skillsBlock.skills.attention' },
    { key: 'intuition',    nameKey: 'skillsBlock.skills.intuition' },
    { key: 'logic',        nameKey: 'skillsBlock.skills.logic' },
    { key: 'creativity',   nameKey: 'skillsBlock.skills.creativity' },
    { key: 'empathy',      nameKey: 'skillsBlock.skills.empathy' },
    { key: 'charisma',     nameKey: 'skillsBlock.skills.charisma' },
    { key: 'selfcontrol',  nameKey: 'skillsBlock.skills.selfcontrol' },
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
    diceCount: number,
    t: (key: string, options?: Record<string, unknown>) => string
) {
    const compStr = competencyName ? ` + ${competencyName}(${competencyRank})` : '';
    const expression = `${skillName}(${skillRank})${compStr}`;
    const result = rollEngine.rollD6Pool(diceCount, expression);

    if (result.error) {
        yjsStore.sendMessage(t('skillsBlock.rollError', { error: result.error }), t('chat.systemSender'), true);
        return;
    }

    yjsStore.sendMessage(rollEngine.formatRollMessage(expression, result), t('chat.systemSender'), true);
}

export function SkillsBlock({ entity }: SkillsBlockProps) {
    const { t } = useTranslation();
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
            sendRollToChat(skillName, skillRank, null, 0, skillRank, t);
        } else {
            // Show competency selection popup
            setRollPopup({ skillKey, skillName, skillRank });
        }
    }, [competencies, t]);

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

        sendRollToChat(rollPopup.skillName, rollPopup.skillRank, compName, compRank, diceCount, t);
        setRollPopup(null);
    }, [rollPopup, competencies, t]);

    return (
        <div className="space-y-4">
            {/* SKILLS BLOCK */}
            <div className={glass.blockBg}>
                <h4 className={glass.blockHeader}>{t('skillsBlock.title')}</h4>
                <div className="grid grid-cols-1 gap-1.5">
                    {SKILLS.map(({ key, nameKey }) => {
                        const name = t(nameKey);
                        const skillData = skills[key] || {};
                        const rank: number = skillData.rank ?? 0;
                        const canRoll = rank > 0;

                        return (
                            <div
                                key={key}
                                className="group flex items-center justify-between rounded-[var(--vibe-radius-sm)] border border-transparent bg-[var(--vibe-surface-input)] p-2 transition-all hover:border-[var(--vibe-border-subtle)] hover:bg-[var(--vibe-surface-hover)]"
                            >
                                {/* Skill name */}
                                <span className="min-w-[120px] text-xs font-medium text-[var(--vibe-text-muted)] transition-colors group-hover:text-[var(--vibe-text-primary)]">
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
                                            className="rounded p-0.5 text-[var(--vibe-text-faint)] transition-all hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)] disabled:cursor-not-allowed disabled:opacity-20"
                                        >
                                            <Minus size={12} />
                                        </button>
                                    )}

                                    <span className={clsx(
                                        "w-7 text-center text-sm font-bold font-mono tabular-nums",
                                        rank > 0 ? "text-[var(--vibe-success)]" :
                                        rank < 0 ? "text-[var(--vibe-danger)]" :
                                        "text-[var(--vibe-text-faint)]"
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
                                            className="rounded p-0.5 text-[var(--vibe-text-faint)] transition-all hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)] disabled:cursor-not-allowed disabled:opacity-20"
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
                                        ? t('skillsBlock.rollTitle', { dice: `${rank}d6` })
                                        : t('skillsBlock.rankMustBePositive')
                                    }
                                    className={clsx(
                                        'ml-2 flex items-center gap-1 rounded-[var(--vibe-radius-sm)] border p-1.5 transition-all',
                                        canRoll
                                            ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)] shadow-sm hover:border-[var(--vibe-accent)] hover:bg-[var(--vibe-surface-hover)] hover:shadow-md'
                                            : 'cursor-not-allowed border-transparent bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)]'
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
