// Playwright global setup — stash the API/web URLs on process.env so every
// test worker sees the same values without duplicating config.

module.exports = async () => {
  process.env.E2E_API_URL = process.env.E2E_API_URL || 'http://localhost:3001';
  process.env.E2E_WEB_URL = process.env.E2E_WEB_URL || 'http://localhost:3000';
};
