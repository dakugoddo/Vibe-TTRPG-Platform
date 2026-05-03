/**
 * Re-export selectors from the centralized entityStore.
 * This file exists for backward compatibility — old imports continue to work.
 * New code should import directly from '@/store/entityStore'.
 */
export {
    useAllEntities as useEntities,
    useEntity,
    useEntitiesByParent,
    useEntitiesByType,
    useEntitiesByIds,
    getEntitiesSnapshot,
    getEntitySnapshot,
} from '../store/entityStore';
