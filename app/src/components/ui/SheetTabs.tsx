import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

export interface SheetTab<T extends string> {
    id: T;
    label: string;
    badge?: number;
    icon?: LucideIcon;
}

interface SheetTabsProps<T extends string> {
    tabs: SheetTab<T>[];
    activeTab: T;
    onChange: (tab: T) => void;
    endSlot?: ReactNode;
    className?: string;
}

export function SheetTabs<T extends string>({ tabs, activeTab, onChange, endSlot, className }: SheetTabsProps<T>) {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScrollState = useCallback(() => {
        const element = scrollRef.current;
        if (!element) return;

        setCanScrollLeft(element.scrollLeft > 1);
        setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
    }, []);

    useEffect(() => {
        const element = scrollRef.current;
        if (!element) return;

        updateScrollState();
        element.addEventListener('scroll', updateScrollState, { passive: true });
        window.addEventListener('resize', updateScrollState);
        return () => {
            element.removeEventListener('scroll', updateScrollState);
            window.removeEventListener('resize', updateScrollState);
        };
    }, [tabs.length, updateScrollState]);

    const scrollTabs = useCallback((direction: -1 | 1) => {
        scrollRef.current?.scrollBy({ left: direction * 180, behavior: 'smooth' });
    }, []);

    const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
        const element = scrollRef.current;
        if (!element || element.scrollWidth <= element.clientWidth) return;
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

        event.preventDefault();
        element.scrollLeft += event.deltaY;
        updateScrollState();
    }, [updateScrollState]);

    return (
        <div className={clsx(
            'mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-1 shadow-inner',
            className
        )}>
            {(canScrollLeft || canScrollRight) && (
                <button
                    type="button"
                    onClick={() => scrollTabs(-1)}
                    disabled={!canScrollLeft}
                    className="grid h-8 w-7 flex-shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/45 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white disabled:opacity-25"
                    title="Прокрутить вкладки влево"
                >
                    <ChevronLeft size={14} />
                </button>
            )}

            <div
                ref={scrollRef}
                className="flex min-w-0 flex-1 gap-1 overflow-x-auto no-scrollbar"
                onWheel={handleWheel}
            >
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => onChange(tab.id)}
                            className={clsx(
                                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-bold uppercase tracking-wider transition-colors',
                                isActive
                                    ? 'border-white/15 bg-white/15 text-white shadow-sm'
                                    : 'border-transparent text-white/45 hover:bg-white/10 hover:text-white/85'
                            )}
                        >
                            {Icon && <Icon size={13} className={isActive ? 'text-white/85' : 'text-white/35'} />}
                            <span>{tab.label}</span>
                            {typeof tab.badge === 'number' && (
                                <span className={clsx(
                                    'rounded-full px-1.5 py-0.5 text-[9px] leading-none',
                                    isActive ? 'bg-black/25 text-white/80' : 'bg-white/10 text-white/35'
                                )}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {(canScrollLeft || canScrollRight) && (
                <button
                    type="button"
                    onClick={() => scrollTabs(1)}
                    disabled={!canScrollRight}
                    className="grid h-8 w-7 flex-shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/45 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white disabled:opacity-25"
                    title="Прокрутить вкладки вправо"
                >
                    <ChevronRight size={14} />
                </button>
            )}

            {endSlot && (
                <div className="shrink-0 border-l border-white/10 pl-2">
                    {endSlot}
                </div>
            )}
        </div>
    );
}
