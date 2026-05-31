/**
 * shared/types.ts
 * 
 * Shared types between server and client.
 * Mirrors app/src/types.ts but decoupled for server use.
 */

export type EntityType = 'character' | 'object' | 'ability' | 'competency' | 'tag' | 'canvas' | 'note' | 'portal' | 'folder' | 'attack';

export type DatabaseType = 'general' | 'user' | 'gm';
export type UserRole = 'gm' | 'player' | 'trusted-player' | 'spectator';

export interface Entity {
    id: string;
    parentId: string | null;
    /** Version of the normalized Entity/frontmatter contract. Missing legacy files are treated as current. */
    schemaVersion?: number;
    type: EntityType;
    name: string;
    description: string;
    imageId?: string;
    icon_url?: string;
    properties: Record<string, any>;
    tags: string[];
    /** Which database this entity belongs to */
    database?: DatabaseType;
}

export interface WorldMeta {
    name: string;
    path: string;
    createdAt: string;
    version: string;
}

export interface PlayerProfile {
    playerId: string;
    displayName: string;
    assignedRole: UserRole;
    storageRoot: string;
    createdAt: string;
    updatedAt: string;
    lastSeenAt?: string;
    legacy?: boolean;
}

export interface FileChangeEvent {
    type: 'add' | 'change' | 'unlink';
    entity: Entity | null;
    entityId: string;
    database: DatabaseType;
}
