module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        clean: {
            cldr   : ['locale-data/'],
            test262: ['tmp/test262**', 'data/test262**', 'tests/test262/'],
            lib    : ['lib/', 'dist/'],
        },

        curl: {
            test262: {
                src : 'https://github.com/tc39/test262/archive/master.zip',
                dest: 'tmp/test262.zip',
            }
        },

        unzip: {
            cldr: {
                src : 'tmp/cldr.zip',
                dest: 'tmp/cldr/',
            },
            test262: {
                src : 'tmp/test262.zip',
                dest: 'tmp/',
            }
        },

        copy: {
            test262: {
                expand: true,
                cwd   : 'tmp/test262-master/',
                dest  : 'tests/test262',
                src   : [
                    'LICENSE',
                    'test/intl402/*.js',
                    'harness/*.js',
                ]
            },
            src: {
                expand : true,
                flatten: true,
                src    : ['tmp/src/*.js'],
                dest   : 'lib/'
            }
        },

        concat: {
            complete: {
                src : ['dist/Intl.min.js', 'locale-data/complete.js'],
                dest: 'dist/Intl.complete.js',
            },
        },

        jshint: {
            options: {
                eqeqeq: true
            },
            src: ['src/*.js'],
            node: ['index.js', '*.json'],
            build: ['tasks/**/*.js']
        },

        bundle_jsnext: {
            dest: 'dist/Intl.js',
            options: {
                namespace: 'IntlPolyfill'
            }
        },

        cjs_jsnext: {
            dest: 'tmp/'
        },

        uglify: {
            options: {
                preserveComments: 'some'
            },
            build: {
                files: {
                    'dist/Intl.min.js': ['dist/Intl.js']
                }
            }
        },

    });

    grunt.loadTasks('./tasks');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-bundle-jsnext-lib');
    grunt.loadNpmTasks('grunt-curl');
    grunt.loadNpmTasks('grunt-zip');

    grunt.registerTask('build', [
        'bundle_jsnext', 'uglify', 'cjs_jsnext', 'copy:src', 'concat:complete'
    ]);

    grunt.registerTask('cldr', ['clean:cldr', 'extract-cldr-data', 'compile-data']);

    grunt.registerTask('default', ['jshint', 'clean:lib', 'build']);

    grunt.registerTask('update-test262', [
        'clean:test262',
        'curl:test262',
        'unzip:test262',
        'copy:test262',
        'update-tests',
    ]);

};
