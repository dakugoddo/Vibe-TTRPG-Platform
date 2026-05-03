import { useMemo } from 'react';
import { useEntity, useEntitiesByIds } from '../hooks/useEntities';
import { getEntitySnapshot } from '../store/entityStore';

export interface StatBreakdown {
    source: string;
    value: number;
    type?: 'add' | 'multiply' | 'min' | 'max';
}

export interface CalculatedStat {
    total: number;
    base: number;
    breakdown: StatBreakdown[];
}

// Helper to safely get nested object properties by string array path
const getNestedValue = (obj: any, path: string[]) => {
    return path.reduce((xs, x) => (xs && xs[x] !== undefined) ? xs[x] : null, obj);
};

export function useCalculatedStat(entityId: string, statPath: string[]): CalculatedStat {
    // Only subscribe to the specific entity
    const targetEntity = useEntity(entityId);
    // Subscribe to tag entities by their IDs (granular)
    const tagIds = targetEntity?.tags || [];
    const tagEntities = useEntitiesByIds(tagIds);

    return useMemo(() => {
        if (!targetEntity) return { total: 0, base: 0, breakdown: [] };

        // 1. Get base value
        let baseValue = getNestedValue(targetEntity.properties, statPath);

        // Handle case where properties like `hp` is an object `{base: 10}` instead of just a number.
        let parsedBase = 0;
        let adhocModifier = 0;

        if (typeof baseValue === 'object' && baseValue !== null) {
            parsedBase = typeof baseValue.base === 'number' ? baseValue.base : (parseFloat(baseValue.base) || 0);
            adhocModifier = typeof baseValue.adhoc === 'number' ? baseValue.adhoc : (parseFloat(baseValue.adhoc) || 0);
            baseValue = parsedBase;
        } else {
            parsedBase = typeof baseValue === 'number' ? baseValue : (parseFloat(baseValue) || 0);

            // If statPath was pointing specifically to the scalar, check if an adhoc exists on the parent
            if (statPath.length > 0) {
                const parentPath = statPath.slice(0, -1);
                const parentObj = getNestedValue(targetEntity.properties, parentPath);
                const leafKey = statPath[statPath.length - 1];

                if (leafKey === 'base' && typeof parentObj === 'object' && parentObj !== null) {
                    adhocModifier = typeof parentObj.adhoc === 'number' ? parentObj.adhoc : (parseFloat(parentObj.adhoc) || 0);
                }
            }
        }

        const breakdown: StatBreakdown[] = [
            { source: 'Базовое значение', value: parsedBase, type: 'add' }
        ];

        let total = parsedBase;

        if (adhocModifier !== 0) {
            total += adhocModifier;
            breakdown.push({ source: 'Доп. модификатор', value: adhocModifier, type: 'add' });
        }

        // 2. Apply tag modifiers — using only the tag entities we subscribed to
        const statPathString = statPath.join('.');

        const activeModifiers: { source: string, value: number, type: 'add' | 'multiply' | 'min' | 'max' }[] = [];

        for (const tag of tagEntities) {
            if (tag.type !== 'tag') continue;
            if (tag.properties?.modifiers) {
                for (const mod of tag.properties.modifiers || []) {
                    const modPathStr = Array.isArray(mod.path) ? mod.path.join('.') : mod.path;

                    if (modPathStr === statPathString) {
                        const modValue = typeof mod.value === 'number' ? mod.value : (parseFloat(mod.value) || 0);
                        const modType = mod.type || 'add';

                        activeModifiers.push({
                            source: `Свойство: ${tag.name}`,
                            value: modValue,
                            type: modType as 'add' | 'multiply' | 'min' | 'max'
                        });
                    }
                }
            }
        }

        // Context bubbling: if stat not found locally, walk up parentId chain
        if (parsedBase === 0 && adhocModifier === 0 && activeModifiers.length === 0 && targetEntity.parentId) {
            let current = getEntitySnapshot(targetEntity.parentId);
            while (current) {
                const parentValue = getNestedValue(current.properties, statPath);
                if (parentValue !== null && parentValue !== undefined) {
                    const parentBase = typeof parentValue === 'object' && parentValue !== null
                        ? (typeof parentValue.base === 'number' ? parentValue.base : (parseFloat(parentValue.base) || 0))
                        : (typeof parentValue === 'number' ? parentValue : (parseFloat(parentValue) || 0));
                    if (parentBase !== 0) {
                        total = parentBase;
                        breakdown[0] = { source: `Наследовано: ${current.name}`, value: parentBase, type: 'add' };
                        break;
                    }
                }
                current = current.parentId ? getEntitySnapshot(current.parentId) : undefined;
            }
        }

        // Order of operations: additions → multiplications → limits
        const additions = activeModifiers.filter(m => m.type === 'add');
        for (const mod of additions) {
            total += mod.value;
            breakdown.push(mod);
        }

        const multiplications = activeModifiers.filter(m => m.type === 'multiply');
        for (const mod of multiplications) {
            total *= mod.value;
            breakdown.push(mod);
        }

        const mins = activeModifiers.filter(m => m.type === 'min');
        for (const mod of mins) {
            if (total < mod.value) {
                total = mod.value;
                breakdown.push({ ...mod, source: `${mod.source} (Минимум)` });
            } else {
                breakdown.push({ ...mod, source: `${mod.source} (Минимум не достигнут)` });
            }
        }

        const maxs = activeModifiers.filter(m => m.type === 'max');
        for (const mod of maxs) {
            if (total > mod.value) {
                total = mod.value;
                breakdown.push({ ...mod, source: `${mod.source} (Максимум)` });
            } else {
                breakdown.push({ ...mod, source: `${mod.source} (Максимум не достигнут)` });
            }
        }

        total = Math.floor(total);

        return {
            total,
            base: parsedBase,
            breakdown
        };
    }, [targetEntity, tagEntities, statPath]);
}
