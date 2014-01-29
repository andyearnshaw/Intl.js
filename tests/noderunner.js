

var LIBS = {
        fs:     require('fs'),
        path:   require('path'),
        vm:     require('vm')
    },
    LIB_PATH = __dirname + '/../Intl.complete.js',
    INTL_LIB = LIBS.fs.readFileSync(LIB_PATH).toString(),
    TEST_DIR = __dirname + '/test262/pages';


// returns Error if test threw one
function runTest(testPath) {
    var content,
        context = LIBS.vm.createContext({});

    content = LIBS.fs.readFileSync(LIBS.path.resolve(TEST_DIR, testPath)).toString();
    LIBS.vm.runInContext(INTL_LIB, context, LIB_PATH);

    try {
        LIBS.vm.runInContext(content, context, testPath);
        return LIBS.vm.runInContext('runner()', context);
    } catch (err) {
        return err;
    }
}


function listTests() {
    var tests = [],
        todo = [ '.' ],
        doing,
        path;
    while (todo.length) {
        doing = todo.shift();
        path = LIBS.path.resolve(TEST_DIR, doing);
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
    var tests,
        passCount = 0,
        failCount = 0;
    tests = listTests();
    tests.sort();
    tests.forEach(function(testPath) {
        var name,
            err;
        name = LIBS.path.basename(testPath, LIBS.path.extname(testPath));
        err = runTest(testPath);

        if (err !== true) {
            console.log(name, '-- FAILED', err.message);
            failCount++;
        } else {
            console.log(name);
            passCount++;
        }
    });
    console.log('total ' + (tests.length) + ' -- passed ' + passCount + ' -- failed ' + failCount);
    process.exit(failCount ? 1 : 0);
}
main();



