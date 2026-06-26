import { yjsStore } from '../store/yjsStore';
import type { Entity } from '../types';
import { getEntityActionRollFormula, type EntityActionRollKind } from '../utils/entityActionRollModel';
import { createEntityRollVariableResolver } from '../utils/rollVariables';
import { rollEngine } from './rollEngine';

export interface EntityActionRollResult {
    ok: boolean;
    formula: string;
    error?: string;
}

export function rollEntityActionToChat(
    entity: Entity,
    kind: EntityActionRollKind,
    relatedEntities: Entity[] = [],
): EntityActionRollResult {
    const formula = getEntityActionRollFormula(entity, kind);
    if (!formula) {
        return { ok: false, formula, error: 'Укажите формулу броска.' };
    }

    const result = rollEngine.rollExpression(formula, {
        plainNumberAsD6Pool: kind === 'attack',
        resolveVariable: createEntityRollVariableResolver(entity, relatedEntities),
    });

    if (result.error) {
        yjsStore.sendMessage(`Ошибка броска ${entity.name}: ${result.error}`, 'Система', true);
        return { ok: false, formula, error: result.error };
    }

    yjsStore.sendMessage(rollEngine.formatRollMessage(`${entity.name}: ${formula}`, result), 'Система', true);
    return { ok: true, formula };
}
