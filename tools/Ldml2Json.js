/**
 * Converts Unicode CLDR data to JSON format for use with Intl.js
 * Copyright 2013 Andy Earnshaw, MIT License
 *
 * Requires that CLDR core.zip and tools.zip are extracted to a common
 * directory and that path is passed as the first argument, e.g.
 *
 *      node Ldml2Json.js ~/unicode-cldr/
 */

var
    child,
    spawn = require('child_process').spawn,

    // Path to CLDR root
    cldr = process.argv[2];

    // Paths to required classes in the CLDR /tools/java folder
    jPath = cldr + '/tools/java/',
    clsPaths = ['libs/icu4j.jar', 'libs/utilities.jar', 'libs/xercesImpl.jar', 'classes/'],

    // Ldml2JsonConverter class
    cls = 'org.unicode.cldr.json.Ldml2JsonConverter',

    // Ldml2JsonConverter config file (passed with arg -k)
    cfg = 'tools/Ldml2JsonConverter.config',

    out = 'cldr/';

// Initial output should hide cursor in Linux terminals
process.stdout.write('\x1b[?25l\rRunning JSON conversion...\n\n');

function cleanUp () {
    // Need to reshow the blinking cursor
    process.stdout.write('\n\x1b[?12l\x1b[?25h\r' + Array(15).join(' '));
}
process.on('exit', cleanUp);
process.on('SIGINT', cleanUp);

child = spawn('java', [ '-DCLDR_DIR='+cldr, '-cp', jPath + clsPaths.join(':'+jPath), cls, '-d', out, '-k', cfg, '-m *en*' ]);

child.stdout.on('data', function (data) {
    if (data.toString().indexOf('Processing') >= 0)
        process.stdout.write('\r\x1b[K\r\t' + String(data).slice(0, String(data).indexOf('\n')));
});

child.on('exit', function (err) {
    if (err !== 0)
        process.stderr.write(String(err));
    else
        console.log('\n\nDone!');
});
