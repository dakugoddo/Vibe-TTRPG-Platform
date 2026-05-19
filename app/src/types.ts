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
