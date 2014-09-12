module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        clean: {
            dist: 'dist/',
            lib : 'lib/',
            tmp : 'tmp/'
        },

        copy: {
            tmp: {
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
        }
    });

    grunt.loadTasks('./tasks');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-bundle-jsnext-lib');

    grunt.registerTask('build', [
        'bundle_jsnext', 'uglify', 'cjs_jsnext', 'copy', 'concat'
    ]);

    grunt.registerTask('cldr', ['compile-data']);

    grunt.registerTask('default', ['jshint', 'clean', 'build']);
};
