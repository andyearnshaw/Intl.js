module.exports = function (grunt) {

    grunt.initConfig({
        uglify: {
            options: {
                preserveComments: 'some'
            },
            my_target: {
                files: {
                    'Intl.min.js': ['Intl.js']
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.registerTask('default', ['uglify']);

};
