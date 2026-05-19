import type { DatabaseType } from '../types';

export type UserRole = 'gm' | 'player' | 'spectator';

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
        return !entityOwnerId || entityOwnerId === localPlayerId || entityOwnerId === localPlayerName;
    }
    return true;
}
