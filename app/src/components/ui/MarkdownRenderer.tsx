import { useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BarChart3, Dices, Lock, Package } from 'lucide-react';
import { EntityLink } from './EntityLink';
import { yjsStore } from '../../store/yjsStore';
import { rollEngine } from '../../services/rollEngine';
import { getEntitiesSnapshot, useEntitiesByParent, useEntity } from '../../hooks/useEntities';
import { glass } from '../../utils/theme';
import type { Entity } from '../../types';

interface MarkdownRendererProps {
    content: string;
    entityId?: string;
    allowCustomBlocks?: boolean;
}

interface ResolvedRollExpression {
    diceCount: number;
    faces: number;
    modifier: number;
    resolvedExpr: string;
}

interface StatBlockRow {
    label: string;
    path: string[];
}

const DEFAULT_STAT_ROWS: StatBlockRow[] = [
    { label: 'Телосложение', path: ['attributes', 'constitution'] },
    { label: 'Когниция', path: ['attributes', 'cognition'] },
    { label: 'Фигура', path: ['attributes', 'physique'] },
    { label: 'Мышление', path: ['attributes', 'mind'] },
    { label: 'Скорость', path: ['attributes', 'speed'] },
    { label: 'Голод', path: ['attributes', 'hunger'] },
    { label: 'Уклонение', path: ['defense', 'evasion'] },
    { label: 'Броня', path: ['defense', 'armor'] },
    { label: 'Астрал', path: ['power', 'astral'] },
    { label: 'Эфир', path: ['power', 'ether'] },
    { label: 'Аура', path: ['power', 'aura'] },
];

const INVENTORY_CATEGORY_ORDER = ['оружие', 'броня', 'расходуемое', 'другое'];

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

function findNamedNumericValue(source: unknown, desiredKey: string, depth = 0): number | null {
    if (!source || typeof source !== 'object' || depth > 5) return null;

    const record = source as Record<string, unknown>;
    const direct = getRecordValue(record, desiredKey);
    const directValue = coerceStatValue(direct);
    if (directValue !== null) return directValue;

    for (const [key, value] of Object.entries(record)) {
        if (normalizeKey(key) === normalizeKey(desiredKey)) {
            const valueNumber = coerceStatValue(value);
            if (valueNumber !== null) return valueNumber;
        }
    }

    for (const value of Object.values(record)) {
        const nested = findNamedNumericValue(value, desiredKey, depth + 1);
        if (nested !== null) return nested;
    }

    return null;
}

function resolveVariable(varName: string, contextEntity?: Entity): number {
    const allEntities = getEntitiesSnapshot();
    const candidates = [
        ...(contextEntity ? [contextEntity] : []),
        ...Object.values(allEntities).filter(entity => entity.id !== contextEntity?.id),
    ];

    for (const entity of candidates) {
        const skills = getRecordValue(entity.properties, 'skills');
        const skillValue = findNamedNumericValue(skills, varName);
        if (skillValue !== null) return skillValue;

        const propertyValue = findNamedNumericValue(entity.properties, varName);
        if (propertyValue !== null) return propertyValue;
    }

    return 0;
}

function resolveRollExpression(expression: string, contextEntity?: Entity): ResolvedRollExpression | null {
    let resolved = expression.trim().replace(/\s+/g, '');
    resolved = resolved.replace(/\$(\w+)/g, (_match, varName: string) => String(resolveVariable(varName, contextEntity)));

    const diceMatch = resolved.match(/^(\d*)d(\d+)((?:[+-]\d+)*)$/i);
    if (diceMatch) {
        const modifierPart = diceMatch[3] ?? '';
        const modifier = Array.from(modifierPart.matchAll(/[+-]\d+/g))
            .reduce((total, match) => total + Number(match[0]), 0);

        return {
            diceCount: diceMatch[1] ? Number(diceMatch[1]) : 1,
            faces: Number(diceMatch[2]),
            modifier,
            resolvedExpr: resolved,
        };
    }

    const poolCount = Number(resolved);
    if (Number.isInteger(poolCount) && poolCount > 0) {
        return {
            diceCount: poolCount,
            faces: 6,
            modifier: 0,
            resolvedExpr: `${poolCount}d6`,
        };
    }

    return null;
}

function handleInlineRoll(expression: string, contextEntity?: Entity) {
    const resolved = resolveRollExpression(expression, contextEntity);
    if (!resolved || resolved.diceCount <= 0) {
        yjsStore.sendMessage(`Ошибка броска: ${expression}`, 'Система', true);
        return;
    }

    const notation = `${resolved.diceCount}d${resolved.faces}${resolved.modifier !== 0 ? `${resolved.modifier > 0 ? '+' : ''}${resolved.modifier}` : ''}`;
    const result = resolved.faces === 6 && resolved.modifier === 0
        ? rollEngine.rollD6Pool(resolved.diceCount, expression.trim())
        : rollEngine.rollDiceNotation(notation);

    if (result && !result.error) {
        yjsStore.sendMessage(rollEngine.formatRollMessage(expression, result), 'Система', true);
        return;
    }

    yjsStore.sendMessage(`Ошибка броска: ${result?.error ?? resolved.resolvedExpr}`, 'Система', true);
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
    if (!entity) {
        return (
            <div className={`${glass.blockBg} text-xs text-white/40`}>
                Блок stats доступен внутри окна сущности.
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
                Статы: {entity.name}
            </div>

            {(woundsCurrent !== null || woundsLimit !== null) && (
                <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-white/80">
                    <span className="text-white/40 uppercase tracking-wider font-bold mr-2">Раны</span>
                    <span className="font-mono font-bold">{woundsCurrent ?? 0}</span>
                    {woundsLimit !== null && <span className="text-white/40"> / {woundsLimit * 2}</span>}
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {rows.map(row => {
                    const value = readStat(entity, row.path);
                    return (
                        <div key={`${row.label}:${row.path.join('.')}`} className="rounded-lg bg-white/5 border border-white/5 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-white/35 truncate">{row.label}</div>
                            <div className="text-lg font-bold text-white font-mono">{value ?? '-'}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function MarkdownInventoryBlock({ entity, childrenEntities }: { entity?: Entity; childrenEntities: Entity[] }) {
    if (!entity) {
        return (
            <div className={`${glass.blockBg} text-xs text-white/40`}>
                Блок inventory доступен внутри окна сущности.
            </div>
        );
    }

    const inventory = childrenEntities.filter(child => child.type === 'object');
    const grouped = inventory.reduce<Record<string, Entity[]>>((acc, item) => {
        const category = String(item.properties?.category ?? 'другое').toLowerCase();
        const normalizedCategory = INVENTORY_CATEGORY_ORDER.includes(category) ? category : 'другое';
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
                Инвентарь: {entity.name}
                <span className="ml-auto text-white/35 font-mono normal-case tracking-normal">
                    {inventory.length} / вес {totalWeight.toFixed(1)}
                </span>
            </div>

            {inventory.length === 0 ? (
                <div className="text-xs text-white/35 italic">Инвентарь пуст.</div>
            ) : (
                <div className="space-y-2">
                    {INVENTORY_CATEGORY_ORDER.map(category => {
                        const items = grouped[category] ?? [];
                        if (items.length === 0) return null;

                        return (
                            <div key={category} className="rounded-lg border border-white/5 bg-black/20 overflow-hidden">
                                <div className="px-3 py-1.5 bg-white/5 text-[10px] uppercase tracking-wider text-white/40 font-bold">
                                    {category} ({items.length})
                                </div>
                                <div className="divide-y divide-white/5">
                                    {items.map(item => {
                                        const quantity = coerceStatValue(item.properties?.количество ?? item.properties?.quantity) ?? 1;
                                        const equipped = Boolean(item.properties?.equipped);
                                        return (
                                            <div key={item.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                                                <EntityLink entityId={item.id} underline={false} className="text-white/80 hover:text-white font-medium truncate" />
                                                {equipped && <span className="rounded bg-green-500/20 border border-green-500/30 px-1.5 py-0.5 text-[9px] text-green-300 uppercase">экип.</span>}
                                                <span className="ml-auto font-mono text-white/45">x{quantity}</span>
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
    return (
        <div className="my-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/70 flex items-center gap-2">
            <Lock size={13} />
            Скрытый блок ГМа
        </div>
    );
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, entityId, allowCustomBlocks = true }) => {
    const entity = useEntity(entityId ?? '');
    const childrenEntities = useEntitiesByParent(entityId ?? null);
    const isGm = yjsStore.localRole === 'gm';

    const processedContent = useMemo(() => content
        .replace(/!roll\s+([^\n]+)/g, (_match, expression: string) => {
            const trimmedExpression = expression.trim();
            return `[🎲 ${trimmedExpression}](#roll:${encodeURIComponent(trimmedExpression)})`;
        })
        .replace(/\[\[(.*?)\]\]/g, (_match, entityName: string) => {
            return `[${entityName}](#entity:${encodeURIComponent(entityName)})`;
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
                            handleInlineRoll(expression, entity);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/40 hover:text-violet-100 transition-all cursor-pointer align-baseline text-xs font-bold"
                        title={`Бросить ${expression}`}
                    >
                        <Dices size={12} />
                        {children}
                    </button>
                );
            }

            if (href?.startsWith('#entity:')) {
                const entityName = decodeURIComponent(href.replace('#entity:', ''));
                return <EntityLink key={entityName} entityName={entityName}>{children}</EntityLink>;
            }

            return (
                <a {...props} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                    {children}
                </a>
            );
        },
        h1: ({ children }) => <h1 className="text-xl font-bold text-white mb-4 mt-6 pb-2 border-b border-gray-800">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-bold text-gray-200 mb-3 mt-5">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-bold text-gray-300 mb-2 mt-4">{children}</h3>,
        p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1 text-gray-300 marker:text-white/60">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1 text-gray-300">{children}</ol>,
        blockquote: ({ children }) => <blockquote className="border-l-4 border-white/20 pl-4 py-1 italic bg-white/10 text-gray-400 mb-4 rounded-r">{children}</blockquote>,
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
                    <div className="my-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3">
                        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-amber-200/60 font-bold">
                            <Lock size={12} />
                            Только для ГМа
                        </div>
                        <MarkdownRenderer content={blockContent} entityId={entityId} allowCustomBlocks={false} />
                    </div>
                );
            }

            if (!className) {
                return (
                    <code className="bg-black/30 text-white/70 px-1.5 py-0.5 rounded text-xs font-mono border border-white/5 shadow-inner" {...props}>
                        {children}
                    </code>
                );
            }

            return (
                <pre className="bg-[#0a0c10]/80 p-3 rounded-md border border-white/10 shadow-inner overflow-x-auto mb-4 custom-scrollbar backdrop-blur-sm">
                    <code className="text-xs text-green-400 font-mono" {...props}>
                        {children}
                    </code>
                </pre>
            );
        },
        table: ({ children }) => <div className="overflow-x-auto mb-4"><table className="w-full text-left border-collapse">{children}</table></div>,
        thead: ({ children }) => <thead className="bg-black/30 text-emerald-200/50 border-b border-white/10">{children}</thead>,
        th: ({ children }) => <th className="p-2 font-semibold text-xs uppercase tracking-wider">{children}</th>,
        td: ({ children }) => <td className="p-2 border-b border-gray-800/50 text-gray-300">{children}</td>,
        hr: () => <hr className="border-gray-800 my-6" />,
    }), [allowCustomBlocks, childrenEntities, entity, entityId, isGm]);

    return (
        <div className="markdown-body text-gray-300 leading-relaxed text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {processedContent}
            </ReactMarkdown>
        </div>
    );
};
