import { yjsStore } from '../store/yjsStore';
import type { DatabaseType, Entity } from '../types';

export function getEntityOwnerId(entity: Entity): string | undefined {
  const owner = entity.properties?._playerOwner;
  return typeof owner === 'string' ? owner : undefined;
}

export function applyOwnerToEntityTree(rootId: string, ownerId: string | undefined): void {
  if (!ownerId) return;

  const queue = [rootId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);

    const entity = yjsStore.entitiesMap.get(id);
    if (!entity) continue;

    yjsStore.updateEntity(id, {
      properties: { ...entity.properties, _playerOwner: ownerId },
    });

    yjsStore.entitiesMap.forEach((candidate) => {
      if (candidate.parentId === id) queue.push(candidate.id);
    });
  }
}

export function moveEntityTreeToParent(
  rootId: string,
  parentId: string | null,
  targetDb: DatabaseType | undefined,
  options: { ownerId?: string; rootProperties?: Record<string, unknown> } = {}
): boolean {
  const root = yjsStore.entitiesMap.get(rootId);
  if (!root) return false;

  const nextDb = targetDb || root.database || 'general';
  const ids: string[] = [];
  const queue = [rootId];

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) continue;

    const entity = yjsStore.entitiesMap.get(id);
    if (!entity) return false;
    if (!yjsStore.canModify(entity.database, getEntityOwnerId(entity))) return false;

    ids.push(id);
    yjsStore.entitiesMap.forEach((candidate) => {
      if (candidate.parentId === id) queue.push(candidate.id);
    });
  }

  return ids.every((id, index) => {
    const entity = yjsStore.entitiesMap.get(id);
    if (!entity) return false;

    const patch: Partial<Entity> = { database: nextDb };
    const nextProperties = {
      ...entity.properties,
      ...(index === 0 ? options.rootProperties : {}),
      ...(options.ownerId ? { _playerOwner: options.ownerId } : {}),
    };

    if (index === 0) patch.parentId = parentId;
    patch.properties = nextProperties;

    return yjsStore.updateEntity(id, patch);
  });
}
