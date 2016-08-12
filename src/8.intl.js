import {
    CanonicalizeLocaleList
} from "./9.negotiation.js";

// 8 The Intl Object
export const Intl = {};

// 8.2 Function Properties of the Intl Object

// 8.2.1
// @spec[tc39/ecma402/master/spec/intl.html]
// @clause[sec-intl.getcanonicallocales]
function getCanonicalLocales (locales) {
    // 1. Let ll be ? CanonicalizeLocaleList(locales).
    let ll = CanonicalizeLocaleList(locales);
    // 2. Return CreateArrayFromList(ll).
    {
        let result = [];

        let len = ll.length;
        let k = 0;

        while (k < len) {
            result[k] = ll[k];
            k++;
        }
        return result;
    }
}

Object.defineProperty(Intl, 'getCanonicalLocales', {
  enumerable: false,
  configurable: true,
  writable: true,
  value: getCanonicalLocales
});
