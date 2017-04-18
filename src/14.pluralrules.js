import plurals from '../node_modules/make-plural/es6/plurals';

import {
    Intl
} from './8.intl.js';

import {
    GetOption,
    SupportedLocales,
    ResolveLocale,
    CanonicalizeLocaleList
} from './9.negotiation.js';

import {
    SetNumberFormatDigitOptions
} from './11.numberformat.js';

import {
    internals,
    getInternalProperties,
    Record,
    List,
    hop,
    objCreate,
    fnBind,
    toObject,
    secret,
    createRegExpRestore,
    defineProperty
} from './util.js';

export function PluralRules() {
    let locales = arguments[0];
    let options = arguments[1];

    if (!this || this === Intl) {
        return new Intl.PluralRules(locales, options);
    }
    return InitializePluralRules(toObject(this), locales, options);
}

defineProperty(Intl, 'PluralRules', {
    configurable: true,
    writable: true,
    value: PluralRules
});

defineProperty(PluralRules, 'prototype', {
    writable: false
});

export function InitializePluralRules (pluralRules, locales, options) {
    let internal = getInternalProperties(pluralRules);

    // 1. If pluralRules.[[InitializedIntlObject]] is true, throw a TypeError exception.
    if (internal['[[InitializedIntlObject]]'] === true)
        throw new TypeError('`this` object has already been initialized as an Intl object');

    defineProperty(pluralRules, '__getInternalProperties', {
        value: function () {
            // NOTE: Non-standard, for internal use only
            if (arguments[0] === secret)
                return internal;
        }
    });

    // 2. Set pluralRules.[[InitializedIntlObject]] to true.
    internal['[[InitializedIntlObject]]'] = true;

    // 3. Let requestedLocales be ? CanonicalizeLocaleList(locales).
    let requestedLocales = CanonicalizeLocaleList(locales);

    // 4. If options is undefined, then
    if (options === undefined)
        // a. Let options be ObjectCreate(%ObjectPrototype%).
        options = {};
    // 5. Else
    else
        // a. Let options be ? ToObject(options).
        options = toObject(options);

    // 6. Let t be ? GetOption(options, "type", "string", « "cardinal", "ordinal" », "cardinal").
    let t = GetOption(options, 'type', 'string', new List('cardinal', 'ordinal'), 'cardinal');

    // 7 . Set pluralRules.[[Type]] to t.
    internal['[[type]]'] = t;

    // 8. Let opt be a new Record.
    let opt = new Record();

    // 9. Let matcher be ? GetOption(options, "localeMatcher", "string", « "lookup", "best fit" », "best fit").
    let matcher =  GetOption(options, 'localeMatcher', 'string', new List('lookup', 'best fit'), 'best fit');
    // 10. Set opt.[[localeMatcher]] to matcher.
    opt['[[localeMatcher]]'] = matcher;

    // 11. Perform ? SetNumberFormatOptions(pluralRules, options, 0).
    SetNumberFormatDigitOptions(internals, options, 0);

    // 12. If pluralRules.[[maximumFractionDigits]] is undefined, then
    if (internals['[[maximumFractionDigits]]'] === undefined) {
        // a. Set pluralRules.[[maximumFractionDigits]] to max(pluralRules.[[minimumFractionDigits]], 3).
        internals['[[maximumFractionDigits]]'] = Math.max(internals['[[minimumFractionDigits]]'], 3);
    }

    let localeData = internals.PluralRules['[[localeData]]'];

    // 13. Let r be ResolveLocale(%PluralRules%.[[AvailableLocales]], requestedLocales, opt).
    let r = ResolveLocale(
        internals.PluralRules['[[availableLocales]]'], requestedLocales,
        opt, internals.PluralRules['[[relevantExtensionKeys]]'], localeData
    );

    // 14. Set pluralRules.[[Locale]] to the value of r.[[Locale]].
    internal['[[locale]]'] = r['[[locale]]'];

    // 15. Set pluralRules.[[InitializedPluralRules]] to true.
    internal['[[InitializedPluralRules]]'] = true;

    // 16. Return pluralRules.
    return pluralRules;
}

// make-plurals handls GetOperands
function PluralRuleSelection(locale, type, s) {
    for (let l = locale; l; l = l.replace(/[-_]?[^-_]*$/, '')) {
        const pf = plurals[l];
        if (pf) return pf(s, type === 'ordinal');
    }
    return 'other';
}

function ResolvePlural(pluralRules, n) {
    // 1. Assert: Type(pluralRules) is Object and pluralRules has an [[InitializedPluralRules]] internal slot whose value is true.

    // 2. Assert: Type(n) is Number.

    // 3. If isFinite(n) is false, then
    if (!Number.isFinite(n)) {
        // a. Return "other".
        return 'other';
    }

    let internal = getInternalProperties(pluralRules);

    // 4. Let locale be pluralRules.[[Locale]].
    let locale = internal['[[locale]]'];

    // 5. Let type be pluralRules.[[Type]].
    let type = internal['[[type]]'];

    // 8. Return ? PluralRuleSelection(locale, type, n, operands). 
    return PluralRuleSelection(locale, type, n);
}

internals.PluralRules = {
    '[[availableLocales]]' : Object.keys(plurals),
    '[[relevantExtensionKeys]]': [],
    '[[localeData]]': {}
};

defineProperty(Intl.PluralRules, 'supportedLocalesOf', {
    configurable: true,
    writable: true,
    value: fnBind.call(function (locales) {
        // Bound functions only have the `this` value altered if being used as a constructor,
        // this lets us imitate a native function that has no constructor
        if (!hop.call(this, '[[availableLocales]]'))
            throw new TypeError('supportedLocalesOf() is not a constructor');

        // Create an object whose props can be used to restore the values of RegExp props
        let regexpRestore = createRegExpRestore(),

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
        regexpRestore();

        // 4. Return the result of calling the SupportedLocales abstract operation
        //    (defined in 9.2.8) with arguments availableLocales, requestedLocales,
        //    and options.
        return SupportedLocales(availableLocales, requestedLocales, options);
    }, internals.PluralRules)
});



defineProperty(Intl.PluralRules.prototype, 'select', {
    configurable: true,
    value: function(value) {
        let pluralRules = this;
        let n = Number(value);
        return ResolvePlural(pluralRules, n);
    }
});

defineProperty(Intl.PluralRules.prototype, 'resolvedOptions', {
    configurable: true,
    writable: true,
    value: function() {
        let prop,
            descs = new Record(),
            props = [
                'locale', 'type',
                'minimumIntegerDigits', 'minimumFractionDigits', 'maximumFractionDigits',
                'minimumSignificantDigits', 'maximumSignificantDigits'
            ],
            internal = this !== null && typeof this === 'object' && getInternalProperties(this);

        if (!internal || !internal['[[InitializedPluralRules]]'])
            throw new TypeError('`this` value for resolvedOptions() is not an initialized Intl.PluralRules object.');

        for (let i = 0, max = props.length; i < max; i++) {
            if (hop.call(internal, prop = '[['+ props[i] +']]'))
                descs[props[i]] = { value: internal[prop], writable: true, configurable: true, enumerable: true };
        }

        return objCreate({}, descs);
    }
});
