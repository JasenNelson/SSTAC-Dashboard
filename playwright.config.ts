import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const playwrightPort = Number(process.env.PLAYWRIGHT_TEST_PORT || '3100');
const playwrightHost = process.env.PLAYWRIGHT_TEST_HOST || '127.0.0.1';
const playwrightBaseURL =
  process.env.PLAYWRIGHT_TEST_BASE_URL || `http://${playwrightHost}:${playwrightPort}`;

// Lane B auth fixture: the setup project + authenticated project are added ONLY
// when E2E_TEST_EMAIL/PASSWORD are present AND E2E_AUTH_ENABLED=true is explicitly set.
// This ensures secrets alone do not enable auth setup on every branch, avoiding CI failures.
// (unauth specs skip on the /login bounce exactly as before).
const hasE2ECreds = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);
const authEnabled = process.env.E2E_AUTH_ENABLED === 'true';
const runAuthenticatedE2E = hasE2ECreds && authEnabled;
const userAuthState = path.join(__dirname, 'e2e', '.auth', 'user.json');

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
    // trace:'off' on setup so the login flow (which fills credential fields) is
    // never captured in a trace artifact, even on a retry. Defense-in-depth on
    // top of Playwright's built-in password-input masking.
    ...(runAuthenticatedE2E
      ? [{ name: 'setup', testMatch: /global\.setup\.ts/, use: { trace: 'off' as const } }]
      : []),
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /global\.setup\.ts/,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: /global\.setup\.ts/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: /global\.setup\.ts/,
    },
    ...(runAuthenticatedE2E
      ? [
          {
            name: 'chromium-auth',
            use: { ...devices['Desktop Chrome'], storageState: userAuthState },
            dependencies: ['setup'],
            testMatch: /matrix-options\.spec\.ts/,
          },
        ]
      : []),
  ],
  webServer: {
    // Use webpack dev server for hermetic worktree e2e runs. The app's
    // default `npm run dev` uses Turbopack, which rejects the worktree
    // node_modules junction because it points to the main checkout.
    command: `npx next dev --hostname ${playwrightHost} --port ${playwrightPort}`,
    url: playwrightBaseURL,
    // Codex 2026-05-16 round-11 P2 fix: reuseExistingServer:true
    // (the previous non-CI default) made Playwright SKIP the webServer
    // block entirely if anything was already on `playwrightBaseURL`,
    // which meant the AGENTIC_OS_SPAWN_STUB=true env pin below never
    // applied. An authenticated Agentic OS launch-click test against a
    // reused dev server (which may not have the env var set) would
    // invoke REAL claude / wt.exe on the developer's machine. Force a
    // fresh server every run so the env pin is always in effect. The
    // ~2-minute boot cost per `npm run test:e2e` is the price of
    // hermeticity. The previous reuse-based fast-iteration loop is
    // owner-visible but acceptable: quality > speed.
    reuseExistingServer: false,
    timeout: 120 * 1000, // 2 minutes
    // Codex 2026-05-16 round-10 P2 fix: pin AGENTIC_OS_SPAWN_STUB=true
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

