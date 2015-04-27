/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */
'use strict';

var path   = require('path');
var glob   = require("glob");
var assign = require('object.assign');

var getParentLocale  = require('./locales').getParentLocale;
var hasCalendars     = require('./locales').hasCalendars;
var normalizeLocale  = require('./locales').normalizeLocale;

module.exports = function extractCalendars(locales) {
    var cache = {};
    var hashes = {};

    // Loads and caches the date calendars for a given `locale` because loading
    // and transforming the data is expensive.
    function getCalendars(locale) {
        var calendars = cache[locale];
        if (calendars) {
            return calendars;
        }

        if (hasCalendars(locale)) {
            calendars = cache[locale] = loadCalendars(locale);
            return calendars;
        }
    }

    // Hashes and caches the `calendars` for a given `locale` to avoid hashing more
    // than once since it could be expensive.
    function hashCalendars(locale, calendars) {
        var hash = hashes[locale];
        if (hash) {
            return hash;
        }

        hash = hashes[locale] = JSON.stringify(calendars);
        return hash;
    }

    // We want to de-dup data that can be referenced from upstream in the
    // `locale`'s hierarchy when that locale's date calendars are the _exact_
    // same as one of its ancestors. This will traverse the hierarchy for the
    // given `locale` until it finds an ancestor with same same date calendars.
    // When an ancestor can't be found, a data entry must be created for the
    // `locale` since its date calendars are unique.
    function findGreatestAncestor(locale) {
        // The "root" locale is not a suitable ancestor, because there won't be
        // an entry for "root" in the final data object.
        var parentLocale = getParentLocale(locale);
        if (!parentLocale || parentLocale === 'root') {
            return 'root';
        }

        // When the `locale` doesn't have calendars data, we need to traverse up
        // its hierarchy to find suitable date calendars data.
        if (!hasCalendars(locale)) {
            return findGreatestAncestor(parentLocale);
        }

        return locale;
    }

    return locales.reduce(function (calendars, locale) {
        locale = normalizeLocale(locale);

        // Walk the `locale`'s hierarchy to look for suitable ancestor with the
        // _exact_ same date calendars. If no ancestor is found, the given
        // `locale` will be returned.
        var resolvedLocale = hasCalendars(locale) ? locale : findGreatestAncestor(locale);

        // Add an entry for the `locale`, which might be an ancestor. If the
        // locale doesn't have relative fields, then we fallback to the "root"
        // locale's fields.
        calendars[locale] = {
            calendars: getCalendars(resolvedLocale),
        };

        return calendars;
    }, {});
};

function loadCalendars(locale) {
    var dir = path.resolve(__dirname, '../../data/main', locale);
    var filenames = glob.sync("ca-*.json", {
            cwd: dir
        });

    return filenames.reduce(function (calendars, filename) {
        return assign(calendars, require(path.join(dir, filename)).main[locale].dates.calendars);
    }, {});
}
