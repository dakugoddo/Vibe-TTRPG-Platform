/**
 * shared/types.ts
 * 
 * Shared types between server and client.
 * Mirrors app/src/types.ts but decoupled for server use.
 */

export type EntityType = 'character' | 'object' | 'ability' | 'tag' | 'canvas' | 'note' | 'portal' | 'folder' | 'attack';

export type DatabaseType = 'general' | 'user' | 'gm';

export interface Entity {
    id: string;
    parentId: string | null;
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

export interface FileChangeEvent {
    type: 'add' | 'change' | 'unlink';
    entity: Entity | null;
    entityId: string;
    database: DatabaseType;
}
