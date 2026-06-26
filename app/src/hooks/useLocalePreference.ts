import { useCallback, useEffect, useState } from 'react';
import i18n from '../i18n';
import { getStoredLocale, normalizeLocale, saveStoredLocale, type SupportedLocale } from '../utils/localization';

export function useLocalePreference(): [SupportedLocale, (locale: SupportedLocale) => void] {
    const [locale, setLocale] = useState<SupportedLocale>(() => normalizeLocale(i18n.language || getStoredLocale()));

    useEffect(() => {
        const handleLanguageChanged = (language: string) => {
            setLocale(normalizeLocale(language));
        };

        i18n.on('languageChanged', handleLanguageChanged);
        return () => {
            i18n.off('languageChanged', handleLanguageChanged);
        };
    }, []);

    const updateLocale = useCallback((nextLocale: SupportedLocale) => {
        const normalized = saveStoredLocale(nextLocale);
        setLocale(normalized);
        void i18n.changeLanguage(normalized);
    }, []);

    return [locale, updateLocale];
}
