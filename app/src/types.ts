export type EntityType = 'character' | 'object' | 'ability' | 'tag' | 'canvas' | 'note' | 'portal' | 'folder' | 'attack';
export type DatabaseType = 'general' | 'user' | 'gm';

export interface Entity {
    id: string;
    parentId: string | null; // Для иерархии (папки, инвентарь)
    type: EntityType;
    name: string;
    description: string; // Markdown текст
    imageId?: string; // Заглушка или аватар для режима "Иконка"
    icon_url?: string; // Картинка сущности (отображается в окне и на токене)

    // Гибкая структура для характеристик. 
    // Пример: { strength: { base: 10 }, weight: { base: 5 } }
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
