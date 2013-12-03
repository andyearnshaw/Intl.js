/**
This script is useful for the case where you want to load the core features
without the locale data:

var Intl = require('Intl.js/lib/polyfill');
Intl.__addLocaleData(require('Intl.js/locale-data/json/de-AT.json'));
**/

module.exports = require('../Intl.js');
