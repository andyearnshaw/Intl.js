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
    grunt.registerTask('default', ['jshint', 'uglify']);

};
