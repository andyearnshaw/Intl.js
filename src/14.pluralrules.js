import {
  Intl
} from './8.intl.js';

import {
  GetOption,
  GetNumberOption,
  SupportedLocales,
  ResolveLocale,
  CanonicalizeLocaleList
} from './9.negotiation.js';

import {
  FormatNumberToString
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

  if (internal['[[InitializedIntlObject]]'] === true)
    throw new TypeError('`this` object has already been initialized as an Intl object');

  defineProperty(pluralRules, '__getInternalProperties', {
    value: function () {
      // NOTE: Non-standard, for internal use only
      if (arguments[0] === secret)
        return internal;
    }
  });

  internal['[[InitializedIntlObject]]'] = true;

  let requestedLocales = CanonicalizeLocaleList(locales);

	if (options === undefined)
			options = {};
	else
			options = toObject(options);

  let opt = new Record();

  //XXX: Should we have a matcher here?
  //let matcher =  GetOption(options, 'localeMatcher', 'string', new List('lookup', 'best fit'), 'best fit');
  let t = GetOption(options, 'type', 'string', new List('cardinal', 'ordinal'), 'cardinal');
  internal['[[type]]'] = t;

  let minID = GetNumberOption(options, 'minimumIntegerDigits', 1, 21, 1);
  let minFD = GetNumberOption(options, 'minimumFractionDigits', 0, 20, 0);

  let mxfdDefault = Math.max(minFD, 3);

  let maxFD = GetNumberOption(options, 'maximumFractionDigits', minFD, 20, mxfdDefault);

  internal['[[minimumIntegerDigits]]'] = minID;
  internal['[[minimumFractionDigits]]'] = minFD;
  internal['[[maximumFractionDigits]]'] = maxFD;

  let minSD = options.minimumSignificantDigits;
  let maxSD = options.maximumSignificantDigits;

  if (minSD !== undefined || maxSD !== undefined) {
    minSD = GetNumberOption(options, 'minimumSignificantDigits', 1, 21, 1);
    maxSD = GetNumberOption(options, 'maximumSignificantDigits', minSD, 21, 21);
    internal['[[minimumSignificantDigits]]'] = minSD;
    internal['[[maximumSignificantDigits]]'] = maxSD;
  }

  let localeData = internals.PluralRules['[[localeData]]'];
  let r = ResolveLocale(
    internals.PluralRules['[[availableLocales]]'], requestedLocales,
    opt, internals.PluralRules['[[relevantExtensionKeys]]'], localeData
  );

  internal['[[locale]]'] = r['[[locale]]'];
  internal['[[InitializedPluralRules]]'] = true;

  return pluralRules;
}

function GetOperands(s) {
  let n = Number(s);
  let dp = s.indexOf('.');

  let iv, fv, ft, f, v, w, t;

  if (dp === -1) {
    iv = n;
    f = 0;
    v = 0;
  } else {
    iv = s.substring(0, dp);
    fv = s.substring(dp);
    f = Number(fv);
    v = fv.length;
  }

  let i = Math.abs(Number(iv));

  if (f !== 0) {
    ft = fv;
    while (ft.endsWith('0')) {
      ft = ft.substr(-1);
    }
    w = ft.length;
    t = Number(ft);
  } else {
    w = 0;
    t = 0;
  }
  let result = new Record();
  result['[[Number]]'] = n;
  result['[[IntegerDigits]]'] = i;
  result['[[NumberOfFractioNDigits]]'] = v;
  result['[[NumberOfFractionDigitsWithoutTrailing]]'] = w;
  result['[[FractionDigits]]'] = f;
  result['[[FractionDigitsWithoutTrailing]]'] = t;
  return result;
}

function PluralRuleSelection(locale, type, n, operands) {
  let localeData = internals.PluralRules['[[localeData]]'];

  let fn = localeData[locale][type];

  return fn(
    operands['[[Number]]']
  );
}

function ResolvePlural(pluralRules, n) {
  if (!Number.isFinite(n)) {
    return 'other';
  }

  let internal = getInternalProperties(pluralRules);
  let locale = internal['[[locale]]'];
  let type = internal['[[type]]'];
  let s = FormatNumberToString(pluralRules, n);
  let operands = GetOperands(s);
  return PluralRuleSelection(locale, type, n, operands);
}

internals.PluralRules = {
  '[[availableLocales]]' : [],
  '[[relevantExtensionKeys]]': [],
  '[[localeData]]': {}
}

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
})

defineProperty(Intl.PluralRules.prototype, 'resolvedOptions', {
  configurable: true,
  writable: true,
  value: function() {
    let prop,
      descs = new Record(),
      props = [
        'locale', 'type',
        'minimumIntegerDigits', 'minimumFractionDigits', 'maximumFractionDigits',
        'minimumSignificantDigits', 'maximumSignificantDigits',
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
