export type AppModuleId =
    | 'assetLibrary'
    | 'pdfViewer'
    | 'audio'
    | 'canvasTools'
    | 'rulesEngine'
    | 'future3d';

export type AppModuleStatus = 'core' | 'prototype' | 'planned';
export type AppModuleSurface = 'app' | 'drawer' | 'dock' | 'settings' | 'canvas' | 'service';

export interface AppModuleDefinition {
    id: AppModuleId;
    status: AppModuleStatus;
    defaultEnabled: boolean;
    canDisable: boolean;
    surfaces: AppModuleSurface[];
    docPath?: string;
}

export type AppModuleEnablement = Record<AppModuleId, boolean>;

export const APP_MODULE_DEFINITIONS: readonly AppModuleDefinition[] = [
    {
        id: 'assetLibrary',
        status: 'core',
        defaultEnabled: true,
        canDisable: false,
        surfaces: ['drawer', 'service'],
        docPath: '.pi/docs/asset-audio-workbench.md',
    },
    {
        id: 'pdfViewer',
        status: 'prototype',
        defaultEnabled: true,
        canDisable: true,
        surfaces: ['drawer', 'settings'],
        docPath: '.pi/docs/module-architecture.md',
    },
    {
        id: 'audio',
        status: 'prototype',
        defaultEnabled: true,
        canDisable: true,
        surfaces: ['dock', 'settings', 'service'],
        docPath: '.pi/docs/gm-audio-desk.md',
    },
    {
        id: 'canvasTools',
        status: 'prototype',
        defaultEnabled: true,
        canDisable: false,
        surfaces: ['canvas', 'settings'],
        docPath: '.pi/docs/canvas-excalidraw-upgrade.md',
    },
    {
        id: 'rulesEngine',
        status: 'core',
        defaultEnabled: true,
        canDisable: false,
        surfaces: ['service'],
        docPath: '.pi/rules/mechanics-engine.md',
    },
    {
        id: 'future3d',
        status: 'planned',
        defaultEnabled: false,
        canDisable: true,
        surfaces: ['canvas', 'settings'],
        docPath: '.pi/3D_FUTURE_ANALYSIS.md',
    },
] as const;

export const APP_MODULE_IDS = APP_MODULE_DEFINITIONS.map(module => module.id) as AppModuleId[];

const MODULE_DEFINITION_BY_ID = new Map<AppModuleId, AppModuleDefinition>(
    APP_MODULE_DEFINITIONS.map(module => [module.id, module]),
);

export function isAppModuleId(value: unknown): value is AppModuleId {
    return typeof value === 'string' && MODULE_DEFINITION_BY_ID.has(value as AppModuleId);
}

export function getAppModuleDefinition(id: AppModuleId): AppModuleDefinition {
    const definition = MODULE_DEFINITION_BY_ID.get(id);
    if (!definition) throw new Error(`Unknown app module: ${id}`);
    return definition;
}

export function getDefaultAppModuleEnablement(): AppModuleEnablement {
    return Object.fromEntries(
        APP_MODULE_DEFINITIONS.map(module => [module.id, module.defaultEnabled]),
    ) as AppModuleEnablement;
}

export function normalizeAppModuleEnablement(value: unknown): AppModuleEnablement {
    const source = value && typeof value === 'object'
        ? value as Partial<Record<AppModuleId, unknown>>
        : {};
    const normalized = getDefaultAppModuleEnablement();

    for (const module of APP_MODULE_DEFINITIONS) {
        if (!module.canDisable) {
            normalized[module.id] = true;
            continue;
        }
        const requestedEnabled = source[module.id];
        if (typeof requestedEnabled === 'boolean') {
            normalized[module.id] = requestedEnabled;
        }
    }

    return normalized;
}

export function setAppModuleEnabled(
    current: unknown,
    moduleId: AppModuleId,
    enabled: boolean,
): AppModuleEnablement {
    const normalized = normalizeAppModuleEnablement(current);
    const definition = getAppModuleDefinition(moduleId);
    normalized[moduleId] = definition.canDisable ? enabled : true;
    return normalized;
}

export function isAppModuleEnabled(current: unknown, moduleId: AppModuleId): boolean {
    return normalizeAppModuleEnablement(current)[moduleId];
}

export function getEnabledAppModuleIds(current: unknown): AppModuleId[] {
    const normalized = normalizeAppModuleEnablement(current);
    return APP_MODULE_IDS.filter(moduleId => normalized[moduleId]);
}
