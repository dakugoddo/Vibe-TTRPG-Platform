import { useState } from 'react';

import { useEntity, useEntitiesByParent } from '../../hooks/useEntities';
import type { Entity } from '../../types';
import { yjsStore } from '../../store/yjsStore';
import { AttributeBlock } from './blocks/AttributeBlock';
import { InventoryBlock } from './blocks/InventoryBlock';
import { SkillsBlock } from './blocks/SkillsBlock';
import { CompetenciesBlock } from './blocks/CompetenciesBlock';
import { AbilitiesBlock } from './blocks/AbilitiesBlock';
import { ResourcesBlock } from './blocks/ResourcesBlock';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';
import { Edit2, Check } from 'lucide-react';

interface CharacterSheetProps {
    entityId: string;
    isFullMode: boolean;
}

function getEntityOwnerId(entity: Entity): string | undefined {
    const owner = entity.properties?._playerOwner;
    return typeof owner === 'string' ? owner : undefined;
}

export function CharacterSheet({ entityId, isFullMode }: CharacterSheetProps) {

    const entity = useEntity(entityId);
    const children = useEntitiesByParent(entityId);
    const [activeTab, setActiveTab] = useState<'stats' | 'skills' | 'competencies' | 'abilities' | 'resources' | 'inventory' | 'notes'>('stats');
    const [isEditingNotes, setIsEditingNotes] = useState(false);

    if (!entity) return null;
    const canEditCharacter = yjsStore.canModify(entity.database, getEntityOwnerId(entity));

    const handleUpdateDescription = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (!canEditCharacter) return;
        yjsStore.updateEntity(entity.id, { description: e.target.value });
    };

    const inventoryCount = children.filter(e => e.type === 'object').length;
    const competenciesCount = children.filter(e => e.type === 'competency').length;
    const abilitiesCount = children.filter(e => e.type === 'ability').length;
    const resourcesCount = entity.properties?.resources && typeof entity.properties.resources === 'object'
        ? Object.keys(entity.properties.resources).length
        : 0;

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            {/* Tabs */}
            <div className="flex border-b border-white/10 mb-4 select-none overflow-x-auto no-scrollbar pt-2 pl-2">
                <button
                    onClick={() => setActiveTab('stats')}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'stats' ? 'text-white border-white bg-white/10' : 'text-white/40 border-transparent hover:text-white/80 hover:bg-white/5'}`}
                >
                    Stats
                </button>
                <button
                    onClick={() => setActiveTab('skills')}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'skills' ? 'text-white border-white bg-white/10' : 'text-white/40 border-transparent hover:text-white/80 hover:bg-white/5'}`}
                >
                    Навыки
                </button>
                <button
                    onClick={() => setActiveTab('competencies')}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'competencies' ? 'text-white border-white bg-white/10' : 'text-white/40 border-transparent hover:text-white/80 hover:bg-white/5'}`}
                >
                    Компетенции ({competenciesCount})
                </button>
                <button
                    onClick={() => setActiveTab('abilities')}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'abilities' ? 'text-white border-white bg-white/10' : 'text-white/40 border-transparent hover:text-white/80 hover:bg-white/5'}`}
                >
                    Способности ({abilitiesCount})
                </button>
                <button
                    onClick={() => setActiveTab('resources')}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'resources' ? 'text-white border-white bg-white/10' : 'text-white/40 border-transparent hover:text-white/80 hover:bg-white/5'}`}
                >
                    Ресурсы ({resourcesCount})
                </button>
                <button
                    onClick={() => setActiveTab('inventory')}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'inventory' ? 'text-white border-white bg-white/10' : 'text-white/40 border-transparent hover:text-white/80 hover:bg-white/5'}`}
                >
                    Inventory ({inventoryCount})
                </button>
                <button
                    onClick={() => setActiveTab('notes')}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'notes' ? 'text-white border-white bg-white/10' : 'text-white/40 border-transparent hover:text-white/80 hover:bg-white/5'}`}
                >
                    Notes
                    {activeTab === 'notes' && canEditCharacter && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsEditingNotes(!isEditingNotes); }}
                            className={`p-1 rounded transition-colors ${isEditingNotes ? 'bg-white/60 text-white' : 'text-white/40 hover:text-white hover:bg-white/10'}`}
                        >
                            {isEditingNotes ? <Check size={12} /> : <Edit2 size={12} />}
                        </button>
                    )}
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {activeTab === 'stats' && (
                    <AttributeBlock entity={entity} />
                )}

                {activeTab === 'skills' && (
                    <SkillsBlock entity={entity} />
                )}

                {activeTab === 'competencies' && (
                    <CompetenciesBlock entity={entity} />
                )}

                {activeTab === 'abilities' && (
                    <AbilitiesBlock entity={entity} />
                )}

                {activeTab === 'resources' && (
                    <ResourcesBlock entity={entity} />
                )}

                {activeTab === 'inventory' && (
                    <InventoryBlock entity={entity} />
                )}

                {activeTab === 'notes' && (
                    <div className="h-full flex flex-col min-h-[150px]">
                        {isEditingNotes && canEditCharacter ? (
                            <textarea
                                value={entity.description || ''}
                                onChange={handleUpdateDescription}
                                placeholder="Character backstory and notes..."
                                className="flex-1 w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white/90 resize-none outline-none focus:ring-1 focus:ring-white/60 custom-scrollbar font-sans backdrop-blur-md"
                                autoFocus
                            />
                        ) : (
                            <div className="flex-1 bg-black/20 rounded-lg border border-transparent p-3 backdrop-blur-md text-white/80" onDoubleClick={() => { if (canEditCharacter) setIsEditingNotes(true); }}>
                                {entity.description
                                    ? <MarkdownRenderer content={entity.description} entityId={entity.id} />
                                    : <span className="text-white/30 italic cursor-pointer">{canEditCharacter ? 'No notes provided. Double click to text.' : 'No notes provided.'}</span>}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {
                !isFullMode && activeTab !== 'notes' && activeTab !== 'skills' && activeTab !== 'competencies' && activeTab !== 'abilities' && activeTab !== 'resources' && (
                    <div className="mt-4 pt-3 border-t border-white/10 text-[10px] text-white/40 text-center italic">
                        Expand window to see more details.
                    </div>
                )
            }
        </div >
    );
}
