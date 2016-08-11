/* global Promise */
import * as fs from 'fs';
import * as p from 'path';
import {sync as mkdirpSync} from 'mkdirp';

function writeFile(filename, contents) {
    return new Promise((resolve, reject) => {
        fs.writeFile(filename, contents, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(p.resolve(filename));
            }
        });
    });
}

function mergeData(...sources) {
    return sources.reduce((data, source) => {
        Object.keys(source || {}).forEach((locale) => {
            data[locale] = Object.assign(data[locale] || {}, source[locale]);
        });

        return data;
    }, {});
}

function reviver (k, v) {
    let idx;

    if (k === 'locale')
        return v;

    else if (typeof v === 'string') {
        idx = prims.indexOf(v);
        valCount++;

        if (idx === -1)
            idx += prims.push(v);

        return '###prims['+ idx +']###';
    }

    else if (typeof v === 'object' && v !== null) {
        const str = JSON.stringify(v);
        objCount++;

        if (objStrs.hasOwnProperty(str))
            return objStrs[str];

        // We need to make sure this object is not added to the same
        // array as an object it references (and we need to check
        // this recursively)
        let depth;
        let objDepths = [0];

        for (let key in v) {
            if (typeof v[key] === 'string' && (depth = v[key].match(/^###objs\[(\d+)/)))
                objDepths.push(+depth[1] + 1);
        }

        depth = Math.max.apply(Math, objDepths);

        if (!Array.isArray(objs[depth]))
            objs[depth] = [];

        idx = objs[depth].push(v) - 1;
        objStrs[str] = '###objs['+ depth +']['+ idx +']###';

        return objStrs[str];
    }

    return v;
}

// -----------------------------------------------------------------------------

mkdirpSync('locale-data/');
mkdirpSync('locale-data/json/');
mkdirpSync('locale-data/jsonp/');

// extracting data into CLDR

// Regex for converting locale JSON to object grammar, obviously simple and
// incomplete but should be good enough for the CLDR JSON
const jsonpExp = /"(?!default)([\w$][\w\d$]+)":/g;

import reduceLocaleData from './utils/reduce';

import extractCalendars from './utils/extract-calendars';
import extractNumbersFields from './utils/extract-numbers';
import {getAllLocales} from './utils/locales';

// Default to all CLDR locales.
const locales = getAllLocales();

// Each type of data has the structure: `{"<locale>": {"<key>": <value>}}`,
// which is well suited for merging into a single object per locale. This
// performs that deep merge and returns the aggregated result.
let locData = mergeData(
    extractCalendars(locales),
    extractNumbersFields(locales)
);

let locStringData = {};

Object.keys(locData).forEach((locale) => {
    // Ignore en-US-POSIX and root
    if (locale.toLowerCase() === 'en-us-posix') {
        return;
    }

    const obj = reduceLocaleData(locale, locData[locale]);
    locStringData[locale] = JSON.stringify(obj, null, 4);
    const jsonpContent =  `IntlPolyfill.__addLocaleData(${JSON.stringify(obj).replace(jsonpExp, '$1:')});`;
    writeFile('locale-data/json/' + locale + '.json', locStringData[locale]);
    writeFile('locale-data/jsonp/' + locale + '.js', jsonpContent);
});

console.log('Total number of locales is ' + Object.keys(locData).length);

// compiling `locale-date/complete.js`

function replacer($0, type, loc) {
    return (type === 'prims' ? 'a' : 'b') + loc;
}

let
    objStrs  = {},
    objs     = [],
    prims    = [],

    valCount = 0,
    objCount = 0,

    fileData = '',

    locReducedData = {},
    locNames = Object.keys(locStringData);

const
    defaultLocale = 'en',
    defaultLocaleIndex = locNames.indexOf(defaultLocale);

if (defaultLocaleIndex !== -1) {
  // Move the default locale to the beginning
  locNames.splice(defaultLocaleIndex, 1);
  locNames.unshift(defaultLocale);
}

locNames.forEach((k) => {
    const c = locStringData[k];
    locReducedData[k] = JSON.parse(c, reviver);
});

fileData += '(function(addLocaleData){\n';
fileData += `var a=${JSON.stringify(prims)},b=[];`;
objs.forEach((val, idx) => {
    const ref = JSON.stringify(val).replace(/"###(objs|prims)(\[[^#]+)###"/g, replacer);

    fileData += `b[${idx}]=${ref};`;
});

locNames.forEach((k) => {
    fileData += `addLocaleData(${locReducedData[k].replace(/###(objs|prims)(\[[^#]+)###/, replacer)});
`;
});

fileData += `})(IntlPolyfill.__addLocaleData);`;

// writting the complete optimized bundle
writeFile('locale-data/complete.js', fileData);

console.log('Total number of reused strings is ' + prims.length + ' (reduced from ' + valCount + ')');
console.log('Total number of reused objects is ' + Object.keys(objStrs).length + ' (reduced from ' + objCount + ')');

process.on('unhandledRejection', (reason) => {throw reason;});
console.log('Writing locale data files...');
