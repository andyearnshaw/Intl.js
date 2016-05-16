var IntlPolyfill = require('../');

function assert(value, expected) {
    if (value !== expected) {
        console.log('expected value ' + expected + ' but the actual value is ' + value);
        process.exit(1);
    }
}

assert(new IntlPolyfill.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
}).format(0.015), "0,02");

assert(new IntlPolyfill.NumberFormat('en-US', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
}).format(59.88), '£59.88');

assert(new IntlPolyfill.DateTimeFormat('en', {
    month:'numeric',
    day: 'numeric'
}).format(new Date('2016/05/16')), '5/16');
