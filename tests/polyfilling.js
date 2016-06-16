const vm = require('vm');

function assert(value, expected, message) {
    console.log(message);
    if (value !== expected) {
        console.error(' > ERROR: expected value ' + expected + ' but the actual value is ' + value);
        process.exit(1);
    } else {
        console.log(' > PASSED');
    }
}

const context = new vm.createContext();
var script = new vm.Script('this');
context.self = void 0;
const window = script.runInContext(context);

const fs = require('fs');
const code = fs.readFileSync(__dirname + '/../dist/Intl.js', 'utf8');

// first evaluation
window.window = window;  // circular, in case the polyfill uses window
var originalIntl = window.Intl;
var script = new vm.Script(code);
script.runInContext(context);
assert(typeof window.Intl, 'object', 'for this test to function, window.Intl is required');
assert(typeof window.IntlPolyfill, 'object', 'polyfill should always add the custom global IntlPolyfill');
if (originalIntl) {
  assert(window.Intl, originalIntl, 'validating that the polyfilling process does not touch the original Intl value if it exists');
}
// second evaluation
window.window = window;  // circular, in case the polyfill uses window
window.Intl = undefined; // disabling Intl
var script = new vm.Script(code);
script.runInContext(context);
assert(window.Intl, window.IntlPolyfill, 'validating that the polyfilling process does patch Intl if it does not exist');
