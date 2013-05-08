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
 - Locale Sensitive Functions of the ECMAScript Language Specification
   - Properties of the `Number` Prototype Object ([13.2](http://www.ecma-international.org/ecma-402/1.0/#sec-13.2))

### Not Implemented
 - Canonicalizing language tags containing subtags that have a "Preferred-value" from 
   the IANA Language Subtag registry
 - `BestFitSupportedLocales` internal function
 - Implementation-dependent numbering system mappings
 - Collator objects (`Intl.Collator`)
 - DateTimeFormat objects (`Intl.DateTimeFormat`)
 - Properties of the `String` prototype object
 - Properties of the `Date` prototype object
 - Test suites

None of the implementation has been tested for compliance as of yet. 
[test402](http://test262.ecmascript.org/testcases_intl402.html) integration is planned.

## Compatibility
Intl.js is designed to be compatible with ECMAScript 3.1 environments in order to
follow the specification as closely as possible. However, some consideration is given
to legacy (ES3) environments, and the goal of this project is to at least provide a
a non-compliant, albeit working implementation where ES5 methods are unavailable.

## Locale Data
The main `Intl.js` file contains no locale data itself.  Instead, the data should be
provided, parsed into a JavaScript object, using the `Intl.__addLocaleData()` method.

`Intl.js` uses the Unicode CLDR locale data, as recommended by the specification.
Some of the data from CLDR version 22.1 is currently available in JSON and JSONP
formats in the `locale-data` folder of this repository.  The rest is available from
the main [CLDR repository](http://www.unicode.org/repos/cldr-aux/json/22.1/).

At the time of writing, it appears the version 23.1 locale is in the process of being
converted to JSON. Once this process is complete, the data will be made available from
this repository for convenience.
