const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Expo's Metro config uses Hermes for React Native's Flow files, but Hermes
// auto-detects `@flow` and misses React Native's `@flow strict-local` pragma.
// Use the project transformer wrapper to treat those strict Flow files as Flow.
config.transformer.babelTransformerPath = require.resolve('./metro-babel-transformer');

// ponytail: Expo Symbols' Android helper imports all seven weights; switch to its hook file until upstream imports it directly.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'android' && moduleName === '@expo-google-fonts/material-symbols') {
    return context.resolveRequest(context, '@expo-google-fonts/material-symbols/useFonts', platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
