var IntlPolyfill = require('../');

function assert(value, expected, message) {
    console.log(message);
    if (value !== expected) {
        console.error(' > ERROR: expected value ' + expected + ' but the actual value is ' + value);
        process.exit(1);
    } else {
        console.log(' > PASSED');
    }
}

assert(new IntlPolyfill.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
}).format(0.015), "0,02", 'fractional digits');

assert(new IntlPolyfill.NumberFormat('en-US', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
}).format(59.88), '£59.88', 'currency with fragtional digits');

assert(new IntlPolyfill.DateTimeFormat('en', {
    month:'numeric',
    day: 'numeric'
}).format(new Date('2016/05/16')), '5/16', 'month and day');

// Issue #152
assert(new IntlPolyfill.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric'
}).format(new Date(1456859319008)), '2:08 PM', 'missing leading 0 on minutes');
assert(new IntlPolyfill.DateTimeFormat('en-GB', {
  hour: '2-digit',
  hour12: false,
  minute: 'numeric'
}).format(new Date(1983, 9, 13)), '00:00', 'GB should use 2-digits for hours and minutes without hour12');

// issue #179
assert(new IntlPolyfill.DateTimeFormat('en', {
    month:'long',
    year: 'numeric'
}).format(new Date('2016/01/16')), 'January 2016', 'month should be long');
