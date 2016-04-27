import IntlPolyfill from "./core.js";

// hack to export the polyfill as global Intl if needed
if (typeof Intl !== undefined) {
    global.Intl = IntlPolyfill;
    IntlPolyfill.__applyLocaleSensitivePrototypes();
}

export default IntlPolyfill;
