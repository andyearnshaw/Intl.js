var m = require('./lib/core.js'),
    IntlPolyfill = m.default;

// Expose `IntlPolyfill` as global to add locale data into runtime later on.
global.IntlPolyfill = IntlPolyfill;

// Require all locale data for `Intl`. This module will be
// ignored when bundling for the browser with Browserify/Webpack.
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
