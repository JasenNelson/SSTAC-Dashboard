import { defineConfig, devices } from '@playwright/test';
import path from 'path'; // eslint-disable-line @typescript-eslint/no-unused-vars

const playwrightPort = Number(process.env.PLAYWRIGHT_TEST_PORT || '3100');
const playwrightHost = process.env.PLAYWRIGHT_TEST_HOST || '127.0.0.1';
const playwrightBaseURL =
  process.env.PLAYWRIGHT_TEST_BASE_URL || `http://${playwrightHost}:${playwrightPort}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: playwrightBaseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --hostname ${playwrightHost} --port ${playwrightPort}`,
    url: playwrightBaseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes
  },
});

