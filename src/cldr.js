/* jslint esnext: true */

// Match these datetime components in a CLDR pattern, except those in single quotes
var expDTComponents = /(?:[Eec]{1,6}|G{1,5}|(?:[yYu]+|U{1,5})|[ML]{1,5}|d{1,2}|a|[hkHK]{1,2}|m{1,2}|s{1,2}|z{1,4})(?=([^']*'[^']*')*[^']*$)/g;

// Skip over patterns with these datetime components
var unwantedDTCs = /[QxXVOvZASjgFDwWIQqH]/;

// Maps the number of characters in a CLDR pattern to the specification
var dtcLengthMap = {
        month:   [ 'numeric', '2-digit', 'short', 'long', 'narrow' ],
        weekday: [ 'short', 'short', 'short', 'long', 'narrow' ],
        era:     [ 'short', 'short', 'short', 'long', 'narrow' ]
    };

var dtKeys = ["weekday", "era", "year", "month", "day"];
var tmKeys = ["hour", "minute", "second", "timeZoneName"];

function isDateFormatOnly(obj) {
    for (var i = 0; i < tmKeys.length; i += 1) {
        if (obj.hasOwnProperty(tmKeys[i])) {
            return false;
        }
    }
    return true;
}

function isTimeFormatOnly(obj) {
    for (var i = 0; i < dtKeys.length; i += 1) {
        if (obj.hasOwnProperty(dtKeys[i])) {
            return false;
        }
    }
    return true;
}

/**
 * Converts the CLDR availableFormats into the objects and patterns required by
 * the ECMAScript Internationalization API specification.
 */
export function createDateTimeFormat(skeleton, format) {
    if (unwantedDTCs.test(format))
        return undefined;

    var parse = function (pattern) {
        var formatObj = {};
        // Replace the pattern string with the one required by the specification, whilst
        // at the same time evaluating it for the subsets and formats
        formatObj.pattern = pattern.replace(expDTComponents, function ($0) {
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
            formatObj.hour12 = true;
            formatObj.pattern12 = formatObj.pattern;
            formatObj.pattern = formatObj.pattern.replace('{ampm}', '').replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
        }

        return formatObj;
    };

    /**
     * CLDR data provides a skeleton string for matching format options
     * and a format string to define the final string.
     * Parse each into an object of format options plus a pattern string
     * suitable for simple token substitution.
     */
    return {
        match: parse(skeleton),
        format: parse(format)
    };
}

/**
 * Processes DateTime formats from CLDR to an easier-to-parse format.
 * the result of this operation should be cached the first time a particular
 * calendar is analyzed.
 *
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
 */
export function createDateTimeFormats(formats) {
    var availableFormats = formats.availableFormats;
    var timeFormats = formats.timeFormats;
    var dateFormats = formats.dateFormats;
    var order = formats.medium;
    var result = [];
    var key, format, computed, i, j, timeKey, dateKey;
    var timeRelatedFormats = [];
    var dateRelatedFormats = [];

    // Map available (custom) formats into a pattern for createDateTimeFormats
    for (key in availableFormats) {
        if (availableFormats.hasOwnProperty(key)) {
            format = availableFormats[key];
            computed = createDateTimeFormat(key, format);
            if (computed) {
                result.push(computed);
                // in some cases, the format is only displaying date specific props
                // or time specific props, in which case we need to also produce the
                // combined formats.
                if (isDateFormatOnly(computed.match)) {
                    dateRelatedFormats.push(key);
                } else if (isTimeFormatOnly(computed.match)) {
                    timeRelatedFormats.push(key);
                }
            }
        }
    }

    // combine custom time and custom date formats when they are orthogonals to complete the
    // formats supported by browsers by relying on the value of "formats.medium" which defines
    // how to join custom formats into a single pattern.
    for (i = 0; i < timeRelatedFormats.length; i += 1) {
        for (j = 0; j < dateRelatedFormats.length; j += 1) {
            timeKey = timeRelatedFormats[i];
            dateKey = dateRelatedFormats[j];
            format = order
                .replace('{0}', availableFormats[timeKey])
                .replace('{1}', availableFormats[dateKey])
                .replace(/^[,\s]+|[,\s]+$/gi, '');
            computed = createDateTimeFormat(timeKey + dateKey, format);
            if (computed) {
                result.push(computed);
            }
        }
    }

    // Map time formats into a pattern for createDateTimeFormats
    for (key in timeFormats) {
        if (timeFormats.hasOwnProperty(key)) {
            format = timeFormats[key];
            computed = createDateTimeFormat(format, format);
            if (computed) {
                result.push(computed);
            }
        }
    }

    // Map date formats into a pattern for createDateTimeFormats
    for (key in dateFormats) {
        if (dateFormats.hasOwnProperty(key)) {
            format = dateFormats[key];
            computed = createDateTimeFormat(format, format);
            if (computed) {
                result.push(computed);
            }
        }
    }

    return result;
}
