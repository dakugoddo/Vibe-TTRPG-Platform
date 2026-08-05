import type { ComponentType } from 'react';
import type { Entity } from '../../types';
import { resolveEntitySheetBinding } from '../../utils/entitySheetBinding';
import { getEntitySheetBlockDefinition } from '../../utils/entitySheetRegistry';
import type {
    EntitySheetSchemaV1,
    SheetBlockV1,
    SheetContainerBlockV1,
    SheetPropertyValueBlockV1,
} from '../../utils/entitySheetSchema';

export interface EntitySheetMarkdownRendererProps {
    content: string;
    entityId: string;
}

interface EntitySheetRendererProps {
    entity: Entity;
    schema: EntitySheetSchemaV1;
    markdownRenderer: ComponentType<EntitySheetMarkdownRendererProps>;
}

function formatValue(value: unknown, format: SheetPropertyValueBlockV1['format']): string {
    if (format === 'json') return JSON.stringify(value, null, 2);
    if (format === 'boolean') return value ? 'Yes' : 'No';
    if (format === 'number' && typeof value === 'number') return String(value);
    return typeof value === 'string' ? value : String(value);
}

function containerClass(block: SheetContainerBlockV1): string {
    if (block.layout === 'row') return 'flex flex-wrap';
    if (block.layout === 'grid') return 'grid grid-cols-1 md:grid-cols-2';
    return 'grid';
}

function renderBlock(
    entity: Entity,
    block: SheetBlockV1,
    MarkdownContent: ComponentType<EntitySheetMarkdownRendererProps>
) {
    const definition = getEntitySheetBlockDefinition(block.type);
    if (!definition) {
        return <div key={block.id} role="status" className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-danger)] p-[var(--vibe-space-block)] text-xs text-[var(--vibe-danger)]">Unknown block</div>;
    }

    if (block.type === 'container') {
        return (
            <div
                key={block.id}
                data-entity-sheet-block={block.id}
                className={`${containerClass(block)} gap-[var(--vibe-space-gap)]`}
            >
                {block.children.map((child) => renderBlock(entity, child, MarkdownContent))}
            </div>
        );
    }

    const resolution = resolveEntitySheetBinding(entity, block.binding);
    if (block.type === 'markdown') {
        const content = resolution.status === 'resolved' && typeof resolution.value === 'string'
            ? resolution.value
            : '';
        return (
            <article
                key={block.id}
                data-entity-sheet-block={block.id}
                className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] p-[var(--vibe-space-block)]"
            >
                {block.label && <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--vibe-text-muted)]">{block.label}</h3>}
                {content.trim() ? (
                    <MarkdownContent content={content} entityId={entity.id} />
                ) : (
                    <p className="text-sm italic text-[var(--vibe-text-faint)]">{block.emptyText ?? '—'}</p>
                )}
            </article>
        );
    }

    const value = resolution.status === 'resolved'
        ? formatValue(resolution.value, block.format)
        : (block.emptyText ?? '—');

    return (
        <div
            key={block.id}
            data-entity-sheet-block={block.id}
            className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] p-[var(--vibe-space-block)]"
        >
            {block.label && <div className="text-xs text-[var(--vibe-text-muted)]">{block.label}</div>}
            <div className="text-sm text-[var(--vibe-text-primary)]">{value}</div>
        </div>
    );
}

export function EntitySheetRenderer({ entity, schema, markdownRenderer }: EntitySheetRendererProps) {
    return (
        <section data-entity-sheet-schema={schema.id} className="text-[length:var(--vibe-font-scale)]">
            {renderBlock(entity, schema.root, markdownRenderer)}
        </section>
    );
}
