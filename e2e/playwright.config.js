// Playwright config — smoke-test tier.
// Run:  cd e2e && npx playwright test
// CI:   GitHub Actions workflow .github/workflows/e2e.yml

const { defineConfig, devices } = require('@playwright/test');

const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';
const WEB_URL = process.env.E2E_WEB_URL || 'http://localhost:3000';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // the backend / DB is shared state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // E2E_SKIP_WEBSERVER=1 — skip spawning if backend/frontend already running
  // (useful for local dev where you've got dev servers up).
  webServer: process.env.E2E_SKIP_WEBSERVER ? undefined : [
    {
      command: 'cd ../backend && npm start',
      url: `${API_URL}/api/health`,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  // Expose URLs to tests via globalSetup env.
  globalSetup: require.resolve('./globalSetup.js'),
});
