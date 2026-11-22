import { defineConfig, devices } from '@playwright/test';

// Matrix R2 local full-stack acceptance journey. LOCAL ONLY: the app and Supabase stack are started
// by scripts/matrix-options/r2-fullstack-preview.ps1 (no webServer here) and every endpoint must be
// loopback. This config is never part of the default or CI e2e runs (playwright.config.ts ignores it).
// The run's own loopback app port is always passed by r2-fullstack-preview.ps1 accept.
const baseURL = process.env.R2_FULLSTACK_BASE_URL ?? '';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL)) throw new Error('R2 full-stack journey refuses a non-loopback base URL.');
// Trusted preview: no Playwright error-context.md (the failed page's accessibility snapshot, which can
// carry reviewer text or sign-in form state). Playwright's artifacts recorder skips it only when this
// is set; the runner sets it here, the workers inherit it and load this config again, and the spec
// sets and asserts it in the worker as well.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

export default defineConfig({
  testDir: './e2e',
  testMatch: /matrix-options-paper-r2-fullstack\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  outputDir: '.tmp/r2-fullstack/playwright-output',
  reporter: [['list'], ['json', { outputFile: process.env.R2_FULLSTACK_REPORT || '.tmp/r2-fullstack/playwright-report.json' }]],
  // The journey signs in with the run's disposable local accounts only; still no trace, screenshot or
  // video, so no sign-in form state is ever captured.
  use: { baseURL, trace: 'off', screenshot: 'off', video: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
});
