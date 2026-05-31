import React from 'react';
import type { CalculatedStat } from '../../hooks/useCalculatedStat';
import { glass } from '../../utils/theme';
import { Tooltip } from './Tooltip';

interface StatTooltipProps {
    stat: CalculatedStat;
    children: React.ReactNode;
    className?: string; // Optional class for the wrapper
}

export const StatTooltip: React.FC<StatTooltipProps> = ({ stat, children, className = '' }) => {
    const isModified = stat.total !== stat.base;
    const signedValueClass = (value: number) => value >= 0 ? 'text-[var(--vibe-success)]' : 'text-[var(--vibe-danger)]';

    const tooltipContent = (
        <div className={`pointer-events-none w-max max-w-[200px] rounded-[var(--vibe-radius-md)] p-3 ${glass.popover}`}>
            <div className="mb-2 border-b border-[var(--vibe-border-subtle)] pb-2 text-xs font-bold tracking-wider text-[var(--vibe-text-faint)]">Расчёт модификаторов</div>
            <div className="flex flex-col gap-1 text-[11px] font-mono mt-1">
                {/* Base value explicitly at the top */}
                <div className="flex justify-between gap-4">
                    <span className="font-sans text-[var(--vibe-text-faint)]">База</span>
                    <span className={signedValueClass(stat.base)}>
                        {stat.base > 0 ? '+' : ''}{stat.base}
                    </span>
                </div>
                {stat.breakdown.filter(item => item.source !== 'Базовое значение' && item.source !== 'Доп. модификатор').map((item, index) => (
                    <div key={index} className="flex justify-between gap-4">
                        <span className={item.source.startsWith('Tag:') || item.source.startsWith('Свойство') ? 'text-[var(--vibe-text-faint)]' : 'block font-sans text-[var(--vibe-text-muted)]'}>
                            {item.source}
                        </span>
                        <span className={signedValueClass(item.value)}>
                            {item.value > 0 ? '+' : ''}{item.value}
                        </span>
                    </div>
                ))}
                {stat.breakdown.filter(item => item.source === 'Доп. модификатор' && item.value !== 0).map((item, index) => (
                    <div key={`adhoc-${index}`} className="flex justify-between gap-4">
                        <span className="font-sans text-[var(--vibe-text-faint)]">Доп. модификатор</span>
                        <span className={signedValueClass(item.value)}>
                            {item.value > 0 ? '+' : ''}{item.value}
                        </span>
                    </div>
                ))}
            </div>
            <div className="mt-2 flex justify-between gap-4 border-t border-[var(--vibe-border-subtle)] pt-2 font-sans text-xs font-bold">
                <span className="text-[var(--vibe-text-muted)]">Итого</span>
                <span className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-0.5 font-mono text-[var(--vibe-text-primary)] shadow-inner">{stat.total}</span>
            </div>
        </div>
    );

    return (
        <Tooltip content={tooltipContent} delay={100} placement="top" className={className}>
            <div className={`transition-colors ${isModified ? 'font-bold text-[var(--vibe-text-muted)]' : ''}`}>
                {children}
            </div>
        </Tooltip>
    );
};
