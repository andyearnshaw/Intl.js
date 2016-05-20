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
