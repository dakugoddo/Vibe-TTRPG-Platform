import type { Entity } from '../types';

export interface NotesWorkspaceEmbeddedEntityNode {
  entity: Entity;
  depth: number;
  children: NotesWorkspaceEmbeddedEntityNode[];
}

export function buildNotesWorkspaceEmbeddedEntityTree(
  root: Entity,
  visibleEntities: readonly Entity[],
  maxDepth = 4
): NotesWorkspaceEmbeddedEntityNode[] {
  const childrenByParent = new Map<string, Entity[]>();

  for (const entity of visibleEntities) {
    if (!entity.parentId || entity.id === root.id) continue;
    const children = childrenByParent.get(entity.parentId) ?? [];
    children.push(entity);
    childrenByParent.set(entity.parentId, children);
  }

  for (const children of Array.from(childrenByParent.values())) {
    children.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
  }

  const build = (parentId: string, depth: number, ancestors: Set<string>): NotesWorkspaceEmbeddedEntityNode[] => {
    if (depth > maxDepth) return [];

    return (childrenByParent.get(parentId) ?? [])
      .filter((entity) => !ancestors.has(entity.id))
      .map((entity) => {
        const nextAncestors = new Set(ancestors);
        nextAncestors.add(entity.id);
        return {
          entity,
          depth,
          children: build(entity.id, depth + 1, nextAncestors),
        };
      });
  };

  return build(root.id, 0, new Set([root.id]));
}

export function filterNotesWorkspaceEmbeddedEntityTree(
  nodes: readonly NotesWorkspaceEmbeddedEntityNode[],
  collapsedEntityIds: ReadonlySet<string>
): NotesWorkspaceEmbeddedEntityNode[] {
  return nodes.map((node) => ({
    ...node,
    children: collapsedEntityIds.has(node.entity.id)
      ? []
      : filterNotesWorkspaceEmbeddedEntityTree(node.children, collapsedEntityIds),
  }));
}
