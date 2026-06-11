import { useCallback, useEffect, useState } from 'react';

import { applyInterfaceDensity, getStoredInterfaceDensityId, type InterfaceDensityId } from '../utils/theme';

export function useInterfaceDensity(): [InterfaceDensityId, (id: InterfaceDensityId) => void] {
    const [densityId, setDensityId] = useState<InterfaceDensityId>(() => getStoredInterfaceDensityId());

    useEffect(() => {
        applyInterfaceDensity(densityId);
    }, [densityId]);

    const updateDensity = useCallback((id: InterfaceDensityId) => {
        setDensityId(id);
        applyInterfaceDensity(id);
    }, []);

    return [densityId, updateDensity];
}
