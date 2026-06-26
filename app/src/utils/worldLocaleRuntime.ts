import type { i18n as I18nInstance } from 'i18next';

import enTranslations from '../locales/en.json';
import ruTranslations from '../locales/ru.json';
import {
    DEFAULT_LOCALE,
    isSupportedLocale,
    mergeLocaleMessages,
    type LocaleMessageTree,
    type SupportedLocale,
} from './localization';

const BUILT_IN_LOCALE_MESSAGES: Record<SupportedLocale, LocaleMessageTree> = {
    ru: ruTranslations as LocaleMessageTree,
    en: enTranslations as LocaleMessageTree,
};

export function getBuiltInLocaleMessages(locale: SupportedLocale): LocaleMessageTree {
    return BUILT_IN_LOCALE_MESSAGES[locale] ?? BUILT_IN_LOCALE_MESSAGES[DEFAULT_LOCALE];
}

export function resetWorldLocaleOverrides(i18n: I18nInstance, locale: SupportedLocale): void {
    i18n.addResourceBundle(locale, 'translation', getBuiltInLocaleMessages(locale), true, true);
}

export function applyWorldLocaleOverrides(i18n: I18nInstance, locale: string, overrides: LocaleMessageTree): boolean {
    if (!isSupportedLocale(locale)) return false;

    i18n.addResourceBundle(
        locale,
        'translation',
        mergeLocaleMessages(getBuiltInLocaleMessages(locale), overrides),
        true,
        true,
    );
    return true;
}
