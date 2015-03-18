module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        clean: {
            dist: 'dist/',
            data: 'data/',
            lib : 'lib/',
            tmp : 'tmp/'
        },

        curl: {
            cldr: {
                src : 'http://www.unicode.org/Public/cldr/26/json-full.zip',
                dest: 'tmp/cldr.zip',
            },
        },

        unzip: {
            cldr: {
                src : 'tmp/cldr.zip',
                dest: 'tmp/cldr/',
            },
        },

        copy: {
            cldr: {
                expand: true,
                cwd   : 'tmp/cldr/',
                dest  : 'data/',
                src   : [
                    '*-license.*',
                    'supplemental/parentLocales.json',
                    'main/*/ca-*.json',
                    'main/*/currencies.json',
                    'main/*/numbers.json',
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
                src: ['dist/Intl.min.js', 'locale-data/complete.js'],
                dest: 'dist/Intl.complete.js',
            }
        },

        jshint: {
            all: ['index.js', 'src/*.js', '*.json']
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
    grunt.loadNpmTasks('grunt-extract-cldr-data');
    grunt.loadNpmTasks('grunt-curl');
    grunt.loadNpmTasks('grunt-zip');

    grunt.registerTask('build', [
        'bundle_jsnext', 'uglify', 'cjs_jsnext', 'copy:src', 'concat'
    ]);

    grunt.registerTask('cldr', ['extract-cldr-data', 'compile-data']);

    grunt.registerTask('default', ['jshint', 'clean', 'build']);

    grunt.registerTask('update-cldr-data', [
        'clean',
        'curl',
        'unzip',
        'copy:cldr',
    ]);
};
