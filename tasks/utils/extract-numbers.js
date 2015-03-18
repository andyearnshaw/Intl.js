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

    // Hashes and caches the `numbers` for a given `locale` to avoid hashing more
    // than once since it could be expensive.
    function hashNumbers(locale, numbers) {
        var hash = hashes[locale];
        if (hash) {
            return hash;
        }

        hash = hashes[locale] = JSON.stringify(numbers);
        return hash;
    }

    // We want to de-dup data that can be referenced from upstream in the
    // `locale`'s hierarchy when that locale's numbers fields are the _exact_
    // same as one of its ancestors. This will traverse the hierarchy for the
    // given `locale` until it finds an ancestor with same same numbers fields.
    // When an ancestor can't be found, a data entry must be created for the
    // `locale` since its numbers fields are unique.
    function findGreatestAncestor(locale) {
        // The "root" locale is not a suitable ancestor, because there won't be
        // an entry for "root" in the final data object.
        var parentLocale = getParentLocale(locale);

        if (!parentLocale || parentLocale === 'root') {
            return 'root';
        }

        // When the `locale` doesn't have numbers fields, we need to traverse up
        // its hierarchy to find suitable numbers fields data.
        if (!hasNumbersFields(locale)) {
            return findGreatestAncestor(parentLocale);
        }

        return locale;
    }

    return locales.reduce(function (numbers, locale) {
        locale = normalizeLocale(locale);

        // Walk the `locale`'s hierarchy to look for suitable ancestor with the
        // _exact_ same numbers fields. If no ancestor is found, the given
        // `locale` will be returned.
        var resolvedLocale = hasNumbersFields(locale) ? locale : findGreatestAncestor(locale);

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
    var dir = path.resolve(__dirname, '../../data/main', locale);
    return assign(
        require(path.join(dir, 'numbers.json')).main[locale].numbers,
        require(path.join(dir, 'currencies.json')).main[locale].numbers
    );
}
