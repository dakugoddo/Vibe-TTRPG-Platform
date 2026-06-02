import React, { useState } from 'react';
import type { Entity } from '../../../types';
import { yjsStore } from '../../../store/yjsStore';
import { useEntities } from '../../../hooks/useEntities';
import { DragDropPopover, type DragDropPromptData } from '../../ui/DragDropPopover';
import { useUIStore } from '../../../store/uiStore';
import { Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { EntityLink } from '../../ui/EntityLink';
import { glass } from '../../../utils/theme';
import { getEntityDropActions } from '../../../utils/entityDropRouter';
import { readEntityDragIds, writeEntityDragIds } from '../../../utils/entityDragPayload';
import { applyOwnerToEntityTree, getEntityOwnerId, moveEntityTreeToParent } from '../../../utils/entityTreeMutations';
import { getTopLevelEntityIds } from '../../../utils/entityTreeSelection';

interface InventoryBlockProps {
    entity: Entity;
}

const CATEGORIES = ['оружие', 'броня', 'расходуемое', 'другое'] as const;
type Category = typeof CATEGORIES[number];
const attackPanelClass = `${glass.blockBg} border-[color-mix(in_srgb,var(--vibe-danger)_28%,var(--vibe-border-subtle))] shadow-[inset_0_0_20px_color-mix(in_srgb,var(--vibe-danger)_8%,transparent)]`;
const inventoryCategoryClass = 'overflow-hidden rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] pb-2 shadow-[var(--vibe-shadow-block)]';
const tableHeadCellClass = 'px-2 py-1.5 font-normal transition-colors hover:text-[var(--vibe-text-primary)]';
const tableValueCellClass = 'px-2 py-1.5 text-center font-mono text-[10px] text-[var(--vibe-text-muted)]';

type SortConfig = {
    key: string;
    direction: 'asc' | 'desc';
} | null;

function canEditEntity(entity: Entity): boolean {
    return yjsStore.canModify(entity.database, getEntityOwnerId(entity));
}

export function InventoryBlock({ entity }: InventoryBlockProps) {
    const allEntities = useEntities();
    const children = allEntities.filter(e => e.parentId === entity.id);
    const inventory = children.filter(e => e.type === 'object');
    const canEditInventory = canEditEntity(entity);

    // Find attacks of equipped weapons
    const equippedWeapons = inventory.filter(e => e.properties.category === 'оружие' && e.properties.equipped);
    const availableAttacks = allEntities.filter(
        e => e.type === 'attack' && equippedWeapons.some(w => w.id === e.parentId)
    );

    const [dragDropPrompt, setDragDropPrompt] = useState<DragDropPromptData | null>(null);
    const [sortConfigs, setSortConfigs] = useState<Record<Category, SortConfig>>({
        'оружие': null,
        'броня': null,
        'расходуемое': null,
        'другое': null
    });

    const { openConfirm } = useUIStore();

    const handleDeleteItem = (itemId: string, itemName: string) => {
        const item = inventory.find(i => i.id === itemId);
        if (!item || !canEditInventory || !canEditEntity(item)) return;

        openConfirm({
            title: "Удаление предмета",
            description: `Вы уверены, что хотите удалить предмет "${itemName}"?`,
            confirmText: "Удалить",
            isDestructive: true,
            onConfirm: () => {
                if (!canEditInventory || !canEditEntity(item)) return;
                yjsStore.deleteEntity(itemId);
            }
        });
    };

    const updateItemProperty = (itemId: string, key: string, value: unknown) => {
        const item = inventory.find(i => i.id === itemId);
        if (item && canEditInventory && canEditEntity(item)) {
            yjsStore.updateEntity(itemId, {
                properties: { ...item.properties, [key]: value }
            });
        }
    };

    const handleDrop = (e: React.DragEvent, targetCategory: Category) => {
        if (!canEditInventory) return;

        e.preventDefault();
        e.stopPropagation();

        const droppedIds = getTopLevelEntityIds(readEntityDragIds(e.dataTransfer), allEntities);
        const droppedEntities = droppedIds
            .map(id => allEntities.find(ent => ent.id === id))
            .filter((candidate): candidate is Entity => Boolean(candidate));

        if (droppedEntities.length === 0 || droppedEntities.length !== droppedIds.length || droppedEntities.some(droppedEntity => droppedEntity.type !== 'object')) return;

        const insideInventory = droppedEntities.filter(droppedEntity => droppedEntity.parentId === entity.id);
        const incomingEntities = droppedEntities.filter(droppedEntity => droppedEntity.parentId !== entity.id);

        if (incomingEntities.length === 0) {
            insideInventory.forEach(droppedEntity => updateItemProperty(droppedEntity.id, 'category', targetCategory));
            return;
        }

        const actionsByEntity = incomingEntities.map(droppedEntity => getEntityDropActions(
            {
                id: droppedEntity.id,
                type: droppedEntity.type,
                database: droppedEntity.database,
                parentId: droppedEntity.parentId,
            },
            { kind: 'entity', entityId: entity.id, entityType: entity.type, slot: 'inventory' },
            {
                role: yjsStore.localRole,
                canModifySource: canEditEntity(droppedEntity),
                canModifyTarget: canEditInventory,
            }
        ));
        const moveAction = actionsByEntity[0]?.find(action => action.id === 'move-entity');
        const copyAction = actionsByEntity[0]?.find(action => action.id === 'copy-entity');
        const canMoveAll = Boolean(moveAction) && actionsByEntity.every(actions => actions.some(action => action.id === 'move-entity'));
        const canCopyAll = Boolean(copyAction) && actionsByEntity.every(actions => actions.some(action => action.id === 'copy-entity'));
        if (!canMoveAll && !canCopyAll) return;

        const ownerId = getEntityOwnerId(entity);
        setDragDropPrompt({
            x: e.clientX,
            y: e.clientY,
            entityName: droppedEntities.length === 1 ? droppedEntities[0].name : `${droppedEntities.length} сущностей`,
            canMove: canMoveAll,
            canCopy: canCopyAll,
            moveLabel: moveAction?.label,
            copyLabel: copyAction?.label,
            onMove: () => {
                if (!canMoveAll || !canEditInventory) {
                    setDragDropPrompt(null);
                    return;
                }
                insideInventory.forEach(droppedEntity => updateItemProperty(droppedEntity.id, 'category', targetCategory));
                incomingEntities.forEach((droppedEntity) => {
                    if (!canEditEntity(droppedEntity)) return;
                    moveEntityTreeToParent(droppedEntity.id, entity.id, entity.database, {
                        ownerId,
                        rootProperties: { category: targetCategory },
                    });
                });
                setDragDropPrompt(null);
            },
            onCopy: () => {
                if (!canCopyAll || !canEditInventory) {
                    setDragDropPrompt(null);
                    return;
                }
                incomingEntities.forEach((droppedEntity) => {
                    const newId = yjsStore.cloneEntity(droppedEntity.id, entity.id, entity.database);
                    if (newId) {
                        const newEnt = getEntitySnapshot(newId);
                        if (newEnt) {
                            yjsStore.updateEntity(newId, {
                                properties: { ...newEnt.properties, category: targetCategory, ...(ownerId ? { _playerOwner: ownerId } : {}) }
                            });
                            applyOwnerToEntityTree(newId, ownerId);
                        }
                    }
                });
                setDragDropPrompt(null);
            },
            onCancel: () => {
                setDragDropPrompt(null);
            }
        });
    };

    // Helper just to get snapshot inside callback
    const getEntitySnapshot = (id: string) => allEntities.find(e => e.id === id);

    const handleSort = (category: Category, key: string) => {
        setSortConfigs(prev => {
            const config = prev[category];
            if (config && config.key === key) {
                if (config.direction === 'asc') return { ...prev, [category]: { key, direction: 'desc' } };
                return { ...prev, [category]: null }; // Disable sort
            }
            return { ...prev, [category]: { key, direction: 'asc' } };
        });
    };

    let totalWeight = 0;

    return (
        <div className="flex flex-col gap-4">
            {/* Блок Атак */}
            <div className={attackPanelClass}>
                <h4 className={`${glass.blockHeader} border-[color-mix(in_srgb,var(--vibe-danger)_28%,transparent)] text-[var(--vibe-danger)]`}>
                    Доступные Атаки (Экипированное Оружие)
                </h4>
                {availableAttacks.length === 0 ? (
                    <div className="text-[10px] italic text-[var(--vibe-text-faint)]">Нет доступных атак. Экипируйте оружие с атаками.</div>
                ) : (
                    <div className="grid grid-cols-1 gap-2">
                        {availableAttacks.map(atk => (
                            <div key={atk.id} className="flex items-center justify-between rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-danger)_18%,var(--vibe-border-subtle))] bg-[var(--vibe-surface-input)] p-2 shadow-sm backdrop-blur-[var(--vibe-backdrop-blur)] transition-colors hover:border-[color-mix(in_srgb,var(--vibe-danger)_36%,var(--vibe-border-strong))] hover:bg-[var(--vibe-surface-hover)]">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-5 w-5 items-center justify-center rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-danger)_32%,transparent)] bg-[color-mix(in_srgb,var(--vibe-danger)_16%,transparent)] text-[10px] font-bold text-[var(--vibe-danger)]">⚔️</div>
                                    <EntityLink entityId={atk.id} className="text-sm font-bold text-[var(--vibe-text-primary)] hover:text-[var(--vibe-danger)]" />
                                    <span className="ml-2 text-[10px] text-[var(--vibe-text-faint)]">(от: {allEntities.find(e => e.id === atk.parentId)?.name})</span>
                                </div>
                                <div className="flex gap-3 font-mono text-[10px] text-[var(--vibe-text-muted)]">
                                    <span title="Урон">🗡️ <span className="font-bold text-[var(--vibe-text-primary)]">{atk.properties.урон ?? 1}</span></span>
                                    <span title="Масштаб">📏 <span className="font-bold text-[var(--vibe-text-primary)]">{atk.properties.масштаб ?? 1}</span></span>
                                    <span title="Попадание">🎯 <span className="font-bold text-[var(--vibe-text-primary)]">{atk.properties.попадание ?? 1}</span></span>
                                    <span title="Дистанция" className="uppercase text-[var(--vibe-danger)]">[{atk.properties.дистанция ?? 'ближняя'}]</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Блок Инвентаря */}
            <div className={`${glass.blockBg} flex-1`}>
                <div className="flex justify-between items-center mb-4">
                    <h4 className={glass.blockHeader + " mb-0"}>
                        Инвентарь персонажа
                    </h4>
                </div>

                <div className="space-y-4">
                    {CATEGORIES.map(category => {
                        const itemsInCategory = inventory.filter(item => (item.properties.category || 'другое') === category);

                        itemsInCategory.forEach(item => {
                            const qty = item.properties.количество ?? 1;
                            const weight = item.properties.нагрузка ?? 1.0;
                            totalWeight += (qty * weight);
                        });

                        // Sorting logic
                        const sortConfig = sortConfigs[category];
                        if (sortConfig) {
                            itemsInCategory.sort((a, b) => {
                                let aVal: string | number = '';
                                let bVal: string | number = '';

                                if (sortConfig.key === 'name') {
                                    aVal = a.name.toLowerCase();
                                    bVal = b.name.toLowerCase();
                                } else if (sortConfig.key === 'equipped') {
                                    aVal = a.properties.equipped ? 1 : 0;
                                    bVal = b.properties.equipped ? 1 : 0;
                                } else {
                                    aVal = String(a.properties[sortConfig.key] ?? 0);
                                    bVal = String(b.properties[sortConfig.key] ?? 0);
                                }

                                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                                return 0;
                            });
                        }

                        const SortIcon = ({ colKey }: { colKey: string }) => {
                            if (sortConfig?.key !== colKey) return null;
                            return sortConfig.direction === 'asc' ? <ChevronUp size={10} className="inline ml-1 text-[var(--vibe-text-muted)]" /> : <ChevronDown size={10} className="inline ml-1 text-[var(--vibe-text-muted)]" />;
                        };

                        const isWeaponOrArmor = category === 'оружие' || category === 'броня';

                        return (
                            <div
                                key={category}
                                data-entity-drop-target="true"
                                data-entity-id={entity.id}
                                data-entity-slot="inventory"
                                data-entity-accepts="object"
                                className={inventoryCategoryClass}
                                onDragOver={(e) => { if (canEditInventory) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
                                onDragEnter={(e) => { if (canEditInventory) e.preventDefault(); }}
                                onDrop={(e) => handleDrop(e, category)}
                            >
                                <div className="mb-1 flex items-center justify-between border-b border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-header)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-muted)] shadow-inner">
                                    {category} ({itemsInCategory.length})
                                </div>

                                {itemsInCategory.length === 0 ? (
                                    <div className="px-3 py-3 text-[10px] italic text-[var(--vibe-text-faint)]">
                                        {canEditInventory ? 'Перетащите сюда предметы...' : 'Нет предметов в категории.'}
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto w-full custom-scrollbar">
                                        <table className="w-full text-left border-collapse min-w-max">
                                            <thead>
                                                <tr className="select-none border-b border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] text-[9px] uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                                    <th className="font-normal px-2 py-1.5 w-6"></th>
                                                    <th className={`${tableHeadCellClass} cursor-pointer`} onClick={() => handleSort(category, 'name')}>
                                                        Предмет <SortIcon colKey="name" />
                                                    </th>
                                                    {isWeaponOrArmor && (
                                                        <th className={`${tableHeadCellClass} cursor-pointer text-center`} title="Экипировано" onClick={() => handleSort(category, 'equipped')}>
                                                            Эк. <SortIcon colKey="equipped" />
                                                        </th>
                                                    )}
                                                    <th className={`${tableHeadCellClass} cursor-pointer text-center`} title="Количество" onClick={() => handleSort(category, 'количество')}>
                                                        Кол-во <SortIcon colKey="количество" />
                                                    </th>
                                                    <th className={`${tableHeadCellClass} cursor-pointer text-center`} title="Нагрузка (Вес одного)" onClick={() => handleSort(category, 'нагрузка')}>
                                                        Вес <SortIcon colKey="нагрузка" />
                                                    </th>
                                                    <th className={`${tableHeadCellClass} cursor-pointer text-center`} title="Фигура" onClick={() => handleSort(category, 'фигура')}>
                                                        ФИГ <SortIcon colKey="фигура" />
                                                    </th>
                                                    <th className={`${tableHeadCellClass} cursor-pointer text-center`} title="Прочность" onClick={() => handleSort(category, 'прочность')}>
                                                        ПРОЧ <SortIcon colKey="прочность" />
                                                    </th>
                                                    <th className={`${tableHeadCellClass} cursor-pointer text-center`} title="Редкость" onClick={() => handleSort(category, 'редкость')}>
                                                        РЕД <SortIcon colKey="редкость" />
                                                    </th>
                                                    <th className={`${tableHeadCellClass} cursor-pointer text-center text-[var(--vibe-warning)]`} title="Цена (У.Е.)" onClick={() => handleSort(category, 'цена')}>
                                                        Цена <SortIcon colKey="цена" />
                                                    </th>
                                                    <th className="font-normal px-2 py-1.5 text-center w-6"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {itemsInCategory.map(item => {
                                                    const qty = item.properties.количество ?? 1;
                                                    const weight = item.properties.нагрузка ?? 1.0;
                                                    const canEditItem = canEditInventory && canEditEntity(item);

                                                    return (
                                                        <tr
                                                            key={item.id}
                                                            className="group border-b border-[var(--vibe-border-subtle)] transition-colors hover:bg-[var(--vibe-surface-hover)]"
                                                            draggable={canEditItem}
                                                            onDragStart={(e) => {
                                                                if (!canEditItem) {
                                                                    e.preventDefault();
                                                                    return;
                                                                }
                                                                writeEntityDragIds(e.dataTransfer, [item.id]);
                                                                e.dataTransfer.effectAllowed = "move";
                                                            }}
                                                        >
                                                            <td className="cursor-grab px-2 py-1.5 text-[var(--vibe-text-faint)] opacity-30 transition-opacity active:cursor-grabbing group-hover:opacity-100" onDragStart={(e) => e.preventDefault()} draggable={false}>
                                                                {canEditItem && <GripVertical size={12} />}
                                                            </td>
                                                            <td className="px-2 py-1.5">
                                                                <div draggable={false} onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                                                                    <EntityLink entityId={item.id} className="block max-w-[120px] truncate text-xs font-bold text-[var(--vibe-text-muted)] transition-colors group-hover:text-[var(--vibe-text-primary)]" underline={false} />
                                                                </div>
                                                            </td>
                                                            {isWeaponOrArmor && (
                                                                <td className="px-2 py-1.5 text-center" onDragStart={(e) => e.preventDefault()} draggable={true}>
                                                                    <div className="flex justify-center items-center w-full h-full">
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); updateItemProperty(item.id, 'equipped', !item.properties.equipped); }}
                                                                            disabled={!canEditItem}
                                                                            className={`flex h-4.5 w-8 items-center rounded-full p-0.5 shadow-inner transition-colors duration-300 ${item.properties.equipped ? 'border border-[var(--vibe-success)] bg-[color-mix(in_srgb,var(--vibe-success)_72%,transparent)]' : 'border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] backdrop-blur-sm hover:bg-[var(--vibe-surface-hover)]'}`}
                                                                            title="Экипировать"
                                                                        >
                                                                            <div className={`h-3.5 w-3.5 rounded-full bg-[var(--vibe-text-primary)] shadow-[var(--vibe-shadow-block)] transition-transform duration-300 ${item.properties.equipped ? 'translate-x-3.5' : 'translate-x-0'}`}></div>
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            )}
                                                            <td className="px-2 py-1.5 text-center w-14" onDragStart={(e) => e.preventDefault()} draggable={true}>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={qty || ''}
                                                                    readOnly={!canEditItem}
                                                                    onChange={(e) => updateItemProperty(item.id, 'количество', Math.max(1, parseInt(e.target.value) || 1))}
                                                                    className={`${glass.input} mx-auto block w-10 cursor-text px-1 py-1 text-center text-[11px] font-bold`}
                                                                />
                                                            </td>
                                                            <td className={tableValueCellClass}>
                                                                {(qty * weight).toFixed(1)}
                                                            </td>
                                                            <td className={tableValueCellClass}>
                                                                {item.properties.фигура ?? 1}
                                                            </td>
                                                            <td className={tableValueCellClass}>
                                                                {item.properties.прочность ?? 1}
                                                            </td>
                                                            <td className={tableValueCellClass}>
                                                                {item.properties.редкость ?? 0}
                                                            </td>
                                                            <td className="px-2 py-1.5 text-center font-mono text-[10px] font-bold text-[var(--vibe-warning)]">
                                                                {item.properties.цена ?? 0}
                                                            </td>
                                                            <td className="px-2 py-1.5 text-center w-6">
                                                                {canEditItem && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id, item.name); }}
                                                                        className="p-1 text-[var(--vibe-text-faint)] opacity-0 transition-all hover:text-[var(--vibe-danger)] group-hover:opacity-100"
                                                                        title="Удалить предмет"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[var(--vibe-border-subtle)] pt-3 text-xs">
                    <span className="font-bold uppercase tracking-wider text-[var(--vibe-text-muted)]">Общая Нагрузка:</span>
                    <span className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-0.5 font-mono text-sm font-bold text-[var(--vibe-text-primary)] shadow-inner">{totalWeight.toFixed(1)}</span>
                </div>
            </div>

            <DragDropPopover data={dragDropPrompt} />
        </div>
    );
}
