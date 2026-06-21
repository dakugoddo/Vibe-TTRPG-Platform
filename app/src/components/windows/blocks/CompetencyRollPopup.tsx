import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ReactDOM from 'react-dom';
import type { Entity } from '../../../types';
import { Dices, X } from 'lucide-react';
import clsx from 'clsx';

interface CompetencyRollPopupProps {
    skillName: string;
    skillRank: number;
    competencies: Entity[];
    onSelect: (competencyId: string | null) => void;
    onClose: () => void;
}

export function CompetencyRollPopup({
    skillName,
    skillRank,
    competencies,
    onSelect,
    onClose
}: CompetencyRollPopupProps) {
    const { t } = useTranslation();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const totalDice = skillRank + (selectedId
        ? (competencies.find(c => c.id === selectedId)?.properties?.rank || 0)
        : 0);

    return ReactDOM.createPortal(
        <>
            {/* Backdrop */}
            <div
                ref={overlayRef}
                className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
                <div className="pointer-events-auto bg-[#151c2b]/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.7)] w-[380px] max-h-[80vh] flex flex-col animate-in zoom-in-95 fade-in duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <div>
                            <h3 className="text-sm font-bold text-white">{t('competencyRoll.title')}</h3>
                            <p className="text-xs text-white/50 mt-0.5">
                                {t('competencyRoll.skillRank', { skill: skillName, rank: skillRank })}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Competency list */}
                    <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-1.5">
                        {/* Option: Without competency */}
                        <button
                            onClick={() => setSelectedId(null)}
                            className={clsx(
                                "w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between",
                                selectedId === null
                                    ? "bg-white/15 border-white/30 shadow-md"
                                    : "bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <Dices size={16} className="text-white/40" />
                                <div>
                                    <div className="text-sm text-white/80 font-medium">{t('competencyRoll.noCompetency')}</div>
                                    <div className="text-[10px] text-white/30">{skillRank}d6</div>
                                </div>
                            </div>
                            <span className="text-xs text-white/40 font-mono">{skillRank}d6</span>
                        </button>

                        {competencies.map(comp => {
                            const rank: number = comp.properties?.rank || 0;
                            return (
                                <button
                                    key={comp.id}
                                    onClick={() => setSelectedId(comp.id)}
                                    className={clsx(
                                        "w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between",
                                        selectedId === comp.id
                                            ? "bg-violet-500/15 border-violet-500/30 shadow-md"
                                            : "bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={clsx(
                                            "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                                            selectedId === comp.id
                                                ? "bg-violet-500/30 text-violet-200"
                                                : "bg-white/10 text-white/50"
                                        )}>
                                            +{rank}
                                        </div>
                                        <div>
                                            <div className="text-sm text-white/80 font-medium">{comp.name}</div>
                                            <div className="text-[10px] text-white/30">
                                                {t('competencyRoll.rankDice', { rank, dice: `${rank}d6` })}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-xs text-white/40 font-mono">+{rank}d6</span>
                                </button>
                            );
                        })}

                        {competencies.length === 0 && (
                            <div className="text-center text-white/30 text-xs py-8 italic">
                                {t('competencyRoll.emptyLine1')}<br />
                                {t('competencyRoll.emptyLine2')}
                            </div>
                        )}
                    </div>

                    {/* Footer with roll button */}
                    <div className="p-4 border-t border-white/10">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <span className="text-xs text-white/40">{t('competencyRoll.totalRoll')}</span>
                            <span className="text-sm font-bold text-white font-mono">{totalDice}d6</span>
                        </div>
                        <button
                            onClick={() => onSelect(selectedId)}
                            disabled={totalDice <= 0}
                            className={clsx(
                                "w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
                                totalDice > 0
                                    ? "bg-violet-500/30 text-violet-100 border border-violet-500/40 hover:bg-violet-500/50 hover:border-violet-400/60 shadow-lg hover:shadow-xl active:scale-[0.98]"
                                    : "bg-white/5 text-white/20 border border-white/5 cursor-not-allowed"
                            )}
                        >
                            <Dices size={16} />
                            {t('competencyRoll.roll', { dice: `${totalDice}d6` })}
                        </button>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
