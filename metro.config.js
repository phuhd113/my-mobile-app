const { getDefaultConfig } = require('expo/metro-config');

module.exports = (async () => {
  const defaultConfig = await getDefaultConfig(__dirname);
  defaultConfig.resolver.assetExts.push('bin');
  //defaultConfig.resolver.assetExts.push('tflite');
  return defaultConfig;
})();
