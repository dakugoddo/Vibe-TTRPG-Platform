import type { Entity } from '../types';

export function getTopLevelEntityIds(entityIds: readonly string[], entities: readonly Entity[]): string[] {
  const uniqueIds = Array.from(new Set(entityIds));
  const selectedIds = new Set(uniqueIds);
  const byId = new Map(entities.map(entity => [entity.id, entity]));

  return uniqueIds.filter((id) => {
    let parentId = byId.get(id)?.parentId;
    while (parentId) {
      if (selectedIds.has(parentId)) return false;
      parentId = byId.get(parentId)?.parentId;
    }
    return true;
  });
}
