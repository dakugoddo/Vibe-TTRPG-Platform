export const ENTITY_DRAG_ID_MIME = 'application/entity-id';
export const ENTITY_DRAG_IDS_MIME = 'application/entity-ids';

export function readEntityDragIds(dataTransfer: DataTransfer): string[] {
  const rawIds = dataTransfer.getData(ENTITY_DRAG_IDS_MIME);
  if (rawIds) {
    try {
      const parsed = JSON.parse(rawIds);
      if (Array.isArray(parsed)) {
        return Array.from(new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)));
      }
    } catch {
      // Fall back to the single-entity payload below.
    }
  }

  const singleId = dataTransfer.getData(ENTITY_DRAG_ID_MIME);
  return singleId ? [singleId] : [];
}

export function writeEntityDragIds(dataTransfer: DataTransfer, entityIds: readonly string[]): void {
  const cleanIds = Array.from(new Set(entityIds.filter(id => id.length > 0)));
  if (cleanIds.length === 0) return;

  dataTransfer.setData(ENTITY_DRAG_ID_MIME, cleanIds[0]);
  dataTransfer.setData(ENTITY_DRAG_IDS_MIME, JSON.stringify(cleanIds));
}
