var IntlPolyfill = require('../');

function assertEqual(value, expected, message) {
    console.log(message);
    if (value !== expected) {
        console.error(' > ERROR: expected value ' + expected + ' but the actual value is ' + value);
        process.exit(1);
    } else {
        console.log(' > PASSED');
    }
}

function assertNotEqual(value, expected, message) {
    console.log(message);
    if (value === expected) {
        console.error(' > ERROR: expected value ' + expected + ' but the actual value is ' + value);
        process.exit(1);
    } else {
        console.log(' > PASSED');
    }
}

/foo/.exec('a foo test');
new IntlPolyfill.NumberFormat('en-US', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
});
assertEqual(RegExp.input, 'a foo test', 'Normally, RegExp.input should be cached and restored');
assertEqual(RegExp.lastMatch, 'foo', 'Normally, RegExp.lastMatch should be cached and restored');

// Issues #231
/function[\s\S]+(})/.exec('function defineProperty\\(\\) \\{\n    \\[native code\\]\n\\}');
new IntlPolyfill.NumberFormat('en-US', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
});
assertEqual(RegExp.input, 'function defineProperty\\(\\) \\{\n    \\[native code\\]\n\\}', 'Normally, RegExp.input should be cached and restored');
assertEqual(RegExp.lastMatch, 'function defineProperty\\(\\) \\{\n    \\[native code\\]\n\\}', 'Normally, RegExp.lastMatch should be cached and restored');

IntlPolyfill.__disableRegExpRestore();
/foo/.exec('a foo test');
new IntlPolyfill.NumberFormat('en-US', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
});
assertNotEqual(RegExp.input, 'a foo test', 'After invoking __disableRegExpRestore, RegExp.input should not be cached and restored');
assertNotEqual(RegExp.lastMatch, 'foo', 'After invoking __disableRegExpRestore, RegExp.lastMatch should not be cached and restored');
