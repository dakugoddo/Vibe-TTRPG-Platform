import { useState } from 'react';
import { yjsStore } from '../../../store/yjsStore';
import { useEntities } from '../../../hooks/useEntities';
import { useWindowStore } from '../../../store/windowStore';
import { rollEngine } from '../../../services/rollEngine';
import type { Entity } from '../../../types';
import { Box, Check, Dices, Edit2, FileText, Plus, SlidersHorizontal, Trash2, Tag } from 'lucide-react';
import { EntityLink } from '../../ui/EntityLink';
import { MarkdownRenderer } from '../../ui/MarkdownRenderer';
import { SheetTabs, type SheetTab } from '../../ui/SheetTabs';
import { TagPickerPopup } from './TagPickerPopup';
import { WikiLinkTextarea } from '../../ui/WikiLinkTextarea';
import { glass } from '../../../utils/theme';
import { createEntityRollVariableResolver } from '../../../utils/rollVariables';
import { EntityCanvasTokenSettings } from './EntityCanvasTokenSettings';

interface AttackSheetProps {
    entity: Entity;
}

type AttackTab = 'stats' | 'description' | 'canvas';

const DISTANCES = ['ближняя', 'средняя', 'дальняя', 'экстремальная', 'запредельная'];

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

function getAttackFormula(entity: Entity): string {
    return stringifyProperty(entity.properties?.diceFormula ?? entity.properties?.dice).trim();
}

function sendAttackRollToChat(entity: Entity, relatedEntities: Entity[] = []) {
    const formula = getAttackFormula(entity);
    if (!formula) return;

    const result = rollEngine.rollExpression(formula, {
        plainNumberAsD6Pool: true,
        resolveVariable: createEntityRollVariableResolver(entity, relatedEntities),
    });
    if (result.error) {
        yjsStore.sendMessage(`Ошибка броска ${entity.name}: ${result.error}`, 'Система', true);
        return;
    }

    yjsStore.sendMessage(rollEngine.formatRollMessage(`${entity.name}: ${formula}`, result), 'Система', true);
}

export function AttackSheet({ entity }: AttackSheetProps) {
    const allEntities = useEntities();
    const { openWindow } = useWindowStore();
    const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<AttackTab>('stats');
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const canEditAttack = canEditEntity(entity);
    const rollFormula = getAttackFormula(entity);
    const canRoll = rollFormula.length > 0;
    const parentEntity = allEntities.find(item => item.id === entity.parentId);
    const tabs: SheetTab<AttackTab>[] = [
        { id: 'stats', label: 'Параметры', icon: SlidersHorizontal },
        { id: 'description', label: 'Описание', icon: FileText },
        { id: 'canvas', label: 'Настройки', icon: Box },
    ];

    const updateProperty = (key: string, value: unknown) => {
        if (!canEditAttack) return;
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
            <SheetTabs
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
                endSlot={activeTab === 'description' && canEditAttack ? (
                    <button
                        onClick={() => setIsEditingDescription(!isEditingDescription)}
                        className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${isEditingDescription ? 'bg-white/20 text-white shadow-sm' : 'text-white/45 hover:bg-white/10 hover:text-white'}`}
                        title={isEditingDescription ? 'Завершить редактирование' : 'Редактировать описание'}
                    >
                        {isEditingDescription ? <Check size={14} /> : <Edit2 size={14} />}
                    </button>
                ) : null}
            />

            {activeTab === 'stats' && (
                <>
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
                            readOnly={!canEditAttack}
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
                            readOnly={!canEditAttack}
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
                            readOnly={!canEditAttack}
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
                            disabled={!canEditAttack}
                            onChange={(e) => updateProperty('дистанция', e.target.value)}
                            className="bg-[#1a1c29] text-white/90 text-xs font-bold w-full text-center outline-none appearance-none rounded p-1 border border-[#1a1c29] hover:border-red-500/50 transition-all cursor-pointer focus:ring-1 focus:ring-red-500 shadow-inner"
                        >
                            {DISTANCES.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>

                    <div className="col-span-2 bg-[#2a2d3d]/40 p-2 rounded-lg border border-red-500/20 flex flex-col gap-1.5 group hover:bg-[#2a2d3d] hover:border-red-500/40 transition-all shadow-sm">
                        <span className="text-[10px] text-red-300/70 uppercase font-bold">
                            Формула броска
                        </span>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={rollFormula}
                                readOnly={!canEditAttack}
                                onChange={(e) => updateProperty('diceFormula', e.target.value)}
                                className="min-w-0 flex-1 bg-[#1a1c29] text-white/90 text-xs font-mono outline-none rounded p-1.5 border border-white/10 focus:border-red-400/50 read-only:text-white/40 read-only:cursor-default"
                                placeholder="1d20+2 / 2d6"
                            />
                            <button
                                type="button"
                                onClick={() => sendAttackRollToChat(entity, parentEntity ? [parentEntity] : [])}
                                disabled={!canRoll}
                                className={`grid h-8 w-8 place-items-center rounded-lg border transition-all ${canRoll ? 'border-red-500/35 bg-red-500/20 text-red-200 hover:bg-red-500/35 hover:text-red-100' : 'border-transparent bg-white/5 text-white/20 cursor-not-allowed'}`}
                                title={canRoll ? `Бросить ${rollFormula}` : 'Укажите формулу броска'}
                            >
                                <Dices size={14} />
                            </button>
                        </div>
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

                    {canEditAttack && (
                        <>
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
                                    if (!canEditAttack) return;
                                    const newTags = [...(entity.tags || []), tagId];
                                    yjsStore.updateEntity(entity.id, { tags: newTags });
                                }}
                                excludeTags={entity.tags || []}
                                allowedFolders={['folder_tags_properties']}
                                title="Добавить свойство"
                            />
                        </>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 text-sm">
                    {entity.tags && entity.tags.length > 0 ? entity.tags.map(tagId => {
                        return (
                            <div key={tagId} className="group/tag flex items-center bg-[#2e3145] border border-white/5 rounded-lg overflow-hidden transition-colors hover:border-red-500/50 shadow-md">
                                <EntityLink entityId={tagId} underline={false} className="px-2 py-1 text-white/80 font-medium whitespace-nowrap hover:text-red-300 text-xs" />
                                {canEditAttack && (
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
                                )}
                            </div>
                        )
                    }) : <span className="text-white/30 text-xs italic">Нет свойств</span>}
                </div>
            </div>
                </>
            )}

            {activeTab === 'description' && (
                <div className={`${glass.blockBg} min-h-[220px]`}>
                    <h3 className={glass.blockHeader}>Описание</h3>
                    {isEditingDescription && canEditAttack ? (
                        <WikiLinkTextarea
                            value={entity.description || ''}
                            onValueChange={(value) => yjsStore.updateEntity(entity.id, { description: value })}
                            excludeEntityId={entity.id}
                            className={`${glass.input} w-full min-h-[180px] resize-y custom-scrollbar text-sm font-sans`}
                            placeholder="Описание атаки, эффекты, условия применения..."
                            autoFocus
                        />
                    ) : (
                        <div className="min-h-[180px] text-sm leading-relaxed text-white/80" onDoubleClick={() => { if (canEditAttack) setIsEditingDescription(true); }}>
                            {entity.description
                                ? <MarkdownRenderer content={entity.description} entityId={entity.id} />
                                : <span className="text-white/30 italic cursor-pointer">{canEditAttack ? 'Описание пустое. Дважды кликните для редактирования.' : 'Описание пустое.'}</span>}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'canvas' && (
                <EntityCanvasTokenSettings entity={entity} canEdit={canEditAttack} />
            )}
        </div>
    );
}
