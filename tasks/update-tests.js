/**
 * Refreshes the tests found in tests/test262.
 */
module.exports = function(grunt) {

    var LIBS = {
            async:  require('async'),
            http:   require('http'),
            path:   require('path'),
            vm:     require('vm')
        },
        URL_BASE = 'http://hg.ecmascript.org',
        DEST_TESTS_DIR = LIBS.path.resolve(__dirname, '..', 'tests', 'test262');


    grunt.registerTask('update-tests', 'refreshes the tests found in tests/test262', function() {
        var gruntTaskDone = this.async(),
            testsURL,
            tempDir,
            testsTarball,
            srcTestsDir;

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
                srcTestsDir = tempDir + '/test262-d067d2f0ca30';
                grunt.log.ok('tests directory:  ' + srcTestsDir);
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
                    srcTestsDir = LIBS.path.resolve(tempDir, 'test262-' + LIBS.path.basename(testsTarball).split('.')[0]);
                    grunt.log.ok('tests directory:  ' + srcTestsDir);
                    asyncTaskDone(err);
                });
            },

            function(asyncTaskDone) {
                grunt.log.writeln('clearing old tests/test262...');
                var doomed = grunt.file.expand(DEST_TESTS_DIR + '/*');
                doomed.forEach(function(path) {
                    grunt.file.delete(path);
                });
                grunt.log.ok('done');
                asyncTaskDone();
            },

            function(asyncTaskDone) {
                grunt.log.writeln('copying from tarball to tests/test262...');
                grunt.file.copy(
                    LIBS.path.resolve(srcTestsDir, 'LICENSE'),
                    LIBS.path.resolve(DEST_TESTS_DIR, 'LICENSE')
                );

                ['tools', 'test'].forEach(function(dir) {
                    grunt.log.ok(dir);
                    var files = grunt.file.expand(
                        LIBS.path.resolve(srcTestsDir, dir) + '/**'
                    );
                    files.forEach(function(srcPath) {
                        if (! grunt.file.isFile(srcPath)) {
                            return;
                        }
                        var destPath = srcPath.replace(srcTestsDir, LIBS.path.resolve(DEST_TESTS_DIR));
                        grunt.file.copy(srcPath, destPath);
                    });
                });
                grunt.log.ok('done');
                asyncTaskDone();
            },

            function(asyncTaskDone) {
                grunt.log.writeln('removing `Collator` tests...');

                // fixup constructor lists
                [   DEST_TESTS_DIR + '/test/harness/testIntl.js',
                    DEST_TESTS_DIR + '/test/suite/intl402/ch08/8.0/8.0_L15.js'
                ].forEach(function(path) {
                    grunt.log.ok('adjusting ' + path);
                    var contents = grunt.file.read(path);
                    contents = contents.replace(/(\[)("Collator",)/, '$1/*$2*/');
                    grunt.file.write(path, contents);
                });

                // these are just trouble
                [   DEST_TESTS_DIR + '/test/suite/intl402/ch09/9.2/9.2.5_11_g_ii_2.js',
                    DEST_TESTS_DIR + '/test/suite/intl402/ch10',
                    DEST_TESTS_DIR + '/test/suite/intl402/ch13/13.1'
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
                        __dirname: LIBS.path.resolve(__dirname, '..', 'tests'),
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
                    return;
                }
                grunt.log.ok('done');
                asyncTaskDone();
            },

            function(asyncTaskDone) {
                grunt.log.writeln('cleaning up temporary directories...');
                grunt.util.spawn({
                        cmd: 'rm',
                        args: ['-rf', tempDir, DEST_TESTS_DIR + '/test', DEST_TESTS_DIR + '/tools']
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
    });

};
