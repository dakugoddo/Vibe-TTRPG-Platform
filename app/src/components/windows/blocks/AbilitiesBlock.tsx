import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Entity } from '../../../types';
import { yjsStore } from '../../../store/yjsStore';
import { useEntitiesByParent, getEntitiesSnapshot } from '../../../hooks/useEntities';
import { useWindowStore } from '../../../store/windowStore';
import { useUIStore } from '../../../store/uiStore';
import { rollEntityActionToChat } from '../../../services/entityActionRoll';
import { Dices, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { glass } from '../../../utils/theme';
import { getAbilityCostBase, getAbilityFormula, setAbilityCostBase } from '../../../utils/abilityModel';
import { generateEntityId } from '../../../utils/entityId';
import { getEntityDropActions } from '../../../utils/entityDropRouter';
import { readEntityDragIds } from '../../../utils/entityDragPayload';
import { applyOwnerToEntityTree, getEntityOwnerId, moveEntityTreeToParent } from '../../../utils/entityTreeMutations';
import { getTopLevelEntityIds } from '../../../utils/entityTreeSelection';
import { DragDropPopover, type DragDropPromptData } from '../../ui/DragDropPopover';
import clsx from 'clsx';

interface AbilitiesBlockProps {
    entity: Entity;
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

export function AbilitiesBlock({ entity }: AbilitiesBlockProps) {
    const { t } = useTranslation();
    const abilities = useEntitiesByParent(entity.id).filter(e => e.type === 'ability');
    const { openWindow } = useWindowStore();
    const { openConfirm } = useUIStore();
    const canEditParent = canEditEntity(entity);
    const [dragDropPrompt, setDragDropPrompt] = useState<DragDropPromptData | null>(null);

    const handleAddAbility = useCallback(() => {
        if (!canEditParent) return;
        const ownerId = getEntityOwnerId(entity);
        const newAbility: Entity = {
            id: generateEntityId(Object.keys(getEntitiesSnapshot())),
            parentId: entity.id,
            type: 'ability',
            name: 'Новая способность',
            description: '',
            properties: {
                cost: { base: 0 },
                range: '',
                area: '',
                diceFormula: '',
                ...(ownerId ? { _playerOwner: ownerId } : {}),
            },
            tags: [],
            database: entity.database,
        };
        yjsStore.addEntity(newAbility);
        openWindow(newAbility.id, Math.random() * 200 + 100, Math.random() * 200 + 100);
    }, [canEditParent, entity, openWindow]);

    const handleDelete = useCallback((abilityId: string, abilityName: string) => {
        const ability = getEntitiesSnapshot()[abilityId];
        if (!ability || !canEditEntity(ability)) return;

        openConfirm({
            title: t('abilitiesBlock.deleteConfirm.title'),
            description: t('abilitiesBlock.deleteConfirm.description', { name: abilityName }),
            confirmText: t('common.delete'),
            isDestructive: true,
            onConfirm: () => {
                yjsStore.deleteEntity(abilityId);
            },
        });
    }, [openConfirm, t]);

    const getAbilityDropActions = useCallback((ability: Entity) => {
        if (ability.type !== 'ability' || ability.parentId === entity.id) return [];
        return getEntityDropActions(
            { id: ability.id, type: ability.type, database: ability.database, parentId: ability.parentId },
            { kind: 'entity', entityId: entity.id, entityType: entity.type, slot: 'abilities' },
            {
                role: yjsStore.localRole,
                canModifySource: canEditEntity(ability),
                canModifyTarget: canEditParent,
            }
        );
    }, [canEditParent, entity.id, entity.type]);

    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        if (!canEditParent) return;
        const snapshot = getEntitiesSnapshot();
        const allEntities = Object.values(snapshot);
        const abilityIds = getTopLevelEntityIds(readEntityDragIds(event.dataTransfer), allEntities);
        const droppedAbilities = abilityIds
            .map(id => snapshot[id])
            .filter((candidate): candidate is Entity => Boolean(candidate));
        if (droppedAbilities.length === 0 || droppedAbilities.length !== abilityIds.length || droppedAbilities.some(ability => ability.type !== 'ability')) return;

        const actionsByAbility = droppedAbilities.map(ability => getAbilityDropActions(ability));
        if (actionsByAbility.some(actions => actions.length === 0)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = actionsByAbility.every(actions => actions.some((action) => action.id === 'move-entity')) ? 'move' : 'copy';
    }, [canEditParent, getAbilityDropActions]);

    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        if (!canEditParent) return;
        const snapshot = getEntitiesSnapshot();
        const allEntities = Object.values(snapshot);
        const abilityIds = getTopLevelEntityIds(readEntityDragIds(event.dataTransfer), allEntities);
        const droppedAbilities = abilityIds
            .map(id => snapshot[id])
            .filter((candidate): candidate is Entity => Boolean(candidate));
        if (droppedAbilities.length === 0 || droppedAbilities.length !== abilityIds.length || droppedAbilities.some(ability => ability.type !== 'ability')) return;

        const actionsByAbility = droppedAbilities.map(ability => getAbilityDropActions(ability));
        const copyAction = actionsByAbility[0]?.find((action) => action.id === 'copy-entity');
        const moveAction = actionsByAbility[0]?.find((action) => action.id === 'move-entity');
        const canCopyAll = Boolean(copyAction) && actionsByAbility.every(actions => actions.some((action) => action.id === 'copy-entity'));
        const canMoveAll = Boolean(moveAction) && actionsByAbility.every(actions => actions.some((action) => action.id === 'move-entity'));
        if (!canCopyAll && !canMoveAll) return;

        event.preventDefault();
        event.stopPropagation();
        const ownerId = getEntityOwnerId(entity);

        setDragDropPrompt({
            x: event.clientX,
            y: event.clientY,
            entityName: droppedAbilities.length === 1 ? droppedAbilities[0].name : t('abilitiesBlock.entitiesCount', { count: droppedAbilities.length }),
            canCopy: canCopyAll,
            canMove: canMoveAll,
            copyLabel: copyAction?.label,
            moveLabel: moveAction?.label,
            onMove: () => {
                if (canMoveAll) {
                    droppedAbilities.forEach((ability) => {
                    moveEntityTreeToParent(ability.id, entity.id, entity.database, { ownerId });
                    });
                }
                setDragDropPrompt(null);
            },
            onCopy: () => {
                if (canCopyAll) {
                    droppedAbilities.forEach((ability) => {
                    const newId = yjsStore.cloneEntity(ability.id, entity.id, entity.database);
                    if (newId) applyOwnerToEntityTree(newId, ownerId);
                    });
                }
                setDragDropPrompt(null);
            },
            onCancel: () => setDragDropPrompt(null),
        });
    }, [canEditParent, entity, getAbilityDropActions, t]);

    return (
        <div className="space-y-4">
            <div
                data-entity-drop-target="true"
                data-entity-id={entity.id}
                data-entity-slot="abilities"
                data-entity-accepts="ability"
                className={glass.blockBg}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <div className="flex items-center justify-between gap-3 mb-4">
                    <h4 className={glass.blockHeader + ' mb-0'}>
                        {t('abilitiesBlock.title', { count: abilities.length })}
                    </h4>
                    {canEditParent && (
                        <button
                            onClick={handleAddAbility}
                            className="flex items-center gap-1 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-accent)] transition-all hover:bg-[var(--vibe-surface-hover)]"
                        >
                            <Plus size={12} /> {t('abilitiesBlock.add')}
                        </button>
                    )}
                </div>

                {abilities.length === 0 ? (
                    <div className="rounded-[var(--vibe-radius-md)] border border-dashed border-[var(--vibe-border-subtle)] py-8 text-center text-xs italic text-[var(--vibe-text-faint)]">
                        {canEditParent ? t('abilitiesBlock.emptyEditable') : t('abilitiesBlock.empty')}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2">
                        {abilities.map(ability => {
                            const canEditAbility = canEditEntity(ability);
                            const formula = getAbilityFormula(ability);
                            const canRoll = formula.length > 0;
                            const costBase = getAbilityCostBase(ability);

                            return (
                                <div
                                    key={ability.id}
                                    className="group rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3 transition-all hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] font-mono text-sm font-bold text-[var(--vibe-accent)]">
                                            {costBase}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <button
                                                onClick={() => openWindow(ability.id, Math.random() * 200 + 100, Math.random() * 200 + 100)}
                                                className="block truncate text-left text-sm font-medium text-[var(--vibe-text-primary)] transition-colors hover:text-[var(--vibe-accent)]"
                                            >
                                                {ability.name}
                                            </button>
                                            {ability.description && (
                                                <div className="mt-0.5 truncate text-[10px] text-[var(--vibe-text-faint)]">
                                                    {ability.description.substring(0, 80)}
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                rollEntityActionToChat(ability, 'ability', [entity]);
                                            }}
                                            disabled={!canRoll}
                                            title={canRoll ? t('abilitiesBlock.rollTitle', { formula }) : t('abilitiesBlock.rollFormulaMissing')}
                                            className={clsx(
                                                'flex-shrink-0 rounded-[var(--vibe-radius-sm)] border p-1.5 transition-all',
                                                canRoll
                                                    ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)] hover:bg-[var(--vibe-surface-hover)]'
                                                    : 'cursor-not-allowed border-transparent bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)]'
                                            )}
                                        >
                                            <Dices size={14} />
                                        </button>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openWindow(ability.id, Math.random() * 200 + 100, Math.random() * 200 + 100);
                                            }}
                                            className="flex-shrink-0 rounded-[var(--vibe-radius-sm)] p-1.5 text-[var(--vibe-text-faint)] transition-all hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                                            title={t('abilitiesBlock.openWindow')}
                                        >
                                            <ExternalLink size={14} />
                                        </button>

                                        {canEditAbility && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(ability.id, ability.name);
                                                }}
                                                className="flex-shrink-0 rounded-[var(--vibe-radius-sm)] p-1.5 text-[var(--vibe-text-faint)] transition-all hover:bg-[color-mix(in_srgb,var(--vibe-danger)_18%,transparent)] hover:text-[var(--vibe-danger)]"
                                                title={t('common.delete')}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mt-3">
                                        <label className="min-w-0">
                                            <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('abilitiesBlock.cost')}</span>
                                            <input
                                                type="number"
                                                value={costBase}
                                                min={0}
                                                readOnly={!canEditAbility}
                                                onChange={(e) => {
                                                    updateAbilityProperty(ability, 'cost', setAbilityCostBase(ability, Number(e.target.value) || 0));
                                                }}
                                                className={`${glass.input} w-full text-xs read-only:cursor-default read-only:text-[var(--vibe-text-faint)]`}
                                            />
                                        </label>
                                        <label className="min-w-0">
                                            <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('abilitiesBlock.formula')}</span>
                                            <input
                                                type="text"
                                                value={formula}
                                                readOnly={!canEditAbility}
                                                onChange={(e) => updateAbilityProperty(ability, 'diceFormula', e.target.value)}
                                                placeholder="2d6+1"
                                                className={`${glass.input} w-full text-xs read-only:cursor-default read-only:text-[var(--vibe-text-faint)]`}
                                            />
                                        </label>
                                        <label className="min-w-0">
                                            <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('abilitiesBlock.range')}</span>
                                            <input
                                                type="text"
                                                value={stringifyProperty(ability.properties?.range)}
                                                readOnly={!canEditAbility}
                                                onChange={(e) => updateAbilityProperty(ability, 'range', e.target.value)}
                                                placeholder={t('abilitiesBlock.rangePlaceholder')}
                                                className={`${glass.input} w-full text-xs read-only:cursor-default read-only:text-[var(--vibe-text-faint)]`}
                                            />
                                        </label>
                                        <label className="min-w-0">
                                            <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('abilitiesBlock.area')}</span>
                                            <input
                                                type="text"
                                                value={stringifyProperty(ability.properties?.area)}
                                                readOnly={!canEditAbility}
                                                onChange={(e) => updateAbilityProperty(ability, 'area', e.target.value)}
                                                placeholder={t('abilitiesBlock.areaPlaceholder')}
                                                className={`${glass.input} w-full text-xs read-only:cursor-default read-only:text-[var(--vibe-text-faint)]`}
                                            />
                                        </label>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <DragDropPopover data={dragDropPrompt} />
        </div>
    );
}
