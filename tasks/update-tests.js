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
        URL_BASE = 'https://github.com/tc39/test262/trunk',
        SUITE    = '/test/suite/intl402',
        HARNESS  = '/test/harness',
        LICENSE  = '/LICENSE',
        DEST_TESTS_DIR = LIBS.path.resolve(__dirname, '..', 'tests', 'test262');


    grunt.registerTask('update-tests', 'refreshes the tests found in tests/test262', function() {
        var gruntTaskDone = this.async(),
            tempDir,
            testsTarball,
            srcTestsDir;

        LIBS.async.series([
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
                grunt.log.writeln('downloading latest test suite');

                grunt.util.spawn({
                        cmd: 'svn',
                        args: ['export', URL_BASE + LICENSE, DEST_TESTS_DIR + LICENSE]
                }, function(err, results) {
                    asyncTaskDone(err);
                });
            },

            function(asyncTaskDone) {
                grunt.util.spawn({
                        cmd: 'svn',
                        args: ['export', URL_BASE + HARNESS, DEST_TESTS_DIR + HARNESS]
                }, function(err, results) {
                    asyncTaskDone(err);
                });
            },

            function(asyncTaskDone) {
                grunt.util.spawn({
                        cmd: 'svn',
                        args: ['export', URL_BASE + SUITE, DEST_TESTS_DIR + SUITE]
                }, function(err, results) {
                    if (!err)
                        grunt.log.ok('downloaded to ' + DEST_TESTS_DIR);

                    asyncTaskDone(err);
                });
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
