import * as glob from 'glob';
import * as path from 'path';

let CLDR_DATES_DIR = path.dirname(require.resolve('cldr-dates-full/package.json'));
let CLDR_NUMBERS_DIR = path.dirname(require.resolve('cldr-numbers-full/package.json'));

// These are the exceptions to the default algorithm for determining a locale's
// parent locale.
let PARENT_LOCALES_HASH = require('cldr-core/supplemental/parentLocales.json')
    .supplemental.parentLocales.parentLocale;

let CALENDARS_LOCALES_HASH = glob.sync('*/ca-*.json', {
    cwd: path.resolve(CLDR_DATES_DIR, 'main'),
}).reduce((hash, filename) => {
    hash[path.dirname(filename)] = true;
    return hash;
}, {});

let NUMBERS_LOCALES_HASH = glob.sync('*/numbers.json', {
    cwd: path.resolve(CLDR_NUMBERS_DIR, 'main'),
}).reduce((hash, filename) => {
    hash[path.dirname(filename)] = true;
    return hash;
}, {});

let CURRENCIES_LOCALES_HASH = glob.sync('*/currencies.json', {
    cwd: path.resolve(CLDR_NUMBERS_DIR, 'main'),
}).reduce((hash, filename) => {
    hash[path.dirname(filename)] = true;
    return hash;
}, {});

let DEFAULT_CONTENT_ARRAY = require('cldr-core/defaultContent.json')
    .defaultContent.map((value) => {
        return value.replace(/_/g, '-');
    });

// Some locales that have a `pluralRuleFunction` don't have a `dateFields.json`
// file, and visa versa, so this creates a unique collection of all locales in
// the CLDR for which we need data from.
let ALL_LOCALES_HASH =
    Object.keys(PARENT_LOCALES_HASH)
    .concat(Object.keys(CALENDARS_LOCALES_HASH))
    .concat(Object.keys(NUMBERS_LOCALES_HASH))
    .concat(Object.keys(CURRENCIES_LOCALES_HASH))
    .concat(DEFAULT_CONTENT_ARRAY)
    .sort()
    .reduce((hash, locale) => {
        hash[locale.toLowerCase()] = locale;
        return hash;
    }, {});

export function getAllLocales() {
    return Object.keys(ALL_LOCALES_HASH);
}

export function getParentLocale(locale) {
    locale = normalizeLocale(locale);

    // If we don't know about the locale, or if it's the "root" locale, then its
    // parent should be `undefined`.
    if (!locale || locale === 'root') {
        return;
    }

    // First check the exceptions for locales which don't follow the standard
    // hierarchical pattern.
    let parentLocale = PARENT_LOCALES_HASH[locale];
    if (parentLocale) {
        return parentLocale;
    }

    // Be default, the language tags are hierarchal, therefore we can identify
    // the parent locale by simply popping off the last segment.
    let localeParts = locale.split('-');
    if (localeParts.length > 1) {
        localeParts.pop();
        return localeParts.join('-');
    }

    // When there's nothing left in the hierarchy, the parent is the "root".
    return 'root';
}

export function hasCalendars(locale) {
    return CALENDARS_LOCALES_HASH.hasOwnProperty(normalizeLocale(locale));
}

export function hasNumbersFields(locale) {
    return NUMBERS_LOCALES_HASH.hasOwnProperty(normalizeLocale(locale)) &&
            CURRENCIES_LOCALES_HASH.hasOwnProperty(normalizeLocale(locale));
}

export function normalizeLocale(locale) {
    let normalizedLocale = ALL_LOCALES_HASH[locale.toLowerCase()];
    if (normalizedLocale) {
        return normalizedLocale;
    }

    throw new Error('No locale data for: "' + locale + '"');
}
