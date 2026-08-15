import { defineConfig, devices } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import path from 'path';

// Load .env.local (and Next.js's other env-file tiers) into process.env so the
// credentials e2e/global.setup.ts / e2e/admin.setup.ts read (E2E_TEST_EMAIL,
// E2E_TEST_PASSWORD, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_AUTH_ENABLED)
// are actually present when Playwright is invoked directly (`npx playwright
// test`), not only when something upstream already sourced them. Nothing in
// this file previously loaded .env.local, so the chromium-auth /
// chromium-admin-auth projects below were unconditionally skipped locally.
//
// Uses @next/env (shipped by `next`, already a direct dependency here) rather
// than adding a new `dotenv` dependency -- `dotenv` itself is only a
// transitive dependency of @sentry/bundler-plugin-core, not something this
// project can rely on directly. @next/env's loadEnvConfig only fills in keys
// that are NOT already present in process.env (see node_modules/@next/env's
// processEnv/populate logic), so real environment variables -- e.g. secrets
// CI injects directly -- always take precedence over .env.local.
loadEnvConfig(process.cwd());

const playwrightPort = Number(process.env.PLAYWRIGHT_TEST_PORT || '3100');
const playwrightHost = process.env.PLAYWRIGHT_TEST_HOST || '127.0.0.1';
const playwrightBaseURL =
  process.env.PLAYWRIGHT_TEST_BASE_URL || `http://${playwrightHost}:${playwrightPort}`;

// Lane B auth fixture: the setup project + authenticated project are added ONLY
// when E2E_TEST_EMAIL/PASSWORD are present AND E2E_AUTH_ENABLED=true is explicitly set.
// This ensures secrets alone do not enable auth setup on every branch, avoiding CI failures.
// (unauth specs skip on the /login bounce exactly as before).
//
// E6 note (third adversarial round, 2026-08-15): E2E_AUTH_ENABLED is a SEPARATE
// gate from having credentials -- both are required, and credentials alone are
// NOT enough. Locally, a .env.local with E2E_TEST_EMAIL/E2E_TEST_PASSWORD set but
// no E2E_AUTH_ENABLED='true' silently produces zero chromium-auth/chromium-admin-auth
// projects (VERIFIED via `npx playwright test --list`: 3 projects without the var,
// 5 with it, including the chromium-auth run of this file's own phone-layout spec).
// Every auth-gated spec (including matrix-options-phone-layout.spec.ts) also
// matches the unauthenticated chromium/firefox/webkit projects below (those
// projects only testIgnore the setup files, not this spec), where it hits the
// /login bounce and test.skip()s; chromium-auth is the only project where it
// actually exercises the phone layout. Without chromium-auth existing at all,
// a local `npm run test:e2e` reports green having never executed the
// auth-gated assertions -- a silent coverage reduction, not a failure. CI sets this repo
// variable to true, so CI does exercise chromium-auth; to run it locally, set the
// var explicitly, e.g. (PowerShell) `$env:E2E_AUTH_ENABLED='true'; npm run test:e2e`.
const hasE2ECreds = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);
const authEnabled = process.env.E2E_AUTH_ENABLED === 'true';
const runAuthenticatedE2E = hasE2ECreds && authEnabled;
const userAuthState = path.join(__dirname, 'e2e', '.auth', 'user.json');

const hasAdminCreds = Boolean(process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD);
const runAdminE2E = hasAdminCreds && authEnabled;
const adminAuthState = path.join(__dirname, 'e2e', '.auth', 'admin.json');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // 'open: never' stops Playwright from spawning the "Serving HTML report at
  // http://localhost:PORT" server and blocking on it after the run finishes.
  // A background gate run (test:e2e piped through a gate script) never sends
  // the Ctrl+C that server waits for, so the whole gate command hangs
  // forever and downstream gates never run. The report is still written to
  // disk (default playwright-report/) for manual `npx playwright show-report`
  // inspection -- only the auto-serve-and-block behavior is disabled.
  reporter: [['html', { open: 'never' }]],
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
    ...(runAdminE2E
      ? [{ name: 'setup-admin', testMatch: /admin\.setup\.ts/, use: { trace: 'off' as const } }]
      : []),
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /(global|admin)\.setup\.ts/,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: /(global|admin)\.setup\.ts/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: /(global|admin)\.setup\.ts/,
    },
    ...(runAuthenticatedE2E
      ? [
          {
            name: 'chromium-auth',
            use: { ...devices['Desktop Chrome'], storageState: userAuthState },
            dependencies: ['setup'],
            // T40: run the member-fixture RBAC specs authenticated alongside matrix-options.
            // ssd-workbench added: it navigates to the auth-gated /matrix-options route and
            // was previously excluded here, so its authenticated assertions never ran anywhere
            // (unauth chromium/firefox/webkit projects hit the /login bounce and test.skip).
            // matrix-options-phone-layout added (D3, 2026-08-15): the phone-viewport
            // Calculator regression guard also needs auth, same as matrix-options itself.
            testMatch: /(matrix-options(-phone-layout)?|mo-map-access|mo-publish-rbac|ssd-workbench)\.spec\.ts/,
          },
        ]
      : []),
    ...(runAdminE2E
      ? [
          {
            name: 'chromium-admin-auth',
            use: { ...devices['Desktop Chrome'], storageState: adminAuthState },
            dependencies: ['setup-admin'],
            testMatch: /admin-tier-rbac\.spec\.ts/,
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

