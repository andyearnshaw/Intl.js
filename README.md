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
`Intl.js` isn't yet ready for production environments. test402 has been integrated into
the project and tells us there's still a lot of work to be done.  The latest test, run on
May 27 2013, scored 90 out of 153<sup>*</sup>.

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
 - Canonicalizing language tags containing subtags that have a "Preferred-value" from 
   the IANA Language Subtag registry
 - `BestFitSupportedLocales` internal function
 - Implementation-dependent numbering system mappings
 - Collator objects (`Intl.Collator`)
 - Properties of the `String` prototype object
 - Test suites

A few of the implemented functions may currently be non-conforming and/or incomplete.  
Most of those functions have comments marked as 'TODO' in the source code.

<sup>*</sup> some of the tests cannot be passed from an ES5 implementation because they
check for native behaviour.  The majority of them should be passable, though.

## Compatibility
Intl.js is designed to be compatible with ECMAScript 3.1 environments in order to
follow the specification as closely as possible. However, some consideration is given
to legacy (ES3) environments, and the goal of this project is to at least provide a
working, albeit non-compliant implementation where ES5 methods are unavailable.

## Locale Data
The main `Intl.js` file contains no locale data itself.  Instead, the data should be
provided, parsed into a JavaScript object, using the `Intl.__addLocaleData()` method.

`Intl.js` uses the Unicode CLDR locale data, as recommended by the specification.
The data is available in JSON format, or JSONP format in the [locale-data](https://github.com/andyearnshaw/Intl.js/tree/master/locale-data)
folder.  This has been converted from CLDR version 23.1 using the script and config file
in the [tools](https://github.com/andyearnshaw/Intl.js/tree/master/tools) folder.

Collation data isn't currently present since the `Intl.Collator` implementation isn't 
finished.
