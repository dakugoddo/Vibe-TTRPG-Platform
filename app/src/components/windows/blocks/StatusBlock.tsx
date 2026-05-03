import { useState } from 'react';
import type { Entity } from '../../../types';
import { yjsStore } from '../../../store/yjsStore';
import { useEntitiesByIds, getEntitySnapshot } from '../../../hooks/useEntities';

interface StatusBlockProps {
    entity: Entity;
}

export function StatusBlock({ entity }: StatusBlockProps) {
    // Subscribe only to tag entities that are applied to this character
    const tags = useEntitiesByIds(entity.tags || []).filter(e => e.type === 'tag');
    const [isDragOver, setIsDragOver] = useState(false);

    const handleRemoveTag = (tagId: string) => {
        const newTags = entity.tags?.filter(id => id !== tagId) || [];
        yjsStore.updateEntity(entity.id, { tags: newTags });
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const droppedEntityId = e.dataTransfer.getData("application/entity-id");

        if (droppedEntityId) {
            const droppedEntity = getEntitySnapshot(droppedEntityId);
            // Only allow tags to be dropped here
            if (droppedEntity && droppedEntity.type === 'tag') {
                // Prevent duplicate tags
                if (!entity.tags?.includes(droppedEntity.id)) {
                    yjsStore.updateEntity(entity.id, {
                        tags: [...(entity.tags || []), droppedEntity.id]
                    });
                }
            }
        }
    };

    return (
        <div
            className={`space-y-3 p-2 rounded-lg transition-colors border-2 border-dashed ${isDragOver ? 'border-white/60 bg-white/10' : 'border-transparent'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="flex justify-between items-center mb-2">
                <h4 className="text-[10px] text-white/40 uppercase tracking-widest">Statuses & Tags ({tags.length})</h4>
            </div>

            {tags.length === 0 ? (
                <div className="py-8 text-center text-white/30 text-xs italic bg-[#151620]/60 rounded-lg border border-black/20 border-dashed pointer-events-none">
                    Drop statuses or tags here to apply them.
                </div>
            ) : (
                <div className="flex flex-wrap gap-2 pointer-events-auto">
                    {tags.map(tag => (
                        <div
                            key={tag.id}
                            className="bg-white/10 px-2 py-1 rounded border border-white/20 flex items-center gap-2 group cursor-pointer hover:border-white/60 transition-colors"
                        >
                            <span className="text-xs font-medium text-white/60">{tag.name}</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag.id); }}
                                className="opacity-0 group-hover:opacity-100 text-white/60 hover:text-red-400 transition-opacity"
                                title="Remove Status"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
