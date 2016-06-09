/*global Promise*/

import * as p from 'path';
import * as fs from 'fs';
import {rollup} from 'rollup';
import babel from 'rollup-plugin-babel';

let babelConfig = JSON.parse(fs.readFileSync('src/.babelrc', 'utf8'));
babelConfig.babelrc = false;
babelConfig.presets = babelConfig.presets.map((preset) => {
    return preset === 'es2015' ? 'es2015-rollup' : preset;
});

let bundle = rollup({
    entry: p.resolve('src/core.js'),
    plugins: [
        babel(babelConfig)
    ]
});

// Cast to native Promise.
bundle = Promise.resolve(bundle);

bundle.then(({write}) => write({
    dest: p.resolve('lib/core.js'),
    format: 'cjs'
}));

process.on('unhandledRejection', (reason) => {throw reason;});
