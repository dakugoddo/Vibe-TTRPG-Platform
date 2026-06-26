import type { DatabaseType } from '../types';

export type UserRole = 'gm' | 'player' | 'trusted-player' | 'spectator';
export type PermissionKey =
    | 'viewGeneral'
    | 'editGeneral'
    | 'viewOwnUser'
    | 'editOwnUser'
    | 'viewOtherUser'
    | 'editOtherUser'
    | 'viewGm'
    | 'editGm'
    | 'broadcastAudio';

export type PermissionSet = Record<PermissionKey, boolean>;

export interface RoleDefinition {
    id: 'base-player' | UserRole;
    label: string;
    locked?: boolean;
    permissions: PermissionSet;
}

const ALL_PERMISSIONS: PermissionSet = {
    viewGeneral: true,
    editGeneral: true,
    viewOwnUser: true,
    editOwnUser: true,
    viewOtherUser: true,
    editOtherUser: true,
    viewGm: true,
    editGm: true,
    broadcastAudio: true,
};

const READ_ONLY_GENERAL: PermissionSet = {
    viewGeneral: true,
    editGeneral: false,
    viewOwnUser: true,
    editOwnUser: false,
    viewOtherUser: false,
    editOtherUser: false,
    viewGm: false,
    editGm: false,
    broadcastAudio: false,
};

export const BASE_PLAYER_ROLE: RoleDefinition = {
    id: 'base-player',
    label: 'Base Player',
    locked: true,
    permissions: {
        viewGeneral: true,
        editGeneral: true,
        viewOwnUser: true,
        editOwnUser: true,
        viewOtherUser: false,
        editOtherUser: false,
        viewGm: false,
        editGm: false,
        broadcastAudio: false,
    },
};

export const DEFAULT_ROLE_DEFINITIONS: RoleDefinition[] = [
    BASE_PLAYER_ROLE,
    {
        id: 'player',
        label: 'Player',
        permissions: {
            ...BASE_PLAYER_ROLE.permissions,
        },
    },
    {
        id: 'trusted-player',
        label: 'Trusted Player',
        permissions: {
            ...BASE_PLAYER_ROLE.permissions,
            viewOtherUser: true,
            editOtherUser: true,
        },
    },
    {
        id: 'spectator',
        label: 'Spectator',
        permissions: READ_ONLY_GENERAL,
    },
    {
        id: 'gm',
        label: 'GM',
        permissions: ALL_PERMISSIONS,
    },
];

function getRoleDefinition(role: UserRole): RoleDefinition {
    return DEFAULT_ROLE_DEFINITIONS.find((definition) => definition.id === role) ?? DEFAULT_ROLE_DEFINITIONS[1];
}

export function getEffectivePermissions(role: UserRole): PermissionSet {
    if (role === 'gm') return ALL_PERMISSIONS;

    const rolePermissions = getRoleDefinition(role).permissions;
    const basePermissions = BASE_PLAYER_ROLE.permissions;

    return Object.fromEntries(
        (Object.keys(basePermissions) as PermissionKey[]).map((key) => [key, basePermissions[key] && rolePermissions[key]])
    ) as PermissionSet;
}

function ownerMatches(entityOwnerId: string | undefined, localPlayerId?: string, localPlayerName?: string): boolean {
    return !entityOwnerId || entityOwnerId === localPlayerId || entityOwnerId === localPlayerName;
}

export function canViewEntity(
    role: UserRole,
    entityDb: DatabaseType = 'general',
    entityOwnerId?: string,
    localPlayerId?: string,
    localPlayerName?: string
): boolean {
    const permissions = getEffectivePermissions(role);
    if (entityDb === 'gm') return permissions.viewGm;
    if (entityDb === 'user') {
        return ownerMatches(entityOwnerId, localPlayerId, localPlayerName) ? permissions.viewOwnUser : permissions.viewOtherUser;
    }
    return permissions.viewGeneral;
}

export function canModifyEntity(
    role: UserRole,
    entityDb: DatabaseType = 'general',
    entityOwnerId?: string,
    localPlayerId?: string,
    localPlayerName?: string
): boolean {
    const permissions = getEffectivePermissions(role);
    if (entityDb === 'gm') return permissions.editGm;
    if (entityDb === 'user') {
        return ownerMatches(entityOwnerId, localPlayerId, localPlayerName) ? permissions.editOwnUser : permissions.editOtherUser;
    }
    return permissions.editGeneral;
}

export function canBroadcastAudio(role: UserRole): boolean {
    return getEffectivePermissions(role).broadcastAudio;
}
