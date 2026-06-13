import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties, DragEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import {
    BookOpen,
    Boxes,
    Box,
    Bold,
    Bell,
    ChevronRight,
    Code2,
    Columns2,
    Copy,
    Database,
    Eye,
    FileText,
    Folder,
    GitFork,
    Heading1,
    Hash,
    Italic,
    LayoutGrid,
    List,
    Link2,
    ListTree,
    Lock,
    LogOut,
    Map as MapIcon,
    Network,
    PanelLeft,
    PanelRight,
    Pin,
    PencilLine,
    Quote,
    RotateCcw,
    Search,
    Settings,
    Shield,
    Tags,
    TableProperties,
    User,
    Volume2,
    X,
} from 'lucide-react';
import { useEntities } from '../../hooks/useEntities';
import { useAppModuleEnabled } from '../../hooks/useAppModuleEnablement';
import { useCanvasStore } from '../../store/canvasStore';
import { useNotesWorkspaceStore } from '../../store/notesWorkspaceStore';
import { yjsStore } from '../../store/yjsStore';
import { WikiLinkTextarea } from '../ui/WikiLinkTextarea';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';
import { NotificationCenter } from '../ui/NotificationCenter';
import { CharacterSheet } from '../windows/CharacterSheet';
import { ObjectSheet } from '../windows/blocks/ObjectSheet';
import { AttackSheet } from '../windows/blocks/AttackSheet';
import { AbilitySheet } from '../windows/blocks/AbilitySheet';
import { EntityImageBlock } from '../windows/blocks/EntityImageBlock';
import { TagEditor } from '../windows/blocks/TagEditor';
import { buildNotesWorkspaceLinkedViews, type NotesWorkspaceLinkedViews } from '../../utils/notesWorkspaceLinks';
import { listNotesWorkspaceGroups, type NotesWorkspaceNode, type NotesWorkspaceSplitPlacement, type NotesWorkspaceTab, type NotesWorkspaceView } from '../../utils/notesWorkspaceLayout';
import {
    hasVisibleNotesShellModule,
    listImplementedNotesShellModules,
    listVisibleNotesShellModules,
    type NotesWorkspaceModuleDefinition,
} from '../../utils/notesWorkspaceModules';
import { getEntitySearchResult, getEntitySearchTerms, type EntitySearchMatchField, type EntitySearchResult } from '../../utils/entitySearch';
import { canModifyEntity, canViewEntity } from '../../utils/permissions';
import { writeClipboardText } from '../../utils/clipboard';
import {
    CANVAS_WINDOW_INSTANCES_PROPERTY,
    createCanvasWindowInstance,
    getNextCanvasWindowZIndex,
    readCanvasWindowInstances,
    upsertCanvasWindowInstance,
} from '../../utils/canvasPersistence';
import { NOTES_AUDIO_DOCK_HOST_ID } from '../../utils/notesWorkspaceConstants';
import { glass } from '../../utils/theme';
import type { WorkspaceMode } from '../../utils/workspaceMode';
import type { DatabaseType, Entity, EntityType } from '../../types';

const VIEW_LABEL_KEYS: Record<NotesWorkspaceView, string> = {
    source: 'workspace.notes.views.source',
    preview: 'workspace.notes.views.preview',
    split: 'workspace.notes.views.split',
    ui: 'workspace.notes.views.ui',
    entity: 'workspace.notes.views.entity',
    graph: 'workspace.notes.views.graph',
    backlinks: 'workspace.notes.views.backlinks',
    outline: 'workspace.notes.views.outline',
};

const VIEW_CONFIGS: Array<{ view: NotesWorkspaceView; icon: LucideIcon }> = [
    { view: 'source', icon: PencilLine },
    { view: 'preview', icon: Eye },
    { view: 'split', icon: Columns2 },
    { view: 'ui', icon: LayoutGrid },
    { view: 'entity', icon: TableProperties },
    { view: 'outline', icon: ListTree },
    { view: 'backlinks', icon: Link2 },
    { view: 'graph', icon: Network },
];

const ENTITY_TYPE_ICONS: Record<EntityType, LucideIcon> = {
    character: User,
    object: Box,
    ability: BookOpen,
    competency: Hash,
    tag: Tags,
    canvas: Boxes,
    note: FileText,
    portal: GitFork,
    folder: Folder,
    attack: Shield,
};

const VAULT_GROUP_TYPES: EntityType[] = [
    'canvas',
    'character',
    'object',
    'competency',
    'ability',
    'note',
    'tag',
    'attack',
    'folder',
    'portal',
];

const NOTES_SHELL_MODULE_ICONS: Record<NotesWorkspaceModuleDefinition['iconKey'], LucideIcon> = {
    vault: Database,
    context: GitFork,
    notifications: Bell,
    search: Search,
    graph: Network,
    audio: Volume2,
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

const NOTES_WORKSPACE_TAB_MIME = 'application/vnd.vibe-notes-workspace-tab';

type NotesWorkspaceDropZone = 'left' | 'right' | 'top' | 'bottom';
type VaultScope = 'all' | DatabaseType | `user:${string}`;
type NotesShellResizeTarget = 'vault' | 'context' | 'audio';

interface NotesDockDropTarget {
    groupId: string;
    zone: NotesWorkspaceDropZone | null;
}

interface VaultScopeOption {
    value: VaultScope;
    label: string;
    count: number;
}

interface NotesWorkspaceProps {
    roomName: string;
    onLeave: () => void;
    onOpenInventory: () => void;
    onOpenSettings: () => void;
    onWorkspaceModeChange: (mode: WorkspaceMode) => void;
}

interface NotesWorkspaceTabDragPayload {
    groupId: string;
    tabId: string;
}

function readTabDragPayload(event: DragEvent): NotesWorkspaceTabDragPayload | null {
    try {
        const data = event.dataTransfer.getData(NOTES_WORKSPACE_TAB_MIME) || event.dataTransfer.getData('text/plain');
        if (!data) return null;

        const parsed = JSON.parse(data);
        if (!parsed || typeof parsed.groupId !== 'string' || typeof parsed.tabId !== 'string') return null;
        return parsed;
    } catch {
        return null;
    }
}

function hasTabDragPayload(event: DragEvent): boolean {
    return event.dataTransfer.types.includes(NOTES_WORKSPACE_TAB_MIME)
        || event.dataTransfer.types.includes('text/plain');
}

function findDockGroupElement(clientX: number, clientY: number): HTMLElement | null {
    const element = document.elementFromPoint(clientX, clientY);
    return element?.closest<HTMLElement>('[data-notes-group-id]') ?? null;
}

function getNotesDockDropZone(element: HTMLElement, clientX: number, clientY: number): NotesWorkspaceDropZone | null {
    const rect = element.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const edgeX = Math.min(Math.max(rect.width * 0.22, 56), 140);
    const edgeY = Math.min(Math.max(rect.height * 0.22, 48), 120);

    if (x < edgeX) return 'left';
    if (x > rect.width - edgeX) return 'right';
    if (y < edgeY) return 'top';
    if (y > rect.height - edgeY) return 'bottom';
    return null;
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

function canEditEntityInWorkspace(entity: Entity): boolean {
    return canModifyEntity(
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

function getPropertyRows(entity: Entity): Array<[string, unknown]> {
    return Object.entries(entity.properties ?? {})
        .filter(([key]) => !key.startsWith('_') && key !== 'canvasWindowInstances')
        .slice(0, 18);
}

function formatPropertyValue(value: unknown): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function buildChildrenByParent(entities: Entity[]): Map<string | null, Entity[]> {
    const result = new Map<string | null, Entity[]>();
    for (const entity of entities) {
        const key = entity.parentId ?? null;
        const list = result.get(key) ?? [];
        list.push(entity);
        result.set(key, list);
    }

    for (const list of result.values()) {
        list.sort(sortByName);
    }

    return result;
}

function getRootEntities(entities: Entity[], childrenByParent: Map<string | null, Entity[]>): Entity[] {
    const visibleIds = new Set(entities.map((entity) => entity.id));
    return entities
        .filter((entity) => !entity.parentId || !visibleIds.has(entity.parentId))
        .sort((left, right) => {
            const leftHasChildren = (childrenByParent.get(left.id)?.length ?? 0) > 0;
            const rightHasChildren = (childrenByParent.get(right.id)?.length ?? 0) > 0;
            if (leftHasChildren !== rightHasChildren) return leftHasChildren ? -1 : 1;
            return sortByName(left, right);
        });
}

function getDatabaseTone(database: DatabaseType = 'general'): string {
    if (database === 'gm') return 'text-[var(--vibe-warning)]';
    if (database === 'user') return 'text-[var(--vibe-accent-2)]';
    return 'text-[var(--vibe-accent)]';
}

function getVaultScopeKey(entity: Entity): VaultScope {
    const database = entity.database ?? 'general';
    if (database !== 'user') return database;
    return `user:${getEntityOwnerId(entity) ?? 'personal'}`;
}

function matchesVaultScope(entity: Entity, scope: VaultScope): boolean {
    if (scope === 'all') return true;
    if (scope === 'general' || scope === 'gm') return (entity.database ?? 'general') === scope;
    return getVaultScopeKey(entity) === scope;
}

function getVaultScopeLabel(scope: VaultScope, t: Translate): string {
    if (scope === 'all') return t('workspace.notes.storageScopes.all');
    if (scope === 'general') return t('workspace.notes.storageScopes.general');
    if (scope === 'user') return t('workspace.notes.storageScopes.user');
    if (scope === 'gm') return t('workspace.notes.storageScopes.gm');

    const owner = scope.slice('user:'.length);
    return owner === 'personal'
        ? t('workspace.notes.storageScopes.personal')
        : t('workspace.notes.storageScopes.player', { player: owner });
}

function formatSearchFields(fields: EntitySearchMatchField[], t: Translate): string {
    return fields
        .map((field) => t(`workspace.notes.searchFields.${field}`))
        .filter(Boolean)
        .join(' · ');
}

function getVaultGroupType(entity: Entity): EntityType {
    const folderType = entity.type === 'folder' ? entity.properties?.folderType : undefined;
    if (typeof folderType === 'string' && VAULT_GROUP_TYPES.includes(folderType as EntityType)) {
        return folderType as EntityType;
    }

    return entity.type;
}

interface EntityTreeItemProps {
    entity: Entity;
    activeEntityId?: string;
    childrenByParent: Map<string | null, Entity[]>;
    depth: number;
    expandedEntityIds: Set<string>;
    onOpenEntity: (entityId: string, view?: NotesWorkspaceView) => void;
    onToggleExpanded: (entityId: string) => void;
    t: Translate;
}

function EntityTreeItem({
    entity,
    activeEntityId,
    childrenByParent,
    depth,
    expandedEntityIds,
    onOpenEntity,
    onToggleExpanded,
    t,
}: EntityTreeItemProps) {
    const children = childrenByParent.get(entity.id) ?? [];
    const Icon = ENTITY_TYPE_ICONS[entity.type] ?? FileText;
    const isActive = entity.id === activeEntityId;
    const hasChildren = children.length > 0;
    const isExpanded = expandedEntityIds.has(entity.id);

    return (
        <div>
            <div
                role="button"
                tabIndex={0}
                onClick={() => onOpenEntity(entity.id, 'source')}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onOpenEntity(entity.id, 'source');
                    }
                }}
                className={`group flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-[var(--vibe-radius-sm)] border px-2 text-left text-xs transition-colors ${
                    isActive
                        ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-surface-hover)] text-[var(--vibe-text-primary)]'
                        : 'border-transparent text-[var(--vibe-text-muted)] hover:border-[var(--vibe-border-subtle)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                }`}
                style={{ paddingLeft: `${Math.min(depth, 5) * 12 + 8}px` }}
                title={entity.name}
            >
                {hasChildren ? (
                    <button
                        type="button"
                        data-no-pane-drag
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggleExpanded(entity.id);
                        }}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--vibe-radius-sm)] text-[var(--vibe-text-faint)] transition-colors hover:bg-[var(--vibe-surface-input)] hover:text-[var(--vibe-text-primary)]"
                        title={isExpanded ? t('workspace.notes.collapseBranch') : t('workspace.notes.expandBranch')}
                    >
                        <ChevronRight size={13} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                ) : (
                    <span className="h-5 w-5 shrink-0" />
                )}
                <Icon size={14} className={`shrink-0 ${getDatabaseTone(entity.database)}`} />
                <span className="min-w-0 flex-1 truncate text-left font-bold">
                    {entity.name}
                </span>
                {hasChildren && (
                    <span className="shrink-0 rounded-[var(--vibe-radius-sm)] bg-[var(--vibe-surface-block)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--vibe-text-faint)]">
                        {children.length}
                    </span>
                )}
            </div>
            {hasChildren && isExpanded && (
                <div className="mt-0.5">
                    {children.map((child) => (
                        <EntityTreeItem
                            key={child.id}
                            entity={child}
                            activeEntityId={activeEntityId}
                            childrenByParent={childrenByParent}
                            depth={depth + 1}
                            expandedEntityIds={expandedEntityIds}
                            onOpenEntity={onOpenEntity}
                            onToggleExpanded={onToggleExpanded}
                            t={t}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

interface EntityListButtonProps {
    entity: Entity;
    onOpenEntity: (entityId: string, view?: NotesWorkspaceView) => void;
    t: Translate;
}

function EntityListButton({ entity, onOpenEntity, t }: EntityListButtonProps) {
    const Icon = ENTITY_TYPE_ICONS[entity.type] ?? FileText;

    return (
        <button
            type="button"
            onClick={() => onOpenEntity(entity.id, 'source')}
            className="group flex w-full min-w-0 items-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2.5 py-2 text-left transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]"
            title={entity.name}
        >
            <Icon size={14} className={`shrink-0 ${getDatabaseTone(entity.database)}`} />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-[var(--vibe-text-primary)]">{entity.name}</span>
                <span className="block truncate text-[10px] uppercase tracking-wider text-[var(--vibe-text-faint)]">
                    {t(`workspace.notes.entityTypes.${entity.type}`)} / {t(`workspace.notes.databases.${entity.database ?? 'general'}`)}
                </span>
            </span>
        </button>
    );
}

interface EntitySearchResultButtonProps {
    entity: Entity;
    result: EntitySearchResult;
    onOpenEntity: (entityId: string, view?: NotesWorkspaceView) => void;
    t: Translate;
}

function EntitySearchResultButton({ entity, result, onOpenEntity, t }: EntitySearchResultButtonProps) {
    const Icon = ENTITY_TYPE_ICONS[entity.type] ?? FileText;
    const matchedFields = formatSearchFields(result.matchedFields, t);

    return (
        <button
            type="button"
            onClick={() => onOpenEntity(entity.id, 'source')}
            className="group flex w-full min-w-0 items-start gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2.5 py-2 text-left transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]"
            title={entity.name}
        >
            <Icon size={14} className={`mt-0.5 shrink-0 ${getDatabaseTone(entity.database)}`} />
            <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-[var(--vibe-text-primary)]">{entity.name}</span>
                    <span className="shrink-0 font-mono text-[9px] text-[var(--vibe-text-faint)]">{Math.round(result.score)}</span>
                </span>
                <span className="mt-0.5 block truncate text-[10px] uppercase tracking-wider text-[var(--vibe-text-faint)]">
                    {t(`workspace.notes.entityTypes.${entity.type}`)} / {t(`workspace.notes.databases.${entity.database ?? 'general'}`)}
                </span>
                {matchedFields && (
                    <span className="mt-1 block truncate text-[10px] text-[var(--vibe-accent)]">
                        {matchedFields}
                    </span>
                )}
                {result.snippet && (
                    <span className="mt-1 block line-clamp-2 text-[11px] leading-4 text-[var(--vibe-text-muted)]">
                        {result.snippet}
                    </span>
                )}
            </span>
        </button>
    );
}

interface LinkedViewsPanelProps {
    linkedViews: NotesWorkspaceLinkedViews | null;
    entitiesById: Map<string, Entity>;
    onOpenEntity: (entityId: string, view?: NotesWorkspaceView) => void;
    t: Translate;
}

function LinkedViewsPanel({ linkedViews, entitiesById, onOpenEntity, t }: LinkedViewsPanelProps) {
    return (
        <div className="space-y-4">
            <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                        {t('workspace.notes.outline')}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--vibe-text-faint)]">
                        {linkedViews?.outline.length ?? 0}
                    </span>
                </div>
                {linkedViews?.outline.length ? (
                    <div className="space-y-1">
                        {linkedViews.outline.map((heading) => (
                            <div
                                key={heading.id}
                                className="flex items-center gap-2 rounded-[var(--vibe-radius-sm)] px-2 py-1 text-xs text-[var(--vibe-text-muted)]"
                                style={{ paddingLeft: `${Math.min(heading.level - 1, 4) * 10 + 8}px` }}
                            >
                                <span className="font-mono text-[10px] text-[var(--vibe-text-faint)]">L{heading.line}</span>
                                <span className="min-w-0 truncate font-bold text-[var(--vibe-text-primary)]">{heading.text}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-[var(--vibe-text-faint)]">{t('workspace.notes.noOutline')}</p>
                )}
            </section>

            <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                        {t('workspace.notes.outgoingLinks')}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--vibe-text-faint)]">
                        {linkedViews?.outgoingLinks.length ?? 0}
                    </span>
                </div>
                {linkedViews?.outgoingLinks.length ? (
                    <div className="flex flex-wrap gap-1.5">
                        {linkedViews.outgoingLinks.map((link, index) => {
                            const target = link.resolvedEntityId ? entitiesById.get(link.resolvedEntityId) : null;
                            if (!target) {
                                return (
                                    <span
                                        key={`${link.raw}-${index}`}
                                        className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] px-2 py-1 text-xs text-[var(--vibe-text-faint)]"
                                    >
                                        {link.label ?? link.target}
                                    </span>
                                );
                            }

                            return (
                                <button
                                    key={`${link.raw}-${index}`}
                                    type="button"
                                    onClick={() => onOpenEntity(target.id, 'source')}
                                    className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1 text-xs font-bold text-[var(--vibe-text-muted)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                                >
                                    {link.label ?? target.name}
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-xs text-[var(--vibe-text-faint)]">{t('workspace.notes.noOutgoingLinks')}</p>
                )}
            </section>

            <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                        {t('workspace.notes.incomingLinks')}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--vibe-text-faint)]">
                        {linkedViews?.backlinks.length ?? 0}
                    </span>
                </div>
                {linkedViews?.backlinks.length ? (
                    <div className="space-y-1.5">
                        {linkedViews.backlinks.map((backlink) => (
                            <EntityListButton key={backlink.id} entity={backlink} onOpenEntity={onOpenEntity} t={t} />
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-[var(--vibe-text-faint)]">{t('workspace.notes.noBacklinks')}</p>
                )}
            </section>
        </div>
    );
}

interface GraphSummaryPanelProps {
    entity: Entity;
    linkedViews: NotesWorkspaceLinkedViews | null;
    entitiesById: Map<string, Entity>;
    onOpenEntity: (entityId: string, view?: NotesWorkspaceView) => void;
    t: Translate;
}

function GraphSummaryPanel({ entity, linkedViews, entitiesById, onOpenEntity, t }: GraphSummaryPanelProps) {
    const outgoingEntities = (linkedViews?.outgoingLinks ?? [])
        .map((link) => link.resolvedEntityId ? entitiesById.get(link.resolvedEntityId) : null)
        .filter((candidate): candidate is Entity => Boolean(candidate));
    const backlinks = linkedViews?.backlinks ?? [];
    const hasLinks = outgoingEntities.length > 0 || backlinks.length > 0;

    const renderNode = (target: Entity, direction: 'incoming' | 'outgoing') => {
        const Icon = ENTITY_TYPE_ICONS[target.type] ?? FileText;
        return (
            <button
                key={`${direction}-${target.id}`}
                type="button"
                onClick={() => onOpenEntity(target.id, 'source')}
                className="group flex min-w-0 items-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-3 py-2 text-left transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]"
            >
                <Icon size={14} className={`shrink-0 ${getDatabaseTone(target.database)}`} />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-[var(--vibe-text-primary)]">{target.name}</span>
                    <span className="block truncate text-[10px] uppercase tracking-wider text-[var(--vibe-text-faint)]">
                        {t(`workspace.notes.entityTypes.${target.type}`)}
                    </span>
                </span>
            </button>
        );
    };

    return (
        <div className="grid h-full min-h-0 gap-4 overflow-y-auto p-4 xl:grid-cols-[minmax(220px,0.8fr)_minmax(240px,1fr)_minmax(220px,0.8fr)]">
            <section className="min-h-0 rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                        {t('workspace.notes.incomingLinks')}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--vibe-text-faint)]">{backlinks.length}</span>
                </div>
                <div className="space-y-2">
                    {backlinks.length ? backlinks.map((target) => renderNode(target, 'incoming')) : (
                        <p className="text-xs text-[var(--vibe-text-faint)]">{t('workspace.notes.noBacklinks')}</p>
                    )}
                </div>
            </section>

            <section className="flex min-h-[240px] flex-col items-center justify-center rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] p-5 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--vibe-border-strong)] bg-[var(--vibe-surface-hover)] text-[var(--vibe-accent)] shadow-[0_0_0_8px_color-mix(in_srgb,var(--vibe-accent)_10%,transparent)]">
                    <Network size={22} />
                </div>
                <h3 className="max-w-full truncate text-lg font-black text-[var(--vibe-text-primary)]">{entity.name}</h3>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                    {t(`workspace.notes.entityTypes.${entity.type}`)} / {t(`workspace.notes.databases.${entity.database ?? 'general'}`)}
                </p>
                <div className="mt-4 grid w-full grid-cols-2 gap-2">
                    <div className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-3 py-2">
                        <span className="block font-mono text-sm font-black text-[var(--vibe-text-primary)]">{backlinks.length}</span>
                        <span className="block text-[10px] uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('workspace.notes.incomingShort')}</span>
                    </div>
                    <div className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-3 py-2">
                        <span className="block font-mono text-sm font-black text-[var(--vibe-text-primary)]">{outgoingEntities.length}</span>
                        <span className="block text-[10px] uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('workspace.notes.outgoingShort')}</span>
                    </div>
                </div>
                {!hasLinks && (
                    <p className="mt-4 text-xs text-[var(--vibe-text-faint)]">{t('workspace.notes.noGraphLinks')}</p>
                )}
            </section>

            <section className="min-h-0 rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                        {t('workspace.notes.outgoingLinks')}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--vibe-text-faint)]">{outgoingEntities.length}</span>
                </div>
                <div className="space-y-2">
                    {outgoingEntities.length ? outgoingEntities.map((target) => renderNode(target, 'outgoing')) : (
                        <p className="text-xs text-[var(--vibe-text-faint)]">{t('workspace.notes.noOutgoingLinks')}</p>
                    )}
                </div>
            </section>
        </div>
    );
}

function GraphDockPanel({ entity, linkedViews, entitiesById, onOpenEntity, t }: GraphSummaryPanelProps) {
    const outgoingEntities = (linkedViews?.outgoingLinks ?? [])
        .map((link) => link.resolvedEntityId ? entitiesById.get(link.resolvedEntityId) : null)
        .filter((candidate): candidate is Entity => Boolean(candidate));
    const backlinks = linkedViews?.backlinks ?? [];
    const hasLinks = outgoingEntities.length > 0 || backlinks.length > 0;

    const renderNode = (target: Entity, direction: 'incoming' | 'outgoing') => {
        const Icon = ENTITY_TYPE_ICONS[target.type] ?? FileText;
        return (
            <button
                key={`${direction}-${target.id}`}
                type="button"
                onClick={() => onOpenEntity(target.id, 'source')}
                className="group flex min-w-0 items-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2.5 py-2 text-left transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]"
            >
                <Icon size={13} className={`shrink-0 ${getDatabaseTone(target.database)}`} />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-[var(--vibe-text-primary)]">{target.name}</span>
                    <span className="block truncate text-[9px] uppercase tracking-wider text-[var(--vibe-text-faint)]">
                        {t(`workspace.notes.entityTypes.${target.type}`)}
                    </span>
                </span>
            </button>
        );
    };

    return (
        <div className="space-y-3">
            <section className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--vibe-border-strong)] bg-[var(--vibe-surface-hover)] text-[var(--vibe-accent)]">
                        <Network size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[var(--vibe-text-primary)]">{entity.name}</p>
                        <p className="truncate text-[10px] uppercase tracking-wider text-[var(--vibe-text-faint)]">
                            {t(`workspace.notes.entityTypes.${entity.type}`)} / {t(`workspace.notes.databases.${entity.database ?? 'general'}`)}
                        </p>
                    </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-1.5">
                        <span className="block font-mono text-sm font-black text-[var(--vibe-text-primary)]">{backlinks.length}</span>
                        <span className="block text-[9px] uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('workspace.notes.incomingShort')}</span>
                    </div>
                    <div className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-1.5">
                        <span className="block font-mono text-sm font-black text-[var(--vibe-text-primary)]">{outgoingEntities.length}</span>
                        <span className="block text-[9px] uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('workspace.notes.outgoingShort')}</span>
                    </div>
                </div>
                {!hasLinks && (
                    <p className="mt-3 text-xs text-[var(--vibe-text-faint)]">{t('workspace.notes.noGraphLinks')}</p>
                )}
            </section>

            <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                        {t('workspace.notes.incomingLinks')}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--vibe-text-faint)]">{backlinks.length}</span>
                </div>
                <div className="space-y-1.5">
                    {backlinks.length ? backlinks.slice(0, 8).map((target) => renderNode(target, 'incoming')) : (
                        <p className="text-xs text-[var(--vibe-text-faint)]">{t('workspace.notes.noBacklinks')}</p>
                    )}
                </div>
            </section>

            <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                        {t('workspace.notes.outgoingLinks')}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--vibe-text-faint)]">{outgoingEntities.length}</span>
                </div>
                <div className="space-y-1.5">
                    {outgoingEntities.length ? outgoingEntities.slice(0, 8).map((target) => renderNode(target, 'outgoing')) : (
                        <p className="text-xs text-[var(--vibe-text-faint)]">{t('workspace.notes.noOutgoingLinks')}</p>
                    )}
                </div>
            </section>
        </div>
    );
}

interface EntityDataPanelProps {
    entity: Entity;
    children: Entity[];
    linkedViews: NotesWorkspaceLinkedViews | null;
    entitiesById: Map<string, Entity>;
    onOpenEntity: (entityId: string, view?: NotesWorkspaceView) => void;
    t: Translate;
}

function EntityDataPanel({ entity, children, linkedViews, entitiesById, onOpenEntity, t }: EntityDataPanelProps) {
    const propertyRows = getPropertyRows(entity);

    return (
        <div className="grid min-h-0 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.45fr)]">
            <div className="space-y-4">
                <section className="rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3">
                    <div className="mb-3 flex items-center gap-2">
                        <TableProperties size={15} className="text-[var(--vibe-accent)]" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                            {t('workspace.notes.properties')}
                        </span>
                    </div>
                    {propertyRows.length ? (
                        <div className="grid grid-cols-1 gap-1.5 xl:grid-cols-2">
                            {propertyRows.map(([key, value]) => (
                                <div
                                    key={key}
                                    className="min-w-0 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2.5 py-2"
                                >
                                    <span className="block truncate font-mono text-[10px] text-[var(--vibe-text-faint)]">{key}</span>
                                    <span className="mt-1 block truncate text-xs font-bold text-[var(--vibe-text-primary)]">
                                        {formatPropertyValue(value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-[var(--vibe-text-faint)]">{t('workspace.notes.noProperties')}</p>
                    )}
                </section>

                <section className="rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3">
                    <div className="mb-3 flex items-center gap-2">
                        <Folder size={15} className="text-[var(--vibe-accent)]" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                            {t('workspace.notes.attachedEntities')}
                        </span>
                    </div>
                    {children.length ? (
                        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                            {children.map((child) => (
                                <EntityListButton key={child.id} entity={child} onOpenEntity={onOpenEntity} t={t} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-[var(--vibe-text-faint)]">{t('workspace.notes.noAttachedEntities')}</p>
                    )}
                </section>
            </div>

            <aside className="min-h-0 overflow-y-auto rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3">
                <LinkedViewsPanel linkedViews={linkedViews} entitiesById={entitiesById} onOpenEntity={onOpenEntity} t={t} />
                {entity.tags.length > 0 && (
                    <section className="mt-4 border-t border-[var(--vibe-border-subtle)] pt-4">
                        <div className="mb-2 flex items-center gap-2">
                            <Tags size={14} className="text-[var(--vibe-accent)]" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                                {t('workspace.notes.tags')}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {entity.tags.map((tagId) => (
                                <button
                                    key={tagId}
                                    type="button"
                                    onClick={() => onOpenEntity(tagId, 'source')}
                                    className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-1 font-mono text-[10px] text-[var(--vibe-text-muted)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                                >
                                    {tagId}
                                </button>
                            ))}
                        </div>
                    </section>
                )}
            </aside>
        </div>
    );
}

interface NoteEditorPanelProps {
    entity: Entity;
    canEdit: boolean;
    view: NotesWorkspaceView;
    t: Translate;
}

interface MarkdownRichEditorProps {
    value: string;
    onValueChange: (value: string) => void;
    readOnly: boolean;
    excludeEntityId: string;
    placeholder: string;
    t: Translate;
}

interface MarkdownToolbarAction {
    key: string;
    titleKey: string;
    icon: LucideIcon;
    apply: (selection: string) => { text: string; selectStart: number; selectEnd: number };
}

function wrapSelection(selection: string, before: string, after = before, placeholder = 'text'): { text: string; selectStart: number; selectEnd: number } {
    const content = selection || placeholder;
    return {
        text: `${before}${content}${after}`,
        selectStart: before.length,
        selectEnd: before.length + content.length,
    };
}

function prefixLines(selection: string, prefix: string, placeholder = 'text'): { text: string; selectStart: number; selectEnd: number } {
    const content = selection || placeholder;
    const text = content
        .split('\n')
        .map((line) => `${prefix}${line}`)
        .join('\n');

    return {
        text,
        selectStart: prefix.length,
        selectEnd: text.length,
    };
}

const MARKDOWN_TOOLBAR_ACTIONS: MarkdownToolbarAction[] = [
    { key: 'bold', titleKey: 'workspace.notes.richToolbar.bold', icon: Bold, apply: (selection) => wrapSelection(selection, '**') },
    { key: 'italic', titleKey: 'workspace.notes.richToolbar.italic', icon: Italic, apply: (selection) => wrapSelection(selection, '_') },
    { key: 'heading', titleKey: 'workspace.notes.richToolbar.heading', icon: Heading1, apply: (selection) => prefixLines(selection, '## ', 'Heading') },
    { key: 'list', titleKey: 'workspace.notes.richToolbar.list', icon: List, apply: (selection) => prefixLines(selection, '- ', 'item') },
    { key: 'quote', titleKey: 'workspace.notes.richToolbar.quote', icon: Quote, apply: (selection) => prefixLines(selection, '> ', 'quote') },
    { key: 'code', titleKey: 'workspace.notes.richToolbar.code', icon: Code2, apply: (selection) => selection.includes('\n') ? wrapSelection(selection, '```\n', '\n```', 'code') : wrapSelection(selection, '`', '`', 'code') },
    { key: 'link', titleKey: 'workspace.notes.richToolbar.link', icon: Link2, apply: (selection) => wrapSelection(selection, '[[', ']]', 'entity-id') },
];

function MarkdownRichEditor({
    value,
    onValueChange,
    readOnly,
    excludeEntityId,
    placeholder,
    t,
}: MarkdownRichEditorProps) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const applyAction = (action: MarkdownToolbarAction) => {
        if (readOnly) return;
        const textarea = textareaRef.current;
        const selectionStart = textarea?.selectionStart ?? value.length;
        const selectionEnd = textarea?.selectionEnd ?? value.length;
        const selection = value.slice(selectionStart, selectionEnd);
        const insertion = action.apply(selection);
        const nextValue = `${value.slice(0, selectionStart)}${insertion.text}${value.slice(selectionEnd)}`;
        const nextSelectionStart = selectionStart + insertion.selectStart;
        const nextSelectionEnd = selectionStart + insertion.selectEnd;

        onValueChange(nextValue);
        window.requestAnimationFrame(() => {
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(nextSelectionStart, nextSelectionEnd);
        });
    };

    return (
        <div className="flex h-full min-h-[260px] min-w-0 flex-col overflow-hidden rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)]">
            <div className="flex min-h-9 shrink-0 items-center gap-1 border-b border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-header)] px-2 py-1">
                {MARKDOWN_TOOLBAR_ACTIONS.map((action) => {
                    const Icon = action.icon;
                    return (
                        <button
                            key={action.key}
                            type="button"
                            disabled={readOnly}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => applyAction(action)}
                            className={`flex h-7 w-7 items-center justify-center rounded-[var(--vibe-radius-sm)] ${readOnly ? 'cursor-not-allowed opacity-40' : glass.iconButton}`}
                            title={t(action.titleKey)}
                        >
                            <Icon size={14} />
                        </button>
                    );
                })}
                <div className="ml-auto rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                    {t('workspace.notes.richToolbar.markdown')}
                </div>
            </div>
            <WikiLinkTextarea
                ref={textareaRef}
                value={value}
                onValueChange={onValueChange}
                excludeEntityId={excludeEntityId}
                readOnly={readOnly}
                spellCheck={false}
                className="h-full min-h-0 w-full flex-1 resize-none border-0 bg-transparent px-4 py-3 font-mono text-sm leading-6 text-[var(--vibe-text-primary)] outline-none placeholder:text-[var(--vibe-text-faint)]"
                placeholder={placeholder}
            />
        </div>
    );
}

interface EntityUiPreviewPanelProps {
    entity: Entity;
    canEdit: boolean;
    t: Translate;
}

function EntityUiPreviewPanel({ entity, canEdit, t }: EntityUiPreviewPanelProps) {
    return (
        <div className="h-full min-h-0 overflow-y-auto p-4 custom-scrollbar">
            <div className={`mx-auto flex min-h-[420px] w-full max-w-[980px] flex-col overflow-hidden ${glass.window}`}>
                <div className={`${glass.header} flex min-h-12 items-center justify-between gap-3`}>
                    <div className="min-w-0">
                        <h3 className="truncate text-sm font-black text-[var(--vibe-text-primary)]">{entity.name}</h3>
                        <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                            {t(`workspace.notes.entityTypes.${entity.type}`)} / {t(`workspace.notes.databases.${entity.database ?? 'general'}`)}
                        </p>
                    </div>
                    {!canEdit && (
                        <span className="flex shrink-0 items-center gap-1 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-warning)]">
                            <Lock size={11} />
                            {t('workspace.notes.readOnly')}
                        </span>
                    )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
                    <div className={`${glass.content} min-h-full`}>
                        <EntityImageBlock entity={entity} isWide={entity.type === 'canvas'} />

                        {entity.type === 'character' ? (
                            <CharacterSheet entityId={entity.id} isFullMode={false} />
                        ) : (
                            <>
                                {(entity.type === 'note' || entity.type === 'canvas' || entity.type === 'portal' || entity.type === 'folder' || entity.type === 'competency') && (
                                    <div className={glass.blockBg}>
                                        <h3 className={glass.blockHeader}>Description</h3>
                                        {entity.description?.trim() ? (
                                            <MarkdownRenderer content={entity.description} entityId={entity.id} />
                                        ) : (
                                            <p className="text-sm italic text-[var(--vibe-text-faint)]">{t('workspace.notes.emptyMarkdown')}</p>
                                        )}
                                    </div>
                                )}

                                {entity.type === 'object' && <ObjectSheet entity={entity} />}
                                {entity.type === 'attack' && <AttackSheet entity={entity} />}
                                {entity.type === 'ability' && <AbilitySheet entity={entity} />}
                                {entity.type === 'tag' && canEdit && <TagEditor entity={entity} />}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function NoteEditorPanel({ entity, canEdit, view, t }: NoteEditorPanelProps) {
    const sourceEditor = (
        <MarkdownRichEditor
            value={entity.description ?? ''}
            onValueChange={(value) => {
                if (canEdit) yjsStore.updateEntity(entity.id, { description: value });
            }}
            excludeEntityId={entity.id}
            readOnly={!canEdit}
            placeholder={t('workspace.notes.sourcePlaceholder')}
            t={t}
        />
    );

    const preview = (
        <div className="h-full min-h-[260px] overflow-y-auto rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-4">
            {entity.description?.trim() ? (
                <MarkdownRenderer content={entity.description} entityId={entity.id} allowCustomBlocks={false} />
            ) : (
                <p className="text-sm text-[var(--vibe-text-faint)]">{t('workspace.notes.emptyMarkdown')}</p>
            )}
        </div>
    );

    if (view === 'split') {
        return (
            <div className="grid h-full min-h-0 gap-3 p-4 lg:grid-cols-2">
                {sourceEditor}
                {preview}
            </div>
        );
    }

    return (
        <div className="h-full min-h-0 p-4">
            {view === 'preview' ? preview : sourceEditor}
        </div>
    );
}

interface NotesWorkspaceNodeViewProps {
    node: NotesWorkspaceNode;
    activeGroupId: string;
    groupOrder: Map<string, number>;
    entitiesById: Map<string, Entity>;
    visibleEntities: Entity[];
    childrenByParent: Map<string | null, Entity[]>;
    onSetActiveGroup: (groupId: string) => void;
    onSetActiveTab: (groupId: string, tabId: string) => void;
    onSetTabView: (groupId: string, tabId: string, view: NotesWorkspaceView) => void;
    onCloseTab: (groupId: string, tabId: string) => void;
    onCloseGroup: (groupId: string) => void;
    onSplitGroup: (groupId: string, direction: 'row' | 'column') => void;
    onSplitTabToGroup: (
        sourceGroupId: string,
        tabId: string,
        targetGroupId: string,
        direction: 'row' | 'column',
        placement: NotesWorkspaceSplitPlacement
    ) => void;
    onResizeSplit: (splitId: string, ratio: number) => void;
    onMoveTab: (sourceGroupId: string, tabId: string, targetGroupId: string, beforeTabId?: string | null) => void;
    onOpenEntity: (entityId: string, view?: NotesWorkspaceView) => void;
    onCopyEntityWikiLink: (entityId: string) => void;
    onCopyEntityId: (entityId: string) => void;
    onPinEntityToCanvas: (entityId: string) => void;
    canPinToCanvas: boolean;
    dockDropTarget: NotesDockDropTarget | null;
    onDockDropTargetChange: (target: NotesDockDropTarget | null) => void;
    t: Translate;
}

function NotesWorkspaceNodeView(props: NotesWorkspaceNodeViewProps) {
    const { node } = props;
    const splitContainerRef = useRef<HTMLDivElement | null>(null);
    const tabsNodeRef = useRef<HTMLDivElement | null>(null);
    const dropZoneRef = useRef<NotesWorkspaceDropZone | null>(null);
    const [dropZone, setDropZone] = useState<NotesWorkspaceDropZone | null>(null);
    const handleSplitResizeStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (node.type !== 'split') return;

        const container = splitContainerRef.current;
        if (!container) return;

        event.preventDefault();
        event.stopPropagation();

        const rect = container.getBoundingClientRect();
        const previousCursor = document.body.style.cursor;
        const previousUserSelect = document.body.style.userSelect;
        document.body.style.cursor = node.direction === 'row' ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';

        const updateRatio = (clientX: number, clientY: number) => {
            const rawRatio = node.direction === 'row'
                ? (clientX - rect.left) / Math.max(rect.width, 1)
                : (clientY - rect.top) / Math.max(rect.height, 1);
            props.onResizeSplit(node.id, rawRatio);
        };

        const handlePointerMove = (moveEvent: PointerEvent) => {
            moveEvent.preventDefault();
            updateRatio(moveEvent.clientX, moveEvent.clientY);
        };

        const handlePointerUp = () => {
            document.body.style.cursor = previousCursor;
            document.body.style.userSelect = previousUserSelect;
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        };

        updateRatio(event.clientX, event.clientY);
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp, { once: true });
        window.addEventListener('pointercancel', handlePointerUp, { once: true });
    }, [node, props]);

    if (node.type === 'split') {
        const firstBasis = `${node.ratio * 100}%`;
        const secondBasis = `${(1 - node.ratio) * 100}%`;
        const isRow = node.direction === 'row';

        return (
            <div ref={splitContainerRef} className={`flex h-full min-h-0 w-full min-w-0 flex-1 ${isRow ? 'flex-row' : 'flex-col'}`}>
                <div className="min-h-0 min-w-0" style={{ flexBasis: firstBasis, flexGrow: 0, flexShrink: 1, [isRow ? 'height' : 'width']: '100%' }}>
                    <NotesWorkspaceNodeView {...props} node={node.children[0]} />
                </div>
                <div
                    role="separator"
                    aria-orientation={isRow ? 'vertical' : 'horizontal'}
                    onPointerDown={handleSplitResizeStart}
                    className={`group relative flex shrink-0 items-center justify-center ${
                        isRow ? 'w-3 cursor-col-resize px-1' : 'h-3 cursor-row-resize py-1'
                    }`}
                    title={props.t('workspace.notes.resizeSplit')}
                >
                    <div className={`rounded-full bg-[var(--vibe-border-subtle)] transition-colors group-hover:bg-[var(--vibe-accent)] ${
                        isRow ? 'h-10 w-px' : 'h-px w-10'
                    }`} />
                </div>
                <div className="min-h-0 min-w-0" style={{ flexBasis: secondBasis, flexGrow: 0, flexShrink: 1, [isRow ? 'height' : 'width']: '100%' }}>
                    <NotesWorkspaceNodeView {...props} node={node.children[1]} />
                </div>
            </div>
        );
    }

    const {
        activeGroupId,
        childrenByParent,
        entitiesById,
        groupOrder,
        onCloseGroup,
        onCloseTab,
        onMoveTab,
        onOpenEntity,
        onCopyEntityWikiLink,
        onCopyEntityId,
        onPinEntityToCanvas,
        canPinToCanvas,
        onSetActiveGroup,
        onSetActiveTab,
        onSetTabView,
        onSplitGroup,
        onSplitTabToGroup,
        dockDropTarget,
        onDockDropTargetChange,
        t,
        visibleEntities,
    } = props;
    const isActiveGroup = node.id === activeGroupId;
    const activeTab = getActiveTab(node.tabs, node.activeTabId);
    const activeEntity = activeTab ? entitiesById.get(activeTab.entityId) : null;
    const groupIndex = groupOrder.get(node.id) ?? 1;
    const linkedViews = activeEntity ? buildNotesWorkspaceLinkedViews(activeEntity, visibleEntities) : null;
    const childEntities = activeEntity ? childrenByParent.get(activeEntity.id) ?? [] : [];
    const canEditActiveEntity = activeEntity ? canEditEntityInWorkspace(activeEntity) : false;
    const activeParentEntity = activeEntity?.parentId ? entitiesById.get(activeEntity.parentId) ?? null : null;
    const canCloseGroup = groupOrder.size > 1;
    const visualDropZone = dockDropTarget?.groupId === node.id ? dockDropTarget.zone : dropZone;

    const getDropZone = (event: DragEvent<HTMLDivElement>): NotesWorkspaceDropZone | null => {
        const element = tabsNodeRef.current;
        if (!element) return null;

        return getNotesDockDropZone(element, event.clientX, event.clientY);
    };

    const getSplitFromDropZone = (zone: NotesWorkspaceDropZone): { direction: 'row' | 'column'; placement: NotesWorkspaceSplitPlacement } => {
        if (zone === 'left') return { direction: 'row', placement: 'before' };
        if (zone === 'right') return { direction: 'row', placement: 'after' };
        if (zone === 'top') return { direction: 'column', placement: 'before' };
        return { direction: 'column', placement: 'after' };
    };

    const startPanePointerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!activeTab || event.button !== 0) return;
        if ((event.target as HTMLElement | null)?.closest('[data-no-pane-drag]')) return;

        event.preventDefault();
        event.stopPropagation();
        onSetActiveGroup(node.id);

        const sourceGroupId = node.id;
        const tabId = activeTab.id;
        const startX = event.clientX;
        const startY = event.clientY;
        const previousCursor = document.body.style.cursor;
        const previousUserSelect = document.body.style.userSelect;
        let isDragging = false;
        let latestTarget: NotesDockDropTarget | null = null;

        const setLatestTarget = (target: NotesDockDropTarget | null) => {
            const unchanged = latestTarget?.groupId === target?.groupId && latestTarget?.zone === target?.zone;
            if (unchanged) return;
            latestTarget = target;
            onDockDropTargetChange(target);
        };

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
            if (!isDragging && distance < 6) return;

            if (!isDragging) {
                isDragging = true;
                document.body.style.cursor = 'grabbing';
                document.body.style.userSelect = 'none';
            }

            moveEvent.preventDefault();
            const targetElement = findDockGroupElement(moveEvent.clientX, moveEvent.clientY);
            const targetGroupId = targetElement?.dataset.notesGroupId;
            if (!targetElement || !targetGroupId) {
                setLatestTarget(null);
                return;
            }

            setLatestTarget({
                groupId: targetGroupId,
                zone: getNotesDockDropZone(targetElement, moveEvent.clientX, moveEvent.clientY),
            });
        };

        const finishDrag = (upEvent: PointerEvent) => {
            document.body.style.cursor = previousCursor;
            document.body.style.userSelect = previousUserSelect;
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', finishDrag);
            window.removeEventListener('pointercancel', cancelDrag);

            const target = latestTarget;
            setLatestTarget(null);
            if (!isDragging || !target) return;

            upEvent.preventDefault();
            if (target.zone) {
                const split = getSplitFromDropZone(target.zone);
                onSplitTabToGroup(sourceGroupId, tabId, target.groupId, split.direction, split.placement);
                return;
            }

            onMoveTab(sourceGroupId, tabId, target.groupId, null);
        };

        const cancelDrag = () => {
            document.body.style.cursor = previousCursor;
            document.body.style.userSelect = previousUserSelect;
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', finishDrag);
            window.removeEventListener('pointercancel', cancelDrag);
            setLatestTarget(null);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', finishDrag, { once: true });
        window.addEventListener('pointercancel', cancelDrag, { once: true });
    };

    const updateDropZone = (zone: NotesWorkspaceDropZone | null) => {
        if (dropZoneRef.current === zone) return;
        dropZoneRef.current = zone;
        setDropZone(zone);
    };

    const viewButtonClass = (view: NotesWorkspaceView) => `flex h-8 items-center gap-1.5 rounded-[var(--vibe-radius-sm)] border px-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
        activeTab?.view === view
            ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-surface-hover)] text-[var(--vibe-text-primary)]'
            : 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)] hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
    }`;
    const quickActionButtonClass = `flex h-8 w-8 items-center justify-center rounded-[var(--vibe-radius-sm)] ${glass.iconButton}`;

    return (
        <div
            ref={tabsNodeRef}
            data-notes-group-id={node.id}
            className={`relative flex h-full min-h-[220px] min-w-0 flex-col overflow-hidden rounded-[var(--vibe-radius-md)] border bg-[var(--vibe-surface-block)] transition-colors ${
                isActiveGroup
                    ? 'border-[var(--vibe-accent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--vibe-accent)_35%,transparent)]'
                    : 'border-[var(--vibe-border-subtle)]'
            }`}
            onMouseDown={() => onSetActiveGroup(node.id)}
            onDragOverCapture={(event) => {
                if (!hasTabDragPayload(event)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                updateDropZone(getDropZone(event));
            }}
            onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                updateDropZone(null);
            }}
            onDropCapture={(event) => {
                const payload = readTabDragPayload(event);
                if (!payload) return;

                const zone = dropZoneRef.current ?? getDropZone(event);
                if (!zone) return;

                event.preventDefault();
                event.stopPropagation();
                updateDropZone(null);

                const split = getSplitFromDropZone(zone);
                onSplitTabToGroup(payload.groupId, payload.tabId, node.id, split.direction, split.placement);
            }}
            onDrop={(event) => {
                const payload = readTabDragPayload(event);
                if (!payload) return;

                event.preventDefault();
                event.stopPropagation();
                updateDropZone(null);
                onMoveTab(payload.groupId, payload.tabId, node.id, null);
            }}
        >
            {dockDropTarget?.groupId === node.id && !visualDropZone && (
                <div className="pointer-events-none absolute inset-0 z-20 rounded-[var(--vibe-radius-md)] border border-[var(--vibe-accent)] bg-[color-mix(in_srgb,var(--vibe-accent)_12%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--vibe-accent)_34%,transparent),0_0_34px_color-mix(in_srgb,var(--vibe-accent)_18%,transparent)]" />
            )}
            {visualDropZone && (
                <div className="pointer-events-none absolute inset-0 z-20 rounded-[var(--vibe-radius-md)] border-2 border-[var(--vibe-accent)] bg-[color-mix(in_srgb,var(--vibe-accent)_12%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--vibe-accent)_42%,transparent),0_0_36px_color-mix(in_srgb,var(--vibe-accent)_20%,transparent)]">
                    <div
                        className={`absolute rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-accent)] bg-[color-mix(in_srgb,var(--vibe-accent)_28%,transparent)] shadow-[0_0_34px_color-mix(in_srgb,var(--vibe-accent)_34%,transparent)] ${
                            visualDropZone === 'left'
                                ? 'left-2 top-2 h-[calc(100%-16px)] w-[32%]'
                                : visualDropZone === 'right'
                                    ? 'right-2 top-2 h-[calc(100%-16px)] w-[32%]'
                                    : visualDropZone === 'top'
                                        ? 'left-2 top-2 h-[32%] w-[calc(100%-16px)]'
                                        : 'bottom-2 left-2 h-[32%] w-[calc(100%-16px)]'
                        }`}
                    />
                </div>
            )}
            <div
                onMouseDown={(event) => {
                    if (!activeTab) return;
                    onSetActiveGroup(node.id);
                    event.stopPropagation();
                }}
                onPointerDown={startPanePointerDrag}
                className={`flex min-h-10 select-none items-center justify-between gap-2 border-b px-2.5 py-1.5 transition-colors ${
                    isActiveGroup
                        ? 'border-[var(--vibe-border-strong)] bg-[color-mix(in_srgb,var(--vibe-accent)_14%,var(--vibe-surface-header))] shadow-[inset_3px_0_0_var(--vibe-accent)]'
                        : 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-header)]'
                } ${activeTab ? 'cursor-grab active:cursor-grabbing' : ''}`}
                title={activeTab ? t('workspace.notes.dragPane') : undefined}
            >
                <div
                    className="flex min-w-0 items-center gap-2"
                >
                    <span className={`rounded-[var(--vibe-radius-sm)] border px-2 py-1 font-mono text-[10px] ${
                        isActiveGroup
                            ? 'border-[var(--vibe-accent)] bg-[color-mix(in_srgb,var(--vibe-accent)_16%,var(--vibe-surface-input))] text-[var(--vibe-text-primary)]'
                            : 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)]'
                    }`}>
                        {t('workspace.notes.groupLabel', { index: groupIndex })}
                    </span>
                    {activeEntity && (
                        <span className="min-w-0 truncate text-xs font-bold text-[var(--vibe-text-primary)]">
                            {activeEntity.name}
                        </span>
                    )}
                    {activeEntity && !canEditActiveEntity && (
                        <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-warning)]">
                            <Lock size={11} />
                            {t('workspace.notes.readOnly')}
                        </span>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        data-no-pane-drag
                        onClick={(event) => {
                            event.stopPropagation();
                            onSplitGroup(node.id, 'row');
                        }}
                        draggable={false}
                        className={`flex h-7 w-7 items-center justify-center rounded-[var(--vibe-radius-sm)] ${glass.iconButton}`}
                        title={t('workspace.notes.splitRow')}
                    >
                        <PanelLeft size={14} />
                    </button>
                    <button
                        type="button"
                        data-no-pane-drag
                        onClick={(event) => {
                            event.stopPropagation();
                            onSplitGroup(node.id, 'column');
                        }}
                        draggable={false}
                        className={`flex h-7 w-7 items-center justify-center rounded-[var(--vibe-radius-sm)] ${glass.iconButton}`}
                        title={t('workspace.notes.splitColumn')}
                    >
                        <PanelRight size={14} />
                    </button>
                    {canCloseGroup && (
                        <button
                            type="button"
                            data-no-pane-drag
                            onClick={(event) => {
                                event.stopPropagation();
                                onCloseGroup(node.id);
                            }}
                            draggable={false}
                            className="flex h-7 w-7 items-center justify-center rounded-[var(--vibe-radius-sm)] text-[var(--vibe-text-faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-danger)_16%,transparent)] hover:text-[var(--vibe-danger)]"
                            title={t('workspace.notes.closePane')}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex min-h-9 shrink-0 gap-1 overflow-x-auto border-b border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1">
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
                                event.stopPropagation();
                                event.dataTransfer.effectAllowed = 'move';
                                const payload = JSON.stringify({ groupId: node.id, tabId: tab.id });
                                event.dataTransfer.setData(NOTES_WORKSPACE_TAB_MIME, payload);
                                event.dataTransfer.setData('text/plain', payload);
                            }}
                            onDragOver={(event) => {
                                if (hasTabDragPayload(event)) {
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
                             className={`group flex h-7 max-w-[230px] shrink-0 select-none items-center gap-2 rounded-[var(--vibe-radius-sm)] border px-2 text-left text-xs transition-colors ${
                                isActiveTab
                                    ? 'border-[var(--vibe-accent)] bg-[color-mix(in_srgb,var(--vibe-accent)_16%,var(--vibe-surface-hover))] text-[var(--vibe-text-primary)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--vibe-accent)_20%,transparent)]'
                                    : 'border-transparent text-[var(--vibe-text-muted)] hover:border-[var(--vibe-border-subtle)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                            }`}
                            title={entity?.name ?? tab.entityId}
                        >
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onSetActiveTab(node.id, tab.id);
                                }}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                                <span className="min-w-0 truncate font-bold">{entity?.name ?? tab.entityId}</span>
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

            {!activeTab || !activeEntity ? (
                <div className="flex min-h-0 flex-1 items-center justify-center p-6">
                    <div className="flex min-w-[240px] flex-col items-center gap-3 rounded-[var(--vibe-radius-md)] border border-dashed border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-6 py-5 text-center text-sm text-[var(--vibe-text-faint)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <FileText size={20} className="text-[var(--vibe-accent)] opacity-75" />
                        <span>{activeTab ? t('workspace.notes.missingEntity') : t('workspace.notes.emptyGroupHint')}</span>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-[var(--vibe-border-subtle)] px-3 py-2">
                        <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-sm font-black text-[var(--vibe-text-primary)]">{activeEntity.name}</span>
                                <span className={`shrink-0 text-[10px] font-bold uppercase tracking-widest ${getDatabaseTone(activeEntity.database)}`}>
                                    {t(`workspace.notes.databases.${activeEntity.database ?? 'general'}`)}
                                </span>
                            </div>
                            <p className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                {t(`workspace.notes.entityTypes.${activeEntity.type}`)} / {activeEntity.id}
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                            {activeParentEntity && (
                                <button
                                    type="button"
                                    data-no-pane-drag
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onOpenEntity(activeParentEntity.id, 'source');
                                    }}
                                    className={quickActionButtonClass}
                                    title={t('workspace.notes.openParent')}
                                >
                                    <GitFork size={13} />
                                </button>
                            )}
                            <button
                                type="button"
                                data-no-pane-drag
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onCopyEntityWikiLink(activeEntity.id);
                                }}
                                className={quickActionButtonClass}
                                title={t('workspace.notes.copyWikiLink')}
                            >
                                <Link2 size={13} />
                            </button>
                            <button
                                type="button"
                                data-no-pane-drag
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onCopyEntityId(activeEntity.id);
                                }}
                                className={quickActionButtonClass}
                                title={t('workspace.notes.copyEntityId')}
                            >
                                <Copy size={13} />
                            </button>
                            <button
                                type="button"
                                data-no-pane-drag
                                disabled={!canPinToCanvas}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    if (canPinToCanvas) onPinEntityToCanvas(activeEntity.id);
                                }}
                                className={`${quickActionButtonClass} ${!canPinToCanvas ? 'cursor-not-allowed opacity-40' : ''}`}
                                title={canPinToCanvas ? t('workspace.notes.pinToCanvas') : t('workspace.notes.pinToCanvasUnavailable')}
                            >
                                <Pin size={13} />
                            </button>
                            <div className="mx-1 h-8 w-px bg-[var(--vibe-border-subtle)]" />
                            {VIEW_CONFIGS.map(({ view, icon: Icon }) => (
                                <button
                                    key={view}
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onSetTabView(node.id, activeTab.id, view);
                                    }}
                                    className={viewButtonClass(view)}
                                    title={t(VIEW_LABEL_KEYS[view])}
                                >
                                    <Icon size={12} />
                                    <span className="hidden 2xl:inline">{t(VIEW_LABEL_KEYS[view])}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-hidden">
                        {(activeTab.view === 'source' || activeTab.view === 'preview' || activeTab.view === 'split') && (
                            <NoteEditorPanel entity={activeEntity} canEdit={canEditActiveEntity} view={activeTab.view} t={t} />
                        )}
                        {activeTab.view === 'ui' && (
                            <EntityUiPreviewPanel entity={activeEntity} canEdit={canEditActiveEntity} t={t} />
                        )}
                        {activeTab.view === 'entity' && (
                            <EntityDataPanel entity={activeEntity} children={childEntities} linkedViews={linkedViews} entitiesById={entitiesById} onOpenEntity={onOpenEntity} t={t} />
                        )}
                        {activeTab.view === 'outline' && (
                            <div className="h-full overflow-y-auto p-4">
                                <LinkedViewsPanel linkedViews={linkedViews} entitiesById={entitiesById} onOpenEntity={onOpenEntity} t={t} />
                            </div>
                        )}
                        {activeTab.view === 'backlinks' && (
                            <div className="h-full overflow-y-auto p-4">
                                <LinkedViewsPanel linkedViews={linkedViews} entitiesById={entitiesById} onOpenEntity={onOpenEntity} t={t} />
                            </div>
                        )}
                        {activeTab.view === 'graph' && (
                            <GraphSummaryPanel entity={activeEntity} linkedViews={linkedViews} entitiesById={entitiesById} onOpenEntity={onOpenEntity} t={t} />
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export function NotesWorkspace({
    roomName,
    onLeave,
    onOpenInventory,
    onOpenSettings,
    onWorkspaceModeChange,
}: NotesWorkspaceProps) {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [vaultScope, setVaultScope] = useState<VaultScope>('all');
    const [expandedEntityIds, setExpandedEntityIds] = useState<Set<string>>(() => new Set());
    const [collapsedVaultGroups, setCollapsedVaultGroups] = useState<Set<EntityType>>(() => new Set());
    const [dockDropTarget, setDockDropTarget] = useState<NotesDockDropTarget | null>(null);
    const entities = useEntities();
    const activeCanvasId = useCanvasStore((state) => state.activeCanvasId);
    const stageScale = useCanvasStore((state) => state.scale);
    const stageOffset = useCanvasStore((state) => state.offset);
    const notesLayout = useNotesWorkspaceStore((state) => state.layout);
    const notesShell = useNotesWorkspaceStore((state) => state.shell);
    const openWorkspaceTab = useNotesWorkspaceStore((state) => state.openTab);
    const closeWorkspaceTab = useNotesWorkspaceStore((state) => state.closeTab);
    const closeWorkspaceGroup = useNotesWorkspaceStore((state) => state.closeGroup);
    const moveWorkspaceTab = useNotesWorkspaceStore((state) => state.moveTab);
    const splitWorkspaceTabToGroup = useNotesWorkspaceStore((state) => state.splitTabToGroup);
    const resizeWorkspaceSplit = useNotesWorkspaceStore((state) => state.resizeSplit);
    const setActiveWorkspaceGroup = useNotesWorkspaceStore((state) => state.setActiveGroup);
    const setActiveWorkspaceTab = useNotesWorkspaceStore((state) => state.setActiveTab);
    const setWorkspaceTabView = useNotesWorkspaceStore((state) => state.setTabView);
    const splitActiveWorkspaceGroup = useNotesWorkspaceStore((state) => state.splitActiveGroup);
    const toggleShellModule = useNotesWorkspaceStore((state) => state.toggleShellModule);
    const setShellModuleWidth = useNotesWorkspaceStore((state) => state.setShellModuleWidth);
    const setShellAudioHeight = useNotesWorkspaceStore((state) => state.setShellAudioHeight);
    const resetWorkspaceLayout = useNotesWorkspaceStore((state) => state.resetLayout);
    const [audioModuleEnabled] = useAppModuleEnabled('audio');
    const shellRibbonModules = useMemo(
        () => listImplementedNotesShellModules()
            .filter((module) => module.id !== 'audio' || audioModuleEnabled),
        [audioModuleEnabled]
    );
    const visibleRightModules = useMemo(
        () => listVisibleNotesShellModules(notesShell.modules, 'right'),
        [notesShell.modules]
    );
    const visibleBottomModules = useMemo(
        () => audioModuleEnabled ? listVisibleNotesShellModules(notesShell.modules, 'bottom') : [],
        [audioModuleEnabled, notesShell.modules]
    );
    const isVaultVisible = hasVisibleNotesShellModule(notesShell.modules, 'left');
    const isContextVisible = visibleRightModules.some((module) => module.id === 'context');
    const isNotificationsVisible = visibleRightModules.some((module) => module.id === 'notifications');
    const isSearchVisible = visibleRightModules.some((module) => module.id === 'search');
    const isGraphVisible = visibleRightModules.some((module) => module.id === 'graph');
    const isAudioVisible = visibleBottomModules.some((module) => module.id === 'audio');
    const isRightModuleVisible = visibleRightModules.length > 0;

    const permittedEntities = useMemo(
        () => entities.filter(canShowEntityInWorkspace).sort(sortByName),
        [entities]
    );

    const vaultScopeOptions = useMemo<VaultScopeOption[]>(() => {
        const counts = new Map<VaultScope, number>();
        counts.set('all', permittedEntities.length);
        for (const entity of permittedEntities) {
            const db = entity.database ?? 'general';
            counts.set(db, (counts.get(db) ?? 0) + 1);
            if (db === 'user') {
                const key = getVaultScopeKey(entity);
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }
        }

        const options: VaultScopeOption[] = [
            { value: 'all', label: getVaultScopeLabel('all', t), count: counts.get('all') ?? 0 },
            { value: 'general', label: getVaultScopeLabel('general', t), count: counts.get('general') ?? 0 },
        ];

        [...counts.entries()]
            .filter(([scope]) => scope.startsWith('user:'))
            .sort(([left], [right]) => left.localeCompare(right, 'ru', { sensitivity: 'base' }))
            .forEach(([scope, count]) => {
                options.push({ value: scope, label: getVaultScopeLabel(scope, t), count });
            });

        options.push({ value: 'user', label: getVaultScopeLabel('user', t), count: counts.get('user') ?? 0 });
        options.push({ value: 'gm', label: getVaultScopeLabel('gm', t), count: counts.get('gm') ?? 0 });

        return options.filter((option) => option.value === 'all' || option.count > 0);
    }, [permittedEntities, t]);

    const visibleEntities = useMemo(
        () => permittedEntities.filter((entity) => matchesVaultScope(entity, vaultScope)),
        [permittedEntities, vaultScope]
    );

    const entitiesById = useMemo(
        () => new Map(visibleEntities.map((entity) => [entity.id, entity])),
        [visibleEntities]
    );

    const childrenByParent = useMemo(
        () => buildChildrenByParent(visibleEntities),
        [visibleEntities]
    );

    const parentById = useMemo(
        () => new Map(visibleEntities.map((entity) => [entity.id, entity.parentId])),
        [visibleEntities]
    );

    const rootEntities = useMemo(
        () => getRootEntities(visibleEntities, childrenByParent),
        [visibleEntities, childrenByParent]
    );

    const vaultGroups = useMemo(() => {
        return VAULT_GROUP_TYPES.map((type) => {
            const rootItems = rootEntities.filter((entity) => getVaultGroupType(entity) === type);
            const totalCount = visibleEntities.filter((entity) => getVaultGroupType(entity) === type).length;
            return { type, rootItems, totalCount };
        }).filter((group) => group.totalCount > 0);
    }, [rootEntities, visibleEntities]);

    const workspaceGroups = useMemo(
        () => listNotesWorkspaceGroups(notesLayout.root),
        [notesLayout.root]
    );
    const hasWorkspaceTabs = workspaceGroups.some((group) => group.tabs.length > 0);

    const activeGroup = workspaceGroups.find((group) => group.id === notesLayout.activeGroupId) ?? workspaceGroups[0] ?? null;
    const activeTab = activeGroup ? getActiveTab(activeGroup.tabs, activeGroup.activeTabId) : null;
    const activeEntity = activeTab ? entitiesById.get(activeTab.entityId) ?? null : null;
    const activeLinkedViews = activeEntity ? buildNotesWorkspaceLinkedViews(activeEntity, visibleEntities) : null;
    const activeChildren = activeEntity ? childrenByParent.get(activeEntity.id) ?? [] : [];

    const workspaceGroupOrder = useMemo(
        () => new Map(workspaceGroups.map((group, index) => [group.id, index + 1])),
        [workspaceGroups]
    );

    const searchTerms = useMemo(
        () => getEntitySearchTerms(searchQuery),
        [searchQuery]
    );

    const filteredEntities = useMemo<Array<{ entity: Entity; result: EntitySearchResult }>>(() => {
        const query = searchQuery.trim();
        if (!query) return [];

        return visibleEntities
            .map((entity) => ({ entity, result: getEntitySearchResult(entity, query) }))
            .filter(({ result }) => result.matches)
            .sort((left, right) => right.result.score - left.result.score || sortByName(left.entity, right.entity))
            .slice(0, 80);
    }, [searchQuery, visibleEntities]);

    const visibleCounts = useMemo(() => {
        return visibleEntities.reduce<Record<DatabaseType, number>>((acc, entity) => {
            const db = entity.database ?? 'general';
            acc[db] += 1;
            return acc;
        }, { general: 0, user: 0, gm: 0 });
    }, [visibleEntities]);

    const activeCanvasEntity = useMemo(
        () => entities.find((entity) => entity.id === activeCanvasId && entity.type === 'canvas'),
        [activeCanvasId, entities]
    );
    const canPinToActiveCanvas = Boolean(activeCanvasEntity && canEditEntityInWorkspace(activeCanvasEntity));

    const expandEntityAncestors = useCallback((entityId: string) => {
        setExpandedEntityIds((current) => {
            const next = new Set(current);
            let parentId = parentById.get(entityId) ?? null;
            let guard = 0;

            while (parentId && guard < 100) {
                next.add(parentId);
                parentId = parentById.get(parentId) ?? null;
                guard += 1;
            }

            return next;
        });
    }, [parentById]);

    const handleToggleExpanded = (entityId: string) => {
        setExpandedEntityIds((current) => {
            const next = new Set(current);
            if (next.has(entityId)) {
                next.delete(entityId);
            } else {
                next.add(entityId);
            }
            return next;
        });
    };

    const handleToggleVaultGroup = (type: EntityType) => {
        setCollapsedVaultGroups((current) => {
            const next = new Set(current);
            if (next.has(type)) {
                next.delete(type);
            } else {
                next.add(type);
            }
            return next;
        });
    };

    const handleOpenEntity = (entityId: string, view: NotesWorkspaceView = 'source') => {
        if (!entitiesById.has(entityId)) return;
        expandEntityAncestors(entityId);
        openWorkspaceTab(entityId, view);
    };

    const handleCopyEntityWikiLink = useCallback((entityId: string) => {
        void writeClipboardText(`[[${entityId}]]`).catch((error) => {
            console.warn(`Failed to copy wiki link for entity "${entityId}"`, error);
        });
    }, []);

    const handleCopyEntityId = useCallback((entityId: string) => {
        void writeClipboardText(entityId).catch((error) => {
            console.warn(`Failed to copy entity id "${entityId}"`, error);
        });
    }, []);

    const handlePinEntityToCanvas = useCallback((entityId: string) => {
        if (!activeCanvasEntity || !canEditEntityInWorkspace(activeCanvasEntity) || !entitiesById.has(entityId)) return;

        const safeScale = stageScale || 1;
        const instances = readCanvasWindowInstances(activeCanvasEntity.properties);
        const instance = createCanvasWindowInstance({
            entityId,
            x: ((window.innerWidth / 2) - stageOffset.x) / safeScale - 200,
            y: ((window.innerHeight / 2) - stageOffset.y) / safeScale - 150,
            zIndex: getNextCanvasWindowZIndex(instances),
        });

        yjsStore.updateEntity(activeCanvasEntity.id, {
            properties: {
                ...activeCanvasEntity.properties,
                [CANVAS_WINDOW_INSTANCES_PROPERTY]: upsertCanvasWindowInstance(instances, instance),
            },
        });
    }, [activeCanvasEntity, entitiesById, stageOffset.x, stageOffset.y, stageScale]);

    const handleSplitWorkspaceGroup = (groupId: string, direction: 'row' | 'column') => {
        setActiveWorkspaceGroup(groupId);
        splitActiveWorkspaceGroup(direction);
    };

    const handleShellResizeStart = (target: NotesShellResizeTarget, event: ReactPointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        const startY = event.clientY;
        const startVaultWidth = notesShell.vaultWidth;
        const startContextWidth = notesShell.contextWidth;
        const startAudioHeight = notesShell.audioHeight;
        const previousCursor = document.body.style.cursor;
        const previousUserSelect = document.body.style.userSelect;
        document.body.style.cursor = target === 'audio' ? 'row-resize' : 'col-resize';
        document.body.style.userSelect = 'none';

        const handlePointerMove = (moveEvent: PointerEvent) => {
            moveEvent.preventDefault();
            if (target === 'audio') {
                setShellAudioHeight(startAudioHeight + startY - moveEvent.clientY);
                return;
            }
            const delta = moveEvent.clientX - startX;
            if (target === 'vault') {
                setShellModuleWidth('vault', startVaultWidth + delta);
                return;
            }
            setShellModuleWidth('context', startContextWidth - delta);
        };

        const handlePointerUp = () => {
            document.body.style.cursor = previousCursor;
            document.body.style.userSelect = previousUserSelect;
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp, { once: true });
        window.addEventListener('pointercancel', handlePointerUp, { once: true });
    };

    const shellGridStyle = {
        '--notes-vault-width': isVaultVisible ? `${notesShell.vaultWidth}px` : '0px',
        '--notes-vault-separator-width': isVaultVisible ? '8px' : '0px',
        '--notes-context-width': isRightModuleVisible ? `${notesShell.contextWidth}px` : '0px',
        '--notes-context-separator-width': isRightModuleVisible ? '8px' : '0px',
    } as CSSProperties;

    return (
        <div className={`absolute inset-0 overflow-hidden ${glass.bg}`}>
            <main
                style={shellGridStyle}
                className="relative z-[1] grid h-full min-h-0 grid-cols-[48px_var(--notes-vault-width)_var(--notes-vault-separator-width)_minmax(0,1fr)_var(--notes-context-separator-width)_var(--notes-context-width)] gap-0 p-2 max-xl:grid-cols-[48px_var(--notes-vault-width)_var(--notes-vault-separator-width)_minmax(0,1fr)]"
            >
                <aside className={`flex min-h-0 flex-col items-center overflow-hidden ${glass.panel}`}>
                    <div className="flex h-12 w-full items-center justify-center border-b border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-header)]">
                        <BookOpen size={17} className="text-[var(--vibe-accent)]" />
                    </div>
                    <div className="flex flex-1 flex-col items-center gap-1.5 py-2">
                        <button
                            type="button"
                            onClick={() => onWorkspaceModeChange('canvas')}
                            className="flex h-9 w-9 items-center justify-center rounded-[var(--vibe-radius-sm)] text-[var(--vibe-text-faint)] transition-colors hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                            title={t('workspace.mode.canvas')}
                        >
                            <MapIcon size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={onOpenInventory}
                            className="flex h-9 w-9 items-center justify-center rounded-[var(--vibe-radius-sm)] text-[var(--vibe-text-faint)] transition-colors hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                            title={t('workspace.notes.personalInventory')}
                        >
                            <Tags size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={onOpenSettings}
                            className="flex h-9 w-9 items-center justify-center rounded-[var(--vibe-radius-sm)] text-[var(--vibe-text-faint)] transition-colors hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                            title={t('workspace.notes.settings')}
                        >
                            <Settings size={16} />
                        </button>
                        <div className="my-1 h-px w-6 bg-[var(--vibe-border-subtle)]" />
                        {shellRibbonModules.map(({ id, labelKey, iconKey }) => {
                            const Icon = NOTES_SHELL_MODULE_ICONS[iconKey];
                            const isActive = notesShell.modules[id];
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => toggleShellModule(id)}
                                    className={`flex h-9 w-9 items-center justify-center rounded-[var(--vibe-radius-sm)] transition-colors ${
                                        isActive
                                            ? 'bg-[var(--vibe-surface-hover)] text-[var(--vibe-accent)]'
                                            : 'text-[var(--vibe-text-faint)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                                    }`}
                                    title={t(labelKey)}
                                >
                                    <Icon size={16} />
                                </button>
                            );
                        })}
                    </div>
                    <div className="border-t border-[var(--vibe-border-subtle)] py-2">
                        <button
                            type="button"
                            disabled={!hasWorkspaceTabs}
                            onClick={resetWorkspaceLayout}
                            className={`mb-1 flex h-9 w-9 items-center justify-center rounded-[var(--vibe-radius-sm)] transition-colors ${
                                hasWorkspaceTabs
                                    ? 'text-[var(--vibe-text-faint)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                                    : 'cursor-not-allowed text-[var(--vibe-text-faint)] opacity-35'
                            }`}
                            title={t('workspace.notes.resetTabs')}
                        >
                            <RotateCcw size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={onLeave}
                            className="flex h-9 w-9 items-center justify-center rounded-[var(--vibe-radius-sm)] text-[var(--vibe-text-faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-danger)_14%,transparent)] hover:text-[var(--vibe-danger)]"
                            title={t('hud.leave')}
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </aside>

                {isVaultVisible && (
                <aside className={`ml-2 flex min-h-0 flex-col overflow-hidden ${glass.panel}`}>
                    <div className={`${glass.panelHeader} p-2.5`}>
                        <div className="flex items-center gap-2">
                            <Database size={16} className="text-[var(--vibe-accent)]" />
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-accent)]">
                                    {t('workspace.notes.vault')}
                                </p>
                                <h2 className="truncate text-sm font-black text-[var(--vibe-text-primary)]">
                                    {t('workspace.notes.title')}
                                </h2>
                            </div>
                        </div>
                        <div className="mt-2 flex min-w-0 items-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--vibe-success)] shadow-[0_0_8px_var(--vibe-success)]" />
                            <span className="truncate">{t('hud.room')} {roomName}</span>
                        </div>
                        <label className="mt-3 block">
                            <span className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                                {t('workspace.notes.storageScope')}
                            </span>
                            <select
                                value={vaultScope}
                                onChange={(event) => setVaultScope(event.target.value as VaultScope)}
                                className="h-8 w-full rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 text-xs font-bold text-[var(--vibe-text-primary)] outline-none transition-colors focus:border-[var(--vibe-border-strong)]"
                            >
                                {vaultScopeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label} ({option.count})
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className="mt-3 flex gap-1.5">
                            {(['general', 'user', 'gm'] as DatabaseType[]).map((database) => (
                                <span
                                    key={database}
                                    className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-muted)]"
                                >
                                    {t(`workspace.notes.databases.${database}`)} {visibleCounts[database]}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="border-b border-[var(--vibe-border-subtle)] p-2.5">
                        <label className="flex h-8 items-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2.5 text-xs text-[var(--vibe-text-muted)] focus-within:border-[var(--vibe-border-strong)]">
                            <Search size={14} className="shrink-0 text-[var(--vibe-text-faint)]" />
                            <input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                className="min-w-0 flex-1 bg-transparent text-[var(--vibe-text-primary)] outline-none placeholder:text-[var(--vibe-text-faint)]"
                                placeholder={t('workspace.notes.searchPlaceholder')}
                            />
                        </label>
                        {searchQuery.trim() && (
                            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[var(--vibe-text-faint)]">
                                <span className="truncate">
                                    {t('workspace.notes.searchSummary', { count: filteredEntities.length })}
                                </span>
                                {searchTerms.length > 0 && (
                                    <span className="truncate font-mono">
                                        {searchTerms.slice(0, 4).join(', ')}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-2">
                        {searchQuery.trim() ? (
                            <div className="space-y-1.5">
                                {filteredEntities.length ? filteredEntities.map(({ entity, result }) => (
                                    <EntitySearchResultButton key={entity.id} entity={entity} result={result} onOpenEntity={handleOpenEntity} t={t} />
                                )) : (
                                    <div className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] p-4 text-center text-xs text-[var(--vibe-text-faint)]">
                                        {t('workspace.notes.noSearchResults')}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {vaultGroups.map((group) => {
                                    const Icon = ENTITY_TYPE_ICONS[group.type] ?? FileText;
                                    const isCollapsed = collapsedVaultGroups.has(group.type);

                                    return (
                                        <section
                                            key={group.type}
                                            className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)]"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => handleToggleVaultGroup(group.type)}
                                                className="flex h-8 w-full items-center gap-2 border-b border-[var(--vibe-border-subtle)] px-2 text-left text-[10px] font-black uppercase tracking-wider text-[var(--vibe-text-muted)] transition-colors hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                                            >
                                                <ChevronRight size={13} className={`shrink-0 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                                                <Icon size={13} className="shrink-0 text-[var(--vibe-accent)]" />
                                                <span className="min-w-0 flex-1 truncate">{t(`workspace.notes.entityTypes.${group.type}`)}</span>
                                                <span className="font-mono text-[9px] text-[var(--vibe-text-faint)]">{group.totalCount}</span>
                                            </button>
                                            {!isCollapsed && (
                                                <div className="space-y-0.5 p-1.5">
                                                    {group.rootItems.map((entity) => (
                                                        <EntityTreeItem
                                                            key={entity.id}
                                                            entity={entity}
                                                            activeEntityId={activeEntity?.id}
                                                            childrenByParent={childrenByParent}
                                                            depth={0}
                                                            expandedEntityIds={expandedEntityIds}
                                                            onOpenEntity={handleOpenEntity}
                                                            onToggleExpanded={handleToggleExpanded}
                                                            t={t}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </section>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </aside>
                )}

                {isVaultVisible && (
                <div
                    role="separator"
                    aria-orientation="vertical"
                    onPointerDown={(event) => handleShellResizeStart('vault', event)}
                    className="group flex cursor-col-resize items-center justify-center"
                    title={t('workspace.notes.resizeModule')}
                >
                    <div className="h-14 w-px rounded-full bg-[var(--vibe-border-subtle)] transition-colors group-hover:bg-[var(--vibe-accent)]" />
                </div>
                )}

                <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
                    <div className="min-h-0 flex-1">
                        <NotesWorkspaceNodeView
                            node={notesLayout.root}
                            activeGroupId={notesLayout.activeGroupId}
                            groupOrder={workspaceGroupOrder}
                            entitiesById={entitiesById}
                            visibleEntities={visibleEntities}
                            childrenByParent={childrenByParent}
                            onSetActiveGroup={setActiveWorkspaceGroup}
                            onSetActiveTab={setActiveWorkspaceTab}
                            onSetTabView={setWorkspaceTabView}
                            onCloseTab={closeWorkspaceTab}
                            onCloseGroup={closeWorkspaceGroup}
                            onSplitGroup={handleSplitWorkspaceGroup}
                            onSplitTabToGroup={splitWorkspaceTabToGroup}
                            onResizeSplit={resizeWorkspaceSplit}
                            onMoveTab={moveWorkspaceTab}
                            onOpenEntity={handleOpenEntity}
                            onCopyEntityWikiLink={handleCopyEntityWikiLink}
                            onCopyEntityId={handleCopyEntityId}
                            onPinEntityToCanvas={handlePinEntityToCanvas}
                            canPinToCanvas={canPinToActiveCanvas}
                            dockDropTarget={dockDropTarget}
                            onDockDropTargetChange={setDockDropTarget}
                            t={t}
                        />
                    </div>
                    {isAudioVisible && (
                        <div
                            role="separator"
                            aria-orientation="horizontal"
                            onPointerDown={(event) => handleShellResizeStart('audio', event)}
                            className="group flex h-3 flex-shrink-0 cursor-row-resize items-center justify-center"
                            title={t('workspace.notes.resizeModule')}
                        >
                            <div className="h-px w-16 rounded-full bg-[var(--vibe-border-subtle)] transition-colors group-hover:bg-[var(--vibe-accent)]" />
                        </div>
                    )}
                    {isAudioVisible && (
                        <section
                            id={NOTES_AUDIO_DOCK_HOST_ID}
                            className={`min-h-0 flex-shrink-0 overflow-hidden ${glass.panel}`}
                            style={{ height: `${notesShell.audioHeight}px` }}
                        />
                    )}
                </section>

                {isRightModuleVisible && (
                <div
                    role="separator"
                    aria-orientation="vertical"
                    onPointerDown={(event) => handleShellResizeStart('context', event)}
                    className="group flex cursor-col-resize items-center justify-center max-xl:hidden"
                    title={t('workspace.notes.resizeModule')}
                >
                    <div className="h-14 w-px rounded-full bg-[var(--vibe-border-subtle)] transition-colors group-hover:bg-[var(--vibe-accent)]" />
                </div>
                )}

                {isRightModuleVisible && (
                    <aside className={`flex min-h-0 flex-col gap-2 overflow-hidden max-xl:hidden ${glass.panel}`}>
                        {isSearchVisible && (
                            <section className={`${isContextVisible || isNotificationsVisible || isGraphVisible ? 'max-h-[34%] min-h-[220px] border-b border-[var(--vibe-border-subtle)]' : 'min-h-0 flex-1'} flex flex-col overflow-hidden`}>
                                <div className={`${glass.panelHeader} p-2.5`}>
                                    <div className="flex items-center gap-2">
                                        <Search size={16} className="text-[var(--vibe-accent)]" />
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-accent)]">
                                                {t('workspace.notes.modules.search')}
                                            </p>
                                            <h2 className="truncate text-sm font-black text-[var(--vibe-text-primary)]">
                                                {searchQuery.trim()
                                                    ? t('workspace.notes.searchSummary', { count: filteredEntities.length })
                                                    : t('workspace.notes.searchPlaceholder')}
                                            </h2>
                                        </div>
                                    </div>
                                </div>
                                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                                    <label className="mb-3 flex h-8 items-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2.5 text-xs text-[var(--vibe-text-muted)] focus-within:border-[var(--vibe-border-strong)]">
                                        <Search size={14} className="shrink-0 text-[var(--vibe-text-faint)]" />
                                        <input
                                            value={searchQuery}
                                            onChange={(event) => setSearchQuery(event.target.value)}
                                            className="min-w-0 flex-1 bg-transparent text-[var(--vibe-text-primary)] outline-none placeholder:text-[var(--vibe-text-faint)]"
                                            placeholder={t('workspace.notes.searchPlaceholder')}
                                        />
                                    </label>
                                    {searchQuery.trim() ? (
                                        <div className="space-y-1.5">
                                            {filteredEntities.length ? filteredEntities.map(({ entity, result }) => (
                                                <EntitySearchResultButton key={entity.id} entity={entity} result={result} onOpenEntity={handleOpenEntity} t={t} />
                                            )) : (
                                                <div className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] p-4 text-center text-xs text-[var(--vibe-text-faint)]">
                                                    {t('workspace.notes.noSearchResults')}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] p-4 text-center text-xs text-[var(--vibe-text-faint)]">
                                            {t('workspace.notes.searchHint')}
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        {isGraphVisible && (
                            <section className={`${isContextVisible || isNotificationsVisible ? 'max-h-[42%] min-h-[260px] border-b border-[var(--vibe-border-subtle)]' : 'min-h-0 flex-1'} flex flex-col overflow-hidden`}>
                                <div className={`${glass.panelHeader} p-2.5`}>
                                    <div className="flex items-center gap-2">
                                        <Network size={16} className="text-[var(--vibe-accent)]" />
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-accent)]">
                                                {t('workspace.notes.modules.graph')}
                                            </p>
                                            <h2 className="truncate text-sm font-black text-[var(--vibe-text-primary)]">
                                                {activeEntity?.name ?? t('workspace.notes.noActiveEntity')}
                                            </h2>
                                        </div>
                                    </div>
                                </div>
                                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                                    {activeEntity ? (
                                        <GraphDockPanel
                                            entity={activeEntity}
                                            linkedViews={activeLinkedViews}
                                            entitiesById={entitiesById}
                                            onOpenEntity={handleOpenEntity}
                                            t={t}
                                        />
                                    ) : (
                                        <div className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] p-5 text-center text-xs text-[var(--vibe-text-faint)]">
                                            {t('workspace.notes.noActiveEntityHint')}
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        {isContextVisible && (
                            <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
                                <div className={`${glass.panelHeader} p-2.5`}>
                                    <div className="flex items-center gap-2">
                                        <GitFork size={16} className="text-[var(--vibe-accent)]" />
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-accent)]">
                                                {t('workspace.notes.context')}
                                            </p>
                                            <h2 className="truncate text-sm font-black text-[var(--vibe-text-primary)]">
                                                {activeEntity?.name ?? t('workspace.notes.noActiveEntity')}
                                            </h2>
                                        </div>
                                    </div>
                                </div>

                                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                                    {activeEntity ? (
                                        <div className="space-y-4">
                                            <section>
                                                <div className="mb-2 flex items-center justify-between gap-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                                                        {t('workspace.notes.entity')}
                                                    </span>
                                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${getDatabaseTone(activeEntity.database)}`}>
                                                        {t(`workspace.notes.databases.${activeEntity.database ?? 'general'}`)}
                                                    </span>
                                                </div>
                                                <div className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3">
                                                    <p className="truncate text-sm font-black text-[var(--vibe-text-primary)]">{activeEntity.name}</p>
                                                    <p className="mt-1 truncate text-[10px] uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                                        {t(`workspace.notes.entityTypes.${activeEntity.type}`)}
                                                    </p>
                                                </div>
                                            </section>

                                            <section>
                                                <div className="mb-2 flex items-center justify-between gap-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                                                        {t('workspace.notes.attachedEntities')}
                                                    </span>
                                                    <span className="font-mono text-[10px] text-[var(--vibe-text-faint)]">{activeChildren.length}</span>
                                                </div>
                                                {activeChildren.length ? (
                                                    <div className="space-y-1.5">
                                                        {activeChildren.slice(0, 12).map((child) => (
                                                            <EntityListButton key={child.id} entity={child} onOpenEntity={handleOpenEntity} t={t} />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-[var(--vibe-text-faint)]">{t('workspace.notes.noAttachedEntities')}</p>
                                                )}
                                            </section>

                                            <LinkedViewsPanel linkedViews={activeLinkedViews} entitiesById={entitiesById} onOpenEntity={handleOpenEntity} t={t} />
                                        </div>
                                    ) : (
                                        <div className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] p-5 text-center text-xs text-[var(--vibe-text-faint)]">
                                            {t('workspace.notes.noActiveEntityHint')}
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        {isNotificationsVisible && (
                            <section className={`${isContextVisible ? 'max-h-[42%] min-h-[220px] border-t border-[var(--vibe-border-subtle)]' : 'min-h-0 flex-1'} flex flex-col overflow-hidden`}>
                                <div className={`${glass.panelHeader} p-2.5`}>
                                    <div className="flex items-center gap-2">
                                        <Bell size={16} className="text-[var(--vibe-accent)]" />
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-accent)]">
                                                {t('workspace.notes.modules.notifications')}
                                            </p>
                                            <h2 className="truncate text-sm font-black text-[var(--vibe-text-primary)]">
                                                {t('workspace.notes.modules.notifications')}
                                            </h2>
                                        </div>
                                    </div>
                                </div>
                                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                                    <NotificationCenter surface="embedded" />
                                </div>
                            </section>
                        )}
                    </aside>
                )}
            </main>
        </div>
    );
}
