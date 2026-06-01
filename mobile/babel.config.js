// Standard Expo Babel config. This matches the preset Expo's Metro applies by
// default, and is required for babel-jest to transpile the app's ESM/JSX in
// unit tests (see jest.config.js).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
