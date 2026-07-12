import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties, DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import {
    BookOpen,
    Boxes,
    Box,
    Bold,
    Bell,
    ChevronLeft,
    ChevronRight,
    Code2,
    Columns2,
    Copy,
    CornerDownRight,
    CornerUpLeft,
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
    Pin,
    PencilLine,
    Plus,
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
import { saveEntity } from '../../services/fileApi';
import { WikiLinkTextarea } from '../ui/WikiLinkTextarea';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';
import { NotificationCenter } from '../ui/NotificationCenter';
import { CharacterSheet } from '../windows/CharacterSheet';
import { ObjectSheet } from '../windows/blocks/ObjectSheet';
import { AttackSheet } from '../windows/blocks/AttackSheet';
import { AbilitySheet } from '../windows/blocks/AbilitySheet';
import { EntityImageBlock } from '../windows/blocks/EntityImageBlock';
import { TagEditor } from '../windows/blocks/TagEditor';
import {
    buildNotesWorkspaceLinkedViews,
    getNotesWorkspaceLinkedViewSections,
    type NotesWorkspaceLinkedViewSection,
    type NotesWorkspaceLinkedViews,
} from '../../utils/notesWorkspaceLinks';
import {
    buildNotesWorkspaceEmbeddedEntityTree,
    canMoveNotesWorkspaceEmbeddedEntity,
    filterNotesWorkspaceEmbeddedEntityTree,
    type NotesWorkspaceEmbeddedEntityNode,
} from '../../utils/notesWorkspaceBlocks';
import { listNotesWorkspaceGroups, type NotesWorkspaceNode, type NotesWorkspaceSplitPlacement, type NotesWorkspaceTab, type NotesWorkspaceView } from '../../utils/notesWorkspaceLayout';
import {
    groupVisibleNotesShellModules,
    listImplementedNotesShellModules,
    listVisibleNotesShellModules,
    type NotesWorkspaceDockArea,
    type NotesWorkspaceModuleDefinition,
    type NotesWorkspaceShellAreaLayout,
    type NotesWorkspaceShellAreaLayouts,
    type NotesWorkspaceShellModuleDefinition,
    type NotesWorkspaceShellModuleId,
    type NotesWorkspaceShellModuleRenderGroup,
} from '../../utils/notesWorkspaceModules';
import { getEntitySearchResult, getEntitySearchTerms, type EntitySearchMatchField, type EntitySearchResult } from '../../utils/entitySearch';
import { canModifyEntity, canViewEntity } from '../../utils/permissions';
import { writeClipboardText } from '../../utils/clipboard';
import { generateEntityId } from '../../utils/entityId';
import { moveEntityTreeToParent } from '../../utils/entityTreeMutations';
import {
    CANVAS_WINDOW_INSTANCES_PROPERTY,
    createCanvasWindowInstance,
    getNextCanvasWindowZIndex,
    readCanvasWindowInstances,
    upsertCanvasWindowInstance,
} from '../../utils/canvasPersistence';
import { createMarkdownEntityEmbedInsertion } from '../../utils/markdownEntityEmbeds';
import { NOTES_AUDIO_DOCK_HOST_ID } from '../../utils/notesWorkspaceConstants';
import { replaceTextareaSelectionPreservingUndo } from '../../utils/textareaEditing';
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

const ROOT_CREATE_TYPES: EntityType[] = ['note', 'character', 'object', 'ability', 'competency', 'canvas', 'folder'];

const NOTES_SHELL_MODULE_ICONS: Record<NotesWorkspaceModuleDefinition['iconKey'], LucideIcon> = {
    editor: FileText,
    vault: Database,
    context: GitFork,
    notifications: Bell,
    search: Search,
    graph: Network,
    audio: Volume2,
};

const NOTES_SHELL_EMPTY_SIDE_WIDTH = 44;
const NOTES_SHELL_SEPARATOR_WIDTH = 8;

type Translate = (key: string, options?: Record<string, unknown>) => string;

type NotesWorkspaceDropZone = 'left' | 'right' | 'top' | 'bottom';
type VaultScope = 'all' | DatabaseType | `user:${string}`;
type NotesShellResizeTarget = 'vault' | 'context' | 'audio';
type NotesShellInteractiveArea = Extract<NotesWorkspaceDockArea, 'left' | 'center' | 'right'>;

interface NotesDockDropTarget {
    groupId: string;
    zone: NotesWorkspaceDropZone | null;
    beforeTabId?: string | null;
}

interface NotesShellModuleDropTarget {
    area: NotesShellInteractiveArea;
    beforeModuleId: NotesWorkspaceShellModuleId | null;
    targetModuleId: NotesWorkspaceShellModuleId | null;
    placement: NotesWorkspaceDropZone | null;
    layout: NotesWorkspaceShellAreaLayout;
    targetTabGroupId?: string;
    beforeTabId?: NotesWorkspaceShellModuleId | null;
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

function createRootEntityDraft(type: EntityType, id: string): Entity {
    const base: Entity = {
        id,
        parentId: null,
        type,
        database: 'general',
        name: type,
        description: '',
        tags: [],
        properties: {},
    };

    if (type === 'character') {
        return { ...base, name: 'character', description: 'Новый персонаж.', properties: { strength: { base: 14 }, dexterity: { base: 12 } } };
    }
    if (type === 'object') {
        return { ...base, name: 'object', description: 'Новый предмет.', properties: { 'фигура': 1, 'прочность': 1, 'нагрузка': 1, 'редкость': 0, 'цена': 0 } };
    }
    if (type === 'ability') {
        return { ...base, name: 'ability', description: 'Новая способность.', properties: { cost: { base: 0 }, diceFormula: '' } };
    }
    if (type === 'competency') {
        return { ...base, name: 'competency', description: 'Новая компетенция.', properties: { rank: 0 } };
    }
    if (type === 'canvas') {
        return { ...base, name: 'canvas', description: 'Новое рабочее пространство.', properties: { x: 100, y: 100 } };
    }
    if (type === 'folder') {
        return { ...base, name: 'folder', description: 'Папка.', properties: { folderType: 'note' } };
    }
    if (type === 'tag') {
        return { ...base, name: 'tag', description: 'Новый тег.', properties: { modifiers: [] } };
    }
    if (type === 'attack') {
        return { ...base, name: 'attack', description: 'Новая атака.', properties: { 'урон': 1, 'масштаб': 1, 'попадание': 1, 'дистанция': 'ближняя' } };
    }

    return { ...base, name: 'note', description: '# Новая заметка' };
}

function isNotesShellInteractiveArea(value: unknown): value is NotesShellInteractiveArea {
    return value === 'left' || value === 'center' || value === 'right';
}

function findDockGroupElement(clientX: number, clientY: number): HTMLElement | null {
    const element = document.elementFromPoint(clientX, clientY);
    return element?.closest<HTMLElement>('[data-notes-group-id]') ?? null;
}

function getNotesTabInsertBeforeId(
    groupElement: HTMLElement,
    clientX: number,
    clientY: number,
    sourceTabId: string
): string | null | undefined {
    const pointedElement = document.elementFromPoint(clientX, clientY);
    const tabStrip = pointedElement?.closest<HTMLElement>('[data-notes-tab-strip]');
    if (!tabStrip || tabStrip.closest('[data-notes-group-id]') !== groupElement) return undefined;

    const tabElements = Array.from(tabStrip.querySelectorAll<HTMLElement>('[data-notes-tab-id]'))
        .filter((tabElement) => tabElement.dataset.notesTabId !== sourceTabId);
    for (const tabElement of tabElements) {
        const rect = tabElement.getBoundingClientRect();
        if (clientX < rect.left + rect.width / 2) return tabElement.dataset.notesTabId ?? null;
    }
    return null;
}

function getShellLayoutFromDropZone(zone: NotesWorkspaceDropZone): NotesWorkspaceShellAreaLayout {
    return zone === 'left' || zone === 'right' ? 'row' : 'column';
}

function getBeforeModuleIdForShellDrop(
    moduleElements: HTMLElement[],
    targetIndex: number,
    placement: NotesWorkspaceDropZone
): NotesWorkspaceShellModuleId | null {
    if (placement === 'left' || placement === 'top') {
        const moduleId = moduleElements[targetIndex]?.dataset.notesShellModuleId;
        return moduleId ? moduleId as NotesWorkspaceShellModuleId : null;
    }

    const moduleId = moduleElements[targetIndex + 1]?.dataset.notesShellModuleId;
    return moduleId ? moduleId as NotesWorkspaceShellModuleId : null;
}

function getShellTabDropTarget(
    clientX: number,
    clientY: number,
    sourceModuleId: NotesWorkspaceShellModuleId,
    moduleLayouts: NotesWorkspaceShellAreaLayouts
): NotesShellModuleDropTarget | null {
    const element = document.elementFromPoint(clientX, clientY);
    const tabStrip = element?.closest<HTMLElement>('[data-notes-shell-module-tabs]');
    const frame = tabStrip?.closest<HTMLElement>('[data-notes-shell-tab-group-id]');
    const areaElement = frame?.closest<HTMLElement>('[data-notes-shell-area]');
    const targetTabGroupId = frame?.dataset.notesShellTabGroupId;
    const area = areaElement?.dataset.notesShellArea;
    if (!tabStrip || !targetTabGroupId || !isNotesShellInteractiveArea(area)) return null;

    const tabElements = Array.from(tabStrip.querySelectorAll<HTMLElement>('[data-notes-shell-module-tab]'))
        .filter((tabElement) => tabElement.dataset.notesShellModuleTab !== sourceModuleId);
    const beforeTabElement = tabElements.find((tabElement) => {
        const rect = tabElement.getBoundingClientRect();
        return clientX < rect.left + rect.width / 2;
    });
    const beforeTabId = beforeTabElement?.dataset.notesShellModuleTab as NotesWorkspaceShellModuleId | undefined;

    return {
        area,
        beforeModuleId: null,
        targetModuleId: null,
        placement: null,
        layout: moduleLayouts[area] ?? 'column',
        targetTabGroupId,
        beforeTabId: beforeTabId ?? null,
    };
}

function getShellModuleDropTarget(
    clientX: number,
    clientY: number,
    sourceModuleId: NotesWorkspaceShellModuleId,
    moduleLayouts: NotesWorkspaceShellAreaLayouts
): NotesShellModuleDropTarget | null {
    const element = document.elementFromPoint(clientX, clientY);
    const areaElement = element?.closest<HTMLElement>('[data-notes-shell-area]');
    const area = areaElement?.dataset.notesShellArea;
    if (!areaElement || !isNotesShellInteractiveArea(area)) return null;
    const currentLayout = moduleLayouts[area] ?? 'column';

    const moduleElements = Array.from(areaElement.querySelectorAll<HTMLElement>('[data-notes-shell-module-id]'))
        .filter((moduleElement) => moduleElement.dataset.notesShellModuleId !== sourceModuleId);

    if (moduleElements.length === 0) {
        return { area, beforeModuleId: null, targetModuleId: null, placement: null, layout: currentLayout };
    }

    for (const [index, moduleElement] of moduleElements.entries()) {
        const moduleId = moduleElement.dataset.notesShellModuleId;
        if (!moduleId) continue;

        const rect = moduleElement.getBoundingClientRect();
        const isInsideModule = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
        if (isInsideModule) {
            const placement = getNotesDockDropZone(moduleElement, clientX, clientY);
            if (!placement) {
                return {
                    area,
                    beforeModuleId: null,
                    targetModuleId: moduleId as NotesWorkspaceShellModuleId,
                    placement: null,
                    layout: currentLayout,
                };
            }
            return {
                area,
                beforeModuleId: getBeforeModuleIdForShellDrop(moduleElements, index, placement),
                targetModuleId: null,
                placement,
                layout: getShellLayoutFromDropZone(placement),
            };
        }

        const shouldInsertBefore = currentLayout === 'row'
            ? clientX < rect.left + rect.width / 2
            : clientY < rect.top + rect.height / 2;
        if (shouldInsertBefore) {
            const placement = currentLayout === 'row' ? 'left' : 'top';
            return { area, beforeModuleId: moduleId as NotesWorkspaceShellModuleId, targetModuleId: null, placement, layout: currentLayout };
        }
    }

    const placement = currentLayout === 'row' ? 'right' : 'bottom';
    return { area, beforeModuleId: null, targetModuleId: null, placement, layout: currentLayout };
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
        .join(' / ');
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

function countEmbeddedBlockChildren(nodes: readonly NotesWorkspaceEmbeddedEntityNode[]): Map<string, number> {
    const counts = new Map<string, number>();
    const visit = (node: NotesWorkspaceEmbeddedEntityNode) => {
        counts.set(node.entity.id, node.children.length);
        node.children.forEach(visit);
    };
    nodes.forEach(visit);
    return counts;
}

interface EmbeddedEntityBlocksPanelProps {
    rootEntity: Entity;
    nodes: NotesWorkspaceEmbeddedEntityNode[];
    onOpenEntity: (entityId: string, view?: NotesWorkspaceView) => void;
    onCreateChildBlock: (parentEntityId: string) => void;
    onMoveBlockToParent: (sourceEntityId: string, targetParentId: string) => void;
    onCopyEntityWikiLink: (entityId: string) => void;
    onPinEntityToCanvas: (entityId: string) => void;
    canPinToCanvas: boolean;
    t: Translate;
}

function EmbeddedEntityBlocksPanel({
    rootEntity,
    nodes,
    onOpenEntity,
    onCreateChildBlock,
    onMoveBlockToParent,
    onCopyEntityWikiLink,
    onPinEntityToCanvas,
    canPinToCanvas,
    t,
}: EmbeddedEntityBlocksPanelProps) {
    const [collapsedEntityIds, setCollapsedEntityIds] = useState<Set<string>>(() => new Set());
    const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
    const childCountsById = useMemo(() => countEmbeddedBlockChildren(nodes), [nodes]);
    const embeddedEntities = useMemo(() => {
        const result: Entity[] = [];
        const visit = (items: readonly NotesWorkspaceEmbeddedEntityNode[]) => {
            for (const item of items) {
                result.push(item.entity);
                visit(item.children);
            }
        };
        visit(nodes);
        return result;
    }, [nodes]);
    const visibleNodes = useMemo(
        () => filterNotesWorkspaceEmbeddedEntityTree(nodes, collapsedEntityIds),
        [nodes, collapsedEntityIds]
    );

    if (nodes.length === 0) return null;

    const toggleCollapsed = (entityId: string) => {
        setCollapsedEntityIds((current) => {
            const next = new Set(current);
            if (next.has(entityId)) next.delete(entityId);
            else next.add(entityId);
            return next;
        });
    };

    const getDraggedBlockId = (event: ReactDragEvent<HTMLElement>) => {
        return event.dataTransfer.getData('application/vnd.vibe.notes-block') || draggedBlockId;
    };

    const canDropBlockInto = (sourceEntityId: string | null, targetParentId: string) => {
        if (!sourceEntityId) return false;
        return canMoveNotesWorkspaceEmbeddedEntity(embeddedEntities, sourceEntityId, targetParentId);
    };

    const renderNode = (node: NotesWorkspaceEmbeddedEntityNode): ReactNode => {
        const Icon = ENTITY_TYPE_ICONS[node.entity.type] ?? FileText;
        const description = node.entity.description?.trim();
        const originalChildCount = childCountsById.get(node.entity.id) ?? 0;
        const hasChildren = originalChildCount > 0;
        const isCollapsed = collapsedEntityIds.has(node.entity.id);
        const canCreateChildBlock = canEditEntityInWorkspace(node.entity);
        const canAcceptDraggedBlock = canDropBlockInto(draggedBlockId, node.entity.id);
        const moveParentCandidates = embeddedEntities.filter((candidate) => (
            candidate.id !== node.entity.id
            && candidate.id !== node.entity.parentId
            && canMoveNotesWorkspaceEmbeddedEntity(embeddedEntities, node.entity.id, candidate.id)
        ));

        return (
            <article
                key={node.entity.id}
                data-notes-embedded-block-id={node.entity.id}
                draggable={canCreateChildBlock}
                onDragStart={(event) => {
                    if (!canCreateChildBlock) return;
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('application/vnd.vibe.notes-block', node.entity.id);
                    setDraggedBlockId(node.entity.id);
                }}
                onDragEnd={() => setDraggedBlockId(null)}
                onDragOver={(event) => {
                    const sourceEntityId = getDraggedBlockId(event);
                    if (!canDropBlockInto(sourceEntityId, node.entity.id)) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(event) => {
                    const sourceEntityId = getDraggedBlockId(event);
                    if (!canDropBlockInto(sourceEntityId, node.entity.id)) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onMoveBlockToParent(sourceEntityId!, node.entity.id);
                    setDraggedBlockId(null);
                }}
                className={`rounded-[var(--vibe-radius-md)] border bg-[color-mix(in_srgb,var(--vibe-surface-block)_88%,transparent)] p-3 shadow-[var(--vibe-shadow-block)] transition-colors ${
                    canAcceptDraggedBlock
                        ? 'border-[var(--vibe-accent)] bg-[color-mix(in_srgb,var(--vibe-accent)_10%,var(--vibe-surface-block))]'
                        : 'border-[var(--vibe-border-subtle)]'
                } ${canCreateChildBlock ? 'cursor-grab active:cursor-grabbing' : ''}`}
                style={{ marginLeft: `${Math.min(node.depth, 4) * 14}px` }}
            >
                <div className="flex min-w-0 items-start gap-2">
                    {hasChildren ? (
                        <button
                            type="button"
                            onClick={() => toggleCollapsed(node.entity.id)}
                            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--vibe-radius-xs)] border border-[var(--vibe-border-subtle)] text-[var(--vibe-text-muted)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                            aria-label={t(isCollapsed ? 'workspace.notes.expandEmbeddedBlock' : 'workspace.notes.collapseEmbeddedBlock')}
                            title={t(isCollapsed ? 'workspace.notes.expandEmbeddedBlock' : 'workspace.notes.collapseEmbeddedBlock')}
                        >
                            <ChevronRight size={14} className={`transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                        </button>
                    ) : (
                        <span className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
                    )}
                    <button
                        type="button"
                        onClick={() => onOpenEntity(node.entity.id, 'preview')}
                        className="group flex min-w-0 flex-1 items-start gap-2 text-left"
                        title={node.entity.name}
                    >
                        <Icon size={15} className={`mt-0.5 shrink-0 ${getDatabaseTone(node.entity.database)}`} />
                        <span className="min-w-0 flex-1">
                            <span className="flex min-w-0 items-center gap-2">
                                <span className="min-w-0 flex-1 truncate text-sm font-black text-[var(--vibe-text-primary)] group-hover:text-[var(--vibe-accent)]">
                                    {node.entity.name}
                                </span>
                                {hasChildren && (
                                    <span className="shrink-0 font-mono text-[10px] text-[var(--vibe-text-faint)]">
                                        {originalChildCount}
                                    </span>
                                )}
                            </span>
                            <span className="mt-0.5 block truncate text-[10px] uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                {t(`workspace.notes.entityTypes.${node.entity.type}`)} / {t(`workspace.notes.databases.${node.entity.database ?? 'general'}`)}
                            </span>
                        </span>
                    </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--vibe-border-subtle)] pt-2">
                    <button
                        type="button"
                        onClick={() => onOpenEntity(node.entity.id, 'source')}
                        className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-muted)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                    >
                        {t('workspace.notes.openBlock')}
                    </button>
                    <button
                        type="button"
                        onClick={() => onOpenEntity(node.entity.id, 'split')}
                        className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-muted)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                    >
                        {t('workspace.notes.openBlockSplit')}
                    </button>
                    <button
                        type="button"
                        onClick={() => onCopyEntityWikiLink(node.entity.id)}
                        className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-muted)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                    >
                        {t('workspace.notes.copyWikiLink')}
                    </button>
                    <button
                        type="button"
                        onClick={() => onCreateChildBlock(node.entity.id)}
                        disabled={!canCreateChildBlock}
                        className={`inline-flex items-center gap-1 rounded-[var(--vibe-radius-sm)] border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                            canCreateChildBlock
                                ? 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)] hover:border-[var(--vibe-accent)] hover:bg-[color-mix(in_srgb,var(--vibe-accent)_10%,transparent)] hover:text-[var(--vibe-accent)]'
                                : 'cursor-not-allowed border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)] opacity-50'
                        }`}
                    >
                        <Plus size={11} />
                        {t('workspace.notes.createNestedBlock')}
                    </button>
                    {moveParentCandidates.slice(0, 3).map((candidate) => {
                        const moveLabel = t('workspace.notes.moveBlockIntoNamed', { name: candidate.name });
                        return (
                            <button
                                key={candidate.id}
                                type="button"
                                draggable={false}
                                onPointerDown={(event) => event.stopPropagation()}
                                onMouseDown={(event) => event.stopPropagation()}
                                onDragStart={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                }}
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onMoveBlockToParent(node.entity.id, candidate.id);
                                }}
                                className="inline-flex max-w-full items-center gap-1 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-muted)] transition-colors hover:border-[var(--vibe-accent)] hover:bg-[color-mix(in_srgb,var(--vibe-accent)_10%,transparent)] hover:text-[var(--vibe-accent)]"
                                title={moveLabel}
                                aria-label={moveLabel}
                            >
                                <CornerDownRight size={11} />
                                <span className="truncate">{moveLabel}</span>
                            </button>
                        );
                    })}
                    {node.depth > 0 && (
                        <button
                            type="button"
                            draggable={false}
                            onPointerDown={(event) => event.stopPropagation()}
                            onMouseDown={(event) => event.stopPropagation()}
                            onDragStart={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                            }}
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onMoveBlockToParent(node.entity.id, rootEntity.id);
                            }}
                            className="inline-flex max-w-full items-center gap-1 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-muted)] transition-colors hover:border-[var(--vibe-accent)] hover:bg-[color-mix(in_srgb,var(--vibe-accent)_10%,transparent)] hover:text-[var(--vibe-accent)]"
                            title={t('workspace.notes.moveBlockToRootNamed', { name: rootEntity.name })}
                            aria-label={t('workspace.notes.moveBlockToRootNamed', { name: rootEntity.name })}
                        >
                            <CornerUpLeft size={11} />
                            <span className="truncate">
                                {t('workspace.notes.moveBlockToRootNamed', { name: rootEntity.name })}
                            </span>
                        </button>
                    )}
                    {canPinToCanvas && (
                        <button
                            type="button"
                            onClick={() => onPinEntityToCanvas(node.entity.id)}
                            className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-muted)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                        >
                            {t('workspace.notes.pinBlockToCanvas')}
                        </button>
                    )}
                </div>
                {description && (
                    <div className="mt-3 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3 text-sm">
                        <MarkdownRenderer content={description} entityId={node.entity.id} allowCustomBlocks={false} />
                    </div>
                )}
                {hasChildren && isCollapsed && (
                    <p className="mt-3 rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] px-3 py-2 text-xs text-[var(--vibe-text-faint)]">
                        {t('workspace.notes.collapsedEmbeddedChildren', { count: originalChildCount })}
                    </p>
                )}
                {node.children.length > 0 && (
                    <div className="mt-3 space-y-2 border-l border-[var(--vibe-border-subtle)] pl-2">
                        {node.children.map(renderNode)}
                    </div>
                )}
            </article>
        );
    };

    return (
        <section className="mt-4 border-t border-[var(--vibe-border-subtle)] pt-4">
            <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                    {t('workspace.notes.embeddedBlocks')}
                </span>
                <span className="font-mono text-[10px] text-[var(--vibe-text-faint)]">{nodes.length}</span>
            </div>
            <p className="mb-3 rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-3 py-2 text-[10px] text-[var(--vibe-text-faint)]">
                {t('workspace.notes.dragBlockToNest')}
            </p>
            <div className="space-y-2">
                {visibleNodes.map(renderNode)}
            </div>
        </section>
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
    sections?: NotesWorkspaceLinkedViewSection[];
    t: Translate;
}

function LinkedViewsPanel({
    linkedViews,
    entitiesById,
    onOpenEntity,
    sections = ['outline', 'outgoingLinks', 'backlinks'],
    t,
}: LinkedViewsPanelProps) {
    const visibleSections = new Set(sections);

    return (
        <div className="space-y-4">
            {visibleSections.has('outline') && (
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
            )}

            {visibleSections.has('outgoingLinks') && (
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
            )}

            {visibleSections.has('backlinks') && (
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
            )}
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
    embeddedNodes: NotesWorkspaceEmbeddedEntityNode[];
    canEdit: boolean;
    view: NotesWorkspaceView;
    onOpenEntity: (entityId: string, view?: NotesWorkspaceView) => void;
    onCreateChildBlock: (parentEntityId: string) => void;
    onMoveBlockToParent: (sourceEntityId: string, targetParentId: string) => void;
    onCopyEntityWikiLink: (entityId: string) => void;
    onPinEntityToCanvas: (entityId: string) => void;
    canPinToCanvas: boolean;
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
    { key: 'embed', titleKey: 'workspace.notes.richToolbar.embed', icon: Boxes, apply: createMarkdownEntityEmbedInsertion },
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
        const nextSelectionStart = selectionStart + insertion.selectStart;
        const nextSelectionEnd = selectionStart + insertion.selectEnd;

        if (!textarea) {
            const nextValue = `${value.slice(0, selectionStart)}${insertion.text}${value.slice(selectionEnd)}`;
            onValueChange(nextValue);
            return;
        }

        const insertedWithNativeUndo = replaceTextareaSelectionPreservingUndo(textarea, insertion.text);
        if (!insertedWithNativeUndo) onValueChange(textarea.value);

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
    embeddedNodes: NotesWorkspaceEmbeddedEntityNode[];
    canEdit: boolean;
    onOpenEntity: (entityId: string, view?: NotesWorkspaceView) => void;
    onCreateChildBlock: (parentEntityId: string) => void;
    onMoveBlockToParent: (sourceEntityId: string, targetParentId: string) => void;
    onCopyEntityWikiLink: (entityId: string) => void;
    onPinEntityToCanvas: (entityId: string) => void;
    canPinToCanvas: boolean;
    t: Translate;
}

function EntityUiPreviewPanel({
    entity,
    embeddedNodes,
    canEdit,
    onOpenEntity,
    onCreateChildBlock,
    onMoveBlockToParent,
    onCopyEntityWikiLink,
    onPinEntityToCanvas,
    canPinToCanvas,
    t,
}: EntityUiPreviewPanelProps) {
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
                                <EmbeddedEntityBlocksPanel
                                    rootEntity={entity}
                                    nodes={embeddedNodes}
                                    onOpenEntity={onOpenEntity}
                                    onCreateChildBlock={onCreateChildBlock}
                                    onMoveBlockToParent={onMoveBlockToParent}
                                    onCopyEntityWikiLink={onCopyEntityWikiLink}
                                    onPinEntityToCanvas={onPinEntityToCanvas}
                                    canPinToCanvas={canPinToCanvas}
                                    t={t}
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function NoteEditorPanel({
    entity,
    embeddedNodes,
    canEdit,
    view,
    onOpenEntity,
    onCreateChildBlock,
    onMoveBlockToParent,
    onCopyEntityWikiLink,
    onPinEntityToCanvas,
    canPinToCanvas,
    t,
}: NoteEditorPanelProps) {
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
            <EmbeddedEntityBlocksPanel
                rootEntity={entity}
                nodes={embeddedNodes}
                onOpenEntity={onOpenEntity}
                onCreateChildBlock={onCreateChildBlock}
                onMoveBlockToParent={onMoveBlockToParent}
                onCopyEntityWikiLink={onCopyEntityWikiLink}
                onPinEntityToCanvas={onPinEntityToCanvas}
                canPinToCanvas={canPinToCanvas}
                t={t}
            />
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
    onMergeGroup: (sourceGroupId: string, targetGroupId: string) => void;
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
    onCreateChildBlock: (parentEntityId: string) => void;
    onMoveBlockToParent: (sourceEntityId: string, targetParentId: string) => void;
    onNavigateBack: () => void;
    onNavigateForward: () => void;
    canNavigateBack: boolean;
    canNavigateForward: boolean;
    onCopyEntityWikiLink: (entityId: string) => void;
    onCopyEntityId: (entityId: string) => void;
    onPinEntityToCanvas: (entityId: string) => void;
    onCreateRootEntity: (type: EntityType) => void;
    canCreateRootEntity: boolean;
    hasWorkspaceTabs: boolean;
    canPinToCanvas: boolean;
    dockDropTarget: NotesDockDropTarget | null;
    onDockDropTargetChange: (target: NotesDockDropTarget | null) => void;
    t: Translate;
}

interface NotesShellModuleFrameProps {
    renderGroup: NotesWorkspaceShellModuleRenderGroup;
    subtitle?: string;
    isDragging: boolean;
    isMergeTarget: boolean;
    showDropBefore: boolean;
    showDropAfter: boolean;
    dropLayout: NotesWorkspaceShellAreaLayout;
    tabInsertBeforeId?: NotesWorkspaceShellModuleId | null;
    hideHeader?: boolean;
    onHeaderPointerDown: (moduleId: NotesWorkspaceShellModuleId, event: ReactPointerEvent<HTMLElement>) => void;
    onGroupHeaderPointerDown: (groupId: string, activeModuleId: NotesWorkspaceShellModuleId, event: ReactPointerEvent<HTMLElement>) => void;
    onActiveModuleChange: (groupId: string, moduleId: NotesWorkspaceShellModuleId) => void;
    children: ReactNode;
    t: Translate;
}

function NotesWorkspaceDropIndicator({
    layout,
    className = '',
}: {
    layout: NotesWorkspaceShellAreaLayout;
    className?: string;
}) {
    return (
        <div
            className={`shrink-0 rounded-full bg-[color-mix(in_srgb,var(--vibe-accent)_55%,transparent)] shadow-[0_0_22px_color-mix(in_srgb,var(--vibe-accent)_42%,transparent)] ${
                layout === 'row' ? 'w-2' : 'h-2'
            } ${className}`}
        />
    );
}

function NotesShellModuleFrame({
    renderGroup,
    subtitle,
    isDragging,
    isMergeTarget,
    showDropBefore,
    showDropAfter,
    dropLayout,
    tabInsertBeforeId,
    hideHeader = false,
    onHeaderPointerDown,
    onGroupHeaderPointerDown,
    onActiveModuleChange,
    children,
    t,
}: NotesShellModuleFrameProps) {
    const activeModule = renderGroup.modules.find((module) => module.id === renderGroup.activeModuleId)
        ?? renderGroup.modules[0];
    const Icon = NOTES_SHELL_MODULE_ICONS[activeModule.iconKey];
    const hasModuleTabs = renderGroup.modules.length > 1;

    return (
        <>
            {showDropBefore && (
                <NotesWorkspaceDropIndicator
                    layout={dropLayout}
                    className={dropLayout === 'row' ? 'my-2 self-stretch' : 'mx-2'}
                />
            )}
            <section
                data-notes-shell-module-id={activeModule.id}
                data-notes-shell-tab-group-id={hasModuleTabs ? renderGroup.id : undefined}
                className={`relative flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-[var(--vibe-radius-md)] border bg-[var(--vibe-surface-block)] shadow-[var(--vibe-shadow-block)] transition-all ${
                    isDragging ? 'opacity-55' : 'opacity-100'
                } ${isMergeTarget ? 'border-[var(--vibe-accent)] ring-2 ring-[color-mix(in_srgb,var(--vibe-accent)_35%,transparent)]' : 'border-[var(--vibe-border-subtle)]'}`}
            >
                {isMergeTarget && (
                    <div className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-accent)] bg-[color-mix(in_srgb,var(--vibe-surface-block)_78%,transparent)] text-center text-[10px] font-black uppercase tracking-wider text-[var(--vibe-accent)] backdrop-blur-sm">
                        {t('workspace.notes.combineModules')}
                    </div>
                )}
                {!hideHeader && (
                    hasModuleTabs ? (
                        <div data-notes-shell-module-tabs className={`${glass.panelHeader} flex min-h-10 select-none items-stretch gap-1 border-b border-[var(--vibe-border-subtle)] px-1.5 pt-1.5`}>
                            {renderGroup.modules.map((module) => {
                                const TabIcon = NOTES_SHELL_MODULE_ICONS[module.iconKey];
                                const isActive = module.id === activeModule.id;
                                return (
                                    <button
                                        key={module.id}
                                        type="button"
                                        data-notes-shell-module-tab={module.id}
                                        onPointerDown={(event) => onHeaderPointerDown(module.id, event)}
                                        onClick={() => onActiveModuleChange(renderGroup.id, module.id)}
                                        className={`relative flex min-w-0 max-w-[180px] shrink-0 cursor-grab items-center gap-1.5 rounded-t-[var(--vibe-radius-sm)] border border-b-0 px-2 text-left text-[10px] font-bold uppercase tracking-wider active:cursor-grabbing ${
                                            isActive
                                                ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-surface-block)] text-[var(--vibe-accent)]'
                                                : 'border-transparent text-[var(--vibe-text-faint)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                                        }`}
                                        title={t('workspace.notes.dragModule')}
                                    >
                                        {tabInsertBeforeId === module.id && (
                                            <span data-notes-shell-tab-insert className="pointer-events-none absolute -left-[3px] bottom-1 top-1 z-10 w-1 rounded-full bg-[var(--vibe-accent)] shadow-[0_0_12px_color-mix(in_srgb,var(--vibe-accent)_70%,transparent)]" />
                                        )}
                                        <TabIcon size={13} className="shrink-0" />
                                        <span className="truncate">{t(module.labelKey)}</span>
                                    </button>
                                );
                            })}
                            {tabInsertBeforeId === null && (
                                <span data-notes-shell-tab-insert className="pointer-events-none my-1 w-1 shrink-0 rounded-full bg-[var(--vibe-accent)] shadow-[0_0_12px_color-mix(in_srgb,var(--vibe-accent)_70%,transparent)]" />
                            )}
                            <div
                                data-notes-shell-group-drag-handle
                                onPointerDown={(event) => onGroupHeaderPointerDown(renderGroup.id, activeModule.id, event)}
                                className="min-w-5 flex-1 cursor-grab rounded-t-[var(--vibe-radius-sm)] transition-colors hover:bg-[var(--vibe-surface-hover)] active:cursor-grabbing"
                                title={t('workspace.notes.dragModuleGroup')}
                            />
                        </div>
                    ) : (
                        <div
                            onPointerDown={(event) => onHeaderPointerDown(activeModule.id, event)}
                            className={`${glass.panelHeader} flex min-h-10 cursor-grab select-none items-center justify-between gap-2 p-2.5 active:cursor-grabbing`}
                            title={t('workspace.notes.dragModule')}
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                <Icon size={16} className="shrink-0 text-[var(--vibe-accent)]" />
                                <div className="min-w-0">
                                    <p className="truncate text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-accent)]">
                                        {t(activeModule.labelKey)}
                                    </p>
                                    {subtitle && (
                                        <h2 className="truncate text-sm font-black text-[var(--vibe-text-primary)]">
                                            {subtitle}
                                        </h2>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                )}
                <div className="min-h-0 flex-1 overflow-hidden">
                    {children}
                </div>
            </section>
            {showDropAfter && (
                <NotesWorkspaceDropIndicator
                    layout={dropLayout}
                    className={dropLayout === 'row' ? 'my-2 self-stretch' : 'mx-2'}
                />
            )}
        </>
    );
}

function NotesWorkspaceNodeView(props: NotesWorkspaceNodeViewProps) {
    const { node } = props;
    const splitContainerRef = useRef<HTMLDivElement | null>(null);
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
        onMergeGroup,
        onMoveTab,
        onOpenEntity,
        onCreateChildBlock,
        onMoveBlockToParent,
        onNavigateBack,
        onNavigateForward,
        canNavigateBack,
        canNavigateForward,
        onCopyEntityWikiLink,
        onCopyEntityId,
        onPinEntityToCanvas,
        onCreateRootEntity,
        canCreateRootEntity,
        hasWorkspaceTabs,
        canPinToCanvas,
        onSetActiveGroup,
        onSetActiveTab,
        onSetTabView,
        onSplitTabToGroup,
        dockDropTarget,
        onDockDropTargetChange,
        t,
        visibleEntities,
    } = props;
    const isActiveGroup = node.id === activeGroupId;
    const activeTab = getActiveTab(node.tabs, node.activeTabId);
    const activeEntity = activeTab ? entitiesById.get(activeTab.entityId) : null;
    const linkedViews = activeEntity ? buildNotesWorkspaceLinkedViews(activeEntity, visibleEntities) : null;
    const embeddedEntityNodes = activeEntity ? buildNotesWorkspaceEmbeddedEntityTree(activeEntity, visibleEntities) : [];
    const childEntities = activeEntity ? childrenByParent.get(activeEntity.id) ?? [] : [];
    const canEditActiveEntity = activeEntity ? canEditEntityInWorkspace(activeEntity) : false;
    const activeParentEntity = activeEntity?.parentId ? entitiesById.get(activeEntity.parentId) ?? null : null;
    const canCloseGroup = groupOrder.size > 1;
    const visualDropZone = dockDropTarget?.groupId === node.id ? dockDropTarget.zone : null;
    const isTabInsertTarget = dockDropTarget?.groupId === node.id && dockDropTarget.beforeTabId !== undefined;
    const tabInsertBeforeId = isTabInsertTarget ? dockDropTarget.beforeTabId : undefined;
    const isCenterMergeTarget = dockDropTarget?.groupId === node.id && visualDropZone === null && !isTabInsertTarget;
    const editorDropIndicatorLayout = visualDropZone ? getShellLayoutFromDropZone(visualDropZone) : 'column';
    const editorDropIndicatorClass = visualDropZone === 'left'
        ? 'pointer-events-none absolute bottom-2 left-1 top-2 z-20'
        : visualDropZone === 'right'
            ? 'pointer-events-none absolute bottom-2 right-1 top-2 z-20'
            : visualDropZone === 'top'
                ? 'pointer-events-none absolute left-2 right-2 top-1 z-20'
                : visualDropZone === 'bottom'
                    ? 'pointer-events-none absolute bottom-1 left-2 right-2 z-20'
                    : 'pointer-events-none absolute left-3 right-3 top-2 z-20';

    const getSplitFromDropZone = (zone: NotesWorkspaceDropZone): { direction: 'row' | 'column'; placement: NotesWorkspaceSplitPlacement } => {
        if (zone === 'left') return { direction: 'row', placement: 'before' };
        if (zone === 'right') return { direction: 'row', placement: 'after' };
        if (zone === 'top') return { direction: 'column', placement: 'before' };
        return { direction: 'column', placement: 'after' };
    };

    const startGroupPointerDrag = (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0 || !canCloseGroup) return;
        if ((event.target as HTMLElement | null)?.closest('[data-no-pane-drag]')) return;

        event.preventDefault();
        event.stopPropagation();
        onSetActiveGroup(node.id);

        const sourceGroupId = node.id;
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
            if (!targetElement || !targetGroupId || targetGroupId === sourceGroupId) {
                setLatestTarget(null);
                return;
            }

            setLatestTarget({ groupId: targetGroupId, zone: null });
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
            onMergeGroup(sourceGroupId, target.groupId);
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

    const startTabPointerDrag = (event: ReactPointerEvent<HTMLElement>, tabId: string) => {
        if (event.button !== 0) return;
        if (!node.tabs.some((tab) => tab.id === tabId)) return;
        if ((event.target as HTMLElement | null)?.closest('[data-no-pane-drag]')) return;

        event.preventDefault();
        event.stopPropagation();
        onSetActiveTab(node.id, tabId);

        const sourceGroupId = node.id;
        const startX = event.clientX;
        const startY = event.clientY;
        const previousCursor = document.body.style.cursor;
        const previousUserSelect = document.body.style.userSelect;
        let isDragging = false;
        let latestTarget: NotesDockDropTarget | null = null;

        const setLatestTarget = (target: NotesDockDropTarget | null) => {
            const unchanged = latestTarget?.groupId === target?.groupId
                && latestTarget?.zone === target?.zone
                && latestTarget?.beforeTabId === target?.beforeTabId;
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

            const beforeTabId = getNotesTabInsertBeforeId(targetElement, moveEvent.clientX, moveEvent.clientY, tabId);
            if (beforeTabId !== undefined) {
                setLatestTarget({ groupId: targetGroupId, zone: null, beforeTabId });
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

            onMoveTab(sourceGroupId, tabId, target.groupId, target.beforeTabId ?? null);
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

    const viewButtonClass = (view: NotesWorkspaceView) => `flex h-8 items-center gap-1.5 rounded-[var(--vibe-radius-sm)] border px-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
        activeTab?.view === view
            ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-surface-hover)] text-[var(--vibe-text-primary)]'
            : 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)] hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
    }`;
    const quickActionButtonClass = `flex h-8 w-8 items-center justify-center rounded-[var(--vibe-radius-sm)] ${glass.iconButton}`;

    return (
        <div
            data-notes-group-id={node.id}
            className={`relative flex h-full min-h-[220px] min-w-0 flex-col overflow-hidden rounded-[var(--vibe-radius-md)] border bg-[var(--vibe-surface-block)] shadow-[var(--vibe-shadow-block)] transition-colors ${
                isActiveGroup
                    ? 'border-[var(--vibe-accent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--vibe-accent)_35%,transparent),var(--vibe-shadow-block)]'
                    : 'border-[var(--vibe-border-subtle)]'
            }`}
            onMouseDown={() => onSetActiveGroup(node.id)}
        >
            {visualDropZone && (
                <NotesWorkspaceDropIndicator
                    layout={editorDropIndicatorLayout}
                    className={editorDropIndicatorClass}
                />
            )}
            {isCenterMergeTarget && (
                <div className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-accent)] bg-[color-mix(in_srgb,var(--vibe-surface-block)_78%,transparent)] text-center text-[10px] font-black uppercase tracking-wider text-[var(--vibe-accent)] backdrop-blur-sm">
                    {t('workspace.notes.combineTabs')}
                </div>
            )}
            <div className="pointer-events-none absolute left-2 top-2 z-10 flex items-center">
                <div className="pointer-events-auto flex shrink-0 items-center gap-1" data-no-pane-drag>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onNavigateBack();
                        }}
                        disabled={!canNavigateBack}
                        className={`flex h-7 w-7 items-center justify-center rounded-[var(--vibe-radius-sm)] border transition-colors ${
                            canNavigateBack
                                ? 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)] hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                                : 'cursor-not-allowed border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)] opacity-45'
                        }`}
                        title={t('workspace.notes.navigateBack')}
                        aria-label={t('workspace.notes.navigateBack')}
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onNavigateForward();
                        }}
                        disabled={!canNavigateForward}
                        className={`flex h-7 w-7 items-center justify-center rounded-[var(--vibe-radius-sm)] border transition-colors ${
                            canNavigateForward
                                ? 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)] hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                                : 'cursor-not-allowed border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)] opacity-45'
                        }`}
                        title={t('workspace.notes.navigateForward')}
                        aria-label={t('workspace.notes.navigateForward')}
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>
            <div
                onMouseDown={(event) => {
                    onSetActiveGroup(node.id);
                    event.stopPropagation();
                }}
                className={`relative flex min-h-12 shrink-0 cursor-default items-center gap-1 border-b py-1 pl-[76px] pr-2 pt-2 transition-colors ${
                    isActiveGroup
                        ? 'border-[var(--vibe-border-strong)] bg-[color-mix(in_srgb,var(--vibe-accent)_10%,var(--vibe-surface-input))]'
                        : 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)]'
                }`}
            >
                <div data-notes-tab-strip className="flex max-w-full min-w-0 shrink gap-1 overflow-x-auto">
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
                            data-notes-tab
                            data-notes-tab-id={tab.id}
                            onPointerDown={(event) => {
                                startTabPointerDrag(event, tab.id);
                            }}
                            className={`group relative flex h-8 max-w-[260px] shrink-0 select-none items-center gap-2 rounded-[var(--vibe-radius-sm)] border px-2 text-left text-xs transition-colors ${
                                isActiveTab
                                    ? 'border-[var(--vibe-accent)] bg-[color-mix(in_srgb,var(--vibe-accent)_16%,var(--vibe-surface-hover))] text-[var(--vibe-text-primary)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--vibe-accent)_20%,transparent)]'
                                    : 'border-transparent text-[var(--vibe-text-muted)] hover:border-[var(--vibe-border-subtle)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                            }`}
                            title={entity?.name ?? tab.entityId}
                        >
                            {tabInsertBeforeId === tab.id && (
                                <span className="pointer-events-none absolute -left-[3px] bottom-1 top-1 z-20 w-1 rounded-full bg-[var(--vibe-accent)] shadow-[0_0_14px_color-mix(in_srgb,var(--vibe-accent)_70%,transparent)]" />
                            )}
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
                                data-no-pane-drag
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
                    {tabInsertBeforeId === null && (
                        <span className="pointer-events-none my-1 w-1 shrink-0 rounded-full bg-[var(--vibe-accent)] shadow-[0_0_14px_color-mix(in_srgb,var(--vibe-accent)_70%,transparent)]" />
                    )}
                </div>
                <div
                    data-notes-group-drag-handle
                    onPointerDown={canCloseGroup ? startGroupPointerDrag : undefined}
                    className={`min-w-6 self-stretch rounded-[var(--vibe-radius-sm)] transition-colors ${
                        canCloseGroup
                            ? 'flex-1 cursor-grab hover:bg-[var(--vibe-surface-hover)] active:cursor-grabbing'
                            : 'flex-1 cursor-default'
                    }`}
                    title={canCloseGroup
                        ? `${isActiveGroup ? t('workspace.notes.activeTabBlock') : t('workspace.notes.inactiveTabBlock')}. ${t('workspace.notes.mergeTabBlockHint')}`
                        : undefined}
                />
                <div className="flex shrink-0 items-center gap-1">
                    {activeEntity && !canEditActiveEntity && (
                        <span className="flex shrink-0 items-center gap-1 px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-warning)]">
                            <Lock size={11} />
                            {t('workspace.notes.readOnly')}
                        </span>
                    )}
                    {canCloseGroup && (
                        <button
                            type="button"
                            data-no-pane-drag
                            onClick={(event) => {
                                event.stopPropagation();
                                onCloseGroup(node.id);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-[var(--vibe-radius-sm)] text-[var(--vibe-text-faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-danger)_16%,transparent)] hover:text-[var(--vibe-danger)]"
                            title={t('workspace.notes.closePane')}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {!activeTab || !activeEntity ? (
                <div className="flex min-h-0 flex-1 items-center justify-center p-6">
                    <div className="flex min-w-[240px] flex-col items-center gap-3 rounded-[var(--vibe-radius-md)] border border-dashed border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-6 py-5 text-center text-sm text-[var(--vibe-text-faint)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <FileText size={20} className="text-[var(--vibe-accent)] opacity-75" />
                        <span>{activeTab ? t('workspace.notes.missingEntity') : t('workspace.notes.emptyGroupHint')}</span>
                        {!hasWorkspaceTabs && (
                            <div className="mt-1 w-full min-w-[300px] max-w-[460px]">
                                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                                    {canCreateRootEntity
                                        ? t('workspace.notes.createRootEntity')
                                        : t('workspace.notes.createRootEntityUnavailable')}
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                                    {ROOT_CREATE_TYPES.map((type) => {
                                        const Icon = ENTITY_TYPE_ICONS[type] ?? FileText;
                                        return (
                                            <button
                                                key={type}
                                                type="button"
                                                disabled={!canCreateRootEntity}
                                                onClick={() => onCreateRootEntity(type)}
                                                className={`flex h-8 items-center gap-1.5 rounded-[var(--vibe-radius-sm)] border px-2 text-left text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                                    canCreateRootEntity
                                                        ? 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] text-[var(--vibe-text-muted)] hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                                                        : 'cursor-not-allowed border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] text-[var(--vibe-text-faint)] opacity-45'
                                                }`}
                                            >
                                                <Icon size={12} className="shrink-0 text-[var(--vibe-accent)]" />
                                                <span className="min-w-0 truncate">{t(`workspace.notes.entityTypes.${type}`)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
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
                            <NoteEditorPanel
                                entity={activeEntity}
                                embeddedNodes={embeddedEntityNodes}
                                canEdit={canEditActiveEntity}
                                view={activeTab.view}
                                onOpenEntity={onOpenEntity}
                                onCreateChildBlock={onCreateChildBlock}
                                onMoveBlockToParent={onMoveBlockToParent}
                                onCopyEntityWikiLink={onCopyEntityWikiLink}
                                onPinEntityToCanvas={onPinEntityToCanvas}
                                canPinToCanvas={canPinToCanvas}
                                t={t}
                            />
                        )}
                        {activeTab.view === 'ui' && (
                            <EntityUiPreviewPanel
                                entity={activeEntity}
                                embeddedNodes={embeddedEntityNodes}
                                canEdit={canEditActiveEntity}
                                onOpenEntity={onOpenEntity}
                                onCreateChildBlock={onCreateChildBlock}
                                onMoveBlockToParent={onMoveBlockToParent}
                                onCopyEntityWikiLink={onCopyEntityWikiLink}
                                onPinEntityToCanvas={onPinEntityToCanvas}
                                canPinToCanvas={canPinToCanvas}
                                t={t}
                            />
                        )}
                        {activeTab.view === 'entity' && (
                            <EntityDataPanel entity={activeEntity} children={childEntities} linkedViews={linkedViews} entitiesById={entitiesById} onOpenEntity={onOpenEntity} t={t} />
                        )}
                        {activeTab.view === 'outline' && (
                            <div className="h-full overflow-y-auto p-4">
                                <LinkedViewsPanel
                                    linkedViews={linkedViews}
                                    entitiesById={entitiesById}
                                    onOpenEntity={onOpenEntity}
                                    sections={getNotesWorkspaceLinkedViewSections(activeTab.view)}
                                    t={t}
                                />
                            </div>
                        )}
                        {activeTab.view === 'backlinks' && (
                            <div className="h-full overflow-y-auto p-4">
                                <LinkedViewsPanel
                                    linkedViews={linkedViews}
                                    entitiesById={entitiesById}
                                    onOpenEntity={onOpenEntity}
                                    sections={getNotesWorkspaceLinkedViewSections(activeTab.view)}
                                    t={t}
                                />
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
    const [shellModuleDropTarget, setShellModuleDropTarget] = useState<NotesShellModuleDropTarget | null>(null);
    const [draggingShellModuleId, setDraggingShellModuleId] = useState<NotesWorkspaceShellModuleId | null>(null);
    const entities = useEntities();
    const activeCanvasId = useCanvasStore((state) => state.activeCanvasId);
    const stageScale = useCanvasStore((state) => state.scale);
    const stageOffset = useCanvasStore((state) => state.offset);
    const notesLayout = useNotesWorkspaceStore((state) => state.layout);
    const notesShell = useNotesWorkspaceStore((state) => state.shell);
    const openWorkspaceLeaf = useNotesWorkspaceStore((state) => state.openTabInNewLeaf);
    const closeWorkspaceTab = useNotesWorkspaceStore((state) => state.closeTab);
    const closeWorkspaceGroup = useNotesWorkspaceStore((state) => state.closeGroup);
    const mergeWorkspaceGroup = useNotesWorkspaceStore((state) => state.mergeGroup);
    const moveWorkspaceTab = useNotesWorkspaceStore((state) => state.moveTab);
    const splitWorkspaceTabToGroup = useNotesWorkspaceStore((state) => state.splitTabToGroup);
    const resizeWorkspaceSplit = useNotesWorkspaceStore((state) => state.resizeSplit);
    const setActiveWorkspaceGroup = useNotesWorkspaceStore((state) => state.setActiveGroup);
    const setActiveWorkspaceTab = useNotesWorkspaceStore((state) => state.setActiveTab);
    const setWorkspaceTabView = useNotesWorkspaceStore((state) => state.setTabView);
    const navigateNotesBack = useNotesWorkspaceStore((state) => state.navigateBack);
    const navigateNotesForward = useNotesWorkspaceStore((state) => state.navigateForward);
    const notesNavigationHistory = useNotesWorkspaceStore((state) => state.navigationHistory);
    const toggleShellModule = useNotesWorkspaceStore((state) => state.toggleShellModule);
    const moveShellModule = useNotesWorkspaceStore((state) => state.moveShellModule);
    const moveShellModuleGroup = useNotesWorkspaceStore((state) => state.moveShellModuleGroup);
    const mergeShellModules = useNotesWorkspaceStore((state) => state.mergeShellModules);
    const moveShellModuleTab = useNotesWorkspaceStore((state) => state.moveShellModuleTab);
    const mergeShellModuleGroup = useNotesWorkspaceStore((state) => state.mergeShellModuleGroup);
    const setActiveShellModuleTab = useNotesWorkspaceStore((state) => state.setActiveShellModuleTab);
    const setShellModuleWidth = useNotesWorkspaceStore((state) => state.setShellModuleWidth);
    const setShellAudioHeight = useNotesWorkspaceStore((state) => state.setShellAudioHeight);
    const resetWorkspaceLayout = useNotesWorkspaceStore((state) => state.resetLayout);
    const [audioModuleEnabled] = useAppModuleEnabled('audio');
    const shellRibbonModules = useMemo(
        () => listImplementedNotesShellModules()
            .filter((module) => module.canToggle)
            .filter((module) => module.id !== 'audio' || audioModuleEnabled),
        [audioModuleEnabled]
    );
    const visibleLeftModules = useMemo(
        () => listVisibleNotesShellModules(notesShell.modules, 'left', notesShell.moduleAreas, notesShell.moduleOrder),
        [notesShell.moduleAreas, notesShell.moduleOrder, notesShell.modules]
    );
    const visibleRightModules = useMemo(
        () => listVisibleNotesShellModules(notesShell.modules, 'right', notesShell.moduleAreas, notesShell.moduleOrder),
        [notesShell.moduleAreas, notesShell.moduleOrder, notesShell.modules]
    );
    const visibleCenterModules = useMemo(
        () => listVisibleNotesShellModules(notesShell.modules, 'center', notesShell.moduleAreas, notesShell.moduleOrder),
        [notesShell.moduleAreas, notesShell.moduleOrder, notesShell.modules]
    );
    const visibleBottomModules = useMemo(
        () => audioModuleEnabled ? listVisibleNotesShellModules(notesShell.modules, 'bottom', notesShell.moduleAreas, notesShell.moduleOrder) : [],
        [audioModuleEnabled, notesShell.moduleAreas, notesShell.moduleOrder, notesShell.modules]
    );
    const visibleLeftModuleGroups = useMemo(
        () => groupVisibleNotesShellModules(visibleLeftModules, notesShell.tabGroups),
        [notesShell.tabGroups, visibleLeftModules]
    );
    const visibleCenterModuleGroups = useMemo(
        () => groupVisibleNotesShellModules(visibleCenterModules, notesShell.tabGroups),
        [notesShell.tabGroups, visibleCenterModules]
    );
    const visibleRightModuleGroups = useMemo(
        () => groupVisibleNotesShellModules(visibleRightModules, notesShell.tabGroups),
        [notesShell.tabGroups, visibleRightModules]
    );
    const visibleBottomModuleGroups = useMemo(
        () => groupVisibleNotesShellModules(visibleBottomModules, notesShell.tabGroups),
        [notesShell.tabGroups, visibleBottomModules]
    );
    const isLeftModuleVisible = visibleLeftModules.length > 0;
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
    const canCreateRootEntity = yjsStore.canModify('general');

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
        openWorkspaceLeaf(entityId, view);
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

    const handleCreateRootEntity = useCallback((type: EntityType) => {
        if (!yjsStore.canModify('general')) return;
        const id = generateEntityId(entities.map((entity) => entity.id));
        const draft = createRootEntityDraft(type, id);
        if (!yjsStore.addEntity(draft)) return;
        openWorkspaceLeaf(id, 'source');
        expandEntityAncestors(id);
    }, [entities, expandEntityAncestors, openWorkspaceLeaf]);

    const handleCreateChildBlock = useCallback((parentEntityId: string) => {
        const parent = entitiesById.get(parentEntityId);
        if (!parent || !canEditEntityInWorkspace(parent)) return;

        const id = generateEntityId(entities.map((entity) => entity.id));
        const draft: Entity = {
            ...createRootEntityDraft('note', id),
            parentId: parent.id,
            database: parent.database ?? 'general',
            name: t('workspace.notes.newNestedBlockName'),
            description: t('workspace.notes.newNestedBlockDescription', { parent: parent.name }),
        };

        if (!yjsStore.addEntity(draft)) return;
        expandEntityAncestors(id);
        openWorkspaceLeaf(id, 'source');
    }, [entities, entitiesById, expandEntityAncestors, openWorkspaceLeaf, t]);

    const handleMoveBlockToParent = useCallback((sourceEntityId: string, targetParentId: string) => {
        const source = entitiesById.get(sourceEntityId);
        const target = entitiesById.get(targetParentId);
        if (!source || !target || !canEditEntityInWorkspace(source) || !canEditEntityInWorkspace(target)) return;
        if (!canMoveNotesWorkspaceEmbeddedEntity(entities, sourceEntityId, targetParentId)) return;

        const targetDb = target.database ?? source.database ?? 'general';
        if (!moveEntityTreeToParent(sourceEntityId, targetParentId, targetDb)) return;

        const movedEntity = yjsStore.entitiesMap.get(sourceEntityId);
        if (movedEntity) {
            void saveEntity(targetDb, movedEntity).catch((error) => {
                console.warn(`Failed to persist nested note block move for ${sourceEntityId}:`, error);
            });
        }

        expandEntityAncestors(sourceEntityId);
        openWorkspaceLeaf(sourceEntityId, 'preview');
    }, [entities, entitiesById, expandEntityAncestors, openWorkspaceLeaf]);

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

    const handleShellModuleDragStart = (
        moduleId: NotesWorkspaceShellModuleId,
        event: ReactPointerEvent<HTMLElement>,
        sourceGroupId?: string
    ) => {
        if (event.button !== 0) return;
        if ((event.target as HTMLElement | null)?.closest('[data-no-shell-module-drag]')) return;

        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        const startY = event.clientY;
        const previousCursor = document.body.style.cursor;
        const previousUserSelect = document.body.style.userSelect;
        let isDragging = false;
        let latestTarget: NotesShellModuleDropTarget | null = null;

        const setLatestTarget = (target: NotesShellModuleDropTarget | null) => {
            const unchanged = latestTarget?.area === target?.area
                && latestTarget?.beforeModuleId === target?.beforeModuleId
                && latestTarget?.targetModuleId === target?.targetModuleId
                && latestTarget?.placement === target?.placement
                && latestTarget?.layout === target?.layout
                && latestTarget?.targetTabGroupId === target?.targetTabGroupId
                && latestTarget?.beforeTabId === target?.beforeTabId;
            if (unchanged) return;
            latestTarget = target;
            setShellModuleDropTarget(target);
        };

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
            if (!isDragging && distance < 6) return;

            if (!isDragging) {
                isDragging = true;
                setDraggingShellModuleId(moduleId);
                document.body.style.cursor = 'grabbing';
                document.body.style.userSelect = 'none';
            }

            moveEvent.preventDefault();
            const tabTarget = sourceGroupId
                ? null
                : getShellTabDropTarget(moveEvent.clientX, moveEvent.clientY, moduleId, notesShell.moduleLayouts);
            setLatestTarget(tabTarget ?? getShellModuleDropTarget(moveEvent.clientX, moveEvent.clientY, moduleId, notesShell.moduleLayouts));
        };

        const finishDrag = (upEvent: PointerEvent) => {
            document.body.style.cursor = previousCursor;
            document.body.style.userSelect = previousUserSelect;
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', finishDrag);
            window.removeEventListener('pointercancel', cancelDrag);

            const target = latestTarget;
            setLatestTarget(null);
            setDraggingShellModuleId(null);
            if (!isDragging || !target) return;

            upEvent.preventDefault();
            if (target.targetTabGroupId) {
                moveShellModuleTab(moduleId, target.targetTabGroupId, target.beforeTabId ?? null);
                return;
            }
            if (sourceGroupId) {
                if (target.targetModuleId) {
                    mergeShellModuleGroup(sourceGroupId, target.targetModuleId);
                    return;
                }
                moveShellModuleGroup(sourceGroupId, target.area, target.beforeModuleId, target.layout);
                return;
            }
            if (target.targetModuleId) {
                mergeShellModules(moduleId, target.targetModuleId);
                return;
            }
            moveShellModule(moduleId, target.area, target.beforeModuleId, target.layout);
        };

        const cancelDrag = () => {
            document.body.style.cursor = previousCursor;
            document.body.style.userSelect = previousUserSelect;
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', finishDrag);
            window.removeEventListener('pointercancel', cancelDrag);
            setLatestTarget(null);
            setDraggingShellModuleId(null);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', finishDrag, { once: true });
        window.addEventListener('pointercancel', cancelDrag, { once: true });
    };

    const renderVaultModuleBody = () => (
        <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-[var(--vibe-border-subtle)] p-2.5">
                <div className="flex min-w-0 items-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--vibe-success)] shadow-[0_0_8px_var(--vibe-success)]" />
                    <span className="truncate">{t('hud.room')} {roomName}</span>
                </div>
                <label className="mt-3 block" data-no-shell-module-drag>
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
                <div className="mt-3 flex flex-wrap gap-1.5">
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
                <label className="flex h-8 items-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2.5 text-xs text-[var(--vibe-text-muted)] focus-within:border-[var(--vibe-border-strong)]" data-no-shell-module-drag>
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
                                        data-no-shell-module-drag
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
        </div>
    );

    const renderSearchModuleBody = () => (
        <div className="flex h-full min-h-0 flex-col p-3">
            <label className="mb-3 flex h-8 items-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2.5 text-xs text-[var(--vibe-text-muted)] focus-within:border-[var(--vibe-border-strong)]" data-no-shell-module-drag>
                <Search size={14} className="shrink-0 text-[var(--vibe-text-faint)]" />
                <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[var(--vibe-text-primary)] outline-none placeholder:text-[var(--vibe-text-faint)]"
                    placeholder={t('workspace.notes.searchPlaceholder')}
                />
            </label>
            <div className="min-h-0 flex-1 overflow-y-auto">
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
        </div>
    );

    const renderGraphModuleBody = () => (
        <div className="h-full min-h-0 overflow-y-auto p-3">
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
    );

    const renderContextModuleBody = () => (
        <div className="h-full min-h-0 overflow-y-auto p-3">
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
    );

    const renderNotificationsModuleBody = () => (
        <div className="h-full min-h-0 overflow-y-auto p-3">
            <NotificationCenter surface="embedded" />
        </div>
    );

    const renderAudioModuleBody = () => (
        <div id={NOTES_AUDIO_DOCK_HOST_ID} className="h-full min-h-[180px] overflow-hidden" />
    );

    const renderEditorModuleBody = () => (
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
            onMergeGroup={mergeWorkspaceGroup}
            onSplitTabToGroup={splitWorkspaceTabToGroup}
            onResizeSplit={resizeWorkspaceSplit}
            onMoveTab={moveWorkspaceTab}
            onOpenEntity={handleOpenEntity}
            onCreateChildBlock={handleCreateChildBlock}
            onMoveBlockToParent={handleMoveBlockToParent}
            onNavigateBack={navigateNotesBack}
            onNavigateForward={navigateNotesForward}
            canNavigateBack={notesNavigationHistory.backStack.length > 0}
            canNavigateForward={notesNavigationHistory.forwardStack.length > 0}
            onCopyEntityWikiLink={handleCopyEntityWikiLink}
            onCopyEntityId={handleCopyEntityId}
            onPinEntityToCanvas={handlePinEntityToCanvas}
            onCreateRootEntity={handleCreateRootEntity}
            canCreateRootEntity={canCreateRootEntity}
            hasWorkspaceTabs={hasWorkspaceTabs}
            canPinToCanvas={canPinToActiveCanvas}
            dockDropTarget={dockDropTarget}
            onDockDropTargetChange={setDockDropTarget}
            t={t}
        />
    );

    const renderShellModuleBody = (moduleId: NotesWorkspaceShellModuleId): ReactNode => {
        if (moduleId === 'editor') return renderEditorModuleBody();
        if (moduleId === 'vault') return renderVaultModuleBody();
        if (moduleId === 'search') return renderSearchModuleBody();
        if (moduleId === 'graph') return renderGraphModuleBody();
        if (moduleId === 'context') return renderContextModuleBody();
        if (moduleId === 'notifications') return renderNotificationsModuleBody();
        return renderAudioModuleBody();
    };

    const getShellModuleSubtitle = (module: NotesWorkspaceShellModuleDefinition): string => {
        if (module.id === 'editor') return activeEntity?.name ?? t('workspace.notes.noActiveEntity');
        if (module.id === 'vault') return t('workspace.notes.title');
        if (module.id === 'search') {
            return searchQuery.trim()
                ? t('workspace.notes.searchSummary', { count: filteredEntities.length })
                : t('workspace.notes.searchPlaceholder');
        }
        if (module.id === 'graph' || module.id === 'context') return activeEntity?.name ?? t('workspace.notes.noActiveEntity');
        return t(module.labelKey);
    };

    const renderShellModule = (
        renderGroup: NotesWorkspaceShellModuleRenderGroup,
        area: NotesShellInteractiveArea,
        isLast: boolean,
        areaLayout: NotesWorkspaceShellAreaLayout
    ) => {
        const activeModule = renderGroup.modules.find((module) => module.id === renderGroup.activeModuleId)
            ?? renderGroup.modules[0];
        const moduleIds = renderGroup.modules.map((module) => module.id);
        return (
            <NotesShellModuleFrame
                key={renderGroup.id}
                renderGroup={renderGroup}
                subtitle={getShellModuleSubtitle(activeModule)}
                isDragging={Boolean(draggingShellModuleId && moduleIds.includes(draggingShellModuleId))}
                isMergeTarget={Boolean(shellModuleDropTarget?.targetModuleId && moduleIds.includes(shellModuleDropTarget.targetModuleId))}
                showDropBefore={shellModuleDropTarget?.area === area && Boolean(shellModuleDropTarget.beforeModuleId && moduleIds.includes(shellModuleDropTarget.beforeModuleId))}
                showDropAfter={isLast && shellModuleDropTarget?.area === area && shellModuleDropTarget.beforeModuleId === null && !shellModuleDropTarget.targetModuleId && !shellModuleDropTarget.targetTabGroupId}
                dropLayout={areaLayout}
                tabInsertBeforeId={shellModuleDropTarget?.targetTabGroupId === renderGroup.id ? shellModuleDropTarget.beforeTabId : undefined}
                hideHeader={renderGroup.modules.length === 1 && activeModule.id === 'editor'}
                onHeaderPointerDown={handleShellModuleDragStart}
                onGroupHeaderPointerDown={(groupId, activeModuleId, event) => handleShellModuleDragStart(activeModuleId, event, groupId)}
                onActiveModuleChange={setActiveShellModuleTab}
                t={t}
            >
                {renderShellModuleBody(activeModule.id)}
            </NotesShellModuleFrame>
        );
    };

    const renderShellDockArea = (
        area: NotesShellInteractiveArea,
        moduleGroups: NotesWorkspaceShellModuleRenderGroup[],
        className = ''
    ) => {
        const isActiveDropArea = shellModuleDropTarget?.area === area;
        const areaLayout = isActiveDropArea
            ? shellModuleDropTarget.layout
            : notesShell.moduleLayouts[area] ?? 'column';
        const isSideArea = area !== 'center';

        return (
            <aside
                data-notes-shell-area={area}
                className={`flex min-h-0 min-w-0 gap-2 overflow-hidden ${
                    areaLayout === 'row' ? 'flex-row' : 'flex-col'
                } ${className}`}
            >
                {moduleGroups.length > 0 ? moduleGroups.map((renderGroup, index) => renderShellModule(renderGroup, area, index === moduleGroups.length - 1, areaLayout)) : (
                    <div className={`flex min-h-[180px] flex-1 items-center justify-center rounded-[var(--vibe-radius-md)] border border-dashed p-2 text-center text-xs transition-colors ${
                        isActiveDropArea
                            ? 'border-[var(--vibe-accent)] bg-[color-mix(in_srgb,var(--vibe-accent)_12%,transparent)] text-[var(--vibe-text-primary)]'
                            : 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)] opacity-45'
                    }`}>
                        {isActiveDropArea ? (isSideArea ? '+' : t('workspace.notes.dropModuleHere')) : ''}
                    </div>
                )}
            </aside>
        );
    };

    const shellGridStyle = {
        '--notes-vault-width': `${isLeftModuleVisible ? notesShell.vaultWidth : NOTES_SHELL_EMPTY_SIDE_WIDTH}px`,
        '--notes-vault-separator-width': `${NOTES_SHELL_SEPARATOR_WIDTH}px`,
        '--notes-context-width': `${isRightModuleVisible ? notesShell.contextWidth : NOTES_SHELL_EMPTY_SIDE_WIDTH}px`,
        '--notes-context-separator-width': `${NOTES_SHELL_SEPARATOR_WIDTH}px`,
    } as CSSProperties;

    return (
        <div className={`absolute inset-0 overflow-hidden ${glass.bg}`}>
            <main
                style={shellGridStyle}
                className="relative z-[1] grid h-full min-h-0 grid-cols-[48px_var(--notes-vault-width)_var(--notes-vault-separator-width)_minmax(0,1fr)_var(--notes-context-separator-width)_var(--notes-context-width)] gap-0 p-2"
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

                {renderShellDockArea('left', visibleLeftModuleGroups, 'ml-2')}


                <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-disabled={!isLeftModuleVisible}
                    onPointerDown={isLeftModuleVisible ? (event) => handleShellResizeStart('vault', event) : undefined}
                    className={`group flex items-center justify-center ${isLeftModuleVisible ? 'cursor-col-resize' : 'cursor-default'}`}
                    title={isLeftModuleVisible ? t('workspace.notes.resizeModule') : undefined}
                >
                    <div className={`h-14 w-px rounded-full bg-[var(--vibe-border-subtle)] transition-colors ${
                        isLeftModuleVisible ? 'group-hover:bg-[var(--vibe-accent)]' : 'opacity-40'
                    }`} />
                </div>

                <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
                    <div className="min-h-0 flex-1">
                        {renderShellDockArea('center', visibleCenterModuleGroups, 'h-full min-w-0')}
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
                        <div className="min-h-0 flex-shrink-0 overflow-hidden" style={{ height: `${notesShell.audioHeight}px` }}>
                            {visibleBottomModuleGroups.map((renderGroup) => {
                                const activeModule = renderGroup.modules.find((module) => module.id === renderGroup.activeModuleId)
                                    ?? renderGroup.modules[0];
                                return (
                                    <NotesShellModuleFrame
                                        key={renderGroup.id}
                                        renderGroup={renderGroup}
                                        subtitle={getShellModuleSubtitle(activeModule)}
                                        isDragging={Boolean(draggingShellModuleId && renderGroup.modules.some((module) => module.id === draggingShellModuleId))}
                                        isMergeTarget={false}
                                        showDropBefore={false}
                                        showDropAfter={false}
                                        dropLayout="column"
                                        onHeaderPointerDown={handleShellModuleDragStart}
                                        onGroupHeaderPointerDown={(groupId, activeModuleId, event) => handleShellModuleDragStart(activeModuleId, event, groupId)}
                                        onActiveModuleChange={setActiveShellModuleTab}
                                        t={t}
                                    >
                                        {renderShellModuleBody(activeModule.id)}
                                    </NotesShellModuleFrame>
                                );
                            })}
                        </div>
                    )}
                </section>

                <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-disabled={!isRightModuleVisible}
                    onPointerDown={isRightModuleVisible ? (event) => handleShellResizeStart('context', event) : undefined}
                    className={`group flex items-center justify-center ${isRightModuleVisible ? 'cursor-col-resize' : 'cursor-default'}`}
                    title={isRightModuleVisible ? t('workspace.notes.resizeModule') : undefined}
                >
                    <div className={`h-14 w-px rounded-full bg-[var(--vibe-border-subtle)] transition-colors ${
                        isRightModuleVisible ? 'group-hover:bg-[var(--vibe-accent)]' : 'opacity-40'
                    }`} />
                </div>

                {renderShellDockArea('right', visibleRightModuleGroups)}

            </main>
        </div>
    );
}
