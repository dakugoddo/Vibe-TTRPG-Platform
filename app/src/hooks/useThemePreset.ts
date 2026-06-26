import { useCallback, useEffect, useState } from 'react';
import { applyThemePreset, getStoredThemePresetId, type ThemePresetId } from '../utils/theme';

export function useThemePreset(): [ThemePresetId, (id: ThemePresetId) => void] {
    const [themeId, setThemeId] = useState<ThemePresetId>(() => getStoredThemePresetId());

    useEffect(() => {
        applyThemePreset(themeId);
    }, [themeId]);

    const updateTheme = useCallback((id: ThemePresetId) => {
        setThemeId(id);
        applyThemePreset(id);
    }, []);

    return [themeId, updateTheme];
}
