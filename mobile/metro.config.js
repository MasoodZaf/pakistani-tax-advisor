// Metro bundler config for the Expo mobile app.
//
// Only customisation: include the repo-level `/shared/` directory in Metro's
// watchFolders so we can import from `../shared/expenseSchema` (the single
// source of truth for category/payment-method enums and tax-year derivation
// that the backend also consumes). Without this, Metro refuses imports
// outside the project root.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const sharedRoot = path.resolve(__dirname, '..', 'shared');
config.watchFolders = [...(config.watchFolders || []), sharedRoot];

// Keep node_modules resolution tied to the mobile app — Metro shouldn't try
// to resolve modules out of the shared folder's (absent) node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

module.exports = config;
