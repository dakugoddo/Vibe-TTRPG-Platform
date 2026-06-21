import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Entity } from '../../../types';
import { yjsStore } from '../../../store/yjsStore';
import { getEntitiesSnapshot } from '../../../hooks/useEntities';
import { rollEngine } from '../../../services/rollEngine';
import { getAbilityCostBase, getAbilityFormula, setAbilityCostBase } from '../../../utils/abilityModel';
import { glass } from '../../../utils/theme';
import { createEntityRollVariableResolver } from '../../../utils/rollVariables';
import { MarkdownRenderer } from '../../ui/MarkdownRenderer';
import { SheetTabs, type SheetTab } from '../../ui/SheetTabs';
import { WikiLinkTextarea } from '../../ui/WikiLinkTextarea';
import { Box, Check, Dices, Edit2, FileText, SlidersHorizontal } from 'lucide-react';
import clsx from 'clsx';
import { EntityCanvasTokenSettings } from './EntityCanvasTokenSettings';

interface AbilitySheetProps {
    entity: Entity;
}

type AbilityTab = 'params' | 'description' | 'canvas';

function getEntityOwnerId(entity: Entity): string | undefined {
    const owner = entity.properties?._playerOwner;
    return typeof owner === 'string' ? owner : undefined;
}

function canEditEntity(entity: Entity): boolean {
    return yjsStore.canModify(entity.database, getEntityOwnerId(entity));
}

function stringifyProperty(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
}

function updateAbilityProperty(ability: Entity, key: string, value: unknown) {
    if (!canEditEntity(ability)) return;
    yjsStore.updateEntity(ability.id, {
        properties: {
            ...ability.properties,
            [key]: value,
        },
    });
}

function sendAbilityRollToChat(
    ability: Entity,
    t: (key: string, options?: Record<string, unknown>) => string
) {
    const formula = getAbilityFormula(ability);
    if (!formula) return;

    const entities = getEntitiesSnapshot();
    const parentEntity = ability.parentId ? entities[ability.parentId] : undefined;
    const result = rollEngine.rollExpression(formula, {
        resolveVariable: createEntityRollVariableResolver(ability, parentEntity ? [parentEntity] : []),
    });
    if (result.error) {
        yjsStore.sendMessage(t('abilitySheet.rollError', { name: ability.name, error: result.error }), t('chat.systemSender'), true);
        return;
    }

    yjsStore.sendMessage(rollEngine.formatRollMessage(`${ability.name}: ${formula}`, result), t('chat.systemSender'), true);
}

export function AbilitySheet({ entity }: AbilitySheetProps) {
    const { t } = useTranslation();
    const canEditAbility = canEditEntity(entity);
    const formula = getAbilityFormula(entity);
    const costBase = getAbilityCostBase(entity);
    const canRoll = formula.length > 0;
    const [activeTab, setActiveTab] = useState<AbilityTab>('params');
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const tabs: SheetTab<AbilityTab>[] = [
        { id: 'params', label: t('abilitySheet.tabs.params'), icon: SlidersHorizontal },
        { id: 'description', label: t('abilitySheet.tabs.description'), icon: FileText },
        { id: 'canvas', label: t('abilitySheet.tabs.canvas'), icon: Box },
    ];

    return (
        <div className="space-y-4 animate-in fade-in duration-200 mt-4">
            <SheetTabs
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
                endSlot={activeTab === 'description' && canEditAbility ? (
                    <button
                        onClick={() => setIsEditingDescription(!isEditingDescription)}
                        className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${isEditingDescription ? 'bg-white/20 text-white shadow-sm' : 'text-white/45 hover:bg-white/10 hover:text-white'}`}
                        title={isEditingDescription ? t('abilitySheet.finishEditing') : t('abilitySheet.editDescription')}
                    >
                        {isEditingDescription ? <Check size={14} /> : <Edit2 size={14} />}
                    </button>
                ) : null}
            />

            {activeTab === 'params' && (
            <div className={`${glass.blockBg} border-cyan-500/20 shadow-[inset_0_0_20px_rgba(34,211,238,0.05)]`}>
                <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className={glass.blockHeader + ' text-cyan-300 border-cyan-500/20 mb-0'}>
                        {t('abilitySheet.paramsTitle')}
                    </h3>
                    <button
                        onClick={() => sendAbilityRollToChat(entity, t)}
                        disabled={!canRoll}
                        title={canRoll ? t('abilitiesBlock.rollTitle', { formula }) : t('abilitiesBlock.rollFormulaMissing')}
                        className={clsx(
                            'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition-all border',
                            canRoll
                                ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/30 hover:bg-cyan-500/35 hover:border-cyan-400/50'
                                : 'bg-white/5 text-white/20 border-transparent cursor-not-allowed'
                        )}
                    >
                        <Dices size={14} /> {t('abilitySheet.roll')}
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <label className="min-w-0">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-white/30 block mb-1">{t('abilitiesBlock.cost')}</span>
                        <input
                            type="number"
                            value={costBase}
                            min={0}
                            readOnly={!canEditAbility}
                            onChange={(e) => updateAbilityProperty(entity, 'cost', setAbilityCostBase(entity, Number(e.target.value) || 0))}
                            className="w-full bg-black/25 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 outline-none focus:border-cyan-400/50 read-only:text-white/40 read-only:cursor-default"
                        />
                    </label>
                    <label className="min-w-0">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-white/30 block mb-1">{t('abilitiesBlock.formula')}</span>
                        <input
                            type="text"
                            value={formula}
                            readOnly={!canEditAbility}
                            onChange={(e) => updateAbilityProperty(entity, 'diceFormula', e.target.value)}
                            placeholder="2d6+1"
                            className="w-full bg-black/25 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 outline-none focus:border-cyan-400/50 read-only:text-white/40 read-only:cursor-default"
                        />
                    </label>
                    <label className="min-w-0">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-white/30 block mb-1">{t('abilitiesBlock.range')}</span>
                        <input
                            type="text"
                            value={stringifyProperty(entity.properties?.range)}
                            readOnly={!canEditAbility}
                            onChange={(e) => updateAbilityProperty(entity, 'range', e.target.value)}
                            placeholder={t('abilitiesBlock.rangePlaceholder')}
                            className="w-full bg-black/25 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 outline-none focus:border-cyan-400/50 read-only:text-white/40 read-only:cursor-default"
                        />
                    </label>
                    <label className="min-w-0">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-white/30 block mb-1">{t('abilitiesBlock.area')}</span>
                        <input
                            type="text"
                            value={stringifyProperty(entity.properties?.area)}
                            readOnly={!canEditAbility}
                            onChange={(e) => updateAbilityProperty(entity, 'area', e.target.value)}
                            placeholder={t('abilitiesBlock.areaPlaceholder')}
                            className="w-full bg-black/25 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 outline-none focus:border-cyan-400/50 read-only:text-white/40 read-only:cursor-default"
                        />
                    </label>
                </div>
            </div>
            )}

            {activeTab === 'description' && (
                <div className={`${glass.blockBg} min-h-[220px]`}>
                    <h3 className={glass.blockHeader}>{t('abilitySheet.descriptionTitle')}</h3>
                    {isEditingDescription && canEditAbility ? (
                        <WikiLinkTextarea
                            value={entity.description || ''}
                            onValueChange={(value) => yjsStore.updateEntity(entity.id, { description: value })}
                            excludeEntityId={entity.id}
                            className={`${glass.input} w-full min-h-[180px] resize-y custom-scrollbar text-sm font-sans`}
                            placeholder={t('abilitySheet.descriptionPlaceholder')}
                            autoFocus
                        />
                    ) : (
                        <div className="min-h-[180px] text-sm leading-relaxed text-white/80" onDoubleClick={() => { if (canEditAbility) setIsEditingDescription(true); }}>
                            {entity.description
                                ? <MarkdownRenderer content={entity.description} entityId={entity.id} />
                                : <span className="text-white/30 italic cursor-pointer">{canEditAbility ? t('abilitySheet.emptyDescriptionEditable') : t('abilitySheet.emptyDescription')}</span>}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'canvas' && (
                <EntityCanvasTokenSettings entity={entity} canEdit={canEditAbility} />
            )}
        </div>
    );
}
