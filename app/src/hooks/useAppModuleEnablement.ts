import { useCallback, useEffect, useState } from 'react';
import {
    isAppModuleEnabled,
    normalizeAppModuleEnablement,
    setAppModuleEnabled,
    type AppModuleEnablement,
    type AppModuleId,
} from '../utils/appModules';

const APP_MODULE_ENABLEMENT_KEY = 'vibe_app_module_enablement';
const APP_MODULE_ENABLEMENT_EVENT = 'vibe-app-module-enable-change';

function readStoredModuleEnablement(): AppModuleEnablement {
    if (typeof window === 'undefined') return normalizeAppModuleEnablement(null);
    try {
        return normalizeAppModuleEnablement(JSON.parse(window.localStorage.getItem(APP_MODULE_ENABLEMENT_KEY) || '{}'));
    } catch {
        return normalizeAppModuleEnablement(null);
    }
}

function saveStoredModuleEnablement(enablement: AppModuleEnablement): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(APP_MODULE_ENABLEMENT_KEY, JSON.stringify(enablement));
    window.dispatchEvent(new CustomEvent(APP_MODULE_ENABLEMENT_EVENT, { detail: enablement }));
}

export function getStoredAppModuleEnablement(): AppModuleEnablement {
    return readStoredModuleEnablement();
}

export function setStoredAppModuleEnabled(moduleId: AppModuleId, enabled: boolean): AppModuleEnablement {
    const next = setAppModuleEnabled(readStoredModuleEnablement(), moduleId, enabled);
    saveStoredModuleEnablement(next);
    return next;
}

export function useAppModuleEnablement(): [AppModuleEnablement, (moduleId: AppModuleId, enabled: boolean) => void] {
    const [enablement, setEnablement] = useState(readStoredModuleEnablement);

    useEffect(() => {
        const handleChange = () => setEnablement(readStoredModuleEnablement());
        window.addEventListener(APP_MODULE_ENABLEMENT_EVENT, handleChange);
        window.addEventListener('storage', handleChange);
        return () => {
            window.removeEventListener(APP_MODULE_ENABLEMENT_EVENT, handleChange);
            window.removeEventListener('storage', handleChange);
        };
    }, []);

    const setEnabled = useCallback((moduleId: AppModuleId, enabled: boolean) => {
        setEnablement(setStoredAppModuleEnabled(moduleId, enabled));
    }, []);

    return [enablement, setEnabled];
}

export function useAppModuleEnabled(moduleId: AppModuleId): [boolean, (enabled: boolean) => void] {
    const [enablement, setModuleEnabled] = useAppModuleEnablement();
    const setEnabled = useCallback((enabled: boolean) => {
        setModuleEnabled(moduleId, enabled);
    }, [moduleId, setModuleEnabled]);

    return [isAppModuleEnabled(enablement, moduleId), setEnabled];
}
