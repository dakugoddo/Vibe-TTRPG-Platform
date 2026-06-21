import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BarChart3, Dices, Lock, Package } from 'lucide-react';
import { EntityLink } from './EntityLink';
import { yjsStore } from '../../store/yjsStore';
import { rollEngine } from '../../services/rollEngine';
import { getEntitiesSnapshot, useEntitiesByParent, useEntity } from '../../hooks/useEntities';
import { glass } from '../../utils/theme';
import { createEntityRollVariableResolver } from '../../utils/rollVariables';
import type { Entity } from '../../types';

interface MarkdownRendererProps {
    content: string;
    entityId?: string;
    allowCustomBlocks?: boolean;
}

interface StatBlockRow {
    label?: string;
    labelKey?: string;
    path: string[];
}

const DEFAULT_STAT_ROWS: StatBlockRow[] = [
    { labelKey: 'markdownRenderer.stats.defaults.constitution', path: ['attributes', 'constitution'] },
    { labelKey: 'markdownRenderer.stats.defaults.cognition', path: ['attributes', 'cognition'] },
    { labelKey: 'markdownRenderer.stats.defaults.physique', path: ['attributes', 'physique'] },
    { labelKey: 'markdownRenderer.stats.defaults.mind', path: ['attributes', 'mind'] },
    { labelKey: 'markdownRenderer.stats.defaults.speed', path: ['attributes', 'speed'] },
    { labelKey: 'markdownRenderer.stats.defaults.hunger', path: ['attributes', 'hunger'] },
    { labelKey: 'markdownRenderer.stats.defaults.evasion', path: ['defense', 'evasion'] },
    { labelKey: 'markdownRenderer.stats.defaults.armor', path: ['defense', 'armor'] },
    { labelKey: 'markdownRenderer.stats.defaults.astral', path: ['power', 'astral'] },
    { labelKey: 'markdownRenderer.stats.defaults.ether', path: ['power', 'ether'] },
    { labelKey: 'markdownRenderer.stats.defaults.aura', path: ['power', 'aura'] },
];

const INVENTORY_CATEGORY_ORDER = ['оружие', 'броня', 'расходуемое', 'другое'] as const;
type InventoryCategory = (typeof INVENTORY_CATEGORY_ORDER)[number];

const INVENTORY_CATEGORY_LABEL_KEYS: Record<(typeof INVENTORY_CATEGORY_ORDER)[number], string> = {
    'оружие': 'markdownRenderer.inventory.categories.weapon',
    'броня': 'markdownRenderer.inventory.categories.armor',
    'расходуемое': 'markdownRenderer.inventory.categories.consumable',
    'другое': 'markdownRenderer.inventory.categories.other',
};

function normalizeKey(value: string): string {
    return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function getRecordValue(record: unknown, key: string): unknown {
    if (!record || typeof record !== 'object') return undefined;
    const source = record as Record<string, unknown>;
    const exact = source[key];
    if (exact !== undefined) return exact;

    const normalizedKey = normalizeKey(key);
    const entry = Object.entries(source).find(([entryKey]) => normalizeKey(entryKey) === normalizedKey);
    return entry?.[1];
}

function getNestedValue(source: unknown, path: string[]): unknown {
    return path.reduce<unknown>((current, segment) => getRecordValue(current, segment), source);
}

function coerceStatValue(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const rank = coerceStatValue(record.rank);
        if (rank !== null) return rank;

        const base = coerceStatValue(record.base) ?? 0;
        const adhoc = coerceStatValue(record.adhoc) ?? 0;
        if (record.base !== undefined || record.adhoc !== undefined) return base + adhoc;

        const valueField = coerceStatValue(record.value);
        if (valueField !== null) return valueField;
    }

    return null;
}

function resolveVariable(varName: string, contextEntity?: Entity): number {
    const allEntities = getEntitiesSnapshot();
    return createEntityRollVariableResolver(contextEntity, Object.values(allEntities))(varName) ?? 0;
}

function handleInlineRoll(
    expression: string,
    contextEntity: Entity | undefined,
    t: (key: string, options?: Record<string, unknown>) => string
) {
    const result = rollEngine.rollExpression(expression, {
        plainNumberAsD6Pool: true,
        resolveVariable: (variableName) => resolveVariable(variableName, contextEntity),
    });

    if (result.error) {
        yjsStore.sendMessage(t('markdownRenderer.rollError', { error: result.error }), t('chat.systemSender'), true);
        return;
    }

    yjsStore.sendMessage(rollEngine.formatRollMessage(expression, result), t('chat.systemSender'), true);
}

function parseWikiLinkTarget(source: string): { target: string; label?: string } {
    const [targetRaw, ...labelParts] = source.split('|');
    const target = targetRaw.trim();
    const label = labelParts.join('|').trim();
    return label ? { target, label } : { target };
}

function parseStatsBlockConfig(source: string): StatBlockRow[] {
    const lines = source
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

    if (lines.length === 0) return DEFAULT_STAT_ROWS;

    return lines.map((line) => {
        const delimiter = ['=', '|', ':'].find(char => line.includes(char));
        if (!delimiter) {
            return { label: line.split('.').at(-1) ?? line, path: line.split('.').map(part => part.trim()).filter(Boolean) };
        }

        const [leftRaw, ...rightParts] = line.split(delimiter);
        const left = leftRaw.trim();
        const right = rightParts.join(delimiter).trim();
        const leftLooksLikePath = left.includes('.');
        const path = (leftLooksLikePath ? left : right).split('.').map(part => part.trim()).filter(Boolean);
        const label = leftLooksLikePath ? right || path.at(-1) || left : left || path.at(-1) || right;

        return { label, path };
    }).filter(row => row.path.length > 0);
}

function readStat(entity: Entity, path: string[]): number | null {
    return coerceStatValue(getNestedValue(entity.properties, path));
}

function MarkdownStatsBlock({ entity, config }: { entity?: Entity; config: string }) {
    const { t } = useTranslation();

    if (!entity) {
        return (
            <div className={`${glass.blockBg} text-xs text-[var(--vibe-text-faint)]`}>
                {t('markdownRenderer.stats.availableInEntityWindow')}
            </div>
        );
    }

    const rows = parseStatsBlockConfig(config);
    const woundsCurrent = coerceStatValue(getNestedValue(entity.properties, ['attributes', 'wounds', 'current']));
    const woundsLimit = readStat(entity, ['attributes', 'wounds', 'limit']);

    return (
        <div className={`${glass.blockBg} my-3`}>
            <div className={`${glass.blockHeader} mb-3`}>
                <BarChart3 size={14} className="mr-2" />
                {t('markdownRenderer.stats.title', { name: entity.name })}
            </div>

            {(woundsCurrent !== null || woundsLimit !== null) && (
                <div className="mb-3 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-danger)_26%,transparent)] bg-[color-mix(in_srgb,var(--vibe-danger)_12%,transparent)] px-3 py-2 text-xs text-[var(--vibe-text-muted)]">
                    <span className="mr-2 font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('markdownRenderer.stats.wounds')}</span>
                    <span className="font-mono font-bold">{woundsCurrent ?? 0}</span>
                    {woundsLimit !== null && <span className="text-[var(--vibe-text-faint)]"> / {woundsLimit * 2}</span>}
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {rows.map(row => {
                    const value = readStat(entity, row.path);
                    const label = row.label ?? (row.labelKey ? t(row.labelKey) : row.path.at(-1) ?? '');
                    return (
                        <div key={`${label}:${row.path.join('.')}`} className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-3 py-2">
                            <div className="truncate text-[10px] uppercase tracking-wider text-[var(--vibe-text-faint)]">{label}</div>
                            <div className="font-mono text-lg font-bold text-[var(--vibe-text-primary)]">{value ?? '-'}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function MarkdownInventoryBlock({ entity, childrenEntities }: { entity?: Entity; childrenEntities: Entity[] }) {
    const { t } = useTranslation();

    if (!entity) {
        return (
            <div className={`${glass.blockBg} text-xs text-[var(--vibe-text-faint)]`}>
                {t('markdownRenderer.inventory.availableInEntityWindow')}
            </div>
        );
    }

    const inventory = childrenEntities.filter(child => child.type === 'object');
    const grouped = inventory.reduce<Record<string, Entity[]>>((acc, item) => {
        const category = String(item.properties?.category ?? 'другое').toLowerCase();
        const normalizedCategory: InventoryCategory = (INVENTORY_CATEGORY_ORDER as readonly string[]).includes(category)
            ? category as InventoryCategory
            : 'другое';
        acc[normalizedCategory] = [...(acc[normalizedCategory] ?? []), item];
        return acc;
    }, {});

    const totalWeight = inventory.reduce((total, item) => {
        const quantity = coerceStatValue(item.properties?.количество ?? item.properties?.quantity) ?? 1;
        const weight = coerceStatValue(item.properties?.нагрузка ?? item.properties?.weight) ?? 0;
        return total + quantity * weight;
    }, 0);

    return (
        <div className={`${glass.blockBg} my-3`}>
            <div className={`${glass.blockHeader} mb-3`}>
                <Package size={14} className="mr-2" />
                {t('markdownRenderer.inventory.title', { name: entity.name })}
                <span className="ml-auto font-mono normal-case tracking-normal text-[var(--vibe-text-faint)]">
                    {t('markdownRenderer.inventory.summary', { count: inventory.length, weight: totalWeight.toFixed(1) })}
                </span>
            </div>

            {inventory.length === 0 ? (
                <div className="text-xs italic text-[var(--vibe-text-faint)]">{t('markdownRenderer.inventory.empty')}</div>
            ) : (
                <div className="space-y-2">
                    {INVENTORY_CATEGORY_ORDER.map(category => {
                        const items = grouped[category] ?? [];
                        if (items.length === 0) return null;

                        return (
                            <div key={category} className="overflow-hidden rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)]">
                                <div className="bg-[var(--vibe-surface-header)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                    {t(INVENTORY_CATEGORY_LABEL_KEYS[category])} ({items.length})
                                </div>
                                <div className="divide-y divide-[var(--vibe-border-subtle)]">
                                    {items.map(item => {
                                        const quantity = coerceStatValue(item.properties?.количество ?? item.properties?.quantity) ?? 1;
                                        const equipped = Boolean(item.properties?.equipped);
                                        return (
                                            <div key={item.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                                                <EntityLink entityId={item.id} underline={false} className="truncate font-medium text-[var(--vibe-text-muted)] hover:text-[var(--vibe-text-primary)]" />
                                                {equipped && <span className="rounded bg-green-500/20 border border-green-500/30 px-1.5 py-0.5 text-[9px] text-green-300 uppercase">{t('markdownRenderer.inventory.equipped')}</span>}
                                                <span className="ml-auto font-mono text-[var(--vibe-text-faint)]">x{quantity}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function HiddenGmBlock() {
    const { t } = useTranslation();

    return (
        <div className="my-3 flex items-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-warning)_26%,transparent)] bg-[color-mix(in_srgb,var(--vibe-warning)_12%,transparent)] px-3 py-2 text-xs text-[var(--vibe-warning)]">
            <Lock size={13} />
            {t('markdownRenderer.gmOnly.hidden')}
        </div>
    );
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, entityId, allowCustomBlocks = true }) => {
    const { t } = useTranslation();
    const entity = useEntity(entityId ?? '');
    const childrenEntities = useEntitiesByParent(entityId ?? null);
    const isGm = yjsStore.localRole === 'gm';

    const processedContent = useMemo(() => content
        .replace(/!roll\s+([^\n]+)/g, (_match, expression: string) => {
            const trimmedExpression = expression.trim();
            return `[🎲 ${trimmedExpression}](#roll:${encodeURIComponent(trimmedExpression)})`;
        })
        .replace(/\[\[(.*?)\]\]/g, (_match, entityName: string) => {
            const { target, label } = parseWikiLinkTarget(entityName);
            return `[${label || target}](#entity:${encodeURIComponent(target)}${label ? `?label=${encodeURIComponent(label)}` : ''})`;
        }), [content]);

    const markdownComponents = useMemo<Components>(() => ({
        a: ({ href, children, ...props }) => {
            if (href?.startsWith('#roll:')) {
                const expression = decodeURIComponent(href.replace('#roll:', ''));
                return (
                    <button
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleInlineRoll(expression, entity, t);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/40 hover:text-violet-100 transition-all cursor-pointer align-baseline text-xs font-bold"
                        title={t('markdownRenderer.rollTitle', { expression })}
                    >
                        <Dices size={12} />
                        {children}
                    </button>
                );
            }

            if (href?.startsWith('#entity:')) {
                const raw = href.replace('#entity:', '');
                const [targetPart, labelPart] = raw.split('?label=');
                const target = decodeURIComponent(targetPart);
                const label = labelPart ? decodeURIComponent(labelPart) : undefined;
                const targetEntity = getEntitiesSnapshot()[target];
                if (targetEntity) {
                    return <EntityLink key={target} entityId={target}>{label ? children : undefined}</EntityLink>;
                }
                return <EntityLink key={target} entityName={target}>{label ? children : undefined}</EntityLink>;
            }

            return (
                <a {...props} href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--vibe-accent)] hover:underline">
                    {children}
                </a>
            );
        },
        h1: ({ children }) => <h1 className="mb-4 mt-6 border-b border-[var(--vibe-border-subtle)] pb-2 text-xl font-bold text-[var(--vibe-text-primary)]">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-3 mt-5 text-lg font-bold text-[var(--vibe-text-primary)]">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-2 mt-4 text-base font-bold text-[var(--vibe-text-muted)]">{children}</h3>,
        p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="mb-4 list-inside list-disc space-y-1 text-[var(--vibe-text-muted)] marker:text-[var(--vibe-text-faint)]">{children}</ul>,
        ol: ({ children }) => <ol className="mb-4 list-inside list-decimal space-y-1 text-[var(--vibe-text-muted)]">{children}</ol>,
        blockquote: ({ children }) => <blockquote className="mb-4 rounded-r border-l-4 border-[var(--vibe-border-strong)] bg-[var(--vibe-surface-input)] py-1 pl-4 italic text-[var(--vibe-text-muted)]">{children}</blockquote>,
        code: ({ className, children, ...props }) => {
            const language = /language-([\w-]+)/.exec(className ?? '')?.[1];
            const blockContent = String(children).replace(/\n$/, '');

            if (allowCustomBlocks && language === 'stats') {
                return <MarkdownStatsBlock entity={entity} config={blockContent} />;
            }

            if (allowCustomBlocks && language === 'inventory') {
                return <MarkdownInventoryBlock entity={entity} childrenEntities={childrenEntities} />;
            }

            if (allowCustomBlocks && language === 'gm-only') {
                if (!isGm) return <HiddenGmBlock />;
                return (
                    <div className="my-3 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-warning)_28%,transparent)] bg-[color-mix(in_srgb,var(--vibe-warning)_12%,transparent)] p-3">
                        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-warning)]">
                            <Lock size={12} />
                            {t('markdownRenderer.gmOnly.title')}
                        </div>
                        <MarkdownRenderer content={blockContent} entityId={entityId} allowCustomBlocks={false} />
                    </div>
                );
            }

            if (!className) {
                return (
                    <code className="rounded border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-1.5 py-0.5 font-mono text-xs text-[var(--vibe-text-muted)] shadow-[var(--vibe-shadow-block)]" {...props}>
                        {children}
                    </code>
                );
            }

            return (
                <pre className="mb-4 overflow-x-auto rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3 shadow-[var(--vibe-shadow-block)] custom-scrollbar">
                    <code className="font-mono text-xs text-[var(--vibe-success)]" {...props}>
                        {children}
                    </code>
                </pre>
            );
        },
        table: ({ children }) => <div className="mb-4 overflow-x-auto"><table className="w-full border-collapse text-left">{children}</table></div>,
        thead: ({ children }) => <thead className="border-b border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)]">{children}</thead>,
        th: ({ children }) => <th className="p-2 font-semibold text-xs uppercase tracking-wider">{children}</th>,
        td: ({ children }) => <td className="border-b border-[var(--vibe-border-subtle)] p-2 text-[var(--vibe-text-muted)]">{children}</td>,
        hr: () => <hr className="my-6 border-[var(--vibe-border-subtle)]" />,
    }), [allowCustomBlocks, childrenEntities, entity, entityId, isGm, t]);

    return (
        <div className="markdown-body text-sm leading-relaxed text-[var(--vibe-text-muted)]">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {processedContent}
            </ReactMarkdown>
        </div>
    );
};
