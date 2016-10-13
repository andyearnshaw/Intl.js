import {
  Intl
} from './8.intl.js';

import {
  GetOption,
  GetNumberOption,
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
  toObject,
  secret,
  defineProperty
} from './util.js';

export function PluralRulesConstructor() {
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
  value: PluralRulesConstructor
});

defineProperty(PluralRulesConstructor, 'prototype', {
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
  internal['[[Type]]'] = t;

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

  internal['[[Locale]]'] = r['[[locale]]'];
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
  let locale = internal['[[Locale]]'];
  let type = internal['[[Type]]'];
  let s = FormatNumberToString(pluralRules, n);
  let operands = GetOperands(s);
  return PluralRuleSelection(locale, type, n, operands);
}

internals.PluralRules = {
  '[[availableLocales]]' : [],
  '[[relevantExtensionKeys]]': [],
  '[[localeData]]': {}
}

defineProperty(Intl.PluralRules, 'supportedLoclaesOf', {
  configurable: true,
  writable: true,
  value: null
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
        'Locale', 'Type',
        'MinimumIntegerDigits', 'MinimumFractionDigits', 'MaximumFractionDigits',
        'MinimumSignificantDigits', 'MaximumSignificantDigits',
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
