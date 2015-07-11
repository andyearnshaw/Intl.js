# Intl.js [![Build Status][]](https://travis-ci.org/andyearnshaw/Intl.js)

In December 2012, ECMA International published the first edition of Standard ECMA-402,
better known as the _ECMAScript Internationalization API_. This specification provides
the framework to bring long overdue localization methods to ECMAScript implementations.

All modern browsers, except safari, have implemented his API. `Intl.js` fills the void of availability for this API. It will provide the framework as described by the specification, so that developers can take advantage of the native API
in environments that support it, or `Intl.js` for legacy or unsupported environments.

[Build Status]: https://travis-ci.org/andyearnshaw/Intl.js.svg?branch=master


## Getting started
For Node.js applications, you can install Intl.js using NPM:

    npm install intl

Intl.js is also available as a [Bower](http://bower.io) component for the front-end:

    bower install intl

For other setups, just clone the repo for the pre-built scripts and locale datafiles.

In browser environments, the library will try to patch the browser by defining
the global `Intl` is not defined.  An example of usage _might_ look like this:

```javascript
var nf = new Intl.NumberFormat(undefined, {style:'currency', currency:'GBP'});
document.getElementById('price').textContent = nf.format(100);
```

Ideally, you will avoid loading this library if the browser supports the
built-in `Intl`. An example of conditional usage using [browserify][] or [webpack][]
_might_ look like this:

```javascript
function runMyApp() {
  var nf = new Intl.NumberFormat(undefined, {style:'currency', currency:'GBP'});
  document.getElementById('price').textContent = nf.format(100);
}
if (!window.Intl) {
    require.ensure(['intl'], (require) => {
        window.Intl = require('intl');
        // locale data should be also included here...
        runMyApp()
    });
} else {
    runMyApp()
}
```

[webpack]: https://webpack.github.io/
[browserify]: http://browserify.org/

## Status
Current progress is as follows:

### Implemented
 - All internal methods except for some that are implementation dependent
 - Checking structural validity of language tags  
 - Canonicalizing the case and order of language subtags
 - __`Intl.NumberFormat`__
   - The `Intl.NumberFormat` constructor ([11.1](http://www.ecma-international.org/ecma-402/1.0/#sec-11.1))
   - Properties of the `Intl.NumberFormat` Constructor ([11.2](http://www.ecma-international.org/ecma-402/1.0/#sec-11.2))
   - Properties of the `Intl.NumberFormat` Prototype Object ([11.3](http://www.ecma-international.org/ecma-402/1.0/#sec-11.3))
   - Properties of Intl.NumberFormat Instances([11.4](http://www.ecma-international.org/ecma-402/1.0/#sec-11.4))
 - __`Intl.DateTimeFormat`__
   - The `Intl.DateTimeFormat` constructor ([12.1](http://www.ecma-international.org/ecma-402/1.0/#sec-12.1))
   - Properties of the `Intl.DateTimeFormat` Constructor ([12.2](http://www.ecma-international.org/ecma-402/1.0/#sec-12.2))
   - Properties of the `Intl.DateTimeFormat` Prototype Object ([12.3](http://www.ecma-international.org/ecma-402/1.0/#sec-12.3))
   - Properties of Intl.DateTimeFormat Instances([12.4](http://www.ecma-international.org/ecma-402/1.0/#sec-12.4))
 - Locale Sensitive Functions of the ECMAScript Language Specification
   - Properties of the `Number` Prototype Object ([13.2](http://www.ecma-international.org/ecma-402/1.0/#sec-13.2))
   - Properties of the `Date` prototype object ([13.3](http://www.ecma-international.org/ecma-402/1.0/#sec-13.3))

### Not Implemented
 - `BestFitSupportedLocales` internal function
 - Implementation-dependent numbering system mappings
 - Calendars other than Gregorian
 - Support for time zones
 - Collator objects (`Intl.Collator`) (see below)
 - Properties of the `String` prototype object

A few of the implemented functions may currently be non-conforming and/or incomplete.  
Most of those functions have comments marked as 'TODO' in the source code.

The test suite is run with Intl.Collator tests removed, and the Collator
constructor removed from most other tests in the suite.  Also some parts of
tests that cannot be passed by a JavaScript implementation have been disabled,
as well as a small part of the same tests that fail due to [this bug in v8][].

 [this bug in v8]: https://code.google.com/p/v8/issues/detail?id=2694


## What about Intl.Collator?

Providing an `Intl.Collator` implementation is no longer a goal of this project. There
are several reasons, including:

 - The CLDR convertor does not automatically convert collation data to JSON
 - The Unicode Collation Algorithm is more complicated that originally anticipated,
   and would increase the code size of Intl.js too much.
 - The Default Unicode Collation Element Table is huge, even after compression, and
   converting to a native JavaScript object would probably make it slightly larger.
   Server-side JavaScript environments will (hopefully) soon support Intl.Collator,
   and we can't really expect client environments to download this data.


## Compatibility
Intl.js is designed to be compatible with ECMAScript 3.1 environments in order to
follow the specification as closely as possible. However, some consideration is given
to legacy (ES3) environments, and the goal of this project is to at least provide a
working, albeit non-compliant implementation where ES5 methods are unavailable.

A subset of the tests in the test suite are run in IE 8.  Tests that are not passable
are skipped, but these tests are mostly about ensuring built-in function behavior.


## Locale Data
`Intl.js` uses the Unicode CLDR locale data, as recommended by the specification. The main `Intl.js` file contains no locale data itself. In browser environments, the
data should be provided, passed into a JavaScript object using the
`Intl.__addLocaleData()` method.  In Node.js, or when using `require('intl')`, the data
is automatically added to the runtime and does not need to be provided.

Contents of the `locale-data` directory are a modified form of the Unicode CLDR
data found at http://www.unicode.org/cldr/.


## Contribute

See the [CONTRIBUTING file][] for info.

[CONTRIBUTING file]: https://github.com/andyearnshaw/Intl.js/blob/master/CONTRIBUTING.md


## License

Copyright (c) 2013 Andy Earnshaw

This software is licensed under the MIT license.  See the `LICENSE.txt` file
accompanying this software for terms of use.
