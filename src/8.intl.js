import {
    CanonicalizeLocaleList,
} from "./9.negotiation.js";

// 8 The Intl Object
export const Intl = {};

// 8.2 Function Properties of the Intl Object

// 8.2.1
// @spec[tc39/ecma402/master/spec/intl.html]
// @clause[sec-intl.getcanonicallocales]
Intl.getCanonicalLocales = function (locales) {
    // 1. Let ll be ? CanonicalizeLocaleList(locales).
    let ll = CanonicalizeLocaleList(locales);
    // 2. Return CreateArrayFromList(ll).
    {
        let result = [];
        for (let code in ll) {
          result.push(ll[code]);
        }
        return result;
    }
};
