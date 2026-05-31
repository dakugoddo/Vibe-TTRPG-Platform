import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { getEntitiesSnapshot, useEntitiesByType } from '../../../hooks/useEntities';
import { yjsStore } from '../../../store/yjsStore';
import { generateEntityId } from '../../../utils/entityId';
import { glass } from '../../../utils/theme';

interface TagPickerPopupProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (tagId: string) => void;
    excludeTags?: string[];
    allowedFolders?: string[]; // IDs of folders to pick from, e.g. ['folder_tags_statuses']
    title?: string;
}

export function TagPickerPopup({ isOpen, onClose, onSelect, excludeTags = [], allowedFolders = [], title = "Выберите тег" }: TagPickerPopupProps) {
    const allTags = useEntitiesByType('tag');
    const [searchQuery, setSearchQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSearchQuery('');
        }
    }, [isOpen]);

    const availableTags = useMemo(() => {
        return allTags.filter(entity => {
            if (excludeTags.includes(entity.id)) return false;
            if (allowedFolders.length > 0 && !allowedFolders.includes(entity.parentId as string)) return false;

            if (searchQuery) {
                return entity.name.toLowerCase().includes(searchQuery.toLowerCase());
            }
            return true;
        });
    }, [allTags, excludeTags, allowedFolders, searchQuery]);

    const handleCreateNewTag = () => {
        if (!searchQuery.trim()) return;
        const parentId = allowedFolders.length > 0 ? allowedFolders[0] : null;

        const newTagId = generateEntityId(Object.keys(getEntitiesSnapshot()));
        yjsStore.addEntity({
            id: newTagId,
            parentId: parentId,
            type: 'tag',
            name: searchQuery.trim(),
            description: '',
            properties: { modifiers: [] },
            tags: []
        });

        onSelect(newTagId);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex animate-in items-center justify-center bg-[color-mix(in_srgb,var(--vibe-body-bg)_62%,transparent)] p-4 backdrop-blur-sm duration-200 fade-in" onClick={onClose}>
            <div className={`flex w-full max-w-sm flex-col overflow-hidden rounded-[var(--vibe-radius-lg)] ${glass.popover}`} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-header)] p-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--vibe-text-muted)]">{title}</h3>
                    <button onClick={onClose} className={`${glass.iconButton} p-1`}><X size={16} /></button>
                </div>

                <div className="border-b border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] p-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vibe-text-faint)]" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Поиск или создание..."
                            className={`${glass.input} w-full py-2 pl-9 pr-3 text-sm`}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[300px] p-2 custom-scrollbar space-y-1">
                    {availableTags.length === 0 ? (
                        <div className="p-4 text-center">
                            <p className="mb-2 text-xs text-[var(--vibe-text-faint)]">Не найдено подходящих тегов</p>
                            {searchQuery.trim() && (
                                <button
                                    onClick={handleCreateNewTag}
                                    className="flex w-full items-center justify-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-success)_32%,transparent)] bg-[color-mix(in_srgb,var(--vibe-success)_12%,transparent)] py-2 text-xs font-bold text-[var(--vibe-success)] transition-all hover:bg-[color-mix(in_srgb,var(--vibe-success)_22%,transparent)]"
                                >
                                    <Plus size={14} /> Создать "{searchQuery.trim()}"
                                </button>
                            )}
                        </div>
                    ) : (
                        availableTags.map(tag => (
                            <button
                                key={tag.id}
                                onClick={() => { onSelect(tag.id); onClose(); }}
                                className="group flex w-full items-center gap-2 rounded-[var(--vibe-radius-sm)] px-3 py-2 text-left text-[var(--vibe-text-muted)] transition-colors hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                            >
                                <span className="text-sm font-medium transition-colors group-hover:text-[var(--vibe-success)]">#{tag.name}</span>
                                {tag.description && <span className="ml-auto max-w-[50%] truncate text-xs text-[var(--vibe-text-faint)]">{tag.description}</span>}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
