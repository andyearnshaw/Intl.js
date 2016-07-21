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

function newDateUTC(str) {
  var date = new Date(str);
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
    minimumFractionDigits: 2
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
}).format(new Date('2016/01/16')), 'January 2016', 'month and year should be long');

// issue #196
/a*$/.exec('b' + new Array(32768 + 1).join('a'));
var leftContext = RegExp.leftContext;
var input = RegExp.input;
var lastMatch = RegExp.lastMatch;
new IntlPolyfill.NumberFormat('de-DE');
assert(RegExp.leftContext, leftContext, 'RegExp.leftContext restored');
assert(RegExp.input, input, 'RegExp.input restored');
assert(RegExp.lastMatch, lastMatch, 'RegExp.lastMatch restored');
'a'.match(/a/);

// Issues #190, #192
assert(new IntlPolyfill.DateTimeFormat('en-us', {
    month: 'long'
}).format(new Date(2016, 0, 1)), 'January', 'single month should be long');

assert(new IntlPolyfill.DateTimeFormat('en-us', {
    day: '2-digit'
}).format(new Date(2016, 0, 1)), '01', 'single day should be 2-digit');

assert(new IntlPolyfill.DateTimeFormat('en-us', {
    year: '2-digit'
}).format(new Date(2016, 0, 1)), '16', 'single year should be 2-digit');

assert(new IntlPolyfill.DateTimeFormat('en-us', {
    weekday: 'short'
}).format(new Date(2016, 0, 1)), 'Fri', 'single weekday should be short');

assert(new IntlPolyfill.DateTimeFormat('en-us', {
    minute: '2-digit'
}).format(new Date(2016, 0, 1)), '00', 'single minute should be 2-digit');

assert(new IntlPolyfill.DateTimeFormat('en-us', {
    second: '2-digit'
}).format(new Date(2016, 0, 1)), '00', 'single second should be 2-digit');

// alternative, hour can't alway produce a single digit, because of ampm, but
// this case should be cover by CLDR availableFormats
assert(new IntlPolyfill.DateTimeFormat('en-us', {
    hour: 'numeric'
}).format(new Date(2016, 0, 1, 6)), '6 AM', 'single second should be 2-digit');

assert(new IntlPolyfill.DateTimeFormat('en-GB', {
    hour: 'numeric'
}).format(new Date(2016, 0, 1, 6)), '6', 'single second should be 2-digit');
