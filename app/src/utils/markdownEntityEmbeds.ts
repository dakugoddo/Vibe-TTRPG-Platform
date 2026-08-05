import type { Entity } from '../types';

interface MarkdownEntityEmbedTarget {
    target: string;
    label?: string;
}

function parseMarkdownEntityEmbedTarget(source: string): MarkdownEntityEmbedTarget {
    const [targetRaw, ...labelParts] = source.split('|');
    const target = targetRaw.trim();
    const label = labelParts.join('|').trim();
    return label ? { target, label } : { target };
}

export interface MarkdownEntityEmbedInsertion {
    text: string;
    selectStart: number;
    selectEnd: number;
}

export function createMarkdownEntityEmbedInsertion(selection: string): MarkdownEntityEmbedInsertion {
    const target = selection || 'entity-id';
    return {
        text: `![[${target}]]`,
        selectStart: 3,
        selectEnd: 3 + target.length,
    };
}

export function transformMarkdownEntityEmbeds(markdown: string): string {
    return markdown.replace(/!\[\[([^\]]+)\]\]/g, (_match, source: string) => {
        const { target, label } = parseMarkdownEntityEmbedTarget(source);
        const encodedTarget = encodeURIComponent(target);
        const encodedLabel = label ? `?label=${encodeURIComponent(label)}` : '';
        return `![${label || target}](#entity-embed:${encodedTarget}${encodedLabel})`;
    });
}

export function resolveMarkdownEntityEmbed(
    target: string,
    entities: readonly Entity[]
): Entity | undefined {
    const normalizedTarget = target.trim().toLowerCase();
    return entities.find((entity) => (
        entity.id.trim().toLowerCase() === normalizedTarget
        || entity.name.trim().toLowerCase() === normalizedTarget
    ));
}
