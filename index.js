var m = require('./lib/core.js'),
    IntlPolyfill = m.default;

// add locale data for all locales into runtime
global.IntlPolyfill = IntlPolyfill;
require('./locale-data/complete.js');

// hack to export the polyfill as global Intl if needed
if (!global.Intl) {
    global.Intl = IntlPolyfill;
    IntlPolyfill.__applyLocaleSensitivePrototypes();
}

// providing an idiomatic api for the nodejs version of this module
module.exports = exports = IntlPolyfill;
// preserving the original api in case another module is relying on that
exports.default = IntlPolyfill;
