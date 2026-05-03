import { useState } from 'react';
import { yjsStore } from '../../../store/yjsStore';
import { useEntities } from '../../../hooks/useEntities';
import { useWindowStore } from '../../../store/windowStore';
import type { Entity } from '../../../types';
import { Plus, Trash2, Tag } from 'lucide-react';
import { EntityLink } from '../../ui/EntityLink';
import { TagPickerPopup } from './TagPickerPopup';
import { glass } from '../../../utils/theme';

interface AttackSheetProps {
    entity: Entity;
}

const DISTANCES = ['ближняя', 'средняя', 'дальняя', 'экстремальная', 'запредельная'];

export function AttackSheet({ entity }: AttackSheetProps) {
    const allEntities = useEntities();
    const { openWindow } = useWindowStore();
    const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);

    const updateProperty = (key: string, value: any) => {
        yjsStore.updateEntity(entity.id, {
            properties: {
                ...entity.properties,
                [key]: value
            }
        });
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
        <div className="space-y-6 animate-in fade-in duration-200 mt-4">
            <div className={`${glass.blockBg} border-red-500/20 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]`}>
                <h3 className={glass.blockHeader + " text-red-400 border-red-500/20 mb-3"}>
                    Характеристики Атаки
                </h3>

                <div className="grid grid-cols-2 gap-3">
                    {/* Урон */}
                    <div className="bg-[#2a2d3d]/40 p-2 rounded-lg border border-[#2a2d3d] flex flex-col items-center group hover:bg-[#2a2d3d] hover:border-white/10 transition-all shadow-sm">
                        <span
                            className="text-[10px] text-white/40 uppercase font-bold mb-1 cursor-pointer hover:text-white transition-colors"
                            onClick={() => handleOpenNote('Урон')}
                        >
                            Урон
                        </span>
                        <input
                            type="number"
                            value={entity.properties.урон ?? 1}
                            onChange={(e) => updateProperty('урон', parseInt(e.target.value) || 0)}
                            className="bg-transparent text-white font-bold text-lg w-full text-center outline-none group-hover:text-red-300 transition-colors"
                            placeholder="0"
                        />
                    </div>

                    {/* Масштаб */}
                    <div className="bg-[#2a2d3d]/40 p-2 rounded-lg border border-[#2a2d3d] flex flex-col items-center group hover:bg-[#2a2d3d] hover:border-white/10 transition-all shadow-sm">
                        <span
                            className="text-[10px] text-white/40 uppercase font-bold mb-1 cursor-pointer hover:text-white transition-colors"
                            onClick={() => handleOpenNote('Масштаб')}
                        >
                            Масштаб
                        </span>
                        <input
                            type="number"
                            value={entity.properties.масштаб ?? 1}
                            onChange={(e) => updateProperty('масштаб', parseInt(e.target.value) || 0)}
                            className="bg-transparent text-white font-bold text-lg w-full text-center outline-none group-hover:text-red-300 transition-colors"
                            placeholder="0"
                        />
                    </div>

                    {/* Попадание */}
                    <div className="bg-[#2a2d3d]/40 p-2 rounded-lg border border-[#2a2d3d] flex flex-col items-center group hover:bg-[#2a2d3d] hover:border-white/10 transition-all shadow-sm">
                        <span
                            className="text-[10px] text-white/40 uppercase font-bold mb-1 cursor-pointer hover:text-white transition-colors"
                            onClick={() => handleOpenNote('Попадание')}
                        >
                            Попадание
                        </span>
                        <input
                            type="number"
                            value={entity.properties.попадание ?? 1}
                            onChange={(e) => updateProperty('попадание', parseInt(e.target.value) || 0)}
                            className="bg-transparent text-white font-bold text-lg w-full text-center outline-none group-hover:text-red-300 transition-colors"
                            placeholder="0"
                        />
                    </div>

                    {/* Дистанция */}
                    <div className="bg-[#2a2d3d]/40 p-2 rounded-lg border border-[#2a2d3d] flex flex-col justify-center group hover:bg-[#2a2d3d] hover:border-white/10 transition-all shadow-sm">
                        <span
                            className="text-[10px] text-white/40 uppercase font-bold mb-1 text-center cursor-pointer hover:text-white transition-colors"
                            onClick={() => handleOpenNote('Дистанция')}
                        >
                            Дистанция
                        </span>
                        <select
                            value={entity.properties.дистанция || DISTANCES[0]}
                            onChange={(e) => updateProperty('дистанция', e.target.value)}
                            className="bg-[#1a1c29] text-white/90 text-xs font-bold w-full text-center outline-none appearance-none rounded p-1 border border-[#1a1c29] hover:border-red-500/50 transition-all cursor-pointer focus:ring-1 focus:ring-red-500 shadow-inner"
                        >
                            {DISTANCES.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* ПРОПЕРТИЗ БЛОК (Свойства) */}
            <div className={`${glass.blockBg} border-red-500/20 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]`}>
                <div className="flex items-center justify-between mb-4">
                    <h4 className={glass.blockHeader + " text-red-400 border-red-500/20 mb-0"}>
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
                        return (
                            <div key={tagId} className="group/tag flex items-center bg-[#2e3145] border border-white/5 rounded-lg overflow-hidden transition-colors hover:border-red-500/50 shadow-md">
                                <EntityLink entityId={tagId} underline={false} className="px-2 py-1 text-white/80 font-medium whitespace-nowrap hover:text-red-300 text-xs" />
                                <button
                                    onClick={() => {
                                        const newTags = entity.tags.filter(id => id !== tagId);
                                        yjsStore.updateEntity(entity.id, { tags: newTags });
                                    }}
                                    className="px-2 py-1 text-white/30 hover:bg-red-900/40 hover:text-red-400 transition-colors border-l border-white/10 group-hover/tag:border-red-500/50"
                                    title="Убрать"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        )
                    }) : <span className="text-white/30 text-xs italic">Нет свойств</span>}
                </div>
            </div>
        </div>
    );
}
