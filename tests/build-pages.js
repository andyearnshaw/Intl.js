

var LIBS = {
        fs:     require('fs'),
        path:   require('path')
    },
    SRC_DIR     = __dirname + '/test262/test/suite/intl402',
    DEST_DIR    = __dirname + '/test262/pages',
    INCLUDE_DIR = __dirname + '/test262/test/harness',
    LIB_PATH    = __dirname + '/../Intl.complete.js',
    INTL_LIB    = LIBS.fs.readFileSync(LIB_PATH).toString(),

    // stuff defined in harness/*.js yet not pulled in via $INCLUDE()
    HACKNESS = [
        'var __globalObject = Function("return this;")();',
        'function fnGlobalObject() {',
        '    return __globalObject;',
        '}',

        // Let the file be executed in Node.js
        'if (typeof IntlPolyfill == "undefined" && __dirname)',
        '    IntlPolyfill  = require("../../../../../Intl.complete.js");'
    ].join('\n');

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
        '//<html><body><script src="../../../../../Intl.complete.js"></script><script>',
        HACKNESS,
        content,
        '//</script></body></html>'
    ].join('\n');
}


function listTests() {
    var tests = [],
        todo = [ '.' ],
        doing,
        path;
    while (todo.length) {
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


