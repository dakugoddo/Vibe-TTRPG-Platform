export type EntityType = 'character' | 'object' | 'ability' | 'competency' | 'tag' | 'canvas' | 'note' | 'portal' | 'folder' | 'attack';
export type DatabaseType = 'general' | 'user' | 'gm';

export interface Entity {
    id: string;
    parentId: string | null; // Для иерархии (папки, инвентарь)
    /** Version of the normalized Entity/frontmatter contract. Missing legacy files are treated as current. */
    schemaVersion?: number;
    type: EntityType;
    name: string;
    description: string; // Markdown текст
    imageId?: string; // Заглушка или аватар для режима "Иконка"
    icon_url?: string; // Картинка сущности (отображается в окне и на токене)

    // Гибкая структура для характеристик. 
    // Пример: { strength: { base: 10 }, weight: { base: 5 } }
    // Flexible game-system payload; typed per block as mechanics stabilize.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties: Record<string, any>;

    // ID прикрепленных тегов
    tags: string[];

    /** Which database this entity belongs to (general = shared, user = personal inventory, gm = GM only) */
    database?: DatabaseType;
}

export interface ChatMessage {
    id: string;
    sender: string; // В идеале user ID или Имя персонажа
    text: string;
    timestamp: number;
    isSystem?: boolean; // Для бросков кубиков и уведомлений
}

export type AudioChannel = 'music' | 'ambience' | 'sfx' | 'voice';

export interface AudioSessionCommand {
    id: string;
    action: 'play' | 'stop';
    assetId: string;
    assetPath: string;
    assetName: string;
    channel?: AudioChannel;
    volume: number;
    duration?: number | null;
    loop?: boolean;
    fadeMs?: number;
    issuedAt: number;
    startedAt?: number;
    senderId?: string;
    senderName?: string;
}

export type SessionNotificationType = 'large-upload-approval';
export type SessionNotificationScope = 'gm' | 'player' | 'session';
export type SessionNotificationStatus = 'pending' | 'approved' | 'rejected' | 'uploading' | 'done' | 'failed';

export interface SessionNotificationEvent {
    id: string;
    type: SessionNotificationType;
    scope: SessionNotificationScope;
    status: SessionNotificationStatus;
    title: string;
    message?: string;
    actorId?: string;
    actorName?: string;
    targetPlayerId?: string;
    targetPlayerName?: string;
    responseById?: string;
    responseByName?: string;
    issuedAt: number;
    updatedAt?: number;
    payload?: Record<string, unknown>;
}
