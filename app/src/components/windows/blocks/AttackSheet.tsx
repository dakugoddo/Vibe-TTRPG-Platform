import { useState } from 'react';
import { yjsStore } from '../../../store/yjsStore';
import { useEntities } from '../../../hooks/useEntities';
import { useWindowStore } from '../../../store/windowStore';
import { rollEntityActionToChat } from '../../../services/entityActionRoll';
import type { Entity } from '../../../types';
import { Box, Check, Dices, Edit2, FileText, Plus, SlidersHorizontal, Trash2, Tag } from 'lucide-react';
import { EntityLink } from '../../ui/EntityLink';
import { MarkdownRenderer } from '../../ui/MarkdownRenderer';
import { SheetTabs, type SheetTab } from '../../ui/SheetTabs';
import { TagPickerPopup } from './TagPickerPopup';
import { WikiLinkTextarea } from '../../ui/WikiLinkTextarea';
import { glass } from '../../../utils/theme';
import { getAttackFormula } from '../../../utils/entityActionRollModel';
import { EntityCanvasTokenSettings } from './EntityCanvasTokenSettings';

interface AttackSheetProps {
    entity: Entity;
}

type AttackTab = 'stats' | 'description' | 'canvas';

const DISTANCES = ['ближняя', 'средняя', 'дальняя', 'экстремальная', 'запредельная'];
const attackPanelClass = `${glass.blockBg} border-[color-mix(in_srgb,var(--vibe-danger)_28%,var(--vibe-border-subtle))] shadow-[inset_0_0_20px_color-mix(in_srgb,var(--vibe-danger)_8%,transparent)]`;
const statCardClass = 'group flex flex-col items-center rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-2 shadow-sm transition-all hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]';
const statLabelClass = 'mb-1 cursor-pointer text-[10px] font-bold uppercase text-[var(--vibe-text-faint)] transition-colors hover:text-[var(--vibe-text-primary)]';
const statInputClass = 'w-full bg-transparent text-center text-lg font-bold text-[var(--vibe-text-primary)] outline-none transition-colors group-hover:text-[var(--vibe-danger)]';
const tagPillClass = 'group/tag flex items-center overflow-hidden rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] shadow-[var(--vibe-shadow-block)] transition-colors hover:border-[color-mix(in_srgb,var(--vibe-danger)_42%,var(--vibe-border-strong))]';

function getEntityOwnerId(entity: Entity): string | undefined {
    const owner = entity.properties?._playerOwner;
    return typeof owner === 'string' ? owner : undefined;
}

function canEditEntity(entity: Entity): boolean {
    return yjsStore.canModify(entity.database, getEntityOwnerId(entity));
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
                        className={`grid h-8 w-8 place-items-center rounded-[var(--vibe-radius-sm)] transition-colors ${isEditingDescription ? glass.iconButtonActive : glass.iconButton}`}
                        title={isEditingDescription ? 'Завершить редактирование' : 'Редактировать описание'}
                    >
                        {isEditingDescription ? <Check size={14} /> : <Edit2 size={14} />}
                    </button>
                ) : null}
            />

            {activeTab === 'stats' && (
                <>
            <div className={attackPanelClass}>
                <h3 className={`${glass.blockHeader} mb-3 border-[color-mix(in_srgb,var(--vibe-danger)_28%,transparent)] text-[var(--vibe-danger)]`}>
                    Характеристики Атаки
                </h3>

                <div className="grid grid-cols-2 gap-3">
                    {/* Урон */}
                    <div className={statCardClass}>
                        <span
                            className={statLabelClass}
                            onClick={() => handleOpenNote('Урон')}
                        >
                            Урон
                        </span>
                        <input
                            type="number"
                            value={entity.properties.урон ?? 1}
                            readOnly={!canEditAttack}
                            onChange={(e) => updateProperty('урон', parseInt(e.target.value) || 0)}
                            className={statInputClass}
                            placeholder="0"
                        />
                    </div>

                    {/* Масштаб */}
                    <div className={statCardClass}>
                        <span
                            className={statLabelClass}
                            onClick={() => handleOpenNote('Масштаб')}
                        >
                            Масштаб
                        </span>
                        <input
                            type="number"
                            value={entity.properties.масштаб ?? 1}
                            readOnly={!canEditAttack}
                            onChange={(e) => updateProperty('масштаб', parseInt(e.target.value) || 0)}
                            className={statInputClass}
                            placeholder="0"
                        />
                    </div>

                    {/* Попадание */}
                    <div className={statCardClass}>
                        <span
                            className={statLabelClass}
                            onClick={() => handleOpenNote('Попадание')}
                        >
                            Попадание
                        </span>
                        <input
                            type="number"
                            value={entity.properties.попадание ?? 1}
                            readOnly={!canEditAttack}
                            onChange={(e) => updateProperty('попадание', parseInt(e.target.value) || 0)}
                            className={statInputClass}
                            placeholder="0"
                        />
                    </div>

                    {/* Дистанция */}
                    <div className={`${statCardClass} justify-center`}>
                        <span
                            className={`${statLabelClass} text-center`}
                            onClick={() => handleOpenNote('Дистанция')}
                        >
                            Дистанция
                        </span>
                        <select
                            value={entity.properties.дистанция || DISTANCES[0]}
                            disabled={!canEditAttack}
                            onChange={(e) => updateProperty('дистанция', e.target.value)}
                            className={`${glass.input} w-full cursor-pointer appearance-none p-1 text-center text-xs font-bold`}
                        >
                            {DISTANCES.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>

                    <div className="group col-span-2 flex flex-col gap-1.5 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-danger)_28%,var(--vibe-border-subtle))] bg-[var(--vibe-surface-input)] p-2 shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--vibe-danger)_42%,var(--vibe-border-strong))] hover:bg-[var(--vibe-surface-hover)]">
                        <span className="text-[10px] font-bold uppercase text-[color-mix(in_srgb,var(--vibe-danger)_78%,var(--vibe-text-muted))]">
                            Формула броска
                        </span>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={rollFormula}
                                readOnly={!canEditAttack}
                                onChange={(e) => updateProperty('diceFormula', e.target.value)}
                                className={`${glass.input} min-w-0 flex-1 rounded-[var(--vibe-radius-sm)] p-1.5 font-mono text-xs read-only:cursor-default read-only:text-[var(--vibe-text-faint)]`}
                                placeholder="1d20+2 / 2d6"
                            />
                            <button
                                type="button"
                                onClick={() => rollEntityActionToChat(entity, 'attack', parentEntity ? [parentEntity] : [])}
                                disabled={!canRoll}
                                className={`grid h-8 w-8 place-items-center rounded-[var(--vibe-radius-sm)] border transition-all ${canRoll ? 'border-[color-mix(in_srgb,var(--vibe-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--vibe-danger)_18%,transparent)] text-[var(--vibe-danger)] hover:bg-[color-mix(in_srgb,var(--vibe-danger)_28%,transparent)]' : 'cursor-not-allowed border-transparent bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)]'}`}
                                title={canRoll ? `Бросить ${rollFormula}` : 'Укажите формулу броска'}
                            >
                                <Dices size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ПРОПЕРТИЗ БЛОК (Свойства) */}
            <div className={attackPanelClass}>
                <div className="flex items-center justify-between mb-4">
                    <h4 className={`${glass.blockHeader} mb-0 border-[color-mix(in_srgb,var(--vibe-danger)_28%,transparent)] text-[var(--vibe-danger)]`}>
                        <Tag size={14} className="mr-2" />
                        Свойства
                    </h4>

                    {canEditAttack && (
                        <>
                            <button
                                className="flex items-center gap-1 rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)] transition-all hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
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
                            <div key={tagId} className={tagPillClass}>
                                <EntityLink entityId={tagId} underline={false} className="whitespace-nowrap px-2 py-1 text-xs font-medium text-[var(--vibe-text-muted)] hover:text-[var(--vibe-danger)]" />
                                {canEditAttack && (
                                    <button
                                        onClick={() => {
                                            const newTags = entity.tags.filter(id => id !== tagId);
                                            yjsStore.updateEntity(entity.id, { tags: newTags });
                                        }}
                                        className="border-l border-[var(--vibe-border-subtle)] px-2 py-1 text-[var(--vibe-text-faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-danger)_18%,transparent)] hover:text-[var(--vibe-danger)] group-hover/tag:border-[color-mix(in_srgb,var(--vibe-danger)_42%,var(--vibe-border-strong))]"
                                        title="Убрать"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </div>
                        )
                    }) : <span className="text-xs italic text-[var(--vibe-text-faint)]">Нет свойств</span>}
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
                        <div className="min-h-[180px] text-sm leading-relaxed text-[var(--vibe-text-muted)]" onDoubleClick={() => { if (canEditAttack) setIsEditingDescription(true); }}>
                            {entity.description
                                ? <MarkdownRenderer content={entity.description} entityId={entity.id} />
                                : <span className="cursor-pointer italic text-[var(--vibe-text-faint)]">{canEditAttack ? 'Описание пустое. Дважды кликните для редактирования.' : 'Описание пустое.'}</span>}
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
