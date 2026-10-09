const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ponytail: Expo Symbols' Android helper imports all seven weights; switch to its hook file until upstream imports it directly.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'android' && moduleName === '@expo-google-fonts/material-symbols') {
    return context.resolveRequest(context, '@expo-google-fonts/material-symbols/useFonts', platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
