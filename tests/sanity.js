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

function newDateUTC() {
  var date = new Date(...arguments)
  var localTime = date.getTime();
  var localOffset = date.getTimezoneOffset() * 60000;
  var utc = localTime + localOffset;
  return new Date(utc);
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
}).format(newDateUTC('Tue Mar 01 2016 14:08:39 GMT-0500 (EST)')), '7:08 PM', 'missing leading 0 on minutes');

// Issue #173
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

// Issues #190, #192
assert(new IntlPolyfill.DateTimeFormat('en-us', {
    month:'long',
}).format(new Date(2016, 0, 1)), 'January', 'month should be long');

// issue #196
(new Array(32768 + 1)).join('a').match(/^a*$/);
assert(new IntlPolyfill.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
}).format(0.015), "0,02", 'RegExp too big warning');
'a'.match(/a/);
