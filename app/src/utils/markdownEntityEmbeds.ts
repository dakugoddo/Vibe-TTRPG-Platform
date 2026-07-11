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
