import assert from 'node:assert/strict';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, getStoredLocale, normalizeLocale, saveStoredLocale } from './localization';

assert.equal(normalizeLocale('ru'), 'ru');
assert.equal(normalizeLocale('en'), 'en');
assert.equal(normalizeLocale('ua'), DEFAULT_LOCALE);
assert.equal(normalizeLocale(null), DEFAULT_LOCALE);

const storageState = new Map<string, string>();
const storage = {
    getItem: (key: string) => storageState.get(key) ?? null,
    setItem: (key: string, value: string) => {
        storageState.set(key, value);
    },
};

assert.equal(getStoredLocale(storage), DEFAULT_LOCALE);
assert.equal(saveStoredLocale('en', storage), 'en');
assert.equal(storageState.get(LOCALE_STORAGE_KEY), 'en');
assert.equal(getStoredLocale(storage), 'en');

storageState.set(LOCALE_STORAGE_KEY, 'bad-locale');
assert.equal(getStoredLocale(storage), DEFAULT_LOCALE);

console.log('localization tests passed');
