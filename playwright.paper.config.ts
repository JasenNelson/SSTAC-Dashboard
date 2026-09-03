import { defineConfig, devices } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import path from 'node:path';

loadEnvConfig(process.cwd());
const paperWorkspaceFlag = process.env.MATRIX_OPTIONS_PAPER_WORKSPACE ?? 'true';
process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = paperWorkspaceFlag;

const host = '127.0.0.1';
const port = 3117;
const baseURL = `http://${host}:${port}`;
const hasCredentials = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);
const userAuthState = path.join(__dirname, 'e2e', '.auth', 'user.json');

export default defineConfig({
  testDir: './e2e',
  testMatch: /matrix-options-paper\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report-paper' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    ...(hasCredentials
      ? [{ name: 'setup', testMatch: /global\.setup\.ts/, use: { trace: 'off' as const } }]
      : []),
    {
      name: hasCredentials ? 'chromium-auth' : 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(hasCredentials ? { storageState: userAuthState } : {}),
      },
      ...(hasCredentials ? { dependencies: ['setup'] } : {}),
      testIgnore: /global\.setup\.ts/,
    },
  ],
  webServer: {
    command: `npx next dev --hostname ${host} --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      AGENTIC_OS_SPAWN_STUB: 'true',
      MATRIX_OPTIONS_PAPER_WORKSPACE: paperWorkspaceFlag,
    },
  },
});
