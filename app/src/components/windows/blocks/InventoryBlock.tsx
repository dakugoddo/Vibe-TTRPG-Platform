import React, { useState } from 'react';
import type { Entity } from '../../../types';
import { yjsStore } from '../../../store/yjsStore';
import { useEntities } from '../../../hooks/useEntities';
import { DragDropPopover, type DragDropPromptData } from '../../ui/DragDropPopover';
import { useUIStore } from '../../../store/uiStore';
import { Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { EntityLink } from '../../ui/EntityLink';
import { glass } from '../../../utils/theme';

interface InventoryBlockProps {
    entity: Entity;
}

const CATEGORIES = ['оружие', 'броня', 'расходуемое', 'другое'] as const;
type Category = typeof CATEGORIES[number];

type SortConfig = {
    key: string;
    direction: 'asc' | 'desc';
} | null;

export function InventoryBlock({ entity }: InventoryBlockProps) {
    const allEntities = useEntities();
    const children = allEntities.filter(e => e.parentId === entity.id);
    const inventory = children.filter(e => e.type === 'object');

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
        openConfirm({
            title: "Удаление предмета",
            description: `Вы уверены, что хотите удалить предмет "${itemName}"?`,
            confirmText: "Удалить",
            isDestructive: true,
            onConfirm: () => {
                yjsStore.deleteEntity(itemId);
            }
        });
    };

    const updateItemProperty = (itemId: string, key: string, value: any) => {
        const item = inventory.find(i => i.id === itemId);
        if (item) {
            yjsStore.updateEntity(itemId, {
                properties: { ...item.properties, [key]: value }
            });
        }
    };

    const handleDrop = (e: React.DragEvent, targetCategory: Category) => {
        e.preventDefault();
        e.stopPropagation();

        const droppedEntityId = e.dataTransfer.getData("application/entity-id");

        if (droppedEntityId) {
            const droppedEntity = allEntities.find(ent => ent.id === droppedEntityId);
            if (droppedEntity && droppedEntity.type === 'object') {
                if (droppedEntity.parentId === entity.id) {
                    // Already inside this character -> just change category
                    updateItemProperty(droppedEntity.id, 'category', targetCategory);
                } else {
                    // Coming from outside
                    setDragDropPrompt({
                        x: e.clientX,
                        y: e.clientY,
                        entityName: droppedEntity.name,
                        onMove: () => {
                            yjsStore.updateEntity(droppedEntity.id, {
                                parentId: entity.id,
                                database: entity.database,
                                properties: { ...droppedEntity.properties, category: targetCategory }
                            });
                            setDragDropPrompt(null);
                        },
                        onCopy: () => {
                            const newId = yjsStore.cloneEntity(droppedEntity.id, entity.id, entity.database);
                            if (newId) {
                                const newEnt = getEntitySnapshot(newId);
                                if (newEnt) {
                                    yjsStore.updateEntity(newId, {
                                        properties: { ...newEnt.properties, category: targetCategory }
                                    });
                                }
                            }
                            setDragDropPrompt(null);
                        },
                        onCancel: () => {
                            setDragDropPrompt(null);
                        }
                    });
                }
            }
        }
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
            <div className={`${glass.blockBg} border border-red-500/20 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]`}>
                <h4 className={glass.blockHeader + " text-red-400 border-red-500/20"}>
                    Доступные Атаки (Экипированное Оружие)
                </h4>
                {availableAttacks.length === 0 ? (
                    <div className="text-white/30 text-[10px] italic">Нет доступных атак. Экипируйте оружие с атаками.</div>
                ) : (
                    <div className="grid grid-cols-1 gap-2">
                        {availableAttacks.map(atk => (
                            <div key={atk.id} className="bg-[#1a1c29]/60 backdrop-blur-md border border-red-500/10 hover:border-red-500/30 p-2 rounded-lg flex justify-between items-center transition-colors shadow-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center font-bold text-[10px]">⚔️</div>
                                    <EntityLink entityId={atk.id} className="text-sm font-bold text-white/90 hover:text-white" />
                                    <span className="text-[10px] text-white/30 ml-2">(от: {allEntities.find(e => e.id === atk.parentId)?.name})</span>
                                </div>
                                <div className="flex gap-3 text-[10px] font-mono text-white/60">
                                    <span title="Урон">🗡️ <span className="text-white/90 font-bold">{atk.properties.урон ?? 1}</span></span>
                                    <span title="Масштаб">📏 <span className="text-white/90 font-bold">{atk.properties.масштаб ?? 1}</span></span>
                                    <span title="Попадание">🎯 <span className="text-white/90 font-bold">{atk.properties.попадание ?? 1}</span></span>
                                    <span title="Дистанция" className="text-red-400/80 uppercase">[{atk.properties.дистанция ?? 'ближняя'}]</span>
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
                        let itemsInCategory = inventory.filter(item => (item.properties.category || 'другое') === category);

                        itemsInCategory.forEach(item => {
                            const qty = item.properties.количество ?? 1;
                            const weight = item.properties.нагрузка ?? 1.0;
                            totalWeight += (qty * weight);
                        });

                        // Sorting logic
                        const sortConfig = sortConfigs[category];
                        if (sortConfig) {
                            itemsInCategory.sort((a, b) => {
                                let aVal: any = '';
                                let bVal: any = '';

                                if (sortConfig.key === 'name') {
                                    aVal = a.name.toLowerCase();
                                    bVal = b.name.toLowerCase();
                                } else if (sortConfig.key === 'equipped') {
                                    aVal = a.properties.equipped ? 1 : 0;
                                    bVal = b.properties.equipped ? 1 : 0;
                                } else {
                                    aVal = a.properties[sortConfig.key] ?? 0;
                                    bVal = b.properties[sortConfig.key] ?? 0;
                                }

                                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                                return 0;
                            });
                        }

                        const SortIcon = ({ colKey }: { colKey: string }) => {
                            if (sortConfig?.key !== colKey) return null;
                            return sortConfig.direction === 'asc' ? <ChevronUp size={10} className="inline ml-1 text-white/60" /> : <ChevronDown size={10} className="inline ml-1 text-white/60" />;
                        };

                        const isWeaponOrArmor = category === 'оружие' || category === 'броня';

                        return (
                            <div
                                key={category}
                                className="border border-white/5 rounded-lg overflow-hidden bg-[#2a2d3d]/40 pb-2 shadow-sm"
                                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                onDragEnter={(e) => { e.preventDefault(); }}
                                onDrop={(e) => handleDrop(e, category)}
                            >
                                <div className="bg-[#1a1c29] px-3 py-1.5 text-[10px] font-bold text-white/50 uppercase tracking-widest flex justify-between items-center mb-1 border-b border-white/5 shadow-inner">
                                    {category} ({itemsInCategory.length})
                                </div>

                                {itemsInCategory.length === 0 ? (
                                    <div className="text-[10px] text-white/30 italic py-3 px-3">
                                        Перетащите сюда предметы...
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto w-full custom-scrollbar">
                                        <table className="w-full text-left border-collapse min-w-max">
                                            <thead>
                                                <tr className="border-b border-white/10 text-[9px] text-white/40 uppercase tracking-wider select-none bg-white/5">
                                                    <th className="font-normal px-2 py-1.5 w-6"></th>
                                                    <th className="font-normal px-2 py-1.5 cursor-pointer hover:text-white/80 transition-colors" onClick={() => handleSort(category, 'name')}>
                                                        Предмет <SortIcon colKey="name" />
                                                    </th>
                                                    {isWeaponOrArmor && (
                                                        <th className="font-normal px-2 py-1.5 text-center cursor-pointer hover:text-white/80 transition-colors" title="Экипировано" onClick={() => handleSort(category, 'equipped')}>
                                                            Эк. <SortIcon colKey="equipped" />
                                                        </th>
                                                    )}
                                                    <th className="font-normal px-2 py-1.5 text-center cursor-pointer hover:text-white/80 transition-colors" title="Количество" onClick={() => handleSort(category, 'количество')}>
                                                        Кол-во <SortIcon colKey="количество" />
                                                    </th>
                                                    <th className="font-normal px-2 py-1.5 text-center cursor-pointer hover:text-white/80 transition-colors" title="Нагрузка (Вес одного)" onClick={() => handleSort(category, 'нагрузка')}>
                                                        Вес <SortIcon colKey="нагрузка" />
                                                    </th>
                                                    <th className="font-normal px-2 py-1.5 text-center cursor-pointer hover:text-white/80 transition-colors" title="Фигура" onClick={() => handleSort(category, 'фигура')}>
                                                        ФИГ <SortIcon colKey="фигура" />
                                                    </th>
                                                    <th className="font-normal px-2 py-1.5 text-center cursor-pointer hover:text-white/80 transition-colors" title="Прочность" onClick={() => handleSort(category, 'прочность')}>
                                                        ПРОЧ <SortIcon colKey="прочность" />
                                                    </th>
                                                    <th className="font-normal px-2 py-1.5 text-center cursor-pointer hover:text-white/80 transition-colors" title="Редкость" onClick={() => handleSort(category, 'редкость')}>
                                                        РЕД <SortIcon colKey="редкость" />
                                                    </th>
                                                    <th className="font-normal px-2 py-1.5 text-center cursor-pointer hover:text-white/80 transition-colors text-yellow-500/80" title="Цена (У.Е.)" onClick={() => handleSort(category, 'цена')}>
                                                        Цена <SortIcon colKey="цена" />
                                                    </th>
                                                    <th className="font-normal px-2 py-1.5 text-center w-6"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {itemsInCategory.map(item => {
                                                    const qty = item.properties.количество ?? 1;
                                                    const weight = item.properties.нагрузка ?? 1.0;

                                                    return (
                                                        <tr
                                                            key={item.id}
                                                            className="border-b border-white/5 hover:bg-white/5 group transition-colors"
                                                            draggable={true}
                                                            onDragStart={(e) => {
                                                                e.dataTransfer.setData("application/entity-id", item.id);
                                                                e.dataTransfer.effectAllowed = "move";
                                                            }}
                                                        >
                                                            <td className="px-2 py-1.5 text-white/20 cursor-grab active:cursor-grabbing opacity-30 group-hover:opacity-100 transition-opacity" onDragStart={(e) => e.preventDefault()} draggable={false}>
                                                                <GripVertical size={12} />
                                                            </td>
                                                            <td className="px-2 py-1.5">
                                                                <div draggable={false} onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                                                                    <EntityLink entityId={item.id} className="text-xs font-bold text-white/80 group-hover:text-white truncate max-w-[120px] block transition-colors" underline={false} />
                                                                </div>
                                                            </td>
                                                            {isWeaponOrArmor && (
                                                                <td className="px-2 py-1.5 text-center" onDragStart={(e) => e.preventDefault()} draggable={true}>
                                                                    <div className="flex justify-center items-center w-full h-full">
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); updateItemProperty(item.id, 'equipped', !item.properties.equipped); }}
                                                                            className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-300 flex items-center shadow-inner ${item.properties.equipped ? 'bg-green-500 border border-green-400' : 'bg-black/40 border border-white/10 hover:bg-black/60 backdrop-blur-sm'}`}
                                                                            title="Экипировать"
                                                                        >
                                                                            <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.5)] transform transition-transform duration-300 ${item.properties.equipped ? 'translate-x-3.5' : 'translate-x-0'}`}></div>
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            )}
                                                            <td className="px-2 py-1.5 text-center w-14" onDragStart={(e) => e.preventDefault()} draggable={true}>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={qty || ''}
                                                                    onChange={(e) => updateItemProperty(item.id, 'количество', Math.max(1, parseInt(e.target.value) || 1))}
                                                                    className="w-10 text-[11px] font-bold text-center bg-[#1a1c29] text-white rounded-md border border-[#1a1c29] hover:border-white/30 focus:border-white/50 focus:bg-[#2e3145] outline-none transition-colors py-1 cursor-text custom-scrollbar ml-auto mr-auto block shadow-inner"
                                                                />
                                                            </td>
                                                            <td className="px-2 py-1.5 text-center text-[10px] text-white/50 font-mono">
                                                                {(qty * weight).toFixed(1)}
                                                            </td>
                                                            <td className="px-2 py-1.5 text-center text-[10px] text-white/50 font-mono">
                                                                {item.properties.фигура ?? 1}
                                                            </td>
                                                            <td className="px-2 py-1.5 text-center text-[10px] text-white/50 font-mono">
                                                                {item.properties.прочность ?? 1}
                                                            </td>
                                                            <td className="px-2 py-1.5 text-center text-[10px] text-white/50 font-mono">
                                                                {item.properties.редкость ?? 0}
                                                            </td>
                                                            <td className="px-2 py-1.5 text-center text-[10px] text-yellow-500/90 font-mono font-bold">
                                                                {item.properties.цена ?? 0}
                                                            </td>
                                                            <td className="px-2 py-1.5 text-center w-6">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id, item.name); }}
                                                                    className="text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                                                                    title="Удалить предмет"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
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

                <div className="mt-4 flex justify-between items-center text-xs border-t border-white/10 pt-3">
                    <span className="text-white/50 font-bold uppercase tracking-wider">Общая Нагрузка:</span>
                    <span className="text-white font-mono font-bold text-sm bg-[#2e3145] px-2 py-0.5 rounded border border-[#2e3145] shadow-inner">{totalWeight.toFixed(1)}</span>
                </div>
            </div>

            <DragDropPopover data={dragDropPrompt} />
        </div>
    );
}
