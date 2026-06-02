import { Rnd } from 'react-rnd';
import { Minimize2, X, CircleDot, Pin, PinOff, Bug, Plus, Tag, Trash2, Edit2, Check, Link2, CornerDownRight, Network, Copy, Box, FileText, Lightbulb, Sword, Wand2, LayoutGrid, PanelLeft, PanelRight, Crosshair, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useWindowStore } from '../../store/windowStore';
import type { WindowState, WindowMode } from '../../store/windowStore';
import type { Entity, EntityType } from '../../types';
import { useEntity, useEntities, getEntitiesSnapshot } from '../../hooks/useEntities';
import { useCanvasStore } from '../../store/canvasStore';
import { CharacterSheet } from './CharacterSheet';
import { yjsStore } from '../../store/yjsStore';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';
import { SheetTabs, type SheetTab } from '../ui/SheetTabs';
import { WikiLinkTextarea } from '../ui/WikiLinkTextarea';
import { useState, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';

interface ContextMenuState {
    x: number;
    y: number;
}
import { TagEditor } from './blocks/TagEditor';
import { TagPickerPopup } from './blocks/TagPickerPopup';
import { EntityLink } from '../ui/EntityLink';
import { EntityImageBlock } from './blocks/EntityImageBlock';
import { EntityCanvasTokenSettings } from './blocks/EntityCanvasTokenSettings';
import { EntityGroups } from '../ui/EntityDatabase';
import { ObjectSheet } from './blocks/ObjectSheet';
import { AttackSheet } from './blocks/AttackSheet';
import { AbilitySheet } from './blocks/AbilitySheet';
import { useUIStore } from '../../store/uiStore';
import { glass } from '../../utils/theme';
import { canViewEntity } from '../../utils/permissions';
import { writeClipboardText } from '../../utils/clipboard';
import { generateEntityId } from '../../utils/entityId';

interface EntityWindowProps {
    windowState: WindowState;
}

function getEntityOwnerId(entity: Entity): string | undefined {
    const owner = entity.properties?._playerOwner;
    return typeof owner === 'string' ? owner : undefined;
}

function canViewRelatedEntity(entity: Entity): boolean {
    return canViewEntity(
        yjsStore.localRole,
        entity.database,
        getEntityOwnerId(entity),
        yjsStore.localPlayerId,
        yjsStore.localPlayerName
    );
}

function normalizeWikiTarget(target: string): string {
    return target.split('|')[0].split('#')[0].trim().toLowerCase();
}

function hasWikiLinkToEntity(source: Entity, target: Entity): boolean {
    if (!source.description) return false;

    const normalizedTargets = new Set([
        target.id.trim().toLowerCase(),
        target.name.trim().toLowerCase(),
    ]);
    const wikiPattern = /\[\[([^\]]+)\]\]/g;
    let match: RegExpExecArray | null;

    while ((match = wikiPattern.exec(source.description)) !== null) {
        if (normalizedTargets.has(normalizeWikiTarget(match[1]))) {
            return true;
        }
    }

    return false;
}

const MAX_RELATION_LINKS = 8;

interface QuickCreateAction {
    type: EntityType;
    label: string;
    icon: LucideIcon;
}

type GenericEntityTab = 'description' | 'canvas';

function getWindowQuickCreateActions(entity: Entity): QuickCreateAction[] {
    if (entity.type === 'character') {
        return [
            { type: 'object', label: 'Создать предмет', icon: Box },
            { type: 'competency', label: 'Создать компетенцию', icon: Lightbulb },
            { type: 'ability', label: 'Создать способность', icon: Wand2 },
        ];
    }

    if (entity.type === 'object') {
        return [{ type: 'attack', label: 'Создать атаку', icon: Sword }];
    }

    return [];
}

function createChildEntityDraft(parent: Entity, type: EntityType): Entity {
    const owner = getEntityOwnerId(parent);
    const draft: Entity = {
        id: generateEntityId(Object.keys(getEntitiesSnapshot())),
        parentId: parent.id,
        type,
        database: parent.database,
        name: type,
        description: '',
        tags: [],
        properties: {},
    };

    if (type === 'object') {
        draft.name = 'object';
        draft.description = 'Новый предмет.';
        draft.properties = { фигура: 1, прочность: 1, нагрузка: 1, редкость: 0, цена: 0 };
    } else if (type === 'attack') {
        draft.name = 'attack';
        draft.description = 'Новая атака.';
        draft.properties = { урон: 1, масштаб: 1, попадание: 1, дистанция: 'ближняя' };
    } else if (type === 'competency') {
        draft.name = 'competency';
        draft.description = 'Новая компетенция.';
        draft.properties = { rank: 0 };
    } else if (type === 'ability') {
        draft.name = 'ability';
        draft.description = 'Новая способность.';
        draft.properties = { cost: { base: 0 }, diceFormula: '' };
    }

    if (parent.database === 'user' && owner) {
        draft.properties = { ...draft.properties, _playerOwner: owner };
    }

    return draft;
}

function RelationPill({ entity }: { entity: Entity }) {
    const group = EntityGroups.find(g => g.type === entity.type);

    return (
        <EntityLink
            entityId={entity.id}
            underline={false}
            className="min-w-0 max-w-full rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2.5 py-1.5 text-xs text-[var(--vibe-text-muted)] hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
        >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${group?.dot || 'bg-[var(--vibe-text-faint)]'}`} />
            <span className="truncate">{entity.name}</span>
        </EntityLink>
    );
}

function EntityRelationsBlock({ entity }: { entity: Entity }) {
    const allEntities = useEntities();

    const sections = useMemo(() => {
        const visibleEntities = allEntities
            .filter(candidate => candidate.id !== 'root')
            .filter(canViewRelatedEntity);
        const byId = new Map(visibleEntities.map(candidate => [candidate.id, candidate]));
        const sortByName = (a: Entity, b: Entity) => a.name.localeCompare(b.name, 'ru');

        const parent = entity.parentId ? byId.get(entity.parentId) : undefined;
        const children = visibleEntities
            .filter(candidate => candidate.parentId === entity.id && candidate.id !== entity.id)
            .sort(sortByName);
        const tags = (entity.tags || [])
            .map(tagId => byId.get(tagId))
            .filter((candidate): candidate is Entity => Boolean(candidate))
            .sort(sortByName);
        const backlinks = visibleEntities
            .filter(candidate => candidate.id !== entity.id && hasWikiLinkToEntity(candidate, entity))
            .sort(sortByName);

        return [
            { id: 'parent', label: 'Parent', icon: Network, entities: parent ? [parent] : [] },
            { id: 'children', label: 'Children', icon: CornerDownRight, entities: children },
            { id: 'tags', label: 'Tags', icon: Tag, entities: tags },
            { id: 'backlinks', label: 'Backlinks', icon: Link2, entities: backlinks },
        ].filter(section => section.entities.length > 0);
    }, [allEntities, entity]);

    if (sections.length === 0) return null;

    return (
        <div className={`${glass.blockBg} mt-1`}>
            <h3 className={glass.blockHeader}>
                <div className="flex items-center gap-2">
                    <Link2 size={12} className="text-[var(--vibe-text-faint)]" />
                    Links
                </div>
            </h3>
            <div className="grid gap-3">
                {sections.map(section => {
                    const visibleLinks = section.entities.slice(0, MAX_RELATION_LINKS);
                    const hiddenCount = section.entities.length - visibleLinks.length;
                    const Icon = section.icon;

                    return (
                        <div key={section.id} className="grid gap-1.5">
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--vibe-text-faint)] font-bold">
                                <Icon size={11} className="text-[var(--vibe-text-faint)]" />
                                <span>{section.label}</span>
                                <span className="text-[var(--vibe-text-faint)]">({section.entities.length})</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 min-w-0">
                                {visibleLinks.map(relatedEntity => (
                                    <RelationPill key={`${section.id}-${relatedEntity.id}`} entity={relatedEntity} />
                                ))}
                                {hiddenCount > 0 && (
                                    <span className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2.5 py-1.5 text-xs text-[var(--vibe-text-faint)]">
                                        +{hiddenCount}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function EntityWindow({ windowState }: EntityWindowProps) {
    const { id, entityId, mode, x, y, width, height, zIndex, isPinned } = windowState;
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');
    const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
    const [genericTab, setGenericTab] = useState<GenericEntityTab>('description');
    const [layoutMenuState, setLayoutMenuState] = useState<ContextMenuState | null>(null);

    const entity = useEntity(entityId);
    const {
        focusWindow,
        closeWindow,
        updateWindow,
        setMode,
        togglePin,
        tileWindow,
        arrangeVisibleWindowsGrid,
        cascadeVisibleWindows,
        focusedWindowId,
        openWindow,
    } = useWindowStore();
    const stageScale = useCanvasStore(s => s.scale);
    const stageOffset = useCanvasStore(s => s.offset);
    const activeCanvasId = useCanvasStore(s => s.activeCanvasId);
    const { openConfirm } = useUIStore();

    const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null);

    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isEditingName]);

    if (!entity) return null; // Entity deleted while window was open
    const canEditCurrentEntity = yjsStore.canModify(entity.database, getEntityOwnerId(entity));

    const handleModeChange = (newMode: WindowMode) => {
        setMode(id, newMode);
        if (isPinned && canEditCurrentEntity) {
            yjsStore.updateEntity(entityId, {
                properties: { ...entity.properties, windowState: { ...entity.properties?.windowState, mode: newMode } }
            });
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setLayoutMenuState(null);
        if (!canEditCurrentEntity) {
            handleCopyWikiLink();
            return;
        }
        setContextMenuState({ x: e.clientX, y: e.clientY });
    };

    const handleCopyWikiLink = () => {
        setContextMenuState(null);
        void writeClipboardText(`[[${entity.id}]]`).catch((error) => {
            console.warn(`Failed to copy wiki link for "${entity.name}"`, error);
        });
    };

    const handleDuplicateEntity = () => {
        setContextMenuState(null);
        if (!canEditCurrentEntity || entity.id === 'root') return;

        const cloneId = yjsStore.cloneEntity(entity.id, entity.parentId, entity.database);
        if (cloneId) {
            openWindow(cloneId, x + 36, y + 36);
        }
    };

    const handleCreateChildEntity = (type: EntityType) => {
        setContextMenuState(null);
        if (!canEditCurrentEntity || entity.id === 'root') return;

        const child = createChildEntityDraft(entity, type);
        if (yjsStore.addEntity(child)) {
            openWindow(child.id, x + 72, y + 72);
        }
    };

    const handleRenameSubmit = () => {
        if (canEditCurrentEntity && tempName.trim() !== '') {
            yjsStore.updateEntity(entityId, { name: tempName });
        }
        setIsEditingName(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleRenameSubmit();
        if (e.key === 'Escape') setIsEditingName(false);
    };

    const handleTitleClick = () => {
        if (entity.type === 'note') return; // Notes don't open themselves

        const allEnts = getEntitiesSnapshot();
        const note = Object.values(allEnts).find(en => en.type === 'note' && en.name.toLowerCase() === entity.name.toLowerCase());
        if (note) {
            openWindow(note.id, x + 50, y + 50);
        }
    };

    const displayX = x;
    const displayY = y;

    const handleDragStop = (event: unknown, d: { x: number, y: number }) => {
        void event;
        const newX = d.x;
        const newY = d.y;
        updateWindow(id, { x: newX, y: newY });
        if (isPinned && canEditCurrentEntity) {
            yjsStore.updateEntity(entityId, {
                properties: { ...entity.properties, windowState: { ...entity.properties?.windowState, x: newX, y: newY } }
            });
        }
    };

    const handleResizeStop = (
        event: unknown,
        direction: unknown,
        ref: HTMLElement,
        delta: unknown,
        position: { x: number, y: number }
    ) => {
        void event;
        void direction;
        void delta;
        const newX = position.x;
        const newY = position.y;
        const newWidth = parseInt(ref.style.width, 10);
        const newHeight = parseInt(ref.style.height, 10);

        updateWindow(id, {
            width: newWidth,
            height: newHeight,
            x: newX,
            y: newY,
        });
        if (isPinned && canEditCurrentEntity) {
            yjsStore.updateEntity(entityId, {
                properties: { ...entity.properties, windowState: { ...entity.properties?.windowState, x: newX, y: newY, width: newWidth, height: newHeight } }
            });
        }
    };

    const customRndStyle: React.CSSProperties = {
        zIndex,
        position: 'absolute',
        pointerEvents: 'auto',
    };

    if (mode === 'icon') {
        return (
            <Rnd
                size={{ width: 64, height: 64 }}
                position={{ x: displayX, y: displayY }}
                onDragStop={handleDragStop}
                onMouseDown={() => focusWindow(id)}
                onDoubleClick={() => handleModeChange('compact')}
                enableResizing={false}
                style={customRndStyle}
                scale={isPinned ? stageScale : 1}
            >
                <div
                    data-canvas-drop-blocker="true"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    className={`tooltip-trigger relative flex h-16 w-16 cursor-pointer flex-col items-center justify-center border-2 border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-window)] shadow-[var(--vibe-shadow-block)] backdrop-blur-[var(--vibe-backdrop-blur)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] group ${isPinned ? 'rounded-full' : 'rounded-[var(--vibe-radius-lg)]'}`}
                >
                    <CircleDot size={20} className="mb-1 text-[var(--vibe-text-primary)]" />
                    <span className="w-14 truncate px-1 text-center text-[10px] font-bold text-[var(--vibe-text-primary)]">
                        {entity.name}
                    </span>
                    <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-window)] px-2 py-1 text-xs text-[var(--vibe-text-primary)] opacity-0 shadow-[var(--vibe-shadow-block)] backdrop-blur-[var(--vibe-backdrop-blur)] transition-opacity group-hover:opacity-100">
                        {entity.name}
                    </div>
                </div>
            </Rnd>
        );
    }

    const isFullMode = mode === 'full';
    const group = EntityGroups.find(g => g.type === entity.type);

    const frameClass = `w-full h-full flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${glass.window} ${
        focusedWindowId === id ? '!border-[var(--vibe-border-strong)]' : ''
    } ${isPinned ? 'ring-2 ring-[color-mix(in_srgb,var(--vibe-warning)_45%,transparent)] outline outline-2 outline-[color-mix(in_srgb,var(--vibe-warning)_22%,transparent)]' : ''}`;
    const quickCreateActions = canEditCurrentEntity ? getWindowQuickCreateActions(entity) : [];
    const contextMenuWidth = 220;
    const contextMenuHeight = 230 + quickCreateActions.length * 36;
    const layoutMenuWidth = 220;
    const layoutMenuHeight = 380;
    const supportsCanvasTokenSettings = entity.type !== 'canvas' && entity.type !== 'folder';
    const usesSpecialTabbedSheet = entity.type === 'character' || entity.type === 'object' || entity.type === 'ability' || entity.type === 'attack';
    const genericTabs: SheetTab<GenericEntityTab>[] = [
        { id: 'description', label: 'Описание', icon: FileText },
        { id: 'canvas', label: 'Настройки', icon: Box },
    ];
    const headerBorderClass = focusedWindowId === id ? 'border-[var(--vibe-border-strong)]' : 'border-[var(--vibe-border-subtle)]';
    const iconActionClass = 'rounded-[var(--vibe-radius-sm)] p-1.5 text-[var(--vibe-text-muted)] transition-colors hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]';
    const editToggleClass = (isActive: boolean) => `grid h-8 w-8 place-items-center rounded-[var(--vibe-radius-sm)] border transition-colors ${
        isActive ? glass.tabActive : glass.tabIdle
    }`;
    const contextMenuItemClass = 'group flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--vibe-text-muted)] transition-colors hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]';
    const contextMenuIconClass = 'text-[var(--vibe-text-faint)] transition-colors group-hover:text-[var(--vibe-text-primary)]';
    const layoutMenuActions: Array<{ id: string; label: string; icon: LucideIcon; run: () => void }> = [
        { id: 'left', label: 'Левая половина', icon: PanelLeft, run: () => tileWindow(id, 'left') },
        { id: 'right', label: 'Правая половина', icon: PanelRight, run: () => tileWindow(id, 'right') },
        { id: 'top-left', label: 'Верхний левый угол', icon: LayoutGrid, run: () => tileWindow(id, 'topLeft') },
        { id: 'top-right', label: 'Верхний правый угол', icon: LayoutGrid, run: () => tileWindow(id, 'topRight') },
        { id: 'bottom-left', label: 'Нижний левый угол', icon: LayoutGrid, run: () => tileWindow(id, 'bottomLeft') },
        { id: 'bottom-right', label: 'Нижний правый угол', icon: LayoutGrid, run: () => tileWindow(id, 'bottomRight') },
        { id: 'center', label: 'Центр', icon: Crosshair, run: () => tileWindow(id, 'center') },
        { id: 'wide-center', label: 'Широкий центр', icon: Crosshair, run: () => tileWindow(id, 'wideCenter') },
        { id: 'grid', label: 'Разложить все окна сеткой', icon: LayoutGrid, run: arrangeVisibleWindowsGrid },
        { id: 'cascade', label: 'Каскадом', icon: Layers, run: cascadeVisibleWindows },
    ];

    return (
        <Rnd
            size={isFullMode
                ? { width: Math.max(width, 400), height: Math.max(height, 500) }
                : { width: Math.max(width, 300), height: Math.max(height, 200) }}
            position={{ x: displayX, y: displayY }}
            onDragStop={handleDragStop}
            onResizeStop={handleResizeStop}
            onMouseDown={() => focusWindow(id)}
            minWidth={isFullMode ? 400 : 300}
            minHeight={isFullMode ? 500 : 200}
            style={customRndStyle}
            dragHandleClassName="draggable-header"
            scale={isPinned ? stageScale : 1}
        >
            <div
                data-canvas-drop-blocker="true"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); }}
                className={frameClass}
            >
                {/* Header toolbar */}
                <div className={`draggable-header flex items-center justify-between cursor-move select-none relative group ${glass.header} transition-colors p-3 py-2 border-b-2 ${headerBorderClass}`}
                    onContextMenu={handleContextMenu}
                >
                    <div className="flex items-center gap-3 max-w-[60%] overflow-hidden group/title" onClick={handleTitleClick}>
                        {entity.icon_url ? (
                            <img src={entity.icon_url} alt="" className="w-5 h-5 rounded object-cover border border-[var(--vibe-border-subtle)] select-none pointer-events-none" />
                        ) : (
                            <span className={`w-2.5 h-2.5 rounded flex-shrink-0 relative ${group?.dot || 'bg-[var(--vibe-text-faint)]'}`}>
                                {isPinned && <span className="absolute -inset-1 animate-pulse rounded bg-[color-mix(in_srgb,var(--vibe-warning)_28%,transparent)]"></span>}
                            </span>
                        )}
                        {isEditingName ? (
                            <input
                                ref={nameInputRef}
                                type="text"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                onBlur={handleRenameSubmit}
                                onKeyDown={handleKeyDown}
                                className={`${glass.input} w-full px-1 py-0.5 text-sm font-bold`}
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span className={`${glass.titleText} truncate transition-colors cursor-pointer group-hover/title:text-[var(--vibe-text-primary)]`}>{entity.name}</span>
                        )}
                        {!isEditingName && (
                            <span className={`ml-1 flex-shrink-0 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${group?.text || 'text-[var(--vibe-text-faint)]'}`}>
                                {entity.type}
                            </span>
                        )}
                    </div>

                    {/* Custom context menu rendered via portal at end of file */}

                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isPinned) return;
                                setContextMenuState(null);
                                setLayoutMenuState({ x: e.clientX, y: e.clientY });
                            }}
                            disabled={isPinned}
                            className={`${iconActionClass} ${isPinned ? 'cursor-not-allowed opacity-45' : ''}`}
                            title={isPinned ? 'Раскладка доступна для экранных окон' : 'Раскладка окна'}
                        >
                            <LayoutGrid size={14} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const newIsPinned = !isPinned;

                                // Proper coordinate conversion to prevent UI jumping
                                let newX = x;
                                let newY = y;

                                if (newIsPinned) {
                                    // Screen to Canvas
                                    newX = (x - stageOffset.x) / stageScale;
                                    newY = (y - stageOffset.y) / stageScale;
                                } else {
                                    // Canvas to Screen
                                    newX = (x * stageScale) + stageOffset.x;
                                    newY = (y * stageScale) + stageOffset.y;

                                    // Keep on-screen after unpinning
                                    const wW = window.innerWidth;
                                    const wH = window.innerHeight;
                                    newX = Math.max(10, Math.min(newX, wW - 300));
                                    newY = Math.max(10, Math.min(newY, wH - 100));
                                }

                                togglePin(id, activeCanvasId);
                                updateWindow(id, { x: newX, y: newY, isPinned: newIsPinned, canvasId: newIsPinned ? activeCanvasId : undefined });

                                if (canEditCurrentEntity) {
                                    yjsStore.updateEntity(entityId, {
                                        properties: {
                                            ...entity.properties, windowState: {
                                                ...entity.properties?.windowState,
                                                isPinned: newIsPinned,
                                                canvasId: newIsPinned ? activeCanvasId : undefined,
                                                x: newX, y: newY, width, height, mode, zIndex
                                            }
                                        }
                                    });
                                }
                            }}
                            className={`${iconActionClass} ${isPinned ? 'bg-[color-mix(in_srgb,var(--vibe-warning)_18%,transparent)] text-[var(--vibe-warning)]' : ''}`}
                            title={isPinned ? 'Открепить от канваса' : 'Закрепить на канвасе'}
                        >
                            {isPinned ? <Pin size={14} /> : <PinOff size={14} />}
                        </button>
                        <div className="mx-1 h-4 w-px bg-[var(--vibe-border-subtle)]"></div>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleModeChange('icon'); }}
                            className={iconActionClass}
                            title="Свернуть в иконку"
                        >
                            <CircleDot size={14} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleModeChange(isFullMode ? 'compact' : 'full'); }}
                            className={iconActionClass}
                            title={isFullMode ? 'Обычный режим' : 'Технический режим: свойства, скрытые теги и System ID'}
                        >
                            {isFullMode ? <Minimize2 size={14} /> : <Bug size={14} />}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); closeWindow(id); }}
                            className="ml-1 rounded-[var(--vibe-radius-sm)] p-1.5 text-[var(--vibe-text-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-danger)_18%,transparent)] hover:text-[var(--vibe-danger)]"
                            title="Закрыть окно"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* Content Body */}
                <div className={`flex-1 overflow-y-auto custom-scrollbar flex flex-col p-0`}>
                    {/* The CharacterSheet and generic sheet blocks handle their own padding now to match glass.content if needed. 
                        We wrap them to ensure they use glass.content styling appropriately. */}
                    <div className={`${glass.content} flex-1`}>
                    <EntityImageBlock entity={entity} isWide={entity.type === 'canvas'} />
                    {entity.type === 'character' ? (
                        <>
                            <CharacterSheet entityId={entityId} isFullMode={isFullMode} />
                            <EntityRelationsBlock entity={entity} />
                        </>
                    ) : (
                        <>
                            {!usesSpecialTabbedSheet && (
                                <>
                                    {supportsCanvasTokenSettings && (
                                        <SheetTabs
                                            tabs={genericTabs}
                                            activeTab={genericTab}
                                            onChange={setGenericTab}
                                            endSlot={genericTab === 'description' && canEditCurrentEntity ? (
                                                <button
                                                    onClick={() => setIsEditingDescription(!isEditingDescription)}
                                                    className={editToggleClass(isEditingDescription)}
                                                    title={isEditingDescription ? 'Завершить редактирование' : 'Редактировать описание'}
                                                >
                                                    {isEditingDescription ? <Check size={14} /> : <Edit2 size={14} />}
                                                </button>
                                            ) : null}
                                        />
                                    )}

                                    {(!supportsCanvasTokenSettings || genericTab === 'description') && (
                                        <div className={glass.blockBg}>
                                            <h3 className={glass.blockHeader}>
                                                <div className="flex items-center gap-2 flex-1">
                                                    Description
                                                </div>
                                                {!supportsCanvasTokenSettings && canEditCurrentEntity && (
                                                    <button
                                                        onClick={() => setIsEditingDescription(!isEditingDescription)}
                                                        className={`rounded-[var(--vibe-radius-sm)] border p-1.5 transition-colors ${isEditingDescription ? glass.tabActive : glass.tabIdle}`}
                                                    >
                                                        {isEditingDescription ? <Check size={12} /> : <Edit2 size={12} />}
                                                    </button>
                                                )}
                                            </h3>

                                            {isEditingDescription && canEditCurrentEntity ? (
                                                <WikiLinkTextarea
                                                    value={entity.description || ''}
                                                    onValueChange={(value) => {
                                                        if (!canEditCurrentEntity) return;
                                                        yjsStore.updateEntity(entity.id, { description: value });
                                                    }}
                                                    excludeEntityId={entity.id}
                                                    className={`${glass.input} w-full h-32 resize-y flex-1 custom-scrollbar text-sm font-sans`}
                                                    placeholder="Type markdown description here..."
                                                    autoFocus
                                                />
                                            ) : (
                                                <div className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--vibe-text-muted)] flex-1 h-full min-h-[100px]" onDoubleClick={() => { if (canEditCurrentEntity) setIsEditingDescription(true); }}>
                                                    {entity.description
                                                        ? <MarkdownRenderer content={entity.description} entityId={entity.id} />
                                                        : <span className="cursor-pointer italic text-[var(--vibe-text-faint)]">{canEditCurrentEntity ? 'No description provided. Double click to edit.' : 'No description provided.'}</span>}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {supportsCanvasTokenSettings && genericTab === 'canvas' && (
                                        <EntityCanvasTokenSettings entity={entity} canEdit={canEditCurrentEntity} />
                                    )}
                                </>
                            )}

                            {entity.type === 'object' && (
                                <ObjectSheet entity={entity} />
                            )}

                            {entity.type === 'attack' && (
                                <AttackSheet entity={entity} />
                            )}

                            {entity.type === 'ability' && (
                                <AbilitySheet entity={entity} />
                            )}

                            <EntityRelationsBlock entity={entity} />

                            {isFullMode && (
                                <div className="space-y-4 animate-in fade-in duration-200 mt-6 slide-in-from-bottom-2">
                                    <div>
                                        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                            Properties
                                            <div className="h-px flex-1 bg-[var(--vibe-border-subtle)]"></div>
                                        </h3>
                                        <div className="overflow-x-auto rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3 font-mono text-xs text-[var(--vibe-success)] shadow-[var(--vibe-shadow-block)] custom-scrollbar">
                                            {Object.keys(entity.properties || {}).length > 0
                                                ? JSON.stringify(entity.properties, null, 2)
                                                : <span className="text-[var(--vibe-text-faint)]">{"{}"} // No properties recorded</span>}
                                        </div>
                                    </div>

                                    {entity.type === 'tag' && canEditCurrentEntity && (
                                        <TagEditor entity={entity} />
                                    )}

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                                <Tag size={12} className="text-[var(--vibe-text-faint)]" />
                                                TAGS (Скрытые теги)
                                            </h3>
                                            <div className="ml-2 h-px flex-1 bg-[var(--vibe-border-subtle)]"></div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-xs">
                                            {entity.tags && entity.tags.length > 0 ? entity.tags.map(tagId => {
                                                const tagEntity = getEntitiesSnapshot()[tagId];
                                                return (
                                                    <div key={tagId} className="group/tag flex items-center overflow-hidden rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] transition-colors hover:border-[var(--vibe-border-strong)]">
                                                        <EntityLink entityId={tagId} underline={false} className="whitespace-nowrap px-2 py-1 font-medium text-[var(--vibe-text-muted)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]">
                                                            #{tagEntity ? tagEntity.name : 'Unknown Tag'}
                                                        </EntityLink>
                                                        {canEditCurrentEntity && (
                                                            <button
                                                                onClick={() => {
                                                                    const newTags = entity.tags.filter(id => id !== tagId);
                                                                    yjsStore.updateEntity(entity.id, { tags: newTags });
                                                                }}
                                                                className="border-l border-[var(--vibe-border-subtle)] px-1.5 py-1 text-[var(--vibe-text-faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-danger)_18%,transparent)] hover:text-[var(--vibe-danger)] group-hover/tag:border-[var(--vibe-border-strong)]"
                                                                title="Remove Tag"
                                                            >
                                                                <Trash2 size={10} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )
                                            }) : <span className="py-1 text-xs italic text-[var(--vibe-text-faint)]">Нет тегов</span>}

                                            {/* Add tag button */}
                                            {canEditCurrentEntity && (
                                                <>
                                                    <button
                                                        className="flex items-center gap-1 rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1 text-[var(--vibe-text-faint)] transition-all hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                                                        onClick={() => setIsTagPickerOpen(true)}
                                                    >
                                                        <Plus size={10} /> Добавить
                                                    </button>

                                                    <TagPickerPopup
                                                        isOpen={isTagPickerOpen}
                                                        onClose={() => setIsTagPickerOpen(false)}
                                                        onSelect={(tagId) => {
                                                            if (!canEditCurrentEntity) return;
                                                            const newTags = [...(entity.tags || []), tagId];
                                                            yjsStore.updateEntity(entity.id, { tags: newTags });
                                                        }}
                                                        excludeTags={entity.tags || []}
                                                        allowedFolders={['folder_tags_hidden']}
                                                        title="Прикрепить (Скрытые теги)"
                                                    />
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-auto flex items-center justify-between border-t border-[var(--vibe-border-subtle)] pt-4 text-xs text-[var(--vibe-text-faint)]">
                                        <span>System ID:</span>
                                        <span className="max-w-[200px] select-all truncate rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1 font-mono text-[10px] shadow-[var(--vibe-shadow-block)]">{entity.id}</span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    </div>
                </div>
            </div>
            {layoutMenuState && ReactDOM.createPortal(
                <>
                    <div
                        className="fixed inset-0 z-[99998]"
                        onClick={(e) => { e.stopPropagation(); setLayoutMenuState(null); }}
                        onContextMenu={(e) => { e.preventDefault(); setLayoutMenuState(null); }}
                    />
                    <div
                        className={`fixed min-w-[220px] overflow-hidden rounded-[var(--vibe-radius-md)] py-1.5 animate-in fade-in zoom-in-95 duration-100 ${glass.popover}`}
                        style={{
                            left: layoutMenuState.x + layoutMenuWidth > window.innerWidth ? layoutMenuState.x - layoutMenuWidth : layoutMenuState.x,
                            top: layoutMenuState.y + layoutMenuHeight > window.innerHeight ? layoutMenuState.y - layoutMenuHeight : layoutMenuState.y,
                            zIndex: 99999,
                        }}
                    >
                        <div className="pointer-events-none mb-1 select-none border-b border-[var(--vibe-border-subtle)] px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                            Раскладка окна
                        </div>
                        {layoutMenuActions.map((action) => {
                            const ActionIcon = action.icon;
                            return (
                                <button
                                    key={action.id}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        action.run();
                                        setLayoutMenuState(null);
                                    }}
                                    className={contextMenuItemClass}
                                >
                                    <ActionIcon size={14} className={contextMenuIconClass} /> {action.label}
                                </button>
                            );
                        })}
                    </div>
                </>,
                document.body
            )}
            {contextMenuState && canEditCurrentEntity && ReactDOM.createPortal(
                <>
                    <div 
                        className="fixed inset-0 z-[99998]" 
                        onClick={(e) => { e.stopPropagation(); setContextMenuState(null); }}
                        onContextMenu={(e) => { e.preventDefault(); setContextMenuState(null); }}
                    />
                    <div
                        className={`fixed min-w-[200px] overflow-hidden rounded-[var(--vibe-radius-md)] py-1.5 animate-in fade-in zoom-in-95 duration-100 ${glass.popover}`}
                        style={{
                            left: contextMenuState.x + contextMenuWidth > window.innerWidth ? contextMenuState.x - contextMenuWidth : contextMenuState.x,
                            top: contextMenuState.y + contextMenuHeight > window.innerHeight ? contextMenuState.y - contextMenuHeight : contextMenuState.y,
                            zIndex: 99999,
                        }}
                    >
                        <div className="pointer-events-none mb-1 select-none border-b border-[var(--vibe-border-subtle)] px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                            Контекстное меню
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!canEditCurrentEntity) return;
                                setTempName(entity.name);
                                setIsEditingName(true);
                                setContextMenuState(null);
                            }}
                            className={contextMenuItemClass}
                        >
                            <Edit2 size={14} className={contextMenuIconClass} /> Переименовать
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateEntity();
                            }}
                            className={contextMenuItemClass}
                        >
                            <Copy size={14} className={contextMenuIconClass} /> Дублировать
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCopyWikiLink();
                            }}
                            className={contextMenuItemClass}
                        >
                            <Link2 size={14} className={contextMenuIconClass} /> Копировать [[ссылку]]
                        </button>
                        {quickCreateActions.length > 0 && (
                            <>
                                <div className="mx-2 my-1 border-t border-[var(--vibe-border-subtle)]" />
                                {quickCreateActions.map(action => {
                                    const ActionIcon = action.icon;
                                    return (
                                        <button
                                            key={action.type}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCreateChildEntity(action.type);
                                            }}
                                            className={contextMenuItemClass}
                                        >
                                            <ActionIcon size={14} className={contextMenuIconClass} /> {action.label}
                                        </button>
                                    );
                                })}
                            </>
                        )}
                        <div className="mx-2 my-1 border-t border-[var(--vibe-border-subtle)]" />
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!canEditCurrentEntity) return;
                                setContextMenuState(null);
                                openConfirm({
                                    title: "Удаление сущности",
                                    description: `Вы уверены, что хотите удалить "${entity.name}"?`,
                                    confirmText: "Удалить",
                                    isDestructive: true,
                                    onConfirm: () => {
                                        yjsStore.deleteEntity(entityId);
                                        closeWindow(id);
                                    }
                                });
                            }}
                            className="group flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--vibe-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-danger)_18%,transparent)]"
                        >
                            <Trash2 size={14} className="text-[var(--vibe-danger)] opacity-70 transition-opacity group-hover:opacity-100" /> Удалить сущность
                        </button>
                    </div>
                </>,
                document.body
            )}
        </Rnd >
    );
}
