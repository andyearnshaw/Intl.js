/**
 * @license Copyright 2013 Andy Earnshaw, MIT License
 *
 * Implements the ECMAScript Internationalization API in ES5-compatible environments,
 * following the ECMA-402 specification as closely as possible
 *
 * ECMA-402: http://ecma-international.org/ecma-402/1.0/
 *
 * CLDR format locale data should be provided using IntlPolyfill.__addLocaleData().
 */

import {
    defineProperty,
    hop,
    arrPush,
    arrShift,
    internals,
} from "./util.js";

import {
    IsStructurallyValidLanguageTag,
    defaultLocale,
    setDefaultLocale,
} from "./6.locales-currencies-tz.js";

import {
    Intl,
} from "./8.intl.js";

import "./11.numberformat.js";

import "./12.datetimeformat.js";

import ls from "./13.locale-sensitive-functions.js";

defineProperty(Intl, '__applyLocaleSensitivePrototypes', {
    writable: true,
    configurable: true,
    value: function () {
        defineProperty(Number.prototype, 'toLocaleString', { writable: true, configurable: true, value: ls.Number.toLocaleString });
        // Need this here for IE 8, to avoid the _DontEnum_ bug
        defineProperty(Date.prototype, 'toLocaleString', { writable: true, configurable: true, value: ls.Date.toLocaleString });

        for (let k in ls.Date) {
            if (hop.call(ls.Date, k))
                defineProperty(Date.prototype, k, { writable: true, configurable: true, value: ls.Date[k] });
        }
    },
});

/**
 * Can't really ship a single script with data for hundreds of locales, so we provide
 * this __addLocaleData method as a means for the developer to add the data on an
 * as-needed basis
 */
defineProperty(Intl, '__addLocaleData', {
    value: function (data) {
        if (!IsStructurallyValidLanguageTag(data.locale))
            throw new Error("Object passed doesn't identify itself with a valid language tag");

        addLocaleData(data, data.locale);
    },
});

function addLocaleData (data, tag) {
    // Both NumberFormat and DateTimeFormat require number data, so throw if it isn't present
    if (!data.number)
        throw new Error("Object passed doesn't contain locale data for Intl.NumberFormat");

    let locale,
        locales = [ tag ],
        parts   = tag.split('-');

    // Create fallbacks for locale data with scripts, e.g. Latn, Hans, Vaii, etc
    if (parts.length > 2 && parts[1].length === 4)
        arrPush.call(locales, parts[0] + '-' + parts[2]);

    while ((locale = arrShift.call(locales))) {
        // Add to NumberFormat internal properties as per 11.2.3
        arrPush.call(internals.NumberFormat['[[availableLocales]]'], locale);
        internals.NumberFormat['[[localeData]]'][locale] = data.number;

        // ...and DateTimeFormat internal properties as per 12.2.3
        if (data.date) {
            data.date.nu = data.number.nu;
            arrPush.call(internals.DateTimeFormat['[[availableLocales]]'], locale);
            internals.DateTimeFormat['[[localeData]]'][locale] = data.date;
        }
    }

    // If this is the first set of locale data added, make it the default
    if (defaultLocale === undefined)
        setDefaultLocale(tag);
}

export default Intl;
