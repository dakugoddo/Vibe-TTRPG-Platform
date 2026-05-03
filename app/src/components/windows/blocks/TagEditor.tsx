import { Plus, Trash2 } from 'lucide-react';
import { yjsStore } from '../../../store/yjsStore';
import type { Entity } from '../../../types';

interface TagEditorProps {
    entity: Entity;
}

export function TagEditor({ entity }: TagEditorProps) {
    const modifiers = entity.properties?.modifiers || [];

    const handleAddModifier = () => {
        const newModifier = { path: ['attributes', 'hp', 'max'], value: 1, type: 'add' };
        yjsStore.updateEntity(entity.id, {
            properties: {
                ...entity.properties,
                modifiers: [...modifiers, newModifier]
            }
        });
    };

    const handleUpdateModifier = (index: number, key: string, newValue: any) => {
        const newMods = [...modifiers];
        if (key === 'path') {
            newMods[index].path = newValue.split('.').map((s: string) => s.trim()).filter(Boolean);
        } else {
            newMods[index][key] = newValue;
        }

        yjsStore.updateEntity(entity.id, {
            properties: {
                ...entity.properties,
                modifiers: newMods
            }
        });
    };

    const handleRemoveModifier = (index: number) => {
        const newMods = modifiers.filter((_: any, i: number) => i !== index);
        yjsStore.updateEntity(entity.id, {
            properties: {
                ...entity.properties,
                modifiers: newMods
            }
        });
    };

    return (
        <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2">
                    Эффекты и Модификаторы
                    <div className="flex-1 h-px bg-white/10 ml-2"></div>
                </h3>
            </div>

            <div className="space-y-2 mb-3">
                {modifiers.map((mod: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 bg-[#2a2d3d]/40 p-2 rounded-xl border border-[#2a2d3d] shadow-sm">
                        <input
                            type="text"
                            value={(mod.path || []).join('.')}
                            onChange={(e) => handleUpdateModifier(idx, 'path', e.target.value)}
                            placeholder="Путь (напр. attributes.hp.max)"
                            className="flex-1 bg-[#1a1c29] border border-[#1a1c29] rounded-lg px-2 py-1.5 text-xs text-white/90 focus:border-white/30 outline-none transition-all shadow-inner"
                            title="Путь к характеристике (через точку)"
                        />
                        <select
                            value={mod.type || 'add'}
                            onChange={(e) => handleUpdateModifier(idx, 'type', e.target.value)}
                            className="w-24 bg-[#1a1c29] border border-[#1a1c29] rounded-lg px-2 py-1.5 text-xs text-white/90 focus:border-white/30 outline-none transition-all shadow-inner"
                        >
                            <option value="add" className="bg-gray-900">Сложение</option>
                            <option value="multiply" className="bg-gray-900">Множитель</option>
                            <option value="min" className="bg-gray-900">Минимум</option>
                            <option value="max" className="bg-gray-900">Максимум</option>
                        </select>
                        <input
                            type="number"
                            value={mod.value || 0}
                            onChange={(e) => handleUpdateModifier(idx, 'value', parseFloat(e.target.value) || 0)}
                            className="w-20 bg-[#1a1c29] border border-[#1a1c29] rounded-lg px-2 py-1.5 text-xs text-white/90 text-center focus:border-white/30 outline-none transition-all shadow-inner"
                        />
                        <button
                            onClick={() => handleRemoveModifier(idx)}
                            className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}

                {modifiers.length === 0 && (
                    <p className="text-xs text-white/30 italic py-3 text-center border border-dashed border-white/5 rounded-xl bg-white/5">
                        Тег не имеет механических эффектов
                    </p>
                )}
            </div>

            <button
                onClick={handleAddModifier}
                className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl border border-white/10 transition-colors text-[10px] font-bold uppercase tracking-wider shadow-sm"
            >
                <Plus size={14} /> Добавить модификатор
            </button>
        </div>
    );
}
