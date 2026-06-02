export const LOCALE_STORAGE_KEY = 'vibe_locale';

export const SUPPORTED_LOCALES = [
    {
        id: 'ru',
        nativeLabel: 'Русский',
        bundlePath: 'app/src/locales/ru.json',
    },
    {
        id: 'en',
        nativeLabel: 'English',
        bundlePath: 'app/src/locales/en.json',
    },
] as const;

export type SupportedLocale = typeof SUPPORTED_LOCALES[number]['id'];

type LocaleStorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const DEFAULT_LOCALE: SupportedLocale = 'ru';

export function normalizeLocale(value: unknown): SupportedLocale {
    return SUPPORTED_LOCALES.some((locale) => locale.id === value)
        ? value as SupportedLocale
        : DEFAULT_LOCALE;
}

function getBrowserStorage(): LocaleStorageLike | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
}

export function getStoredLocale(storage: LocaleStorageLike | null = getBrowserStorage()): SupportedLocale {
    if (!storage) return DEFAULT_LOCALE;
    return normalizeLocale(storage.getItem(LOCALE_STORAGE_KEY));
}

export function saveStoredLocale(locale: SupportedLocale, storage: LocaleStorageLike | null = getBrowserStorage()): SupportedLocale {
    const normalized = normalizeLocale(locale);
    storage?.setItem(LOCALE_STORAGE_KEY, normalized);
    return normalized;
}
