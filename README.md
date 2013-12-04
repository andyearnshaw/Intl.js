__Polite notice:__ `Intl.js` may not be ready for production environments yet.  See the
[status section](#Status) for more information.

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
The latest test, run on Jun 04 2013, scored 99 out of 111 in SpiderMonkey<sup>\*</sup>.
Although the majority of the failed tests are somewhat superficial, there are a few
outstanding issues with `DateTimeFormat`.

Aside from 1 issue with floating point precision in Firefox/SpiderMonkey, `NumberFormat`
seems to be rather complete.

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
 - Collator objects (`Intl.Collator`) (see below)
 - Properties of the `String` prototype object

A few of the implemented functions may currently be non-conforming and/or incomplete.  
Most of those functions have comments marked as 'TODO' in the source code.

<sup>\*</sup> The test suite is run with Intl.Collator tests removed, and the Collator
constructor removed from most other tests in the suite.  Also, some of the tests cannot be
passed from an ES5 implementation because they check for native behaviour.

## What about Intl.Collator?

Providing an `Intl.Collator` implementation is no longer a goal of this project. There
are several reasons, including:

 - The CLDR convertor does not automatically convert collation data to JSON
 - The Unicode Collation Algorithm is more complicated that originally anticipated,
   and would increase the code size of Intl.js too much.
 - The Default Unicode Collation Element Table is huge, even after compression, and 
   converting to a native JavaScript object would probably make it slightly larger.
   Server-side JavaScript environments will soon already support Intl.Collator,
   and we can't really expect client environments to download this data.

There are some local environments where it might be useful, such as a Smart TV platform,
desktop widget or something, but `String.prototype.localeCompare` is probably good enough
in those platforms and the gain from an implementation just wouldn't be worth it.

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

Contents of the `locale-data` directory are a modified form of the Unicode CLDR
data found at http://www.unicode.org/cldr/data/.  See the `LICENSE.txt` file
accompanying this software for terms of use.


### Rebuilding

* Visit http://cldr.unicode.org/index/downloads and choose a version, for example http://unicode.org/Public/cldr/23.1/.
* Download `core.zip` and `tools.zip` to a folder/directory.
* Unzip the zip files.
    * (On a mac be sure the use the commandline `unzip` utility, as the Finder will do the wrong thing.)
* Run `node tools/Ldml2Json.js <folder>` where `<folder>` is the location where you downloaded and unzipped the zip files.
* TOOD... next steps...


## License

Copyright (c) 2013 Andy Earnshaw

This software is licensed under the MIT license.  See the `LICENSE.txt` file
accompanying this software for terms of use.


