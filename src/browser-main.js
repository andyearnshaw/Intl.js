import IntlPolyfill from "./core.js";

// hack to export the polyfill as global Intl if needed
if (typeof Intl === 'undefined') {
    try {
        window.Intl = IntlPolyfill;
        IntlPolyfill.__applyLocaleSensitivePrototypes();
    } catch (e) {
        // can be read only property
    }
}

export default IntlPolyfill;
