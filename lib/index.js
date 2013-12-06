/**
This script is the main script when running in nodejs environment, and includes
the core features of the polyfill plus all available locales:

var Intl = require('Intl.js');
**/
var Intl = require('./polyfill'),
    fs = require('fs'),
    path = require('path'),
    folder = path.join(__dirname, '../locale-data/json/');

// attaching all available locales under locale-data
fs.readdirSync(folder).forEach(function (filename) {
    if (path.extname(filename) === '.json') {
        Intl.__addLocaleData(require(folder + filename));
    }
});

// exporting Intl with all locales available
module.exports = Intl;
