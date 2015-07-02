/* jshint node:true */

'use strict';

var path   = require('path');
var assign = require('object.assign');

var getParentLocale  = require('./locales').getParentLocale;
var hasNumbersFields = require('./locales').hasNumbersFields;
var normalizeLocale  = require('./locales').normalizeLocale;

module.exports = function extractNumbersFields(locales) {
    var cache = {};
    var hashes = {};

    // Loads and caches the numbers fields for a given `locale` because loading
    // and transforming the data is expensive.
    function getNumbers(locale) {
        var numbers = cache[locale];
        if (numbers) {
            return numbers;
        }
        if (hasNumbersFields(locale)) {
            numbers = cache[locale] = loadNumbers(locale);
            return numbers;
        }
    }

    // This will traverse the hierarchy for the
    // given `locale` until it finds an ancestor with numbers fields.
    function findLocaleWithNumbersFields(locale) {
        // The "root" locale is the top level ancestor.
        if (locale === 'root') {
            return 'root';
        }

        if (hasNumbersFields(locale)) {
            return locale;
        }

        // When the `locale` doesn't have numbers fields, we need to traverse up
        // its hierarchy to find suitable numbers fields data.
        return findLocaleWithNumbersFields(getParentLocale(locale));
    }

    return locales.reduce(function (numbers, locale) {
        locale = normalizeLocale(locale);

        // Walk the `locale`'s hierarchy to look for suitable ancestor with the
        // date calendars. If no ancestor is found, the given
        // `locale` will be returned.
        var resolvedLocale = findLocaleWithNumbersFields(locale);

        // Add an entry for the `locale`, which might be an ancestor. If the
        // locale doesn't have relative fields, then we fallback to the "root"
        // locale's fields.
        numbers[locale] = {
            numbers: getNumbers(resolvedLocale),
        };

        return numbers;
    }, {});
};

function loadNumbers(locale) {
    return assign(
        require('cldr-numbers-full/main/' + locale + '/numbers.json').main[locale].numbers,
        require('cldr-numbers-full/main/' + locale + '/currencies.json').main[locale].numbers
    );
}
