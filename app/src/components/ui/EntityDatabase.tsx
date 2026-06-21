import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { yjsStore } from '../../store/yjsStore';
import { useEntities } from '../../hooks/useEntities';
import { useWindowStore } from '../../store/windowStore';
import { useCanvasStore } from '../../store/canvasStore';
import { useNotesWorkspaceStore } from '../../store/notesWorkspaceStore';
import { useWorkspaceModeStore } from '../../store/workspaceModeStore';
import { DragDropPopover, type DragDropPromptData } from './DragDropPopover';
import { getAssetUrl, importMarkdown, getIsHost, listPlayers, showEntityInExplorer } from '../../services/fileApi';
import { useUIStore } from '../../store/uiStore';
import { canViewEntity } from '../../utils/permissions';
import { writeClipboardText } from '../../utils/clipboard';
import {
    CANVAS_WINDOW_INSTANCES_PROPERTY,
    createCanvasWindowInstance,
    getNextCanvasWindowZIndex,
    readCanvasWindowInstances,
    upsertCanvasWindowInstance,
} from '../../utils/canvasPersistence';
import { generateEntityId } from '../../utils/entityId';
import { addRecentEntitySearchQuery, addSavedEntitySearchQuery, getEntitySearchResult, getEntitySearchTerms, removeSavedEntitySearchQuery, type EntitySearchMatchField, type EntitySearchResult } from '../../utils/entitySearch';
import { serializeEntity } from '../../utils/entitySerializer';
import { getEntityDropActions, type EntityDropAction, type EntityDropContext, type EntityDropSource, type EntityDropTarget } from '../../utils/entityDropRouter';
import { readEntityDragIds, writeEntityDragIds } from '../../utils/entityDragPayload';
import { applyOwnerToEntityTree, getEntityOwnerId, moveEntityTreeToParent } from '../../utils/entityTreeMutations';
import { getTopLevelEntityIds } from '../../utils/entityTreeSelection';
import type { DatabaseType, Entity, EntityType } from '../../types';
import { Edit2, ExternalLink, Download, Trash2, Image as ImageIcon, User, Box, Sword, Wand2, Map as MapIcon, FileText, Bookmark, Lightbulb, Star, Gift, Copy, Link2, FolderSearch, Search, Upload, X, CheckSquare, Pin, CornerDownRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const TYPE_ICONS: Partial<Record<EntityType | 'spell', LucideIcon>> = {
    character: User,
    object: Box,
    attack: Sword,
    ability: Star,
    competency: Lightbulb,
    spell: Wand2,
    canvas: MapIcon,
    note: FileText,
    tag: Bookmark,
    folder: Bookmark,
};

const ENTITY_SEARCH_HISTORY_STORAGE_KEY = 'vibe.entitySearch.recentQueries';
const ENTITY_SEARCH_SAVED_STORAGE_KEY = 'vibe.entitySearch.savedQueries';
const ENTITY_SEARCH_HISTORY_LIMIT = 8;
const ENTITY_SEARCH_SAVED_LIMIT = 12;

function loadRecentEntitySearches(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(ENTITY_SEARCH_HISTORY_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, ENTITY_SEARCH_HISTORY_LIMIT) : [];
    } catch {
        return [];
    }
}

function saveRecentEntitySearches(history: string[]): void {
    if (typeof window === 'undefined') return;
    try {
        if (history.length === 0) {
            window.localStorage.removeItem(ENTITY_SEARCH_HISTORY_STORAGE_KEY);
            return;
        }
        window.localStorage.setItem(ENTITY_SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, ENTITY_SEARCH_HISTORY_LIMIT)));
    } catch {
        // Local history is a convenience feature; storage failures should not break the database panel.
    }
}

function loadSavedEntitySearches(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(ENTITY_SEARCH_SAVED_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, ENTITY_SEARCH_SAVED_LIMIT) : [];
    } catch {
        return [];
    }
}

function saveSavedEntitySearches(savedQueries: string[]): void {
    if (typeof window === 'undefined') return;
    try {
        if (savedQueries.length === 0) {
            window.localStorage.removeItem(ENTITY_SEARCH_SAVED_STORAGE_KEY);
            return;
        }
        window.localStorage.setItem(ENTITY_SEARCH_SAVED_STORAGE_KEY, JSON.stringify(savedQueries.slice(0, ENTITY_SEARCH_SAVED_LIMIT)));
    } catch {
        // Saved searches are local UI state; storage failures should not block entity work.
    }
}

const SEARCH_FIELD_LABEL_KEYS: Record<EntitySearchMatchField, string> = {
    name: 'entityDatabase.searchFields.name',
    description: 'entityDatabase.searchFields.description',
    property: 'entityDatabase.searchFields.property',
    tag: 'entityDatabase.searchFields.tag',
    type: 'entityDatabase.searchFields.type',
    id: 'id',
    database: 'entityDatabase.searchFields.database',
};

function getEntityGroupType(entity: Entity): string {
    const folderType = entity.type === 'folder' ? entity.properties?.folderType : undefined;
    return typeof folderType === 'string' && folderType ? folderType : entity.type;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlightedText(text: string, terms: string[]): React.ReactNode {
    const visibleTerms = terms.filter(term => term.length > 0).sort((left, right) => right.length - left.length);
    if (visibleTerms.length === 0 || !text) return text;

    const pattern = new RegExp(`(${visibleTerms.map(escapeRegExp).join('|')})`, 'ig');
    return text.split(pattern).map((part, index) => {
        const isMatch = visibleTerms.some(term => part.toLowerCase() === term.toLowerCase());
        if (!isMatch) return part;
        return (
            <mark key={`${part}-${index}`} className="rounded bg-cyan-300/20 px-0.5 text-cyan-100">
                {part}
            </mark>
        );
    });
}

function formatSearchFields(result: EntitySearchResult | undefined, t: (key: string) => string): string {
    if (!result || result.matchedFields.length === 0) return '';
    return result.matchedFields.slice(0, 3).map(field => field === 'id' ? 'id' : t(SEARCH_FIELD_LABEL_KEYS[field])).join(', ');
}

// ─── Custom Context Menu (rendered via React Portal in <body>) ───

function getSharedEntityDropActions(
    sources: EntityDropSource[],
    target: EntityDropTarget,
    context: EntityDropContext
): { copyAction?: EntityDropAction; moveAction?: EntityDropAction } {
    if (sources.length === 0) return {};

    const sourceTypes = new Set(sources.map(source => source.type));
    if (target.kind !== 'canvas' && sources.length > 1 && sourceTypes.size > 1) return {};

    const actionsBySource = sources.map(source => getEntityDropActions(source, target, context));
    if (actionsBySource.some(actions => actions.length === 0)) return {};

    const copyAction = actionsBySource[0].find(action => action.id === 'copy-entity');
    const moveAction = actionsBySource[0].find(action => action.id === 'move-entity');

    return {
        copyAction: copyAction && actionsBySource.every(actions => actions.some(action => action.id === 'copy-entity')) ? copyAction : undefined,
        moveAction: moveAction && actionsBySource.every(actions => actions.some(action => action.id === 'move-entity')) ? moveAction : undefined,
    };
}

interface ContextMenuState {
    x: number;
    y: number;
    entityId: string;
}

function EntityContextMenu({ state, canEdit, canShowInExplorer, canAddToCanvas, hasParent, quickCreateActions, onRename, onDuplicate, onCreateChild, onOpenWindow, onAddToCanvas, onOpenParent, onCopyWikiLink, onCopyId, onShowInExplorer, onExport, onDelete, onGiveToPlayer, onClose }: {
    state: ContextMenuState | null;
    canEdit: boolean;
    canShowInExplorer: boolean;
    canAddToCanvas: boolean;
    hasParent: boolean;
    quickCreateActions: QuickCreateAction[];
    onRename: (id: string) => void;
    onDuplicate: (id: string) => void;
    onCreateChild: (id: string, type: EntityType) => void;
    onOpenWindow: (id: string) => void;
    onAddToCanvas: (id: string) => void;
    onOpenParent: (id: string) => void;
    onCopyWikiLink: (id: string) => void;
    onCopyId: (id: string) => void;
    onShowInExplorer: (id: string) => void;
    onExport: (id: string) => void;
    onDelete: (id: string) => void;
    onGiveToPlayer?: (id: string) => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!state) return;
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClick);
            document.addEventListener('keydown', handleKey);
        }, 10);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [state, onClose]);

    if (!state) return null;

    const menuWidth = 200;
    const menuHeight = canEdit ? 390 + quickCreateActions.length * 36 + (onGiveToPlayer ? 44 : 0) : 260;
    const x = state.x + menuWidth > window.innerWidth ? state.x - menuWidth : state.x;
    const y = state.y + menuHeight > window.innerHeight ? state.y - menuHeight : state.y;

    return ReactDOM.createPortal(
        <>
            <div 
                className="fixed inset-0 z-[99998]" 
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                onContextMenu={(e) => { e.preventDefault(); onClose(); }}
            />
            <div
                ref={menuRef}
                className="fixed rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10 py-1.5 min-w-[200px] overflow-hidden backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-100 bg-[#151c2b]/70"
                style={{
                    left: x,
                    top: y,
                    zIndex: 99999,
                }}
            >
            <div className="px-3 py-1.5 text-[9px] font-bold text-white/30 uppercase tracking-widest border-b border-white/5 mb-1 select-none pointer-events-none">
                {t('entityDatabase.contextMenu.title')}
            </div>
            
            {canEdit && (
                <button
                    onClick={() => { onRename(state.entityId); onClose(); }}
                    className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 group"
                >
                    <Edit2 size={14} className="text-white/40 group-hover:text-white/80 transition-colors" /> {t('entityDatabase.contextMenu.rename')}
                </button>
            )}
            {canEdit && (
                <button
                    onClick={() => { onDuplicate(state.entityId); onClose(); }}
                    className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 group"
                >
                    <Copy size={14} className="text-white/40 group-hover:text-white/80 transition-colors" /> {t('entityDatabase.contextMenu.duplicate')}
                </button>
            )}
            {canEdit && quickCreateActions.length > 0 && (
                <>
                    <div className="border-t border-white/5 my-1 mx-2" />
                    {quickCreateActions.map(action => {
                        const ActionIcon = action.icon;
                        return (
                            <button
                                key={action.type}
                                onClick={() => { onCreateChild(state.entityId, action.type); onClose(); }}
                                className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 group"
                            >
                                <ActionIcon size={14} className="text-white/40 group-hover:text-white/80 transition-colors" /> {t(action.labelKey)}
                            </button>
                        );
                    })}
                </>
            )}
            <button
                onClick={() => { onOpenWindow(state.entityId); onClose(); }}
                className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 group"
            >
                <ExternalLink size={14} className="text-white/40 group-hover:text-white/80 transition-colors" /> {t('entityDatabase.contextMenu.openFocus')}
            </button>
            {canAddToCanvas && (
                <button
                    onClick={() => { onAddToCanvas(state.entityId); onClose(); }}
                    className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 group"
                >
                    <Pin size={14} className="text-white/40 group-hover:text-white/80 transition-colors" /> {t('entityDatabase.contextMenu.pinToCanvas')}
                </button>
            )}
            {hasParent && (
                <button
                    onClick={() => { onOpenParent(state.entityId); onClose(); }}
                    className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 group"
                >
                    <CornerDownRight size={14} className="text-white/40 group-hover:text-white/80 transition-colors" /> {t('entityDatabase.contextMenu.showParent')}
                </button>
            )}
            <button
                onClick={() => { onCopyId(state.entityId); onClose(); }}
                className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 group"
            >
                <Copy size={14} className="text-white/40 group-hover:text-white/80 transition-colors" /> {t('entityDatabase.contextMenu.copyId')}
            </button>
            <button
                onClick={() => { onCopyWikiLink(state.entityId); onClose(); }}
                className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 group"
            >
                <Link2 size={14} className="text-white/40 group-hover:text-white/80 transition-colors" /> {t('entityDatabase.contextMenu.copyWikiLink')}
            </button>
            {canShowInExplorer && (
                <button
                    onClick={() => { onShowInExplorer(state.entityId); onClose(); }}
                    className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 group"
                >
                    <FolderSearch size={14} className="text-white/40 group-hover:text-white/80 transition-colors" /> {t('entityDatabase.contextMenu.showInExplorer')}
                </button>
            )}
            <button
                onClick={() => { onExport(state.entityId); onClose(); }}
                className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 group"
            >
                <Download size={14} className="text-white/40 group-hover:text-white/80 transition-colors" /> {t('entityDatabase.contextMenu.exportMd')}
            </button>
            {canEdit && onGiveToPlayer && (
                <>
                    <div className="border-t border-white/5 my-1 mx-2" />
                    <button
                        onClick={() => { onGiveToPlayer(state.entityId); onClose(); }}
                        className="w-full text-left px-3 py-2 text-sm text-violet-300 hover:bg-violet-500/20 hover:text-violet-100 transition-colors flex items-center gap-2 group"
                    >
                        <Gift size={14} className="text-violet-400/50 group-hover:text-violet-300 transition-colors" /> {t('entityDatabase.contextMenu.giveToPlayer')}
                    </button>
                </>
            )}
            {canEdit && (
                <>
                    <div className="border-t border-white/5 my-1 mx-2" />
                    <button
                        onClick={() => { onDelete(state.entityId); onClose(); }}
                        className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors flex items-center gap-2 group"
                    >
                        <Trash2 size={14} className="text-red-500/50 group-hover:text-red-400 transition-colors" /> {t('common.delete')}
                    </button>
                </>
            )}
        </div>
        </>,
        document.body
    );
}

export const EntityGroups = [
    { type: 'canvas', labelKey: 'entityDatabase.groups.canvas', dot: 'bg-orange-400', focus: 'hover:border-orange-400', text: 'text-orange-300', iconHov: 'group-hover:border-orange-400 group-hover:bg-orange-500/10', labelHov: 'group-hover:text-orange-200' },
    { type: 'character', labelKey: 'entityDatabase.groups.character', dot: 'bg-indigo-400', focus: 'hover:border-indigo-400', text: 'text-indigo-300', iconHov: 'group-hover:border-indigo-400 group-hover:bg-indigo-500/10', labelHov: 'group-hover:text-indigo-200' },
    { type: 'object', labelKey: 'entityDatabase.groups.object', dot: 'bg-amber-400', focus: 'hover:border-amber-400', text: 'text-amber-300', iconHov: 'group-hover:border-amber-400 group-hover:bg-amber-500/10', labelHov: 'group-hover:text-amber-200' },
    { type: 'competency', labelKey: 'entityDatabase.groups.competency', dot: 'bg-violet-400', focus: 'hover:border-violet-400', text: 'text-violet-300', iconHov: 'group-hover:border-violet-400 group-hover:bg-violet-500/10', labelHov: 'group-hover:text-violet-200' },
    { type: 'ability', labelKey: 'entityDatabase.groups.ability', dot: 'bg-cyan-400', focus: 'hover:border-cyan-400', text: 'text-cyan-300', iconHov: 'group-hover:border-cyan-400 group-hover:bg-cyan-500/10', labelHov: 'group-hover:text-cyan-200' },
    { type: 'note', labelKey: 'entityDatabase.groups.note', dot: 'bg-emerald-400', focus: 'hover:border-emerald-400', text: 'text-emerald-300', iconHov: 'group-hover:border-emerald-400 group-hover:bg-emerald-500/10', labelHov: 'group-hover:text-emerald-200' },
    { type: 'tag', labelKey: 'entityDatabase.groups.tag', dot: 'bg-blue-400', focus: 'hover:border-blue-400', text: 'text-blue-300', iconHov: 'group-hover:border-blue-400 group-hover:bg-blue-500/10', labelHov: 'group-hover:text-blue-200' },
    { type: 'attack', labelKey: 'entityDatabase.groups.attack', dot: 'bg-rose-400', focus: 'hover:border-rose-400', text: 'text-rose-300', iconHov: 'group-hover:border-rose-400 group-hover:bg-rose-500/10', labelHov: 'group-hover:text-rose-200' }
] as const;

type EntityGroup = typeof EntityGroups[number];

interface QuickCreateAction {
    type: EntityType;
    labelKey: string;
    icon: LucideIcon;
}

function getQuickCreateActions(entity?: Entity): QuickCreateAction[] {
    if (!entity) return [];

    if (entity.type === 'character') {
        return [
            { type: 'object', labelKey: 'entityDatabase.quickCreate.object', icon: Box },
            { type: 'competency', labelKey: 'entityDatabase.quickCreate.competency', icon: Lightbulb },
            { type: 'ability', labelKey: 'entityDatabase.quickCreate.ability', icon: Wand2 },
        ];
    }

    if (entity.type === 'object') {
        return [{ type: 'attack', labelKey: 'entityDatabase.quickCreate.attack', icon: Sword }];
    }

    return [];
}

interface RecursiveEntityItemProps {
    entity: Entity;
    entities: Entity[];
    level?: number;
    searchActive?: boolean;
    defaultGroupContext?: EntityGroup;
    baseParentId: string | null;
    targetDb?: DatabaseType;
    targetPlayerOwner?: string;
    onPromptDrop: (data: DragDropPromptData) => void;
    renamingId: string | null;
    onRenameStart: (id: string) => void;
    onRenameSubmit: (id: string, newName: string) => void;
    onRenameCancel: () => void;
    onShowContextMenu: (e: React.MouseEvent, entityId: string) => void;
    canModifyEntityInUi: (entity: Entity) => boolean;
    canModifyTargetDb: boolean;
    searchResultsById: Map<string, EntitySearchResult>;
    searchTerms: string[];
    selectedEntityIds: Set<string>;
    onEntitySelectionClick: (entityId: string, event: React.MouseEvent) => boolean;
}

function RecursiveEntityItem({ entity, entities, level = 0, searchActive = false, defaultGroupContext, baseParentId, targetDb, targetPlayerOwner, onPromptDrop, renamingId, onRenameStart, onRenameSubmit, onRenameCancel, onShowContextMenu, canModifyEntityInUi, canModifyTargetDb, searchResultsById, searchTerms, selectedEntityIds, onEntitySelectionClick }: RecursiveEntityItemProps) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const [renameValue, setRenameValue] = useState(entity.name);
    const renameInputRef = useRef<HTMLInputElement>(null);
    const { openWindow } = useWindowStore();
    const { navigate } = useCanvasStore();
    const workspaceMode = useWorkspaceModeStore((state) => state.mode);
    const openNotesWorkspaceTab = useNotesWorkspaceStore((state) => state.openTab);
    const { openConfirm } = useUIStore();

    const isRenaming = renamingId === entity.id;

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onShowContextMenu(e, entity.id);
    };

    const handleRenameSubmitLocal = () => {
        const trimmed = renameValue.trim();
        onRenameSubmit(entity.id, trimmed);
    };

    const handleRenameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleRenameSubmitLocal();
        if (e.key === 'Escape') onRenameCancel();
    };

    useEffect(() => {
        if (isRenaming) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRenameValue(entity.name);
        }
    }, [isRenaming, entity.name]);

    useEffect(() => {
        if (isRenaming && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [isRenaming]);

    const children = entities.filter(e => e.parentId === entity.id && e.id !== 'root');
    const group = EntityGroups.find(g => g.type === entity.type) || defaultGroupContext || EntityGroups[3];
    const canEditEntity = entity.id !== 'root' && canModifyEntityInUi(entity);
    const canExpandEntity = children.length > 0;
    const isExpanded = expanded || searchActive;
    const searchResult = searchResultsById.get(entity.id);
    const searchFieldLabel = formatSearchFields(searchResult, t);
    const isSelected = selectedEntityIds.has(entity.id);

    let fullUrl = entity.icon_url;
    if (fullUrl && !fullUrl.startsWith('http') && !fullUrl.startsWith('data:')) {
        fullUrl = getAssetUrl(fullUrl);
    }

    const Icon = TYPE_ICONS[entity.type] || ImageIcon;
    const handleOpenEntity = () => {
        if (entity.type === 'canvas') {
            navigate(entity.id);
            return;
        }

        if (workspaceMode === 'notes') {
            openNotesWorkspaceTab(entity.id, 'source');
            return;
        }

        openWindow(entity.id, Math.random() * 200 + 50, Math.random() * 200 + 50);
    };

    return (
        <div className="flex flex-col gap-1 w-full relative">
            <div
                onClick={(event) => {
                    if (onEntitySelectionClick(entity.id, event)) return;
                    handleOpenEntity();
                }}
                draggable={true}
                onDragStart={(e) => {
                    const selectedDragIds = selectedEntityIds.has(entity.id) && selectedEntityIds.size > 1 ? Array.from(selectedEntityIds) : [entity.id];
                    writeEntityDragIds(e.dataTransfer, selectedDragIds);
                    e.dataTransfer.setData("application/source-database", entity.database || targetDb || 'general');
                    e.dataTransfer.setData("text/plain", `[[${entity.id}]]`);
                    e.dataTransfer.effectAllowed = "copyMove";
                }}
                onDragOver={(e) => {
                    const draggedIds = getTopLevelEntityIds(readEntityDragIds(e.dataTransfer), entities);
                    const draggedEntities = draggedIds
                        .map(id => yjsStore.entitiesMap.get(id) || entities.find(entity => entity.id === id))
                        .filter((candidate): candidate is Entity => Boolean(candidate));
                    if (draggedEntities.length === 0 || draggedEntities.length !== draggedIds.length || draggedEntities.some(candidate => candidate.type === 'canvas')) return;

                    const { copyAction, moveAction } = getSharedEntityDropActions(
                        draggedEntities.map(draggedEnt => ({ id: draggedEnt.id, type: draggedEnt.type, database: draggedEnt.database, parentId: draggedEnt.parentId })),
                        { kind: 'entity', entityId: entity.id, entityType: entity.type },
                        {
                            role: yjsStore.localRole,
                            canModifySource: draggedEntities.every(draggedEnt => canModifyEntityInUi(draggedEnt)),
                            canModifyTarget: canEditEntity && canModifyTargetDb,
                        }
                    );
                    if (copyAction || moveAction) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = moveAction ? "move" : "copy";
                    }
                }}
                onDrop={(e) => {
                    const draggedIds = getTopLevelEntityIds(readEntityDragIds(e.dataTransfer), entities);
                    const draggedEntities = draggedIds
                        .map(id => yjsStore.entitiesMap.get(id) || entities.find(entity => entity.id === id))
                        .filter((candidate): candidate is Entity => Boolean(candidate));
                    if (draggedEntities.length === 0 || draggedEntities.length !== draggedIds.length || draggedEntities.some(candidate => candidate.type === 'canvas')) return;

                    const targetDatabase = entity.database || targetDb || 'general';
                    const targetOwner = getEntityOwnerId(entity) || targetPlayerOwner;
                    const { copyAction, moveAction } = getSharedEntityDropActions(
                        draggedEntities.map(draggedEnt => ({ id: draggedEnt.id, type: draggedEnt.type, database: draggedEnt.database, parentId: draggedEnt.parentId })),
                        { kind: 'entity', entityId: entity.id, entityType: entity.type },
                        {
                            role: yjsStore.localRole,
                            canModifySource: draggedEntities.every(draggedEnt => canModifyEntityInUi(draggedEnt)),
                            canModifyTarget: canEditEntity && canModifyTargetDb,
                        }
                    );
                    if (!copyAction && !moveAction) return;

                    e.preventDefault();
                    e.stopPropagation();
                    onPromptDrop({
                        x: e.clientX,
                        y: e.clientY,
                        entityName: draggedEntities.length === 1 ? draggedEntities[0].name : t('entityDatabase.entitiesCount', { count: draggedEntities.length }),
                        canCopy: Boolean(copyAction),
                        canMove: Boolean(moveAction),
                        copyLabel: copyAction?.label,
                        moveLabel: moveAction?.label,
                        onMove: () => {
                            draggedEntities.forEach((draggedEnt) => {
                                moveEntityTreeToParent(draggedEnt.id, entity.id, targetDatabase, {
                                    ownerId: targetDatabase === 'user' ? targetOwner : undefined,
                                });
                            });
                            setTimeout(() => setExpanded(true), 50);
                        },
                        onCopy: () => {
                            draggedEntities.forEach((draggedEnt) => {
                                const newId = yjsStore.cloneEntity(draggedEnt.id, entity.id, targetDatabase);
                                if (newId && targetDatabase === 'user' && targetOwner) {
                                    applyOwnerToEntityTree(newId, targetOwner);
                                }
                            });
                            setTimeout(() => setExpanded(true), 50);
                        },
                        onCancel: () => { }
                    });
                }}
                onContextMenu={handleContextMenu}
                className={`p-3 rounded-xl border cursor-pointer transition-all group/item flex items-center justify-between ${group.focus} ${
                    isSelected
                        ? 'bg-cyan-400/15 border-cyan-200/45 shadow-[0_0_0_1px_rgba(103,232,249,0.16),0_14px_34px_rgba(8,145,178,0.12)]'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 shadow-sm'
                } backdrop-blur-md`}
                style={{ marginLeft: level * 12 }}
            >
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <div
                        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-all ${
                            isSelected
                                ? 'border-cyan-200/50 bg-cyan-300/20 text-cyan-50'
                                : 'border-white/10 bg-black/20 text-white/20 opacity-0 group-hover/item:opacity-40'
                        }`}
                    >
                        <CheckSquare size={13} strokeWidth={2.3} />
                    </div>
                    <div className={`w-8 h-8 overflow-hidden flex-shrink-0 flex items-center justify-center border transition-colors rounded-lg bg-black/20 border-white/10 shadow-inner ${group.text} ${group.iconHov}`}>
                        {fullUrl ? (
                            <img src={fullUrl} alt="" className="w-full h-full object-cover pointer-events-none" />
                        ) : (
                            <Icon size={16} strokeWidth={2} className="opacity-70" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1 pr-2">
                        {isRenaming ? (
                            <input
                                ref={renameInputRef}
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onBlur={handleRenameSubmitLocal}
                                onKeyDown={handleRenameKeyDown}
                                onClick={e => e.stopPropagation()}
                                className="bg-black/40 text-white/90 text-sm font-bold px-2 py-0.5 rounded border border-white/20 outline-none w-full"
                            />
                        ) : (
                            <h4 className={`font-bold text-sm transition-colors truncate leading-tight select-none text-white/90 ${group.labelHov}`}>
                                {renderHighlightedText(entity.name, searchTerms)}
                            </h4>
                        )}
                        <p className="text-[10px] text-white/40 font-mono mt-0.5 truncate select-none text-left">
                            {entity.type}
                            {searchFieldLabel && <span className="ml-1 font-sans text-cyan-100/45">· {searchFieldLabel}</span>}
                        </p>
                        {searchResult?.snippet && (
                            <p className="mt-1 truncate text-[10px] leading-snug text-cyan-100/45">
                                {renderHighlightedText(searchResult.snippet, searchTerms)}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {canEditEntity && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                openConfirm({
                                    title: t('entityWindow.deleteConfirm.title'),
                                    description: t('entityWindow.deleteConfirm.description', { name: entity.name }),
                                    confirmText: t('common.delete'),
                                    isDestructive: true,
                                    onConfirm: () => {
                                        yjsStore.deleteEntity(entity.id);
                                        useWindowStore.getState().closeWindow(entity.id);
                                    }
                                });
                            }}
                            className="opacity-0 group-hover/item:opacity-100 p-2 text-white/30 hover:text-red-400 rounded hover:bg-red-500/20 transition-all ml-1 flex-shrink-0"
                            title={t('common.delete')}
                        >
                            <Trash2 size={16} />
                        </button>
                    )}

                    {canExpandEntity && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setExpanded(!expanded);
                            }}
                            className="p-1 text-white/40 hover:text-white"
                            title={isExpanded ? t('entityDatabase.collapseChildren') : t('entityDatabase.expandChildren')}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                    )}
                </div>
            </div>

            {
                isExpanded && canExpandEntity && (
                    <div className="flex flex-col gap-1 w-full pl-2 mt-1 relative before:empty before:w-px before:bg-white/10 before:absolute before:left-3 before:top-0 before:bottom-0">
                        {children.length === 0 ? (
                            <div className="text-[10px] text-white/30 italic py-1 pl-4">{t('entityDatabase.empty')}</div>
                        ) : (
                            children.map(child => (
                                <RecursiveEntityItem
                                    key={child.id}
                                    entity={child}
                                    entities={entities}
                                    level={level + 1}
                                    searchActive={searchActive}
                                    defaultGroupContext={entity.type === 'folder' ? group : undefined}
                                    baseParentId={baseParentId}
                                    targetDb={targetDb}
                                    targetPlayerOwner={targetPlayerOwner}
                                    onPromptDrop={onPromptDrop}
                                    renamingId={renamingId}
                                    onRenameStart={onRenameStart}
                                    onRenameSubmit={onRenameSubmit}
                                    onRenameCancel={onRenameCancel}
                                    onShowContextMenu={onShowContextMenu}
                                    canModifyEntityInUi={canModifyEntityInUi}
                                    canModifyTargetDb={canModifyTargetDb}
                                    searchResultsById={searchResultsById}
                                    searchTerms={searchTerms}
                                    selectedEntityIds={selectedEntityIds}
                                    onEntitySelectionClick={onEntitySelectionClick}
                                />
                            ))
                        )}
                    </div>
                )
            }
        </div >
    );
}

interface EntityDatabaseProps {
    baseParentId: string | null;
    showRootCanvas?: boolean;
    headerTitle?: string;
    allowedTabs?: readonly string[];
    targetDb?: import('../../types').DatabaseType;
    /** If set, filters entities to those owned by this player (properties._playerOwner) */
    playerFilter?: string;
}

export function EntityDatabase({ baseParentId, showRootCanvas = false, headerTitle, allowedTabs, targetDb = 'general', playerFilter }: EntityDatabaseProps) {
    const { t } = useTranslation();
    const allEntities = useEntities();
    const resolvedHeaderTitle = headerTitle ?? t('entityDatabase.defaultHeader');
    const targetPlayerOwner = targetDb === 'user' ? (playerFilter || yjsStore.localPlayerName) : undefined;
    const entities = allEntities.filter((entity) => {
        const entityDb = entity.database || 'general';
        const owner = entity.properties?._playerOwner as string | undefined;
        if (entityDb !== targetDb) return false;
        if (!canViewEntity(yjsStore.localRole, entityDb, owner, yjsStore.localPlayerId, yjsStore.localPlayerName)) return false;
        if (playerFilter) {
            if (owner) return owner === playerFilter;
            return playerFilter === yjsStore.localPlayerName || playerFilter === yjsStore.localPlayerId;
        }
        return true;
    });
    const { openWindow } = useWindowStore();
    const activeCanvasId = useCanvasStore((state) => state.activeCanvasId);
    const stageScale = useCanvasStore((state) => state.scale);
    const stageOffset = useCanvasStore((state) => state.offset);
    const navigate = useCanvasStore((state) => state.navigate);
    const workspaceMode = useWorkspaceModeStore((state) => state.mode);
    const openNotesWorkspaceTab = useNotesWorkspaceStore((state) => state.openTab);
    const { openConfirm } = useUIStore();
    const [dragDropPrompt, setDragDropPrompt] = useState<DragDropPromptData | null>(null);
    const [activeTab, setActiveTab] = useState<string>('all');
    const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null);
    const [giveToPlayerEntityId, setGiveToPlayerEntityId] = useState<string | null>(null);
    const [giveToPlayerList, setGiveToPlayerList] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [recentSearches, setRecentSearches] = useState<string[]>(loadRecentEntitySearches);
    const [savedSearches, setSavedSearches] = useState<string[]>(loadSavedEntitySearches);
    const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
    const [lastSelectedEntityId, setLastSelectedEntityId] = useState<string | null>(null);
    const importInputRef = useRef<HTMLInputElement>(null);
    const canModifyTargetDb = yjsStore.canModify(targetDb, targetPlayerOwner);
    const normalizedSearch = searchQuery.trim();
    const normalizedSearchKey = normalizedSearch.replace(/\s+/g, ' ').toLowerCase();
    const searchActive = normalizedSearch.length > 0;
    const searchTerms = useMemo(() => getEntitySearchTerms(searchQuery), [searchQuery]);
    const isCurrentSearchSaved = normalizedSearchKey.length > 0 && savedSearches.some((query) => query.replace(/\s+/g, ' ').trim().toLowerCase() === normalizedSearchKey);

    useEffect(() => {
        if (normalizedSearch.length < 2) return;
        const timer = window.setTimeout(() => {
            setRecentSearches((current) => {
                const next = addRecentEntitySearchQuery(current, normalizedSearch, ENTITY_SEARCH_HISTORY_LIMIT);
                if (next.length === current.length && next.every((item, index) => item === current[index])) return current;
                saveRecentEntitySearches(next);
                return next;
            });
        }, 900);

        return () => window.clearTimeout(timer);
    }, [normalizedSearch]);

    const canModifyEntityInUi = useCallback((entity: Entity) => {
        return yjsStore.canModify(entity.database || targetDb, getEntityOwnerId(entity));
    }, [targetDb]);

    const searchResultsById = useMemo(() => {
        const results = new Map<string, EntitySearchResult>();
        if (!normalizedSearch) return results;

        const byId = new Map(entities.map(entity => [entity.id, entity]));
        entities.forEach((entity) => {
            const result = getEntitySearchResult(entity, normalizedSearch, tagId => byId.get(tagId)?.name);
            if (result.matches) results.set(entity.id, result);
        });

        return results;
    }, [entities, normalizedSearch]);

    const visibleEntities = useMemo(() => {
        if (!normalizedSearch) return entities;

        const byId = new Map(entities.map(entity => [entity.id, entity]));
        const childrenByParent = new Map<string, Entity[]>();

        entities.forEach((entity) => {
            if (!entity.parentId) return;
            const siblings = childrenByParent.get(entity.parentId) || [];
            siblings.push(entity);
            childrenByParent.set(entity.parentId, siblings);
        });

        const visibleIds = new Set<string>();
        const includeDescendants = (entityId: string) => {
            const children = childrenByParent.get(entityId) || [];
            children.forEach((child) => {
                if (visibleIds.has(child.id)) return;
                visibleIds.add(child.id);
                includeDescendants(child.id);
            });
        };

        const includeAncestors = (entity: Entity) => {
            let current: Entity | undefined = entity;
            while (current) {
                visibleIds.add(current.id);
                current = current.parentId ? byId.get(current.parentId) : undefined;
            }
        };

        entities.forEach((entity) => {
            if (!searchResultsById.has(entity.id)) return;
            includeAncestors(entity);
            includeDescendants(entity.id);
        });

        return entities.filter(entity => visibleIds.has(entity.id));
    }, [entities, normalizedSearch, searchResultsById]);

    const orderedVisibleEntityIds = useMemo(() => {
        return visibleEntities.filter(entity => entity.id !== 'root').map(entity => entity.id);
    }, [visibleEntities]);

    const selectedEntities = useMemo(() => {
        return selectedEntityIds
            .map(id => visibleEntities.find(entity => entity.id === id))
            .filter((entity): entity is Entity => Boolean(entity));
    }, [selectedEntityIds, visibleEntities]);

    const selectedEntityIdSet = useMemo(() => new Set(selectedEntities.map(entity => entity.id)), [selectedEntities]);

    const bulkDeletableEntities = useMemo(() => {
        return selectedEntities.filter(entity => entity.id !== 'root' && canModifyEntityInUi(entity));
    }, [canModifyEntityInUi, selectedEntities]);

    const bulkDeleteRootIds = useMemo(() => {
        return getTopLevelEntityIds(bulkDeletableEntities.map(entity => entity.id), entities);
    }, [bulkDeletableEntities, entities]);

    const clearEntitySelection = useCallback(() => {
        setSelectedEntityIds([]);
        setLastSelectedEntityId(null);
    }, []);

    const handleEntitySelectionClick = useCallback((entityId: string, event: React.MouseEvent) => {
        if (entityId === 'root' || renamingId === entityId) return false;

        const isRangeSelection = event.shiftKey;
        const isToggleSelection = event.ctrlKey || event.metaKey;

        if (!isRangeSelection && !isToggleSelection) {
            if (selectedEntityIds.length > 0) clearEntitySelection();
            return false;
        }

        event.preventDefault();
        event.stopPropagation();

        if (isRangeSelection) {
            const fromIndex = lastSelectedEntityId ? orderedVisibleEntityIds.indexOf(lastSelectedEntityId) : -1;
            const toIndex = orderedVisibleEntityIds.indexOf(entityId);

            if (fromIndex >= 0 && toIndex >= 0) {
                const start = Math.min(fromIndex, toIndex);
                const end = Math.max(fromIndex, toIndex);
                const rangeIds = orderedVisibleEntityIds.slice(start, end + 1);
                setSelectedEntityIds((current) => Array.from(new Set([...current, ...rangeIds])));
            } else {
                setSelectedEntityIds([entityId]);
            }
        } else {
            setSelectedEntityIds((current) => {
                if (current.includes(entityId)) return current.filter(id => id !== entityId);
                return [...current, entityId];
            });
        }

        setLastSelectedEntityId(entityId);
        return true;
    }, [clearEntitySelection, lastSelectedEntityId, orderedVisibleEntityIds, renamingId, selectedEntityIds.length]);

    const directSearchMatches = useMemo(() => {
        if (!searchActive) return [];
        return entities
            .filter(entity => searchResultsById.has(entity.id))
            .sort((left, right) => (searchResultsById.get(right.id)?.score || 0) - (searchResultsById.get(left.id)?.score || 0));
    }, [entities, searchActive, searchResultsById]);

    const searchMatchCountsByType = useMemo(() => {
        return directSearchMatches.reduce<Record<string, number>>((acc, entity) => {
            const groupType = getEntityGroupType(entity);
            acc[groupType] = (acc[groupType] || 0) + 1;
            return acc;
        }, {});
    }, [directSearchMatches]);

    const handleSelectRecentSearch = useCallback((query: string) => {
        setSearchQuery(query);
    }, []);

    const handleClearRecentSearches = useCallback(() => {
        setRecentSearches([]);
        saveRecentEntitySearches([]);
    }, []);

    const handleSaveCurrentSearch = useCallback(() => {
        if (!normalizedSearch) return;
        setSavedSearches((current) => {
            const next = addSavedEntitySearchQuery(current, normalizedSearch, ENTITY_SEARCH_SAVED_LIMIT);
            saveSavedEntitySearches(next);
            return next;
        });
    }, [normalizedSearch]);

    const handleRemoveSavedSearch = useCallback((query: string) => {
        setSavedSearches((current) => {
            const next = removeSavedEntitySearchQuery(current, query);
            saveSavedEntitySearches(next);
            return next;
        });
    }, []);

    // ─── Import .md files ───
    const handleImportFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!canModifyTargetDb) return;
        const files = e.target.files;
        if (!files || files.length === 0) return;

        for (const file of Array.from(files)) {
            try {
                const content = await file.text();
                const imported = await importMarkdown(content, file.name, targetDb);
                imported.database = targetDb;
                // Add to Yjs so it appears immediately
                yjsStore.addEntity(imported);
                console.log(`📥 Imported: ${imported.name}`);
            } catch (err) {
                console.error(`❌ Failed to import ${file.name}:`, err);
            }
        }

        // Reset file input
        if (importInputRef.current) importInputRef.current.value = '';
    }, [canModifyTargetDb, targetDb]);

    // ─── Export entity as .md ───
    const handleExportEntity = useCallback((id: string) => {
        const entity = entities.find(e => e.id === id);
        if (!entity) return;

        const md = serializeEntity(entity, { includeUid: entity.database === 'user' || entity.database === 'gm' });

        // Trigger download
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${entity.name}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`📤 Exported: ${entity.name}.md`);
    }, [entities]);

    const handleShowContextMenu = useCallback((e: React.MouseEvent, entityId: string) => {
        e.preventDefault();
        setContextMenuState({ x: e.clientX, y: e.clientY, entityId });
    }, []);

    const getVisibleEntityById = useCallback((entityId: string) => {
        const entity = allEntities.find(e => e.id === entityId);
        if (!entity) return undefined;

        const db = entity.database || 'general';
        const owner = getEntityOwnerId(entity);
        return canViewEntity(yjsStore.localRole, db, owner, yjsStore.localPlayerId, yjsStore.localPlayerName)
            ? entity
            : undefined;
    }, [allEntities]);

    const handleOpenEntityById = useCallback((id: string) => {
        const entity = getVisibleEntityById(id);
        if (!entity) return;

        if (entity.type === 'canvas') {
            navigate(entity.id);
            return;
        }

        if (workspaceMode === 'notes') {
            openNotesWorkspaceTab(entity.id, 'source');
            return;
        }

        openWindow(entity.id, Math.random() * 200 + 50, Math.random() * 200 + 50);
    }, [getVisibleEntityById, navigate, openNotesWorkspaceTab, openWindow, workspaceMode]);

    const handleOpenParentEntity = useCallback((id: string) => {
        const entity = getVisibleEntityById(id);
        if (!entity?.parentId) return;

        handleOpenEntityById(entity.parentId);
    }, [getVisibleEntityById, handleOpenEntityById]);

    const handleAddEntityToCanvas = useCallback((id: string) => {
        const entity = getVisibleEntityById(id);
        const canvas = allEntities.find(candidate => candidate.id === activeCanvasId && candidate.type === 'canvas');
        if (!entity || !canvas || !yjsStore.canModify(canvas.database || 'general', getEntityOwnerId(canvas))) return;

        const safeScale = stageScale || 1;
        const instances = readCanvasWindowInstances(canvas.properties);
        const instance = createCanvasWindowInstance({
            entityId: entity.id,
            x: ((window.innerWidth / 2) - stageOffset.x) / safeScale - 200,
            y: ((window.innerHeight / 2) - stageOffset.y) / safeScale - 150,
            zIndex: getNextCanvasWindowZIndex(instances),
        });

        yjsStore.updateEntity(canvas.id, {
            properties: {
                ...canvas.properties,
                [CANVAS_WINDOW_INSTANCES_PROPERTY]: upsertCanvasWindowInstance(instances, instance),
            },
        });
    }, [activeCanvasId, allEntities, getVisibleEntityById, stageOffset.x, stageOffset.y, stageScale]);

    const handleRenameSubmit = useCallback((id: string, newName: string) => {
        if (newName && newName.trim()) {
            const entity = entities.find(e => e.id === id);
            if (entity && canModifyEntityInUi(entity) && newName.trim() !== entity.name) {
                yjsStore.updateEntity(id, { name: newName.trim() });
            }
        }
        setRenamingId(null);
    }, [canModifyEntityInUi, entities]);

    const handleRenameCancel = useCallback(() => {
        setRenamingId(null);
    }, []);

    const handleRenameStart = useCallback((id: string) => {
        const entity = entities.find(e => e.id === id);
        if (!entity || !canModifyEntityInUi(entity)) return;
        setRenamingId(id);
    }, [canModifyEntityInUi, entities]);

    const handleDuplicateEntity = useCallback((id: string) => {
        const entity = entities.find(e => e.id === id);
        if (!entity || entity.id === 'root' || !canModifyEntityInUi(entity)) return;

        const cloneId = yjsStore.cloneEntity(id, entity.parentId, entity.database || targetDb);
        if (cloneId) {
            openWindow(cloneId, Math.random() * 200 + 70, Math.random() * 200 + 70);
        }
    }, [canModifyEntityInUi, entities, openWindow, targetDb]);

    const handleBulkDelete = useCallback(() => {
        if (bulkDeleteRootIds.length === 0) return;

        const previewNames = bulkDeletableEntities.slice(0, 4).map(entity => entity.name).join(', ');
        const hiddenCount = Math.max(0, bulkDeletableEntities.length - 4);

        openConfirm({
            title: t('entityDatabase.bulkDelete.title'),
            description: t('entityDatabase.bulkDelete.description', {
                count: bulkDeletableEntities.length,
                preview: `${previewNames}${hiddenCount > 0 ? t('entityDatabase.bulkDelete.hiddenMore', { count: hiddenCount }) : ''}`,
            }),
            confirmText: t('entityDatabase.bulkDelete.confirm'),
            isDestructive: true,
            onConfirm: () => {
                const { closeWindow } = useWindowStore.getState();
                selectedEntityIds.forEach(id => closeWindow(id));
                bulkDeleteRootIds.forEach(id => yjsStore.deleteEntity(id));
                clearEntitySelection();
            }
        });
    }, [bulkDeleteRootIds, bulkDeletableEntities, clearEntitySelection, openConfirm, selectedEntityIds, t]);

    const handleCopyWikiLink = useCallback((id: string) => {
        const entity = entities.find(e => e.id === id);
        if (!entity) return;

        void writeClipboardText(`[[${entity.id}]]`).catch((error) => {
            console.warn(`Failed to copy wiki link for "${entity.name}"`, error);
        });
    }, [entities]);

    const handleCopyEntityId = useCallback((id: string) => {
        const entity = allEntities.find(e => e.id === id);
        if (!entity) return;

        void writeClipboardText(entity.id).catch((error) => {
            console.warn(`Failed to copy entity id for "${entity.name}"`, error);
        });
    }, [allEntities]);

    const handleShowInExplorer = useCallback((id: string) => {
        const entity = entities.find(e => e.id === id);
        if (!entity) return;

        const db = entity.database || targetDb;
        const owner = getEntityOwnerId(entity) || targetPlayerOwner;
        void showEntityInExplorer(db, entity.id, owner).then((ok) => {
            if (!ok) console.warn(t('entityDatabase.openInExplorerFailed', { name: entity.name }));
        });
    }, [entities, targetDb, targetPlayerOwner, t]);

    const handleCloseContextMenu = useCallback(() => {
        setContextMenuState(null);
    }, []);

    const handleGiveToPlayer = useCallback(async (entityId: string) => {
        try {
            const players = await listPlayers();
            setGiveToPlayerList(players);
            setGiveToPlayerEntityId(entityId);
        } catch {
            setGiveToPlayerList([]);
            setGiveToPlayerEntityId(entityId);
        }
    }, []);

    const handleGiveToPlayerSelect = useCallback((playerName: string) => {
        if (!giveToPlayerEntityId) return;
        const entity = entities.find(e => e.id === giveToPlayerEntityId);
        if (!entity) return;

        const newId = yjsStore.cloneEntity(giveToPlayerEntityId, null, 'user');
        if (!newId) return;

        applyOwnerToEntityTree(newId, playerName);

        yjsStore.sendMessage(
            t('entityDatabase.givenToPlayerMessage', { name: entity.name, player: playerName }),
            t('chat.systemSender'),
            true
        );

        setGiveToPlayerEntityId(null);
        setGiveToPlayerList([]);
    }, [giveToPlayerEntityId, entities, t]);

    const handlePromptDrop = (data: DragDropPromptData) => {
        setDragDropPrompt({
            ...data,
            onMove: () => { data.onMove(); setDragDropPrompt(null); },
            onCopy: () => { data.onCopy(); setDragDropPrompt(null); },
            onCancel: () => { data.onCancel(); setDragDropPrompt(null); }
        });
    };

    const getRootDropState = useCallback((dataTransfer: DataTransfer) => {
        if (!canModifyTargetDb) return null;

        const draggedIds = getTopLevelEntityIds(readEntityDragIds(dataTransfer), allEntities);
        const draggedEntities = draggedIds
            .map(id => allEntities.find(ent => ent.id === id))
            .filter((candidate): candidate is Entity => Boolean(candidate));
        if (draggedEntities.length === 0 || draggedEntities.length !== draggedIds.length || draggedEntities.some(candidate => candidate.type === 'canvas')) return null;

        const { copyAction, moveAction } = getSharedEntityDropActions(
            draggedEntities.map(draggedEnt => ({ id: draggedEnt.id, type: draggedEnt.type, database: draggedEnt.database, parentId: draggedEnt.parentId })),
            { kind: 'database', database: targetDb, parentId: baseParentId },
            {
                role: yjsStore.localRole,
                canModifySource: draggedEntities.every(draggedEnt => canModifyEntityInUi(draggedEnt)),
                canModifyTarget: canModifyTargetDb,
            }
        );

        if (!copyAction && !moveAction) return null;
        return { draggedEntities, copyAction, moveAction };
    }, [allEntities, baseParentId, canModifyEntityInUi, canModifyTargetDb, targetDb]);

    const handleRootDragOver = (e: React.DragEvent) => {
        const dropState = getRootDropState(e.dataTransfer);
        if (!dropState) return;

        e.preventDefault();
        e.dataTransfer.dropEffect = dropState.moveAction ? 'move' : 'copy';
    };

    const handleRootDrop = (e: React.DragEvent) => {
        const dropState = getRootDropState(e.dataTransfer);
        if (!dropState) return;

        const { draggedEntities, copyAction, moveAction } = dropState;

        e.preventDefault();
        e.stopPropagation();
        handlePromptDrop({
            x: e.clientX,
            y: e.clientY,
            entityName: draggedEntities.length === 1 ? draggedEntities[0].name : t('entityDatabase.entitiesCount', { count: draggedEntities.length }),
            canCopy: Boolean(copyAction),
            canMove: Boolean(moveAction),
            copyLabel: copyAction?.label,
            moveLabel: moveAction?.label,
            onMove: () => {
                draggedEntities.forEach((draggedEnt) => {
                    moveEntityTreeToParent(draggedEnt.id, baseParentId, targetDb, {
                        ownerId: targetDb === 'user' ? targetPlayerOwner : undefined,
                    });
                });
                clearEntitySelection();
            },
            onCopy: () => {
                draggedEntities.forEach((draggedEnt) => {
                    const newId = yjsStore.cloneEntity(draggedEnt.id, baseParentId, targetDb);
                    if (newId && targetDb === 'user' && targetPlayerOwner) {
                        applyOwnerToEntityTree(newId, targetPlayerOwner);
                    }
                });
                clearEntitySelection();
            },
            onCancel: () => { }
        });
    };

    const createEntity = useCallback((
        type: EntityType,
        parentId: string | null = baseParentId,
        folderType?: string,
        entityDb: DatabaseType = targetDb,
        owner: string | undefined = targetPlayerOwner,
        openAfterCreate: boolean = false
    ) => {
        const ownerMarker = entityDb === 'user' ? owner : undefined;
        if (!yjsStore.canModify(entityDb, ownerMarker)) return null;

        const id = generateEntityId(entities.map(entity => entity.id));
        const base = { id, parentId, type, database: entityDb, name: type, description: '', tags: [], properties: {} };

        if (type === 'character') {
            Object.assign(base, { name: 'character', description: 'Новый персонаж.', properties: { strength: { base: 14 }, dexterity: { base: 12 } }, tags: [] });
        } else if (type === 'object') {
            Object.assign(base, { name: 'object', description: 'Новый предмет.', properties: { фигура: 1, прочность: 1, нагрузка: 1, редкость: 0, цена: 0 } });
        } else if (type === 'attack') {
            Object.assign(base, { name: 'attack', description: 'Новая атака.', properties: { урон: 1, масштаб: 1, попадание: 1, дистанция: 'ближняя' } });
        } else if (type === 'competency') {
            Object.assign(base, { name: 'competency', description: 'Новая компетенция.', properties: { rank: 0 } });
        } else if (type === 'ability') {
            Object.assign(base, { name: 'ability', description: 'Новая способность.', properties: { cost: { base: 0 }, diceFormula: '' } });
        } else if (type === 'tag') {
            Object.assign(base, { name: 'tag', description: 'Новый тег.', properties: { modifiers: [] } });
        } else if (type === 'note') {
            Object.assign(base, { name: 'note', description: '# Новая Заметка' });
        } else if (type === 'canvas') {
            Object.assign(base, { name: 'canvas', description: 'Новое рабочее пространство.', properties: { x: 100, y: 100 } });
        } else if (type === 'folder') {
            Object.assign(base, { name: 'folder', description: 'Папка.', properties: { folderType: folderType || 'tag' } });
        }

        if (entityDb === 'user' && ownerMarker) {
            base.properties = { ...base.properties, _playerOwner: ownerMarker };
        }

        if (!yjsStore.addEntity(base as Entity)) return null;
        if (openAfterCreate) {
            openWindow(id, Math.random() * 200 + 70, Math.random() * 200 + 70);
        }
        return id;
    }, [baseParentId, entities, openWindow, targetDb, targetPlayerOwner]);

    const addTestEntity = useCallback((type: EntityType, folderType?: string) => {
        createEntity(type, baseParentId, folderType);
    }, [baseParentId, createEntity]);

    const handleCreateChildEntity = useCallback((parentId: string, type: EntityType) => {
        const parent = entities.find(e => e.id === parentId);
        if (!parent || parent.id === 'root' || !canModifyEntityInUi(parent)) return;

        createEntity(
            type,
            parent.id,
            undefined,
            parent.database || targetDb,
            getEntityOwnerId(parent) || targetPlayerOwner,
            true
        );
    }, [canModifyEntityInUi, createEntity, entities, targetDb, targetPlayerOwner]);

    const tabsToShow = EntityGroups.filter(g => !allowedTabs || allowedTabs.includes(g.type));
    const contextMenuEntity = contextMenuState ? entities.find(e => e.id === contextMenuState.entityId) : undefined;
    const contextMenuParentEntity = contextMenuEntity?.parentId ? getVisibleEntityById(contextMenuEntity.parentId) : undefined;
    const activeCanvasEntity = allEntities.find(entity => entity.id === activeCanvasId && entity.type === 'canvas');
    const contextMenuCanEdit = Boolean(contextMenuEntity && contextMenuEntity.id !== 'root' && canModifyEntityInUi(contextMenuEntity));
    const contextMenuCanShowInExplorer = Boolean(contextMenuEntity && contextMenuEntity.id !== 'root' && getIsHost());
    const contextMenuCanAddToCanvas = Boolean(
        contextMenuEntity
        && activeCanvasEntity
        && yjsStore.canModify(activeCanvasEntity.database || 'general', getEntityOwnerId(activeCanvasEntity))
    );
    const contextMenuQuickCreateActions = contextMenuCanEdit ? getQuickCreateActions(contextMenuEntity) : [];
    const hasVisibleSearchResults = visibleEntities.some(entity => entity.id !== 'root');

    return (
        <div className="flex flex-col h-full bg-transparent relative" onDragOver={handleRootDragOver} onDrop={handleRootDrop}>
            {/* Hidden import file input */}
            <input
                ref={importInputRef}
                type="file"
                accept=".md"
                multiple
                className="hidden"
                onChange={handleImportFiles}
            />
            <div className="p-4 border-b border-white/10 bg-black/10 z-10 backdrop-blur-md">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest">{resolvedHeaderTitle}</div>
                    {getIsHost() && canModifyTargetDb && (
                        <button
                            onClick={() => importInputRef.current?.click()}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-2.5 text-[10px] font-bold uppercase tracking-wider text-cyan-100/80 shadow-inner transition-all hover:border-cyan-200/35 hover:bg-cyan-300/15 hover:text-white"
                            title={t('entityDatabase.importMdTitle')}
                        >
                            <Upload size={13} />
                            {t('entityDatabase.importMd')}
                        </button>
                    )}
                </div>

                <div className="relative mb-3">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('entityDatabase.searchPlaceholder')}
                        className="w-full h-9 rounded-lg bg-black/25 border border-white/10 pl-9 pr-9 text-xs text-white/80 placeholder:text-white/30 outline-none focus:border-white/25 focus:bg-black/35 transition-colors"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-white/35 hover:text-white/80 hover:bg-white/10 transition-colors"
                            title={t('entityDatabase.clearSearch')}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {!searchActive && savedSearches.length > 0 && (
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-amber-100/35">{t('entityDatabase.savedSearches')}</span>
                        {savedSearches.slice(0, 8).map((query) => (
                            <div
                                key={query}
                                className="inline-flex max-w-[220px] items-center overflow-hidden rounded-lg border border-amber-200/15 bg-amber-300/[0.07] text-[10px] font-medium text-amber-50/65 transition-colors hover:border-amber-100/30 hover:text-amber-50"
                            >
                                <button
                                    type="button"
                                    onClick={() => handleSelectRecentSearch(query)}
                                    className="truncate px-2 py-1 text-left"
                                    title={query}
                                >
                                    {query}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveSavedSearch(query)}
                                    className="border-l border-amber-100/10 px-1.5 py-1 text-amber-50/35 transition-colors hover:bg-amber-200/10 hover:text-amber-50"
                                    title={t('entityDatabase.removeSavedSearch')}
                                >
                                    <X size={11} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {!searchActive && recentSearches.length > 0 && (
                    <div className="mb-3 flex flex-wrap items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">{t('entityDatabase.recentSearches')}</span>
                        {recentSearches.slice(0, 5).map((query) => (
                            <button
                                key={query}
                                type="button"
                                onClick={() => handleSelectRecentSearch(query)}
                                className="max-w-[180px] truncate rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-white/45 transition-colors hover:border-cyan-200/25 hover:text-cyan-50"
                                title={query}
                            >
                                {query}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={handleClearRecentSearches}
                            className="rounded-lg border border-white/10 bg-black/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/30 transition-colors hover:border-white/20 hover:text-white/65"
                            title={t('entityDatabase.clearSearchHistory')}
                        >
                            {t('common.reset')}
                        </button>
                    </div>
                )}

                {searchActive && (
                    <div className="mb-3 rounded-xl border border-cyan-300/15 bg-cyan-400/10 p-2.5 shadow-inner">
                        <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-cyan-100/75">
                            <span className="flex items-center gap-2">
                                <Search size={12} />
                                {t('entityDatabase.searchMatches', { count: directSearchMatches.length })}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span className="font-mono text-white/35">{t('entityDatabase.searchContextCount', { count: visibleEntities.filter(entity => entity.id !== 'root').length })}</span>
                                <button
                                    type="button"
                                    onClick={handleSaveCurrentSearch}
                                    disabled={isCurrentSearchSaved}
                                    className={`inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                                        isCurrentSearchSaved
                                            ? 'cursor-default border-amber-200/10 bg-amber-300/10 text-amber-100/45'
                                            : 'border-amber-200/20 bg-amber-300/10 text-amber-50/70 hover:border-amber-100/35 hover:bg-amber-300/15 hover:text-amber-50'
                                    }`}
                                    title={isCurrentSearchSaved ? t('entityDatabase.searchAlreadySaved') : t('entityDatabase.saveCurrentSearch')}
                                >
                                    <Bookmark size={11} />
                                    {isCurrentSearchSaved ? t('entityDatabase.saved') : t('entityDatabase.save')}
                                </button>
                            </div>
                        </div>
                        {directSearchMatches.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('all')}
                                    className={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                        activeTab === 'all'
                                            ? 'border-cyan-200/35 bg-cyan-300/20 text-cyan-50'
                                            : 'border-white/10 bg-black/15 text-white/45 hover:border-white/20 hover:text-white/75'
                                    }`}
                                >
                                    {t('entityDatabase.all')} <span className="font-mono text-white/35">{directSearchMatches.length}</span>
                                </button>
                                {tabsToShow.map((group) => {
                                    const count = searchMatchCountsByType[group.type] || 0;
                                    if (count === 0) return null;
                                    return (
                                        <button
                                            key={group.type}
                                            type="button"
                                            onClick={() => setActiveTab(group.type)}
                                            className={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                                activeTab === group.type
                                                    ? 'border-cyan-200/35 bg-cyan-300/20 text-cyan-50'
                                                    : 'border-white/10 bg-black/15 text-white/45 hover:border-white/20 hover:text-white/75'
                                            }`}
                                        >
                                            {t(group.labelKey)} <span className="font-mono text-white/35">{count}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex flex-wrap gap-1 pb-1">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${activeTab === 'all' ? 'bg-white/20 text-white shadow-md' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/90'}`}
                    >
                        {t('entityDatabase.all')}
                    </button>
                    {tabsToShow.map(tab => (
                        <button
                            key={tab.type}
                            onClick={() => setActiveTab(tab.type)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${activeTab === tab.type ? tab.dot.replace('bg-', 'bg-').replace('500', '600') + ' text-white shadow-md' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/90'}`}
                        >
                            {t(tab.labelKey)}
                        </button>
                    ))}
                </div>

                {selectedEntities.length > 0 && (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-cyan-200/15 bg-cyan-300/[0.08] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-50/75">
                                {t('entityDatabase.selected', { count: selectedEntities.length })}
                            </div>
                            {bulkDeletableEntities.length !== selectedEntities.length && (
                                <div className="mt-0.5 truncate text-[9px] font-medium text-amber-100/55">
                                    {t('entityDatabase.deletableCount', { count: bulkDeletableEntities.length })}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={handleBulkDelete}
                                disabled={bulkDeleteRootIds.length === 0}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-300/20 bg-red-400/10 px-2.5 text-[10px] font-bold uppercase tracking-wider text-red-100/80 transition-colors hover:border-red-200/35 hover:bg-red-400/20 hover:text-white disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/25"
                                title={t('entityDatabase.bulkDelete.buttonTitle')}
                            >
                                <Trash2 size={13} />
                                {t('common.delete')}
                            </button>
                            <button
                                type="button"
                                onClick={clearEntitySelection}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-white/45 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                                title={t('entityDatabase.clearSelection')}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-32 custom-scrollbar">
                <div className="flex flex-col gap-2">
                    {showRootCanvas && activeTab === 'all' && (!searchActive || visibleEntities.some(e => e.parentId === 'root')) && (() => {
                        // Create a fake entity object for the root canvas 
                        const rootEntity: import('../../types').Entity = {
                            id: 'root',
                            parentId: null,
                            type: 'canvas',
                            name: t('entityDatabase.rootCanvasName'),
                            description: '',
                            tags: [],
                            properties: {}
                        };
                        return (
                            <RecursiveEntityItem
                                key="root"
                                entity={rootEntity}
                                entities={visibleEntities}
                                searchActive={searchActive}
                                defaultGroupContext={EntityGroups.find(g => g.type === 'canvas')!}
                                baseParentId={baseParentId}
                                targetDb={targetDb}
                                targetPlayerOwner={targetPlayerOwner}
                                onPromptDrop={handlePromptDrop}
                                renamingId={renamingId}
                                onRenameStart={handleRenameStart}
                                onRenameSubmit={handleRenameSubmit}
                                onRenameCancel={handleRenameCancel}
                                onShowContextMenu={handleShowContextMenu}
                                canModifyEntityInUi={canModifyEntityInUi}
                                canModifyTargetDb={canModifyTargetDb}
                                searchResultsById={searchResultsById}
                                searchTerms={searchTerms}
                                selectedEntityIds={selectedEntityIdSet}
                                onEntitySelectionClick={handleEntitySelectionClick}
                            />
                        );
                    })()}

                    {searchActive && activeTab === 'all' && !hasVisibleSearchResults && (
                        <div className="text-[10px] text-white/40 italic px-3 py-5 bg-black/20 rounded-lg border border-white/10 border-dashed text-center">
                            {t('entityDatabase.noSearchResults')}
                        </div>
                    )}

                    {tabsToShow.map(group => {
                        if (activeTab !== 'all' && activeTab !== group.type) return null;

                        const groupEntities = visibleEntities.filter(e =>
                            e.parentId === baseParentId &&
                            e.id !== 'root' &&
                            (e.type === group.type || (e.type === 'folder' && e.properties?.folderType === group.type))
                        );

                        if (groupEntities.length === 0 && activeTab === 'all') return null;

                        const isCollapsed = searchActive ? false : collapsedCategories[group.type] || false;

                        return (
                            <div key={group.type} className="mb-4 bg-black/20 rounded-xl border border-white/5 p-2 shadow-inner">
                                <div
                                    className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-white/5 cursor-pointer group hover:bg-white/5 rounded transition-all"
                                    onClick={() => setCollapsedCategories(p => ({ ...p, [group.type]: !isCollapsed }))}
                                >
                                    <h3 className={`text-xs font-bold uppercase tracking-wider border-l-2 pl-2 transition-colors ${group.text}`} style={{ borderLeftColor: 'currentColor' }}>
                                        {t(group.labelKey)} <span className="text-white/30 text-[10px] ml-1">({groupEntities.length})</span>
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        {canModifyTargetDb && baseParentId && baseParentId.includes('personal-inventory') && group.type === 'object' && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); addTestEntity('object'); }}
                                                className="rounded border border-white/10 bg-white/5 p-1 text-white/55 shadow-inner transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white"
                                                title={t('entityDatabase.quickCreate.object')}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                            </button>
                                        )}
                                        {canModifyTargetDb && (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); addTestEntity(group.type); }}
                                                    className="rounded border border-white/10 bg-white/5 p-1 text-white/55 shadow-inner transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white"
                                                    title={t('entityDatabase.createInGroup', { group: t(group.labelKey) })}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); addTestEntity('folder', group.type); }}
                                                    className="text-white/30 hover:text-white transition-colors flex items-center justify-center p-0.5 rounded hover:bg-white/10 border border-transparent hover:border-white/20"
                                                    title={t('entityDatabase.createFolder')}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></svg>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {!isCollapsed && (
                                    <div className="flex flex-col gap-1.5">
                                        {groupEntities.length === 0 ? (
                                            <div className="text-[10px] text-white/40 italic px-2 py-4 bg-black/20 rounded-lg border border-white/10 border-dashed text-center">{t('entityDatabase.emptyCategory')}</div>
                                        ) : (
                                            groupEntities.map(entity => (
                                                <RecursiveEntityItem
                                                    key={entity.id}
                                                    entity={entity}
                                                    entities={visibleEntities}
                                                    searchActive={searchActive}
                                                    defaultGroupContext={group}
                                                    baseParentId={baseParentId}
                                                    targetDb={targetDb}
                                                    targetPlayerOwner={targetPlayerOwner}
                                                    onPromptDrop={handlePromptDrop}
                                                    renamingId={renamingId}
                                                    onRenameStart={handleRenameStart}
                                                    onRenameSubmit={handleRenameSubmit}
                                                    onRenameCancel={handleRenameCancel}
                                                    onShowContextMenu={handleShowContextMenu}
                                                    canModifyEntityInUi={canModifyEntityInUi}
                                                    canModifyTargetDb={canModifyTargetDb}
                                                    searchResultsById={searchResultsById}
                                                    searchTerms={searchTerms}
                                                    selectedEntityIds={selectedEntityIdSet}
                                                    onEntitySelectionClick={handleEntitySelectionClick}
                                                />
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <DragDropPopover data={dragDropPrompt} />

            {/* Custom context menu for entity items */}
            <EntityContextMenu
                state={contextMenuState}
                canEdit={contextMenuCanEdit}
                canShowInExplorer={contextMenuCanShowInExplorer}
                canAddToCanvas={contextMenuCanAddToCanvas}
                hasParent={Boolean(contextMenuParentEntity)}
                quickCreateActions={contextMenuQuickCreateActions}
                onRename={handleRenameStart}
                onDuplicate={handleDuplicateEntity}
                onCreateChild={handleCreateChildEntity}
                onOpenWindow={handleOpenEntityById}
                onAddToCanvas={handleAddEntityToCanvas}
                onOpenParent={handleOpenParentEntity}
                onCopyWikiLink={handleCopyWikiLink}
                onCopyId={handleCopyEntityId}
                onShowInExplorer={handleShowInExplorer}
                onExport={handleExportEntity}
                onGiveToPlayer={getIsHost() && contextMenuCanEdit ? handleGiveToPlayer : undefined}
                onDelete={(id) => {
                    const ent = entities.find(e => e.id === id);
                    if (ent) {
                        openConfirm({
                            title: t('entityWindow.deleteConfirm.title'),
                            description: t('entityWindow.deleteConfirm.description', { name: ent.name }),
                            confirmText: t('common.delete'),
                            isDestructive: true,
                            onConfirm: () => {
                                yjsStore.deleteEntity(id);
                                useWindowStore.getState().closeWindow(id);
                            }
                        });
                    }
                }}
                onClose={handleCloseContextMenu}
            />

            {/* Give to Player popup */}
            {giveToPlayerEntityId && ReactDOM.createPortal(
                <>
                    <div
                        className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
                        onClick={() => { setGiveToPlayerEntityId(null); setGiveToPlayerList([]); }}
                    />
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
                        <div className="pointer-events-auto bg-[#151c2b]/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.7)] w-[320px] max-h-[60vh] flex flex-col animate-in zoom-in-95 fade-in duration-200">
                            <div className="flex items-center justify-between p-4 border-b border-white/10">
                                <div>
                                    <h3 className="text-sm font-bold text-white">{t('entityDatabase.giveToPlayer.title')}</h3>
                                    <p className="text-xs text-white/50 mt-0.5">{t('entityDatabase.giveToPlayer.subtitle')}</p>
                                </div>
                                <button
                                    onClick={() => { setGiveToPlayerEntityId(null); setGiveToPlayerList([]); }}
                                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-1.5">
                                {giveToPlayerList.length === 0 ? (
                                    <div className="text-center text-white/30 text-xs py-8 italic">
                                        {t('entityDatabase.giveToPlayer.noPlayers')}
                                    </div>
                                ) : (
                                    giveToPlayerList.map(playerName => (
                                        <button
                                            key={playerName}
                                            onClick={() => handleGiveToPlayerSelect(playerName)}
                                            className="w-full text-left p-3 rounded-xl border border-transparent bg-white/5 hover:bg-violet-500/15 hover:border-violet-500/30 transition-all flex items-center gap-3"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
                                                <User size={14} />
                                            </div>
                                            <div>
                                                <div className="text-sm text-white/80 font-medium">{playerName}</div>
                                                <div className="text-[10px] text-white/30">{t('entityDatabase.giveToPlayer.playerInventory')}</div>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}
