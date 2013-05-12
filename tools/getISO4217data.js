/*jshint node:true, eqnull:true, laxbreak:true, newcap:false, shadow:true, funcscope:true*/
// Copyright 2013 Andy Earnshaw, MIT License

/**
 * Downloads the current currency & funds code list, Table A.1 of ISO 4217
 * and parses the code and minor unit value into a JSON object.
 *
 * The result is output to stdOut, which makes it useful for easily inserting
 * into a file using Vim or emacs, or stdOut can be redirected to a file path instead.
 *
 * http://www.currency-iso.org/dam/downloads/dl_iso_table_a1.xml
 */
var
    http = require('http'),

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
            while (evil.exec(xml) && isFinite(RegExp.$2))
                obj[RegExp.$1] = +RegExp.$2;

            process.stdout.write(JSON.stringify(obj, null, 4) + '\n');
        });
    });

req.end();
