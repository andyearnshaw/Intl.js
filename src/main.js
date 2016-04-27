import IntlPolyfill from "./core.js";

// hack to export the polyfill as global Intl if needed
if (typeof Intl !== 'undefined') {
    Intl = IntlPolyfill;
    IntlPolyfill.__applyLocaleSensitivePrototypes();
}

export default IntlPolyfill;
