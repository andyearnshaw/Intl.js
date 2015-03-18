Contributing Code to `Intl.js`
------------------------------

Dev mode installation
---------------------

To install the dependencies:

    npm install

To run the unit tests:

    npm test

To build files in `dist/` and `lib/`:

    grunt


Updating CLDR Data
------------------

_Note: this step is completely optional._

Copy fresh CLDR data in `data/`:

    grunt update-cldr-data

To build files in `locale-data/` based on CLDR `data/`:

    grunt cldr


Source Code
-----------

All the source code is in `src/` folder, written as ES6 modules, and transpiled
using `es6-module-transpiler` into the `lib/` and `dist/` folders.

The `dist/` is in git because of bower, make sure you commit those files as well.

Release checklist
-----------------

* build all files using `grunt`
* run all tests using `npm test`
* verify that [README.md] is updated
* bump the version in [package.json]
* commit to master
* push to npm using `npm publish`
* create a [new release] entry including the tag for the new version, being sure to document any deprecations

[README.md]: https://github.com/andyearnshaw/Intl.js/blob/master/README.md
[package.json]: https://github.com/andyearnshaw/Intl.js/blob/master/package.json
[new release]: https://github.com/andyearnshaw/Intl.js/releases/new
