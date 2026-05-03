import React from 'react';
import type { CalculatedStat } from '../../hooks/useCalculatedStat';
import { Tooltip } from './Tooltip';

interface StatTooltipProps {
    stat: CalculatedStat;
    children: React.ReactNode;
    className?: string; // Optional class for the wrapper
}

export const StatTooltip: React.FC<StatTooltipProps> = ({ stat, children, className = '' }) => {
    const isModified = stat.total !== stat.base;

    const tooltipContent = (
        <div className="w-max max-w-[200px] bg-[#151c2b]/70 backdrop-blur-3xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-3 pointer-events-none">
            <div className="text-xs font-bold text-white/50 mb-2 border-b border-white/10 pb-2 tracking-wider">Расчёт модификаторов</div>
            <div className="flex flex-col gap-1 text-[11px] font-mono mt-1">
                {/* Base value explicitly at the top */}
                <div className="flex justify-between gap-4">
                    <span className="text-white/40 font-sans">База</span>
                    <span className={stat.base >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {stat.base > 0 ? '+' : ''}{stat.base}
                    </span>
                </div>
                {stat.breakdown.filter(item => item.source !== 'Базовое значение' && item.source !== 'Доп. модификатор').map((item, index) => (
                    <div key={index} className="flex justify-between gap-4">
                        <span className={item.source.startsWith('Tag:') || item.source.startsWith('Свойство') ? 'text-white/30' : 'text-white/50 block font-sans'}>
                            {item.source}
                        </span>
                        <span className={item.value >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {item.value > 0 ? '+' : ''}{item.value}
                        </span>
                    </div>
                ))}
                {stat.breakdown.filter(item => item.source === 'Доп. модификатор' && item.value !== 0).map((item, index) => (
                    <div key={`adhoc-${index}`} className="flex justify-between gap-4">
                        <span className="text-white/40 font-sans">Доп. модификатор</span>
                        <span className={item.value >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {item.value > 0 ? '+' : ''}{item.value}
                        </span>
                    </div>
                ))}
            </div>
            <div className="mt-2 pt-2 border-t border-white/10 flex justify-between gap-4 text-xs font-bold font-sans">
                <span className="text-white/60">Итого</span>
                <span className="text-white bg-black/30 px-2 py-0.5 rounded shadow-inner border border-white/5 font-mono">{stat.total}</span>
            </div>
        </div>
    );

    return (
        <Tooltip content={tooltipContent} delay={100} placement="top" className={className}>
            <div className={`transition-colors ${isModified ? 'text-white/60 font-bold' : ''}`}>
                {children}
            </div>
        </Tooltip>
    );
};
