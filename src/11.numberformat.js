// 11.1 The Intl.NumberFormat constructor
// ======================================

import {
    IsWellFormedCurrencyCode,
} from "./6.locales-currencies-tz.js";

import {
    Intl,
} from "./8.intl.js";

import {
    CanonicalizeLocaleList,
    SupportedLocales,
    ResolveLocale,
    GetNumberOption,
    GetOption,
} from "./9.negotiation.js";

import {
    internals,
    log10Floor,
    List,
    toObject,
    arrPush,
    arrJoin,
    arrShift,
    Record,
    hop,
    defineProperty,
    es3,
    fnBind,
    getInternalProperties,
    createRegExpRestore,
    secret,
    objCreate,
} from "./util.js";

// Currency minor units output from get-4217 grunt task, formatted
const currencyMinorUnits = {
    BHD: 3, BYR: 0, XOF: 0, BIF: 0, XAF: 0, CLF: 4, CLP: 0, KMF: 0, DJF: 0,
    XPF: 0, GNF: 0, ISK: 0, IQD: 3, JPY: 0, JOD: 3, KRW: 0, KWD: 3, LYD: 3,
    OMR: 3, PYG: 0, RWF: 0, TND: 3, UGX: 0, UYI: 0, VUV: 0, VND: 0,
};

// Define the NumberFormat constructor internally so it cannot be tainted
export function NumberFormatConstructor () {
    let locales = arguments[0];
    let options = arguments[1];

    if (!this || this === Intl) {
        return new Intl.NumberFormat(locales, options);
    }

    return InitializeNumberFormat(toObject(this), locales, options);
}

defineProperty(Intl, 'NumberFormat', {
    configurable: true,
    writable: true,
    value: NumberFormatConstructor,
});

// Must explicitly set prototypes as unwritable
defineProperty(Intl.NumberFormat, 'prototype', {
    writable: false,
});

/**
 * The abstract operation InitializeNumberFormat accepts the arguments
 * numberFormat (which must be an object), locales, and options. It initializes
 * numberFormat as a NumberFormat object.
 */
export function /*11.1.1.1 */InitializeNumberFormat (numberFormat, locales, options) {
    // This will be a internal properties object if we're not already initialized
    let internal = getInternalProperties(numberFormat);

    // Create an object whose props can be used to restore the values of RegExp props
    let regexpState = createRegExpRestore();

    // 1. If numberFormat has an [[initializedIntlObject]] internal property with
    // value true, throw a TypeError exception.
    if (internal['[[initializedIntlObject]]'] === true)
        throw new TypeError('`this` object has already been initialized as an Intl object');

    // Need this to access the `internal` object
    defineProperty(numberFormat, '__getInternalProperties', {
        value: function () {
            // NOTE: Non-standard, for internal use only
            if (arguments[0] === secret)
                return internal;
        },
    });

    // 2. Set the [[initializedIntlObject]] internal property of numberFormat to true.
    internal['[[initializedIntlObject]]'] = true;

    // 3. Let requestedLocales be the result of calling the CanonicalizeLocaleList
    //    abstract operation (defined in 9.2.1) with argument locales.
    let requestedLocales = CanonicalizeLocaleList(locales);

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

    // 6. Let opt be a new Record.
    let opt = new Record(),

    // 7. Let matcher be the result of calling the GetOption abstract operation
    //    (defined in 9.2.9) with the arguments options, "localeMatcher", "string",
    //    a List containing the two String values "lookup" and "best fit", and
    //    "best fit".
        matcher =  GetOption(options, 'localeMatcher', 'string', new List('lookup', 'best fit'), 'best fit');

    // 8. Set opt.[[localeMatcher]] to matcher.
    opt['[[localeMatcher]]'] = matcher;

    // 9. Let NumberFormat be the standard built-in object that is the initial value
    //    of Intl.NumberFormat.
    // 10. Let localeData be the value of the [[localeData]] internal property of
    //     NumberFormat.
    let localeData = internals.NumberFormat['[[localeData]]'];

    // 11. Let r be the result of calling the ResolveLocale abstract operation
    //     (defined in 9.2.5) with the [[availableLocales]] internal property of
    //     NumberFormat, requestedLocales, opt, the [[relevantExtensionKeys]]
    //     internal property of NumberFormat, and localeData.
    let r = ResolveLocale(
            internals.NumberFormat['[[availableLocales]]'], requestedLocales,
            opt, internals.NumberFormat['[[relevantExtensionKeys]]'], localeData
        );

    // 12. Set the [[locale]] internal property of numberFormat to the value of
    //     r.[[locale]].
    internal['[[locale]]'] = r['[[locale]]'];

    // 13. Set the [[numberingSystem]] internal property of numberFormat to the value
    //     of r.[[nu]].
    internal['[[numberingSystem]]'] = r['[[nu]]'];

    // The specification doesn't tell us to do this, but it's helpful later on
    internal['[[dataLocale]]'] = r['[[dataLocale]]'];

    // 14. Let dataLocale be the value of r.[[dataLocale]].
    let dataLocale = r['[[dataLocale]]'];

    // 15. Let s be the result of calling the GetOption abstract operation with the
    //     arguments options, "style", "string", a List containing the three String
    //     values "decimal", "percent", and "currency", and "decimal".
    let s = GetOption(options, 'style', 'string', new List('decimal', 'percent', 'currency'), 'decimal');

    // 16. Set the [[style]] internal property of numberFormat to s.
    internal['[[style]]'] = s;

    // 17. Let c be the result of calling the GetOption abstract operation with the
    //     arguments options, "currency", "string", undefined, and undefined.
    let c = GetOption(options, 'currency', 'string');

    // 18. If c is not undefined and the result of calling the
    //     IsWellFormedCurrencyCode abstract operation (defined in 6.3.1) with
    //     argument c is false, then throw a RangeError exception.
    if (c !== undefined && !IsWellFormedCurrencyCode(c))
        throw new RangeError("'" + c + "' is not a valid currency code");

    // 19. If s is "currency" and c is undefined, throw a TypeError exception.
    if (s === 'currency' && c === undefined)
        throw new TypeError('Currency code is required when style is currency');

    let cDigits;

    // 20. If s is "currency", then
    if (s === 'currency') {
        // a. Let c be the result of converting c to upper case as specified in 6.1.
        c = c.toUpperCase();

        // b. Set the [[currency]] internal property of numberFormat to c.
        internal['[[currency]]'] = c;

        // c. Let cDigits be the result of calling the CurrencyDigits abstract
        //    operation (defined below) with argument c.
        cDigits = CurrencyDigits(c);
    }

    // 21. Let cd be the result of calling the GetOption abstract operation with the
    //     arguments options, "currencyDisplay", "string", a List containing the
    //     three String values "code", "symbol", and "name", and "symbol".
    let cd = GetOption(options, 'currencyDisplay', 'string', new List('code', 'symbol', 'name'), 'symbol');

    // 22. If s is "currency", then set the [[currencyDisplay]] internal property of
    //     numberFormat to cd.
    if (s === 'currency')
        internal['[[currencyDisplay]]'] = cd;

    // 23. Let mnid be the result of calling the GetNumberOption abstract operation
    //     (defined in 9.2.10) with arguments options, "minimumIntegerDigits", 1, 21,
    //     and 1.
    let mnid = GetNumberOption(options, 'minimumIntegerDigits', 1, 21, 1);

    // 24. Set the [[minimumIntegerDigits]] internal property of numberFormat to mnid.
    internal['[[minimumIntegerDigits]]'] = mnid;

    // 25. If s is "currency", then let mnfdDefault be cDigits; else let mnfdDefault
    //     be 0.
    let mnfdDefault = s === 'currency' ? cDigits : 0;

    // 26. Let mnfd be the result of calling the GetNumberOption abstract operation
    //     with arguments options, "minimumFractionDigits", 0, 20, and mnfdDefault.
    let mnfd = GetNumberOption(options, 'minimumFractionDigits', 0, 20, mnfdDefault);

    // 27. Set the [[minimumFractionDigits]] internal property of numberFormat to mnfd.
    internal['[[minimumFractionDigits]]'] = mnfd;

    // 28. If s is "currency", then let mxfdDefault be max(mnfd, cDigits); else if s
    //     is "percent", then let mxfdDefault be max(mnfd, 0); else let mxfdDefault
    //     be max(mnfd, 3).
    let mxfdDefault = s === 'currency' ? Math.max(mnfd, cDigits)
                    : (s === 'percent' ? Math.max(mnfd, 0) : Math.max(mnfd, 3));

    // 29. Let mxfd be the result of calling the GetNumberOption abstract operation
    //     with arguments options, "maximumFractionDigits", mnfd, 20, and mxfdDefault.
    let mxfd = GetNumberOption(options, 'maximumFractionDigits', mnfd, 20, mxfdDefault);

    // 30. Set the [[maximumFractionDigits]] internal property of numberFormat to mxfd.
    internal['[[maximumFractionDigits]]'] = mxfd;

    // 31. Let mnsd be the result of calling the [[Get]] internal method of options
    //     with argument "minimumSignificantDigits".
    let mnsd = options.minimumSignificantDigits;

    // 32. Let mxsd be the result of calling the [[Get]] internal method of options
    //     with argument "maximumSignificantDigits".
    let mxsd = options.maximumSignificantDigits;

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
    // 34. Let g be the result of calling the GetOption abstract operation with the
    //     arguments options, "useGrouping", "boolean", undefined, and true.
    let g = GetOption(options, 'useGrouping', 'boolean', undefined, true);

    // 35. Set the [[useGrouping]] internal property of numberFormat to g.
    internal['[[useGrouping]]'] = g;

    // 36. Let dataLocaleData be the result of calling the [[Get]] internal method of
    //     localeData with argument dataLocale.
    let dataLocaleData = localeData[dataLocale];

    // 37. Let patterns be the result of calling the [[Get]] internal method of
    //     dataLocaleData with argument "patterns".
    let patterns = dataLocaleData.patterns;

    // 38. Assert: patterns is an object (see 11.2.3)

    // 39. Let stylePatterns be the result of calling the [[Get]] internal method of
    //     patterns with argument s.
    let stylePatterns = patterns[s];

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

    // In ES3, we need to pre-bind the format() function
    if (es3)
        numberFormat.format = GetFormatNumber.call(numberFormat);

    // Restore the RegExp properties
    regexpState.exp.test(regexpState.input);

    // Return the newly initialised object
    return numberFormat;
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

/* 11.2.3 */internals.NumberFormat = {
    '[[availableLocales]]': [],
    '[[relevantExtensionKeys]]': ['nu'],
    '[[localeData]]': {},
};

/**
 * When the supportedLocalesOf method of Intl.NumberFormat is called, the
 * following steps are taken:
 */
/* 11.2.2 */
defineProperty(Intl.NumberFormat, 'supportedLocalesOf', {
    configurable: true,
    writable: true,
    value: fnBind.call(function (locales) {
        // Bound functions only have the `this` value altered if being used as a constructor,
        // this lets us imitate a native function that has no constructor
        if (!hop.call(this, '[[availableLocales]]'))
            throw new TypeError('supportedLocalesOf() is not a constructor');

        // Create an object whose props can be used to restore the values of RegExp props
        let regexpState = createRegExpRestore(),

        // 1. If options is not provided, then let options be undefined.
            options = arguments[1],

        // 2. Let availableLocales be the value of the [[availableLocales]] internal
        //    property of the standard built-in object that is the initial value of
        //    Intl.NumberFormat.

            availableLocales = this['[[availableLocales]]'],

        // 3. Let requestedLocales be the result of calling the CanonicalizeLocaleList
        //    abstract operation (defined in 9.2.1) with argument locales.
            requestedLocales = CanonicalizeLocaleList(locales);

        // Restore the RegExp properties
        regexpState.exp.test(regexpState.input);

        // 4. Return the result of calling the SupportedLocales abstract operation
        //    (defined in 9.2.8) with arguments availableLocales, requestedLocales,
        //    and options.
        return SupportedLocales(availableLocales, requestedLocales, options);
    }, internals.NumberFormat),
});

/**
 * This named accessor property returns a function that formats a number
 * according to the effective locale and the formatting options of this
 * NumberFormat object.
 */
/* 11.3.2 */defineProperty(Intl.NumberFormat.prototype, 'format', {
    configurable: true,
    get: GetFormatNumber,
});

function GetFormatNumber() {
        let internal = this !== null && typeof this === 'object' && getInternalProperties(this);

        // Satisfy test 11.3_b
        if (!internal || !internal['[[initializedNumberFormat]]'])
            throw new TypeError('`this` value for format() is not an initialized Intl.NumberFormat object.');

        // The value of the [[Get]] attribute is a function that takes the following
        // steps:

        // 1. If the [[boundFormat]] internal property of this NumberFormat object
        //    is undefined, then:
        if (internal['[[boundFormat]]'] === undefined) {
            // a. Let F be a Function object, with internal properties set as
            //    specified for built-in functions in ES5, 15, or successor, and the
            //    length property set to 1, that takes the argument value and
            //    performs the following steps:
            let F = function (value) {
                // i. If value is not provided, then let value be undefined.
                // ii. Let x be ToNumber(value).
                // iii. Return the result of calling the FormatNumber abstract
                //      operation (defined below) with arguments this and x.
                return FormatNumber(this, /* x = */Number(value));
            };

            // b. Let bind be the standard built-in function object defined in ES5,
            //    15.3.4.5.
            // c. Let bf be the result of calling the [[Call]] internal method of
            //    bind with F as the this value and an argument list containing
            //    the single item this.
            let bf = fnBind.call(F, this);

            // d. Set the [[boundFormat]] internal property of this NumberFormat
            //    object to bf.
            internal['[[boundFormat]]'] = bf;
        }
        // Return the value of the [[boundFormat]] internal property of this
        // NumberFormat object.
        return internal['[[boundFormat]]'];
    }

Intl.NumberFormat.prototype.formatToParts = function(value) {
  let internal = this !== null && typeof this === 'object' && getInternalProperties(this);
  if (!internal || !internal['[[initializedNumberFormat]]'])
      throw new TypeError('`this` value for formatToParts() is not an initialized Intl.NumberFormat object.');

  let x = Number(value);
  return FormatNumberToParts(this, x);
};

function FormatNumberToParts (numberFormat, x) {

    // Create an object whose props can be used to restore the values of RegExp props
    let regexpState = createRegExpRestore(),

        internal = getInternalProperties(numberFormat),
        locale = internal['[[dataLocale]]'],
        nums   = internal['[[numberingSystem]]'],
        data   = internals.NumberFormat['[[localeData]]'][locale],
        ild    = data.symbols[nums] || data.symbols.latn,
        pattern,
        result = new List();

    if (!isNaN(x) && x < 0) {
        x = -x;
        pattern = internal['[[negativePattern]]'];
    } else {
        pattern = internal['[[positivePattern]]'];
    }

    let beginIndex = pattern.indexOf('{', 0),
        endIndex = 0,
        nextIndex = 0,
        length = pattern.length;

    while (beginIndex > -1 && beginIndex < length) {
        endIndex = pattern.indexOf('}', beginIndex);
        if (endIndex === -1)
            throw new Error();

        if (beginIndex > nextIndex)
            arrPush.call(result, { type: 'literal', value: pattern.substring(nextIndex, beginIndex) });

        let p = pattern.substring(beginIndex + 1, endIndex);

        if (p === 'number') {
            if (isNaN(x))
                arrPush.call(result, { type: 'nan', value: ild.nan });
            if (!isFinite(x))
                arrPush.call(result, { type: 'infinity', value: ild.infinity });

            // b. If the value of the [[style]] internal property of numberFormat is
            //    "percent", let x be 100 × x.
            if (internal['[[style]]'] === 'percent')
                x *= 100;

            let n;
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
                let digits = numSys[internal['[[numberingSystem]]']];
                // ii. Replace each digit in n with the value of digits[digit].
                n = String(n).replace(/\d/g, (digit) => {
                  return digits[digit];
                });
            }
            // f. Else use an implementation dependent algorithm to map n to the
            //    appropriate representation of n in the given numbering system.
            else
                n = String(n); // ###TODO###

            let decimalSplit = n.split('.');
            let integer = decimalSplit[0];
            let fraction = decimalSplit[1];

            // h. If the value of the [[useGrouping]] internal property of numberFormat
            //    is true, then insert an ILND String representing a grouping separator
            //    into an ILND set of locations within the integer part of n.
            if (internal['[[useGrouping]]'] === true) {
                // Primary group represents the group closest to the decimal
                let pgSize = data.patterns.primaryGroupSize || 3;

                // Secondary group is every other group
                let sgSize = data.patterns.secondaryGroupSize || pgSize;

                let groups = new List();

                // Group only if necessary
                if (integer.length > pgSize) {
                    // Index of the primary grouping separator
                    let end    = integer.length - pgSize;

                    // Starting index for our loop
                    let idx    = end % sgSize;

                    let start  = integer.slice(0, idx);

                    if (start.length)
                        arrPush.call(groups, start);

                    // Loop to separate into secondary grouping digits
                    while (idx < end) {
                        arrPush.call(groups, integer.slice(idx, idx + sgSize));
                        idx += sgSize;
                    }

                    // Add the primary grouping digits
                    arrPush.call(groups, integer.slice(end));
                } else {
                    arrPush.call(groups, integer);
                }

                while (groups.length) {
                    let integerGroup = arrShift.call(groups);
                    arrPush.call(result, { type: 'integer', value: integerGroup });
                    if (groups.length) {
                        arrPush.call(result, { type: 'group', value: ild.group });
                    }
                }
            } else {
                arrPush.call(result, { type: 'integer', value: integer });
            }

            if (fraction !== undefined) {
                arrPush.call(result, { type: 'decimal', value: ild.decimal });
                arrPush.call(result, { type: 'fraction', value: fraction });
            }

        } else if (p === 'plusSign') {
            arrPush.call(result, { type: 'plusSign', value: ild.plusSign });
        } else if (p === 'minusSign') {
            arrPush.call(result, { type: 'minusSign', value: ild.minusSign });
        } else if (p === '{percentSign}' && internal['[[style]]'] === 'percent') {
            arrPush.call(result, { type: 'percentSign', value: ild.percentSign });
        } else if (p === 'currency' && internal['[[style]]'] === 'currency') {
            let cd,
            // a. Let currency be the value of the [[currency]] internal property of
            //    numberFormat.
                currency = internal['[[currency]]'],

            // Shorthand for the currency data
                cData = data.currencies[currency];

            // b. If the value of the [[currencyDisplay]] internal property of
            //    numberFormat is "code", then let cd be currency.
            // c. Else if the value of the [[currencyDisplay]] internal property of
            //    numberFormat is "symbol", then let cd be an ILD string representing
            //    currency in short form. If the implementation does not have such a
            //    representation of currency, then use currency itself.
            // d. Else if the value of the [[currencyDisplay]] internal property of
            //    numberFormat is "name", then let cd be an ILD string representing
            //    currency in long form. If the implementation does not have such a
            //    representation of currency, then use currency itself.
            switch (internal['[[currencyDisplay]]']) {
                case 'symbol':
                    cd = cData || currency;
                    break;

                default:
                case 'code':
                case 'name':
                    cd = currency;
            }

            arrPush.call(result, { type: 'currency', value: cd });
        } else {
            arrPush.call(result, { type: 'literal', value: pattern.substring(beginIndex, endIndex + 1) });
        }

        nextIndex = endIndex + 1;
        beginIndex = pattern.indexOf('{', nextIndex);
    }

    if (nextIndex < length)
        arrPush.call(result, { type: 'literal', value: pattern.substring(nextIndex, length) });

    // Restore the RegExp properties
    regexpState.exp.test(regexpState.input);

    // 7. Return result.
    return result;
}

export function FormatNumber (numberFormat, x) {
    let parts = FormatNumberToParts(numberFormat, x);
    let result = '';
    for (let idx in parts) {
        result += parts[idx].value;
    }
    return result;
}

/**
 * When the ToRawPrecision abstract operation is called with arguments x (which
 * must be a finite non-negative number), minPrecision, and maxPrecision (both
 * must be integers between 1 and 21) the following steps are taken:
 */
function ToRawPrecision (x, minPrecision, maxPrecision) {
    // 1. Let p be maxPrecision.
    let p = maxPrecision;

    let m, e;

    // 2. If x = 0, then
    if (x === 0) {
        // a. Let m be the String consisting of p occurrences of the character "0".
        m = arrJoin.call(Array (p + 1), '0');
        // b. Let e be 0.
        e = 0;
    }
    // 3. Else
    else {
        // a. Let e and n be integers such that 10ᵖ⁻¹ ≤ n < 10ᵖ and for which the
        //    exact mathematical value of n × 10ᵉ⁻ᵖ⁺¹ – x is as close to zero as
        //    possible. If there are two such sets of e and n, pick the e and n for
        //    which n × 10ᵉ⁻ᵖ⁺¹ is larger.
        e = log10Floor(Math.abs(x));

        // Easier to get to m from here
        let f = Math.round(Math.exp((Math.abs(e - p + 1)) * Math.LN10));

        // b. Let m be the String consisting of the digits of the decimal
        //    representation of n (in order, with no leading zeroes)
        m = String(Math.round(e - p + 1 < 0 ? x * f : x / f));
    }

    // 4. If e ≥ p, then
    if (e >= p)
        // a. Return the concatenation of m and e-p+1 occurrences of the character "0".
        return m + arrJoin.call(Array(e-p+1 + 1), '0');

    // 5. If e = p-1, then
    else if (e === p - 1)
        // a. Return m.
        return m;

    // 6. If e ≥ 0, then
    else if (e >= 0)
        // a. Let m be the concatenation of the first e+1 characters of m, the character
        //    ".", and the remaining p–(e+1) characters of m.
        m = m.slice(0, e + 1) + '.' + m.slice(e + 1);

    // 7. If e < 0, then
    else if (e < 0)
        // a. Let m be the concatenation of the String "0.", –(e+1) occurrences of the
        //    character "0", and the string m.
        m = '0.' + arrJoin.call(Array (-(e+1) + 1), '0') + m;

    // 8. If m contains the character ".", and maxPrecision > minPrecision, then
    if (m.indexOf(".") >= 0 && maxPrecision > minPrecision) {
        // a. Let cut be maxPrecision – minPrecision.
        let cut = maxPrecision - minPrecision;

        // b. Repeat while cut > 0 and the last character of m is "0":
        while (cut > 0 && m.charAt(m.length-1) === '0') {
            //  i. Remove the last character from m.
            m = m.slice(0, -1);

            //  ii. Decrease cut by 1.
            cut--;
        }

        // c. If the last character of m is ".", then
        if (m.charAt(m.length-1) === '.')
            //    i. Remove the last character from m.
            m = m.slice(0, -1);
    }
    // 9. Return m.
    return m;
}

/**
 * @spec[tc39/ecma402/master/spec/numberformat.html]
 * @clause[sec-torawfixed]
 * When the ToRawFixed abstract operation is called with arguments x (which must
 * be a finite non-negative number), minInteger (which must be an integer between
 * 1 and 21), minFraction, and maxFraction (which must be integers between 0 and
 * 20) the following steps are taken:
 */
function ToRawFixed(x, minInteger, minFraction, maxFraction) {
    // 1. Let f be maxFraction.
    let f = maxFraction;
    // 2. Let n be an integer for which the exact mathematical value of n ÷ 10f – x is as close to zero as possible. If there are two such n, pick the larger n.
    let p = Math.pow(10, f) * x; // ###TODO: add description for this variable p
    let n = p > Math.floor(p) ? Math.round(p) : p + 1;
    // 3. If n = 0, let m be the String "0". Otherwise, let m be the String consisting of the digits of the decimal representation of n (in order, with no leading zeroes).
    let m = (n === 0 ? "0" : (n + '').split('.')[0]);

    let int;
    // 4. If f ≠ 0, then
    if (f !== 0) {
        // a. Let k be the number of characters in m.
        let k = m.length;
        // a. If k ≤ f, then
        if (k <= f) {
            // i. Let z be the String consisting of f+1–k occurrences of the character "0".
            let z = arrJoin.call(Array(f + 1 - k + 1), '0');
            // ii. Let m be the concatenation of Strings z and m.
            m = z + m;
            // iii. Let k be f+1.
            k = f + 1;
        }
        // a. Let a be the first k–f characters of m, and let b be the remaining f characters of m.
        let a = m.slice(0, k - f), b = m.slice(-(k - f));
        // a. Let m be the concatenation of the three Strings a, ".", and b.
        m = a + "." + b;
        // a. Let int be the number of characters in a.
        int = a.length;
    }
    // 5. Else, let int be the number of characters in m.
    else int = m.length;
    // 6. Let cut be maxFraction – minFraction.
    let cut = maxFraction - minFraction;
    // 7. Repeat while cut > 0 and the last character of m is "0":
    while (cut > 0 && m.slice(-1) === "0") {
        // a. Remove the last character from m.
        m = m.slice(0, -1);
        // a. Decrease cut by 1.
        cut--;
    }
    // 8. If the last character of m is ".", then
    if (m.slice(-1) === ".") {
        // a. Remove the last character from m.
        m = m.slice(0, -1);
    }
    // 9. If int < minInteger, then
    if (int < minInteger) {
        // a. Let z be the String consisting of minInteger–int occurrences of the character "0".
        let z = arrJoin.call(Array(minInteger - int + 1), '0');
        // a. Let m be the concatenation of Strings z and m.
        m = z + m;
    }
    // 10. Return m.
    return m;
}

// Sect 11.3.2 Table 2, Numbering systems
// ======================================
let numSys = {
    arab: ['\u0660', '\u0661', '\u0662', '\u0663', '\u0664', '\u0665', '\u0666', '\u0667', '\u0668', '\u0669'],
    arabext: ['\u06F0', '\u06F1', '\u06F2', '\u06F3', '\u06F4', '\u06F5', '\u06F6', '\u06F7', '\u06F8', '\u06F9'],
    bali: ['\u1B50', '\u1B51', '\u1B52', '\u1B53', '\u1B54', '\u1B55', '\u1B56', '\u1B57', '\u1B58', '\u1B59'],
    beng: ['\u09E6', '\u09E7', '\u09E8', '\u09E9', '\u09EA', '\u09EB', '\u09EC', '\u09ED', '\u09EE', '\u09EF'],
    deva: ['\u0966', '\u0967', '\u0968', '\u0969', '\u096A', '\u096B', '\u096C', '\u096D', '\u096E', '\u096F'],
    fullwide: ['\uFF10', '\uFF11', '\uFF12', '\uFF13', '\uFF14', '\uFF15', '\uFF16', '\uFF17', '\uFF18', '\uFF19'],
    gujr: ['\u0AE6', '\u0AE7', '\u0AE8', '\u0AE9', '\u0AEA', '\u0AEB', '\u0AEC', '\u0AED', '\u0AEE', '\u0AEF'],
    guru: ['\u0A66', '\u0A67', '\u0A68', '\u0A69', '\u0A6A', '\u0A6B', '\u0A6C', '\u0A6D', '\u0A6E', '\u0A6F'],
    hanidec: ['\u3007', '\u4E00', '\u4E8C', '\u4E09', '\u56DB', '\u4E94', '\u516D', '\u4E03', '\u516B', '\u4E5D'],
    khmr: ['\u17E0', '\u17E1', '\u17E2', '\u17E3', '\u17E4', '\u17E5', '\u17E6', '\u17E7', '\u17E8', '\u17E9'],
    knda: ['\u0CE6', '\u0CE7', '\u0CE8', '\u0CE9', '\u0CEA', '\u0CEB', '\u0CEC', '\u0CED', '\u0CEE', '\u0CEF'],
    laoo: ['\u0ED0', '\u0ED1', '\u0ED2', '\u0ED3', '\u0ED4', '\u0ED5', '\u0ED6', '\u0ED7', '\u0ED8', '\u0ED9'],
    latn: ['\u0030', '\u0031', '\u0032', '\u0033', '\u0034', '\u0035', '\u0036', '\u0037', '\u0038', '\u0039'],
    limb: ['\u1946', '\u1947', '\u1948', '\u1949', '\u194A', '\u194B', '\u194C', '\u194D', '\u194E', '\u194F'],
    mlym: ['\u0D66', '\u0D67', '\u0D68', '\u0D69', '\u0D6A', '\u0D6B', '\u0D6C', '\u0D6D', '\u0D6E', '\u0D6F'],
    mong: ['\u1810', '\u1811', '\u1812', '\u1813', '\u1814', '\u1815', '\u1816', '\u1817', '\u1818', '\u1819'],
    mymr: ['\u1040', '\u1041', '\u1042', '\u1043', '\u1044', '\u1045', '\u1046', '\u1047', '\u1048', '\u1049'],
    orya: ['\u0B66', '\u0B67', '\u0B68', '\u0B69', '\u0B6A', '\u0B6B', '\u0B6C', '\u0B6D', '\u0B6E', '\u0B6F'],
    tamldec: ['\u0BE6', '\u0BE7', '\u0BE8', '\u0BE9', '\u0BEA', '\u0BEB', '\u0BEC', '\u0BED', '\u0BEE', '\u0BEF'],
    telu: ['\u0C66', '\u0C67', '\u0C68', '\u0C69', '\u0C6A', '\u0C6B', '\u0C6C', '\u0C6D', '\u0C6E', '\u0C6F'],
    thai: ['\u0E50', '\u0E51', '\u0E52', '\u0E53', '\u0E54', '\u0E55', '\u0E56', '\u0E57', '\u0E58', '\u0E59'],
    tibt: ['\u0F20', '\u0F21', '\u0F22', '\u0F23', '\u0F24', '\u0F25', '\u0F26', '\u0F27', '\u0F28', '\u0F29'],
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
/* 11.3.3 */defineProperty(Intl.NumberFormat.prototype, 'resolvedOptions', {
    configurable: true,
    writable: true,
    value: function () {
        let prop,
            descs = new Record(),
            props = [
                'locale', 'numberingSystem', 'style', 'currency', 'currencyDisplay',
                'minimumIntegerDigits', 'minimumFractionDigits', 'maximumFractionDigits',
                'minimumSignificantDigits', 'maximumSignificantDigits', 'useGrouping',
            ],
            internal = this !== null && typeof this === 'object' && getInternalProperties(this);

        // Satisfy test 11.3_b
        if (!internal || !internal['[[initializedNumberFormat]]'])
            throw new TypeError('`this` value for resolvedOptions() is not an initialized Intl.NumberFormat object.');

        for (let i = 0, max = props.length; i < max; i++) {
            if (hop.call(internal, prop = '[['+ props[i] +']]'))
                descs[props[i]] = { value: internal[prop], writable: true, configurable: true, enumerable: true };
        }

        return objCreate({}, descs);
    },
});
