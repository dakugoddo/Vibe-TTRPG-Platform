import { useMemo, useRef, useState, type KeyboardEvent, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';
import { Search } from 'lucide-react';
import { useEntities } from '../../hooks/useEntities';
import { yjsStore } from '../../store/yjsStore';
import { canViewEntity } from '../../utils/permissions';
import type { Entity } from '../../types';

interface WikiLinkTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
    value: string;
    onValueChange: (value: string) => void;
    excludeEntityId?: string;
}

interface WikiTrigger {
    start: number;
    query: string;
}

function getEntityOwnerId(entity: Entity): string | undefined {
    const owner = entity.properties?._playerOwner;
    return typeof owner === 'string' ? owner : undefined;
}

function findWikiTrigger(value: string, caret: number): WikiTrigger | null {
    const beforeCaret = value.slice(0, caret);
    const openIndex = beforeCaret.lastIndexOf('[[');
    if (openIndex === -1) return null;

    const lastCloseIndex = beforeCaret.lastIndexOf(']]');
    if (lastCloseIndex > openIndex) return null;

    const query = beforeCaret.slice(openIndex + 2);
    if (query.includes('[') || query.includes(']') || query.includes('\n')) return null;

    return { start: openIndex, query };
}

function getEntityTypeLabel(entity: Entity): string {
    const labels: Record<Entity['type'], string> = {
        character: 'персонаж',
        object: 'предмет',
        ability: 'способность',
        competency: 'компетенция',
        tag: 'тег',
        canvas: 'канвас',
        note: 'заметка',
        portal: 'портал',
        folder: 'папка',
        attack: 'атака',
    };

    return labels[entity.type] ?? entity.type;
}

export function WikiLinkTextarea({ value, onValueChange, excludeEntityId, className, onKeyDown, ...props }: WikiLinkTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const entities = useEntities();
    const [trigger, setTrigger] = useState<WikiTrigger | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const visibleEntities = useMemo(() => {
        return entities
            .filter(entity => entity.id !== excludeEntityId)
            .filter(entity => canViewEntity(
                yjsStore.localRole,
                entity.database,
                getEntityOwnerId(entity),
                yjsStore.localPlayerId,
                yjsStore.localPlayerName
            ))
            .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [entities, excludeEntityId]);

    const suggestions = useMemo(() => {
        if (!trigger) return [];
        const query = trigger.query.trim().toLowerCase();

        return visibleEntities
            .filter(entity => {
                if (!query) return true;
                return entity.name.toLowerCase().includes(query)
                    || entity.id.toLowerCase().includes(query)
                    || entity.type.toLowerCase().includes(query);
            })
            .slice(0, 8);
    }, [trigger, visibleEntities]);

    const syncTrigger = (nextValue: string, caret: number) => {
        const nextTrigger = findWikiTrigger(nextValue, caret);
        setTrigger(nextTrigger);
        setActiveIndex(0);
    };

    const insertSuggestion = (entity: Entity) => {
        if (!trigger) return;
        const textarea = textareaRef.current;
        const caret = textarea?.selectionStart ?? value.length;
        const nextValue = `${value.slice(0, trigger.start)}[[${entity.id}]]${value.slice(caret)}`;
        const nextCaret = trigger.start + entity.id.length + 4;

        onValueChange(nextValue);
        setTrigger(null);

        window.requestAnimationFrame(() => {
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(nextCaret, nextCaret);
        });
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (trigger && suggestions.length > 0) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex(index => (index + 1) % suggestions.length);
                return;
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex(index => (index - 1 + suggestions.length) % suggestions.length);
                return;
            }

            if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                insertSuggestion(suggestions[activeIndex]);
                return;
            }
        }

        if (trigger && event.key === 'Escape') {
            event.preventDefault();
            setTrigger(null);
            return;
        }

        onKeyDown?.(event);
    };

    return (
        <div className="relative flex min-h-0 flex-1 flex-col">
            <textarea
                {...props}
                ref={textareaRef}
                value={value}
                onChange={(event) => {
                    onValueChange(event.target.value);
                    syncTrigger(event.target.value, event.target.selectionStart);
                }}
                onClick={(event) => syncTrigger(value, event.currentTarget.selectionStart)}
                onKeyUp={(event) => syncTrigger(value, event.currentTarget.selectionStart)}
                onKeyDown={handleKeyDown}
                className={className}
            />

            {trigger && (
                <div className="absolute left-2 right-2 top-10 z-[9999] max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#111827]/95 p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.65)] backdrop-blur-2xl custom-scrollbar">
                    <div className="mb-1 flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-white/35">
                        <Search size={11} />
                        Wiki-ссылка
                    </div>
                    {suggestions.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs italic text-white/35">
                            Нет подходящих сущностей
                        </div>
                    ) : (
                        suggestions.map((entity, index) => (
                            <button
                                key={entity.id}
                                type="button"
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    insertSuggestion(entity);
                                }}
                                className={clsx(
                                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                                    index === activeIndex ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                                )}
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold">{entity.name}</span>
                                    <span className="block truncate text-[10px] text-white/35">
                                        {getEntityTypeLabel(entity)} · {entity.id}
                                    </span>
                                </span>
                                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] uppercase text-white/35">
                                    {entity.database ?? 'general'}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
