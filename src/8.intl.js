import {
    defineProperty,
} from "./util.js";

import {
  CanonicalizeLocaleList
} from "./9.negotiation.js";

export const Intl = {};

function GetCanonicalLocales (locales) {
  let codes = CanonicalizeLocaleList(locales);
  let result = [];
  for (let code in codes) {
    result.push(codes[code]);
  }
  return result;
}

defineProperty(Intl, 'getCanonicalLocales', {
    configurable: true,
    value: GetCanonicalLocales,
});
