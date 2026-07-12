export const IMPLEMENTED_NOTES_SHELL_MODULE_IDS = ['editor', 'vault', 'context', 'notifications', 'search', 'graph', 'audio'] as const;

export type NotesWorkspaceShellModuleId = typeof IMPLEMENTED_NOTES_SHELL_MODULE_IDS[number];
export type NotesWorkspaceModuleId = NotesWorkspaceShellModuleId | 'audio';
export type NotesWorkspaceDockArea = 'left' | 'center' | 'right' | 'bottom';
export type NotesWorkspaceModuleStatus = 'implemented' | 'planned';

export interface NotesWorkspaceModuleDefinition {
    id: NotesWorkspaceModuleId;
    labelKey: string;
    iconKey: 'editor' | 'vault' | 'context' | 'notifications' | 'search' | 'graph' | 'audio';
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
export type NotesWorkspaceShellModuleAreas = Record<NotesWorkspaceShellModuleId, NotesWorkspaceDockArea>;
export type NotesWorkspaceShellModuleOrder = Record<NotesWorkspaceShellModuleId, number>;
export type NotesWorkspaceShellLayoutArea = Extract<NotesWorkspaceDockArea, 'left' | 'center' | 'right'>;
export type NotesWorkspaceShellAreaLayout = 'column' | 'row';
export type NotesWorkspaceShellAreaLayouts = Record<NotesWorkspaceShellLayoutArea, NotesWorkspaceShellAreaLayout>;

export interface NotesWorkspaceShellTabGroup {
    id: string;
    moduleIds: NotesWorkspaceShellModuleId[];
    activeModuleId: NotesWorkspaceShellModuleId;
}

export interface NotesWorkspaceShellModuleRenderGroup {
    id: string;
    modules: NotesWorkspaceShellModuleDefinition[];
    activeModuleId: NotesWorkspaceShellModuleId;
}

const NOTES_WORKSPACE_SHELL_LAYOUT_AREAS: NotesWorkspaceShellLayoutArea[] = ['left', 'center', 'right'];

export const NOTES_WORKSPACE_MODULES: NotesWorkspaceModuleDefinition[] = [
    {
        id: 'editor',
        labelKey: 'workspace.notes.modules.editor',
        iconKey: 'editor',
        defaultArea: 'center',
        defaultVisible: true,
        canToggle: false,
        canResize: true,
        order: 10,
        status: 'implemented',
    },
    {
        id: 'vault',
        labelKey: 'workspace.notes.modules.vault',
        iconKey: 'vault',
        defaultArea: 'left',
        defaultVisible: true,
        canToggle: true,
        canResize: true,
        order: 20,
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
        order: 30,
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
        order: 40,
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
        order: 50,
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
        order: 60,
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
        order: 70,
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
    area?: NotesWorkspaceDockArea,
    moduleAreas?: NotesWorkspaceShellModuleAreas,
    moduleOrder?: NotesWorkspaceShellModuleOrder
): NotesWorkspaceShellModuleDefinition[] {
    return listImplementedNotesShellModules()
        .filter((module) => modules[module.id])
        .filter((module) => !area || getNotesShellModuleArea(module.id, moduleAreas) === area)
        .sort((left, right) => getNotesShellModuleOrder(left.id, moduleOrder) - getNotesShellModuleOrder(right.id, moduleOrder));
}

export function hasVisibleNotesShellModule(
    modules: NotesWorkspaceShellVisibility,
    area: NotesWorkspaceDockArea,
    moduleAreas?: NotesWorkspaceShellModuleAreas,
    moduleOrder?: NotesWorkspaceShellModuleOrder
): boolean {
    return listVisibleNotesShellModules(modules, area, moduleAreas, moduleOrder).length > 0;
}

export function groupVisibleNotesShellModules(
    modules: NotesWorkspaceShellModuleDefinition[],
    tabGroups: NotesWorkspaceShellTabGroup[]
): NotesWorkspaceShellModuleRenderGroup[] {
    const definitionsById = new Map(modules.map((module) => [module.id, module]));
    const consumed = new Set<NotesWorkspaceShellModuleId>();
    const renderGroups: NotesWorkspaceShellModuleRenderGroup[] = [];

    for (const module of modules) {
        if (consumed.has(module.id)) continue;
        const tabGroup = tabGroups.find((group) => group.moduleIds.includes(module.id));
        if (!tabGroup) {
            consumed.add(module.id);
            renderGroups.push({ id: module.id, modules: [module], activeModuleId: module.id });
            continue;
        }

        const visibleGroupModules = tabGroup.moduleIds
            .map((moduleId) => definitionsById.get(moduleId))
            .filter((candidate): candidate is NotesWorkspaceShellModuleDefinition => Boolean(candidate));
        visibleGroupModules.forEach((candidate) => consumed.add(candidate.id));
        if (visibleGroupModules.length === 0) continue;
        renderGroups.push({
            id: tabGroup.id,
            modules: visibleGroupModules,
            activeModuleId: visibleGroupModules.some((candidate) => candidate.id === tabGroup.activeModuleId)
                ? tabGroup.activeModuleId
                : visibleGroupModules[0].id,
        });
    }

    return renderGroups;
}

export function getDefaultNotesShellModuleAreas(): NotesWorkspaceShellModuleAreas {
    return Object.fromEntries(
        listImplementedNotesShellModules().map((module) => [module.id, module.defaultArea])
    ) as NotesWorkspaceShellModuleAreas;
}

export function getDefaultNotesShellModuleOrder(): NotesWorkspaceShellModuleOrder {
    return Object.fromEntries(
        listImplementedNotesShellModules().map((module) => [module.id, module.order])
    ) as NotesWorkspaceShellModuleOrder;
}

export function getDefaultNotesShellAreaLayouts(): NotesWorkspaceShellAreaLayouts {
    return Object.fromEntries(
        NOTES_WORKSPACE_SHELL_LAYOUT_AREAS.map((area) => [area, 'column'])
    ) as NotesWorkspaceShellAreaLayouts;
}

export function getNotesShellModuleArea(
    moduleId: NotesWorkspaceShellModuleId,
    moduleAreas: NotesWorkspaceShellModuleAreas | undefined
): NotesWorkspaceDockArea {
    return moduleAreas?.[moduleId] ?? NOTES_WORKSPACE_MODULES.find((module) => module.id === moduleId)?.defaultArea ?? 'right';
}

export function getNotesShellModuleOrder(
    moduleId: NotesWorkspaceShellModuleId,
    moduleOrder: NotesWorkspaceShellModuleOrder | undefined
): number {
    return moduleOrder?.[moduleId] ?? NOTES_WORKSPACE_MODULES.find((module) => module.id === moduleId)?.order ?? 999;
}

export function canToggleNotesShellModule(moduleId: NotesWorkspaceShellModuleId): boolean {
    return NOTES_WORKSPACE_MODULES.find((module) => module.id === moduleId)?.canToggle ?? false;
}

export function mergeNotesShellModuleTabs(
    groups: NotesWorkspaceShellTabGroup[],
    sourceModuleId: NotesWorkspaceShellModuleId,
    targetModuleId: NotesWorkspaceShellModuleId
): NotesWorkspaceShellTabGroup[] {
    if (sourceModuleId === targetModuleId) return groups;

    const sourceGroup = groups.find((group) => group.moduleIds.includes(sourceModuleId));
    const targetGroup = groups.find((group) => group.moduleIds.includes(targetModuleId));
    if (sourceGroup && targetGroup && sourceGroup.id === targetGroup.id) return groups;

    const nextGroups: NotesWorkspaceShellTabGroup[] = [];
    for (const group of groups) {
        if (group.id === targetGroup?.id) {
            nextGroups.push({
                ...group,
                moduleIds: [...group.moduleIds.filter((moduleId) => moduleId !== sourceModuleId), sourceModuleId],
                activeModuleId: sourceModuleId,
            });
            continue;
        }

        if (group.id === sourceGroup?.id) {
            const remainingModuleIds = group.moduleIds.filter((moduleId) => moduleId !== sourceModuleId);
            if (remainingModuleIds.length >= 2) {
                nextGroups.push({
                    ...group,
                    moduleIds: remainingModuleIds,
                    activeModuleId: remainingModuleIds.includes(group.activeModuleId)
                        ? group.activeModuleId
                        : remainingModuleIds[0],
                });
            }
            continue;
        }

        nextGroups.push(group);
    }

    if (!targetGroup) {
        nextGroups.push({
            id: `shell-group-${targetModuleId}`,
            moduleIds: [targetModuleId, sourceModuleId],
            activeModuleId: sourceModuleId,
        });
    }

    return nextGroups;
}

export function moveNotesShellModuleTab(
    groups: NotesWorkspaceShellTabGroup[],
    moduleId: NotesWorkspaceShellModuleId,
    targetGroupId: string,
    beforeModuleId?: NotesWorkspaceShellModuleId | null
): NotesWorkspaceShellTabGroup[] {
    const targetGroup = groups.find((group) => group.id === targetGroupId);
    if (!targetGroup) return groups;
    const sourceGroup = groups.find((group) => group.moduleIds.includes(moduleId));
    const targetModuleIds = targetGroup.moduleIds.filter((candidate) => candidate !== moduleId);
    const insertIndex = beforeModuleId ? targetModuleIds.indexOf(beforeModuleId) : -1;
    const nextTargetModuleIds = insertIndex >= 0
        ? [...targetModuleIds.slice(0, insertIndex), moduleId, ...targetModuleIds.slice(insertIndex)]
        : [...targetModuleIds, moduleId];

    const nextGroups: NotesWorkspaceShellTabGroup[] = [];
    for (const group of groups) {
        if (group.id === targetGroup.id) {
            nextGroups.push({ ...group, moduleIds: nextTargetModuleIds, activeModuleId: moduleId });
            continue;
        }
        if (group.id === sourceGroup?.id) {
            const remainingModuleIds = group.moduleIds.filter((candidate) => candidate !== moduleId);
            if (remainingModuleIds.length >= 2) {
                nextGroups.push({
                    ...group,
                    moduleIds: remainingModuleIds,
                    activeModuleId: remainingModuleIds.includes(group.activeModuleId)
                        ? group.activeModuleId
                        : remainingModuleIds[0],
                });
            }
            continue;
        }
        nextGroups.push(group);
    }
    return nextGroups;
}

export function mergeNotesShellModuleGroupTabs(
    groups: NotesWorkspaceShellTabGroup[],
    sourceGroupId: string,
    targetModuleId: NotesWorkspaceShellModuleId
): NotesWorkspaceShellTabGroup[] {
    const sourceGroup = groups.find((group) => group.id === sourceGroupId);
    if (!sourceGroup || sourceGroup.moduleIds.includes(targetModuleId)) return groups;
    const targetGroup = groups.find((group) => group.moduleIds.includes(targetModuleId));
    const mergedModuleIds = targetGroup
        ? [...targetGroup.moduleIds, ...sourceGroup.moduleIds.filter((moduleId) => !targetGroup.moduleIds.includes(moduleId))]
        : [targetModuleId, ...sourceGroup.moduleIds.filter((moduleId) => moduleId !== targetModuleId)];

    return [
        ...groups.filter((group) => group.id !== sourceGroup.id && group.id !== targetGroup?.id),
        {
            id: targetGroup?.id ?? `shell-group-${targetModuleId}`,
            moduleIds: mergedModuleIds,
            activeModuleId: sourceGroup.activeModuleId,
        },
    ];
}

export function removeNotesShellModuleFromTabs(
    groups: NotesWorkspaceShellTabGroup[],
    moduleId: NotesWorkspaceShellModuleId
): NotesWorkspaceShellTabGroup[] {
    const sourceGroup = groups.find((group) => group.moduleIds.includes(moduleId));
    if (!sourceGroup) return groups;

    return groups.flatMap((group) => {
        if (group.id !== sourceGroup.id) return [group];
        const moduleIds = group.moduleIds.filter((candidate) => candidate !== moduleId);
        if (moduleIds.length < 2) return [];
        return [{
            ...group,
            moduleIds,
            activeModuleId: moduleIds.includes(group.activeModuleId) ? group.activeModuleId : moduleIds[0],
        }];
    });
}

export function isNotesWorkspaceDockArea(value: unknown): value is NotesWorkspaceDockArea {
    return value === 'left' || value === 'center' || value === 'right' || value === 'bottom';
}

export function isNotesWorkspaceShellAreaLayout(value: unknown): value is NotesWorkspaceShellAreaLayout {
    return value === 'column' || value === 'row';
}
