const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test',
  testMatch: ['e2e.test.js', 'layout.test.js', 'visual.test.js', 'consistency.test.js'],
  timeout: 30000,
  retries: 1,
  workers: 3,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', headless: true } },
    { name: 'webkit', use: { browserName: 'webkit', headless: true } },
  ],
  use: {
    baseURL: 'http://127.0.0.1:3031',
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.3,
      animations: 'disabled',
    },
  },
  webServer: {
    command: 'python3 scripts/dev-server.py 3031',
    port: 3031,
    reuseExistingServer: true,
  },
});
