export const IMPLEMENTED_NOTES_SHELL_MODULE_IDS = ['vault', 'context', 'notifications', 'search', 'graph', 'audio'] as const;

export type NotesWorkspaceShellModuleId = typeof IMPLEMENTED_NOTES_SHELL_MODULE_IDS[number];
export type NotesWorkspaceModuleId = NotesWorkspaceShellModuleId | 'audio';
export type NotesWorkspaceDockArea = 'left' | 'right' | 'bottom';
export type NotesWorkspaceModuleStatus = 'implemented' | 'planned';

export interface NotesWorkspaceModuleDefinition {
    id: NotesWorkspaceModuleId;
    labelKey: string;
    iconKey: 'vault' | 'context' | 'notifications' | 'search' | 'graph' | 'audio';
    defaultArea: NotesWorkspaceDockArea;
    defaultVisible: boolean;
    canToggle: boolean;
    canResize: boolean;
    order: number;
    status: NotesWorkspaceModuleStatus;
}

export type NotesWorkspaceShellModuleDefinition = NotesWorkspaceModuleDefinition & {
    id: NotesWorkspaceShellModuleId;
    status: 'implemented';
};

export type NotesWorkspaceShellVisibility = Record<NotesWorkspaceShellModuleId, boolean>;

export const NOTES_WORKSPACE_MODULES: NotesWorkspaceModuleDefinition[] = [
    {
        id: 'vault',
        labelKey: 'workspace.notes.modules.vault',
        iconKey: 'vault',
        defaultArea: 'left',
        defaultVisible: true,
        canToggle: true,
        canResize: true,
        order: 10,
        status: 'implemented',
    },
    {
        id: 'context',
        labelKey: 'workspace.notes.modules.context',
        iconKey: 'context',
        defaultArea: 'right',
        defaultVisible: true,
        canToggle: true,
        canResize: true,
        order: 20,
        status: 'implemented',
    },
    {
        id: 'notifications',
        labelKey: 'workspace.notes.modules.notifications',
        iconKey: 'notifications',
        defaultArea: 'right',
        defaultVisible: true,
        canToggle: true,
        canResize: false,
        order: 30,
        status: 'implemented',
    },
    {
        id: 'search',
        labelKey: 'workspace.notes.modules.search',
        iconKey: 'search',
        defaultArea: 'right',
        defaultVisible: false,
        canToggle: true,
        canResize: false,
        order: 40,
        status: 'implemented',
    },
    {
        id: 'graph',
        labelKey: 'workspace.notes.modules.graph',
        iconKey: 'graph',
        defaultArea: 'right',
        defaultVisible: false,
        canToggle: true,
        canResize: false,
        order: 50,
        status: 'implemented',
    },
    {
        id: 'audio',
        labelKey: 'workspace.notes.modules.audio',
        iconKey: 'audio',
        defaultArea: 'bottom',
        defaultVisible: false,
        canToggle: true,
        canResize: true,
        order: 60,
        status: 'implemented',
    },
];

export function isImplementedNotesShellModuleId(id: NotesWorkspaceModuleId): id is NotesWorkspaceShellModuleId {
    return IMPLEMENTED_NOTES_SHELL_MODULE_IDS.includes(id as NotesWorkspaceShellModuleId);
}

function isImplementedNotesShellModule(
    module: NotesWorkspaceModuleDefinition
): module is NotesWorkspaceShellModuleDefinition {
    return module.status === 'implemented' && isImplementedNotesShellModuleId(module.id);
}

export function listImplementedNotesShellModules(area?: NotesWorkspaceDockArea): NotesWorkspaceShellModuleDefinition[] {
    return NOTES_WORKSPACE_MODULES
        .filter((module): module is NotesWorkspaceShellModuleDefinition => isImplementedNotesShellModule(module) && (!area || module.defaultArea === area))
        .sort((left, right) => left.order - right.order);
}

export function listVisibleNotesShellModules(
    modules: NotesWorkspaceShellVisibility,
    area?: NotesWorkspaceDockArea
): NotesWorkspaceShellModuleDefinition[] {
    return listImplementedNotesShellModules(area)
        .filter((module) => modules[module.id]);
}

export function hasVisibleNotesShellModule(
    modules: NotesWorkspaceShellVisibility,
    area: NotesWorkspaceDockArea
): boolean {
    return listVisibleNotesShellModules(modules, area).length > 0;
}
