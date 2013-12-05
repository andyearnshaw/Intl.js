/*jshint boss:true, node:true, eqnull:true, laxbreak:true, newcap:false, shadow:true, funcscope:true*/
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
var http = require('http');

if (process.argv[2] == 'iana')
    getIANA();
else if (process.argv[2] == '4217')
    get4217();
else {
    process.stderr.write('Expected argument "iana" or "4217" not given.');
    process.exit(1);
}

// First the IANA mapping
function getIANA () {
    var
        httpOpts = {
            host: 'www.iana.org',
            path: '/assignments/language-subtag-registry/language-subtag-registry'
        },
        req = http.request(httpOpts, function (res) {
            var txt = '';

            res.on('error', function (err) {
                process.stderr.write(err);
                process.exit(1);
            });

            res.on('data', function (chunk) {
                txt += chunk;
            });

            res.on('end', function () { parseData(txt); });
        });

    req.end();

    function parseData(txt) {
        var arr  = txt.split('%%'),
            date = arr[0],
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
            return (obj.Type == "grandfathered" || obj.Type == "redundant") && obj.PreferredValue;
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
            return obj.Type == 'extlang' && obj.PreferredValue;
        }).reduce(function (tags, obj) {
            tags[obj.Subtag] = [ obj.PreferredValue, obj.Prefix ];
            return tags;
        }, {});

        process.stdout.write(JSON.stringify(res, null, 4).replace(/"(\w+)":/g, "$1:") + '\n');
    }
}

// Now the currency code minor units mapping
function get4217 () {
    var
        httpOpts = {
            host: 'www.currency-iso.org',
            path: '/dam/downloads/dl_iso_table_a1.xml'
        },

        evil= /<ALPHABETIC_CODE>([A-Z]{3})<[\s\S]+?<MINOR_UNIT>([^<]+)/gi,

        req = http.request(httpOpts, function (res) {
            var xml = '',
                obj = {};

            res.on('error', function (err) {
                process.stderr.write(err);
                process.exit(1);
            });

            res.on('data', function (chunk) {
                xml += chunk;
            });

            res.on('end', function () {
                while (evil.exec(xml))
                    // We already fallback to 2 as the number of digits
                    if (isFinite(RegExp.$2) && RegExp.$2 != '2')
                        obj[RegExp.$1] = +RegExp.$2;

                process.stdout.write(JSON.stringify(obj, null, 4).replace(/"(\w+)":/g, "$1:") + '\n');
            });
        });

    req.end();
}
