var
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

/**
 * Processes an object from CLDR format to an easier-to-parse format
 */
module.exports = function processObj(locale, data) {
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
        defCa = data.calendars.gregorian,

        // Any of the time format strings can give us some additional information
        defaultTimeFormat = defCa.timeFormats[gopn(defCa.timeFormats)[0]],
        ampmTimeFormat    = defCa.dateTimeFormats.availableFormats.hms,

        // Result object to be returned
        ret = {
            // Identifying language tag for this data
            locale: locale,

            date: {
                // Get supported calendars (as extension keys)
                ca: gopn(data.calendars)
                        .map(function (cal) { return caMap[cal] || cal; })

                        // Move 'gregory' (the default) to the front, the rest is alphabetical
                        .sort(function (a, b) {
                            return -(a === 'gregory') + (b === 'gregory') || a.localeCompare(b);
                        }).filter(function (cal) {
                            return (cal.indexOf('-') < 0);
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
    if ((ptn = data.numbers['decimalFormats-numberSystem-' + defaultNu] || data.numbers['decimalFormats-numberSystem-latn']))
        ret.number.patterns.decimal = createNumberFormats(ptn.standard);

    if ((ptn = data.numbers['currencyFormats-numberSystem-' + defaultNu] || data.numbers['currencyFormats-numberSystem-latn']))
        ret.number.patterns.currency = createNumberFormats(ptn.standard);

    if ((ptn = data.numbers['percentFormats-numberSystem-' + defaultNu] || data.numbers['percentFormats-numberSystem-latn']))
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
    gopn(data.calendars).forEach(function (cal) {
        var frmt;
        var ca = caMap[cal] || cal;
        if (ret.date.ca.indexOf(ca) < 0) {
            // ignoring unknown calendars
            return;
        }
        var obj = ret.date.calendars[ca] = {};

        if ((frmt = data.calendars[cal].months) && (frmt = frmt.format)) {
            obj.months = {
                narrow: gopv(frmt.narrow),
                short:  gopv(frmt.abbreviated),
                long:   gopv(frmt.wide)
            };
        }
        if ((frmt = data.calendars[cal].days) && (frmt = frmt.format)) {
            obj.days = {
                narrow: gopv(frmt.short),
                short:  gopv(frmt.abbreviated),
                long:   gopv(frmt.wide)
            };
        }
        if ((frmt = data.calendars[cal].eras)) {
            obj.eras = {
                narrow: gopv(frmt.eraNarrow),
                short:  gopv(frmt.eraAbbr),
                long:   gopv(frmt.eraNames)
            };
        }
        if ((frmt = data.calendars[cal].dayPeriods) && (frmt = frmt.format)) {
            obj.dayPeriods = {
                am: (frmt.wide || frmt.abbreviated).am,
                pm: (frmt.wide || frmt.abbreviated).pm
            };
        }

        ret.date.formats = {
            medium: defCa.dateTimeFormats.medium,
            availableFormats: defCa.dateTimeFormats.availableFormats
        };
    });

    return ret;
};

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
