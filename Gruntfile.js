module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jshint: {
            all: ['Intl.js']
        },
        uglify: {
            options: {
                preserveComments: 'some'
            },
            build: {
                files: {
                    'Intl.min.js': ['Intl.js']
                }
            }
        }

    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');

    grunt.registerTask('compile-data', 'Compile the data into the polyfill', compileData);
    grunt.registerTask('default', function () {
        grunt.task.run('jshint');
        grunt.task.run('uglify');

        if (grunt.option('complete'))
            grunt.task.run('compile-data');
    });
    grunt.registerTask('update-tests', 'refreshes the tests found in tests/test262', updateTests);


    /**
     * Refreshes the tests found in tests/test262.
     */
    function updateTests() {
        var gruntTaskDone = this.async(),
            LIBS = {
                async:  require('async'),
                fs:     require('fs'),
                http:   require('http'),
                path:   require('path'),
                vm:     require('vm')
            },
            URL_BASE = 'http://hg.ecmascript.org',
            testsURL,
            tempDir,
            testsTarball,
            testsDir;

        LIBS.async.series([
            function(asyncTaskDone) {
                var resErr,
                    resBody = '';
                grunt.log.writeln('looking for tests tarball...');
                /*
                // DEBUGGING
                testsURL = 'http://hg.ecmascript.org/tests/test262/archive/d067d2f0ca30.tar.gz';
                grunt.log.ok('tests URL:  ' + testsURL);
                asyncTaskDone();
                return;
                */

                LIBS.http.get(URL_BASE + '/tests/test262/file/', function(res) {
                    if (200 !== res.statusCode) {
                        asyncTaskDone(new Error('failed to GET ' + URL_BASE + '/tests/test262/file/'));
                        return;
                    }
                    res.on('data', function(data) {
                        resBody += data.toString();
                    });
                    res.on('error', function(err) {
                        resErr = err;
                    });
                    res.on('end', function() {
                        var matches;
                        matches = resBody.match(/<a href="(\/tests\/test262\/archive\/[^.]+.tar.gz)">gz<\/a>/);
                        testsURL = matches[1];
                        if (!testsURL) {
                            asyncTaskDone(new Error('failed to find tar.gz of tests'));
                            return;
                        }
                        if ('/' === testsURL[0]) {
                            testsURL = URL_BASE + testsURL;
                        }
                        grunt.log.ok('tests URL:  ' + testsURL);
                        asyncTaskDone(resErr);
                    });
                }).end();
            },

            function(asyncTaskDone) {
                grunt.log.writeln('making temporary directory...');
                /*
                // DEBUGGING
                tempDir = '/tmp/grunt.o4xlDE3o';
                grunt.log.ok('temporary directory:  ' + tempDir);
                asyncTaskDone();
                return;
                */
                grunt.util.spawn({
                        cmd: 'mktemp',
                        args: ['-d', '/tmp/grunt.XXXXXXXX']
                }, function(err, results) {
                    tempDir = results.stdout;
                    grunt.log.ok('temporary directory:  ' + tempDir);
                    asyncTaskDone(err);
                });
            },

            function(asyncTaskDone) {
                var resErr,
                    resBody = new Buffer(0),
                    reportEveryBytes = 300000,
                    reportBytes = 0;
                grunt.log.writeln('downloading tests tarball...');
                /*
                // DEBUGGING
                testsTarball = tempDir + '/d067d2f0ca30.tar.gz';
                grunt.log.ok('tests tarball:  ' + testsTarball);
                asyncTaskDone();
                return;
                */
                LIBS.http.get(testsURL, function(res) {
                    if (200 !== res.statusCode) {
                        asyncTaskDone(new Error('failed to GET ' + testsUR));
                        return;
                    }
                    res.on('data', function(data) {
                        // We need to use the Buffer class to safely handle binary
                        // data (octet streams).  Alas, it's not resizable so we
                        // need to reallocate as we go along.
                        var newBuffer = Buffer(resBody.length + data.length);
                        resBody.copy(newBuffer, 0);
                        data.copy(newBuffer, resBody.length);
                        resBody = newBuffer;
                        reportBytes += data.length;
                        if (reportBytes >= reportEveryBytes) {
                            grunt.log.ok('got ' + resBody.length + ' bytes');
                            reportBytes = 0;
                        }
                    });
                    res.on('error', function(err) {
                        resErr = err;
                    });
                    res.on('end', function() {
                        testsTarball = LIBS.path.resolve(tempDir, LIBS.path.basename(testsURL));
                        grunt.file.write(testsTarball, resBody.toString('binary'), {encoding: 'binary'});
                        grunt.log.ok('tests tarball:  ' + testsTarball);
                        asyncTaskDone(resErr);
                    });
                }).end();
            },

            function(asyncTaskDone) {
                grunt.log.writeln('expanding tests tarball...');
                /*
                // DEBUGGING
                testsDir = tempDir + '/test262-d067d2f0ca30';
                grunt.log.ok('tests directory:  ' + testsDir);
                asyncTaskDone();
                return;
                */
                grunt.util.spawn({
                    cmd: 'tar',
                    args: ['xfz', LIBS.path.basename(testsTarball)],
                    opts: {
                        cwd: tempDir
                    }
                }, function(err, results) {
                    testsDir = LIBS.path.resolve(tempDir, 'test262-' + LIBS.path.basename(testsTarball).split('.')[0]);
                    grunt.log.ok('tests directory:  ' + testsDir);
                    asyncTaskDone(err);
                });
            },

            function(asyncTaskDone) {
                grunt.log.writeln('clearing old tests/test262...');
                var doomed = grunt.file.expand(__dirname + '/tests/test262/*');
                doomed.forEach(function(path) {
                    grunt.file.delete(path);
                });
                grunt.log.ok('done');
                asyncTaskDone();
            },

            function(asyncTaskDone) {
                grunt.log.writeln('copying from tarball to tests/test262...');
                grunt.file.copy(
                    LIBS.path.resolve(testsDir, 'LICENSE'),
                    LIBS.path.resolve(__dirname, 'tests/test262/LICENSE')
                );

                ['tools', 'test'].forEach(function(dir) {
                    grunt.log.ok(dir);
                    var files = grunt.file.expand(
                        LIBS.path.resolve(testsDir, dir) + '/**'
                    )
                    files.forEach(function(srcPath) {
                        if (! grunt.file.isFile(srcPath)) {
                            return;
                        }
                        var destPath = srcPath.replace(testsDir, LIBS.path.resolve(__dirname, 'tests/test262'));
                        grunt.file.copy(srcPath, destPath);
                    });
                });
                grunt.log.ok('done');
                asyncTaskDone();
            },

            function(asyncTaskDone) {
                grunt.log.writeln('removing `Collator` tests...');

                // fixup constructor lists
                [   'tests/test262/test/harness/testIntl.js',
                    'tests/test262/test/suite/intl402/ch08/8.0/8.0_L15.js'
                ].forEach(function(path) {
                    grunt.log.ok('adjusting ' + path);
                    var contents = grunt.file.read(path);
                    contents = contents.replace(/(\[)("Collator",)/, '$1/*$2*/');
                    grunt.file.write(path, contents);
                });

                // these are just trouble
                [   'tests/test262/test/suite/intl402/ch09/9.2/9.2.5_11_g_ii_2.js',
                    'tests/test262/test/suite/intl402/ch10',
                    'tests/test262/test/suite/intl402/ch13/13.1'
                ].forEach(function(path) {
                    grunt.log.ok('removing ' + path);
                    grunt.file.delete(path);
                });

                asyncTaskDone();
            },

            function(asyncTaskDone) {
                grunt.log.writeln('rebuilding tests/test262/pages...');
                var path = 'tests/build-pages.js',
                    content = grunt.file.read(path),
                    sandbox = {
                        __dirname: LIBS.path.join(__dirname, 'tests'),
                        require: require,
                        console: {
                            log: function(msg) {
                                grunt.log.ok(msg);
                            }
                        }
                    };
                try {
                    LIBS.vm.runInNewContext(content, sandbox, path);
                } catch (err) {
                    asyncTaskDone(err);
                }
                grunt.log.ok('done');
                asyncTaskDone();
            },

            function(asyncTaskDone) {
                grunt.log.writeln('cleaning up temporary directory...');
                grunt.util.spawn({
                        cmd: 'rm',
                        args: ['-rf', tempDir]
                }, function(err) {
                    asyncTaskDone(err);
                });
            }

        ], function(err) {
            if (err) {
                grunt.log.error(err.message);
            }
            gruntTaskDone(err);
        });
    }


    /**
     * Compiles all JSON data into the polyfill and saves it as Intl.complete.js
     */
    function compileData() {
        var
            locData  = {},
            objStrs  = {},
            objs     = [],
            prims    = [],

            valCount = 0,
            objCount = 0,

            fileData = '',
            fs       = require('fs'),
            locales  = fs.readdirSync('locale-data/json/'),
            Intl     = String(fs.readFileSync('Intl.js'));

        fileData += Intl.slice(0, Intl.lastIndexOf('return Intl;')) + '(function () {';

        locales.forEach(function (file) {
            locData[file.slice(0, file.indexOf('.'))] = JSON.parse(fs.readFileSync('locale-data/json/' + file), reviver);
        });

        function reviver (k, v) {
            var idx;

            if (k === 'locale')
                return undefined;

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
        }

        fileData += 'var a='+ JSON.stringify(prims) +',b=[];';
        objs.forEach(function (val, idx) {
            var ref = JSON.stringify(val).replace(/"###(objs|prims)(\[[^#]+)###"/g, replacer);

            fileData += 'b['+ idx +']='+ ref +';';
        });

        for (var k in locData)
            fileData += 'addLocaleData('+ locData[k].replace(/###(objs|prims)(\[[^#]+)###/, replacer) +', "'+ k +'");';

        fileData += '})();\n' + Intl.slice(Intl.lastIndexOf('return Intl;'));
        fs.writeFileSync('Intl.complete.js', fileData);

        grunt.log.writeln('Total number of reused strings is ' + prims.length + ' (reduced from ' + valCount + ')');
        grunt.log.writeln('Total number of reused objects is ' + Object.keys(objStrs).length + ' (reduced from ' + objCount + ')');
    }

    function replacer($0, type, loc) {
        return (type === 'prims' ? 'a' : 'b') + loc;
    }
};
