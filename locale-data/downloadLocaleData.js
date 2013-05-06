/*jshint node:true, eqnull:true, laxbreak:true, newcap:false, shadow:true, funcscope:true*/
// Copyright 2013 Andy Earnshaw, MIT License

/**
 * Downloads the latest CLDR data in JSON format from the Unicode site.
 */

var 
    // Our wrapping function for JSONP
    jsonp = 'Intl.__addLocaleData',

    fs   = require('fs'),
    http = require('http'),
    util = require('util'),

    httpOpts = {
        host: 'www.unicode.org',
        path: '/repos/cldr-aux/json/22.1/main/'
    },

    links = [],
    html  = '',
    evil  = /<a href="(\w+\.json)"/gi,
    req   = http.request(httpOpts, function(res) {
        util.log('Downloading list of CLDR locales.');

        res.on('error', function (err) {
            util.error('Unable to download list ('+err+')');
            process.exit(1);
        });

        res.on('data', function (chunk) {
            html += chunk;
        });

        res.on('end', function () {
            while (evil.exec(html)) {
                links.push(RegExp.$1);
            }

            util.log('Parsed aforementioned list from the HTML (using a regex :evil laugh:).');

            downloadLocales();
        });
    });

req.end();

/**
 * Loops over the `links` array and fetches the individual locale data
 */
function downloadLocales() {
    links.forEach(function (lcl) {
        var opts = {
                host: httpOpts.host,
                path: httpOpts.path + lcl
            },
            json = '',
            req  = http.request(opts, function (res) {
                res.on('error', function (err) {
                    util.log('Unable to download '+lcl+' ('+err+')');
                });
                res.on('data', function (chunk) {
                    json += chunk;
                });
                res.on('end', function () {
                    saveJSON(lcl, json);
                });
            });

        req.end();
    });
}

/**
 * Saves the JSON data from a locale to the correct files (JSON + JSONP);
 */
function saveJSON(lcl, json) {
    var obj;
    lcl = lcl.replace(/_/g, '-');

    try {
        obj = JSON.parse(json);
    }
    catch (e) {
        util.error(lcl + '.json will not parse ('+e.message+')');
        return;
    }
    try {
        fs.writeFileSync('json/' + lcl, json);
        util.log('Saved '+lcl+' data in JSON format.');
    }
    catch (e) {
        util.error('Unable to save '+lcl+' data in JSON format ('+e.message+')');
    }

    try {
        fs.writeFileSync('jsonp/' + lcl.slice(0, -4) + 'js', jsonp + '(' + JSON.stringify(obj) + ')');
        util.log('Saved '+lcl+' data in JSONP format.');
    }
    catch (e) {
        util.error('Unable to save '+lcl+' data in JSONP format ('+e.message+')');
    }
}
