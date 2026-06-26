import { useMemo } from 'react';
import { useEntity, useEntitiesByIds } from '../hooks/useEntities';
import { getEntitySnapshot } from '../store/entityStore';

type StatModifierType = 'add' | 'multiply' | 'min' | 'max';
type StatRecord = Record<string, unknown>;

export interface StatBreakdown {
    source: string;
    value: number;
    type?: StatModifierType;
}

export interface CalculatedStat {
    total: number;
    base: number;
    breakdown: StatBreakdown[];
}

function isRecord(value: unknown): value is StatRecord {
    return typeof value === 'object' && value !== null;
}

function toNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || 0;
    return 0;
}

function getNestedValue(obj: unknown, path: string[]): unknown {
    return path.reduce<unknown>((current, segment) => {
        if (!isRecord(current)) return null;
        return current[segment] !== undefined ? current[segment] : null;
    }, obj);
}

function normalizeModifierType(value: unknown): StatModifierType {
    if (value === 'add' || value === 'multiply' || value === 'min' || value === 'max') return value;
    return 'add';
}

export function useCalculatedStat(entityId: string, statPath: string[]): CalculatedStat {
    const targetEntity = useEntity(entityId);
    const tagIds = targetEntity?.tags || [];
    const tagEntities = useEntitiesByIds(tagIds);

    return useMemo(() => {
        if (!targetEntity) return { total: 0, base: 0, breakdown: [] };

        let baseValue = getNestedValue(targetEntity.properties, statPath);
        let parsedBase = 0;
        let adhocModifier = 0;

        if (isRecord(baseValue)) {
            parsedBase = toNumber(baseValue.base);
            adhocModifier = toNumber(baseValue.adhoc);
            baseValue = parsedBase;
        } else {
            parsedBase = toNumber(baseValue);

            if (statPath.length > 0) {
                const parentPath = statPath.slice(0, -1);
                const parentObj = getNestedValue(targetEntity.properties, parentPath);
                const leafKey = statPath[statPath.length - 1];

                if (leafKey === 'base' && isRecord(parentObj)) {
                    adhocModifier = toNumber(parentObj.adhoc);
                }
            }
        }

        const breakdown: StatBreakdown[] = [
            { source: 'Базовое значение', value: parsedBase, type: 'add' },
        ];

        let total = parsedBase;

        if (adhocModifier !== 0) {
            total += adhocModifier;
            breakdown.push({ source: 'Доп. модификатор', value: adhocModifier, type: 'add' });
        }

        const statPathString = statPath.join('.');
        const activeModifiers: { source: string; value: number; type: StatModifierType }[] = [];

        for (const tag of tagEntities) {
            if (tag.type !== 'tag' || !Array.isArray(tag.properties?.modifiers)) continue;

            for (const mod of tag.properties.modifiers) {
                if (!isRecord(mod)) continue;

                const modPathStr = Array.isArray(mod.path) ? mod.path.join('.') : mod.path;
                if (modPathStr !== statPathString) continue;

                activeModifiers.push({
                    source: `Свойство: ${tag.name}`,
                    value: toNumber(mod.value),
                    type: normalizeModifierType(mod.type),
                });
            }
        }

        if (parsedBase === 0 && adhocModifier === 0 && activeModifiers.length === 0 && targetEntity.parentId) {
            let current = getEntitySnapshot(targetEntity.parentId);
            while (current) {
                const parentValue = getNestedValue(current.properties, statPath);
                if (parentValue !== null && parentValue !== undefined) {
                    const parentBase = isRecord(parentValue) ? toNumber(parentValue.base) : toNumber(parentValue);
                    if (parentBase !== 0) {
                        total = parentBase;
                        breakdown[0] = { source: `Наследовано: ${current.name}`, value: parentBase, type: 'add' };
                        break;
                    }
                }
                current = current.parentId ? getEntitySnapshot(current.parentId) : undefined;
            }
        }

        for (const mod of activeModifiers.filter(m => m.type === 'add')) {
            total += mod.value;
            breakdown.push(mod);
        }

        for (const mod of activeModifiers.filter(m => m.type === 'multiply')) {
            total *= mod.value;
            breakdown.push(mod);
        }

        for (const mod of activeModifiers.filter(m => m.type === 'min')) {
            if (total < mod.value) {
                total = mod.value;
                breakdown.push({ ...mod, source: `${mod.source} (Минимум)` });
            } else {
                breakdown.push({ ...mod, source: `${mod.source} (Минимум не достигнут)` });
            }
        }

        for (const mod of activeModifiers.filter(m => m.type === 'max')) {
            if (total > mod.value) {
                total = mod.value;
                breakdown.push({ ...mod, source: `${mod.source} (Максимум)` });
            } else {
                breakdown.push({ ...mod, source: `${mod.source} (Максимум не достигнут)` });
            }
        }

        return {
            total: Math.floor(total),
            base: parsedBase,
            breakdown,
        };
    }, [targetEntity, tagEntities, statPath]);
}
