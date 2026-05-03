import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { Entity, ChatMessage, DatabaseType } from '../types';
import { getIsHost } from '../services/fileApi';

export type UserRole = 'gm' | 'player' | 'spectator';

export class YjsStore {
    doc: Y.Doc;
    provider: WebsocketProvider | null = null;
    persistence: IndexeddbPersistence | null = null;
    entitiesMap: Y.Map<Entity>;
    chatArray: Y.Array<ChatMessage>;
    /** Stores user roles: Map<peerId, UserRole> */
    rolesMap: Y.Map<UserRole>;

    /** Fast lookup: lowercase name → entity id */
    private nameCache: Map<string, string> = new Map();

    /** Current user's display name (for chat) */
    localPlayerName: string = 'Игрок';

    /** Current user's role */
    localRole: UserRole = 'player';

    /** Unique ID for this player (used for ownership checks) */
    localPlayerId: string = '';

    constructor() {
        this.doc = new Y.Doc();
        this.entitiesMap = this.doc.getMap<Entity>('entities');
        this.chatArray = this.doc.getArray<ChatMessage>('chat');
        this.rolesMap = this.doc.getMap<UserRole>('roles');
    }

    joinRoom(roomName: string) {
        if (this.provider) {
            this.provider.destroy();
        }
        if (this.persistence) {
            this.persistence.destroy();
        }

        // Offline persistence
        this.persistence = new IndexeddbPersistence(roomName, this.doc);

        // Connect to the host's Express server on port 3001
        const savedIp = localStorage.getItem('vibe_server_ip');
        const host = savedIp && savedIp.trim() !== '' ? savedIp.trim() : window.location.hostname;
        this.provider = new WebsocketProvider(`ws://${host}:3001/ws/world`, roomName, this.doc, { connect: true });

        // Initialize default folders when ready
        this.provider.on('sync', (isSynced: boolean) => {
            if (isSynced) {
                this.ensureDefaultFolders();
                this.rebuildNameCache();
                this.announcePlayerInfo();
            }
        });
        if (this.persistence) {
            this.persistence.on('synced', () => {
                this.ensureDefaultFolders();
                this.rebuildNameCache();
                this.announcePlayerInfo();
            });
        }
    }

    /** Announce player info via awareness for other clients to see */
    private announcePlayerInfo() {
        if (this.provider?.awareness) {
            this.provider.awareness.setLocalStateField('user', {
                name: this.localPlayerName,
                role: this.localRole,
                id: this.localPlayerId,
            });
        }
    }

    /** Set the local player's display name and generate a persistent ID */
    setLocalPlayerName(name: string) {
        this.localPlayerName = name.trim() || 'Игрок';
        // Generate a persistent player ID if not set
        if (!this.localPlayerId) {
            const saved = localStorage.getItem('vibe_player_id');
            if (saved) {
                this.localPlayerId = saved;
            } else {
                this.localPlayerId = 'player_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
                localStorage.setItem('vibe_player_id', this.localPlayerId);
            }
        }
        // Set role based on host status
        this.localRole = getIsHost() ? 'gm' : 'player';
        this.announcePlayerInfo();
    }

    /** Check if current user can modify a given entity */
    canModify(entityDb?: DatabaseType, entityOwnerId?: string): boolean {
        return canModifyEntity(this.localRole, entityDb, entityOwnerId, this.localPlayerId);
    }

    /** Rebuild the entire name cache from the Yjs map */
    private rebuildNameCache() {
        this.nameCache.clear();
        this.entitiesMap.forEach((ent) => {
            this.nameCache.set(ent.name.toLowerCase(), ent.id);
        });
    }

    private ensureDefaultFolders() {
        // Automatically create required tag folders if they don't exist
        const defaultFolders = [
            { id: 'folder_tags_hidden', name: 'Скрытые теги' },
            { id: 'folder_tags_statuses', name: 'Статусы' },
            { id: 'folder_tags_properties', name: 'Свойства' }
        ];

        defaultFolders.forEach(folder => {
            if (!this.entitiesMap.has(folder.id)) {
                this.entitiesMap.set(folder.id, {
                    id: folder.id,
                    parentId: null,
                    type: 'folder',
                    name: this.getUniqueName(folder.name, folder.id),
                    description: '',
                    properties: { folderType: 'tag' },
                    tags: []
                });
            } else {
                const existing = this.entitiesMap.get(folder.id);
                if (existing && existing.properties?.folderType !== 'tag') {
                    this.entitiesMap.set(folder.id, { ...existing, properties: { ...existing.properties, folderType: 'tag' } });
                }
            }
        });
    }

    leaveRoom() {
        if (this.provider) {
            this.provider.destroy();
            this.provider = null;
        }
        if (this.persistence) {
            this.persistence.destroy();
            this.persistence = null;
        }
    }

    getUniqueName(desiredName: string, excludeId?: string): string {
        let name = desiredName.trim();
        if (!name) name = "Unnamed";
        let counter = 1;

        const isNameTaken = (n: string) => {
            const existingId = this.nameCache.get(n.toLowerCase());
            if (!existingId) return false;
            return existingId !== excludeId;
        };

        if (isNameTaken(name)) {
            // Extract base name ignoring any trailing number
            const match = name.match(/^(.*?)(\s+\d+)?$/);
            const baseName = match ? match[1].trim() : name;

            let currentTry = `${baseName} ${counter}`;
            while (isNameTaken(currentTry)) {
                counter++;
                currentTry = `${baseName} ${counter}`;
            }
            name = currentTry;
        }

        return name;
    }

    addEntity(entity: Entity) {
        entity.name = this.getUniqueName(entity.name, entity.id);
        this.entitiesMap.set(entity.id, entity);
        // Update cache
        this.nameCache.set(entity.name.toLowerCase(), entity.id);
    }

    updateEntity(id: string, partial: Partial<Entity>) {
        const existing = this.entitiesMap.get(id);
        if (existing) {
            // If name is changing, update the cache
            if (partial.name && partial.name !== existing.name) {
                this.nameCache.delete(existing.name.toLowerCase());
                partial.name = this.getUniqueName(partial.name, id);
                this.nameCache.set(partial.name.toLowerCase(), id);
            }
            this.entitiesMap.set(id, { ...existing, ...partial });
        }
    }

    /**
     * Cascading delete: removes the entity and all descendants recursively.
     * Also cleans up tag references from other entities.
     */
    deleteEntity(id: string) {
        const idsToDelete = this.collectDescendants(id);
        idsToDelete.add(id);

        // Clean up tag references from any entity that references deleted IDs
        this.entitiesMap.forEach((ent) => {
            if (idsToDelete.has(ent.id)) return;
            if (ent.tags && ent.tags.some(tagId => idsToDelete.has(tagId))) {
                this.entitiesMap.set(ent.id, {
                    ...ent,
                    tags: ent.tags.filter(tagId => !idsToDelete.has(tagId))
                });
            }
        });

        // Delete all collected entities
        for (const delId of idsToDelete) {
            const ent = this.entitiesMap.get(delId);
            if (ent) {
                this.nameCache.delete(ent.name.toLowerCase());
            }
            this.entitiesMap.delete(delId);
        }
    }

    /** Collect all descendant entity IDs recursively */
    private collectDescendants(parentId: string): Set<string> {
        const result = new Set<string>();
        this.entitiesMap.forEach((ent) => {
            if (ent.parentId === parentId) {
                result.add(ent.id);
                const childDescendants = this.collectDescendants(ent.id);
                childDescendants.forEach(id => result.add(id));
            }
        });
        return result;
    }

    /**
     * Recursive clone: clones the entity and all its children.
     * Can optionally place the clone into a specific database (e.g. 'user' for inventories).
     */
    cloneEntity(sourceId: string, newParentId: string | null = null, targetDb?: DatabaseType): string | null {
        const source = this.entitiesMap.get(sourceId);
        if (!source) return null;

        const newId = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
        const cloned: Entity = {
            ...source,
            id: newId,
            parentId: newParentId,
            name: this.getUniqueName(source.name),
            properties: JSON.parse(JSON.stringify(source.properties)),
            tags: [...source.tags]
        };

        if (targetDb) {
            cloned.database = targetDb;
        }

        this.addEntity(cloned);

        // Recursively clone children
        this.entitiesMap.forEach((ent) => {
            if (ent.parentId === sourceId) {
                this.cloneEntity(ent.id, newId, targetDb);
            }
        });

        return newId;
    }

    sendMessage(text: string, sender?: string, isSystem: boolean = false) {
        const senderName = sender || this.localPlayerName;
        const message: ChatMessage = {
            id: Date.now().toString() + Math.random().toString(36).substring(7),
            text,
            sender: senderName,
            timestamp: Date.now(),
            isSystem
        };
        this.chatArray.push([message]);
    }
}

export const yjsStore = new YjsStore();
