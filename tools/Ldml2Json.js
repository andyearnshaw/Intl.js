/*jshint laxbreak:true, shadow:true, boss:true, eqnull:true */
/**
 * Converts Unicode CLDR data to JSON format for use with Intl.js
 * Copyright 2013 Andy Earnshaw, MIT License
 *
 * Usage:
 *
 *      node Ldml2Json.js
 *      node Ldml2Json.js [PATH]
 *
 * When PATH is specified, it should point to a location containing the
 * extracted core.zip and tools.zip files from the Unicode CLDR
 */

var
    child,
    spawn = require('child_process').spawn,
    fs    = require('fs'),

    // The 'callback' function for the JSONP files
    jsonpFn = 'IntlPolyfill.__addLocaleData',

    // Regex for converting locale JSON to object grammar, obviously simple and
    // incomplete but should be good enough for the CLDR JSON
    jsonpExp = /"(?!default)([\w$][\w\d$]+)":/g,

    // Path to CLDR root
    cldr = process.argv[2],

    // Paths to required classes in the CLDR /tools/java folder
    jPath = cldr + '/tools/java/',
    clsPaths = ['libs/icu4j.jar', 'libs/utilities.jar', 'libs/xercesImpl.jar', 'classes/'],

    // Ldml2JsonConverter class
    cls = 'org.unicode.cldr.json.Ldml2JsonConverter',

    // Ldml2JsonConverter config file (passed with arg -k)
    cfg = 'tools/Ldml2JsonConverter.config',

    out = 'cldr/',

    // Match these datetime components in a CLDR pattern, except those in single quotes
    expDTComponents = /(?:[Eec]{1,6}|G{1,5}|(?:[yYu]+|U{1,5})|[ML]{1,5}|d{1,2}|a|[hkHK]{1,2}|m{1,2}|s{1,2}|z{1,4})(?=([^']*'[^']*')*[^']*$)/g,

    // Skip over patterns with these datetime components
    unwantedDTCs = /[QxXVOvZASjgFDwWIQqH]/,

    // Maps the number of characters in a CLDR pattern to the specification
    dtcLengthMap = {
        month:   [ 'numeric', '2-digit', 'short', 'long', 'narrow' ],
        weekday: [ 'short', 'short', 'short', 'long', 'narrow' ],
        era:     [ 'short', 'short', 'short', 'long', 'narrow' ]
    };

function cleanUp () {
    // Need to reshow the blinking cursor
    process.stdout.write('\n\x1b[?12l\x1b[?25h\r' + Array(15).join(' '));
}

process.on('exit', cleanUp);
process.on('SIGINT', cleanUp);
process.chdir(__dirname + '/../');
console.log('');

if (cldr) {
    if (!fs.existsSync(cldr) || !fs.existsSync(jPath)) {
        process.stderr.write('Error: unable to find CLDR core and tools data at '+ cldr);
        process.exit(1);
    }

    // Initial output should hide cursor in Linux terminals
    process.stdout.write('\x1b[?25l\rRunning Ldml2Json conversion...\n\n');

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
            process.exit(1);
        }
        else
            console.log('\n');

        cldrToIntl();
    });
}
else {
    cldrToIntl();
}

function cldrToIntl() {
    console.log('Processing JSON data...\n');
    var
        locales = fs.readdirSync(out),

                // root data is the parent for all locales
                root = JSON.parse(fs.readFileSync(out + 'root/data.json')).main.root,

                // ...and base language is the root for regional locales
                base;

    locales.forEach(function (dir) {
        var json, obj;

        // Ignore en-US-POSIX
        if (dir === 'en-US-POSIX')
            return;

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
        if (base && (obj.identity.territory || obj.identity.script) && obj.identity.language === base.identity.language)
            copyLocaleData(obj, base);

        else if (!obj.identity.territory && !obj.identity.script && !obj.identity.variant)
            base = obj;

        // Copy data from the root locale
        copyLocaleData(obj, root);

        // Process our object into a format that can easily be parsed by Intl.js
        obj = processObj(obj);

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

/**
 * Processes an object from CLDR format to an easier-to-parse format
 */
function processObj(data) {
    var
        // Sort property name arrays to keep order and minimalise unnecessary file diffs
        gopn = function (a) { return Object.getOwnPropertyNames(a).sort(); },

        test = RegExp.prototype.test,

        // Get own property values, useful for converting object map to array when we
        // don't care about the keys.  Relies on predictable property ordering in V8.
        gopv = function (o) {
            return o ? Object.getOwnPropertyNames(o).map(function (e) { return o[e]; }) : undefined;
        },

        // Copy numbering systems
        defaultNu   = data.numbers.defaultNumberingSystem,
        otherNu     = gopn(data.numbers.otherNumberingSystems).map(function(key) {
                        return data.numbers.otherNumberingSystems[key];
                    }).filter(function (key) {
                        return key !== defaultNu;
                    }),

        // Map calendar names to BCP 47 unicode extension 'ca' keys
        caMap = {
                  'gregorian':            'gregory',
                  'ethiopic-amete-alem':  'ethioaa',
                  'islamic-civil':        'islamicc'
              },

        // Default calendar is always gregorian, apparently
        defCa = data.dates.calendars.gregorian,

        // Any of the time format strings can give us some additional information
        defaultTimeFormat = defCa.timeFormats[gopn(defCa.timeFormats)[0]],
        ampmTimeFormat    = defCa.dateTimeFormats.availableFormats.hms,

        id = data.identity,

        // Result object to be returned
        ret = {
            // Identifying language tag for this data
            locale: id.language
                        + (id.script    ? '-' + id.script    : '')
                        + (id.territory ? '-' + id.territory : '')
                        + (id.variant   ? '-' + id.variant   : ''),

            date: {
                // Get supported calendars (as extension keys)
                ca: gopn(data.dates.calendars)
                        .map(function (cal) { return caMap[cal] || cal; })

                        // Move 'gregory' (the default) to the front, the rest is alphabetical
                        .sort(function (a, b) {
                            return -(a === 'gregory') + (b === 'gregory') || a.localeCompare(b);
                        }),

                // Boolean value indicating whether hours from 1 to 12 (true) or from 0 to
                // 11 (false) should be used. 'h' is 1 to 12, 'k' is 0 to 11.
                hourNo0: /h/i.test(ampmTimeFormat),

                // Locales defaulting to 24hr time have 'H' or 'k' in their
                // default time patterns
                hour12: !/H|k/.test(defaultTimeFormat),

                formats: [],
                calendars: {},
            },
            number: {
                // Numbering systems, with the default first
                nu: [ defaultNu ],

                // Formatting patterns
                patterns: {},

                // Symbols
                symbols: {},

                currencies: {}
            }
        };

    // Copy the numeric symbols for each numbering system
    gopn(data.numbers).filter(test.bind(/^symbols-/)).forEach(function (key) {
        var ptn,
            sym = data.numbers[key];

        // Currently, Intl 402 only uses these symbols for numbers
        ret.number.symbols[key.split('-').pop()] = {
            decimal: sym.decimal,
            group:   sym.group,
            nan:     sym.nan,
            percent: sym.percentSign,
            infinity:sym.infinity
        };
    });

    // Create number patterns from CLDR patterns
    if (ptn = data.numbers['decimalFormats-numberSystem-' + defaultNu] || data.numbers['decimalFormats-numberSystem-latn'])
        ret.number.patterns.decimal = createNumberFormats(ptn.standard);

    if (ptn = data.numbers['currencyFormats-numberSystem-' + defaultNu] || data.numbers['currencyFormats-numberSystem-latn'])
        ret.number.patterns.currency = createNumberFormats(ptn.standard);

    if (ptn = data.numbers['percentFormats-numberSystem-' + defaultNu] || data.numbers['percentFormats-numberSystem-latn'])
        ret.number.patterns.percent = createNumberFormats(ptn.standard);

    // Check the grouping sizes for locales that group irregularly
    var pGroupSize = ptn.standard.match(/#+0/)[0].length,
        groups = ptn.standard.split(',');

    // The pattern in en-US-POSIX doesn't specify group sizes, and the default
    // is 3 so we can leave those out
    if (ptn.standard.indexOf(',') > -1 && pGroupSize !== 3)
        ret.number.patterns.primaryGroupSize = pGroupSize;

    // Look for secondary group size in the pattern, e.g. '#,##,##0%'
    if (groups.length > 2)
        ret.number.patterns.secondaryGroupSize = groups[1].length;

    // Copy the currency symbols
    gopn(data.numbers.currencies).forEach(function (k) {
        if (k !== data.numbers.currencies[k].symbol)
            ret.number.currencies[k] = data.numbers.currencies[k].symbol;
    });


    // Copy the formatting information
    gopn(data.dates.calendars).forEach(function (cal) {
        var frmt,
            ca = caMap[cal] || cal,
            obj = ret.date.calendars[ca] = {};

        if ((frmt = data.dates.calendars[cal].months) && (frmt = frmt.format)) {
            obj.months = {
                narrow: gopv(frmt.narrow),
                short:  gopv(frmt.abbreviated),
                long:   gopv(frmt.wide)
            };
        }
        if ((frmt = data.dates.calendars[cal].days) && (frmt = frmt.format)) {
            obj.days = {
                narrow: gopv(frmt.short),
                short:  gopv(frmt.abbreviated),
                long:   gopv(frmt.wide)
            };
        }
        if (frmt = data.dates.calendars[cal].eras) {
            obj.eras = {
                narrow: gopv(frmt.eraNarrow),
                short:  gopv(frmt.eraAbbr),
                long:   gopv(frmt.eraNames)
            };
        }
        if ((frmt = data.dates.calendars[cal].dayPeriods) && (frmt = frmt.format)) {
            obj.dayPeriods = {
                am: (frmt.wide || frmt.abbreviated).am,
                pm: (frmt.wide || frmt.abbreviated).pm
            };
        }

        /**
         * The specification requires we support at least the following subsets of
         * date/time components:
         *
         *   - 'weekday', 'year', 'month', 'day', 'hour', 'minute', 'second'
         *   - 'weekday', 'year', 'month', 'day'
         *   - 'year', 'month', 'day'
         *   - 'year', 'month'
         *   - 'month', 'day'
         *   - 'hour', 'minute', 'second'
         *   - 'hour', 'minute'
         *
         * We need to cherry pick at least these subsets from the CLDR data and convert
         * them into the pattern objects used in the ECMA-402 API.
         *
         * The array below could be easily extended to include more formats
         */
        var formats = [
                // 'weekday', 'year', 'month', 'day', 'hour', 'minute', 'second'
                [ 'hms', 'yMMMMEEEEd' ],

                // 'weekday', 'year', 'month', 'day'
                [ '', 'yMMMMEEEEd' ],

                // 'year', 'month', 'day'
                [ '', 'yMMMMd'],
                [ '', 'yMd'],

                // 'year', 'month'
                [ '', 'yM' ],
                [ '', 'yMMMM' ],

                // 'month', 'day'
                [ '', 'MMMMd' ],
                [ '', 'Md' ],

                // 'hour', 'minute', 'second'
                [ 'hms', '' ],

                // 'hour', 'minute'
                [ 'hm', '' ]
            ],
            avail = defCa.dateTimeFormats.availableFormats,
            order = defCa.dateTimeFormats.medium,
            verify = function (frmt) {
                // Unicode LDML spec allows us to expand some pattern components to suit
                var dFrmt = frmt[1] && frmt[1].replace(/M{4,5}/, 'MMM').replace(/E{4,6}/, 'E');

                return (!frmt[0] || avail[frmt[0]]) && (!dFrmt || avail[dFrmt]);
            };

        // Make sure every local supports these minimum required formats
        if (!formats.every(verify))
            throw new Error(ret.locale + " doesn't support all date/time component subsets");

        // Map the formats into a pattern for createDateTimeFormats
        ret.date.formats = formats.map(function (frmt) {
            var M, E, dFrmt;

            // Expand component lengths if necessary, as allowed in the LDML spec
            if (frmt[1]) {
                // Get the lengths of 'M' and 'E' substrings in the date pattern
                // as arrays that can be joined to create a new substring
                M = new Array((frmt[1].match(/M/g)||[]).length + 1);
                E = new Array((frmt[1].match(/E/g)||[]).length + 1);

                dFrmt = avail[frmt[1].replace(/M{4,5}/, 'MMM').replace(/E{4,6}/, 'E')];

                if (M.length > 2)
                    dFrmt = dFrmt.replace(/(M|L)+/, M.join('$1'));

                if (E.length > 2)
                    dFrmt = dFrmt.replace(/([Eec])+/, E.join('$1'));
            }

            return createDateTimeFormat(
                order
                    .replace('{0}', avail[frmt[0]] || '')
                    .replace('{1}', dFrmt || '')
                    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '')
            );
        });
    });

    return ret;
}

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

/**
 * Converts the CLDR availableFormats into the objects and patterns required by
 * the ECMAScript Internationalization API specification.
 */
function createDateTimeFormat(format) {
    if (unwantedDTCs.test(format))
        return undefined;

    var formatObj = {};

    // Replace the pattern string with the one required by the specification, whilst
    // at the same time evaluating it for the subsets and formats
    formatObj.pattern = format.replace(expDTComponents, function ($0) {
        var subsetProp;

        // See which symbol we're dealing with
        switch ($0.charAt(0)) {
            case 'E':
            case 'e':
            case 'c':
                formatObj.weekday = dtcLengthMap.weekday[$0.length-1];
                return '{weekday}';

            // Not supported yet
            case 'G':
                formatObj.era = dtcLengthMap.era[$0.length-1];
                return '{era}';

            case 'y':
            case 'Y':
            case 'u':
            case 'U':
                formatObj.year = $0.length === 2 ? '2-digit' : 'numeric';
                return '{year}';

            case 'M':
            case 'L':
                formatObj.month = dtcLengthMap.month[$0.length-1];
                return '{month}';

            case 'd':
                formatObj.day = $0.length === 2 ? '2-digit' : 'numeric';
                return '{day}';

            case 'a':
                return '{ampm}';

            case 'h':
            case 'H':
            case 'k':
            case 'K':
                formatObj.hour = $0.length === 2 ? '2-digit' : 'numeric';
                return '{hour}';

            case 'm':
                formatObj.minute = $0.length === 2 ? '2-digit' : 'numeric';
                return '{minute}';

            case 's':
                formatObj.second = $0.length === 2 ? '2-digit' : 'numeric';
                return '{second}';

            case 'z':
                formatObj.timeZoneName = $0.length < 4 ? 'short' : 'long';
                return '{timeZoneName}';
        }
    });

    // From http://www.unicode.org/reports/tr35/tr35-dates.html#Date_Format_Patterns:
    //  'In patterns, two single quotes represents a literal single quote, either
    //   inside or outside single quotes. Text within single quotes is not
    //   interpreted in any way (except for two adjacent single quotes).'
    formatObj.pattern = formatObj.pattern.replace(/'([^']*)'/g, function ($0, literal) {
        return literal ? literal : "'";
    });

    if (formatObj.pattern.indexOf('{ampm}') > -1) {
        formatObj.pattern12 = formatObj.pattern;
        formatObj.pattern = formatObj.pattern.replace('{ampm}', '').trim();
    }

    return formatObj;
}

/**
 * Parses a CLDR number formatting string into the object specified in ECMA-402
 * Returns an object with positivePattern and negativePattern properties
 */
function createNumberFormats (ptn) {
    var patterns = ptn.split(';'),

        // Matches CLDR number patterns, e.g. #,##0.00, #,##,##0.00, #,##0.##, etc.
        numPtn = /#(?:[\.,]#+)*0(?:[,\.][0#]+)*/,
        ret = {
            positivePattern: patterns[0].replace(numPtn, '{number}').replace('¤', '{currency}')
        };

    // Negative patterns aren't always specified, in those cases use '-' + positivePattern
    ret.negativePattern = patterns[1]
                            ? patterns[1].replace(numPtn, '{number}').replace('¤', '{currency}')
                            : '-' + ret.positivePattern;

    return ret;
}
