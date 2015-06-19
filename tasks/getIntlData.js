/*jshint boss:true, node:true, eqnull:true, laxbreak:true, newcap:false, shadow:true, funcscope:true*/
/*eslint-env node*/
// Copyright 2013 Andy Earnshaw, MIT License

/**
 * Downloads and parses the IANA Language Subtag Registry into a JavaScript object that can
 * be used for mapping.
 *
 * http://www.iana.org/assignments/language-subtag-registry/language-subtag-registry
 *
 * Also downloads the current currency & funds code list, Table A.1 of ISO 4217
 * and parses the code and minor unit value into a JavaScript object.
 *
 * http://www.currency-iso.org/dam/downloads/dl_iso_table_a1.xml
 *
 * The script requires a single argument to be passed with either of these values:
 *
 *      iana: download, parse and output an object map for redundant tags and subtags
 *      4217: download, parse and output an object map for ISO 4217 minor currency units
 *
 * The result is output to stdOut, which makes it useful for easily inserting
 * into a file using Vim or emacs, or stdOut can be redirected to a file path instead.
 *
 */
'use strict';
var http = require('http');

module.exports = function (grunt) {
    grunt.registerTask('get-subtag-mappings', getIANA);
    grunt.registerTask('get-currency-units', get4217);

    // First the IANA mapping
    function getIANA () {
        var
            done = this.async(),
            url = 'http://www.iana.org/assignments/language-subtag-registry/language-subtag-registry';

        grunt.verbose.write('Fetching subtag registry data...');
        http.get(url, function (res) {
            var txt = '';

            if (res.statusCode !== 200) {
                grunt.verbose.error();
                grunt.fail.warn('Request failed with status code ' + res.statusCode);
                return done(false);
            }

            res.on('error', function (err) {
                grunt.verbose.error(err);
                done(false);
            });

            res.on('data', function (chunk) {
                txt += chunk;
            });

            res.on('end', function () {
                grunt.verbose.ok();
                parseData(txt);
                done(true);
            });
        });

        function parseData(txt) {
            var arr  = txt.split('%%'),
                reg  = /^([^:]+):\s+(.*)$/gm,
                res  = {};

            // Convert the strings to object maps
            arr = arr.map(function (str) {
                var obj = {},
                    field;

                while (field = reg.exec(str))
                    obj[field[1].match(/\w+/g).join('')] = field[2];

                return obj;
            });

            // RFC 5646 section 4.5, step 2:
            // 2.  Redundant or grandfathered tags are replaced by their 'Preferred-
            //     Value', if there is one.
            res.tags = arr.filter(function (obj) {
                return (obj.Type === "grandfathered" || obj.Type === "redundant") && obj.PreferredValue;
            }).reduce(function (tags, obj) {
                tags[obj.Tag] = obj.PreferredValue;
                return tags;
            }, {});

            // 3.  Subtags are replaced by their 'Preferred-Value', if there is one.
            //     For extlangs, the original primary language subtag is also
            //     replaced if there is a primary language subtag in the 'Preferred-
            //     Value'.
            res.subtags = arr.filter(function (obj) {
                return (/language|script|variant|region/).test(obj.Type) && obj.PreferredValue;
            }).reduce(function (tags, obj) {
                tags[obj.Subtag] = obj.PreferredValue;
                return tags;
            }, {});

            res.extLang = arr.filter(function (obj) {
                return obj.Type === 'extlang' && obj.PreferredValue;
            }).reduce(function (tags, obj) {
                tags[obj.Subtag] = [ obj.PreferredValue, obj.Prefix ];
                return tags;
            }, {});

            grunt.log.write(JSON.stringify(res, null, 4).replace(/"(\w+)":/g, "$1:") + '\n');
        }
    }

    // Now the currency code minor units mapping
    function get4217 () {
        var
            done = this.async(),
            url = 'http://www.currency-iso.org/dam/downloads/table_a1.xml',
            evil = /<Ccy>([A-Z]{3})<[\s\S]+?<CcyMnrUnts>([^<]+)/gi;

        grunt.verbose.write('Fetching currency data...');
        http.get(url, function (res) {
            var xml = '',
                obj = {};

            if (res.statusCode !== 200) {
                grunt.verbose.error();
                grunt.fail.warn('Request failed with status code ' + res.statusCode);
                return done(false);
            }

            res.on('error', function (err) {
                grunt.fail.warn(err);
                done(false);
            });

            res.on('data', function (chunk) {
                xml += chunk;
            });

            res.on('end', function () {
                var result;

                grunt.verbose.ok();
                while (evil.exec(xml)) {
                    // We already fallback to 2 as the number of digits
                    if (isFinite(RegExp.$2) && RegExp.$2 !== '2') {
                        obj[RegExp.$1] = +RegExp.$2;
                    }
                }

                result = JSON.stringify(obj, null, 4).replace(/"(\w+)":/g, "$1:").split('\n');
                grunt.log.write(
                    '{'
                  + result.slice(1, -1).reduce(function (o, v, i) {
                        return o + (i % 9 === 0 ? '\n    ' : ' ') + v.trim();
                    }, '')
                  + '\n}\n'
                );
            });
        });
    }
};
