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

To build files in `locale-data/` based on CLDR:

    grunt cldr

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
