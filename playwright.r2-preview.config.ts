import { defineConfig, devices } from '@playwright/test';

const port = 49233;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: /matrix-options-paper-r2-preview-local\.spec\.ts/,
  workers: 1,
  retries: 0,
  timeout: 90000,
  reporter: [['list']],
  use: { baseURL, trace: 'off' },
  projects: [{ name: 'chromium-preview', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      NODE_ENV: 'development',
      MATRIX_R2_REVIEW_PREVIEW: '1',
      MATRIX_R2_PREVIEW_BROWSER_TEST: '1',
      MATRIX_R2_GUIDED_REVIEW_UI: 'false',
      MATRIX_OPTIONS_PAPER_WORKSPACE: 'false',
      MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION: 'false',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-preview-no-provider',
      SUPABASE_SERVICE_ROLE_KEY: '',
    },
  },
});
