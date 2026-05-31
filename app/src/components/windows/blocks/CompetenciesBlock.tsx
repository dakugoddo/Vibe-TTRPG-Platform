import { useCallback, useState } from 'react';
import type { Entity } from '../../../types';
import { yjsStore } from '../../../store/yjsStore';
import { useEntitiesByParent, getEntitiesSnapshot } from '../../../hooks/useEntities';
import { useWindowStore } from '../../../store/windowStore';
import { useUIStore } from '../../../store/uiStore';
import { rollEngine } from '../../../services/rollEngine';
import { Dices, Plus, Minus, Trash2, ExternalLink } from 'lucide-react';
import { glass } from '../../../utils/theme';
import { generateEntityId } from '../../../utils/entityId';
import { getEntityDropActions } from '../../../utils/entityDropRouter';
import { readEntityDragIds } from '../../../utils/entityDragPayload';
import { applyOwnerToEntityTree, getEntityOwnerId, moveEntityTreeToParent } from '../../../utils/entityTreeMutations';
import { getTopLevelEntityIds } from '../../../utils/entityTreeSelection';
import { DragDropPopover, type DragDropPromptData } from '../../ui/DragDropPopover';
import clsx from 'clsx';

const RANK_MIN = 0;
const RANK_MAX = 5;

interface CompetenciesBlockProps {
    entity: Entity;
}

function canEditEntity(entity: Entity): boolean {
    return yjsStore.canModify(entity.database, getEntityOwnerId(entity));
}

function sendRollToChat(compName: string, rank: number, diceCount: number) {
    const expression = `${compName}(${rank})`;
    const result = rollEngine.rollD6Pool(diceCount, expression);

    if (result.error) {
        yjsStore.sendMessage(`Ошибка броска: ${result.error}`, 'Система', true);
        return;
    }

    yjsStore.sendMessage(rollEngine.formatRollMessage(expression, result), 'Система', true);
}

export function CompetenciesBlock({ entity }: CompetenciesBlockProps) {
    const competencies = useEntitiesByParent(entity.id).filter(e => e.type === 'competency');
    const { openWindow } = useWindowStore();
    const { openConfirm } = useUIStore();
    const canEditParent = canEditEntity(entity);
    const [dragDropPrompt, setDragDropPrompt] = useState<DragDropPromptData | null>(null);

    const handleAddCompetency = useCallback(() => {
        if (!canEditParent) return;
        const id = generateEntityId(Object.keys(getEntitiesSnapshot()));
        const ownerId = getEntityOwnerId(entity);
        const newComp: Entity = {
            id,
            parentId: entity.id,
            type: 'competency',
            name: 'Новая компетенция',
            description: '',
            properties: ownerId ? { rank: 0, _playerOwner: ownerId } : { rank: 0 },
            tags: [],
            database: entity.database,
        };
        yjsStore.addEntity(newComp);
    }, [canEditParent, entity]);

    const handleUpdateRank = useCallback((compId: string, newRank: number) => {
        const comp = getEntitiesSnapshot()[compId];
        if (!comp || !canEditEntity(comp)) return;
        const clamped = Math.max(RANK_MIN, Math.min(RANK_MAX, newRank));
        yjsStore.updateEntity(compId, {
            properties: { ...comp.properties, rank: clamped }
        });
    }, []);

    const handleDelete = useCallback((compId: string, compName: string) => {
        const comp = getEntitiesSnapshot()[compId];
        if (!comp || !canEditEntity(comp)) return;

        openConfirm({
            title: 'Удаление компетенции',
            description: `Вы уверены, что хотите удалить компетенцию «${compName}»?`,
            confirmText: 'Удалить',
            isDestructive: true,
            onConfirm: () => {
                yjsStore.deleteEntity(compId);
            }
        });
    }, [openConfirm]);

    const handleRollComp = useCallback((compName: string, rank: number) => {
        if (rank <= 0) return;
        sendRollToChat(compName, rank, rank);
    }, []);

    const getCompetencyDropActions = useCallback((competency: Entity) => {
        if (competency.type !== 'competency' || competency.parentId === entity.id) return [];
        return getEntityDropActions(
            { id: competency.id, type: competency.type, database: competency.database, parentId: competency.parentId },
            { kind: 'entity', entityId: entity.id, entityType: entity.type, slot: 'competencies' },
            {
                role: yjsStore.localRole,
                canModifySource: canEditEntity(competency),
                canModifyTarget: canEditParent,
            }
        );
    }, [canEditParent, entity.id, entity.type]);

    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        if (!canEditParent) return;
        const snapshot = getEntitiesSnapshot();
        const allEntities = Object.values(snapshot);
        const competencyIds = getTopLevelEntityIds(readEntityDragIds(event.dataTransfer), allEntities);
        const droppedCompetencies = competencyIds
            .map(id => snapshot[id])
            .filter((candidate): candidate is Entity => Boolean(candidate));
        if (droppedCompetencies.length === 0 || droppedCompetencies.length !== competencyIds.length || droppedCompetencies.some(competency => competency.type !== 'competency')) return;

        const actionsByCompetency = droppedCompetencies.map(competency => getCompetencyDropActions(competency));
        if (actionsByCompetency.some(actions => actions.length === 0)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = actionsByCompetency.every(actions => actions.some((action) => action.id === 'move-entity')) ? 'move' : 'copy';
    }, [canEditParent, getCompetencyDropActions]);

    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        if (!canEditParent) return;
        const snapshot = getEntitiesSnapshot();
        const allEntities = Object.values(snapshot);
        const competencyIds = getTopLevelEntityIds(readEntityDragIds(event.dataTransfer), allEntities);
        const droppedCompetencies = competencyIds
            .map(id => snapshot[id])
            .filter((candidate): candidate is Entity => Boolean(candidate));
        if (droppedCompetencies.length === 0 || droppedCompetencies.length !== competencyIds.length || droppedCompetencies.some(competency => competency.type !== 'competency')) return;

        const actionsByCompetency = droppedCompetencies.map(competency => getCompetencyDropActions(competency));
        const copyAction = actionsByCompetency[0]?.find((action) => action.id === 'copy-entity');
        const moveAction = actionsByCompetency[0]?.find((action) => action.id === 'move-entity');
        const canCopyAll = Boolean(copyAction) && actionsByCompetency.every(actions => actions.some((action) => action.id === 'copy-entity'));
        const canMoveAll = Boolean(moveAction) && actionsByCompetency.every(actions => actions.some((action) => action.id === 'move-entity'));
        if (!canCopyAll && !canMoveAll) return;

        event.preventDefault();
        event.stopPropagation();
        const ownerId = getEntityOwnerId(entity);

        setDragDropPrompt({
            x: event.clientX,
            y: event.clientY,
            entityName: droppedCompetencies.length === 1 ? droppedCompetencies[0].name : `${droppedCompetencies.length} сущностей`,
            canCopy: canCopyAll,
            canMove: canMoveAll,
            copyLabel: copyAction?.label,
            moveLabel: moveAction?.label,
            onMove: () => {
                if (canMoveAll) {
                    droppedCompetencies.forEach((competency) => {
                    moveEntityTreeToParent(competency.id, entity.id, entity.database, { ownerId });
                    });
                }
                setDragDropPrompt(null);
            },
            onCopy: () => {
                if (canCopyAll) {
                    droppedCompetencies.forEach((competency) => {
                    const newId = yjsStore.cloneEntity(competency.id, entity.id, entity.database);
                    if (newId) applyOwnerToEntityTree(newId, ownerId);
                    });
                }
                setDragDropPrompt(null);
            },
            onCancel: () => setDragDropPrompt(null),
        });
    }, [canEditParent, entity, getCompetencyDropActions]);

    return (
        <div className="space-y-4">
            {/* COMPETENCIES BLOCK */}
            <div
                data-entity-drop-target="true"
                data-entity-id={entity.id}
                data-entity-slot="competencies"
                data-entity-accepts="competency"
                className={glass.blockBg}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <div className="flex items-center justify-between mb-4">
                    <h4 className={glass.blockHeader + " mb-0"}>
                        Компетенции ({competencies.length})
                    </h4>
                    {canEditParent && (
                        <button
                            onClick={handleAddCompetency}
                            className="flex items-center gap-1 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-accent)] transition-all hover:bg-[var(--vibe-surface-hover)]"
                        >
                            <Plus size={12} /> Добавить
                        </button>
                    )}
                </div>

                {competencies.length === 0 ? (
                    <div className="rounded-[var(--vibe-radius-md)] border border-dashed border-[var(--vibe-border-subtle)] py-8 text-center text-xs italic text-[var(--vibe-text-faint)]">
                        {canEditParent ? 'Нет компетенций. Нажмите «Добавить» чтобы создать первую.' : 'Компетенции пока не добавлены.'}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2">
                        {competencies.map(comp => {
                            const rank: number = comp.properties?.rank || 0;
                            const canRoll = rank > 0;
                            const canEditComp = canEditEntity(comp);

                            return (
                                <div
                                    key={comp.id}
                                    className="group flex items-center gap-3 rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3 transition-all hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]"
                                >
                                    {/* Rank badge */}
                                    <div className={clsx(
                                        "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--vibe-radius-md)] border font-mono text-sm font-bold",
                                        rank > 0
                                            ? "border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)]"
                                            : "border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] text-[var(--vibe-text-faint)]"
                                    )}>
                                        +{rank}
                                    </div>

                                    {/* Name + description */}
                                    <div className="flex-1 min-w-0">
                                        <div
                                            className="truncate text-sm font-medium text-[var(--vibe-text-muted)] transition-colors hover:text-[var(--vibe-accent)] cursor-pointer"
                                            onClick={() => openWindow(comp.id, Math.random() * 200 + 100, Math.random() * 200 + 100)}
                                        >
                                            {comp.name}
                                        </div>
                                        {comp.description && (
                                            <div className="mt-0.5 truncate text-[10px] text-[var(--vibe-text-faint)]">
                                                {comp.description.substring(0, 60)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Rank controls */}
                                    {canEditComp && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleUpdateRank(comp.id, rank - 1);
                                                }}
                                                disabled={rank <= RANK_MIN}
                                                className="rounded p-0.5 text-[var(--vibe-text-faint)] transition-all hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)] disabled:cursor-not-allowed disabled:opacity-20"
                                            >
                                                <Minus size={12} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleUpdateRank(comp.id, rank + 1);
                                                }}
                                                disabled={rank >= RANK_MAX}
                                                className="rounded p-0.5 text-[var(--vibe-text-faint)] transition-all hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)] disabled:cursor-not-allowed disabled:opacity-20"
                                            >
                                                <Plus size={12} />
                                            </button>
                                        </div>
                                    )}

                                    {/* Roll button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRollComp(comp.name, rank);
                                        }}
                                        disabled={!canRoll}
                                        title={canRoll ? `Бросить ${rank}d6` : 'Ранг должен быть > 0'}
                                        className={clsx(
                                            'flex-shrink-0 rounded-[var(--vibe-radius-sm)] border p-1.5 transition-all',
                                            canRoll
                                                ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)] hover:bg-[var(--vibe-surface-hover)]'
                                                : 'cursor-not-allowed border-transparent bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)]'
                                        )}
                                    >
                                        <Dices size={14} />
                                    </button>

                                    {/* Open window */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openWindow(comp.id, Math.random() * 200 + 100, Math.random() * 200 + 100);
                                        }}
                                        className="flex-shrink-0 rounded-[var(--vibe-radius-sm)] p-1.5 text-[var(--vibe-text-faint)] transition-all hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                                        title="Открыть окно"
                                    >
                                        <ExternalLink size={14} />
                                    </button>

                                    {/* Delete */}
                                    {canEditComp && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(comp.id, comp.name);
                                            }}
                                            className="flex-shrink-0 rounded-[var(--vibe-radius-sm)] p-1.5 text-[var(--vibe-text-faint)] transition-all hover:bg-[color-mix(in_srgb,var(--vibe-danger)_18%,transparent)] hover:text-[var(--vibe-danger)]"
                                            title="Удалить"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
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
