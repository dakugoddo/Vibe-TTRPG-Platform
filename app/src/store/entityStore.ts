import { useMemo } from 'react';
import { create } from 'zustand';
import { yjsStore } from './yjsStore';
import type { Entity, EntityType } from '../types';

/**
 * Centralized Zustand store for entities, synced from Yjs.
 * Unlike the old useEntities() hook which created a new array on every Y.Map change,
 * this store allows granular subscriptions via selectors.
 */
interface EntityStoreState {
    /** All entities keyed by id */
    entities: Record<string, Entity>;
}

export const useEntityStore = create<EntityStoreState>(() => ({
    entities: {},
}));

/** Initialize the observer — call once after Yjs is ready */
export function initEntityStoreObserver() {
    const syncFromYjs = () => {
        const raw: Record<string, Entity> = {};
        yjsStore.entitiesMap.forEach((val, key) => {
            raw[key] = val;
        });
        useEntityStore.setState({ entities: raw });
    };

    // Initial sync
    syncFromYjs();

    // Observe all future changes
    yjsStore.entitiesMap.observe(syncFromYjs);
}

// ──────────────── Selectors ────────────────

/** Get ALL entities as an array (equivalent to old useEntities()) */
export function useAllEntities(): Entity[] {
    const entities = useEntityStore((state) => state.entities);
    return useMemo(() => Object.values(entities), [entities]);
}

/** Get a single entity by ID. Only re-renders when THAT entity changes. */
export function useEntity(id: string): Entity | undefined {
    return useEntityStore((state) => state.entities[id]);
}

/** Get entities matching a parent ID. Cached with useMemo. */
export function useEntitiesByParent(parentId: string | null): Entity[] {
    const entities = useEntityStore((state) => state.entities);
    return useMemo(
        () => Object.values(entities).filter(e => e.parentId === parentId),
        [entities, parentId]
    );
}

/** Get entities matching a type. Cached with useMemo. */
export function useEntitiesByType(type: EntityType): Entity[] {
    const entities = useEntityStore((state) => state.entities);
    return useMemo(
        () => Object.values(entities).filter(e => e.type === type),
        [entities, type]
    );
}

/** Get multiple entities by their IDs. Cached with useMemo. */
export function useEntitiesByIds(ids: string[]): Entity[] {
    const entities = useEntityStore((state) => state.entities);
    // Stringify ids for stable dependency (arrays change identity on every render)
    const idsKey = ids.join(',');
    return useMemo(
        () => ids.map(id => entities[id]).filter(Boolean) as Entity[],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [entities, idsKey]
    );
}

/** Non-hook access: get a snapshot of all entities (for event handlers, not components) */
export function getEntitiesSnapshot(): Record<string, Entity> {
    return useEntityStore.getState().entities;
}

/** Non-hook access: get a single entity */
export function getEntitySnapshot(id: string): Entity | undefined {
    return useEntityStore.getState().entities[id];
}
