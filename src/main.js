/* jslint esnext: true */

import IntlPolyfill from "./core";

// hack to export the polyfill as global Intl if needed
if (!this.Intl) {
    this.Intl = IntlPolyfill;
    IntlPolyfill.__applyLocaleSensitivePrototypes();
}

export default IntlPolyfill;
