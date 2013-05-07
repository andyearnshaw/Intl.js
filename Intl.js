/*jshint eqnull:true, boss:true, laxbreak:true, newcap:false, shadow:true, funcscope:true */
window.OldIntl = window.Intl;
var Intl = /*window.Intl || */(function (Intl) {
// Copyright 2013 Andy Earnshaw, MIT License

/**
 * Implements the ECMAScript Internationalization API in ES5-compatible environments,
 * following the ECMA-402 specification as closely as possible
 *
 * ECMA-402: http://ecma-international.org/ecma-402/1.0/
 *
 * This file alone implements only a neutral English locale.  External language packs
 * are required to work with additional locales.
 */

"use strict";
var
    // Private object houses our locale data for each locale
    localeData = {},
    
    // Object housing internal properties for constructors 
    internals = Object.create ? Object.create(null) : {},

    // Keep internal properties internal
    secret = Math.random(),

    // We use this a lot (and need it for proto-less objects)
    hop = Object.prototype.hasOwnProperty,
    
    // Some regular expressions we're using
    expInsertGroups = /(?=(?!^)(?:\d{3})+(?!\d))/g,
    expCurrencyCode = /^[A-Z]{3}$/,
    expUnicodeExSeq = /-u(?:-\w+)+(?!-\w-)/g,
    
    // Sham this for ES3 compat
    defineProperty = Object.defineProperty || function (obj, name, desc) {
        obj[name] = desc.value || desc.get;        
    };

// Sect 6.2 Language Tags
// ======================
function /* 6.2.2 */IsStructurallyValidLanguageTag(locale) {
    // The IsStructurallyValidLanguageTag abstract operation verifies that the locale
    //  argument (which must be a String value)
    //
    // - represents a well-formed BCP 47 language tag as specified in RFC 5646
    //   section 2.1, or successor,
    // - does not include duplicate variant subtags, and
    // - does not include duplicate singleton subtags.
    //
    // The abstract operation returns true if locale can be generated from the ABNF
    // grammar in section 2.1 of the RFC, starting with Language-Tag, and does not
    // contain duplicate variant or singleton subtags (other than as a private use
    // subtag). It returns false otherwise. Terminal value characters in the grammar
    // are interpreted as the Unicode equivalents of the ASCII octet values given.

    // ###TODO###
    return true;
}

function /* 6.2.3 */CanonicalizeLanguageTag (locale) {
    // The CanonicalizeLanguageTag abstract operation returns the canonical and case-
    // regularized form of the locale argument (which must be a String value that is
    // a structurally valid BCP 47 language tag as verified by the
    // IsStructurallyValidLanguageTag abstract operation). It takes the steps
    // specified in RFC 5646 section 4.5, or successor, to bring the language tag
    // into canonical form, and to regularize the case of the subtags, but does not
    // take the steps to bring a language tag into “extlang form” and to reorder
    // variant subtags.

    // The specifications for extensions to BCP 47 language tags, such as RFC 6067,
    // may include canonicalization rules for the extension subtag sequences they
    // define that go beyond the canonicalization rules of RFC 5646 section 4.5.
    // Implementations are allowed, but not required, to apply these additional rules.
    
    // ###TODO###
    return locale;
}

function /* 6.2.4 */DefaultLocale () {
    // The DefaultLocale abstract operation returns a String value representing the
    // structurally valid (6.2.2) and canonicalized (6.2.3) BCP 47 language tag for
    // the host environment’s current locale.

    return typeof navigator === 'object' ? navigator.language || '(default)': '(default)';
}

// Sect 6.3 Currency Codes
// =======================
function /* 6.3.1 */IsWellFormedCurrencyCode(currency) {
    // The IsWellFormedCurrencyCode abstract operation verifies that the currency
    // argument (after conversion to a String value) represents a well-formed
    // 3-letter ISO currency code. The following steps are taken:

    var
        // 1. Let `c` be ToString(currency)
        c = String(currency),

        // 2. Let `normalized` be the result of mapping c to upper case as described
        //    in 6.1.
        normalized = c.toUpperCase();

    // 3. If the string length of normalized is not 3, return false.
    // 4. If normalized contains any character that is not in the range "A" to "Z"
    //    (U+0041 to U+005A), return false.
    if (expCurrencyCode.test(normalized) === false)
        return false;

    // 5. Return true
    return true;
}

// Sect 8.1 Properties of the Intl Object
// ======================================
//
// The value of each of the standard built-in properties of the Intl object is a
// constructor. The behaviour of these constructors is specified in the following
// clauses: Collator (10), NumberFormat (11), and DateTimeFormat (12).

// Sect 9.2 Abstract Operations
// ============================
function /* 9.2.1 */CanonicalizeLocaleList (locales) {
// The abstract operation CanonicalizeLocaleList takes the following steps:

    // 1. If locales is undefined, then a. Return a new empty List
    if (locales === undefined)
        return [];

    var
        // 2. Let seen be a new empty List.
        seen = [],

        // 3. If locales is a String value, then
        //    a. Let locales be a new array created as if by the expression new
        //    Array(locales) where Array is the standard built-in constructor with
        //    that name and locales is the value of locales.
        locales = typeof locales === 'string' ? [ locales ] : locales,

        // 4. Let O be ToObject(locales).
        O = toObject(locales),

        // 5. Let lenValue be the result of calling the [[Get]] internal method of
        //    O with the argument "length".
        // 6. Let len be ToUint32(lenValue).
        len = O.length,

        // 7. Let k be 0.
        k = 0;

    // 8. Repeat, while k < len
    while (k < len) {
        var
            // a. Let Pk be ToString(k).
            Pk = String(k),

            // b. Let kPresent be the result of calling the [[HasProperty]] internal
            //    method of O with argument Pk.
            kPresent = Pk in O;

        // c. If kPresent is true, then
        if (kPresent) {
            var
                // i. Let kValue be the result of calling the [[Get]] internal
                //     method of O with argument Pk.
                kValue = O[Pk];

            // ii. If the type of kValue is not String or Object, then throw a
            //     TypeError exception.
            if (typeof kValue !== 'string' && typeof kValue !== 'object')
                throw new TypeError('String or Object type expected');

            var
                // iii. Let tag be ToString(kValue).
                tag = String(kValue);

            // iv. If the result of calling the abstract operation
            //     IsStructurallyValidLanguageTag (defined in 6.2.2), passing tag as
            //     the argument, is false, then throw a RangeError exception.
            if (!IsStructurallyValidLanguageTag(tag))
                throw new RangeError("'" + tag + "' is not a structurally valid language tag");

            // v. Let tag be the result of calling the abstract operation
            //    CanonicalizeLanguageTag (defined in 6.2.3), passing tag as the
            //    argument.
            tag = CanonicalizeLanguageTag(tag);

            // vi. If tag is not an element of seen, then append tag as the last
            //     element of seen.
            if (seen.indexOf(tag) === -1)
                seen.push(tag);
        }

        // d. Increase k by 1.
        k++;
    }
    // 9. Return seen.
    return seen;
}

function /* 9.2.2 */BestAvailableLocale (availableLocales, locale) {
    // The BestAvailableLocale abstract operation compares the provided argument
    // locale, which must be a String value with a structurally valid and
    // canonicalized BCP 47 language tag, against the locales in availableLocales and
    // returns either the longest non-empty prefix of locale that is an element of
    // availableLocales, or undefined if there is no such element. It uses the
    // fallback mechanism of RFC 4647, section 3.4. The following steps are taken:

    var
       // 1. Let candidate be locale
       candidate = locale;

    // 2. Repeat
    while (true) {
        // a. If availableLocales contains an element equal to candidate, then return
        // candidate.
        if (availableLocales.indexOf(candidate) > -1)
            return candidate;

        var
            // b. Let pos be the character index of the last occurrence of "-"
            // (U+002D) within candidate. If that character does not occur, return
            // undefined.
            pos = candidate.lastIndexOf('-');

        if (pos < 0)
            return;

        // c. If pos ≥ 2 and the character "-" occurs at index pos-2 of candidate,
        //    then decrease pos by 2.
        if (pos >= 2 && candidate.charAt(pos - 2) == '-')
            pos -= 2;

        // d. Let candidate be the substring of candidate from position 0, inclusive,
        //    to position pos, exclusive.
        candidate = candidate.substring(0, pos);
    }
}

function /* 9.2.3 */LookupMatcher (availableLocales, requestedLocales) {
    // The LookupMatcher abstract operation compares requestedLocales, which must be
    // a List as returned by CanonicalizeLocaleList, against the locales in
    // availableLocales and determines the best available language to meet the
    // request. The following steps are taken:

    var
        // 1. Let i be 0.
        i = 0,

        // 2. Let len be the number of elements in requestedLocales.
        len = requestedLocales.length,

        // 3. Let availableLocale be undefined.
        availableLocale;

    // 4. Repeat while i < len and availableLocale is undefined:
    while (i < len && !availableLocale) {
        var
            // a. Let locale be the element of requestedLocales at 0-origined list
            //    position i.
            locale = requestedLocales[i],

            // b. Let noExtensionsLocale be the String value that is locale with all
            //    Unicode locale extension sequences removed.
            noExtensionsLocale = String(locale).replace(expUnicodeExSeq, ''),

            // c. Let availableLocale be the result of calling the
            //    BestAvailableLocale abstract operation (defined in 9.2.2) with
            //    arguments availableLocales and noExtensionsLocale.
            availableLocale = BestAvailableLocale(availableLocales, noExtensionsLocale);

        // d. Increase i by 1.
        i++;
    }

    var
        // 5. Let result be a new Record.
        result = {};

    // 6. If availableLocale is not undefined, then
    if (availableLocale !== undefined) {
        // a. Set result.[[locale]] to availableLocale.
        result['[[locale]]'] = availableLocale;

        // b. If locale and noExtensionsLocale are not the same String value, then
        if (String(locale) !== String(noExtensionsLocale)) {
            var
                // i. Let extension be the String value consisting of the first
                //    substring of locale that is a Unicode locale extension sequence.
                extension = extension.slice(0, extension.indexOf('-u-')),

                // ii. Let extensionIndex be the character position of the initial
                //     "-" of the first Unicode locale extension sequence within locale.
                extensionIndex = extension.indexOf('-');

            // iii. Set result.[[extension]] to extension.
            result['[[extension]]'] = extension;

            // iv. Set result.[[extensionIndex]] to extensionIndex.
            result['[[extensionIndex]]'] = extensionIndex;
        }
        // 7. Else
        else
            // a. Set result.[[locale]] to the value returned by the DefaultLocale
            //    abstract operation (defined in 6.2.4).
            result['[[locale]]'] = DefaultLocale();
    }
    // 8. Return result
    return result;
}

function /* 9.2.4 */BestFitMatcher (availableLocales, requestedLocales) {
    // The BestFitMatcher abstract operation compares requestedLocales, which must be
    // a List as returned by CanonicalizeLocaleList, against the locales in
    // availableLocales and determines the best available language to meet the
    // request. The algorithm is implementation dependent, but should produce results
    // that a typical user of the requested locales would perceive as at least as
    // good as those produced by the LookupMatcher abstract operation. Options
    // specified through Unicode locale extension sequences must be ignored by the
    // algorithm. Information about such subsequences is returned separately.
    // The abstract operation returns a record with a [[locale]] field, whose value
    // is the language tag of the selected locale, which must be an element of
    // availableLocales. If the language tag of the request locale that led to the
    // selected locale contained a Unicode locale extension sequence, then the
    // returned record also contains an [[extension]] field whose value is the first
    // Unicode locale extension sequence, and an [[extensionIndex]] field whose value
    // is the index of the first Unicode locale extension sequence within the request
    // locale language tag.
    for (var i=0, max=requestedLocales.length; i < max; i++) {
        if (availableLocales.indexOf(requestedLocales[i]) > -1)
            return {
                '[[locale]]': requestedLocales[i]
            };
    }

    return {
        '[[locale]]': availableLocales[availableLocales.indexOf(DefaultLocale())] || '(default)'
    };
}

function /* 9.2.5 */ResolveLocale (availableLocales, requestedLocales, options,
                                                 relevantExtensionKeys, localeData) {
    // The ResolveLocale abstract operation compares a BCP 47 language priority list
    // requestedLocales against the locales in availableLocales and determines the
    // best available language to meet the request. availableLocales and
    // requestedLocales must be provided as List values, options as a Record.

    // The following steps are taken:

    var
        // 1. Let matcher be the value of options.[[localeMatcher]].
        matcher = options['[[localeMatcher]]'];

    // 2. If matcher is "lookup", then
    if (matcher === 'lookup')
        var
            // a. Let r be the result of calling the LookupMatcher abstract operation
            //    (defined in 9.2.3) with arguments availableLocales and
            //    requestedLocales.
            r = LookupMatcher(availableLocales, requestedLocales);

    // 3. Else
    else
        var
            // a. Let r be the result of calling the BestFitMatcher abstract
            //    operation (defined in 9.2.4) with arguments availableLocales and
            //    requestedLocales.
            r = BestFitMatcher(availableLocales, requestedLocales);

    var
        // 4. Let foundLocale be the value of r.[[locale]].
        foundLocale = r['[[locale]]'];

    // 5. If r has an [[extension]] field, then
    if (hop.call(r, '[[extension]]'))
        var
            // a. Let extension be the value of r.[[extension]].
            extension = r['[[extension]]'],
            // b. Let extensionIndex be the value of r.[[extensionIndex]].
            extensionIndex = r['[[extensionIndex]]'],
            // c. Let split be the standard built-in function object defined in ES5,
            //    15.5.4.14.
            split = String.prototype.split,
            // d. Let extensionSubtags be the result of calling the [[Call]] internal
            //    method of split with extension as the this value and an argument
            //    list containing the single item "-".
            extensionSubtags = split.call(extension, '-'),
            // e. Let extensionSubtagsLength be the result of calling the [[Get]]
            //    internal method of extensionSubtags with argument "length".
            extensionSubtagsLength = extensionSubtags.length;

    var
        // 6. Let result be a new Record.
        result = {};

    // 7. Set result.[[dataLocale]] to foundLocale.
    result['[[dataLocale]]'] = foundLocale;

    var
        // 8. Let supportedExtension be "-u".
        supportedExtension = '-u',
        // 9. Let i be 0.
        i = 0,
        // 10. Let len be the result of calling the [[Get]] internal method of
        //     relevantExtensionKeys with argument "length".
        len = relevantExtensionKeys.length;

    // 11 Repeat while i < len:
    while (i < len) {
        var
            // a. Let key be the result of calling the [[Get]] internal method of
            //    relevantExtensionKeys with argument ToString(i).
            key = relevantExtensionKeys[i],
            // b. Let foundLocaleData be the result of calling the [[Get]] internal
            //    method of localeData with the argument foundLocale.
            foundLocaleData = localeData[foundLocale],
            // c. Let keyLocaleData be the result of calling the [[Get]] internal
            //    method of foundLocaleData with the argument key.
            keyLocaleData = foundLocaleData[key],
            // d. Let value be the result of calling the [[Get]] internal method of
            //    keyLocaleData with argument "0".
            value = keyLocaleData['0'],
            // e. Let supportedExtensionAddition be "".
            supportedExtensionAddition = '',
            // f. Let indexOf be the standard built-in function object defined in
            //    ES5, 15.4.4.14.
            indexOf = Array.prototype.indexOf;

        // g. If extensionSubtags is not undefined, then
        if (extensionSubtags !== undefined) {
            var
                // i. Let keyPos be the result of calling the [[Call]] internal
                //    method of indexOf with extensionSubtags as the this value and
                // an argument list containing the single item key.
                keyPos = indexOf.call(extensionSubtags, key);

            // ii. If keyPos ≠ -1, then
            if (keyPos !== -1) {
                // 1. If keyPos + 1 < extensionSubtagsLength and the length of the
                //    result of calling the [[Get]] internal method of
                //    extensionSubtags with argument ToString(keyPos +1) is greater
                //    than 2, then
                if (keyPos + 1 < extensionSubtagsLength
                        && extensionSubtags[keyPos + 1].length > 2) {
                    var
                        // a. Let requestedValue be the result of calling the [[Get]]
                        //    internal method of extensionSubtags with argument
                        //    ToString(keyPos + 1).
                        requestedValue = extensionSubtags[keyPos + 1],
                        // b. Let valuePos be the result of calling the [[Call]]
                        //    internal method of indexOf with keyLocaleData as the
                        //    this value and an argument list containing the single
                        //    item requestedValue.
                        valuePos = indexOf.call(keyLocaleData, requestedValue);

                    // c. If valuePos ≠ -1, then
                    if (valuePos !== -1)
                        var
                            // i. Let value be requestedValue.
                            value = requestedValue,
                            // ii. Let supportedExtensionAddition be the
                            //     concatenation of "-", key, "-", and value.
                            supportedExtensionAddition = '-' + key + '-' + value;
                }
                // 2. Else
                else {
                    var
                        // a. Let valuePos be the result of calling the [[Call]]
                        // internal method of indexOf with keyLocaleData as the this
                        // value and an argument list containing the single item
                        // "true".
                        valuePos = indexOf(keyLocaleData, 'true');

                    // b. If valuePos ≠ -1, then
                    if (valuePos !== -1)
                        var
                            // i. Let value be "true".
                            value = 'true';
                }
            }
        }
        // h. If options has a field [[<key>]], then
        if (hop.call(options, '[[' + key + ']]')) {
            var
                // i. Let optionsValue be the value of options.[[<key>]].
                optionsValue = options['[[' + key + ']]'];

            // ii. If the result of calling the [[Call]] internal method of indexOf
            //     with keyLocaleData as the this value and an argument list
            //     containing the single item optionsValue is not -1, then
            if (indexOf.call(keyLocaleData, optionsValue) !== -1) {
                // 1. If optionsValue is not equal to value, then
                if (optionsValue !== value) {
                    // a. Let value be optionsValue.
                    value = optionsValue;
                    // b. Let supportedExtensionAddition be "".
                    supportedExtensionAddition = '';
                }
            }
        }
        // i. Set result.[[<key>]] to value.
        result['[[' + key + ']]'] = value;

        // j. Append supportedExtensionAddition to supportedExtension.
        supportedExtension += supportedExtensionAddition;

        // k. Increase i by 1.
        i++;
    }
    // 12. If the length of supportedExtension is greater than 2, then
    if (supportedExtension.length > 2) {
        var
            // a. Let preExtension be the substring of foundLocale from position 0,
            //    inclusive, to position extensionIndex, exclusive.
            preExtension = foundLocale.substring(0, extensionIndex),
            // b. Let postExtension be the substring of foundLocale from position
            //    extensionIndex to the end of the string.
            postExtension = foundLocale.substring(extensionIndex),
            // c. Let foundLocale be the concatenation of preExtension,
            //    supportedExtension, and postExtension.
            foundLocale = preExtension + supportedExtension + postExtension;
    }
    // 13. Set result.[[locale]] to foundLocale.
    result['[[locale]]'] = foundLocale;

    // 14. Return result.
    return result;
}

function /* 9.2.6 */LookupSupportedLocales (availableLocales, requestedLocales) {
    // The LookupSupportedLocales abstract operation returns the subset of the
    // provided BCP 47 language priority list requestedLocales for which
    // availableLocales has a matching locale when using the BCP 47 Lookup algorithm.
    // Locales appear in the same order in the returned list as in requestedLocales.
    // The following steps are taken:

    var
        // 1. Let len be the number of elements in requestedLocales.
        len = requestedLocales.length,
        // 2. Let subset be a new empty List.
        subset = [],
        // 3. Let k be 0.
        k = 0;

    // 4. Repeat while k < len
    while (k < len) {
        var
            // a. Let locale be the element of requestedLocales at 0-origined list
            //    position k.
            locale = requestedLocales[k],
            // b. Let noExtensionsLocale be the String value that is locale with all
            //    Unicode locale extension sequences removed.
            noExtensionsLocale = String(locale).replace(expUnicodeExSeq, ''),
            // c. Let availableLocale be the result of calling the
            //    BestAvailableLocale abstract operation (defined in 9.2.2) with
            //    arguments availableLocales and noExtensionsLocale.
            availableLocale = BestAvailableLocale(availableLocales, noExtensionsLocale);

        // d. If availableLocale is not undefined, then append locale to the end of
        //    subset.
        if (availableLocale !== undefined)
            subset.push(locale);

        // e. Increment k by 1.
        k++;
    }

    var
        // 5. Let subsetArray be a new Array object whose elements are the same
        //    values in the same order as the elements of subset.
        subsetArray = subset.slice(0);

    // 6. Return subsetArray.
    return subsetArray;
}
function /*9.2.7 */BestFitSupportedLocales (availableLocales, requestedLocales) {
    // The BestFitSupportedLocales abstract operation returns the subset of the
    // provided BCP 47 language priority list requestedLocales for which
    // availableLocales has a matching locale when using the Best Fit Matcher
    // algorithm. Locales appear in the same order in the returned list as in
    // requestedLocales. The steps taken are implementation dependent.

    // ###TODO: implement this function as described by the specification###
    return LookupSupportedLocales(availableLocales, requestedLocales);
}

function /*9.2.8 */SupportedLocales (availableLocales, requestedLocales, options) {
    // The SupportedLocales abstract operation returns the subset of the provided BCP
    // 47 language priority list requestedLocales for which availableLocales has a
    // matching locale. Two algorithms are available to match the locales: the Lookup
    // algorithm described in RFC 4647 section 3.4, and an implementation dependent
    // best-fit algorithm. Locales appear in the same order in the returned list as
    // in requestedLocales. The following steps are taken:

    // 1. If options is not undefined, then
    if (options !== undefined) {
        var
            // a. Let options be ToObject(options).
            options = toObject(options),
            // b. Let matcher be the result of calling the [[Get]] internal method of
            //    options with argument "localeMatcher".
            matcher = options.localeMatcher;

        // c. If matcher is not undefined, then
        if (matcher !== undefined) {
            // i. Let matcher be ToString(matcher).
            matcher = String(matcher);

            // ii. If matcher is not "lookup" or "best fit", then throw a RangeError
            //     exception.
            if (matcher !== 'lookup' && matcher !== 'best fit')
                throw new RangeError('matcher should be "lookup" or "best fit"');
        }
    }
    // 2. If matcher is undefined or "best fit", then
    if (matcher === undefined || matcher === 'best fit')
        var
            // a. Let subset be the result of calling the BestFitSupportedLocales
            //    abstract operation (defined in 9.2.7) with arguments
            //    availableLocales and requestedLocales.
            subset = BestFitSupportedLocales(availableLocales, requestedLocales);
    // 3. Else
    else
        var
            // a. Let subset be the result of calling the LookupSupportedLocales
            //    abstract operation (defined in 9.2.6) with arguments
            //    availableLocales and requestedLocales.
            subset = LookupSupportedLocales(availableLocales, requestedLocales);

    // 4. For each named own property name P of subset,
    for (var P in subset) {
        if (!hop.call(subset, P))
            continue;

        var
            // a. Let desc be the result of calling the [[GetOwnProperty]] internal
            //    method of subset with P.
            desc = subset[P];

        // b. Set desc.[[Writable]] to false.
        // c. Set desc.[[Configurable]] to false.
        // d. Call the [[DefineOwnProperty]] internal method of subset with P, desc,
        //    and true as arguments.
        defineProperty(subset, P, {
            writable: false, configurable: false, value: subset[P]
        });
    }
    // 5. Return subset
    return subset;
}

function /*9.2.9 */GetOption (options, property, type, values, fallback) {
    // The GetOption abstract operation extracts the value of the property named
    // property from the provided options object, converts it to the required type,
    // checks whether it is one of a List of allowed values, and fills in a fallback
    // value if necessary.

    var
        // 1. Let value be the result of calling the [[Get]] internal method of
        //    options with argument property.
        value = options[property];

    // 2. If value is not undefined, then
    if (value !== undefined) {
        // a. Assert: type is "boolean" or "string".
        // b. If type is "boolean", then let value be ToBoolean(value).
        // c. If type is "string", then let value be ToString(value).
        value = type === 'boolean' ? Boolean(value)
                  : (type === 'string' ? String(value) : value);

        // d. If values is not undefined, then
        if (values !== undefined) {
            // i. If values does not contain an element equal to value, then throw a
            //    RangeError exception.
            if (values.indexOf(value) === -1)
                throw new RangeError('values does not contain value');
        }

        // e. Return value.
        return value;
    }
    // Else return fallback.
    return fallback;
}

function /* 9.2.10 */GetNumberOption (options, property, minimum, maximum, fallback) {
    // The GetNumberOption abstract operation extracts a property value from the
    // provided options object, converts it to a Number value, checks whether it is
    // in the allowed range, and fills in a fallback value if necessary.

    var
        // 1. Let value be the result of calling the [[Get]] internal method of
        //    options with argument property.
        value = options[property];

    // 2. If value is not undefined, then
    if (value !== undefined) {
        // a. Let value be ToNumber(value).
        value = Number(value);

        // b. If value is NaN or less than minimum or greater than maximum, throw a
        //    RangeError exception.
        if (isNaN(value) || value < minimum || value > maximum)
            throw new RangeError('Value is not a number or outside accepted range');

        // c. Return floor(value).
        return Math.floor(value);
    }
    // 3. Else return fallback.
    return fallback;
}

// 10.1 The Intl.Collator constructor
// ==================================

Intl.Collator = function (/* [locales [, options]]*/) {
    var locales = arguments[0];
    var options = arguments[1];

    if (!this || this === Intl) {
        return new Intl.Collator(locales, options);
    }
    return InitializeCollator(toObject(this), locales, options);
};

function /*10.1.1.1 */InitializeCollator (collator, locales, options) {
    // The abstract operation InitializeCollator accepts the arguments collator
    // (which must be an object), locales, and options. It initializes collator as a
    // Collator object.

    // ###TODO###
}

// 11.1 The Intl.NumberFormat constructor
// ======================================

Intl.NumberFormat = function (/* [locales [, options]]*/) {
    var locales = arguments[0];
    var options = arguments[1];

    if (!this || this === Intl) {
        return new Intl.NumberFormat(locales, options);
    }
    return InitializeNumberFormat(toObject(this), locales, options);
};

function /*11.1.1.1 */InitializeNumberFormat (numberFormat, locales, options) {
    // The abstract operation InitializeNumberFormat accepts the arguments
    // numberFormat (which must be an object), locales, and options. It initializes
    // numberFormat as a NumberFormat object.

    // This will be a internal properties object if we're not already initialized
    var internal = getInternalProperties(numberFormat);

    // 1. If numberFormat has an [[initializedIntlObject]] internal property with
    // value true, throw a TypeError exception.
    if (internal['[[initializedIntlObject]]'] === true)
        throw new TypeError('NumberFormat object already initialized');

    // Need this to access the `internal` object
    defineProperty(numberFormat, '__getInternalProperties', {
        value: function () {
            // NOTE: Non-standard, for internal use only
            if (arguments[0] === secret)
                return internal;
        }
    });

    // 2. Set the [[initializedIntlObject]] internal property of numberFormat to true.
    internal['[[initializedIntlObject]]'] = true;

    var
    // 3. Let requestedLocales be the result of calling the CanonicalizeLocaleList
    //    abstract operation (defined in 9.2.1) with argument locales.
        requestedLocales = CanonicalizeLocaleList(locales);

    // 4. If options is undefined, then
    if (options === undefined)
        // a. Let options be the result of creating a new object as if by the
        // expression new Object() where Object is the standard built-in constructor
        // with that name.
        options = {};

    // 5. Else
    else
        // a. Let options be ToObject(options).
        options = toObject(options);

    var
    // 6. Let opt be a new Record.
        opt = {},
    // 7. Let matcher be the result of calling the GetOption abstract operation
    //    (defined in 9.2.9) with the arguments options, "localeMatcher", "string",
    //    a List containing the two String values "lookup" and "best fit", and
    //    "best fit".
        matcher =  GetOption(options, 'localeMatcher', 'string', ['lookup', 'best fit'],
                        'best fit');

    // 8. Set opt.[[localeMatcher]] to matcher.
    opt['[[localeMatcher]]'] = matcher;

    var
    // 9. Let NumberFormat be the standard built-in object that is the initial value
    //    of Intl.NumberFormat.
        NumberFormat = Intl.NumberFormat,
    // 10. Let localeData be the value of the [[localeData]] internal property of
    //     NumberFormat.
        localeData = internals.NumberFormat['[[localeData]]'],
    // 11. Let r be the result of calling the ResolveLocale abstract operation
    //     (defined in 9.2.5) with the [[availableLocales]] internal property of
    //     NumberFormat, requestedLocales, opt, the [[relevantExtensionKeys]]
    //     internal property of NumberFormat, and localeData.
        r = ResolveLocale(
                internals.NumberFormat['[[availableLocales]]'], requestedLocales, 
                opt, internals.NumberFormat['[[relevantExtensionKeys]]'], localeData
            );

    // 12. Set the [[locale]] internal property of numberFormat to the value of
    //     r.[[locale]].
    internal['[[locale]]'] = r['[[locale]]'];

    // 13. Set the [[numberingSystem]] internal property of numberFormat to the value
    //     of r.[[nu]].
    internal['[[numberingSystem]]'] = r['[[nu]]'];

    var
    // 14. Let dataLocale be the value of r.[[dataLocale]].
        dataLocale = r['[[dataLocale]]'],
    // 15. Let s be the result of calling the GetOption abstract operation with the
    //     arguments options, "style", "string", a List containing the three String
    //     values "decimal", "percent", and "currency", and "decimal".
        s = GetOption(options, 'style', 'string', ['decimal', 'percent', 'currency'],
                'decimal');

    // 16. Set the [[style]] internal property of numberFormat to s.
    internal['[[style]]'] = s;

    var
    // 17. Let c be the result of calling the GetOption abstract operation with the
    //     arguments options, "currency", "string", undefined, and undefined.
        c = GetOption(options, 'currency', 'string');

    // 18. If c is not undefined and the result of calling the
    //     IsWellFormedCurrencyCode abstract operation (defined in 6.3.1) with
    //     argument c is false, then throw a RangeError exception.
    if (c !== undefined && !IsWellFormedCurrencyCode(c))
        throw new RangeError("'" + c + "' is not a valid currency code");

    // 19. If s is "currency" and c is undefined, throw a TypeError exception.
    if (s === 'currency' && c === undefined)
        throw new TypeError('Currency code is required when style is currency');

    // 20. If s is "currency", then
    if (s === 'currency') {
        // a. Let c be the result of converting c to upper case as specified in 6.1.
        c = c.toUpperCase();

        // b. Set the [[currency]] internal property of numberFormat to c.
        internal['[[currency]]'] = c;

        var
        // c. Let cDigits be the result of calling the CurrencyDigits abstract
        //    operation (defined below) with argument c.
            cDigits = CurrencyDigits(c);
    }

    var
    // 21. Let cd be the result of calling the GetOption abstract operation with the
    //     arguments options, "currencyDisplay", "string", a List containing the
    //     three String values "code", "symbol", and "name", and "symbol".
        cd = GetOption(options, 'currencyDisplay', 'string',
                ['code', 'symbol', 'name'], 'symbol');

    // 22. If s is "currency", then set the [[currencyDisplay]] internal property of
    //     numberFormat to cd.
    if (s === 'currency')
        internal['[[currencyDisplay]]'] = cd;


    var
    // 23. Let mnid be the result of calling the GetNumberOption abstract operation
    //     (defined in 9.2.10) with arguments options, "minimumIntegerDigits", 1, 21,
    //     and 1.
        mnid = GetNumberOption(options, 'minimumIntegerDigits', 1, 21, 1);

    // 24. Set the [[minimumIntegerDigits]] internal property of numberFormat to mnid.
    internal['[[minimumIntegerDigits]]'] = mnid;

    var
    // 25. If s is "currency", then let mnfdDefault be cDigits; else let mnfdDefault
    //     be 0.
        mnfdDefault = s === 'currency' ? cDigits : 0,

    // 26. Let mnfd be the result of calling the GetNumberOption abstract operation
    //     with arguments options, "minimumFractionDigits", 0, 20, and mnfdDefault.
        mnfd = GetNumberOption(options, 'minimumFractionDigits', 0, 20, mnfdDefault);

    // 27. Set the [[minimumFractionDigits]] internal property of numberFormat to mnfd.
    internal['[[minimumFractionDigits]]'] = mnfd;

    var
    // 28. If s is "currency", then let mxfdDefault be max(mnfd, cDigits); else if s
    //     is "percent", then let mxfdDefault be max(mnfd, 0); else let mxfdDefault
    //     be max(mnfd, 3).
        mxfdDefault = s === 'currency' ? Math.max(mnfd, cDigits)
                    : (s === 'percent' ? Math.max(mnfd, 0) : Math.max(mnfd, 3)),
    // 29. Let mxfd be the result of calling the GetNumberOption abstract operation
    //     with arguments options, "maximumFractionDigits", mnfd, 20, and mxfdDefault.
        mxfd = GetNumberOption(options, 'maximumFractionDigits', mnfd, 20, mxfdDefault);

    // 30. Set the [[maximumFractionDigits]] internal property of numberFormat to mxfd.
    internal['[[maximumFractionDigits]]'] = mxfd;

    var
    // 31. Let mnsd be the result of calling the [[Get]] internal method of options
    //     with argument "minimumSignificantDigits".
        mnsd = options.minimumSignificantDigits,
    // 32. Let mxsd be the result of calling the [[Get]] internal method of options
    //     with argument "maximumSignificantDigits".
        mxsd = options.maximumSignificantDigits;

    // 33. If mnsd is not undefined or mxsd is not undefined, then:
    if (mnsd !== undefined || mxsd !== undefined) {
        // a. Let mnsd be the result of calling the GetNumberOption abstract
        //    operation with arguments options, "minimumSignificantDigits", 1, 21,
        //    and 1.
        mnsd = GetNumberOption(options, 'minimumSignificantDigits', 1, 21, 1);
        // b. Let mxsd be the result of calling the GetNumberOption abstract
        //     operation with arguments options, "maximumSignificantDigits", mnsd,
        //     21, and 21.
        mxsd = GetNumberOption(options, 'maximumSignificantDigits', mnsd, 21, 21);

        // c. Set the [[minimumSignificantDigits]] internal property of numberFormat
        //    to mnsd, and the [[maximumSignificantDigits]] internal property of
        //    numberFormat to mxsd.
        internal['[[minimumSignificantDigits]]'] = mnsd;
        internal['[[maximumSignificantDigits]]'] = mxsd;
    }
    var
    // 34. Let g be the result of calling the GetOption abstract operation with the
    //     arguments options, "useGrouping", "boolean", undefined, and true.
        g = GetOption(options, 'useGrouping', 'boolean', undefined, true);

    // 35. Set the [[useGrouping]] internal property of numberFormat to g.
    internal['[[useGrouping]]'] = g;

    var
    // 36. Let dataLocaleData be the result of calling the [[Get]] internal method of
    //     localeData with argument dataLocale.
        dataLocaleData = localeData[dataLocale],
    // 37. Let patterns be the result of calling the [[Get]] internal method of
    //     dataLocaleData with argument "patterns".
        patterns = dataLocaleData.patterns;

    // 38. Assert: patterns is an object (see 11.2.3)


    var
    // 39. Let stylePatterns be the result of calling the [[Get]] internal method of
    //     patterns with argument s.
        stylePatterns = patterns[s];

    // 40. Set the [[positivePattern]] internal property of numberFormat to the
    //     result of calling the [[Get]] internal method of stylePatterns with the
    //     argument "positivePattern".
    internal['[[positivePattern]]'] = stylePatterns.positivePattern;

    // 41. Set the [[negativePattern]] internal property of numberFormat to the
    //     result of calling the [[Get]] internal method of stylePatterns with the
    //     argument "negativePattern".
    internal['[[negativePattern]]'] = stylePatterns.negativePattern;

    // 42. Set the [[boundFormat]] internal property of numberFormat to undefined.
    internal['[[boundFormat]]'] = undefined;

    // 43. Set the [[initializedNumberFormat]] internal property of numberFormat to
    //     true.
    internal['[[initializedNumberFormat]]'] = true;
}

function CurrencyDigits(currency) {
    // When the CurrencyDigits abstract operation is called with an argument currency
    // (which must be an upper case String value), the following steps are taken:

    // 1. If the ISO 4217 currency and funds code list contains currency as an
    // alphabetic code, then return the minor unit value corresponding to the
    // currency from the list; else return 2.
    return /* that first thing ? its minor unit value : */2;
}

/* 11.2.2 */Intl.NumberFormat.supportedLocalesOf = function (locales /*[, options]*/) {
    // When the supportedLocalesOf method of Intl.NumberFormat is called, the
    // following steps are taken:

    var
    // 1. If options is not provided, then let options be undefined.
        options = arguments[1],
    // 2. Let availableLocales be the value of the [[availableLocales]] internal
    //    property of the standard built-in object that is the initial value of
    //    Intl.NumberFormat.
        availableLocales = internals.NumberFormat['[[availableLocales]]'],
    // 3. Let requestedLocales be the result of calling the CanonicalizeLocaleList
    //    abstract operation (defined in 9.2.1) with argument locales.
        requestedLocales = CanonicalizeLocaleList(locales);

    // 4. Return the result of calling the SupportedLocales abstract operation
    //    (defined in 9.2.8) with arguments availableLocales, requestedLocales,
    //    and options.
    return SupportedLocales(availableLocales, requestedLocales, options);
};

/* 11.2.3 */internals.NumberFormat = {
    '[[availableLocales]]': [],
    '[[relevantExtensionKeys]]': ['nu'],
    '[[localeData]]': {}
};

/* 11.3.2 */defineProperty(Intl.NumberFormat.prototype, 'format', {
    // This named accessor property returns a function that formats a number
    // according to the effective locale and the formatting options of this
    // NumberFormat object.
    get: function () {
        var internal = getInternalProperties(this);

        // The value of the [[Get]] attribute is a function that takes the following
        // steps:

        // 1. If the [[boundFormat]] internal property of this NumberFormat object
        //    is undefined, then:
        if (internal['[[boundFormat]]'] === undefined) {
            var
            // a. Let F be a Function object, with internal properties set as
            //    specified for built-in functions in ES5, 15, or successor, and the
            //    length property set to 1, that takes the argument value and
            //    performs the following steps:
                F = function (value) {
                    // i. If value is not provided, then let value be undefined.
                    // ii. Let x be ToNumber(value).
                    // iii. Return the result of calling the FormatNumber abstract
                    //      operation (defined below) with arguments this and x.
                    return FormatNumber(this, /* x = */Number(value));
                },
            // b. Let bind be the standard built-in function object defined in ES5,
            //    15.3.4.5.
            // c. Let bf be the result of calling the [[Call]] internal method of
            //    bind with F as the this value and an argument list containing
            //    the single item this.
                bf = F.bind(this);
            // d. Set the [[boundFormat]] internal property of this NumberFormat
            //    object to bf.
            internal['[[boundFormat]]'] = bf;
        }
        // Return the value of the [[boundFormat]] internal property of this
        // NumberFormat object.
        return internal['[[boundFormat]]'];
    }
});

function FormatNumber (numberFormat, x) {
    // When the FormatNumber abstract operation is called with arguments numberFormat
    // (which must be an object initialized as a NumberFormat) and x (which must be a
    // Number value), it returns a String value representing x according to the
    // effective locale and the formatting options of numberFormat.

    var n,
        internal = getInternalProperties(numberFormat),
        locale = internal['[[locale]]'],
        nums   = internal['[[numberingSystem]]'],
        data   = localeData[locale].numbers,
        ild    = data['symbols-numberSystem-' + nums],

    // 1. Let negative be false.
        negative = false;

    // 2. If the result of isFinite(x) is false, then
    if (isFinite(x) === false) {
        // a. If x is NaN, then let n be an ILD String value indicating the NaN value.
        if (isNaN(x))
            n = ild.nan;

        // b. Else
        else {
            // a. Let n be an ILD String value indicating infinity.
            n = ild.infinity;
            // b. If x < 0, then let negative be true.
            if (x < 0)
                negative = true;
        }
    }
    // 3. Else
    else {
        // a. If x < 0, then
        if (x < 0) {
            // i. Let negative be true.
            negative = true;
            // ii. Let x be -x.
            x = -x;
        }

        // b. If the value of the [[style]] internal property of numberFormat is
        //    "percent", let x be 100 × x.
        if (internal['[[style]]'] === 'percent')
            x *= 100;

        // c. If the [[minimumSignificantDigits]] and [[maximumSignificantDigits]]
        //    internal properties of numberFormat are present, then
        if (hop.call(internal, '[[minimumSignificantDigits]]') &&
                hop.call(internal, '[[maximumSignificantDigits]]'))
            // i. Let n be the result of calling the ToRawPrecision abstract operation
            //    (defined below), passing as arguments x and the values of the
            //    [[minimumSignificantDigits]] and [[maximumSignificantDigits]]
            //    internal properties of numberFormat.
            n = ToRawPrecision(x,
                  internal['[[minimumSignificantDigits]]'],
                  internal['[[maximumSignificantDigits]]']);
        // d. Else
        else
            // i. Let n be the result of calling the ToRawFixed abstract operation
            //    (defined below), passing as arguments x and the values of the
            //    [[minimumIntegerDigits]], [[minimumFractionDigits]], and
            //    [[maximumFractionDigits]] internal properties of numberFormat.
            n = ToRawFixed(x,
                  internal['[[minimumIntegerDigits]]'],
                  internal['[[minimumFractionDigits]]'],
                  internal['[[maximumFractionDigits]]']);

        // e. If the value of the [[numberingSystem]] internal property of
        //    numberFormat matches one of the values in the “Numbering System” column
        //    of Table 2 below, then
        if (numSys[nums]) {
            // i. Let digits be an array whose 10 String valued elements are the
            //    UTF-16 string representations of the 10 digits specified in the
            //    “Digits” column of Table 2 in the row containing the value of the
            //    [[numberingSystem]] internal property.
            var digits = numSys[internal['[[numberingSystem]]']];
            // ii. Replace each digit in n with the value of digits[digit].
            n = String(n).replace(/\d/g, function (digit) {
                return digits[digit];
            });
        }
        // f. Else use an implementation dependent algorithm to map n to the
        //    appropriate representation of n in the given numbering system.
        else
            n = String(n); // ###TODO###

        // g. If n contains the character ".", then replace it with an ILND String
        //    representing the decimal separator.
        n = n.replace(/\./g, ild.decimal);

        // h. If the value of the [[useGrouping]] internal property of numberFormat
        //    is true, then insert an ILND String representing a grouping separator
        //    into an ILND set of locations within the integer part of n.
        if (internal['[[useGrouping]]'] === true) {
            var parts = n.split(ild.decimal);
            parts[0] = parts[0].replace(expInsertGroups, ild.group);

            n = parts.join(ild.group); 
        }
    }

    var
    // 4. If negative is true, then let result be the value of the [[negativePattern]]
    //    internal property of numberFormat; else let result be the value of the
    //    [[positivePattern]] internal property of numberFormat.
        result = internal[negative === true ? '[[negativePattern]]' : '[[positivePattern]]'];

    // 5. Replace the substring "{number}" within result with n.
    result = result.replace('{number}', n);

    // 6. If the value of the [[style]] internal property of numberFormat is
    //    "currency", then:
    if (internal['[[style]]'] === 'currency') {
        var cd,
        // a. Let currency be the value of the [[currency]] internal property of
        //    numberFormat.
            currency = internal['[[currency]]'],
         
        // Shorthand for the currency data
            cData = data.currencies[currency];

        // b. If the value of the [[currencyDisplay]] internal property of
        //    numberFormat is "code", then let cd be currency.
        if (internal['[[currencyDisplay]]'] === 'code')
            cd = currency;
        // c. Else if the value of the [[currencyDisplay]] internal property of
        //    numberFormat is "symbol", then let cd be an ILD string representing
        //    currency in short form. If the implementation does not have such a
        //    representation of currency, then use currency itself.
        else if (internal['[[currencyDisplay]]'] === 'symbol')
            cd = cData ? cData.symbol : currency;
        // d. Else if the value of the [[currencyDisplay]] internal property of
        //    numberFormat is "name", then let cd be an ILD string representing
        //    currency in long form. If the implementation does not have such a
        //    representation of currency, then use currency itself.
        else if (internal['[[currencyDisplay]]'] === 'name')
            cd = cData ? cData['displayName-count-one'] : currency;

        // e. Replace the substring "{currency}" within result with cd.
        result = result.replace('{currency}', cd);
    }
    // 7. Return result.
    return result;
}

function ToRawPrecision (x, minPrecision, maxPrecision) {
    // When the ToRawPrecision abstract operation is called with arguments x (which 
    // must be a finite non-negative number), minPrecision, and maxPrecision (both 
    // must be integers between 1 and 21) the following steps are taken:

    // NOTE: Number.prototype.toPrecision is implemented similarly, so we don't need 
    //       to follow the spec quite as literally as we have been doing.

    var
    // 1. Let p be maxPrecision.
        p = maxPrecision;

    // 2. If x = 0, then
    if (x === 0) {
        var
        // a. Let m be the String consisting of p occurrences of the character "0".
            m = Array (p + 1).join('0'),
        // b. Let e be 0.
            e = 0;
    }
    // 3. Else
    else {
        // a. Let e and n be integers such that 10p–1 ≤ n < 10p and for which the 
        //    exact mathematical value of n × 10e–p+1 – x is as close to zero as 
        //    possible. If there are two such sets of e and n, pick the e and n for 
        //    which n × 10e–p+1 is larger.

        // b. Let m be the String consisting of the digits of the decimal 
        //    representation of n (in order, with no leading zeroes).
    }
    // 4. If e ≥ p, then
    //   a. Return the concatenation of m and e-p+1 occurrences of the character "0".

    // 5. If e = p-1, then
    //   a. Return m.

    // 6. If e ≥ 0, then
    //   a. Let m be the concatenation of the first e+1 characters of m, the character
    //      ".", and the remaining p–(e+1) characters of m.

    // 7. If e < 0, then
    //   a. Let m be the concatenation of the String "0.", –(e+1) occurrences of the 
    //      character "0", and the string m.

    // 8. If m contains the character ".", and maxPrecision > minPrecision, then
    //   a. Let cut be maxPrecision – minPrecision.
    //   b. Repeat while cut > 0 and the last character of m is "0":
    //      i. Remove the last character from m.
    //     ii. Decrease cut by 1.
    //   c. If the last character of m is ".", then
    //      i. Remove the last character from m.

    // 9. Return m.
}

function ToRawFixed (x, minInteger, minFraction, maxFraction) {
    // When the ToRawFixed abstract operation is called with arguments x (which must
    // be a finite non-negative number), minInteger (which must be an integer between
    // 1 and 21), minFraction, and maxFraction (which must be integers between 0 and
    // 20) the following steps are taken:

    // (or not because Number.toPrototype.toFixed does a lot of it for us)
    var
        // We can pick up after the fixed formatted string (m) is created
        m   = Number.prototype.toFixed.call(x, maxFraction),

        // 4. If [maxFraction] ≠ 0, then 
        //    ...
        //    e. Let int be the number of characters in a.
        //
        // 5. Else let int be the number of characters in m.
        igr = m.split(".")[0].length,  // int is a reserved word

        // 6. Let cut be maxFraction – minFraction.
        cut = maxFraction - minFraction;

    // 7. Repeat while cut > 0 and the last character of m is "0":
    while (cut > 0 && m.slice(-1) === "0") {
        // a. Remove the last character from m.
        m = m.slice(0, -1);

        // b. Decrease cut by 1.
        cut--;
    }

    // 8. If the last character of m is ".", then
    if (m.slice(-1) === ".")
        // a. Remove the last character from m.
        m = m.slice(0, -1);

    // 9. If int < minInteger, then
    if (igr < minInteger)
        // a. Let z be the String consisting of minInteger–int occurrences of the 
        //    character "0".
        var z = Array(minInteger - igr + 1).join("0");

    // 10. Let m be the concatenation of Strings z and m.
    // 11. Return m.
    return (z ? z : '') + m;
}

// Sect 11.3.2 Table 2, Numbering systems
// ======================================
var numSys = {
    arab:    [ '\u0660', '\u0661', '\u0662', '\u0663', '\u0664', '\u0665', '\u0666', '\u0667', '\u0668', '\u0669' ],
    arabext: [ '\u06F0', '\u06F1', '\u06F2', '\u06F3', '\u06F4', '\u06F5', '\u06F6', '\u06F7', '\u06F8', '\u06F9' ],
    bali:    [ '\u1B50', '\u1B51', '\u1B52', '\u1B53', '\u1B54', '\u1B55', '\u1B56', '\u1B57', '\u1B58', '\u1B59' ],
    beng:    [ '\u09E6', '\u09E7', '\u09E8', '\u09E9', '\u09EA', '\u09EB', '\u09EC', '\u09ED', '\u09EE', '\u09EF' ],
    deva:    [ '\u0966', '\u0967', '\u0968', '\u0969', '\u096A', '\u096B', '\u096C', '\u096D', '\u096E', '\u096F' ],
    fullwide:[ '\uFF10', '\uFF11', '\uFF12', '\uFF13', '\uFF14', '\uFF15', '\uFF16', '\uFF17', '\uFF18', '\uFF19' ],
    gujr:    [ '\u0AE6', '\u0AE7', '\u0AE8', '\u0AE9', '\u0AEA', '\u0AEB', '\u0AEC', '\u0AED', '\u0AEE', '\u0AEF' ],
    guru:    [ '\u0A66', '\u0A67', '\u0A68', '\u0A69', '\u0A6A', '\u0A6B', '\u0A6C', '\u0A6D', '\u0A6E', '\u0A6F' ],
    hanidec: [ '\u3007', '\u4E00', '\u4E8C', '\u4E09', '\u56DB', '\u4E94', '\u516D', '\u4E03', '\u516B', '\u4E5D' ],
    khmr:    [ '\u17E0', '\u17E1', '\u17E2', '\u17E3', '\u17E4', '\u17E5', '\u17E6', '\u17E7', '\u17E8', '\u17E9' ],
    knda:    [ '\u0CE6', '\u0CE7', '\u0CE8', '\u0CE9', '\u0CEA', '\u0CEB', '\u0CEC', '\u0CED', '\u0CEE', '\u0CEF' ],
    laoo:    [ '\u0ED0', '\u0ED1', '\u0ED2', '\u0ED3', '\u0ED4', '\u0ED5', '\u0ED6', '\u0ED7', '\u0ED8', '\u0ED9' ],
    latn:    [ '\u0030', '\u0031', '\u0032', '\u0033', '\u0034', '\u0035', '\u0036', '\u0037', '\u0038', '\u0039' ],
    limb:    [ '\u1946', '\u1947', '\u1948', '\u1949', '\u194A', '\u194B', '\u194C', '\u194D', '\u194E', '\u194F' ],
    mlym:    [ '\u0D66', '\u0D67', '\u0D68', '\u0D69', '\u0D6A', '\u0D6B', '\u0D6C', '\u0D6D', '\u0D6E', '\u0D6F' ],
    mong:    [ '\u1810', '\u1811', '\u1812', '\u1813', '\u1814', '\u1815', '\u1816', '\u1817', '\u1818', '\u1819' ],
    mymr:    [ '\u1040', '\u1041', '\u1042', '\u1043', '\u1044', '\u1045', '\u1046', '\u1047', '\u1048', '\u1049' ],
    orya:    [ '\u0B66', '\u0B67', '\u0B68', '\u0B69', '\u0B6A', '\u0B6B', '\u0B6C', '\u0B6D', '\u0B6E', '\u0B6F' ],
    tamldec: [ '\u0BE6', '\u0BE7', '\u0BE8', '\u0BE9', '\u0BEA', '\u0BEB', '\u0BEC', '\u0BED', '\u0BEE', '\u0BEF' ],
    telu:    [ '\u0C66', '\u0C67', '\u0C68', '\u0C69', '\u0C6A', '\u0C6B', '\u0C6C', '\u0C6D', '\u0C6E', '\u0C6F' ],
    thai:    [ '\u0E50', '\u0E51', '\u0E52', '\u0E53', '\u0E54', '\u0E55', '\u0E56', '\u0E57', '\u0E58', '\u0E59' ],
    tibt:    [ '\u0F20', '\u0F21', '\u0F22', '\u0F23', '\u0F24', '\u0F25', '\u0F26', '\u0F27', '\u0F28', '\u0F29' ]
};

/* 11.3.3 */Intl.NumberFormat.prototype.resolvedOptions = function () {
    // This function provides access to the locale and formatting options computed 
    // during initialization of the object.
    //
    // The function returns a new object whose properties and attributes are set as 
    // if constructed by an object literal assigning to each of the following 
    // properties the value of the corresponding internal property of this 
    // NumberFormat object (see 11.4): locale, numberingSystem, style, currency, 
    // currencyDisplay, minimumIntegerDigits, minimumFractionDigits, 
    // maximumFractionDigits, minimumSignificantDigits, maximumSignificantDigits, and 
    // useGrouping. Properties whose corresponding internal properties are not present 
    // are not assigned.
    var ret   = {},
        props = [
            'numberingSystem', 'style', 'currency', 'currencyDisplay', 'minimumIntegerDigits', 
            'minimumFractionDigits', 'maximumFractionDigits', 'minimumSignificantDigits', 
            'maximumSignificantDigits', 'useGrouping'
        ],
        internal = getInternalProperties(this);

    props.forEach(function (el) {
        var val;
        if ((val = internal['[['+el+']]']) !== undefined)
            ret[el] = val;
    });

    return ret;
};

/* 13.2.1 */defineProperty(Number.prototype, 'toLocaleString', {
    writable: true,
    configurable: true,
    value: function () {
        // When the toLocaleString method is called with optional arguments locales
        // and options, the following steps are taken:

        // 1. Let x be this Number value (as defined in ES5, 15.7.4).
        // 2. If locales is not provided, then let locales be undefined.
        // 3. If options is not provided, then let options be undefined.
        // 4. Let numberFormat be the result of creating a new object as if by the 
        //    expression new Intl.NumberFormat(locales, options) where
        //    Intl.NumberFormat is the standard built-in constructor defined in 11.1.3.
        // 5. Return the result of calling the FormatNumber abstract operation 
        //    (defined in 11.3.2) with arguments numberFormat and x.
        return FormatNumber(new Intl.NumberFormat(arguments[0], arguments[1]), this);
    }
});

/**
 * Can't really ship a single script with data for hundreds of locales, so we provide
 * this __addLocaleData method as a means for the developer to add the data on an 
 * as-needed basis
 */
defineProperty(Intl, '__addLocaleData', {
    value: function (data) {
        if (!data.identity)
            throw new Error('Must pass valid CLDR data parsed into a JavaScript object.');

        var add,
            locale = data.identity.language;

        if (add = data.identity.script)
            locale += '-' + add;
        if (add = data.identity.territory)
            locale += '-' + add;

        localeData[locale] = data;

        // Add to NumberFormat internal properties as per 11.2.3
        if (data.numbers) {
            var defNumSys = data.numbers.defaultNumberingSystem,
                nu = [ defNumSys ],
                
                // 11.2.3 says nu can't contain these:
                nuNo = {
                    native:   1,
                    traditio: 1,
                    finanice: 1
                };

            for (var k in data.numbers.otherNumberingSystems) {
                var v = data.numbers.otherNumberingSystems[k];

                if (v != defNumSys && !hop.call(nuNo, v))
                    nu.push(v);
            }

            // Build patterns for each number style
            var currencyPattern = 
                    data.numbers['currencyFormats-numberSystem-'+defNumSys]
                        .standard.currencyFormat.pattern
                            .replace('#,##0.00', '{number}')
                            .replace('¤', '{currency}'),

                percentPattern =
                    data.numbers['percentFormats-numberSystem-'+defNumSys]
                        .standard.percentFormat.pattern
                            .replace('#,##0', '{number}');

            internals.NumberFormat['[[availableLocales]]'].push(locale);
            internals.NumberFormat['[[localeData]]'][locale] = {
                nu: nu,
                patterns: {
                    decimal: {
                        positivePattern: '{number}',
                        negativePattern: '-{number}'  
                    },
                    percent: {
                        positivePattern: percentPattern,
                        negativePattern: '-' + percentPattern  
                    },
                    currency: {
                        positivePattern: currencyPattern,
                        negativePattern: '-' + currencyPattern 
                    }
                }
            };
        }
    }
});

// Exposed for debugging
window.IntlLocaleData = localeData;

// Helper functions
// ================

/**
 * Mimics ES5's abstract ToObject() function
 */
function toObject (arg) {
    if (arg == null)
        throw new TypeError('Cannot convert null or undefined to object');

    return Object(arg);
}

/**
 * Returns "internal" properties for an object
 */
function getInternalProperties (obj) {
    if (hop.call(obj, '__getInternalProperties'))
        return obj.__getInternalProperties(secret);
    else
        return Object.create ? Object.create(null) : {};
}

return Intl;
})({});
