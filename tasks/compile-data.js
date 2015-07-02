/* jshint node:true */

/**
 * Compiles all JSON data into the polyfill and saves it as Intl.complete.js
 */
module.exports = function(grunt) {

    function replacer($0, type, loc) {
        return (type === 'prims' ? 'a' : 'b') + loc;
    }

    grunt.registerTask('compile-data', 'Compile the data into the polyfill', function() {
        var
            locData  = {},
            objStrs  = {},
            objs     = [],
            prims    = [],

            valCount = 0,
            objCount = 0,

            fileData = '',
            fs       = require('fs'),
            locales  = fs.readdirSync('locale-data/json/');

        fileData += '(function(addLocaleData){\n';

        locales.forEach(function (file) {
            var c = fs.readFileSync('locale-data/json/' + file),
                k = file.slice(0, file.indexOf('.'));
            locData[k] = JSON.parse(c, reviver);
        });
        function reviver (k, v) {
            var idx;

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
                var str = JSON.stringify(v);
                objCount++;

                if (objStrs.hasOwnProperty(str))
                    return objStrs[str];

                else {
                    // We need to make sure this object is not added to the same
                    // array as an object it references (and we need to check
                    // this recursively)
                    var
                        depth,
                        objDepths = [ 0 ];

                    for (var key in v) {
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
            }

            else
                return v;
        }

        fileData += 'var a='+ JSON.stringify(prims) +',b=[];';
        objs.forEach(function (val, idx) {
            var ref = JSON.stringify(val).replace(/"###(objs|prims)(\[[^#]+)###"/g, replacer);

            fileData += 'b['+ idx +']='+ ref +';';
        });

        for (var k in locData) {
            fileData += 'addLocaleData('+ locData[k].replace(/###(objs|prims)(\[[^#]+)###/, replacer) +');\n';
        }

        fileData += '})(IntlPolyfill.__addLocaleData);';

        // writting the complete optimized bundle
        grunt.file.write('locale-data/complete.js', fileData);

        grunt.log.writeln('Total number of reused strings is ' + prims.length + ' (reduced from ' + valCount + ')');
        grunt.log.writeln('Total number of reused objects is ' + Object.keys(objStrs).length + ' (reduced from ' + objCount + ')');
    });

};
