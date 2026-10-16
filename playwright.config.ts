import { defineConfig, devices } from '@playwright/test';

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';

/**
 * End-to-end tests drive the real stack: browser -> Next.js -> Express -> MongoDB.
 *
 * They reuse an already running `npm run dev`, or start one. The API is
 * read-only, so running them against the development database changes nothing.
 *
 * The installed Google Chrome is used by default, which avoids downloading a
 * browser. Set E2E_BROWSER_CHANNEL=chromium after `npx playwright install chromium`
 * to use Playwright's own build instead.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: WEB_URL,
    channel: process.env.E2E_BROWSER_CHANNEL ?? 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: WEB_URL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
