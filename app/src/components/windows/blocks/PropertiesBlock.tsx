import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, Plus, Trash2 } from 'lucide-react';
import type { Entity } from '../../../types';
import { yjsStore } from '../../../store/yjsStore';
import { getEntitySnapshot } from '../../../hooks/useEntities';
import { TagPickerPopup } from './TagPickerPopup';
import { EntityLink } from '../../ui/EntityLink';

interface PropertiesBlockProps {
    entity: Entity;
}

function getEntityOwnerId(entity: Entity): string | undefined {
    const owner = entity.properties?._playerOwner;
    return typeof owner === 'string' ? owner : undefined;
}

export function PropertiesBlock({ entity }: PropertiesBlockProps) {
    const { t } = useTranslation();
    const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
    const canEditProperties = yjsStore.canModify(entity.database, getEntityOwnerId(entity));

    return (
        <div className="mt-4 bg-[#151620]/60 p-4 rounded-xl border border-black/20 shadow-inner flex-1 border-t-2 border-t-white/10">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-[11px] text-white/50 font-bold uppercase tracking-widest flex items-center gap-2">
                    <Tag size={14} className="text-emerald-400" />
                    {t('propertiesBlock.title')}
                </h4>

                {canEditProperties && (
                    <button
                        className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 border-dashed rounded-md text-white/50 hover:text-white hover:border-white/30 hover:bg-white/10 transition-all text-[10px] font-bold uppercase tracking-wider"
                        onClick={() => setIsTagPickerOpen(true)}
                    >
                        <Plus size={12} /> {t('entityWindow.add')}
                    </button>
                )}

                {canEditProperties && (
                    <TagPickerPopup
                        isOpen={isTagPickerOpen}
                        onClose={() => setIsTagPickerOpen(false)}
                        onSelect={(tagId) => {
                            if (!canEditProperties) return;
                            const newTags = [...(entity.tags || []), tagId];
                            yjsStore.updateEntity(entity.id, { tags: newTags });
                        }}
                        excludeTags={entity.tags || []}
                        allowedFolders={['folder_tags_properties']}
                        title={t('propertiesBlock.addProperty')}
                    />
                )}
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
                {entity.tags && entity.tags.length > 0 ? entity.tags.map(tagId => {
                    const tagEntity = getEntitySnapshot(tagId);

                    // Filter to only show properties folder items here
                    if (tagEntity && tagEntity.parentId !== 'folder_tags_properties') return null;

                    return (
                        <div key={tagId} className="group/tag flex items-center bg-[#2e3145] border border-white/5 rounded-md overflow-hidden transition-all hover:bg-[#383c54] hover:border-emerald-500/50 shadow-sm">
                            <EntityLink entityId={tagId} underline={false} className="px-2 py-1 text-emerald-200/70 font-medium whitespace-nowrap hover:text-emerald-200" />
                            {canEditProperties && (
                                <button
                                    onClick={() => {
                                        if (!canEditProperties) return;
                                        const newTags = entity.tags.filter(id => id !== tagId);
                                        yjsStore.updateEntity(entity.id, { tags: newTags });
                                    }}
                                    className="px-2 py-1 text-white/30 hover:bg-red-500/20 hover:text-red-400 transition-colors border-l border-white/5 group-hover/tag:border-white/10"
                                    title={t('propertiesBlock.remove')}
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    )
                }) : <span className="text-white/30 text-xs italic">{t('propertiesBlock.empty')}</span>}
            </div>
        </div>
    );
}
