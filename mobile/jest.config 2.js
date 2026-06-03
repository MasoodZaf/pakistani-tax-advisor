// Lightweight Jest config for pure-logic unit tests (e.g. the offline tax
// calculator). It deliberately does NOT use the jest-expo preset — these tests
// import no React Native / native modules, so a plain babel-jest transform with
// the Expo Babel preset is enough and far lighter to install in CI.
//
// To run:  cd mobile && npm install && npm test
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/**/__tests__/**/*.test.js'],
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
};
