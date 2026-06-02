import React, { useState } from 'react';
import { yjsStore } from '../../../store/yjsStore';
import { useEntities } from '../../../hooks/useEntities';
import { useWindowStore } from '../../../store/windowStore';
import { rollEngine } from '../../../services/rollEngine';
import type { Entity } from '../../../types';
import { Box, Check, Dices, Edit2, FileText, GripVertical, Package, Plus, Swords, Trash2, Tag } from 'lucide-react';
import { EntityLink } from '../../ui/EntityLink';
import { MarkdownRenderer } from '../../ui/MarkdownRenderer';
import { SheetTabs, type SheetTab } from '../../ui/SheetTabs';
import { WikiLinkTextarea } from '../../ui/WikiLinkTextarea';
import { TagPickerPopup } from './TagPickerPopup';
import { DragDropPopover, type DragDropPromptData } from '../../ui/DragDropPopover';
import { useUIStore } from '../../../store/uiStore';
import { glass } from '../../../utils/theme';
import { generateEntityId } from '../../../utils/entityId';
import { createEntityRollVariableResolver } from '../../../utils/rollVariables';
import { EntityCanvasTokenSettings } from './EntityCanvasTokenSettings';
import { getEntityDropActions } from '../../../utils/entityDropRouter';
import { readEntityDragIds } from '../../../utils/entityDragPayload';
import { applyOwnerToEntityTree, getEntityOwnerId, moveEntityTreeToParent } from '../../../utils/entityTreeMutations';
import { getTopLevelEntityIds } from '../../../utils/entityTreeSelection';

interface ObjectSheetProps {
    entity: Entity;
}

type ObjectTab = 'stats' | 'attacks' | 'description' | 'canvas';

const CATEGORIES = ['оружие', 'броня', 'расходуемое', 'другое'];
const statCardClass = 'group flex flex-col items-center rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-2 shadow-sm transition-all hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]';
const statLabelClass = 'mb-1 cursor-pointer text-[10px] font-bold uppercase text-[var(--vibe-text-faint)] transition-colors hover:text-[var(--vibe-text-primary)]';
const statInputClass = 'w-full bg-transparent text-center text-lg font-bold text-[var(--vibe-text-primary)] outline-none transition-colors group-hover:text-[var(--vibe-accent)]';
const attackPanelClass = `${glass.blockBg} border-[color-mix(in_srgb,var(--vibe-danger)_28%,var(--vibe-border-subtle))] shadow-[inset_0_0_20px_color-mix(in_srgb,var(--vibe-danger)_8%,transparent)]`;
const tagPillClass = 'group/tag flex items-center overflow-hidden rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] shadow-[var(--vibe-shadow-block)] transition-colors hover:border-[var(--vibe-border-strong)]';

function canEditEntity(entity: Entity): boolean {
    return yjsStore.canModify(entity.database, getEntityOwnerId(entity));
}

function stringifyProperty(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
}

function getAttackFormula(attack: Entity): string {
    return stringifyProperty(attack.properties?.diceFormula ?? attack.properties?.dice).trim();
}

function sendAttackRollToChat(attack: Entity, parentObject?: Entity) {
    const formula = getAttackFormula(attack);
    if (!formula) return;

    const result = rollEngine.rollExpression(formula, {
        plainNumberAsD6Pool: true,
        resolveVariable: createEntityRollVariableResolver(attack, parentObject ? [parentObject] : []),
    });
    if (result.error) {
        yjsStore.sendMessage(`Ошибка броска ${attack.name}: ${result.error}`, 'Система', true);
        return;
    }

    yjsStore.sendMessage(rollEngine.formatRollMessage(`${attack.name}: ${formula}`, result), 'Система', true);
}

export function ObjectSheet({ entity }: ObjectSheetProps) {
    const allEntities = useEntities();
    const { openWindow } = useWindowStore();
    const { openConfirm } = useUIStore();
    const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
    const [dragDropPrompt, setDragDropPrompt] = useState<DragDropPromptData | null>(null);
    const [activeTab, setActiveTab] = useState<ObjectTab>('stats');
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const canEditObject = canEditEntity(entity);

    // Find child attacks
    const attacks = allEntities.filter(e => e.parentId === entity.id && e.type === 'attack');
    const tabs: SheetTab<ObjectTab>[] = [
        { id: 'stats', label: 'Параметры', icon: Package },
        { id: 'attacks', label: 'Атаки', badge: attacks.length, icon: Swords },
        { id: 'description', label: 'Описание', icon: FileText },
        { id: 'canvas', label: 'Настройки', icon: Box },
    ];

    const updateProperty = (key: string, value: unknown) => {
        if (!canEditObject) return;
        yjsStore.updateEntity(entity.id, {
            properties: {
                ...entity.properties,
                [key]: value
            }
        });
    };

    const updateDescription = (value: string) => {
        if (!canEditObject) return;
        yjsStore.updateEntity(entity.id, { description: value });
    };

    const handleCreateAttack = () => {
        if (!canEditObject) return;
        const id = generateEntityId(allEntities.map(entity => entity.id));
        const ownerId = getEntityOwnerId(entity);
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
                дистанция: 'ближняя',
                diceFormula: '',
                ...(ownerId ? { _playerOwner: ownerId } : {})
            }
        };
        yjsStore.addEntity(newAttack);
    };

    const handleRootDrop = (e: React.DragEvent) => {
        if (!canEditObject) return;
        e.preventDefault();
        e.stopPropagation();
        const draggedIds = getTopLevelEntityIds(readEntityDragIds(e.dataTransfer), allEntities);
        const draggedEntities = draggedIds
            .map(id => allEntities.find(ent => ent.id === id))
            .filter((candidate): candidate is Entity => Boolean(candidate));
        if (draggedEntities.length === 0 || draggedEntities.length !== draggedIds.length || draggedEntities.some(draggedEnt => draggedEnt.type !== 'attack' || draggedEnt.id === entity.id)) return;

        const actionsByEntity = draggedEntities.map(draggedEnt => getEntityDropActions(
            {
                id: draggedEnt.id,
                type: draggedEnt.type,
                database: draggedEnt.database,
                parentId: draggedEnt.parentId,
            },
            { kind: 'entity', entityId: entity.id, entityType: entity.type, slot: 'attacks' },
            {
                role: yjsStore.localRole,
                canModifySource: canEditEntity(draggedEnt),
                canModifyTarget: canEditObject,
            }
        ));
        const moveAction = actionsByEntity[0]?.find(action => action.id === 'move-entity');
        const copyAction = actionsByEntity[0]?.find(action => action.id === 'copy-entity');
        const canMoveAll = Boolean(moveAction) && actionsByEntity.every(actions => actions.some(action => action.id === 'move-entity'));
        const canCopyAll = Boolean(copyAction) && actionsByEntity.every(actions => actions.some(action => action.id === 'copy-entity'));
        if (!canMoveAll && !canCopyAll) return;

        setDragDropPrompt({
            x: e.clientX,
            y: e.clientY,
            entityName: draggedEntities.length === 1 ? draggedEntities[0].name : `${draggedEntities.length} сущностей`,
            canMove: canMoveAll,
            canCopy: canCopyAll,
            moveLabel: moveAction?.label,
            copyLabel: copyAction?.label,
            onMove: () => {
                if (!canMoveAll || !canEditObject) {
                    setDragDropPrompt(null);
                    return;
                }
                const ownerId = getEntityOwnerId(entity);
                draggedEntities.forEach((draggedEnt) => {
                    if (!canEditEntity(draggedEnt)) return;
                    moveEntityTreeToParent(draggedEnt.id, entity.id, entity.database, { ownerId });
                });
                setDragDropPrompt(null);
            },
            onCopy: () => {
                if (!canCopyAll || !canEditObject) {
                    setDragDropPrompt(null);
                    return;
                }
                const ownerId = getEntityOwnerId(entity);
                draggedEntities.forEach((draggedEnt) => {
                    const newId = yjsStore.cloneEntity(draggedEnt.id, entity.id, entity.database);
                    if (newId) applyOwnerToEntityTree(newId, ownerId);
                });
                setDragDropPrompt(null);
            },
            onCancel: () => setDragDropPrompt(null)
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
        <div className="space-y-6 animate-in fade-in duration-200 mt-4 relative">
            {dragDropPrompt && (
                <DragDropPopover
                    data={dragDropPrompt}
                />
            )}

            <SheetTabs
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
                endSlot={activeTab === 'description' && canEditObject ? (
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
                    {/* Базовые параметры */}
                    <div className={`${glass.blockBg}`}>
                        <h3 className={glass.blockHeader}>
                            Характеристики Предмета
                        </h3>

                <div className="grid grid-cols-3 gap-3">
                    {/* Категория (для инвентаря персонажа) */}
                    <div className={`${statCardClass} col-span-3 justify-center`}>
                        <span className="mb-1 text-[10px] font-bold uppercase text-[var(--vibe-text-faint)]">Категория (Тип)</span>
                        <div className={`${glass.tabBar} flex rounded-[var(--vibe-radius-sm)] p-1`}>
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => updateProperty('category', cat)}
                                    disabled={!canEditObject}
                                    className={`flex-1 rounded-[var(--vibe-radius-sm)] px-1 py-1 text-[10px] font-bold uppercase tracking-wider transition-all disabled:cursor-default ${(entity.properties.category || 'другое') === cat ? glass.tabActive : glass.tabIdle}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={statCardClass}>
                        <span
                            className={statLabelClass}
                            title="Размер в единицах: 1,2,3,4..."
                            onClick={() => handleOpenNote('Фигура')}
                        >
                            Фигура
                        </span>
                        <input
                            type="number" min="0" step="1"
                            value={entity.properties.фигура ?? 1}
                            readOnly={!canEditObject}
                            onChange={(e) => updateProperty('фигура', parseInt(e.target.value) || 0)}
                            className={statInputClass}
                        />
                    </div>
                    <div className={statCardClass}>
                        <span
                            className={statLabelClass}
                            onClick={() => handleOpenNote('Прочность')}
                        >
                            Прочность
                        </span>
                        <input
                            type="number" min="0" step="1"
                            value={entity.properties.прочность ?? 1}
                            readOnly={!canEditObject}
                            onChange={(e) => updateProperty('прочность', parseInt(e.target.value) || 0)}
                            className={statInputClass}
                        />
                    </div>
                    <div className={statCardClass}>
                        <span
                            className={statLabelClass}
                            onClick={() => handleOpenNote('Нагрузка')}
                        >
                            Нагрузка (Вес)
                        </span>
                        <input
                            type="number" min="0" step="0.1"
                            value={entity.properties.нагрузка ?? 1.0}
                            readOnly={!canEditObject}
                            onChange={(e) => updateProperty('нагрузка', parseFloat(e.target.value) || 0)}
                            className={statInputClass}
                        />
                    </div>
                    <div className={statCardClass}>
                        <span
                            className={statLabelClass}
                            title="Ранг от 0 до 5"
                            onClick={() => handleOpenNote('Редкость')}
                        >
                            Редкость
                        </span>
                        <input
                            type="number" min="0" max="5" step="1"
                            value={entity.properties.редкость ?? 0}
                            readOnly={!canEditObject}
                            onChange={(e) => updateProperty('редкость', parseInt(e.target.value) || 0)}
                            className={statInputClass}
                        />
                    </div>
                    <div className="group col-span-2 flex flex-col items-center rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-warning)_28%,var(--vibe-border-subtle))] bg-[color-mix(in_srgb,var(--vibe-warning)_8%,var(--vibe-surface-input))] p-2 shadow-sm transition-all hover:bg-[color-mix(in_srgb,var(--vibe-warning)_12%,var(--vibe-surface-hover))]">
                        <span
                            className="mb-1 cursor-pointer text-[10px] font-bold uppercase text-[var(--vibe-warning)] transition-colors hover:brightness-125"
                            onClick={() => handleOpenNote('Цена')}
                        >
                            Цена (У.Е.)
                        </span>
                        <input
                            type="number" min="0" step="1"
                            value={entity.properties.цена ?? 0}
                            readOnly={!canEditObject}
                            onChange={(e) => updateProperty('цена', parseInt(e.target.value) || 0)}
                            className="w-full bg-transparent text-center text-xl font-bold text-[var(--vibe-warning)] outline-none transition-colors group-hover:brightness-125"
                            placeholder="0"
                        />
                    </div>
                    </div>
                    </div>

                    {/* ПРОПЕРТИЗ БЛОК (Свойства) */}
                    <div className={glass.blockBg}>
                        <div className="flex items-center justify-between mb-4">
                            <h4 className={glass.blockHeader + " mb-0"}>
                                <Tag size={14} className="mr-2" />
                                Свойства
                            </h4>

                    {canEditObject && (
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
                                    if (!canEditObject) return;
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

                                // Show all tags, or if there's a strict folder, you might filter.
                                // But since users might assign general tags, let's show anyway.

                                return (
                                    <div key={tagId} className={tagPillClass}>
                                        <EntityLink entityId={tagId} underline={false} className="whitespace-nowrap px-2 py-1 text-xs font-medium text-[var(--vibe-text-muted)] hover:text-[var(--vibe-text-primary)]" />
                                        {canEditObject && (
                                            <button
                                                onClick={() => {
                                                    const newTags = entity.tags.filter(id => id !== tagId);
                                                    yjsStore.updateEntity(entity.id, { tags: newTags });
                                                }}
                                                className="border-l border-[var(--vibe-border-subtle)] px-2 py-1 text-[var(--vibe-text-faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-danger)_18%,transparent)] hover:text-[var(--vibe-danger)] group-hover/tag:border-[var(--vibe-border-strong)]"
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

            {/* Список Атак внутри предмета */}
            {activeTab === 'attacks' && (
                <div
                    data-entity-drop-target="true"
                    data-entity-id={entity.id}
                    data-entity-slot="attacks"
                    data-entity-accepts="attack"
                    className={`${attackPanelClass} min-h-[100px]`}
                    onDragOver={(e) => { if (canEditObject) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
                    onDrop={handleRootDrop}
                >
                    <div className="flex items-center justify-between mb-3">
                        <h3 className={`${glass.blockHeader} mb-0 border-[color-mix(in_srgb,var(--vibe-danger)_28%,transparent)] text-[var(--vibe-danger)]`}>
                            Встроенные Атаки
                        </h3>
                        {canEditObject && (
                            <button
                                onClick={handleCreateAttack}
                                className="flex items-center gap-1 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-danger)_32%,transparent)] bg-[color-mix(in_srgb,var(--vibe-danger)_16%,transparent)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-danger)_26%,transparent)]"
                            >
                                <Plus size={10} /> Добавить
                            </button>
                        )}
                    </div>

                <div className="space-y-2">
                    {attacks.length === 0 ? (
                        <div className="pointer-events-none py-4 text-center text-xs italic text-[var(--vibe-text-faint)]">
                            {canEditObject ? 'Перетащите атаки сюда или создайте новую' : 'Встроенные атаки пока не добавлены'}
                        </div>
                    ) : (
                        attacks.map(attack => {
                            const canEditAttack = canEditObject && canEditEntity(attack);
                            const formula = getAttackFormula(attack);
                            const canRoll = formula.length > 0;

                            return (
                                <div key={attack.id} className="group/atk flex items-center gap-3 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-2 shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--vibe-danger)_42%,var(--vibe-border-strong))] hover:bg-[var(--vibe-surface-hover)]">
                                {canEditAttack && (
                                    <div className="cursor-move text-[color-mix(in_srgb,var(--vibe-danger)_74%,var(--vibe-text-muted))] hover:text-[var(--vibe-danger)]" draggable={true} onDragStart={(e) => { e.dataTransfer.setData("application/entity-id", attack.id); e.dataTransfer.effectAllowed = "move"; }}>
                                        <GripVertical size={14} />
                                    </div>
                                )}
                                <div className="flex-1 overflow-hidden pointer-events-none">
                                    <EntityLink entityId={attack.id} className="pointer-events-auto block truncate text-sm font-bold text-[var(--vibe-text-primary)] transition-colors hover:text-[var(--vibe-danger)]" underline={false} />
                                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-[var(--vibe-text-muted)]">
                                        <span title="Урон">🗡️ <span className="font-bold text-[var(--vibe-text-primary)]">{attack.properties.урон ?? 1}</span></span>
                                        <span title="Масштаб">📏 <span className="font-bold text-[var(--vibe-text-primary)]">{attack.properties.масштаб ?? 1}</span></span>
                                        <span title="Попадание">🎯 <span className="font-bold text-[var(--vibe-text-primary)]">{attack.properties.попадание ?? 1}</span></span>
                                        <span title="Дистанция" className="uppercase text-[var(--vibe-danger)]">({attack.properties.дистанция ?? 'ближняя'})</span>
                                        {formula && <span title="Формула броска" className="text-[var(--vibe-success)]">🎲 {formula}</span>}
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        sendAttackRollToChat(attack, entity);
                                    }}
                                    disabled={!canRoll}
                                    className={`flex-shrink-0 rounded-[var(--vibe-radius-sm)] border p-1.5 transition-all ${canRoll ? 'border-[color-mix(in_srgb,var(--vibe-danger)_32%,transparent)] bg-[color-mix(in_srgb,var(--vibe-danger)_16%,transparent)] text-[var(--vibe-danger)] hover:bg-[color-mix(in_srgb,var(--vibe-danger)_26%,transparent)]' : 'cursor-not-allowed border-transparent bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)]'}`}
                                    title={canRoll ? `Бросить ${formula}` : 'У атаки нет формулы броска'}
                                >
                                    <Dices size={14} />
                                </button>
                                {canEditAttack && (
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
                                        className="rounded-[var(--vibe-radius-sm)] p-1.5 text-[var(--vibe-text-faint)] opacity-0 transition-colors hover:text-[var(--vibe-danger)] group-hover/atk:opacity-100"
                                        title="Удалить атаку"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                                </div>
                            );
                        })
                    )}
                </div>
                </div>
            )}

            {activeTab === 'description' && (
                <div className={`${glass.blockBg} min-h-[220px]`}>
                    <h3 className={glass.blockHeader}>
                        Описание
                    </h3>

                    {isEditingDescription && canEditObject ? (
                        <WikiLinkTextarea
                            value={entity.description || ''}
                            onValueChange={updateDescription}
                            excludeEntityId={entity.id}
                            className={`${glass.input} w-full min-h-[180px] resize-y custom-scrollbar text-sm font-sans`}
                            placeholder="Описание предмета, правила, заметки..."
                            autoFocus
                        />
                    ) : (
                        <div className="min-h-[180px] text-sm leading-relaxed text-[var(--vibe-text-muted)]" onDoubleClick={() => { if (canEditObject) setIsEditingDescription(true); }}>
                            {entity.description
                                ? <MarkdownRenderer content={entity.description} entityId={entity.id} />
                                : <span className="cursor-pointer italic text-[var(--vibe-text-faint)]">{canEditObject ? 'Описание пустое. Дважды кликните для редактирования.' : 'Описание пустое.'}</span>}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'canvas' && (
                <EntityCanvasTokenSettings entity={entity} canEdit={canEditObject} />
            )}
        </div>
    );
}
