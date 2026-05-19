import type { DatabaseType } from '../types';

export type UserRole = 'gm' | 'player' | 'spectator';

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
    if (role === 'gm') return true;
    if (entityDb === 'gm') return false;
    if (entityDb === 'user') {
        return ownerMatches(entityOwnerId, localPlayerId, localPlayerName);
    }
    return true;
}

export function canModifyEntity(
    role: UserRole,
    entityDb: DatabaseType = 'general',
    entityOwnerId?: string,
    localPlayerId?: string,
    localPlayerName?: string
): boolean {
    if (role === 'gm') return true;
    if (role === 'spectator') return false;
    if (entityDb === 'gm') return false;
    if (entityDb === 'user') {
        return ownerMatches(entityOwnerId, localPlayerId, localPlayerName);
    }
    return true;
}
