import { useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, Box, FileText, Grid2X2, Layers, Link2, ListTree, Network, PanelLeft, PanelRight, Plus, RotateCcw, Save, Trash2, User, X } from 'lucide-react';
import { useEntities } from '../../hooks/useEntities';
import { useNotesWorkspaceStore } from '../../store/notesWorkspaceStore';
import {
    deleteNamedWindowLayoutSnapshot,
    listNamedWindowLayoutSnapshots,
    restoreWindowLayoutSnapshot,
    restoreNamedWindowLayoutSnapshot,
    saveCurrentWindowLayoutSnapshot,
    saveNamedWindowLayoutSnapshot,
    useWindowStore,
} from '../../store/windowStore';
import { yjsStore } from '../../store/yjsStore';
import { EntityLink } from '../ui/EntityLink';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';
import { buildNotesWorkspaceLinkedViews } from '../../utils/notesWorkspaceLinks';
import { listNotesWorkspaceGroups, type NotesWorkspaceNode, type NotesWorkspaceTab, type NotesWorkspaceView } from '../../utils/notesWorkspaceLayout';
import { canViewEntity } from '../../utils/permissions';
import { glass } from '../../utils/theme';
import type { Entity, EntityType } from '../../types';

interface QuickSectionConfig {
    type: EntityType;
    icon: LucideIcon;
    titleKey: string;
}

const QUICK_SECTIONS: QuickSectionConfig[] = [
    { type: 'note', icon: FileText, titleKey: 'workspace.notes.quickNotes' },
    { type: 'character', icon: User, titleKey: 'workspace.notes.quickCharacters' },
    { type: 'object', icon: Box, titleKey: 'workspace.notes.quickObjects' },
    { type: 'ability', icon: BookOpen, titleKey: 'workspace.notes.quickAbilities' },
];

const VIEW_LABEL_KEYS: Record<NotesWorkspaceView, string> = {
    entity: 'workspace.notes.views.entity',
    markdown: 'workspace.notes.views.markdown',
    graph: 'workspace.notes.views.graph',
    backlinks: 'workspace.notes.views.backlinks',
    outline: 'workspace.notes.views.outline',
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

const NOTES_WORKSPACE_TAB_MIME = 'application/vnd.vibe-notes-workspace-tab';

interface NotesWorkspaceTabDragPayload {
    groupId: string;
    tabId: string;
}

function readTabDragPayload(event: DragEvent): NotesWorkspaceTabDragPayload | null {
    try {
        const data = event.dataTransfer.getData(NOTES_WORKSPACE_TAB_MIME);
        if (!data) return null;

        const parsed = JSON.parse(data);
        if (!parsed || typeof parsed.groupId !== 'string' || typeof parsed.tabId !== 'string') return null;
        return parsed;
    } catch {
        return null;
    }
}

function getEntityOwnerId(entity: Entity): string | undefined {
    const owner = entity.properties?._playerOwner;
    return typeof owner === 'string' ? owner : undefined;
}

function canShowEntityInWorkspace(entity: Entity): boolean {
    return canViewEntity(
        yjsStore.localRole,
        entity.database ?? 'general',
        getEntityOwnerId(entity),
        yjsStore.localPlayerId,
        yjsStore.localPlayerName
    );
}

function sortByName(left: Entity, right: Entity): number {
    return left.name.localeCompare(right.name, 'ru', { sensitivity: 'base' });
}

function getActiveTab(tabs: NotesWorkspaceTab[], activeTabId: string | null): NotesWorkspaceTab | null {
    return tabs.find((tab) => tab.id === activeTabId) ?? tabs.at(-1) ?? null;
}

interface NotesWorkspaceNodeViewProps {
    node: NotesWorkspaceNode;
    activeGroupId: string;
    groupOrder: Map<string, number>;
    entitiesById: Map<string, Entity>;
    visibleEntities: Entity[];
    onSetActiveGroup: (groupId: string) => void;
    onSetActiveTab: (groupId: string, tabId: string) => void;
    onCloseTab: (groupId: string, tabId: string) => void;
    onSplitGroup: (groupId: string, direction: 'row' | 'column') => void;
    onMoveTab: (sourceGroupId: string, tabId: string, targetGroupId: string, beforeTabId?: string | null) => void;
    onOpenView: (entityId: string, view: NotesWorkspaceView) => void;
    onFocusEntity: (entityId: string) => void;
    t: Translate;
}

function NotesWorkspaceNodeView(props: NotesWorkspaceNodeViewProps) {
    const { node } = props;

    if (node.type === 'split') {
        return (
            <div className={`flex min-h-0 flex-1 gap-3 ${node.direction === 'row' ? 'flex-row' : 'flex-col'}`}>
                <div className="min-h-0 min-w-0 flex-1">
                    <NotesWorkspaceNodeView {...props} node={node.children[0]} />
                </div>
                <div className="min-h-0 min-w-0 flex-1">
                    <NotesWorkspaceNodeView {...props} node={node.children[1]} />
                </div>
            </div>
        );
    }

    const {
        activeGroupId,
        groupOrder,
        entitiesById,
        visibleEntities,
        onCloseTab,
        onFocusEntity,
        onMoveTab,
        onOpenView,
        onSetActiveGroup,
        onSetActiveTab,
        onSplitGroup,
        t,
    } = props;
    const isActiveGroup = node.id === activeGroupId;
    const activeTab = getActiveTab(node.tabs, node.activeTabId);
    const activeEntity = activeTab ? entitiesById.get(activeTab.entityId) : null;
    const groupIndex = groupOrder.get(node.id) ?? 1;
    const linkedViews = activeEntity ? buildNotesWorkspaceLinkedViews(activeEntity, visibleEntities) : null;
    const viewButtonClass = (view: NotesWorkspaceView) => `flex items-center gap-1.5 rounded-[var(--vibe-radius-sm)] border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
        activeTab?.view === view
            ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-surface-hover)] text-[var(--vibe-text-primary)]'
            : 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)] hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
    }`;

    return (
        <div
            className={`flex h-full min-h-[190px] min-w-0 flex-col overflow-hidden rounded-[var(--vibe-radius-md)] border bg-[var(--vibe-surface-input)] transition-colors ${
                isActiveGroup
                    ? 'border-[var(--vibe-accent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--vibe-accent)_35%,transparent)]'
                    : 'border-[var(--vibe-border-subtle)]'
            }`}
            onMouseDown={() => onSetActiveGroup(node.id)}
        >
            <div className="flex min-h-10 items-center justify-between gap-2 border-b border-[var(--vibe-border-subtle)] px-2.5 py-2">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-1 font-mono text-[10px] text-[var(--vibe-text-muted)]">
                        {t('workspace.notes.groupLabel', { index: groupIndex })}
                    </span>
                    {isActiveGroup && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-accent)]">
                            {t('workspace.notes.activeGroup')}
                        </span>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onSplitGroup(node.id, 'row');
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-[var(--vibe-radius-sm)] text-[var(--vibe-text-faint)] transition-colors hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                        title={t('workspace.notes.splitRow')}
                    >
                        <PanelLeft size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onSplitGroup(node.id, 'column');
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-[var(--vibe-radius-sm)] text-[var(--vibe-text-faint)] transition-colors hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                        title={t('workspace.notes.splitColumn')}
                    >
                        <PanelRight size={14} />
                    </button>
                </div>
            </div>

            <div
                className="flex min-h-10 shrink-0 gap-1 overflow-x-auto border-b border-[var(--vibe-border-subtle)] px-2 py-1.5"
                onDragOver={(event) => {
                    if (event.dataTransfer.types.includes(NOTES_WORKSPACE_TAB_MIME)) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                    }
                }}
                onDrop={(event) => {
                    const payload = readTabDragPayload(event);
                    if (!payload) return;

                    event.preventDefault();
                    event.stopPropagation();
                    onMoveTab(payload.groupId, payload.tabId, node.id, null);
                }}
            >
                {node.tabs.length === 0 ? (
                    <span className="flex items-center px-2 text-xs text-[var(--vibe-text-faint)]">
                        {t('workspace.notes.emptyGroup')}
                    </span>
                ) : node.tabs.map((tab) => {
                    const entity = entitiesById.get(tab.entityId);
                    const isActiveTab = tab.id === activeTab?.id;
                    return (
                        <div
                            key={tab.id}
                            draggable
                            onDragStart={(event) => {
                                event.dataTransfer.effectAllowed = 'move';
                                event.dataTransfer.setData(NOTES_WORKSPACE_TAB_MIME, JSON.stringify({ groupId: node.id, tabId: tab.id }));
                            }}
                            onDragOver={(event) => {
                                if (event.dataTransfer.types.includes(NOTES_WORKSPACE_TAB_MIME)) {
                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = 'move';
                                }
                            }}
                            onDrop={(event) => {
                                const payload = readTabDragPayload(event);
                                if (!payload) return;

                                event.preventDefault();
                                event.stopPropagation();
                                onMoveTab(payload.groupId, payload.tabId, node.id, tab.id);
                            }}
                            className={`group flex h-8 max-w-[220px] shrink-0 items-center gap-2 rounded-[var(--vibe-radius-sm)] border px-2 text-left text-xs transition-colors ${
                                isActiveTab
                                    ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-surface-hover)] text-[var(--vibe-text-primary)]'
                                    : 'border-transparent text-[var(--vibe-text-muted)] hover:border-[var(--vibe-border-subtle)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                            }`}
                            title={entity?.name ?? tab.entityId}
                        >
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onSetActiveTab(node.id, tab.id);
                                    onFocusEntity(tab.entityId);
                                }}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                                <span className="min-w-0 truncate font-bold">
                                    {entity?.name ?? tab.entityId}
                                </span>
                                <span className="shrink-0 text-[9px] uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                    {t(VIEW_LABEL_KEYS[tab.view])}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onCloseTab(node.id, tab.id);
                                }}
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--vibe-radius-sm)] text-[var(--vibe-text-faint)] opacity-70 transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-danger)_16%,transparent)] hover:text-[var(--vibe-danger)] group-hover:opacity-100"
                                title={t('workspace.notes.closeTab')}
                            >
                                <X size={11} />
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="min-h-0 flex-1 p-3">
                {!activeTab ? (
                    <div className="flex h-full min-h-[120px] items-center justify-center rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] text-xs text-[var(--vibe-text-faint)]">
                        {t('workspace.notes.emptyGroup')}
                    </div>
                ) : (
                    <div className="flex h-full min-h-[120px] flex-col justify-between rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] p-3">
                        <div className="min-w-0">
                            <div className="mb-3 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-[var(--vibe-text-primary)]">
                                        {activeEntity?.name ?? t('workspace.notes.missingEntity')}
                                    </p>
                                    <p className="mt-1 truncate text-[10px] uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                        {activeEntity?.type ?? 'entity'} / {activeEntity?.database ?? 'general'}
                                    </p>
                                </div>
                                <FileText size={18} className="shrink-0 text-[var(--vibe-accent)]" />
                            </div>
                            <div className="mb-3 flex flex-wrap gap-1.5">
                                <button type="button" className={viewButtonClass('entity')} onClick={(event) => { event.stopPropagation(); onOpenView(activeTab.entityId, 'entity'); }}>
                                    <FileText size={11} />
                                    {t(VIEW_LABEL_KEYS.entity)}
                                </button>
                                <button type="button" className={viewButtonClass('markdown')} onClick={(event) => { event.stopPropagation(); onOpenView(activeTab.entityId, 'markdown'); }}>
                                    <BookOpen size={11} />
                                    {t(VIEW_LABEL_KEYS.markdown)}
                                </button>
                                <button type="button" className={viewButtonClass('outline')} onClick={(event) => { event.stopPropagation(); onOpenView(activeTab.entityId, 'outline'); }}>
                                    <ListTree size={11} />
                                    {t(VIEW_LABEL_KEYS.outline)}
                                </button>
                                <button type="button" className={viewButtonClass('backlinks')} onClick={(event) => { event.stopPropagation(); onOpenView(activeTab.entityId, 'backlinks'); }}>
                                    <Link2 size={11} />
                                    {t(VIEW_LABEL_KEYS.backlinks)}
                                </button>
                                <button type="button" className={viewButtonClass('graph')} onClick={(event) => { event.stopPropagation(); onOpenView(activeTab.entityId, 'graph'); }}>
                                    <Network size={11} />
                                    {t(VIEW_LABEL_KEYS.graph)}
                                </button>
                            </div>
                            <div className="min-h-0 max-h-[220px] overflow-y-auto rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3">
                                {activeTab.view === 'markdown' && activeEntity && (
                                    <MarkdownRenderer content={activeEntity.description || t('workspace.notes.emptyMarkdown')} entityId={activeEntity.id} allowCustomBlocks={false} />
                                )}
                                {activeTab.view === 'outline' && (
                                    linkedViews?.outline.length ? (
                                        <div className="space-y-1">
                                            {linkedViews.outline.map((heading) => (
                                                <div
                                                    key={heading.id}
                                                    className="flex items-center gap-2 rounded-[var(--vibe-radius-sm)] px-2 py-1 text-xs text-[var(--vibe-text-muted)]"
                                                    style={{ paddingLeft: `${Math.min(heading.level - 1, 4) * 12 + 8}px` }}
                                                >
                                                    <span className="font-mono text-[10px] text-[var(--vibe-text-faint)]">L{heading.line}</span>
                                                    <span className="truncate font-bold text-[var(--vibe-text-primary)]">{heading.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-[var(--vibe-text-faint)]">{t('workspace.notes.noOutline')}</div>
                                    )
                                )}
                                {activeTab.view === 'backlinks' && (
                                    linkedViews?.backlinks.length ? (
                                        <div className="space-y-1.5">
                                            {linkedViews.backlinks.map((backlink) => (
                                                <EntityLink
                                                    key={backlink.id}
                                                    entityId={backlink.id}
                                                    underline={false}
                                                    className="flex rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2.5 py-2 text-xs font-bold text-[var(--vibe-text-muted)] hover:border-[var(--vibe-border-strong)] hover:text-[var(--vibe-text-primary)]"
                                                >
                                                    <span className="truncate">{backlink.name}</span>
                                                </EntityLink>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-[var(--vibe-text-faint)]">{t('workspace.notes.noBacklinks')}</div>
                                    )
                                )}
                                {activeTab.view === 'graph' && (
                                    <div className="space-y-3">
                                        <div>
                                            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                                {t('workspace.notes.outgoingLinks')}
                                            </div>
                                            {linkedViews?.outgoingLinks.length ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {linkedViews.outgoingLinks.map((link, index) => (
                                                        link.resolvedEntityId ? (
                                                            <EntityLink
                                                                key={`${link.raw}-${index}`}
                                                                entityId={link.resolvedEntityId}
                                                                underline={false}
                                                                className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-1 text-xs text-[var(--vibe-text-muted)] hover:border-[var(--vibe-border-strong)] hover:text-[var(--vibe-text-primary)]"
                                                            >
                                                                <span>{link.label ?? link.target}</span>
                                                            </EntityLink>
                                                        ) : (
                                                            <span key={`${link.raw}-${index}`} className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] px-2 py-1 text-xs text-[var(--vibe-text-faint)]">
                                                                {link.label ?? link.target}
                                                            </span>
                                                        )
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-[var(--vibe-text-faint)]">{t('workspace.notes.noOutgoingLinks')}</div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                                {t('workspace.notes.incomingLinks')}
                                            </div>
                                            {linkedViews?.backlinks.length ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {linkedViews.backlinks.map((backlink) => (
                                                        <EntityLink
                                                            key={backlink.id}
                                                            entityId={backlink.id}
                                                            underline={false}
                                                            className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-1 text-xs text-[var(--vibe-text-muted)] hover:border-[var(--vibe-border-strong)] hover:text-[var(--vibe-text-primary)]"
                                                        >
                                                            <span>{backlink.name}</span>
                                                        </EntityLink>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-[var(--vibe-text-faint)]">{t('workspace.notes.noBacklinks')}</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {activeTab.view === 'entity' && (
                                    <div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wider text-[var(--vibe-text-muted)]">
                                        <span className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-1">
                                            {t(VIEW_LABEL_KEYS[activeTab.view])}
                                        </span>
                                        <span className="truncate rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-1">
                                            {activeTab.entityId}
                                        </span>
                                        <span className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-1">
                                            {t('workspace.notes.outlineCount', { count: linkedViews?.outline.length ?? 0 })}
                                        </span>
                                        <span className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-1">
                                            {t('workspace.notes.linkCount', { count: (linkedViews?.outgoingLinks.length ?? 0) + (linkedViews?.backlinks.length ?? 0) })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                onFocusEntity(activeTab.entityId);
                            }}
                            className="mt-3 flex items-center justify-center rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[var(--vibe-text-muted)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                        >
                            {t('workspace.notes.focusWindow')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export function NotesWorkspace() {
    const { t } = useTranslation();
    const [snapshotName, setSnapshotName] = useState('');
    const [namedSnapshots, setNamedSnapshots] = useState(() => listNamedWindowLayoutSnapshots());
    const entities = useEntities();
    const notesLayout = useNotesWorkspaceStore((state) => state.layout);
    const openWorkspaceTab = useNotesWorkspaceStore((state) => state.openTab);
    const closeWorkspaceTab = useNotesWorkspaceStore((state) => state.closeTab);
    const moveWorkspaceTab = useNotesWorkspaceStore((state) => state.moveTab);
    const setActiveWorkspaceGroup = useNotesWorkspaceStore((state) => state.setActiveGroup);
    const setActiveWorkspaceTab = useNotesWorkspaceStore((state) => state.setActiveTab);
    const splitActiveWorkspaceGroup = useNotesWorkspaceStore((state) => state.splitActiveGroup);
    const resetWorkspaceLayout = useNotesWorkspaceStore((state) => state.resetLayout);
    const windows = useWindowStore((state) => state.windows);
    const focusWindow = useWindowStore((state) => state.focusWindow);
    const openWindow = useWindowStore((state) => state.openWindow);
    const arrangeVisibleWindowsGrid = useWindowStore((state) => state.arrangeVisibleWindowsGrid);
    const cascadeVisibleWindows = useWindowStore((state) => state.cascadeVisibleWindows);

    const visibleEntities = useMemo(
        () => entities.filter((entity) => entity.type !== 'folder' && canShowEntityInWorkspace(entity)).sort(sortByName),
        [entities]
    );

    const entitiesById = useMemo(
        () => new Map(visibleEntities.map((entity) => [entity.id, entity])),
        [visibleEntities]
    );

    const screenWindows = useMemo(
        () => Object.values(windows)
            .filter((win) => !win.isPinned)
            .sort((left, right) => right.zIndex - left.zIndex),
        [windows]
    );

    const quickEntitiesByType = useMemo(
        () => new Map(
            QUICK_SECTIONS.map((section) => [
                section.type,
                visibleEntities.filter((entity) => entity.type === section.type).slice(0, 6),
            ])
        ),
        [visibleEntities]
    );

    const workspaceGroupOrder = useMemo(
        () => new Map(listNotesWorkspaceGroups(notesLayout.root).map((group, index) => [group.id, index + 1])),
        [notesLayout.root]
    );

    const handleFocusEntity = (entityId: string, index = 0) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        openWindow(entityId, 140 + column * 72, 128 + row * 52);
    };

    const handleOpenEntity = (entity: Entity, index = 0) => {
        openWorkspaceTab(entity.id, 'entity');
        handleFocusEntity(entity.id, index);
    };

    const handleSplitWorkspaceGroup = (groupId: string, direction: 'row' | 'column') => {
        setActiveWorkspaceGroup(groupId);
        splitActiveWorkspaceGroup(direction);
    };

    const refreshNamedSnapshots = () => setNamedSnapshots(listNamedWindowLayoutSnapshots());

    const handleSaveNamedSnapshot = () => {
        const snapshot = saveNamedWindowLayoutSnapshot(snapshotName);
        if (!snapshot) return;
        setSnapshotName('');
        refreshNamedSnapshots();
    };

    const handleRestoreNamedSnapshot = (id: string) => {
        if (restoreNamedWindowLayoutSnapshot(id)) refreshNamedSnapshots();
    };

    const handleDeleteNamedSnapshot = (id: string) => {
        if (deleteNamedWindowLayoutSnapshot(id)) refreshNamedSnapshots();
    };

    const actionButtonClass = `flex items-center justify-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[var(--vibe-text-muted)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]`;

    return (
        <div className="absolute inset-0 overflow-hidden bg-[var(--vibe-body-bg)]">
            <div
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{
                    backgroundImage: `
                        linear-gradient(90deg, color-mix(in_srgb, var(--vibe-border-subtle) 45%, transparent) 1px, transparent 1px),
                        linear-gradient(0deg, color-mix(in_srgb, var(--vibe-border-subtle) 35%, transparent) 1px, transparent 1px)
                    `,
                    backgroundSize: '44px 44px',
                }}
            />
            <main className="relative z-[1] flex h-full min-h-0 gap-4 px-24 pb-8 pt-28">
                <aside className={`flex w-[320px] min-w-[280px] flex-col overflow-hidden rounded-[var(--vibe-radius-lg)] ${glass.panel}`}>
                    <div className={`${glass.panelHeader} p-4`}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-accent)]">
                            {t('workspace.notes.kicker')}
                        </p>
                        <h2 className="mt-1 text-lg font-black leading-tight text-[var(--vibe-text-primary)]">
                            {t('workspace.notes.title')}
                        </h2>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--vibe-text-faint)]">
                            {t('workspace.notes.subtitle')}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-3">
                        <button type="button" className={actionButtonClass} onClick={arrangeVisibleWindowsGrid}>
                            <Grid2X2 size={14} />
                            {t('workspace.notes.grid')}
                        </button>
                        <button type="button" className={actionButtonClass} onClick={cascadeVisibleWindows}>
                            <Layers size={14} />
                            {t('workspace.notes.cascade')}
                        </button>
                        <button type="button" className={actionButtonClass} onClick={saveCurrentWindowLayoutSnapshot}>
                            <Save size={14} />
                            {t('workspace.notes.save')}
                        </button>
                        <button type="button" className={actionButtonClass} onClick={restoreWindowLayoutSnapshot}>
                            <RotateCcw size={14} />
                            {t('workspace.notes.restore')}
                        </button>
                    </div>

                    <div className="border-t border-[var(--vibe-border-subtle)] p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                                {t('workspace.notes.namedSnapshots')}
                            </span>
                            <span className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-0.5 font-mono text-[10px] text-[var(--vibe-text-muted)]">
                                {namedSnapshots.length}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={snapshotName}
                                onChange={(event) => setSnapshotName(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') handleSaveNamedSnapshot();
                                }}
                                className="min-w-0 flex-1 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-3 py-2 text-xs text-[var(--vibe-text-primary)] outline-none transition-colors placeholder:text-[var(--vibe-text-faint)] focus:border-[var(--vibe-border-strong)]"
                                placeholder={t('workspace.notes.snapshotNamePlaceholder')}
                            />
                            <button
                                type="button"
                                onClick={handleSaveNamedSnapshot}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-accent)]"
                                title={t('workspace.notes.saveNamedSnapshot')}
                            >
                                <Plus size={15} />
                            </button>
                        </div>

                        <div className="mt-2 max-h-[150px] space-y-1.5 overflow-y-auto">
                            {namedSnapshots.length === 0 ? (
                                <div className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] p-3 text-center text-xs text-[var(--vibe-text-faint)]">
                                    {t('workspace.notes.noNamedSnapshots')}
                                </div>
                            ) : namedSnapshots.map((snapshot) => (
                                <div
                                    key={snapshot.id}
                                    className="group flex min-w-0 items-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1.5"
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleRestoreNamedSnapshot(snapshot.id)}
                                        className="min-w-0 flex-1 text-left"
                                        title={t('workspace.notes.restoreNamedSnapshot')}
                                    >
                                        <span className="block truncate text-xs font-bold text-[var(--vibe-text-primary)]">
                                            {snapshot.name}
                                        </span>
                                        <span className="block truncate text-[10px] text-[var(--vibe-text-faint)]">
                                            {t('workspace.notes.snapshotMeta', { count: snapshot.windowCount })}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteNamedSnapshot(snapshot.id)}
                                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--vibe-radius-sm)] text-[var(--vibe-text-faint)] opacity-80 transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-danger)_16%,transparent)] hover:text-[var(--vibe-danger)] group-hover:opacity-100"
                                        title={t('workspace.notes.deleteNamedSnapshot')}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--vibe-border-subtle)] p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                                {t('workspace.notes.openWindows')}
                            </span>
                            <span className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-0.5 font-mono text-[10px] text-[var(--vibe-text-muted)]">
                                {screenWindows.length}
                            </span>
                        </div>

                        {screenWindows.length === 0 ? (
                            <div className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] p-4 text-center text-xs text-[var(--vibe-text-faint)]">
                                {t('workspace.notes.noOpenWindows')}
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {screenWindows.map((win) => {
                                    const entity = entitiesById.get(win.entityId);
                                    return (
                                        <button
                                            key={win.id}
                                            type="button"
                                            onClick={() => focusWindow(win.id)}
                                            className="flex w-full min-w-0 items-center justify-between gap-3 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-3 py-2 text-left transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]"
                                        >
                                            <span className="min-w-0 truncate text-xs font-bold text-[var(--vibe-text-primary)]">
                                                {entity?.name ?? win.entityId}
                                            </span>
                                            <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                                {win.mode}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </aside>

                <section className="flex min-w-0 flex-1 flex-col gap-4">
                    <div className={`flex items-center justify-between rounded-[var(--vibe-radius-lg)] p-4 ${glass.panel}`}>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                                {t('workspace.notes.quickAccess')}
                            </p>
                            <h1 className="mt-1 text-xl font-black text-[var(--vibe-text-primary)]">
                                {t('workspace.notes.surfaceTitle')}
                            </h1>
                        </div>
                        <div className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-3 py-2 text-xs font-bold text-[var(--vibe-text-muted)]">
                            {t('workspace.notes.availableCount', { count: visibleEntities.length })}
                        </div>
                    </div>

                    <div className={`flex min-h-[300px] max-h-[42vh] flex-col overflow-hidden rounded-[var(--vibe-radius-lg)] ${glass.panel}`}>
                        <div className={`${glass.panelHeader} flex items-center justify-between gap-3 p-3`}>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-accent)]">
                                    {t('workspace.notes.tabsBoard')}
                                </p>
                                <h3 className="mt-1 truncate text-sm font-black text-[var(--vibe-text-primary)]">
                                    {t('workspace.notes.tabsBoardTitle')}
                                </h3>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => splitActiveWorkspaceGroup('row')}
                                    className="flex h-8 w-8 items-center justify-center rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                                    title={t('workspace.notes.splitRow')}
                                >
                                    <PanelLeft size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => splitActiveWorkspaceGroup('column')}
                                    className="flex h-8 w-8 items-center justify-center rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                                    title={t('workspace.notes.splitColumn')}
                                >
                                    <PanelRight size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={resetWorkspaceLayout}
                                    className="flex h-8 w-8 items-center justify-center rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                                    title={t('workspace.notes.resetTabs')}
                                >
                                    <RotateCcw size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="min-h-0 flex-1 p-3">
                            <NotesWorkspaceNodeView
                                node={notesLayout.root}
                                activeGroupId={notesLayout.activeGroupId}
                                groupOrder={workspaceGroupOrder}
                                entitiesById={entitiesById}
                                visibleEntities={visibleEntities}
                                onSetActiveGroup={setActiveWorkspaceGroup}
                                onSetActiveTab={setActiveWorkspaceTab}
                                onCloseTab={closeWorkspaceTab}
                                onSplitGroup={handleSplitWorkspaceGroup}
                                onMoveTab={moveWorkspaceTab}
                                onOpenView={openWorkspaceTab}
                                onFocusEntity={handleFocusEntity}
                                t={t}
                            />
                        </div>
                    </div>

                    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto pb-12 xl:grid-cols-2">
                        {QUICK_SECTIONS.map((section) => {
                            const Icon = section.icon;
                            const sectionEntities = quickEntitiesByType.get(section.type) ?? [];

                            return (
                                <div key={section.type} className={`min-h-[220px] rounded-[var(--vibe-radius-lg)] ${glass.panel}`}>
                                    <div className={`${glass.panelHeader} flex items-center justify-between p-3`}>
                                        <div className="flex min-w-0 items-center gap-2">
                                            <Icon size={16} className="shrink-0 text-[var(--vibe-accent)]" />
                                            <span className="truncate text-xs font-black uppercase tracking-wider text-[var(--vibe-text-primary)]">
                                                {t(section.titleKey)}
                                            </span>
                                        </div>
                                        <span className="font-mono text-[10px] text-[var(--vibe-text-faint)]">
                                            {sectionEntities.length}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2 p-3 2xl:grid-cols-2">
                                        {sectionEntities.length === 0 ? (
                                            <div className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] p-4 text-center text-xs text-[var(--vibe-text-faint)]">
                                                {t('workspace.notes.emptySection')}
                                            </div>
                                        ) : sectionEntities.map((entity, index) => (
                                            <button
                                                key={entity.id}
                                                type="button"
                                                onClick={() => handleOpenEntity(entity, index)}
                                                className="group flex min-h-[58px] min-w-0 flex-col justify-center rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-3 py-2 text-left transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]"
                                            >
                                                <span className="truncate text-sm font-bold text-[var(--vibe-text-primary)] transition-colors group-hover:text-[var(--vibe-accent)]">
                                                    {entity.name}
                                                </span>
                                                <span className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                                    {entity.database ?? 'general'}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </main>
        </div>
    );
}
