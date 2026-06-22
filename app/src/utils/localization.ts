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
export type LocaleMessageTree = Record<string, unknown>;
export type FlatLocaleMessages = Record<string, string>;

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

function isLocaleRecord(value: unknown): value is LocaleMessageTree {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function flattenLocaleMessages(messages: LocaleMessageTree, prefix = ''): FlatLocaleMessages {
    const flat: FlatLocaleMessages = {};

    for (const [key, value] of Object.entries(messages)) {
        if (!key) continue;

        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'string') {
            flat[path] = value;
        } else if (isLocaleRecord(value)) {
            Object.assign(flat, flattenLocaleMessages(value, path));
        }
    }

    return flat;
}

export function unflattenLocaleMessages(flatMessages: FlatLocaleMessages): LocaleMessageTree {
    const tree: LocaleMessageTree = {};

    for (const [path, value] of Object.entries(flatMessages)) {
        const parts = path.split('.').filter(Boolean);
        if (parts.length === 0) continue;

        let cursor = tree;
        for (const [index, part] of parts.entries()) {
            if (index === parts.length - 1) {
                cursor[part] = value;
                break;
            }

            if (!isLocaleRecord(cursor[part])) {
                cursor[part] = {};
            }
            cursor = cursor[part] as LocaleMessageTree;
        }
    }

    return tree;
}

function hasLocalePathConflict(existingKeys: Iterable<string>, nextKey: string): boolean {
    for (const existingKey of existingKeys) {
        if (existingKey === nextKey) continue;
        if (existingKey.startsWith(`${nextKey}.`) || nextKey.startsWith(`${existingKey}.`)) return true;
    }
    return false;
}

export function mergeLocaleMessages(base: LocaleMessageTree, overrides: LocaleMessageTree): LocaleMessageTree {
    const baseFlat = flattenLocaleMessages(base);
    const mergedFlat: FlatLocaleMessages = { ...baseFlat };

    for (const [key, value] of Object.entries(flattenLocaleMessages(overrides))) {
        if (key in baseFlat || !hasLocalePathConflict(Object.keys(mergedFlat), key)) {
            mergedFlat[key] = value;
        }
    }

    return unflattenLocaleMessages(mergedFlat);
}
