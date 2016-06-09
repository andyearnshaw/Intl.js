// This file is only needed to update test 262 used to test this polyfill
// by using the command: `$ grunt update-test262`
module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        clean: {
            test262: ['tmp/test262**', 'data/test262**', 'tests/test262/']
        },

        curl: {
            test262: {
                src : 'https://github.com/tc39/test262/archive/master.zip',
                dest: 'tmp/test262.zip'
            }
        },

        unzip: {
            test262: {
                src : 'tmp/test262.zip',
                dest: 'tmp/'
            }
        },

        copy: {
            test262: {
                expand: true,
                cwd   : 'tmp/test262-master/',
                dest  : 'tests/test262',
                src   : [
                    'LICENSE',
                    'test/intl402/**/*.js',
                    'harness/*.js'
                ]
            }
        }

    });

    grunt.loadTasks('./tasks');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-curl');
    grunt.loadNpmTasks('grunt-zip');

    grunt.registerTask('update-test262', [
        'clean:test262',
        'curl:test262',
        'unzip:test262',
        'copy:test262',
        'update-tests'
    ]);

};
