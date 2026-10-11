const path = require('node:path');

const expoMetroConfigEntry = require.resolve('expo/metro-config');
const expoMetroConfigDir = path.dirname(expoMetroConfigEntry);
const transformSyncPath = require.resolve('@expo/metro-config/build/transformSync', {
  paths: [expoMetroConfigDir],
});
const hermesParserPath = require.resolve('hermes-parser', {
  paths: [path.dirname(transformSyncPath)],
});
const hermesParser = require(hermesParserPath);
const parse = hermesParser.parse;
const babelTransformerPath = require.resolve('@expo/metro-config/build/babel-transformer', {
  paths: [expoMetroConfigDir],
});

hermesParser.parse = (source, options) =>
  parse(source, {
    ...options,
    ...(/@flow\s+(?:strict-local|strict)\b/.test(source) ? { flow: 'all' } : null),
  });

module.exports = require(babelTransformerPath);
