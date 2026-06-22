import assert from 'node:assert/strict';
import type { i18n as I18nInstance } from 'i18next';

import { flattenLocaleMessages, type LocaleMessageTree } from './localization';
import { applyWorldLocaleOverrides, getBuiltInLocaleMessages, resetWorldLocaleOverrides } from './worldLocaleRuntime';

const bundles = new Map<string, LocaleMessageTree>();
const fakeI18n = {
    addResourceBundle: (locale: string, namespace: string, bundle: LocaleMessageTree) => {
        bundles.set(`${locale}:${namespace}`, bundle);
    },
} as unknown as I18nInstance;

const builtInRu = flattenLocaleMessages(getBuiltInLocaleMessages('ru'));
assert.equal(typeof builtInRu['settings.tabs.world'], 'string');

assert.equal(applyWorldLocaleOverrides(fakeI18n, 'ru', {
    settings: {
        tabs: {
            world: 'World custom',
        },
    },
}), true);
assert.equal(flattenLocaleMessages(bundles.get('ru:translation') ?? {})['settings.tabs.world'], 'World custom');

assert.equal(applyWorldLocaleOverrides(fakeI18n, 'en-US', {
    settings: {
        tabs: {
            world: 'Ignored',
        },
    },
}), false);

resetWorldLocaleOverrides(fakeI18n, 'ru');
assert.equal(flattenLocaleMessages(bundles.get('ru:translation') ?? {})['settings.tabs.world'], builtInRu['settings.tabs.world']);

console.log('world locale runtime tests passed');
