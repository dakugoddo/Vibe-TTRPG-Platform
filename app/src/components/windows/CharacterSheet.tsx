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
import { EntityCanvasTokenSettings } from './blocks/EntityCanvasTokenSettings';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';
import { SheetTabs, type SheetTab } from '../ui/SheetTabs';
import { WikiLinkTextarea } from '../ui/WikiLinkTextarea';
import { Activity, Backpack, BookOpen, Box, Brain, Check, Dices, Edit2, Gauge, Sparkles } from 'lucide-react';
import { glass } from '../../utils/theme';

interface CharacterSheetProps {
    entityId: string;
    isFullMode: boolean;
}

type CharacterTab = 'stats' | 'skills' | 'competencies' | 'abilities' | 'resources' | 'inventory' | 'notes' | 'canvas';

function getEntityOwnerId(entity: Entity): string | undefined {
    const owner = entity.properties?._playerOwner;
    return typeof owner === 'string' ? owner : undefined;
}

export function CharacterSheet({ entityId, isFullMode }: CharacterSheetProps) {

    const entity = useEntity(entityId);
    const children = useEntitiesByParent(entityId);
    const [activeTab, setActiveTab] = useState<CharacterTab>('stats');
    const [isEditingNotes, setIsEditingNotes] = useState(false);

    if (!entity) return null;
    const canEditCharacter = yjsStore.canModify(entity.database, getEntityOwnerId(entity));

    const handleUpdateDescription = (value: string) => {
        if (!canEditCharacter) return;
        yjsStore.updateEntity(entity.id, { description: value });
    };

    const inventoryCount = children.filter(e => e.type === 'object').length;
    const competenciesCount = children.filter(e => e.type === 'competency').length;
    const abilitiesCount = children.filter(e => e.type === 'ability').length;
    const resourcesCount = entity.properties?.resources && typeof entity.properties.resources === 'object'
        ? Object.keys(entity.properties.resources).length
        : 0;
    const tabs: SheetTab<CharacterTab>[] = [
        { id: 'stats', label: 'Статы', icon: Activity },
        { id: 'skills', label: 'Навыки', icon: Dices },
        { id: 'competencies', label: 'Компетенции', badge: competenciesCount, icon: Brain },
        { id: 'abilities', label: 'Способности', badge: abilitiesCount, icon: Sparkles },
        { id: 'resources', label: 'Ресурсы', badge: resourcesCount, icon: Gauge },
        { id: 'inventory', label: 'Инвентарь', badge: inventoryCount, icon: Backpack },
        { id: 'notes', label: 'Заметки', icon: BookOpen },
        { id: 'canvas', label: 'Настройки', icon: Box },
    ];

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            <SheetTabs
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
                endSlot={activeTab === 'notes' && canEditCharacter ? (
                    <button
                        onClick={() => setIsEditingNotes(!isEditingNotes)}
                        className={`grid h-8 w-8 place-items-center rounded-[var(--vibe-radius-sm)] border transition-colors ${isEditingNotes ? glass.tabActive : glass.tabIdle}`}
                        title={isEditingNotes ? 'Завершить редактирование' : 'Редактировать заметки'}
                    >
                        {isEditingNotes ? <Check size={14} /> : <Edit2 size={14} />}
                    </button>
                ) : null}
            />

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
                            <WikiLinkTextarea
                                value={entity.description || ''}
                                onValueChange={handleUpdateDescription}
                                excludeEntityId={entity.id}
                                placeholder="Character backstory and notes..."
                                className={`${glass.input} flex-1 w-full resize-none p-3 text-sm custom-scrollbar font-sans`}
                                autoFocus
                            />
                        ) : (
                            <div className={`${glass.blockBg} flex-1 text-[var(--vibe-text-muted)]`} onDoubleClick={() => { if (canEditCharacter) setIsEditingNotes(true); }}>
                                {entity.description
                                    ? <MarkdownRenderer content={entity.description} entityId={entity.id} />
                                    : <span className="cursor-pointer italic text-[var(--vibe-text-faint)]">{canEditCharacter ? 'No notes provided. Double click to text.' : 'No notes provided.'}</span>}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'canvas' && (
                    <EntityCanvasTokenSettings entity={entity} canEdit={canEditCharacter} />
                )}
            </div>

            {
                !isFullMode && activeTab !== 'notes' && activeTab !== 'skills' && activeTab !== 'competencies' && activeTab !== 'abilities' && activeTab !== 'resources' && activeTab !== 'canvas' && (
                    <div className="mt-4 border-t border-[var(--vibe-border-subtle)] pt-3 text-center text-[10px] italic text-[var(--vibe-text-faint)]">
                        Expand window to see more details.
                    </div>
                )
            }
        </div >
    );
}
