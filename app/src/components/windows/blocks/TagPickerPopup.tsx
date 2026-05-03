import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { useEntitiesByType } from '../../../hooks/useEntities';
import { yjsStore } from '../../../store/yjsStore';

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

        const newTagId = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-[#151c2b]/70 backdrop-blur-3xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] w-full max-w-sm overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-3 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider">{title}</h3>
                    <button onClick={onClose} className="p-1 text-white/30 hover:text-white rounded transition-colors"><X size={16} /></button>
                </div>

                <div className="p-3 border-b border-white/10 bg-[#151620]/60">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Поиск или создание..."
                            className="w-full bg-[#1a1c29] border border-[#1a1c29] shadow-inner rounded-lg pl-9 pr-3 py-2 text-sm text-white/90 focus:border-white/30 focus:bg-[#2e3145] outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[300px] p-2 custom-scrollbar space-y-1">
                    {availableTags.length === 0 ? (
                        <div className="p-4 text-center">
                            <p className="text-white/40 text-xs mb-2">Не найдено подходящих тегов</p>
                            {searchQuery.trim() && (
                                <button
                                    onClick={handleCreateNewTag}
                                    className="flex items-center gap-2 justify-center w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 border border-emerald-500/20 rounded-lg transition-all text-xs font-bold"
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
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-white/70 hover:text-white transition-colors flex items-center gap-2 group"
                            >
                                <span className="font-medium text-sm group-hover:text-emerald-300 transition-colors">#{tag.name}</span>
                                {tag.description && <span className="text-white/30 text-xs truncate max-w-[50%] ml-auto">{tag.description}</span>}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
