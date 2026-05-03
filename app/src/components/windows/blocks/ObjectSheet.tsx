import React, { useState } from 'react';
import { yjsStore } from '../../../store/yjsStore';
import { useEntities } from '../../../hooks/useEntities';
import { useWindowStore } from '../../../store/windowStore';
import type { Entity } from '../../../types';
import { Plus, GripVertical, Trash2, Tag } from 'lucide-react';
import { EntityLink } from '../../ui/EntityLink';
import { TagPickerPopup } from './TagPickerPopup';
import { DragDropPopover, type DragDropPromptData } from '../../ui/DragDropPopover';
import { useUIStore } from '../../../store/uiStore';
import { glass } from '../../../utils/theme';

interface ObjectSheetProps {
    entity: Entity;
}

const CATEGORIES = ['оружие', 'броня', 'расходуемое', 'другое'];

export function ObjectSheet({ entity }: ObjectSheetProps) {
    const allEntities = useEntities();
    const { openWindow } = useWindowStore();
    const { openConfirm } = useUIStore();
    const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
    const [dragDropPrompt, setDragDropPrompt] = useState<DragDropPromptData | null>(null);

    // Find child attacks
    const attacks = allEntities.filter(e => e.parentId === entity.id && e.type === 'attack');

    const updateProperty = (key: string, value: any) => {
        yjsStore.updateEntity(entity.id, {
            properties: {
                ...entity.properties,
                [key]: value
            }
        });
    };

    const handleCreateAttack = () => {
        const id = Date.now().toString() + Math.random().toString(36).substring(7);
        const newAttack: Entity = {
            id,
            parentId: entity.id,
            type: 'attack',
            name: `Новая Атака`,
            description: '',
            tags: [],
            database: entity.database,
            properties: {
                урон: 1,
                масштаб: 1,
                попадание: 1,
                дистанция: 'ближняя'
            }
        };
        yjsStore.addEntity(newAttack);
    };

    const handleRootDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedId = e.dataTransfer.getData("application/entity-id");
        if (draggedId) {
            const draggedEnt = allEntities.find(ent => ent.id === draggedId);
            if (draggedEnt && draggedEnt.type === 'attack' && draggedId !== entity.id) {
                setDragDropPrompt({
                    x: e.clientX,
                    y: e.clientY,
                    entityName: draggedEnt.name,
                    onMove: () => {
                        yjsStore.updateEntity(draggedId, { parentId: entity.id, database: entity.database });
                        setDragDropPrompt(null);
                    },
                    onCopy: () => {
                        const newId = Date.now().toString() + Math.random().toString(36).substring(7);
                        const cloned = JSON.parse(JSON.stringify(draggedEnt));
                        cloned.id = newId;
                        cloned.parentId = entity.id;
                        cloned.database = entity.database;
                        yjsStore.addEntity(cloned);
                        setDragDropPrompt(null);
                    },
                    onCancel: () => setDragDropPrompt(null)
                });
            }
        }
    };

    const handleOpenNote = (noteName: string) => {
        const note = allEntities.find(en => en.type === 'note' && en.name.toLowerCase() === noteName.toLowerCase());
        if (note) {
            openWindow(note.id, Math.random() * 200 + 100, Math.random() * 200 + 100);
        } else {
            console.log(`Заметка '${noteName}' не найдена`);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200 mt-4 relative">
            {dragDropPrompt && (
                <DragDropPopover
                    data={dragDropPrompt}
                />
            )}

            {/* Базовые параметры */}
            <div className={`${glass.blockBg}`}>
                <h3 className={glass.blockHeader}>
                    Характеристики Предмета
                </h3>

                <div className="grid grid-cols-3 gap-3">
                    {/* Категория (для инвентаря персонажа) */}
                    <div className="bg-[#2a2d3d]/40 p-2 rounded-lg border border-[#2a2d3d] flex flex-col justify-center col-span-3 hover:bg-[#2a2d3d] hover:border-white/10 transition-all group shadow-sm">
                        <span className="text-[10px] text-white/40 uppercase font-bold mb-1">Категория (Тип)</span>
                        <div className="flex bg-[#1a1c29] shadow-inner rounded p-1 border border-[#1a1c29]">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => updateProperty('category', cat)}
                                    className={`flex-1 text-[10px] py-1 px-1 rounded font-bold uppercase tracking-wider transition-all ${(entity.properties.category || 'другое') === cat ? 'bg-white/20 text-white shadow-md border border-white/10' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-[#2a2d3d]/40 p-2 rounded-lg border border-[#2a2d3d] flex flex-col items-center group hover:bg-[#2a2d3d] hover:border-white/10 transition-all shadow-sm">
                        <span
                            className="text-[10px] text-white/40 uppercase font-bold mb-1 cursor-pointer hover:text-white transition-colors"
                            title="Размер в единицах: 1,2,3,4..."
                            onClick={() => handleOpenNote('Фигура')}
                        >
                            Фигура
                        </span>
                        <input
                            type="number" min="0" step="1"
                            value={entity.properties.фигура ?? 1}
                            onChange={(e) => updateProperty('фигура', parseInt(e.target.value) || 0)}
                            className="bg-transparent text-white font-bold text-lg w-full text-center outline-none group-hover:text-white/60 transition-colors"
                        />
                    </div>
                    <div className="bg-[#2a2d3d]/40 p-2 rounded-lg border border-[#2a2d3d] flex flex-col items-center group hover:bg-[#2a2d3d] hover:border-white/10 transition-all shadow-sm">
                        <span
                            className="text-[10px] text-white/40 uppercase font-bold mb-1 cursor-pointer hover:text-white transition-colors"
                            onClick={() => handleOpenNote('Прочность')}
                        >
                            Прочность
                        </span>
                        <input
                            type="number" min="0" step="1"
                            value={entity.properties.прочность ?? 1}
                            onChange={(e) => updateProperty('прочность', parseInt(e.target.value) || 0)}
                            className="bg-transparent text-white font-bold text-lg w-full text-center outline-none group-hover:text-white/60 transition-colors"
                        />
                    </div>
                    <div className="bg-[#2a2d3d]/40 p-2 rounded-lg border border-[#2a2d3d] flex flex-col items-center group hover:bg-[#2a2d3d] hover:border-white/10 transition-all shadow-sm">
                        <span
                            className="text-[10px] text-white/40 uppercase font-bold mb-1 cursor-pointer hover:text-white transition-colors"
                            onClick={() => handleOpenNote('Нагрузка')}
                        >
                            Нагрузка (Вес)
                        </span>
                        <input
                            type="number" min="0" step="0.1"
                            value={entity.properties.нагрузка ?? 1.0}
                            onChange={(e) => updateProperty('нагрузка', parseFloat(e.target.value) || 0)}
                            className="bg-transparent text-white font-bold text-lg w-full text-center outline-none group-hover:text-white/60 transition-colors"
                        />
                    </div>
                    <div className="bg-[#2a2d3d]/40 p-2 rounded-lg border border-[#2a2d3d] flex flex-col items-center group hover:bg-[#2a2d3d] hover:border-white/10 transition-all shadow-sm">
                        <span
                            className="text-[10px] text-white/40 uppercase font-bold mb-1 cursor-pointer hover:text-white transition-colors"
                            title="Ранг от 0 до 5"
                            onClick={() => handleOpenNote('Редкость')}
                        >
                            Редкость
                        </span>
                        <input
                            type="number" min="0" max="5" step="1"
                            value={entity.properties.редкость ?? 0}
                            onChange={(e) => updateProperty('редкость', parseInt(e.target.value) || 0)}
                            className="bg-transparent text-white font-bold text-lg w-full text-center outline-none group-hover:text-white/60 transition-colors"
                        />
                    </div>
                    <div className="bg-[#2a2d3d]/40 p-2 rounded-lg border border-[rgba(234,179,8,0.2)] flex flex-col items-center col-span-2 group hover:bg-[rgba(234,179,8,0.1)] transition-all shadow-sm">
                        <span
                            className="text-[10px] text-yellow-500/80 uppercase font-bold mb-1 cursor-pointer hover:text-yellow-400 transition-colors"
                            onClick={() => handleOpenNote('Цена')}
                        >
                            Цена (У.Е.)
                        </span>
                        <input
                            type="number" min="0" step="1"
                            value={entity.properties.цена ?? 0}
                            onChange={(e) => updateProperty('цена', parseInt(e.target.value) || 0)}
                            className="bg-transparent text-yellow-400 font-bold text-xl w-full text-center outline-none group-hover:text-yellow-300 transition-colors"
                            placeholder="0"
                        />
                    </div>
                </div>
            </div>

            {/* ПРОПЕРТИЗ БЛОК (Свойства) */}
            <div className={`${glass.blockBg} border-white/20 shadow-[inset_0_0_20px_rgba(255,255,255,0.1)]`}>
                <div className="flex items-center justify-between mb-4">
                    <h4 className={glass.blockHeader + " mb-0"}>
                        <Tag size={14} className="mr-2" />
                        Свойства
                    </h4>

                    <button
                        className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 border-dashed rounded-md text-white/50 hover:text-white hover:border-white/30 hover:bg-white/10 transition-all text-[10px] font-bold uppercase tracking-wider"
                        onClick={() => setIsTagPickerOpen(true)}
                    >
                        <Plus size={12} /> Добавить
                    </button>

                    <TagPickerPopup
                        isOpen={isTagPickerOpen}
                        onClose={() => setIsTagPickerOpen(false)}
                        onSelect={(tagId) => {
                            const newTags = [...(entity.tags || []), tagId];
                            yjsStore.updateEntity(entity.id, { tags: newTags });
                        }}
                        excludeTags={entity.tags || []}
                        allowedFolders={['folder_tags_properties']}
                        title="Добавить свойство"
                    />
                </div>

                <div className="flex flex-wrap gap-2 text-sm">
                    {entity.tags && entity.tags.length > 0 ? entity.tags.map(tagId => {

                        // Show all tags, or if there's a strict folder, you might filter. 
                        // But since users might assign general tags, let's show anyway.

                        return (
                            <div key={tagId} className="group/tag flex items-center bg-[#2e3145] border border-white/5 rounded-lg overflow-hidden transition-colors hover:border-white/30 shadow-md">
                                <EntityLink entityId={tagId} underline={false} className="px-2 py-1 text-white/80 font-medium whitespace-nowrap hover:text-white text-xs" />
                                <button
                                    onClick={() => {
                                        const newTags = entity.tags.filter(id => id !== tagId);
                                        yjsStore.updateEntity(entity.id, { tags: newTags });
                                    }}
                                    className="px-2 py-1 text-white/30 hover:bg-red-900/40 hover:text-red-400 transition-colors border-l border-white/10 group-hover/tag:border-white/20"
                                    title="Убрать"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        )
                    }) : <span className="text-white/30 text-xs italic">Нет свойств</span>}
                </div>
            </div>

            {/* Список Атак внутри предмета */}
            <div
                className={`${glass.blockBg} border-red-500/20 min-h-[100px] shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onDrop={handleRootDrop}
            >
                <div className="flex items-center justify-between mb-3">
                    <h3 className={glass.blockHeader + " text-red-400 border-red-500/20 mb-0"}>
                        Встроенные Атаки
                    </h3>
                    <button
                        onClick={handleCreateAttack}
                        className="text-[10px] bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 transition-colors px-2 py-1 rounded font-bold uppercase tracking-wider flex items-center gap-1 border border-red-500/30"
                    >
                        <Plus size={10} /> Добавить
                    </button>
                </div>

                <div className="space-y-2">
                    {attacks.length === 0 ? (
                        <div className="text-center text-xs text-white/30 py-4 italic pointer-events-none">
                            Перетащите атаки сюда или создайте новую
                        </div>
                    ) : (
                        attacks.map(attack => (
                            <div key={attack.id} className="flex items-center gap-3 bg-[#1a1c29]/60 border border-white/5 p-2 rounded-lg hover:border-red-500/50 hover:bg-[#1a1c29] transition-all shadow-sm group/atk">
                                <div className="text-red-500/70 hover:text-red-400 cursor-move" draggable={true} onDragStart={(e) => { e.dataTransfer.setData("application/entity-id", attack.id); e.dataTransfer.effectAllowed = "move"; }}>
                                    <GripVertical size={14} />
                                </div>
                                <div className="flex-1 overflow-hidden pointer-events-none">
                                    <EntityLink entityId={attack.id} className="font-bold text-sm text-white/90 hover:text-red-300 truncate block pointer-events-auto transition-colors" underline={false} />
                                    <div className="text-[10px] text-white/50 font-mono flex gap-3 mt-1">
                                        <span title="Урон">🗡️ <span className="font-bold text-white/90">{attack.properties.урон ?? 1}</span></span>
                                        <span title="Масштаб">📏 <span className="font-bold text-white/90">{attack.properties.масштаб ?? 1}</span></span>
                                        <span title="Попадание">🎯 <span className="font-bold text-white/90">{attack.properties.попадание ?? 1}</span></span>
                                        <span title="Дистанция" className="text-red-400/80 uppercase">({attack.properties.дистанция ?? 'ближняя'})</span>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openConfirm({
                                            title: "Удаление атаки",
                                            description: `Вы уверены, что хотите удалить атаку "${attack.name}"?`,
                                            confirmText: "Удалить",
                                            isDestructive: true,
                                            onConfirm: () => {
                                                yjsStore.deleteEntity(attack.id);
                                            }
                                        });
                                    }}
                                    className="p-1.5 object-cover text-white/30 hover:text-red-400 rounded transition-colors opacity-0 group-hover/atk:opacity-100"
                                    title="Удалить атаку"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
