

var LIBS = {
        async:  require('async'),
        child:  require('child_process'),
        fs:     require('fs'),
        path:   require('path'),
        util:   require('util'),
        wd:     require('wd')
    },
    TEST_DIR = LIBS.path.resolve(__dirname, 'test262', 'pages'),
    BROWSER_CONCURRENCY = 3,
    BROWSERS = [
        // hand-chosen from https://saucelabs.com/platforms
        {
            browserName: "android",
            version: "4.0",
            platform: "Linux",
            "device-orientation": "portrait",
            "idle-timeout": 120 // this browser is stalling somewhere/somehow
        },
// This browser/driver will stop reporting tests results after a few tests.
// This causes the saucelabs session to timeout and our travis job gets reaped.
//      {
//          browserName: "iphone",
//          version: "7",
//          platform: "OS X 10.9",
//          "device-orientation": "portrait",
//          "idle-timeout": 120 // this browser is stalling somewhere/somehow
//      },
        {
            browserName: "firefox",
            version: "26",
            platform: "Windows 8.1"
        },
        {
            browserName: "chrome",
            version: "31",
            platform: "OS X 10.9"
        },
        {
            browserName: "internet explorer",
            version: "11",
            platform: "Windows 8.1"
        },
        {
            browserName: "internet explorer",
            version: "10",
            platform: "Windows 8"
        },
        {
            browserName: "safari",
            version: "7",
            platform: "OS X 10.9"
        },
    ];


function listTests() {
    var tests = [],
        todo = ['.'],
        doing,
        path,
        stat;
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


function runCommand(command, done) {
    console.log('--COMMAND--', command.join(' '));
    var cmd = command.shift(),
        stdout = '',
        stderr = '',
        err,
        pid;
    pid = LIBS.child.spawn(cmd, command, {
        cwd: process.cwd(),
        env: process.env
    });
    pid.stdout.on('data', function(data) {
        stdout += data;
    });
    pid.stderr.on('data', function(data) {
        stderr += data;
    });
    pid.on('exit', function(code) {
        // DEBUGGING
        console.log(stdout);
        console.log(stderr);
        done(err, code, stdout, stderr);
    });
    pid.on('error', function(err) {
        // DEBUGGING
        console.log(stdout);
        console.log(stderr);
        done(err, err.code, stdout, stderr);
    });
    pid.on('uncaughtException', function(err) {
        // DEBUGGING
        console.log(stdout);
        console.log(stderr);
        done(err, err.code || 1, stdout, stderr);
    });
}


function calculateGitDetails(state, done) {
    state.git = {};
//TODO -- trying to get fallback mechanism to work on saucelabs
//  if (process.env.TRAVIS) {
//      // travis makes this information easy to get
//      state.git.shasum = process.env.TRAVIS_COMMIT;
//      var parts = process.env.TRAVIS_REPO_SLUG.split('/');
//      state.git.user = parts[0];
//      state.git.repo = parts[1];
//      state.git.rawURL = 'https://rawgithub.com/' + state.git.user + '/' + state.git.repo + '/' + state.git.shasum + '/tests/test262/pages/';
//      done();
//      return;
//  }
    console.log('------------------------------------------------------------ DEBUGGING');
    console.log('cwd', process.cwd());
    console.log(LIBS.fs.readdirSync(process.cwd()));
    console.log('cwd/..', LIBS.path.resolve(process.cwd(), '..'));
    console.log(LIBS.fs.readdirSync(LIBS.path.resolve(process.cwd(), '..')));
    console.log('------------------------------------------------------------');

    LIBS.async.series([
        function(taskDone) {
            // DEBUGGING
            runCommand(['which', 'git'], function(err, code, stdout, stderr) {
                console.log(stdout);
                console.log(stderr);
                taskDone(err);
            });
        },
        function(taskDone) {
            runCommand(['git', 'rev-parse', 'HEAD'], function(err, code, stdout, stderr) {
                if (err) {
                    taskDone(err);
                    return;
                }
                state.git.shasum = stdout.trim();
                if (! state.git.shasum) {
                    taskDone(new Error("failed to find current commit"));
                    return;
                }
                taskDone();
            });
        },
        function(taskDone) {
            runCommand(['git', 'branch', '--all', '--contains', state.git.shasum], function(err, code, stdout, stderr) {
                var matches;
                if (err) {
                    taskDone(err);
                    return;
                }
                matches = stdout.match(/remotes\/([^\/]+)\/([^\/\n\s]+)$/m);
                if (matches) {
                    state.git.remote = matches[1];
                    state.git.branch = matches[2];
                    taskDone();
                    return;
                }
                taskDone(new Error('failed to find relevant remote for ' + state.git.shasum));
            });
        },
        function(taskDone) {
            runCommand(['git', 'config', '--get', ['remote', state.git.remote, 'url'].join('.')], function(err, code, stdout, stderr) {
                var matches;
                if (err) {
                    taskDone(err);
                    return;
                }
                matches = stdout.trim().match(/([^:\/]+)\/([^\/]+)\.git$/);
                if (matches) {
                    state.git.user = matches[1];
                    state.git.repo = matches[2];
                    state.git.rawURL = 'https://rawgithub.com/' + state.git.user + '/' + state.git.repo + '/' + state.git.shasum + '/tests/test262/pages/';
                    taskDone();
                    return;
                }
                taskDone(new Error('failed to find repository URL for remote ' + state.git.remote));
            });
        }
    ], function(err) {
        console.log(JSON.stringify(state.git, null, 4));
        done(err);
    });
}


function runTestsInBrowser(state, browserConfig, done) {
    var tasks = [],
        caps = {},
        browserString = LIBS.util.inspect(browserConfig, {depth: null}).replace(/\n\s*/g, ' '),
        browser,
        failures = 0;
    console.log('================================================ START', browserString);

    Object.keys(state.capabilities).forEach(function(key) {
        caps[key] = state.capabilities[key];
    });
    Object.keys(browserConfig).forEach(function(key) {
        caps[key] = browserConfig[key];
    });
    caps.name = [browserConfig.browserName, browserConfig.version, browserConfig.platform].join(' - ');

    // open browser
    tasks.push(function(taskDone) {
        var sauceConfig = {
                hostname: "ondemand.saucelabs.com",
                port: 80,
                user: state.sauce.username,
                pwd: state.sauce.access_key
            };
        if (process.env.TRAVIS) {
            // "sauce connect" travis addon
            // http://about.travis-ci.org/docs/user/gui-and-headless-browsers/#Using-Sauce-Labs
            sauceConfig.hostname = 'localhost';
            sauceConfig.port = 4445;
            sauceConfig['custom-data'] = {
                gituser:    state.git.user,
                gitrepo:    state.git.repo,
                commit:     state.git.shasum
            };
            sauceConfig['record-video'] = false;
        }
        browser = LIBS.wd.remote(sauceConfig);
        browser.init(caps, taskDone);
    });

    // for each page, get and test page
    state.tests.forEach(function(test) {
        tasks.push(function(taskDone) {
            var url = state.git.rawURL + test;
            console.log('--TESTING--', test, browserString);

            function saveResult(out, err) {
                var cookedErr = err;
                if (err) {
                    if (cookedErr.cause)   { cookedErr = cookedErr.cause; }
                    if (cookedErr.value)   { cookedErr = cookedErr.value; }
                    if (cookedErr.message) { cookedErr = cookedErr.message; }
                    cookedErr = cookedErr.toString().split('\n')[0];
                    cookedErr = cookedErr || out || 'FAILED no results';
                    console.log('--ERROR--', err);
                }
                if (out === 'passed') {
                    state.results.passCount++;
                    console.log('--PASSED--', test, browserString);
                } else {
                    failures++;
                    state.results.failCount++;
                    if (!state.results.failures[test]) {
                        state.results.failures[test] = {}
                    }
                    state.results.failures[test][browserString] = cookedErr;
                    console.log('--FAILED--', test, browserString, cookedErr);
                }
                // This sometimes signifies a suacelabs browser that has gone awawy.
                if ('ERROR Internal Server Error' === cookedErr) {
                    taskDone(err);
                } else {
                    taskDone();
                }
            }
            browser.get(url, function() {
                browser.elementById('results', function(err, el) {
                    if (err) {
                        saveResult(null, err);
                        return;
                    }
                    el.text(function(err, out) {
                        saveResult(out, err);
                    });
                });
            });
        });
    });

    // quit browser
    tasks.push(function(taskDone) {
        browser.quit(function() {
            browser.sauceJobStatus(failures === 0, taskDone);
        });
    });

    LIBS.async.series(tasks, function(err) {
        console.log('================================================ DONE', browserString);
        if (err) {
            console.log('--BROWSER FAILED--');
            console.log(err);
        }
        done();
    });
}


function runTests(state, done) {
    var q;
    // saucelabs FLOSS account has a low concurrency
    q = LIBS.async.queue(function(browser, browserDone) {
        runTestsInBrowser(state, browser, browserDone);
    }, BROWSER_CONCURRENCY);
    q.drain = done;
    q.push(BROWSERS);
}


function main() {
    var state = {};
    state.tests = listTests();
    state.sauce = {
        username:   process.env.SAUCE_USERNAME,
        access_key: process.env.SAUCE_ACCESS_KEY
    };
    state.results = {
        passCount: 0,
        failCount: 0,
        failures: {}    // key is test, value is hash of browser:error
    };

    state.capabilities = {
        tags: []
    };
    if (process.env.TRAVIS_JOB_NUMBER) {
        state.capabilities['tunnel-identifier'] = process.env.TRAVIS_JOB_NUMBER;
        // we only need one of these to run on travis
        if ('.1' !== process.env.TRAVIS_JOB_NUMBER.substr(-2)) {
            console.log('NOOP -- only running on "first" (.1) travis job');
            process.exit(0);
        }
    }
    if (process.env.TRAVIS) {
        state.capabilities.tags.push('CI');
    }
    state.capabilities.build = process.env.TRAVIS_BUILD_NUMBER || process.pid;
    console.log(JSON.stringify(state.capabilities, null, 4));

    console.log('================================================ START');
    LIBS.async.series([
        calculateGitDetails.bind(null, state),
// DEBUGGING -- no point in trying this until we get the git details sorted
//      runTests.bind(null, state)
    ], function(err) {
        console.log('================================================ DONE');
        if (err) {
            console.error(err);
            process.exit(2);
        }
        console.log(JSON.stringify(state.results, null, 4));
        if (state.results.failCount) {
            process.exit(1);
        }
    });
}
main();


