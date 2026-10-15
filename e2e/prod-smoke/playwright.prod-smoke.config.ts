import { defineConfig, devices } from '@playwright/test';
import path from 'path';

// Opt-in READ-ONLY production smoke config. It is never picked up by the default
// playwright.config.ts run and refuses to load unless it is pointed at the production
// origin AND told which commit it expects to be live. No webServer: it never starts anything.
const PROD_ORIGIN = 'https://sstac-dashboard.vercel.app';
const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL;
const expectedSha = process.env.PROD_SMOKE_EXPECTED_SHA ?? '';

if (baseURL !== PROD_ORIGIN) {
  throw new Error('prod smoke config: PLAYWRIGHT_TEST_BASE_URL must be the production origin');
}
if (!/^[0-9a-f]{40}$/.test(expectedSha)) {
  throw new Error('prod smoke config: PROD_SMOKE_EXPECTED_SHA must be a 40-char lowercase hex commit');
}

const e2eDir = path.join(__dirname, '..');
const userAuthState = path.join(e2eDir, '.auth', 'user.json');
const adminAuthState = path.join(e2eDir, '.auth', 'admin.json');

export default defineConfig({
  testDir: '..',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [['list']],
  timeout: 60000,
  expect: { timeout: 30000 },
  // Pinned to the repo-root test-results (the run-owned path the containment wrapper cleans);
  // Playwright's own default would be relative to this config's folder instead.
  outputDir: path.join(e2eDir, '..', 'test-results'),
  use: {
    baseURL,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    { name: 'setup', testMatch: /global\.setup\.ts/, use: { trace: 'off' as const } },
    { name: 'setup-admin', testMatch: /admin\.setup\.ts/, use: { trace: 'off' as const } },
    {
      name: 'prod-smoke-member',
      testMatch: /mo-copy-consistency\.prod-smoke\.spec\.ts/,
      grep: /@member/,
      use: { ...devices['Desktop Chrome'], storageState: userAuthState },
      dependencies: ['setup'],
    },
    {
      name: 'prod-smoke-admin',
      testMatch: /mo-copy-consistency\.prod-smoke\.spec\.ts/,
      grep: /@admin/,
      use: { ...devices['Desktop Chrome'], storageState: adminAuthState },
      dependencies: ['setup-admin'],
    },
  ],
});
