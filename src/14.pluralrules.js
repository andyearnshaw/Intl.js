import {
  Intl
} from './8.intl.js';

import {
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

  defineProperty(dateTimeFormat, '__getInternalProperties', {
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
  internal['[[Type]]'] = t;

  let minID = Get(options, "minimumIntegerDigits");
  let minFD = Get(options, "minimumFractionDigits");
  let maxFD = Get(options, "maximumFractionDigits");
  let minSD = Get(options, "minimumSignificantDigits");
  let maxSD = Get(options, "maximumSignificantDigits");
  internal['[[MinimumIntegerDigits]]'] = minID;
  internal['[[MinimumFractionDigits]]'] = minFD;
  internal['[[MaximumFractionDigits]]'] = maxFD;
  internal['[[MinimumSignificantDigits]]'] = minSD;
  internal['[[MaximumSignificantDigits]]'] = maxSD;

  let r = ResolveLocale(
    internals.PluralRules['[[availableLocales]]'], requestedLocales,
    opt, internals.PluralRules['[[relevantExtensionKeys]]'], localeData
  );

  internal['[[Locale]]'] = r.['[[locale]]'];
  internal['[[InitializedPluralRules]]'] = true;

  return pluralRules;
}

function GetOperands(s) {

}

function ResolvePlural(pluralRules, n) {

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
    let n = ToNumber(value);
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
