import type { DatabaseType, EntityType } from '../types';
import type { UserRole } from './permissions';

export type EntityStorageSlot =
  | 'canvas'
  | 'inventory'
  | 'abilities'
  | 'competencies'
  | 'attacks'
  | 'tags'
  | 'children';

export type EntityDropActionId =
  | 'place-token'
  | 'place-card'
  | 'copy-entity'
  | 'move-entity';

export interface EntityDropSource {
  id: string;
  type: EntityType;
  database?: DatabaseType;
  parentId?: string | null;
}

export type EntityDropTarget =
  | { kind: 'canvas'; canvasId: string }
  | { kind: 'entity'; entityId: string; entityType: EntityType; slot?: EntityStorageSlot }
  | { kind: 'database'; database: DatabaseType; parentId: string | null; parentType?: EntityType };

export interface EntityDropContext {
  role: UserRole;
  canModifySource: boolean;
  canModifyTarget: boolean;
}

export interface EntityDropAction {
  id: EntityDropActionId;
  label: string;
  slot: EntityStorageSlot;
  requiresGm?: boolean;
}

const CANVAS_PLACEMENT_ACTIONS: EntityDropAction[] = [
  { id: 'place-token', label: 'Фишка', slot: 'canvas' },
  { id: 'place-card', label: 'Карточка', slot: 'canvas' },
];

const COPY_LABEL_BY_SLOT: Record<EntityStorageSlot, string> = {
  canvas: 'Копировать на канвас',
  inventory: 'Копировать в инвентарь',
  abilities: 'Копировать в способности',
  competencies: 'Копировать в компетенции',
  attacks: 'Копировать в атаки',
  tags: 'Добавить тег',
  children: 'Копировать сюда',
};

const MOVE_LABEL_BY_SLOT: Record<EntityStorageSlot, string> = {
  canvas: 'Переместить на канвас',
  inventory: 'Переместить в инвентарь',
  abilities: 'Переместить в способности',
  competencies: 'Переместить в компетенции',
  attacks: 'Переместить в атаки',
  tags: 'Переместить тег',
  children: 'Переместить сюда',
};

export function resolveEntityStorageSlot(sourceType: EntityType, target: EntityDropTarget): EntityStorageSlot | null {
  if (target.kind === 'canvas') return 'canvas';
  if (target.kind === 'database') return 'children';

  if (target.slot) return target.slot;

  if (target.entityType === 'character') {
    if (sourceType === 'object') return 'inventory';
    if (sourceType === 'ability') return 'abilities';
    if (sourceType === 'competency') return 'competencies';
    if (sourceType === 'tag') return 'tags';
    return null;
  }

  if (target.entityType === 'object') {
    if (sourceType === 'attack') return 'attacks';
    if (sourceType === 'tag') return 'tags';
    return null;
  }

  if (target.entityType === 'folder' || target.entityType === 'canvas') {
    return 'children';
  }

  return null;
}

export function getEntityDropActions(
  source: EntityDropSource,
  target: EntityDropTarget,
  context: EntityDropContext
): EntityDropAction[] {
  if (target.kind === 'entity' && target.entityId === source.id) return [];

  const slot = resolveEntityStorageSlot(source.type, target);
  if (!slot) return [];

  const actions: EntityDropAction[] = [];

  if (target.kind === 'canvas') {
    actions.push(...CANVAS_PLACEMENT_ACTIONS);
  }

  if (context.canModifyTarget) {
    actions.push({
      id: 'copy-entity',
      label: COPY_LABEL_BY_SLOT[slot],
      slot,
    });
  }

  if (context.role === 'gm' && context.canModifySource && context.canModifyTarget) {
    actions.push({
      id: 'move-entity',
      label: MOVE_LABEL_BY_SLOT[slot],
      slot,
      requiresGm: true,
    });
  }

  return actions;
}

export function hasEntityDropActions(
  source: EntityDropSource,
  target: EntityDropTarget,
  context: EntityDropContext
): boolean {
  return getEntityDropActions(source, target, context).length > 0;
}
