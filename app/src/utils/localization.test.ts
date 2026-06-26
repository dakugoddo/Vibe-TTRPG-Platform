import assert from 'node:assert/strict';
import {
    DEFAULT_LOCALE,
    LOCALE_STORAGE_KEY,
    flattenLocaleMessages,
    getStoredLocale,
    isSupportedLocale,
    mergeLocaleMessages,
    normalizeLocale,
    saveStoredLocale,
    unflattenLocaleMessages,
} from './localization';

assert.equal(normalizeLocale('ru'), 'ru');
assert.equal(normalizeLocale('en'), 'en');
assert.equal(normalizeLocale('ua'), DEFAULT_LOCALE);
assert.equal(normalizeLocale(null), DEFAULT_LOCALE);
assert.equal(isSupportedLocale('ru'), true);
assert.equal(isSupportedLocale('en-US'), false);

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

const localeTree = {
    settings: {
        tabs: {
            interface: 'Interface',
            world: 'World',
        },
        hints: ['ignored'],
    },
    assetBrowser: {
        filters: {
            pdf: 'PDF',
        },
    },
    version: 1,
};

assert.deepEqual(flattenLocaleMessages(localeTree), {
    'settings.tabs.interface': 'Interface',
    'settings.tabs.world': 'World',
    'assetBrowser.filters.pdf': 'PDF',
});

assert.deepEqual(unflattenLocaleMessages({
    'settings.tabs.interface': 'Interface',
    'assetBrowser.filters.pdf': 'PDF',
}), {
    settings: {
        tabs: {
            interface: 'Interface',
        },
    },
    assetBrowser: {
        filters: {
            pdf: 'PDF',
        },
    },
});

const baseMessages = {
    settings: {
        tabs: {
            interface: 'Interface',
            world: 'World',
        },
    },
    modules: {
        pdfViewer: 'PDF preview',
    },
};

assert.deepEqual(mergeLocaleMessages(baseMessages, {
    settings: {
        tabs: {
            world: 'Мир',
        },
    },
    modules: 'bad parent override',
    customPack: {
        label: 'Custom pack',
    },
}), {
    settings: {
        tabs: {
            interface: 'Interface',
            world: 'Мир',
        },
    },
    modules: {
        pdfViewer: 'PDF preview',
    },
    customPack: {
        label: 'Custom pack',
    },
});

assert.deepEqual(baseMessages, {
    settings: {
        tabs: {
            interface: 'Interface',
            world: 'World',
        },
    },
    modules: {
        pdfViewer: 'PDF preview',
    },
});

console.log('localization tests passed');
