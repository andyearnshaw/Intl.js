__Polite Notice:__ this implementation is not yet ready for production environments.
See [Status](#status) for more info.

In December 2012, ECMA International published the first edition of Standard ECMA-402,
better known as the _ECMAScript Internationalization API_. This specification provides
the framework to bring long overdue localisation methods to ECMAScript implementations.

Google have an implementation of this API that is available in recent versions of V8
and Chrome/Chromium 24 and later. Mozilla also have a working implementation in the
current Firefox nightly builds.

`Intl.js` attempts to fill the void of availability for this API. It will provide the
framework as described by the specification, so that developers can take advantage of
the native API in environments that support it, or `Intl.js` for legacy or unsupporting
environments.

## <a id=status></a>Status
`Intl.js` isn't yet ready for production environments. Current progress is as follows:

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
 - Canonicalizing language tags containing subtags that have a "Preferred-value" from 
   the IANA Language Subtag registry
 - `BestFitSupportedLocales` internal function
 - Implementation-dependent numbering system mappings
 - Collator objects (`Intl.Collator`)
 - Properties of the `String` prototype object
 - Test suites

None of the implementation has been tested for compliance as of yet, and a few of the
implemented functions may currently be non-conforming and/or incomplete.  Those functions
have comments marked as 'TODO' in the source code.
[test402](http://test262.ecmascript.org/testcases_intl402.html) integration is planned.

## Compatibility
Intl.js is designed to be compatible with ECMAScript 3.1 environments in order to
follow the specification as closely as possible. However, some consideration is given
to legacy (ES3) environments, and the goal of this project is to at least provide a
working, albeit non-compliant implementation where ES5 methods are unavailable.

## Locale Data
The main `Intl.js` file contains no locale data itself.  Instead, the data should be
provided, parsed into a JavaScript object, using the `Intl.__addLocaleData()` method.

`Intl.js` uses the Unicode CLDR locale data, as recommended by the specification.
Some of the data from CLDR version 22.1 is currently available in JSON and JSONP
formats in the `locale-data` folder of this repository.

Work is in progress to convert the 23.1 data to JSON format.  The tools folder contains
a Node.js script that automates the process to extract only the data needed by Intl.js.
However, the script doesn't support converting the collation data to JSON (yet), and
some of the localisation data in the version 22.1 files appears to be missing from the
23.1 data.
