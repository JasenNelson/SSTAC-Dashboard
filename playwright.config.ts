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
    // Codex 2026-05-16 final-holistic P2 fix: pin AGENTIC_OS_SPAWN_STUB=true
    // for the Playwright dev server unconditionally. The admin-agentic-os
    // spec's Pattern A/B/D launch-click tests assert on stub-canned-output
    // strings ("[stub] launched...") so they FAIL-AT-ASSERTION if a real
    // claude / wt.exe ever spawns -- but the assertion fires AFTER the
    // spawn. Pinning the stub env here ensures the launch route's spawn
    // call short-circuits BEFORE any real CLI binary is invoked on the
    // developer's machine, even when a maintainer forgets to prefix
    // `AGENTIC_OS_SPAWN_STUB=true` to the npm test:e2e command. This is
    // fail-closed at the routing layer rather than the assertion layer.
    // The stub branch in spawn-await-ready.ts is INERT outside the
    // agentic-os feature so this does not affect any other spec.
    env: {
      ...process.env,
      AGENTIC_OS_SPAWN_STUB: 'true',
    },
  },
});

