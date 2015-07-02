/* jshint node:true */

/**
 * Compiles all JSON data into the polyfill and saves it as Intl.complete.js
 */

var assign = require('object.assign');
var path = require('path');

// Regex for converting locale JSON to object grammar, obviously simple and
// incomplete but should be good enough for the CLDR JSON
var jsonpExp = /"(?!default)([\w$][\w\d$]+)":/g;

var reduceLocaleData = require('./utils/reduce');

function mergeData(/*...sources*/) {
    var sources = [].slice.call(arguments);
    return sources.reduce(function (data, source) {
        Object.keys(source || {}).forEach(function (locale) {
            data[locale] = assign(data[locale] || {}, source[locale]);
        });

        return data;
    }, {});
}

module.exports = function(grunt) {

    grunt.registerTask('extract-cldr-data', 'Extract Numbers and Calendars Data from CLDR', function() {

        try {
            require('cldr-core/supplemental/parentLocales.json');
        } catch (e) {
            throw new Error('Error locating cldr data, make sure you execute `grunt update-cldr-data` before.');
        }

        var extractCalendars = require('./utils/extract-calendars');
        var extractNumbersFields = require('./utils/extract-numbers');
        // Default to all CLDR locales.
        var locales = require('./utils/locales').getAllLocales();

        // Each type of data has the structure: `{"<locale>": {"<key>": <value>}}`,
        // which is well suited for merging into a single object per locale. This
        // performs that deep merge and returns the aggregated result.
        var locData = mergeData(
            extractCalendars(locales),
            extractNumbersFields(locales)
        );

        Object.keys(locData).forEach(function (locale) {

            // Ignore en-US-POSIX and root
            if (locale.toLowerCase() === 'en-us-posix') {
                return;
            }

            var obj = reduceLocaleData(locale, locData[locale]);
            var jsonContent = JSON.stringify(obj, null, 4);
            var jsonpContent = 'IntlPolyfill.__addLocaleData(' + JSON.stringify(obj).replace(jsonpExp, '$1:') + ');';
            grunt.file.write('locale-data/json/' + locale + '.json', jsonContent);
            grunt.file.write('locale-data/jsonp/' + locale + '.js', jsonpContent);
        });

        grunt.log.writeln('Total number of locales is ' + Object.keys(locData).length);
    });

};
