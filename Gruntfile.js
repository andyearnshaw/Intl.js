module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concat: {
            options: {
                banner: "module.exports = require('./Intl.js');\nmodule.exports.__addLocaleData(",
                separator: ');\nmodule.exports.__addLocaleData(',
                footer: ');\n'
            },
            alljs: {
                src: 'locale-data/json/*.json',
                dest: 'all.js',
            }
        },
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

    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.registerTask('default', ['jshint', 'uglify']);

};
