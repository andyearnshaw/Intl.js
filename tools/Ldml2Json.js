/*jshint laxbreak:true */
/**
 * Converts Unicode CLDR data to JSON format for use with Intl.js
 * Copyright 2013 Andy Earnshaw, MIT License
 *
 * Requires that CLDR core.zip and tools.zip are extracted to a common
 * directory and that path is passed as the first argument, e.g.
 *
 *      node Ldml2Json.js ~/unicode-cldr/
 */

var
    child,
    spawn = require('child_process').spawn,
    fs    = require('fs'),

    // The 'callback' function for the JSONP files
    jsonpFn = 'Intl.__addLocaleData',

    // Regex for converting locale JSON to object grammar, obviously simple and
    // incomplete but should be good enough for the CLDR JSON
    jsonpExp = /"(?!default)([\w$][\w\d$]+)":/g,

    // Path to CLDR root
    cldr = process.argv[2];

    // Paths to required classes in the CLDR /tools/java folder
    jPath = cldr + '/tools/java/',
    clsPaths = ['libs/icu4j.jar', 'libs/utilities.jar', 'libs/xercesImpl.jar', 'classes/'],

    // Ldml2JsonConverter class
    cls = 'org.unicode.cldr.json.Ldml2JsonConverter',

    // Ldml2JsonConverter config file (passed with arg -k)
    cfg = 'tools/Ldml2JsonConverter.config',

    out = 'cldr/';

// Initial output should hide cursor in Linux terminals
process.stdout.write('\x1b[?25l\rRunning JSON conversion...\n\n');

function cleanUp () {
    // Need to reshow the blinking cursor
    process.stdout.write('\n\x1b[?12l\x1b[?25h\r' + Array(15).join(' '));
}
process.on('exit', cleanUp);
process.on('SIGINT', cleanUp);

// Usage: Ldml2JsonConverter [OPTIONS] [FILES]
// This program converts CLDR data to the JSON format.
// Please refer to the following options.
//         example: org.unicode.cldr.json.Ldml2JsonConverter -c xxx -d yyy
// Here are the options:
// -h (help)       no-arg  Provide the list of possible options
// -c (commondir)  .*      Common directory for CLDR files, defaults to CldrUtility.COMMON_DIRECTORY
// -d (destdir)    .*      Destination directory for output files, defaults to CldrUtility.GEN_DIRECTORY
// -m (match)      .*      Regular expression to define only specific locales or files to be generated
// -t (type)       (main|supplemental)     Type of CLDR data being generated, main or supplemental.
// -r (resolved)   (true|false)    Whether the output JSON for the main directory should be based on resolved or unresolved data
// -s (draftstatus)        (approved|contributed|provisional|unconfirmed)  The minimum draft status of the output data
// -l (coverage)   (minimal|basic|moderate|modern|comprehensive|optional)  The maximum coverage level of the output data
// -n (fullnumbers)        (true|false)    Whether the output JSON should output data for all numbering systems, even those not used in the locale
// -o (other)      (true|false)    Whether to write out the 'other' section, which contains any unmatched paths
// -k (konfig)     .*      LDML to JSON configuration file
child = spawn('java', [ '-DCLDR_DIR='+cldr, '-cp', jPath + clsPaths.join(':'+jPath), cls, '-d', out, '-k', cfg/*, '-men.*'*/ ]);

child.stdout.on('data', function (data) {
    if (data.toString().indexOf('Processing') >= 0)
        process.stdout.write('\r\x1b[K\r\t' + String(data).split('\n')[0]);
});

var ldml2jsonErr = '';

child.stderr.on('data', function (data) {
    ldml2jsonErr += String(data);
});

child.on('exit', function (err) {
    if (err !== 0) {
        process.stderr.write(ldml2jsonErr);
        process.stderr.write('\nLdml2JsonConverter exited with error code ' +err);
    }
    else {
        console.log('\n\nProcessing JSON data...\n');
        var langData,
            locales = fs.readdirSync(out);

        locales.forEach(function (dir) {
            var json, obj;

            // The Ldml2JsonConverter tool creats directories even for locales that have
            // no data that we require
            try {
                json = fs.readFileSync(out + dir + '/data.json');
                obj  = JSON.parse(json).main[dir];
            }
            catch (e) {
                return;
            }

            // Need to copy in some language data that may not be present in territory data
            if (langData && (obj.identity.territory || obj.identity.script) && obj.identity.language === langData.identity.language)
                copyLocaleData(obj, langData);

            else if (!obj.identity.territory && !obj.identity.script && !obj.identity.variant)
                langData = obj;

            process.stdout.write('\r\x1b[K\r\tWriting locale-data/json/'+ dir +'.json');
            fs.writeFileSync('locale-data/json/'+ dir +'.json', JSON.stringify(obj, null, 4));

            var jsonp = jsonpFn
                          + '('
                          +     JSON.stringify(obj).replace(jsonpExp, '$1:')
                          + ')';

            process.stdout.write('\r\x1b[K\r\tWriting locale-data/jsonp/'+ dir +'.js');
            fs.writeFileSync('locale-data/jsonp/'+ dir +'.js', jsonp);
        });

        console.log('\n\nDone');
    }
});

/**
 * Copies missing locale data from object `from` to object `to`
 */
function copyLocaleData(to, from) {
    for (var k in from) {
        if (!to.hasOwnProperty(k))
            to[k] = from[k];

        else if (typeof from[k] === 'object')
            copyLocaleData(to[k], from[k]);
    }
}

