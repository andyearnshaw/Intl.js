/*global Promise*/

import * as p from 'path';
import * as fs from 'fs';
import {rollup} from 'rollup';
import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import uglify from 'rollup-plugin-uglify';

const isProduction = process.env.NODE_ENV === 'production';

const entry = p.resolve('src/main.js');
const dest  = p.resolve(`dist/Intl.${isProduction ? 'min.js' : 'js'}`);

const bundleConfig = {
    dest,
    format: 'umd',
    moduleName: 'IntlPolyfill',
    sourceMap: true,
};

let babelConfig = JSON.parse(fs.readFileSync('src/.babelrc', 'utf8'));
babelConfig.babelrc = false;
babelConfig.presets = babelConfig.presets.map((preset) => {
    return preset === 'es2015' ? 'es2015-rollup' : preset;
});

let plugins = [
    babel(babelConfig),
    commonjs({
        sourceMap: true,
    }),
];

if (isProduction) {
    plugins.push(
        uglify({
            warnings: false,
        })
    );
}

let bundle = Promise.resolve(rollup({entry, plugins}));
bundle.then(({write}) => write(bundleConfig));

process.on('unhandledRejection', (reason) => {throw reason;});
