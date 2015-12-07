/* jslint esnext: true */

// Match these datetime components in a CLDR pattern, except those in single quotes
var expDTComponents = /(?:[Eec]{1,6}|G{1,5}|[Qq]{1,5}|(?:[yYur]+|U{1,5})|[ML]{1,5}|d{1,2}|D{1,3}|F{1}|[abB]{1,5}|[hkHK]{1,2}|w{1,2}|W{1}|m{1,2}|s{1,2}|[zZOvVxX]{1,4})(?=([^']*'[^']*')*[^']*$)/g;
// trim patterns after transformations
var expPatternTrimmer = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;
// Skip over patterns with these datetime components because we don't have data
// to back them up:
// timezone, weekday, amoung others
var unwantedDTCs = /[rqQxXVOvZASjJgwWIQq]/;

var dtKeys = ["weekday", "era", "year", "month", "day", "weekday", "quarter"];
var tmKeys = ["hour", "minute", "second", "hour12", "timeZoneName"];

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

function joinDateAndTimeFormats(dateFormatObj, timeFormatObj) {
    var o = {};
    for (var i = 0; i < dtKeys.length; i += 1) {
        if (dateFormatObj[dtKeys[i]]) {
            o[dtKeys[i]] = dateFormatObj[dtKeys[i]];
        }
    }
    for (var j = 0; j < tmKeys.length; j += 1) {
        if (timeFormatObj[tmKeys[j]]) {
            o[tmKeys[j]] = timeFormatObj[tmKeys[j]];
        }
    }
    return o;
}

function computeFinalPatterns(formatObj) {
    // From http://www.unicode.org/reports/tr35/tr35-dates.html#Date_Format_Patterns:
    //  'In patterns, two single quotes represents a literal single quote, either
    //   inside or outside single quotes. Text within single quotes is not
    //   interpreted in any way (except for two adjacent single quotes).'
    formatObj.pattern12 = formatObj.extendedPattern.replace(/'([^']*)'/g, function ($0, literal) {
        return literal ? literal : "'";
    });

    // pattern 12 is always the default. we can produce the 24 by removing {ampm}
    formatObj.pattern = formatObj.pattern12.replace('{ampm}', '').replace(expPatternTrimmer, '');
    return formatObj;
}

/**
 * Converts the CLDR availableFormats into the objects and patterns required by
 * the ECMAScript Internationalization API specification.
 */
export function createDateTimeFormat(skeleton, pattern) {
    // we ignore certain patterns that are unsupported to avoid this expensive op.
    if (unwantedDTCs.test(pattern))
        return undefined;

    var formatObj = {
        originalPattern: pattern
    };

    // Replace the pattern string with the one required by the specification, whilst
    // at the same time evaluating it for the subsets and formats
    formatObj.extendedPattern = pattern.replace(expDTComponents, function ($0) {
        // See which symbol we're dealing with
        switch ($0.charAt(0)) {

            // --- Era
            case 'G':
                return '{era}';

            // --- Year
            case 'y':
            case 'Y':
            case 'u':
            case 'U':
            case 'r':
                return '{year}';

            // --- Quarter (not supported in this polyfill)
            case 'Q':
            case 'q':
                return '{quarter}';

            // --- Month
            case 'M':
            case 'L':
                return '{month}';

            // --- Week (not supported in this polyfill)
            case 'w':
            case 'W':
                return '{weekday}';

            // --- Day
            case 'd':
            case 'D':
            case 'F':
            case 'g':
                return '{day}';

            // --- Week Day
            case 'E':
            case 'e':
            case 'c':
                return '{weekday}';

            // --- Period
            case 'a':
            case 'b':
            case 'B':
                return '{ampm}';

            // --- Hour
            case 'h':
            case 'H':
            case 'k':
            case 'K':
                return '{hour}';

            // --- Minute
            case 'm':
                return '{minute}';

            // --- Second
            case 's':
            case 'S':
            case 'A':
                return '{second}';

            // --- Timezone
            case 'z':
            case 'Z':
            case 'O':
            case 'v':
            case 'V':
            case 'X':
            case 'x':
                return '{timeZoneName}';

        }
    });

    // Match the skeleton string with the one required by the specification
    // this implementation is based on the Date Field Symbol Table:
    // http://unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table
    // Note: we are adding extra data to the formatObject even though this polyfill
    //       might not support it.
    skeleton.replace(expDTComponents, function ($0) {
        // See which symbol we're dealing with
        switch ($0.charAt(0)) {

            // --- Era
            case 'G':
                formatObj.era = [ 'short', 'short', 'short', 'long', 'narrow' ][$0.length-1];
                break;

            // --- Year
            case 'y':
            case 'Y':
            case 'u':
            case 'U':
                formatObj.year = $0.length === 2 ? '2-digit' : 'numeric';
                break;
            // case 'r':
                // r: 1..n - For the Gregorian calendar, the 'r' year is the same as the 'u' year.
                // break;

            // --- Quarter (not supported in this polyfill)
            case 'Q':
            case 'q':
                formatObj.quarter = [ 'numeric', '2-digit', 'short', 'long', 'narrow' ][$0.length-1];
                break;

            // --- Month
            case 'M':
            case 'L':
                formatObj.month = [ 'numeric', '2-digit', 'short', 'long', 'narrow' ][$0.length-1];
                break;

            // --- Week (not supported in this polyfill)
            case 'w':
                // week of the year
                formatObj.week = $0.length === 2 ? '2-digit' : 'numeric';
                break;
            case 'W':
                // week of the month
                formatObj.week = 'numeric';
                break;

            // --- Day
            case 'd':
                // day of the month
                formatObj.day = $0.length === 2 ? '2-digit' : 'numeric';
                break;
            case 'D':
                // day of the year
                formatObj.day = 'numeric';
                break;
            case 'F':
                // day of the week
                formatObj.day = 'numeric';
                break;
            // case 'g':
                // 1..n: Modified Julian day
                // break;

            // --- Week Day
            case 'E':
                // day of the week
                formatObj.weekday = [ 'short', 'short', 'short', 'long', 'narrow', 'short' ][$0.length-1];
                break;
            case 'e':
                // local day of the week
                formatObj.weekday = [ 'numeric', '2-digit', 'short', 'long', 'narrow', 'short' ][$0.length-1];
                break;
            case 'c':
                // stand alone local day of the week
                formatObj.weekday = [ 'numeric', undefined, 'short', 'long', 'narrow', 'short' ][$0.length-1];
                break;

            // --- Period
            case 'a': // AM, PM
            case 'b': // am, pm, noon, midnight
            case 'B': // flexible day periods
                formatObj.hour12 = true;
                break;

            // --- Hour
            case 'H':
            case 'k':
                formatObj.hour = $0.length === 2 ? '2-digit' : 'numeric';
                break;
            case 'h':
            case 'K':
                formatObj.hour12 = true; // 12-hour-cycle time formats (using h or K)
                formatObj.hour = $0.length === 2 ? '2-digit' : 'numeric';
                break;

            // --- Minute
            case 'm':
                formatObj.minute = $0.length === 2 ? '2-digit' : 'numeric';
                break;

            // --- Second
            case 's':
                formatObj.second = $0.length === 2 ? '2-digit' : 'numeric';
                break;
            // case 'S': // 1..n: factional seconds
            // case 'A': // 1..n: miliseconds in day

            // --- Timezone
            case 'z': // 1..3, 4: specific non-location format
            case 'Z': // 1..3, 4, 5: The ISO8601 varios formats
            case 'O': // 1, 4: miliseconds in day short, long
            case 'v': // 1, 4: generic non-location format
            case 'V': // 1, 2, 3, 4: time zone ID or city
            case 'X': // 1, 2, 3, 4: The ISO8601 varios formats
            case 'x': // 1, 2, 3, 4: The ISO8601 varios formats
                // this polyfill only supports much, for now, we are just doing something dummy
                formatObj.timeZoneName = $0.length < 4 ? 'short' : 'long';
                break;

        }
    });

    return computeFinalPatterns(formatObj);
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
    var result = [];
    var skeleton, pattern, computed, i, j;
    var timeRelatedFormats = [];
    var dateRelatedFormats = [];

    // Map available (custom) formats into a pattern for createDateTimeFormats
    for (skeleton in availableFormats) {
        if (availableFormats.hasOwnProperty(skeleton)) {
            pattern = availableFormats[skeleton];
            computed = createDateTimeFormat(skeleton, pattern);
            if (computed) {
                result.push(computed);
                // in some cases, the format is only displaying date specific props
                // or time specific props, in which case we need to also produce the
                // combined formats.
                if (isDateFormatOnly(computed)) {
                    dateRelatedFormats.push(computed);
                } else if (isTimeFormatOnly(computed)) {
                    timeRelatedFormats.push(computed);
                }
            }
        }
    }

    // Map time formats into a pattern for createDateTimeFormats
    for (skeleton in timeFormats) {
        if (timeFormats.hasOwnProperty(skeleton)) {
            pattern = timeFormats[skeleton];
            computed = createDateTimeFormat(skeleton, pattern);
            if (computed) {
                result.push(computed);
                timeRelatedFormats.push(computed);
            }
        }
    }

    // Map date formats into a pattern for createDateTimeFormats
    for (skeleton in dateFormats) {
        if (dateFormats.hasOwnProperty(skeleton)) {
            pattern = dateFormats[skeleton];
            computed = createDateTimeFormat(skeleton, pattern);
            if (computed) {
                result.push(computed);
                dateRelatedFormats.push(computed);
            }
        }
    }

    // combine custom time and custom date formats when they are orthogonals to complete the
    // formats supported by CLDR.
    // This Algo is based on section "Missing Skeleton Fields" from:
    // http://unicode.org/reports/tr35/tr35-dates.html#availableFormats_appendItems
    for (i = 0; i < timeRelatedFormats.length; i += 1) {
        for (j = 0; j < dateRelatedFormats.length; j += 1) {
            if (dateRelatedFormats[j].month === 'long') {
                pattern = dateRelatedFormats[j].weekday ? formats.full : formats.long;
            } else if (dateRelatedFormats[j].month === 'short') {
                pattern = formats.medium;
            } else {
                pattern = formats.short;
            }
            computed = joinDateAndTimeFormats(dateRelatedFormats[j], timeRelatedFormats[i]);
            computed.originalPattern = pattern;
            computed.extendedPattern = pattern
                .replace('{0}', timeRelatedFormats[i].extendedPattern)
                .replace('{1}', dateRelatedFormats[j].extendedPattern)
                .replace(/^[,\s]+|[,\s]+$/gi, '');
            result.push(computeFinalPatterns(computed));
        }
    }

    return result;
}
