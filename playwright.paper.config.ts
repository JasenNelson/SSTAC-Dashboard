import { defineConfig, devices } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import path from 'node:path';

import { SESSION_TEARDOWN_GREP, SESSION_TEARDOWN_PROJECT } from './e2e/session-teardown';

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
      // teardown (not a reverse dependency): selecting chromium-auth - as the standard harness does
      // with --project=chromium-auth - also runs the teardown project, after chromium-auth finishes.
      ...(hasCredentials ? { dependencies: ['setup'], teardown: SESSION_TEARDOWN_PROJECT } : {}),
      testIgnore: /global\.setup\.ts/,
      // A global logout here would revoke the session every later test shares; see e2e/session-teardown.ts.
      grepInvert: SESSION_TEARDOWN_GREP,
    },
    // Runs the session-ending tests only after every shared-session test has finished.
    ...(hasCredentials
      ? [{
          name: SESSION_TEARDOWN_PROJECT,
          use: { ...devices['Desktop Chrome'], storageState: userAuthState },
          testIgnore: /global\.setup\.ts/,
          grep: SESSION_TEARDOWN_GREP,
        }]
      : []),
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
