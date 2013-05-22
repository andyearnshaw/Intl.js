/*jshint proto:true, eqnull:true, boss:true, laxbreak:true, newcap:false, shadow:true, funcscope:true */
if (typeof window !== 'undefined')
    window.OldIntl = window.Intl;

var Intl = /*window.Intl || */(function (Intl) {
// Copyright 2013 Andy Earnshaw, MIT License

/**
 * Implements the ECMAScript Internationalization API in ES5-compatible environments,
 * following the ECMA-402 specification as closely as possible
 *
 * ECMA-402: http://ecma-international.org/ecma-402/1.0/
 *
 * CLDR format locale data should be provided using Intl.__addLocaleData().
 */

"use strict";
var
    // We use this a lot (and need it for proto-less objects)
    hop = Object.prototype.hasOwnProperty,

    // Naive defineProperty for compatibility
    defineProperty = Object.defineProperty || function (obj, name, desc) {
        if (desc.get && obj.__defineGetter__)
            obj.__defineGetter(name, desc.get);
        else
            obj[name] = desc.value || desc.get;
    },

    // Array.prototype.indexOf, as good as we need it to be
    arrIndexOf = Array.prototype.indexOf || function (search) {
        /*jshint validthis:true */
        var t = this;
        if (!t.length)
            return -1;

        for (var i = arguments[1] || 0, max = t.length; i < max; i++) {
            if (t[i] === search)
                return i;
        }
    },

    // Create an object with the specified prototype (2nd arg isn't necessary for Intl)
    objCreate = Object.create || function (proto) {
        function F() {}
        F.prototype = proto;
        return new F();
    },

    // Private object houses our locale data for each locale
    localeData = {},

    // Default locale is the first-added locale data for us
    defaultLocale,

    // Object housing internal properties for constructors
    internals = objCreate(null),

    // Keep internal properties internal
    secret = Math.random(),

    // CLDR weekday key mappings
    weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],

    // Some regular expressions we're using
    expInsertGroups = /(?=(?!^)(?:\d{3})+(?!\d))/g,
    expCurrencyCode = /^[A-Z]{3}$/,
    expUnicodeExSeq = /-u(?:-[0-9a-z]{2,8})+/gi, // See `extension` below

    expBCP47Syntax,
    expExtSequences,
    expVariantDupes,
    expSingletonDupes,

    // Currency minor units output from tools/getISO4217data.js and formatted
    currencyMinorUnits = {
        AFN: 2, EUR: 2, ALL: 2, DZD: 2, USD: 2, AOA: 2, XCD: 2, ARS: 2,
        AMD: 2, AWG: 2, AUD: 2, AZN: 2, BSD: 2, BHD: 3, BDT: 2, BBD: 2,
        BYR: 0, BZD: 2, XOF: 0, BMD: 2, BTN: 2, INR: 2, BOB: 2, BOV: 2,
        BAM: 2, BWP: 2, NOK: 2, BRL: 2, BND: 2, BGN: 2, BIF: 0, KHR: 2,
        XAF: 0, CAD: 2, CVE: 2, KYD: 2, CLF: 0, CLP: 0, CNY: 2, COP: 2,
        COU: 2, KMF: 0, CDF: 2, NZD: 2, CRC: 2, HRK: 2, CUC: 2, CUP: 2,
        ANG: 2, CZK: 2, DKK: 2, DJF: 0, DOP: 2, EGP: 2, SVC: 2, ERN: 2,
        ETB: 2, FKP: 2, FJD: 2, XPF: 0, GMD: 2, GEL: 2, GHS: 2, GIP: 2,
        GTQ: 2, GBP: 2, GNF: 0, GYD: 2, HTG: 2, HNL: 2, HKD: 2, HUF: 2,
        ISK: 0, IDR: 2
    };

/**
 * Defines regular expressions for various operations related to the BCP 47 syntax,
 * as defined at http://tools.ietf.org/html/bcp47#section-2.1
 */
(function () {
    var
        // extlang       = 3ALPHA              ; selected ISO 639 codes
        //                 *2("-" 3ALPHA)      ; permanently reserved
        extlang = '[a-z]{3}(?:-[a-z]{3}){0,2}',

        // language      = 2*3ALPHA            ; shortest ISO 639 code
        //                 ["-" extlang]       ; sometimes followed by
        //                                     ; extended language subtags
        //               / 4ALPHA              ; or reserved for future use
        //               / 5*8ALPHA            ; or registered language subtag
        language = '(?:[a-z]{2,3}(?:-' + extlang + ')?|[a-z]{4}|[a-z]{5,8})',

        // script        = 4ALPHA              ; ISO 15924 code
        script = '[a-z]{4}',

        // region        = 2ALPHA              ; ISO 3166-1 code
        //               / 3DIGIT              ; UN M.49 code
        region = '(?:[a-z]{2}|\\d{3})',

        // variant       = 5*8alphanum         ; registered variants
        //               / (DIGIT 3alphanum)
        variant = '(?:[a-z0-9]{5,8}|\\d[a-z0-9]{3})',

        //                                     ; Single alphanumerics
        //                                     ; "x" reserved for private use
        // singleton     = DIGIT               ; 0 - 9
        //               / %x41-57             ; A - W
        //               / %x59-5A             ; Y - Z
        //               / %x61-77             ; a - w
        //               / %x79-7A             ; y - z
        singleton = '[0-9a-wy-z]',

        // extension     = singleton 1*("-" (2*8alphanum))
        extension = singleton + '(?:-[a-z0-9]{2,8})+',

        // privateuse    = "x" 1*("-" (1*8alphanum))
        privateuse = 'x(?:-[a-z0-9]{1,8})+',

        // irregular     = "en-GB-oed"         ; irregular tags do not match
        //               / "i-ami"             ; the 'langtag' production and
        //               / "i-bnn"             ; would not otherwise be
        //               / "i-default"         ; considered 'well-formed'
        //               / "i-enochian"        ; These tags are all valid,
        //               / "i-hak"             ; but most are deprecated
        //               / "i-klingon"         ; in favor of more modern
        //               / "i-lux"             ; subtags or subtag
        //               / "i-mingo"           ; combination
        //               / "i-navajo"
        //               / "i-pwn"
        //               / "i-tao"
        //               / "i-tay"
        //               / "i-tsu"
        //               / "sgn-BE-FR"
        //               / "sgn-BE-NL"
        //               / "sgn-CH-DE"
        irregular = '(?:en-GB-oed'
                  + '|i-(?:ami|bnn|default|enochian|hak|klingon|lux|mingo|navajo|pwn|tao|tay|tsu)'
                  + '|sgn-(?:BE-FR|BE-NL|CH-DE))',

        // regular       = "art-lojban"        ; these tags match the 'langtag'
        //               / "cel-gaulish"       ; production, but their subtags
        //               / "no-bok"            ; are not extended language
        //               / "no-nyn"            ; or variant subtags: their meaning
        //               / "zh-guoyu"          ; is defined by their registration
        //               / "zh-hakka"          ; and all of these are deprecated
        //               / "zh-min"            ; in favor of a more modern
        //               / "zh-min-nan"        ; subtag or sequence of subtags
        //               / "zh-xiang"
        regular = '(?:art-lojban|cel-gaulish|no-bok|no-nyn'
                + '|zh-(?:guoyu|hakka|min|min-nan|xiang))',

        // grandfathered = irregular           ; non-redundant tags registered
        //               / regular             ; during the RFC 3066 era
        grandfathered = '(?:' + irregular + '|' + regular + ')',

        // langtag       = language
        //                 ["-" script]
        //                 ["-" region]
        //                 *("-" variant)
        //                 *("-" extension)
        //                 ["-" privateuse]
        langtag = language + '(?:-' + script + ')?(?:-' + region + ')?(?:-'
                + variant + ')*(?:-' + extension + ')*(?:-' + privateuse + ')?';

    // Language-Tag  = langtag             ; normal language tags
    //               / privateuse          ; private use tag
    //               / grandfathered       ; grandfathered tags
    expBCP47Syntax = RegExp('^(?:'+langtag+'|'+privateuse+'|'+grandfathered+')$', 'i');

    // Match duplicate variants in a language tag
    expVariantDupes = RegExp('\\b('+variant+')-(?:\\w{4,8}-)*\\1\\b', 'i');

    // Match duplicate singletons in a language tag
    expSingletonDupes = RegExp('\\b('+singleton+')-(?:\\w+-)*\\1\\b', 'i');

    // Match all extension sequences
    expExtSequences = RegExp('-'+extension, 'ig');
})();

// Sect 6.2 Language Tags
// ======================

/**
 * The IsStructurallyValidLanguageTag abstract operation verifies that the locale
 * argument (which must be a String value)
 *
 * - represents a well-formed BCP 47 language tag as specified in RFC 5646 section
 *   2.1, or successor,
 * - does not include duplicate variant subtags, and
 * - does not include duplicate singleton subtags.
 *
 * The abstract operation returns true if locale can be generated from the ABNF
 * grammar in section 2.1 of the RFC, starting with Language-Tag, and does not
 * contain duplicate variant or singleton subtags (other than as a private use
 * subtag). It returns false otherwise. Terminal value characters in the grammar are
 * interpreted as the Unicode equivalents of the ASCII octet values given.
 */
function /* 6.2.2 */IsStructurallyValidLanguageTag(locale) {
    // represents a well-formed BCP 47 language tag as specified in RFC 5646
    if (!expBCP47Syntax.test(locale))
        return false;

    // does not include duplicate variant subtags, and
    if (expVariantDupes.test(locale))
        return false;

    // does not include duplicate singleton subtags.
    if (expSingletonDupes.test(locale))
        return false;

    return true;
}

/**
 * The CanonicalizeLanguageTag abstract operation returns the canonical and case-
 * regularized form of the locale argument (which must be a String value that is
 * a structurally valid BCP 47 language tag as verified by the
 * IsStructurallyValidLanguageTag abstract operation). It takes the steps
 * specified in RFC 5646 section 4.5, or successor, to bring the language tag
 * into canonical form, and to regularize the case of the subtags, but does not
 * take the steps to bring a language tag into “extlang form” and to reorder
 * variant subtags.

 * The specifications for extensions to BCP 47 language tags, such as RFC 6067,
 * may include canonicalization rules for the extension subtag sequences they
 * define that go beyond the canonicalization rules of RFC 5646 section 4.5.
 * Implementations are allowed, but not required, to apply these additional rules.
 */
function /* 6.2.3 */CanonicalizeLanguageTag (locale) {
    var match, parts;

    // A language tag is in 'canonical form' when the tag is well-formed
    // according to the rules in Sections 2.1 and 2.2

    // Section 2.1 says all subtags use lowercase...
    locale = locale.toLowerCase();

    // ...with 2 exceptions: 'two-letter and four-letter subtags that neither
    // appear at the start of the tag nor occur after singletons.  Such two-letter
    // subtags are all uppercase (as in the tags "en-CA-x-ca" or "sgn-BE-FR") and
    // four-letter subtags are titlecase (as in the tag "az-Latn-x-latn").
    parts = locale.split('-');
    for (var i = 1, max = parts.length; i < max; i++) {
        // Two-letter subtags are all uppercase
        if (parts[i].length === 2)
            parts[i] = parts[i].toUpperCase();

        // Four-letter subtags are titlecase
        else if (parts[i].length === 4)
            parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].slice(1);

        // Is it a singleton?
        else if (parts[i].length === 1 && parts[i] != 'x')
            break;
    }
    locale = parts.join('-');

    // The steps laid out in RFC 5646 section 4.5 are as follows:

    // 1.  Extension sequences are ordered into case-insensitive ASCII order
    //     by singleton subtag.
    if ((match = locale.match(expExtSequences)) && match.length > 1) {
        // The built-in sort() sorts by ASCII order, so use that
        match.sort();

        // Replace all extensions with the joined, sorted array
        locale = locale.replace(
            RegExp('(?:' + expExtSequences.source + ')+', 'i'),
            match.join('')
        );
    }

    // ###TODO###
    // 2.  Redundant or grandfathered tags are replaced by their 'Preferred-
    //     Value', if there is one.

    // 3.  Subtags are replaced by their 'Preferred-Value', if there is one.
    //     For extlangs, the original primary language subtag is also
    //     replaced if there is a primary language subtag in the 'Preferred-
    //     Value'.

    return locale;
}

/**
 * The DefaultLocale abstract operation returns a String value representing the
 * structurally valid (6.2.2) and canonicalized (6.2.3) BCP 47 language tag for the
 * host environment’s current locale.
 */
function /* 6.2.4 */DefaultLocale () {
    return defaultLocale;
}

// Sect 6.3 Currency Codes
// =======================

/**
 * The IsWellFormedCurrencyCode abstract operation verifies that the currency argument
 * (after conversion to a String value) represents a well-formed 3-letter ISO currency
 * code. The following steps are taken:
 */
function /* 6.3.1 */IsWellFormedCurrencyCode(currency) {
    var
        // 1. Let `c` be ToString(currency)
        c = String(currency),

        // 2. Let `normalized` be the result of mapping c to upper case as described
        //    in 6.1.
        normalized = toLatinUperCase(c);

    // 3. If the string length of normalized is not 3, return false.
    // 4. If normalized contains any character that is not in the range "A" to "Z"
    //    (U+0041 to U+005A), return false.
    if (expCurrencyCode.test(normalized) === false)
        return false;

    // 5. Return true
    return true;
}

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
            if (arrIndexOf.call(seen, tag) === -1)
                seen.push(tag);
        }

        // d. Increase k by 1.
        k++;
    }
    // 9. Return seen.
    return seen;
}

/**
 * The BestAvailableLocale abstract operation compares the provided argument
 * locale, which must be a String value with a structurally valid and
 * canonicalized BCP 47 language tag, against the locales in availableLocales and
 * returns either the longest non-empty prefix of locale that is an element of
 * availableLocales, or undefined if there is no such element. It uses the
 * fallback mechanism of RFC 4647, section 3.4. The following steps are taken:
 */
function /* 9.2.2 */BestAvailableLocale (availableLocales, locale) {
    var
       // 1. Let candidate be locale
       candidate = locale;

    // 2. Repeat
    while (true) {
        // a. If availableLocales contains an element equal to candidate, then return
        // candidate.
        if (arrIndexOf.call(availableLocales, candidate) > -1)
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

/**
 * The LookupMatcher abstract operation compares requestedLocales, which must be
 * a List as returned by CanonicalizeLocaleList, against the locales in
 * availableLocales and determines the best available language to meet the
 * request. The following steps are taken:
 */
function /* 9.2.3 */LookupMatcher (availableLocales, requestedLocales) {
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
        result = objCreate(null);

    // 6. If availableLocale is not undefined, then
    if (availableLocale !== undefined) {
        // a. Set result.[[locale]] to availableLocale.
        result['[[locale]]'] = availableLocale;

        // b. If locale and noExtensionsLocale are not the same String value, then
        if (String(locale) !== String(noExtensionsLocale)) {
            var
                // i. Let extension be the String value consisting of the first
                //    substring of locale that is a Unicode locale extension sequence.
                extension = locale.match(expUnicodeExSeq)[0],

                // ii. Let extensionIndex be the character position of the initial
                //     "-" of the first Unicode locale extension sequence within locale.
                extensionIndex = locale.indexOf('-u-');

            // iii. Set result.[[extension]] to extension.
            result['[[extension]]'] = extension;

            // iv. Set result.[[extensionIndex]] to extensionIndex.
            result['[[extensionIndex]]'] = extensionIndex;
        }
    }
    // 7. Else
    else
        // a. Set result.[[locale]] to the value returned by the DefaultLocale abstract
        //    operation (defined in 6.2.4).
        result['[[locale]]'] = DefaultLocale();

    // 8. Return result
    return result;
}

/**
 * The BestFitMatcher abstract operation compares requestedLocales, which must be
 * a List as returned by CanonicalizeLocaleList, against the locales in
 * availableLocales and determines the best available language to meet the
 * request. The algorithm is implementation dependent, but should produce results
 * that a typical user of the requested locales would perceive as at least as
 * good as those produced by the LookupMatcher abstract operation. Options
 * specified through Unicode locale extension sequences must be ignored by the
 * algorithm. Information about such subsequences is returned separately.
 * The abstract operation returns a record with a [[locale]] field, whose value
 * is the language tag of the selected locale, which must be an element of
 * availableLocales. If the language tag of the request locale that led to the
 * selected locale contained a Unicode locale extension sequence, then the
 * returned record also contains an [[extension]] field whose value is the first
 * Unicode locale extension sequence, and an [[extensionIndex]] field whose value
 * is the index of the first Unicode locale extension sequence within the request
 * locale language tag.
 */
function /* 9.2.4 */BestFitMatcher (availableLocales, requestedLocales) {
    return LookupMatcher(availableLocales, requestedLocales);
}

/**
 * The ResolveLocale abstract operation compares a BCP 47 language priority list
 * requestedLocales against the locales in availableLocales and determines the
 * best available language to meet the request. availableLocales and
 * requestedLocales must be provided as List values, options as a Record.
 */
function /* 9.2.5 */ResolveLocale (availableLocales, requestedLocales, options,
                                                 relevantExtensionKeys, localeData) {

    if (availableLocales.length === 0)
        throw new ReferenceError(
            'No locale data has been provided for this object yet.'
            + ' (protip: use Intl.__addLocaleData(data))'
        );

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
            indexOf = arrIndexOf;

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

/**
 * The LookupSupportedLocales abstract operation returns the subset of the
 * provided BCP 47 language priority list requestedLocales for which
 * availableLocales has a matching locale when using the BCP 47 Lookup algorithm.
 * Locales appear in the same order in the returned list as in requestedLocales.
 * The following steps are taken:
 */
function /* 9.2.6 */LookupSupportedLocales (availableLocales, requestedLocales) {
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

/**
 * The BestFitSupportedLocales abstract operation returns the subset of the
 * provided BCP 47 language priority list requestedLocales for which
 * availableLocales has a matching locale when using the Best Fit Matcher
 * algorithm. Locales appear in the same order in the returned list as in
 * requestedLocales. The steps taken are implementation dependent.
 */
function /*9.2.7 */BestFitSupportedLocales (availableLocales, requestedLocales) {
    // ###TODO: implement this function as described by the specification###
    return LookupSupportedLocales(availableLocales, requestedLocales);
}

/**
 * The SupportedLocales abstract operation returns the subset of the provided BCP
 * 47 language priority list requestedLocales for which availableLocales has a
 * matching locale. Two algorithms are available to match the locales: the Lookup
 * algorithm described in RFC 4647 section 3.4, and an implementation dependent
 * best-fit algorithm. Locales appear in the same order in the returned list as
 * in requestedLocales. The following steps are taken:
 */
function /*9.2.8 */SupportedLocales (availableLocales, requestedLocales, options) {
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

/**
 * The GetOption abstract operation extracts the value of the property named
 * property from the provided options object, converts it to the required type,
 * checks whether it is one of a List of allowed values, and fills in a fallback
 * value if necessary.
 */
function /*9.2.9 */GetOption (options, property, type, values, fallback) {
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
            if (arrIndexOf.call(values, value) === -1)
                throw new RangeError("'" + value + "' is not an allowed value for `" + property +'`');
        }

        // e. Return value.
        return value;
    }
    // Else return fallback.
    return fallback;
}

/**
 * The GetNumberOption abstract operation extracts a property value from the
 * provided options object, converts it to a Number value, checks whether it is
 * in the allowed range, and fills in a fallback value if necessary.
 */
function /* 9.2.10 */GetNumberOption (options, property, minimum, maximum, fallback) {
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

/**
 * The abstract operation InitializeCollator accepts the arguments collator
 * (which must be an object), locales, and options. It initializes collator as a
 * Collator object.
 */
function /*10.1.1.1 */InitializeCollator (collator, locales, options) {
    // This will be a internal properties object if we're not already initialized
    var internal = getInternalProperties(collator);

    // The following steps are taken:

    // 1. If collator has an [[initializedIntlObject]] internal property with value true,
    //    throw a TypeError exception.
    if (internal['[[initializedIntlObject]]'] === true)
        throw new TypeError('Collator object has already been initialized');

    // 2. Set the [[initializedIntlObject]] internal property of collator to true.
    internal['[[initializedIntlObject]]'] = true;

    var
    // 3. Let requestedLocales be the result of calling the CanonicalizeLocaleList
    //    abstract operation (defined in 9.2.1) with argument locales.
        requestedLocales = CanonicalizeLocaleList(locales);

    // 4. If options is undefined, then
    if (options === undefined)
        // a. Let options be the result of creating a new object as if by the expression
        //    new Object() where Object is the standard built-in constructor with that
        //    name.
        options = {};

    // 5. Else
    else
        // a. Let options be ToObject(options).
        options = ToObject(options);

    var
    // 6. Let u be the result of calling the GetOption abstract operation (defined in
    //    9.2.9) with arguments options, "usage", "string", a List containing the two
    //    String values "sort" and "search", and "sort".
        u = GetOption(options, 'usage', 'string', ['sort', 'search'], 'sort');

    // 7. Set the [[usage]] internal property of collator to u.
    internal['[[usage]]'] = u;

    var
    // 8. Let Collator be the standard built-in object that is the initial value of
    //    Intl.Collator.
        Collator = Intl.Collator;

    // 9. If u is "sort", then let localeData be the value of the [[sortLocaleData]]
    //    internal property of Collator; else let localeData be the value of the
    //    [[searchLocaleData]] internal property of Collator.
    if (u === 'sort')
        var localeData = internals.Collator['[[sortLocaleData]]'];

    var
    // 10. Let opt be a new Record.
        opt = {},

    // 11. Let matcher be the result of calling the GetOption abstract operation with
    //     arguments options, "localeMatcher", "string", a List containing the two String
    //     values "lookup" and "best fit", and "best fit".
        matcher = GetOption(options, 'localeMatcher', 'string', ['lookup', 'best fit'], 'best fit');

    // 12. Set opt.[[localeMatcher]] to matcher.
    opt['[[localeMatcher]]'] = matcher;

    // 13. For each row in Table 1, except the header row, do:
    for (var key in collatorOptions) {
        if (!hop.call(collatorOptions, key))
            continue;

        var
        // a. Let key be the name given in the Key column of the row.
        // b. Let value be the result of calling the GetOption abstract operation, passing
        //    as arguments options, the name given in the Property column of the row, the
        //    string given in the Type column of the row, a List containing the Strings
        //    given in the Values column of the row or undefined if no strings are given,
        //    and undefined.
            value = GetOption(options, collatorOptions[key].property,
                                    collatorOptions[key].type, collatorOptions[key].value);

        // c. If the string given in the Type column of the row is "boolean" and value is
        //    not undefined, then
        if (collatorOptions[key].type === 'boolean' && value !== undefined)
            // i. Let value be ToString(value).
            value = String(value);

        // d. Set opt.[[<key>]] to value.
        opt['[['+ key +']]'] = value;
    }

    var
    // 14. Let relevantExtensionKeys be the value of the [[relevantExtensionKeys]]
    //     internal property of Collator.
        relevantExtensionKeys = internals.Collator['[[relevantExtensionKeys]]'],

    // 15. Let r be the result of calling the ResolveLocale abstract operation (defined in
    //     9.2.5) with the [[availableLocales]] internal property of Collator,
    //     requestedLocales, opt, relevantExtensionKeys, and localeData.
        r = ResolveLocale(internals.Collator['[[availableLocales]]'], requestedLocales, opt,
                                                              relevantExtensionKeys, localeData);

    // 16. Set the [[locale]] internal property of collator to the value of r.[[locale]].
    internal['[[locale]]'] = r['[[locale]]'];

    var
    // 17. Let i be 0.
        i = 0,

    // 18. Let len be the result of calling the [[Get]] internal method of
    //     relevantExtensionKeys with argument "length".
        len = relevantExtensionKeys.length;

    // 19. Repeat while i < len:
    while (i < len) {
        var
        // a. Let key be the result of calling the [[Get]] internal method of
        //    relevantExtensionKeys with argument ToString(i).
            key = relevantExtensionKeys[String(i)];

        // b. If key is "co", then
        if (key === 'co') {
            var
            // i. Let property be "collation".
                property = 'collation',

            // ii. Let value be the value of r.[[co]].
                value = r['[[co]]'];

            // iii. If value is null, then let value be "default".
            if (value === null)
                value = 'default';
        }
        // c. Else use the row of Table 1 that contains the value of key in the Key
        //    column:
        else {
            var
            // i. Let property be the name given in the Property column of the row.
                property = collatorOptions[key].property,

            // ii. Let value be the value of r.[[<key>]].
                value = r['[['+ key +']]'];

            // iii. If the name given in the Type column of the row is "boolean", then let
            //      value be the result of comparing value with "true".
            if (collatorOptions[key].type === 'boolean')
                value = value === 'true';
        }
        // d. Set the [[<property>]] internal property of collator to value.
        internal['[['+ property +']]'] = value;

        // e. Increase i by 1.
        i++;
    }

    var
    // 20. Let s be the result of calling the GetOption abstract operation with arguments
    //     options, "sensitivity", "string", a List containing the four String values
    //     "base", "accent", "case", and "variant", and undefined.
        s = GetOption(options, 'sensitivity', 'string', ['base', 'accent', 'case', 'variant']);

    // 21. If s is undefined, then
    if (s === undefined) {
        // a. If u is "sort", then let s be "variant".
        if (u === 'sort')
            s = 'variant';

        // b. Else
        else {
            var
            // i. Let dataLocale be the value of r.[[dataLocale]].
                dataLocale = r['[[dataLocale]]'],

            // ii. Let dataLocaleData be the result of calling the [[Get]] internal
            //     operation of localeData with argument dataLocale.
                dataLocaleData = localeData.dataLocale;

            // iii. Let s be the result of calling the [[Get]] internal operation of
            //      dataLocaleData with argument "sensitivity".
            s = dataLocaleData.sensitivity;
        }
    }

    // 22. Set the [[sensitivity]] internal property of collator to s.
    internal['[[sensitivity]]'] = s;

    var
    // 23. Let ip be the result of calling the GetOption abstract operation with arguments
    //     options, "ignorePunctuation", "boolean", undefined, and false.
        ip = GetOption(options, 'ignorePunctuation', 'boolean', undefined, false);

    // 24. Set the [[ignorePunctuation]] internal property of collator to ip.
    internal['[[ignorePunctuation]]'] = ip;

    // 25. Set the [[boundCompare]] internal property of collator to undefined.
    internal['[[boundCompare]]'] = undefined;

    // 26. Set the [[initializedCollator]] internal property of collator to true.
    internal['[[initializedCollator]]'] = ip;
}

/**
 * Several steps in the algorithm use values from the following table, which associates
 * Unicode locale extension keys, property names, types, and allowable values
 */
var collatorOptions = {
    kn: {
        property: 'numeric',
        type: 'boolean'
    },
    kf: {
        property: 'caseFirst',
        type: 'string',
        values: ['upper', 'lower', 'false']
    }
};

/* 10.2.2 */Intl.Collator.supportedLocalesOf = function () {
    // When the supportedLocalesOf method of Intl.Collator is called, the following steps
    // are taken:

    var
    // 1. If options is not provided, then let options be undefined.
        options = arguments[1],

    // 2. Let availableLocales be the value of the [[availableLocales]] internal property
    //    of the standard built-in object that is the initial value of Intl.Collator.
        availableLocales = internals.Collator['[[availableLocales]]'],

    // 3. Let requestedLocales be the result of calling the CanonicalizeLocaleList
    //    abstract operation (defined in 9.2.1) with argument locales.
        requestedLocales = CanonicalizeLocaleList(locales);

    // 4. Return the result of calling the SupportedLocales abstract operation (defined in
    //    9.2.8) with arguments availableLocales, requestedLocales, and options.
    return SupportedLocales(availableLocales, requestedLocales, options);
};

/* 10.2.3 */internals.Collator = {
    '[[availableLocales]]': [],
    '[[relevantExtensionKeys]]': ['co', 'kn', 'kf'],
    '[[sortLocaleData]]': {},
    '[[searchLocaleData]]': {}
};

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

/**
 * The abstract operation InitializeNumberFormat accepts the arguments
 * numberFormat (which must be an object), locales, and options. It initializes
 * numberFormat as a NumberFormat object.
 */
function /*11.1.1.1 */InitializeNumberFormat (numberFormat, locales, options) {
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
    return currencyMinorUnits[currency] !== undefined
                ? currencyMinorUnits[currency]
                : 2;
}

/**
 * When the supportedLocalesOf method of Intl.NumberFormat is called, the
 * following steps are taken:
 */
/* 11.2.2 */Intl.NumberFormat.supportedLocalesOf = function (locales /*[, options]*/) {
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

/**
 * This named accessor property returns a function that formats a number
 * according to the effective locale and the formatting options of this
 * NumberFormat object.
 */
/* 11.3.2 */defineProperty(Intl.NumberFormat.prototype, 'format', {
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

/**
 * When the FormatNumber abstract operation is called with arguments numberFormat
 * (which must be an object initialized as a NumberFormat) and x (which must be a
 * Number value), it returns a String value representing x according to the
 * effective locale and the formatting options of numberFormat.
 */
function FormatNumber (numberFormat, x) {
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

            n = parts.join(ild.decimal);
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

/**
 * When the ToRawPrecision abstract operation is called with arguments x (which
 * must be a finite non-negative number), minPrecision, and maxPrecision (both
 * must be integers between 1 and 21) the following steps are taken:
 */
function ToRawPrecision (x, minPrecision, maxPrecision) {
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
        // a. Let e and n be integers such that 10ᵖ⁻¹ ≤ n < 10ᵖ and for which the
        //    exact mathematical value of n × 10ᵉ⁻ᵖ⁺¹ – x is as close to zero as
        //    possible. If there are two such sets of e and n, pick the e and n for
        //    which n × 10ᵉ⁻ᵖ⁺¹ is larger.

        var
        // Skip a few steps... cheat a little...
            m = Number.prototype.toPrecision.call(x, maxPrecision);
    }

    // ...
    // 8. If m contains the character ".", and maxPrecision > minPrecision, then
    if (m.indexOf(".") >= 0) {
        var
        // a. Let cut be maxPrecision – minPrecision.
            cut = maxPrecision - minPrecision;

        // b. Repeat while cut > 0 and the last character of m is "0":
        while (cut > 0 && m.slice(-1) === '0') {
            //  i. Remove the last character from m.
            m = m.slice(0, -1);

            //  ii. Decrease cut by 1.
            cut--;
        }
        // c. If the last character of m is ".", then
        if (m.slice(-1) === '.')
            //    i. Remove the last character from m.
            m = m.slice(0, -1);
    }
    // 9. Return m.
    return m;
}

/**
 * When the ToRawFixed abstract operation is called with arguments x (which must
 * be a finite non-negative number), minInteger (which must be an integer between
 * 1 and 21), minFraction, and maxFraction (which must be integers between 0 and
 * 20) the following steps are taken:
 */
function ToRawFixed (x, minInteger, minFraction, maxFraction) {
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

/**
 * This function provides access to the locale and formatting options computed
 * during initialization of the object.
 *
 * The function returns a new object whose properties and attributes are set as
 * if constructed by an object literal assigning to each of the following
 * properties the value of the corresponding internal property of this
 * NumberFormat object (see 11.4): locale, numberingSystem, style, currency,
 * currencyDisplay, minimumIntegerDigits, minimumFractionDigits,
 * maximumFractionDigits, minimumSignificantDigits, maximumSignificantDigits, and
 * useGrouping. Properties whose corresponding internal properties are not present
 * are not assigned.
 */
/* 11.3.3 */Intl.NumberFormat.prototype.resolvedOptions = function () {
    var ret   = {},
        props = [
            'locale', 'numberingSystem', 'style', 'currency', 'currencyDisplay',
            'minimumIntegerDigits', 'minimumFractionDigits', 'maximumFractionDigits',
            'minimumSignificantDigits', 'maximumSignificantDigits', 'useGrouping'
        ],
        internal = getInternalProperties(this);

    props.forEach(function (el) {
        var val;
        if ((val = internal['[['+el+']]']) !== undefined)
            ret[el] = val;
    });

    return ret;
};

// 12.1 The Intl.DateTimeFormat constructor
// ==================================

Intl.DateTimeFormat = function (/* [locales [, options]]*/) {
    var locales = arguments[0];
    var options = arguments[1];

    if (!this || this === Intl) {
        return new Intl.DateTimeFormat(locales, options);
    }
    return InitializeDateTimeFormat(toObject(this), locales, options);
};

/**
 * The abstract operation InitializeDateTimeFormat accepts the arguments dateTimeFormat
 * (which must be an object), locales, and options. It initializes dateTimeFormat as a
 * DateTimeFormat object.
 */
function/* 12.1.1.1 */InitializeDateTimeFormat (dateTimeFormat, locales, options) {
    // This will be a internal properties object if we're not already initialized
    var internal = getInternalProperties(dateTimeFormat);

    // 1. If dateTimeFormat has an [[initializedIntlObject]] internal property with
    //    value true, throw a TypeError exception.
    if (internal['[[initializedIntlObject]]'] === true)
        throw new TypeError('NumberFormat object already initialized');

    // Need this to access the `internal` object
    defineProperty(dateTimeFormat, '__getInternalProperties', {
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
        requestedLocales = CanonicalizeLocaleList(locales),

    // 4. Let options be the result of calling the ToDateTimeOptions abstract
    //    operation (defined below) with arguments options, "any", and "date".
        options = ToDateTimeOptions(options, 'any', 'date'),

    // 5. Let opt be a new Record.
        opt = objCreate(null);

    // 6. Let matcher be the result of calling the GetOption abstract operation
    //    (defined in 9.2.9) with arguments options, "localeMatcher", "string", a List
    //    containing the two String values "lookup" and "best fit", and "best fit".
        matcher = GetOption(options, 'localeMatcher', 'string',
                                                    ['lookup', 'best fit'], 'best fit');

    // 7. Set opt.[[localeMatcher]] to matcher.
    opt['[[localeMatcher]]'] = matcher;

    var
    // 8. Let DateTimeFormat be the standard built-in object that is the initial
    //    value of Intl.DateTimeFormat.
        DateTimeFormat = internals.DateTimeFormat, // This is what we *really* need

    // 9. Let localeData be the value of the [[localeData]] internal property of
    //    DateTimeFormat.
        localeData = DateTimeFormat['[[localeData]]'],

    // 10. Let r be the result of calling the ResolveLocale abstract operation
    //     (defined in 9.2.5) with the [[availableLocales]] internal property of
    //      DateTimeFormat, requestedLocales, opt, the [[relevantExtensionKeys]]
    //      internal property of DateTimeFormat, and localeData.
        r = ResolveLocale(DateTimeFormat['[[availableLocales]]'], requestedLocales,
                opt, DateTimeFormat['[[relevantExtensionKeys]]'], localeData);

    // 11. Set the [[locale]] internal property of dateTimeFormat to the value of
    //     r.[[locale]].
    internal['[[locale]]'] = r['[[locale]]'];

    // 12. Set the [[calendar]] internal property of dateTimeFormat to the value of
    //     r.[[ca]].
    internal['[[calendar]]'] = r['[[ca]]'];

    // 13. Set the [[numberingSystem]] internal property of dateTimeFormat to the value of
    //     r.[[nu]].
    internal['[[numberingSystem]]'] = r['[[nu]]'];

    var
    // 14. Let dataLocale be the value of r.[[dataLocale]].
        dataLocale = r['[[dataLocale]]'],

    // 15. Let tz be the result of calling the [[Get]] internal method of options with
    //     argument "timeZone".
        tz = options.timeZone;

    // 16. If tz is not undefined, then
    if (tz !== undefined) {
        // a. Let tz be ToString(tz).
        // b. Convert tz to upper case as described in 6.1.
        //    NOTE: If an implementation accepts additional time zone values, as permitted
        //          under certain conditions by the Conformance clause, different casing
        //          rules apply.
        tz = String(tz).toUpperCase();

        // c. If tz is not "UTC", then throw a RangeError exception.
        // ###TODO: accept more time zones###
        if (tz !== 'UTC')
            throw new RangeError('timeZone is not supported.');
    }

    // 17. Set the [[timeZone]] internal property of dateTimeFormat to tz.
    internal['[[timeZone]]'] = tz;

    // 18. Let opt be a new Record.
    opt = objCreate(null);

    // 19. For each row of Table 3, except the header row, do:
    for (var prop in dateTimeComponents) {
        if (!hop.call(dateTimeComponents, prop))
            continue;

        var
        // 20. Let prop be the name given in the Property column of the row.
        // 21. Let value be the result of calling the GetOption abstract operation,
        //     passing as argument options, the name given in the Property column of the
        //     row, "string", a List containing the strings given in the Values column of
        //     the row, and undefined.
            value = GetOption(options, prop, 'string', dateTimeComponents[prop]);

        // 22. Set opt.[[<prop>]] to value.
        opt['[['+prop+']]'] = value;
    }

    var
        // Assigned a value below
        bestFormat,

        // 23. Let dataLocaleData be the result of calling the [[Get]] internal method of
        //     localeData with argument dataLocale.
        dataLocaleData = localeData[dataLocale],

        // 24. Let formats be the result of calling the [[Get]] internal method of
        //     dataLocaleData with argument "formats".
        formats = dataLocaleData.formats,
        // 25. Let matcher be the result of calling the GetOption abstract operation with
        //     arguments options, "formatMatcher", "string", a List containing the two String
        //     values "basic" and "best fit", and "best fit".
        matcher = GetOption(options, 'formatMatcher', 'string', ['basic', 'best fit'], 'best fit');

    // 26. If matcher is "basic", then
    if (matcher === 'basic')
        // 27. Let bestFormat be the result of calling the BasicFormatMatcher abstract
        //     operation (defined below) with opt and formats.
        bestFormat = BasicFormatMatcher(opt, formats);

    // 28. Else
    else
        // 29. Let bestFormat be the result of calling the BestFitFormatMatcher
        //     abstract operation (defined below) with opt and formats.
        bestFormat = BestFitFormatMatcher(opt, formats);

    // 30. For each row in Table 3, except the header row, do
    for (var prop in dateTimeComponents) {
        if (!hop.call(dateTimeComponents, prop))
            continue;

        var
        // a. Let prop be the name given in the Property column of the row.
        // b. Let pDesc be the result of calling the [[GetOwnProperty]] internal method of
        //    bestFormat with argument prop.
            pDesc = bestFormat[prop];

        // c. If pDesc is not undefined, then
        if (pDesc !== undefined) {
            var
            // i. Let p be the result of calling the [[Get]] internal method of bestFormat
            //    with argument prop.
                p = bestFormat[prop];

            // ii. Set the [[<prop>]] internal property of dateTimeFormat to p.
            internal['[['+prop+']]'] = p;
        }
    }

    var
        // Assigned a value below
        pattern,

    // 31. Let hr12 be the result of calling the GetOption abstract operation with
    //     arguments options, "hour12", "boolean", undefined, and undefined.
        hr12 = GetOption(options, 'hour12', 'boolean'/*, undefined, undefined*/);

    // 32. If dateTimeFormat has an internal property [[hour]], then
    if (internal['[[hour]]']) {
        // a. If hr12 is undefined, then let hr12 be the result of calling the [[Get]]
        //    internal method of dataLocaleData with argument "hour12".
        hr12 = hr12 === undefined ? dataLocaleData.hour12 : hr12;

        // b. Set the [[hour12]] internal property of dateTimeFormat to hr12.
        internal['[[hour12]]'] = hr12;

        // c. If hr12 is true, then
        if (hr12 === true) {
            var
            // i. Let hourNo0 be the result of calling the [[Get]] internal method of
            //    dataLocaleData with argument "hourNo0".
                hourNo0 = dataLocaleData.hourNo0;

            // ii. Set the [[hourNo0]] internal property of dateTimeFormat to hourNo0.
            internal['[[hourNo0]]'] = hourNo0;

            // iii. Let pattern be the result of calling the [[Get]] internal method of
            //      bestFormat with argument "pattern12".
            pattern = bestFormat.pattern12;
        }

        // d. Else
        else
            // i. Let pattern be the result of calling the [[Get]] internal method of
            //    bestFormat with argument "pattern".
            pattern = bestFormat.pattern;
    }

    // 33. Else
    else
        // a. Let pattern be the result of calling the [[Get]] internal method of
        //    bestFormat with argument "pattern".
        pattern = bestFormat.pattern;

    // 34. Set the [[pattern]] internal property of dateTimeFormat to pattern.
    internal['[[pattern]]'] = pattern;

    // 35. Set the [[boundFormat]] internal property of dateTimeFormat to undefined.
    internal['[[boundFormat]]'] = undefined;

    // 36. Set the [[initializedDateTimeFormat]] internal property of dateTimeFormat to
    //     true.
    internal['[[initializedDateTimeFormat]]'] = true;
}

/**
 * Several DateTimeFormat algorithms use values from the following table, which provides
 * property names and allowable values for the components of date and time formats:
 */
var dateTimeComponents = {
         weekday: [ "narrow", "short", "long" ],
             era: [ "narrow", "short", "long" ],
            year: [ "2-digit", "numeric" ],
           month: [ "2-digit", "numeric", "narrow", "short", "long" ],
             day: [ "2-digit", "numeric" ],
            hour: [ "2-digit", "numeric" ],
          minute: [ "2-digit", "numeric" ],
          second: [ "2-digit", "numeric" ],
    timeZoneName: [ "short", "long" ]
};

/**
 * When the ToDateTimeOptions abstract operation is called with arguments options,
 * required, and defaults, the following steps are taken:
 */
function ToDateTimeOptions(options, required, defaults) {
    // 1. If options is undefined, then let options be null, else let options be
    //    ToObject(options).
    options = options === undefined ? null : toObject(options);

    var
    // 2. Let create be the standard built-in function object defined in ES5, 15.2.3.5.
        create = objCreate,

    // 3. Let options be the result of calling the [[Call]] internal method of create with
    //    undefined as the this value and an argument list containing the single item
    //    options.
        options = create(options),

    // 4. Let needDefaults be true.
        needDefaults = true;

    // 5. If required is "date" or "any", then
    if (required === 'date' || required === 'any') {
        // a. For each of the property names "weekday", "year", "month", "day":
            // i. If the result of calling the [[Get]] internal method of options with the
            //    property name is not undefined, then let needDefaults be false.
        if (options.weekday !== undefined || options.year !== undefined
                || options.month !== undefined || options.day !== undefined)
            needDefaults = false;
    }

    // 6. If required is "time" or "any", then
    if (required === 'time' || required === 'any') {
        // a. For each of the property names "hour", "minute", "second":
            // i. If the result of calling the [[Get]] internal method of options with the
            //    property name is not undefined, then let needDefaults be false.
        if (options.hour !== undefined || options.minute !== undefined || options.second !== undefined)
                needDefaults = false;
    }

    // 7. If needDefaults is true and defaults is either "date" or "all", then
    if (needDefaults && (defaults === 'date' || defaults === 'all'))
        // a. For each of the property names "year", "month", "day":
            // i. Call the [[DefineOwnProperty]] internal method of options with the
            //    property name, Property Descriptor {[[Value]]: "numeric", [[Writable]]:
            //    true, [[Enumerable]]: true, [[Configurable]]: true}, and false.
        options.year = options.month = options.day = 'numeric';

    // 8. If needDefaults is true and defaults is either "time" or "all", then
    if (needDefaults && (defaults === 'time' || defaults === 'all'))
        // a. For each of the property names "hour", "minute", "second":
            // i. Call the [[DefineOwnProperty]] internal method of options with the
            //    property name, Property Descriptor {[[Value]]: "numeric", [[Writable]]:
            //    true, [[Enumerable]]: true, [[Configurable]]: true}, and false.
        options.hour = options.minute = options.second = 'numeric';

    // 9. Return options.
    return options;
}

/**
 * When the BasicFormatMatcher abstract operation is called with two arguments options and
 * formats, the following steps are taken:
 */
function BasicFormatMatcher (options, formats) {
    var
    // 1. Let removalPenalty be 120.
        removalPenalty = 120,

    // 2. Let additionPenalty be 20.
        additionPenalty = 20,

    // 3. Let longLessPenalty be 8.
        longLessPenalty = 8,

    // 4. Let longMorePenalty be 6.
        longMorePenalty = 6,

    // 5. Let shortLessPenalty be 6.
        shortLessPenalty = 6,

    // 6. Let shortMorePenalty be 3.
        shortMorePenalty = 3,

    // 7. Let bestScore be -Infinity.
        bestScore = -Infinity,

    // 8. Let bestFormat be undefined.
        bestFormat,

    // 9. Let i be 0.
        i = 0,

    // 10. Let len be the result of calling the [[Get]] internal method of formats with argument "length".
        len = formats.length;

    // 11. Repeat while i < len:
    while (i < len) {
        var
        // a. Let format be the result of calling the [[Get]] internal method of formats with argument ToString(i).
            format = formats[i],

        // b. Let score be 0.
            score = 0;

        // c. For each property shown in Table 3:
        for (var property in dateTimeComponents) {
            if (!hop.call(dateTimeComponents, property))
                continue;

            var
            // i. Let optionsProp be options.[[<property>]].
                optionsProp = options['[['+ property +']]'],

            // ii. Let formatPropDesc be the result of calling the [[GetOwnProperty]] internal method of format
            //     with argument property.
            // iii. If formatPropDesc is not undefined, then
                // 1. Let formatProp be the result of calling the [[Get]] internal method of format with argument property.
                formatProp = format[property];

            // iv. If optionsProp is undefined and formatProp is not undefined, then decrease score by
            //     additionPenalty.
            if (optionsProp === undefined && formatProp !== undefined)
                score -= additionPenalty;

            // v. Else if optionsProp is not undefined and formatProp is undefined, then decrease score by
            //    removalPenalty.
            else if (optionsProp !== undefined && formatProp === undefined)
                score -= removalPenalty;

            // vi. Else
            else {
                var
                // 1. Let values be the array ["2-digit", "numeric", "narrow", "short",
                //    "long"].
                    values = [ '2-digit', 'numeric', 'narrow', 'short', 'long' ],

                // 2. Let optionsPropIndex be the index of optionsProp within values.
                    optionsPropIndex = arrIndexOf.call(values, optionsProp),

                // 3. Let formatPropIndex be the index of formatProp within values.
                    formatPropIndex = arrIndexOf.call(values, formatProp),

                // 4. Let delta be max(min(formatPropIndex - optionsPropIndex, 2), -2).
                    delta = Math.max(Math.min(formatPropIndex - optionsPropIndex, 2), -2);

                // 5. If delta = 2, decrease score by longMorePenalty.
                if (delta === 2)
                    score -= longMorePenalty;

                // 6. Else if delta = 1, decrease score by shortMorePenalty.
                else if (delta === 1)
                    score -= shortMorePenalty;

                // 7. Else if delta = -1, decrease score by shortLessPenalty.
                else if (delta === -1)
                    score -= shortLessPenalty;

                // 8. Else if delta = -2, decrease score by longLessPenalty.
                else if (delta === -2)
                    score -= longLessPenalty;
            }
        }

        // d. If score > bestScore, then
        if (score > bestScore) {
            // i. Let bestScore be score.
            bestScore = score;

            // ii. Let bestFormat be format.
            bestFormat = format;
        }

        // e. Increase i by 1.
        i++;
    }

    // 12. Return bestFormat.
    return bestFormat;
}

/**
 * When the BestFitFormatMatcher abstract operation is called with two arguments options
 * and formats, it performs implementation dependent steps, which should return a set of
 * component representations that a typical user of the selected locale would perceive as
 * at least as good as the one returned by BasicFormatMatcher.
 */
function BestFitFormatMatcher (options, formats) {
    // This is good enough for now
    return BasicFormatMatcher(options, formats);
}

/**
 * When the supportedLocalesOf method of Intl.DateTimeFormat is called, the
 * following steps are taken:
 */
/* 12.2.1 */Intl.DateTimeFormat.supportedLocalesOf = function (locales/*, [options]*/) {
    var
    // 1. If options is not provided, then let options be undefined.
        options = arguments[1],

    // 2. Let availableLocales be the value of the [[availableLocales]] internal
    //    property of the standard built-in object that is the initial value of
    //    Intl.NumberFormat.
        availableLocales = internals.DateTimeFormat['[[availableLocales]]'],

    // 3. Let requestedLocales be the result of calling the CanonicalizeLocaleList
    //    abstract operation (defined in 9.2.1) with argument locales.
        requestedLocales = CanonicalizeLocaleList(locales);

    // 4. Return the result of calling the SupportedLocales abstract operation
    //    (defined in 9.2.8) with arguments availableLocales, requestedLocales,
    //    and options.
    return SupportedLocales(availableLocales, requestedLocales, options);
};

/* 12.2.3 */internals.DateTimeFormat = {
    '[[availableLocales]]': [],
    '[[relevantExtensionKeys]]': ['ca', 'nu'],
    '[[localeData]]': {}
};

/**
 * This named accessor property returns a function that formats a number
 * according to the effective locale and the formatting options of this
 * DateTimeFormat object.
 */
/* 12.3.2 */defineProperty(Intl.DateTimeFormat.prototype, 'format', {
    get: function () {
        var internal = getInternalProperties(this);

        // The value of the [[Get]] attribute is a function that takes the following
        // steps:

        // 1. If the [[boundFormat]] internal property of this DateTimeFormat object
        //    is undefined, then:
        if (internal['[[boundFormat]]'] === undefined) {
            var
            // a. Let F be a Function object, with internal properties set as
            //    specified for built-in functions in ES5, 15, or successor, and the
            //    length property set to 1, that takes the argument value and
            //    performs the following steps:
                F = function (date) {
                    //   i. If date is not provided or is undefined, then let x be the
                    //      result as if by the expression Date.now() where Date.now is
                    //      the standard built-in function defined in ES5, 15.9.4.4.
                    //  ii. Else let x be ToNumber(date).
                    // iii. Return the result of calling the FormatDateTime abstract
                    //      operation (defined below) with arguments this and x.
                    return FormatDateTime(this, /* x = */Number(date === undefined ? Date.now() : date));
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

/**
 * When the FormatDateTime abstract operation is called with arguments dateTimeFormat
 * (which must be an object initialized as a DateTimeFormat) and x (which must be a Number
 * value), it returns a String value representing x (interpreted as a time value as
 * specified in ES5, 15.9.1.1) according to the effective locale and the formatting
 * options of dateTimeFormat.
 */
function FormatDateTime(dateTimeFormat, x) {
    // 1. If x is not a finite Number, then throw a RangeError exception.
    if (!isFinite(x))
        throw new RangeError('Invalid valid date passed to format');

    var
        internal = dateTimeFormat.__getInternalProperties(secret),

    // 2. Let locale be the value of the [[locale]] internal property of dateTimeFormat.
        locale = internal['[[locale]]'],

    // 3. Let nf be the result of creating a new NumberFormat object as if by the
    // expression new Intl.NumberFormat([locale], {useGrouping: false}) where
    // Intl.NumberFormat is the standard built-in constructor defined in 11.1.3.
        nf = new Intl.NumberFormat([locale], {useGrouping: false}),

    // 4. Let nf2 be the result of creating a new NumberFormat object as if by the
    // expression new Intl.NumberFormat([locale], {minimumIntegerDigits: 2, useGrouping:
    // false}) where Intl.NumberFormat is the standard built-in constructor defined in
    // 11.1.3.
        nf2 = new Intl.NumberFormat([locale], {minimumIntegerDigits: 2, useGrouping: false}),

    // 5. Let tm be the result of calling the ToLocalTime abstract operation (defined
    // below) with x, the value of the [[calendar]] internal property of dateTimeFormat,
    // and the value of the [[timeZone]] internal property of dateTimeFormat.
        tm = ToLocalTime(x, internal['[[calendar]]'], internal['[[timeZone]]']),

    // 6. Let result be the value of the [[pattern]] internal property of dateTimeFormat.
        result = internal['[[pattern]]'],

    // Need the calendar data from CLDR
        ca = localeData[locale].dates.calendars[internal['[[calendar]]']];

    // 7. For each row of Table 3, except the header row, do:
    for (var p in dateTimeComponents) {
        // a. If dateTimeFormat has an internal property with the name given in the
        //    Property column of the row, then:
        if (hop.call(internal, '[['+ p +']]')) {
            var
            // Assigned values below
                pm, fv,

            //   i. Let p be the name given in the Property column of the row.
            //  ii. Let f be the value of the [[<p>]] internal property of dateTimeFormat.
                f = internal['[['+ p +']]'],

            // iii. Let v be the value of tm.[[<p>]].
                v = tm['[['+ p +']]'];

            //  iv. If p is "year" and v ≤ 0, then let v be 1 - v.
            if (p === 'year' && v <= 0)
                v = 1 - v;

            //   v. If p is "month", then increase v by 1.
            else if (p === 'month')
                v++;

            //  vi. If p is "hour" and the value of the [[hour12]] internal property of
            //      dateTimeFormat is true, then
            else if (p === 'hour' && internal['[[hour12]]'] === true) {
                // 1. Let v be v modulo 12.
                v = v % 12;

                // 2. If v is equal to the value of tm.[[<p>]], then let pm be false; else
                //    let pm be true.
                pm = v !== tm['[['+ p +']]'];

                // 3. If v is 0 and the value of the [[hourNo0]] internal property of
                //    dateTimeFormat is true, then let v be 12.
                if (v === 0 && internal['[[hourNo0]]'] === true)
                    v = 12;
            }

            // vii. If f is "numeric", then
            if (f === 'numeric')
                // 1. Let fv be the result of calling the FormatNumber abstract operation
                //    (defined in 11.3.2) with arguments nf and v.
                fv = FormatNumber(nf, v);

            // viii. Else if f is "2-digit", then
            else if (f === '2-digit') {
                // 1. Let fv be the result of calling the FormatNumber abstract operation
                //    with arguments nf2 and v.
                fv = FormatNumber(nf2, v);

                // 2. If the length of fv is greater than 2, let fv be the substring of fv
                //    containing the last two characters.
                if (fv.length > 2)
                    fv = fv.slice(-2);
            }

            // ix. Else if f is "narrow", "short", or "long", then let fv be a String
            //     value representing f in the desired form; the String value depends upon
            //     the implementation and the effective locale and calendar of
            //     dateTimeFormat. If p is "month", then the String value may also depend
            //     on whether dateTimeFormat has a [[day]] internal property. If p is
            //     "timeZoneName", then the String value may also depend on the value of
            //     the [[inDST]] field of tm.
            else if (/^(?:narrow|short|long)$/.test(f)) {
                var
                // CLDR formats are 'abbreviated', 'wide' or 'narrow'
                    size = f === 'short' ? 'abbreviated' : (f === 'long' ? 'wide' : f);

                switch (p) {
                    case 'month':
                        fv = ca.months[ca.months['default']][size][tm['[['+ p +']]']];
                        break;

                    // For weekdays, we need to refer to our `weekdays` array
                    case 'weekday':
                        fv = ca.days[ca.days['default']][size][weekdays[tm['[['+ p +']]']]];
                        break;

                    case 'timeZoneName':
                        fv = ''; // TODO
                        break;

                    // TODO: Era
                    default:
                        fv = tm['[['+ p +']]'];
                }
            }

            // x. Replace the substring of result that consists of "{", p, and "}", with
            //    fv.
            result = result.replace('{'+ p +'}', fv);
        }
    }
    // 8. If dateTimeFormat has an internal property [[hour12]] whose value is true, then
    if (internal['[[hour12]]'] === true) {
        // a. If pm is true, then let fv be an implementation and locale dependent String
        //    value representing “post meridiem”; else let fv be an implementation and
        //    locale dependent String value representing “ante meridiem”.
        fv = ca.dayPeriods.format.wide[pm ? 'pm' : 'am'];

        // b. Replace the substring of result that consists of "{ampm}", with fv.
        result = result.replace('{ampm}', fv);
    }
    // 9. Return result.
    return result;
}

/**
 * When the ToLocalTime abstract operation is called with arguments date, calendar, and
 * timeZone, the following steps are taken:
 */
function ToLocalTime(date, calendar, timeZone) {
    // 1. Apply calendrical calculations on date for the given calendar and time zone to
    //    produce weekday, era, year, month, day, hour, minute, second, and inDST values.
    //    The calculations should use best available information about the specified
    //    calendar and time zone. If the calendar is "gregory", then the calculations must
    //    match the algorithms specified in ES5, 15.9.1, except that calculations are not
    //    bound by the restrictions on the use of best available information on time zones
    //    for local time zone adjustment and daylight saving time adjustment imposed by
    //    ES5, 15.9.1.7 and 15.9.1.8.
    // ###TODO###
    var d = new Date(date);

    // 2. Return a Record with fields [[weekday]], [[era]], [[year]], [[month]], [[day]],
    //    [[hour]], [[minute]], [[second]], and [[inDST]], each with the corresponding
    //    calculated value.
    return {
        '[[weekday]]': d.getDay(),
        '[[era]]'    : +(d.getFullYear >= 0),
        '[[year]]'   : d.getFullYear(),
        '[[month]]'  : d.getMonth(),
        '[[day]]'    : d.getDate(),
        '[[hour]]'   : d.getHours(),
        '[[minute]]' : d.getMinutes(),
        '[[second]]' : d.getSeconds(),
        '[[inDST]]'  : false // ###TODO###
    };
}

/**
 * The function returns a new object whose properties and attributes are set as if
 * constructed by an object literal assigning to each of the following properties the
 * value of the corresponding internal property of this DateTimeFormat object (see 12.4):
 * locale, calendar, numberingSystem, timeZone, hour12, weekday, era, year, month, day,
 * hour, minute, second, and timeZoneName. Properties whose corresponding internal
 * properties are not present are not assigned.
 */
/* 12.3.3 */Intl.DateTimeFormat.prototype.resolvedOptions = function () {
    var val,
        ret   = {},
        props = [
            'locale', 'calendar', 'numberingSystem', 'timeZone', 'hour12', 'weekday',
            'era', 'year', 'month', 'day', 'hour', 'minute', 'second', 'timeZoneName',

            // Not part of the spec, but in here for debugging purposes
            'pattern'
        ],
        internal = getInternalProperties(this);

    for (var i = 0, max = props.length; i < max; i++) {
        if ((val = internal['[['+ props[i] +']]']) !== undefined)
            ret[props[i]] = val;
    }

    return ret;
};

// Sect 13 Locale Sensitive Functions of the ECMAScript Language Specification
// ===========================================================================

/**
 * When the toLocaleString method is called with optional arguments locales and options,
 * the following steps are taken:
 */
/* 13.2.1 */defineProperty(Number.prototype, 'toLocaleString', {
    writable: true,
    configurable: true,
    value: function () {
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
 * When the toLocaleString method is called with optional arguments locales and options,
 * the following steps are taken:
 */
/* 13.3.1 */defineProperty(Date.prototype, 'toLocaleString', {
    writable: true,
    configurable: true,
    value: function () {
        var
        // 1. Let x be this time value (as defined in ES5, 15.9.5).
            x = +this;

        // 2. If x is NaN, then return "Invalid Date".
        if (isNaN(x))
            return 'Invalid Date';

        var
        // 3. If locales is not provided, then let locales be undefined.
            locales = arguments[0],

        // 4. If options is not provided, then let options be undefined.
            options = arguments[1],

        // 5. Let options be the result of calling the ToDateTimeOptions abstract
        //    operation (defined in 12.1.1) with arguments options, "any", and "all".
            options = ToDateTimeOptions(options, 'any', 'all'),

        // 6. Let dateTimeFormat be the result of creating a new object as if by the
        //    expression new Intl.DateTimeFormat(locales, options) where
        //    Intl.DateTimeFormat is the standard built-in constructor defined in 12.1.3.
            dateTimeFormat = new Intl.DateTimeFormat(locales, options);

        // 7. Return the result of calling the FormatDateTime abstract operation (defined
        //    in 12.3.2) with arguments dateTimeFormat and x.
        return FormatDateTime(dateTimeFormat, x);
    }
});

/**
 * When the toLocaleDateString method is called with optional arguments locales and
 * options, the following steps are taken:
 */
/* 13.3.2 */defineProperty(Date.prototype, 'toLocaleDateString', {
    writable: true,
    configurable: true,
    value: function () {
        var
        // 1. Let x be this time value (as defined in ES5, 15.9.5).
            x = +this;

        // 2. If x is NaN, then return "Invalid Date".
        if (isNaN(x))
            return 'Invalid Date';

        var
        // 3. If locales is not provided, then let locales be undefined.
            locales = arguments[0],

        // 4. If options is not provided, then let options be undefined.
            options = arguments[1],

        // 5. Let options be the result of calling the ToDateTimeOptions abstract
        //    operation (defined in 12.1.1) with arguments options, "date", and "date".
            options = ToDateTimeOptions(options, 'date', 'date'),

        // 6. Let dateTimeFormat be the result of creating a new object as if by the
        //    expression new Intl.DateTimeFormat(locales, options) where
        //    Intl.DateTimeFormat is the standard built-in constructor defined in 12.1.3.
            dateTimeFormat = new Intl.DateTimeFormat(locales, options);

        // 7. Return the result of calling the FormatDateTime abstract operation (defined
        //    in 12.3.2) with arguments dateTimeFormat and x.
        return FormatDateTime(dateTimeFormat, x);
    }
});

/**
 * When the toLocaleTimeString method is called with optional arguments locales and
 * options, the following steps are taken:
 */
/* 13.3.3 */defineProperty(Date.prototype, 'toLocaleTimeString', {
    writable: true,
    configurable: true,
    value: function () {
        var
        // 1. Let x be this time value (as defined in ES5, 15.9.5).
            x = +this;

        // 2. If x is NaN, then return "Invalid Date".
        if (isNaN(x))
            return 'Invalid Date';

        var
        // 3. If locales is not provided, then let locales be undefined.
            locales = arguments[0],

        // 4. If options is not provided, then let options be undefined.
            options = arguments[1],

        // 5. Let options be the result of calling the ToDateTimeOptions abstract
        //    operation (defined in 12.1.1) with arguments options, "time", and "time".
            options = ToDateTimeOptions(options, 'time', 'time'),

        // 6. Let dateTimeFormat be the result of creating a new object as if by the
        //    expression new Intl.DateTimeFormat(locales, options) where
        //    Intl.DateTimeFormat is the standard built-in constructor defined in 12.1.3.
            dateTimeFormat = new Intl.DateTimeFormat(locales, options);

        // 7. Return the result of calling the FormatDateTime abstract operation (defined
        //    in 12.3.2) with arguments dateTimeFormat and x.
        return FormatDateTime(dateTimeFormat, x);
    }
});

/**
 * The Unicode CLDR lists the full names for calendars, but we need to map some
 * of them to their unicode extension equivalents, e.g. 'gregorian' should be
 * 'gregory' (as in the '-u-ca-gregory' extension)
 */
var caMap = {
    gregorian: 'gregory',
    'ethiopic-amete-alam':'ethioaa',
    'islamic-civil': 'islamicc'
};

/**
 * Can't really ship a single script with data for hundreds of locales, so we provide
 * this __addLocaleData method as a means for the developer to add the data on an
 * as-needed basis
 */
defineProperty(Intl, '__addLocaleData', {
    value: addLocaleData
});
function addLocaleData (data) {
    if (!data.identity)
        throw new Error('Must pass valid CLDR data parsed into a JavaScript object.');

    var add,
        locale = data.identity.language;

    if (add = data.identity.script)
        locale += '-' + add;
    if (add = data.identity.territory)
        locale += '-' + add;
    if (add = data.identity.variant)
        locale += '-' + add;

    localeData[locale] = data;

    // If this is the first set of locale data added, make it the default
    if (defaultLocale === undefined)
        defaultLocale = locale;

    // Add to Collator internal properties as per 10.2.3
    if (data.characters) {
        internals.Collator['[[availableLocales]]'].push(locale);
        internals.Collator['[[sortLocaleData]]'][locale] = {
            co: [null],

            // Always the default for sortLocaleData
            sensitivity: 'variant'
        };
        internals.Collator['[[searchLocaleData]]'][locale] = {
            co: [null]
        };
    }

    // Add to NumberFormat internal properties as per 11.2.3
    if (data.numbers) {
        var defNumSys = data.numbers.defaultNumberingSystem || 'latn',
            nu = [ defNumSys ],

            // 11.2.3 says nu can't contain these:
            nuNo = {
                'native': 1,
                traditio: 1,
                finance:  1
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
                        .split(';')[0]
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
    if (data.dates) {
        var formats,
            cas     = data.dates.calendars,
            defCa   = cas['default'] || 'gregorian',
            ca      = [ defCa ],
            patterns= [],
            timeFormats = cas[defCa].timeFormats,
            dateFormats = cas[defCa].dateFormats,
            dtFormats   = cas[defCa].dateTimeFormats.availableFormats,

            // The default time format gives us some needed information
            timeFormat = timeFormats.medium.timeFormat;

        // Get calendars supported by this locale
        for (var cal in cas) {
            if (!hop.call(cas, cal) || cal === defCa)
                continue;

            // Refer to our earlier calendar->unicode extension mappings
            ca.push(caMap[cal] || cal);
        }

        // Merge all the patterns listed in the default calendar
        for (var pattern in dateFormats) {
            if (hop.call(dateFormats, pattern) && typeof dateFormats[pattern] === 'object')
                patterns.push(dateFormats[pattern].dateFormat.pattern);
        }

        for (var pattern in timeFormats) {
            if (hop.call(timeFormats, pattern) && typeof timeFormats[pattern] === 'object')
                patterns.push(timeFormats[pattern].timeFormat.pattern);
        }

        for (var pattern in dtFormats) {
            if (hop.call(dtFormats, pattern))
                patterns.push(dtFormats[pattern]);
        }
        formats = createDateTimeFormats(patterns);

        internals.DateTimeFormat['[[availableLocales]]'].push(locale);
        internals.DateTimeFormat['[[localeData]]'][locale] = {
            nu: nu,
            ca: ca,

            formats: formats,

            // Locales using 0-11 and 1-24 hours have 'k' or 'K' in their
            // default time patterns, hour0 signifies 1-12 and 0-23
            hourNo0: !/k/i.test(timeFormat),

            // Locales defaulting to 24hr time have 'H' or 'K' in their default
            // time patterns
            hour12: !/H|K/.test(timeFormat)
        };
    }
}

var
    // Match these datetime components in a CLDR pattern
    expDTComponents = /[Eec]{1,6}|G{1,5}|(?:[yYu]+|U{1,5})|[ML]{1,5}|d{1,2}|a|[hk]{1,2}|m{1,2}|s{1,2}|z{1,4}/g,

    // Skip over patterns with these datetime components
    unwantedDTCs = /[QxXVOvZASjgFDwWIQqH]/,

    // Maps the number of characters in a CLDR pattern to the specification
    dtcLengthMap = {
        month:   [ 'numeric', '2-digit', 'short', 'long', 'narrow' ],
        weekday: [ 'short', 'short', 'short', 'long', 'narrow' ],
        era:     [ 'short', 'short', 'short', 'long', 'narrow' ]
    };
/**
 * Converts the CLDR availableFormats into the objects and patterns required by
 * the ECMAScript Internationalization API specification.
 *
 * The specification requires we support at least the following subsets of the
 * dateTimeComponents listed above:
 *
 *   - 'weekday', 'year', 'month', 'day', 'hour', 'minute', 'second'
 *   - 'weekday', 'year', 'month', 'day'
 *   - 'year', 'month', 'day'
 *   - 'year', 'month'
 *   - 'month', 'day'
 *   - 'hour', 'minute', 'second'
 *   - 'hour', 'minute'
 *
 * However, since they recommend the CLDR data, we're going to assume that each locale
 * within the CLDR supports at least these subsets (and variants thereof), so
 * it's easier to just iterate over what the CLDR gives us an map it accordingly.
 */
function createDateTimeFormats(availableFormats) {
    /*jshint loopfunc:true */ /* Will consider moving the function later */
    var formats = [];

    for (var format in availableFormats) {
        // Prevent iterating over 'inherited' properties or patterns with
        // datetime components we're not using (or '[hH]' patterns without 'a')
        if (!hop.call(availableFormats, format) || unwantedDTCs.test(availableFormats[format]))
            continue;

        var formatObj = {};

        // Replace the pattern string with the one required by the specification, whilst
        // at the same time evaluating it for the subsets and formats
        formatObj.pattern = availableFormats[format].replace(expDTComponents, function ($0) {
            var subsetProp;

            // See which symbol we're dealing with
            switch ($0.charAt(0)) {
                case 'E':
                case 'e':
                case 'c':
                    formatObj.weekday = dtcLengthMap.weekday[$0.length-1];
                    return '{weekday}';

                // Not supported yet
                case 'G':
                    formatObj.era = dtcLengthMap.era[$0.length-1];
                    return '{era}';

                case 'y':
                case 'Y':
                case 'u':
                case 'U':
                    formatObj.year = $0.length === 2 ? '2-digit' : 'numeric';
                    return '{year}';

                case 'M':
                case 'L':
                    formatObj.month = dtcLengthMap.month[$0.length-1];
                    return '{month}';

                case 'd':
                    formatObj.day = $0.length === 2 ? '2-digit' : 'numeric';
                    return '{day}';

                case 'a':
                    return '{ampm}';

                case 'h':
                case 'k':
                    formatObj.hour = $0.length === 2 ? '2-digit' : 'numeric';
                    return '{hour}';

                case 'm':
                    formatObj.minute = $0.length === 2 ? '2-digit' : 'numeric';
                    return '{minute}';

                case 's':
                    formatObj.second = $0.length === 2 ? '2-digit' : 'numeric';
                    return '{second}';

                case 'z':
                    formatObj.timeZoneName = $0.length < 4 ? 'short' : 'long';
                    return '{timeZoneName}';
            }
        });

        if (formatObj.pattern.indexOf('{ampm}') > -1) {
            formatObj.pattern12 = formatObj.pattern;
            formatObj.pattern = formatObj.pattern.replace(/\s?{ampm}(?:\s(?![^\s]))?/, '');
        }

        formats.push(formatObj);
    }

    return formats;
}

/**
 * dateTimeComponent subsets required for each locale as per 12.2.3
 * The keys map to pattern keys in the CLDR data which, in turn, uses symbols from the
 * Unicode TR35 Technical Standard.
 *
 * See http://unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table
 */
var dateTimeSubsets = {
};


// Exposed for debugging
if (typeof window !== 'undefined')
    window.IntlLocaleData = localeData;

// Helper functions
// ================

/**
 * Convert only a-z to uppercase as per section 6.1 of the spec
 */
function toLatinUpperCase(str) {
    var i = str.length;

    while (i--) {
        var ch = str.charAt(i);

        if (ch >= "a" && ch <= "z")
            str = str.slice(0, i) + ch.toUpperCase() + str.slice(i+1);
    }

    return str;
}

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
        return objCreate(null);
}

return Intl;
})({});
