import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { glass } from '../../utils/theme';

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
            `mb-[var(--vibe-space-gap)] flex items-center gap-2 rounded-[var(--vibe-radius-md)] p-1 ${glass.tabBar}`,
            className
        )}>
            {(canScrollLeft || canScrollRight) && (
                <button
                    type="button"
                    onClick={() => scrollTabs(-1)}
                    disabled={!canScrollLeft}
                    className={`grid h-[var(--vibe-tab-height)] w-7 flex-shrink-0 place-items-center rounded-[var(--vibe-radius-sm)] disabled:opacity-25 ${glass.iconButton}`}
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
                                'inline-flex h-[var(--vibe-tab-height)] shrink-0 items-center gap-1.5 rounded-lg border px-[var(--vibe-control-px)] text-[11px] font-bold uppercase tracking-wider transition-colors',
                                isActive
                                    ? glass.tabActive
                                    : glass.tabIdle
                            )}
                        >
                            {Icon && <Icon size={13} className={isActive ? 'text-[var(--vibe-text-primary)]' : 'text-[var(--vibe-text-faint)]'} />}
                            <span>{tab.label}</span>
                            {typeof tab.badge === 'number' && (
                                <span className={clsx(
                                    'rounded-full px-1.5 py-0.5 text-[9px] leading-none',
                                    isActive ? 'bg-[var(--vibe-surface-input)] text-[var(--vibe-text-primary)]' : 'bg-[var(--vibe-surface-hover)] text-[var(--vibe-text-faint)]'
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
                    className={`grid h-[var(--vibe-tab-height)] w-7 flex-shrink-0 place-items-center rounded-[var(--vibe-radius-sm)] disabled:opacity-25 ${glass.iconButton}`}
                    title="Прокрутить вкладки вправо"
                >
                    <ChevronRight size={14} />
                </button>
            )}

            {endSlot && (
                <div className="shrink-0 border-l border-[var(--vibe-border-subtle)] pl-2">
                    {endSlot}
                </div>
            )}
        </div>
    );
}
