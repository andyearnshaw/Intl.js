var LIBS = {
        fs:     require('fs'),
        path:   require('path')
    },
    SRC_DIR     = __dirname + '/test262/test/suite/intl402',
    DEST_DIR    = __dirname + '/test262/pages',
    INCLUDE_DIR = __dirname + '/test262/test/harness',
    LIB_PATH    = __dirname + '/../Intl.complete.js',
    INTL_LIB    = LIBS.fs.readFileSync(LIB_PATH).toString(),

    WRAPPER_START = [
        '//<html><head><meta http-equiv="X-UA-Compatible" content="IE=EDGE"><meta charset=utf-8></head><body><button onclick="runner()">Run</button> results: <span id="results">not yet run</span><script src="../../../../../Intl.complete.js"></script><script>',

        // stuff defined in harness/*.js yet not pulled in via $INCLUDE()
        'var __globalObject = Function("return this;")();',
        'function fnGlobalObject() {',
        '    return __globalObject;',
        '}',

        // Make sure polyfilled ECMA-262 functions are in place for the tests
        'IntlPolyfill.__applyLocaleSensitivePrototypes();',

        'function runTheTest() {'
    ].join('\n'),

    WRAPPER_END = [
        '}',

        // In the browser, a button will run the following function,
        // and we can also call it with the webdriver's execute() function
        'function runner() {',
        '    var passed = false;',
        '    if (typeof document !== "undefined") {',
        '        setTimeout(function () {',
        '            document.getElementById("results").innerHTML = (passed ? "passed" : "FAILED");',
        '        });',
        '    }',
        '    runTheTest();',
        '    passed = true;',
        '    return passed;',
        '}',
        '//</script></body></html>'
    ].join('\n'),

    // Shims for IE 8
    shims = {
        'Object.defineProperty': function (obj, name, desc) {
             if (desc.hasOwnProperty('value'))
                obj[name] = desc.value;
        },

        'Object.create': function (o) {
            function F() {}
            F.prototype = o;
            return new F();
        },
        'Object.getPrototypeOf': function (obj) { return obj.constructor.prototype; },
        'Object.isExtensible' : function () { return true; },
        'Object.getOwnPropertyNames': function (obj) {
            var ret = [];

            for (var k in obj) {
                if (obj.hasOwnProperty(k))
                    ret.push(k);
            }

            return ret;
        },

        'Array.prototype.indexOf': function (search) {
            var t = this;
            if (!t.length)
                return -1;

            for (var i = arguments[1] || 0, max = t.length; i < max; i++) {
                if (t[i] === search)
                    return i;
            }

            return -1;
        },

        'Array.prototype.forEach': function (fn) {
            for (var i=0; i < this.length; i++)
                fn.call(arguments[1], this[i], i, this);
        },

        'Array.prototype.map': function (fn) {
            var ret = [];
            for (var i=0; i < this.length; i++)
                ret[i] = fn.call(arguments[1], this[i], i, this);

            return ret;
        },

        'Date.now': function () { return +new Date(); },

        //- IE 8 is forced into quirks mode, so no JSON
        '__globalObject.JSON': '{}',
        'JSON.stringify': function (obj) {
            var props = [];

            for (var k in obj) {
                if (obj.hasOwnProperty(k))
                    props.push(k + ': ' + obj[k]);
            }

            return '{ ' + props.join(',') + ' }';
        }
    };

shims['Array.prototype.every'] = shims['Array.prototype.forEach'];

function mkdirp(dir) {
    var parts = dir.split(LIBS.path.sep),
        p,
        path;
    for (p = 1; p < parts.length; p++) {
        path = parts.slice(0, p+1).join(LIBS.path.sep);
        if (! LIBS.fs.existsSync(path)) {
            LIBS.fs.mkdirSync(path);
        }
    }
}


function processTest(content) {
    content = content.replace(/\$INCLUDE\("([^)]+)"\);/g, function(all, path) {
        path = LIBS.path.resolve(INCLUDE_DIR, path);
        return LIBS.fs.readFileSync(path).toString();
    });

    content = content.replace(/\$ERROR\(/g, 'throw new Error(');

    // The test suite tries to parse an ISO 8601 date, which fails in <=IE8
    content = content.replace(/Date\.parse\("1989-11-09T17:57:00Z"\)/g, '$& || Date.parse("1989/11/09 17:57:00 UTC")');

    // Another IE 8 issue: [undefined].hasOwnProperty(0) is false, so we need
    // to work around this in at least one test
    content = content.replace(/^(\s*)(var.*)\[value\](.*)$/m, '$1var arr = [];\n$1arr[0] = value;\n$1$2arr$3');

    // Look for functions that might require shims in ES3 browsers
    var shimCode = [];
    for (var k in shims) {
        if (content.search(new RegExp('\\b' + k.split('.').pop() + '\\b')) > -1) {
            if (k === 'Object.defineProperty') {
                shimCode.push('try { Object.defineProperty({}, "a", {}) } catch (e) { Object.defineProperty = ' + shims[k] +' }');
            }
            else
                shimCode.push(k + ' = ' + k + ' || ' + shims[k] + ';');
        }
    }

    content = shimCode.join('\n') + '\n' + content;

    // Make sure to use our version (not one the browser might have).
    content = content.replace(/\bIntl\b/g, 'IntlPolyfill');

    var explainV8OptOut = '// This test is disabled to avoid the v8 bug outlined at https://code.google.com/p/v8/issues/detail?id=2694';

    // Due to a bug in v8, we need to disable parts of the _L15 tests that
    // check the function property `length` is not writable
    content = content.replace(/^(\s*)(?=.*throw.*The length property.*function must not be writable)/gm, '$1' + explainV8OptOut + '\n$&//');

    // There's also part of the _L15 test that a JavaScript implementation
    // cannot possibly pass, so we need to disable these parts too
    var idxStart = content.search(/^(\s*)\/\/ The remaining sections have been moved to the end/m),
        idxEnd   = content.search(/^\s+\/\/ passed the complete test/m);

    if (idxStart > -1) {
        content = [
            content.slice(0, idxStart),
            '\n// Intl.js cannot pass the following sections of this test:\n',
            content.slice(idxStart + 1, idxEnd).replace(/^(?!$)/gm, '//$&'),
            idxEnd > -1 ? content.slice(idxEnd) : ''
        ].join('');
    }

    return content;
}


// Turns test into an HTML page.
function wrapTest(content) {
    // The weird "//" makes these html files also valid node.js scripts :)
    return [
        WRAPPER_START,
        content,
        WRAPPER_END
    ].join('\n');
}


function listTests() {
    var tests = [],
        todo = [ '.' ],
        doing,
        path;

    while (todo.length) {
        /*jshint loopfunc:true*/
        doing = todo.shift();
        path = LIBS.path.resolve(SRC_DIR, doing);
        stat = LIBS.fs.statSync(path);
        if (stat.isFile()) {
            tests.push(doing);
            continue;
        }
        if (stat.isDirectory()) {
            todo = todo.concat(LIBS.fs.readdirSync(path).map(function(a) {
                return LIBS.path.join(doing, a);
            }));
        }
    }
    return tests;
}


function main() {
    var tests = listTests();
    tests.sort();
    tests.forEach(function(testPath) {
        console.log(testPath);
        var srcPath  = LIBS.path.resolve(SRC_DIR, testPath),
            destPath = LIBS.path.resolve(DEST_DIR, testPath),
            content;
        content = LIBS.fs.readFileSync(srcPath).toString();
        content = processTest(content);
        content = wrapTest(content);
        destPath = destPath.replace(/\.js$/, '.html');
        mkdirp(LIBS.path.dirname(destPath));
        LIBS.fs.writeFileSync(destPath, content);
    });
}
main();


