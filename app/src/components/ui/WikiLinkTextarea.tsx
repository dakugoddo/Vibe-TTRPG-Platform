import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { useEntities } from '../../hooks/useEntities';
import { yjsStore } from '../../store/yjsStore';
import { canViewEntity } from '../../utils/permissions';
import { glass } from '../../utils/theme';
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

export const WikiLinkTextarea = forwardRef<HTMLTextAreaElement, WikiLinkTextareaProps>(function WikiLinkTextarea({
    value,
    onValueChange,
    excludeEntityId,
    className,
    onKeyDown,
    readOnly,
    disabled,
    ...props
}: WikiLinkTextareaProps, forwardedRef) {
    const { t } = useTranslation();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const entities = useEntities();
    const [trigger, setTrigger] = useState<WikiTrigger | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const autocompleteDisabled = Boolean(readOnly || disabled);

    useImperativeHandle(forwardedRef, () => textareaRef.current as HTMLTextAreaElement, []);

    const visibleEntities = useMemo(() => {
        return entities
            .filter((entity) => entity.id !== excludeEntityId)
            .filter((entity) => canViewEntity(
                yjsStore.localRole,
                entity.database,
                getEntityOwnerId(entity),
                yjsStore.localPlayerId,
                yjsStore.localPlayerName
            ))
            .sort((left, right) => left.name.localeCompare(right.name, 'ru', { sensitivity: 'base' }));
    }, [entities, excludeEntityId]);

    const suggestions = useMemo(() => {
        if (!trigger || autocompleteDisabled) return [];
        const query = trigger.query.trim().toLowerCase();

        return visibleEntities
            .filter((entity) => {
                if (!query) return true;
                return entity.name.toLowerCase().includes(query)
                    || entity.id.toLowerCase().includes(query)
                    || entity.type.toLowerCase().includes(query);
            })
            .slice(0, 8);
    }, [autocompleteDisabled, trigger, visibleEntities]);

    const syncTrigger = (nextValue: string, caret: number) => {
        if (autocompleteDisabled) {
            setTrigger(null);
            return;
        }

        setTrigger(findWikiTrigger(nextValue, caret));
        setActiveIndex(0);
    };

    const insertSuggestion = (entity: Entity) => {
        if (!trigger || autocompleteDisabled) return;
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
        if (autocompleteDisabled) {
            setTrigger(null);
            onKeyDown?.(event);
            return;
        }

        if (trigger && suggestions.length > 0) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) => (index + 1) % suggestions.length);
                return;
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
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
                readOnly={readOnly}
                disabled={disabled}
                onChange={(event) => {
                    onValueChange(event.target.value);
                    syncTrigger(event.target.value, event.target.selectionStart);
                }}
                onClick={(event) => syncTrigger(value, event.currentTarget.selectionStart)}
                onKeyUp={(event) => syncTrigger(value, event.currentTarget.selectionStart)}
                onKeyDown={handleKeyDown}
                className={className}
            />

            {trigger && !autocompleteDisabled && (
                <div className={`absolute left-2 right-2 top-10 z-[9999] max-h-64 overflow-y-auto p-1.5 custom-scrollbar ${glass.popover}`}>
                    <div className="mb-1 flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                        <Search size={11} />
                        {t('workspace.notes.wikiLinkAutocomplete')}
                    </div>

                    {suggestions.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs italic text-[var(--vibe-text-faint)]">
                            {t('workspace.notes.noWikiLinkSuggestions')}
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
                                    'flex w-full items-center gap-2 rounded-[var(--vibe-radius-sm)] px-2.5 py-2 text-left transition-colors',
                                    index === activeIndex
                                        ? 'bg-[var(--vibe-surface-hover)] text-[var(--vibe-text-primary)]'
                                        : 'text-[var(--vibe-text-muted)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                                )}
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold">{entity.name}</span>
                                    <span className="block truncate text-[10px] text-[var(--vibe-text-faint)]">
                                        {t(`workspace.notes.entityTypes.${entity.type}`)} / {entity.id}
                                    </span>
                                </span>
                                <span className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-1.5 py-0.5 text-[9px] uppercase text-[var(--vibe-text-faint)]">
                                    {t(`workspace.notes.databases.${entity.database ?? 'general'}`)}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
});
