import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { AudioSessionCommand, Entity, ChatMessage, DatabaseType, SessionNotificationEvent, SessionNotificationStatus } from '../types';
import { getIsHost } from '../services/fileApi';
import { sanitizeCanvasEntityForSharedSync } from '../utils/canvasPersistence';
import { CURRENT_ENTITY_SCHEMA_VERSION, withCurrentEntitySchema } from '../utils/entitySchema';
import { generateEntityId } from '../utils/entityId';
import { canBroadcastAudio, canModifyEntity, type UserRole } from '../utils/permissions';
import { getYjsPersistenceKey } from '../utils/yjsCache';

export class YjsStore {
    doc: Y.Doc;
    provider: WebsocketProvider | null = null;
    persistence: IndexeddbPersistence | null = null;
    entitiesMap: Y.Map<Entity>;
    chatArray: Y.Array<ChatMessage>;
    audioMap: Y.Map<AudioSessionCommand>;
    sessionNotificationsMap: Y.Map<SessionNotificationEvent>;
    /** Stores user roles: Map<peerId, UserRole> */
    rolesMap: Y.Map<UserRole>;
    private rolesObserver: ((event: Y.YMapEvent<UserRole>) => void) | null = null;

    /** Fast lookup: lowercase name → entity id */
    private nameCache: Map<string, string> = new Map();
    private readonly maxSessionNotifications = 60;
    private readonly resolvedSessionNotificationTtlMs = 30 * 60 * 1000;

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
        this.audioMap = this.doc.getMap<AudioSessionCommand>('audio');
        this.sessionNotificationsMap = this.doc.getMap<SessionNotificationEvent>('sessionNotifications');
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
        this.persistence = new IndexeddbPersistence(getYjsPersistenceKey(roomName), this.doc);

        // Connect to the host's Express server on port 3001
        const savedIp = localStorage.getItem('vibe_server_ip');
        const locationHost = window.location.hostname || 'localhost';
        const host = savedIp && savedIp.trim() !== '' ? savedIp.trim() : locationHost;
        this.provider = new WebsocketProvider(`ws://${host}:3001/ws/world`, roomName, this.doc, { connect: true });

        // Initialize default folders when ready
        this.provider.on('sync', (isSynced: boolean) => {
            if (isSynced) {
                this.ensureDefaultFolders();
                this.ensureEntitySchemaVersions();
                this.pruneSessionNotifications();
                this.rebuildNameCache();
                this.applyAssignedRole();
                this.announcePlayerInfo();
            }
        });
        if (this.persistence) {
            this.persistence.on('synced', () => {
                this.ensureDefaultFolders();
                this.ensureEntitySchemaVersions();
                this.pruneSessionNotifications();
                this.rebuildNameCache();
                this.applyAssignedRole();
                this.announcePlayerInfo();
            });
        }
        this.setupRoleObserver();
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

    private setupRoleObserver() {
        if (this.rolesObserver) {
            this.rolesMap.unobserve(this.rolesObserver);
        }

        this.rolesObserver = (event) => {
            if (!this.localPlayerId || !event.keysChanged.has(this.localPlayerId)) return;
            this.applyAssignedRole();
            this.announcePlayerInfo();
        };
        this.rolesMap.observe(this.rolesObserver);
    }

    private applyAssignedRole(fallbackRole?: UserRole): void {
        if (getIsHost()) {
            this.localRole = 'gm';
            return;
        }
        this.localRole = this.rolesMap.get(this.localPlayerId) ?? fallbackRole ?? 'player';
    }

    /** Set the local player's display name and stable profile identity. */
    setLocalPlayerName(name: string, options: { playerId?: string; role?: UserRole } = {}) {
        this.localPlayerName = name.trim() || 'Игрок';
        if (options.playerId) {
            this.localPlayerId = options.playerId;
            localStorage.setItem('vibe_player_id', options.playerId);
        } else {
            const saved = localStorage.getItem('vibe_player_id');
            this.localPlayerId = saved || 'player_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
            localStorage.setItem('vibe_player_id', this.localPlayerId);
        }
        this.applyAssignedRole(options.role);
        this.announcePlayerInfo();
    }

    setPlayerRole(playerId: string, role: UserRole): boolean {
        if (this.localRole !== 'gm' || role === 'gm') {
            console.warn('Blocked role assignment: insufficient permissions or unsupported role');
            return false;
        }
        this.rolesMap.set(playerId, role);
        return true;
    }

    /** Check if current user can modify a given entity */
    canModify(entityDb?: DatabaseType, entityOwnerId?: string): boolean {
        return canModifyEntity(this.localRole, entityDb, entityOwnerId, this.localPlayerId, this.localPlayerName);
    }

    private getEntityOwnerId(entity: Entity): string | undefined {
        const owner = entity.properties?._playerOwner;
        return typeof owner === 'string' ? owner : undefined;
    }

    private canModifyStoredEntity(entity: Entity): boolean {
        return this.canModify(entity.database, this.getEntityOwnerId(entity));
    }

    /** Rebuild the entire name cache from the Yjs map */
    private rebuildNameCache() {
        this.nameCache.clear();
        this.entitiesMap.forEach((ent) => {
            const key = ent.name.toLowerCase();
            if (!this.nameCache.has(key)) {
                this.nameCache.set(key, ent.id);
            }
        });
    }

    private getExistingEntityIds(): string[] {
        const ids: string[] = [];
        this.entitiesMap.forEach((_entity, id) => ids.push(id));
        return ids;
    }

    private getAvailableEntityId(preferredId?: string): string {
        if (preferredId && !this.entitiesMap.has(preferredId)) return preferredId;
        return generateEntityId(this.getExistingEntityIds());
    }

    private ensureDefaultFolders() {
        this.ensureRootCanvas();

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
                    schemaVersion: CURRENT_ENTITY_SCHEMA_VERSION,
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

    private ensureRootCanvas() {
        const existing = this.entitiesMap.get('root');
        const rootCanvas: Entity = {
            ...(existing ?? {}),
            id: 'root',
            parentId: null,
            schemaVersion: CURRENT_ENTITY_SCHEMA_VERSION,
            type: 'canvas',
            name: 'root',
            description: existing?.description ?? 'System root canvas.',
            properties: existing?.properties ?? {},
            tags: existing?.tags ?? [],
            database: 'general',
        };

        if (!existing || JSON.stringify(existing) !== JSON.stringify(rootCanvas)) {
            this.entitiesMap.set('root', rootCanvas);
        }
    }

    private ensureEntitySchemaVersions() {
        this.entitiesMap.forEach((entity, id) => {
            const normalizedEntity = sanitizeCanvasEntityForSharedSync(withCurrentEntitySchema(entity));
            if (JSON.stringify(normalizedEntity) !== JSON.stringify(entity)) {
                this.entitiesMap.set(id, normalizedEntity);
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
        if (this.rolesObserver) {
            this.rolesMap.unobserve(this.rolesObserver);
            this.rolesObserver = null;
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

    addEntity(entity: Entity): boolean {
        const normalizedEntity = sanitizeCanvasEntityForSharedSync(withCurrentEntitySchema({
            ...entity,
            id: this.getAvailableEntityId(entity.id),
            name: entity.name.trim() || 'Unnamed',
        }));
        if (!this.canModifyStoredEntity(normalizedEntity)) {
            console.warn(`Blocked addEntity for "${normalizedEntity.name}": insufficient permissions`);
            return false;
        }
        this.entitiesMap.set(normalizedEntity.id, normalizedEntity);
        // Update cache
        this.nameCache.set(normalizedEntity.name.toLowerCase(), normalizedEntity.id);
        return true;
    }

    updateEntity(id: string, partial: Partial<Entity>): boolean {
        const existing = this.entitiesMap.get(id);
        if (existing) {
            const nextEntity = sanitizeCanvasEntityForSharedSync(withCurrentEntitySchema({ ...existing, ...partial }));
            if (!this.canModifyStoredEntity(existing) || !this.canModifyStoredEntity(nextEntity)) {
                console.warn(`Blocked updateEntity for "${existing.name}": insufficient permissions`);
                return false;
            }
            // If name is changing, update the cache
            if (partial.name && partial.name !== existing.name) {
                this.nameCache.delete(existing.name.toLowerCase());
                partial.name = partial.name.trim() || 'Unnamed';
                this.nameCache.set(partial.name.toLowerCase(), id);
            }
            this.entitiesMap.set(id, sanitizeCanvasEntityForSharedSync(withCurrentEntitySchema({ ...existing, ...partial })));
            return true;
        }
        return false;
    }

    /**
     * Cascading delete: removes the entity and all descendants recursively.
     * Also cleans up tag references from other entities.
     */
    deleteEntity(id: string): boolean {
        const rootEntity = this.entitiesMap.get(id);
        if (!rootEntity || !this.canModifyStoredEntity(rootEntity)) {
            console.warn(`Blocked deleteEntity for "${rootEntity?.name ?? id}": insufficient permissions`);
            return false;
        }

        const idsToDelete = this.collectDescendants(id);
        idsToDelete.add(id);

        for (const delId of idsToDelete) {
            const ent = this.entitiesMap.get(delId);
            if (ent && !this.canModifyStoredEntity(ent)) {
                console.warn(`Blocked deleteEntity for "${rootEntity.name}": descendant "${ent.name}" is protected`);
                return false;
            }
        }

        // Clean up tag references from any entity that references deleted IDs
        this.entitiesMap.forEach((ent) => {
            if (idsToDelete.has(ent.id)) return;
            if (ent.tags && ent.tags.some(tagId => idsToDelete.has(tagId))) {
                if (!this.canModifyStoredEntity(ent)) return;
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
        return true;
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

        const newId = generateEntityId(this.getExistingEntityIds());
        const cloned: Entity = {
            ...source,
            id: newId,
            parentId: newParentId,
            name: source.name,
            properties: JSON.parse(JSON.stringify(source.properties)),
            tags: [...source.tags]
        };

        if (targetDb) {
            cloned.database = targetDb;
        }

        if (!this.addEntity(cloned)) return null;

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

    sendAudioCommand(command: Omit<AudioSessionCommand, 'id' | 'issuedAt' | 'senderId' | 'senderName'>): boolean {
        if (!canBroadcastAudio(this.localRole)) {
            console.warn('Blocked audio session command: insufficient audio broadcast permissions');
            return false;
        }

        const issuedAt = Date.now();
        this.audioMap.set('latest', {
            ...command,
            id: `${issuedAt.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            issuedAt,
            startedAt: command.action === 'play' ? command.startedAt ?? issuedAt : command.startedAt,
            senderId: this.localPlayerId,
            senderName: this.localPlayerName,
        });
        return true;
    }

    getLatestAudioCommand(): AudioSessionCommand | null {
        return this.audioMap.get('latest') ?? null;
    }

    observeAudioCommands(handler: (command: AudioSessionCommand) => void): () => void {
        const observer = (event: Y.YMapEvent<AudioSessionCommand>) => {
            if (!event.keysChanged.has('latest')) return;
            const command = this.getLatestAudioCommand();
            if (command) handler(command);
        };

        this.audioMap.observe(observer);
        return () => this.audioMap.unobserve(observer);
    }

    sendSessionNotification(
        input: Omit<SessionNotificationEvent, 'id' | 'issuedAt' | 'actorId' | 'actorName'> & Partial<Pick<SessionNotificationEvent, 'id' | 'issuedAt' | 'actorId' | 'actorName'>>,
    ): SessionNotificationEvent {
        const issuedAt = input.issuedAt ?? Date.now();
        const id = input.id?.trim() || `session_note_${issuedAt.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const event: SessionNotificationEvent = {
            ...input,
            id,
            issuedAt,
            actorId: input.actorId?.trim() || this.localPlayerId || undefined,
            actorName: input.actorName?.trim() || this.localPlayerName || undefined,
        };

        this.sessionNotificationsMap.set(id, event);
        this.pruneSessionNotifications();
        return event;
    }

    respondToSessionNotification(id: string, status: Extract<SessionNotificationStatus, 'approved' | 'rejected'>): boolean {
        const existing = this.sessionNotificationsMap.get(id);
        if (!existing) return false;
        if (existing.type === 'large-upload-approval' && this.localRole !== 'gm') {
            console.warn('Blocked session notification response: only GM can approve upload requests');
            return false;
        }
        if (existing.status !== 'pending') return false;

        const updatedAt = Date.now();
        this.sessionNotificationsMap.set(id, {
            ...existing,
            status,
            updatedAt,
            responseById: this.localPlayerId || undefined,
            responseByName: this.localPlayerName || undefined,
        });
        this.pruneSessionNotifications();
        return true;
    }

    updateSessionNotification(
        id: string,
        updates: Partial<Pick<SessionNotificationEvent, 'status' | 'title' | 'message' | 'payload'>>,
    ): boolean {
        const existing = this.sessionNotificationsMap.get(id);
        if (!existing) return false;

        const isActor = Boolean(
            (existing.actorId && this.localPlayerId && existing.actorId === this.localPlayerId)
            || (existing.actorName && this.localPlayerName && existing.actorName === this.localPlayerName)
        );
        if (!isActor && this.localRole !== 'gm') {
            console.warn('Blocked session notification update: insufficient permissions');
            return false;
        }
        if (existing.status === 'rejected' && updates.status && updates.status !== 'rejected') return false;

        this.sessionNotificationsMap.set(id, {
            ...existing,
            ...updates,
            payload: updates.payload ? { ...existing.payload, ...updates.payload } : existing.payload,
            updatedAt: Date.now(),
        });
        this.pruneSessionNotifications();
        return true;
    }

    private pruneSessionNotifications(now = Date.now()): void {
        if (!getIsHost() && this.localRole !== 'gm') return;
        if (this.sessionNotificationsMap.size <= this.maxSessionNotifications) {
            let hasExpiredResolved = false;
            this.sessionNotificationsMap.forEach((notification) => {
                const active = notification.status === 'pending' || notification.status === 'uploading';
                const timestamp = notification.updatedAt ?? notification.issuedAt;
                if (!active && now - timestamp > this.resolvedSessionNotificationTtlMs) {
                    hasExpiredResolved = true;
                }
            });
            if (!hasExpiredResolved) return;
        }

        const entries = Array.from(this.sessionNotificationsMap.entries())
            .sort((left, right) => {
                const leftTime = left[1].updatedAt ?? left[1].issuedAt;
                const rightTime = right[1].updatedAt ?? right[1].issuedAt;
                return rightTime - leftTime;
            });
        const keepIds = new Set<string>();

        entries.forEach(([id, notification], index) => {
            const active = notification.status === 'pending' || notification.status === 'uploading';
            const timestamp = notification.updatedAt ?? notification.issuedAt;
            if (active || (index < this.maxSessionNotifications && now - timestamp <= this.resolvedSessionNotificationTtlMs)) {
                keepIds.add(id);
            }
        });

        entries.forEach(([id]) => {
            if (!keepIds.has(id)) this.sessionNotificationsMap.delete(id);
        });
    }

    getSessionNotifications(): SessionNotificationEvent[] {
        return Array.from(this.sessionNotificationsMap.values());
    }

    observeSessionNotifications(handler: (notification: SessionNotificationEvent) => void): () => void {
        const observer = (event: Y.YMapEvent<SessionNotificationEvent>) => {
            event.keysChanged.forEach((id) => {
                const notification = this.sessionNotificationsMap.get(id);
                if (notification) handler(notification);
            });
        };

        this.sessionNotificationsMap.observe(observer);
        return () => this.sessionNotificationsMap.unobserve(observer);
    }
}

export const yjsStore = new YjsStore();
