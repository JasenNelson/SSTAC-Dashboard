import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';

// Parity run: the anonymous Jermilova viewer vs the authenticated original /bn-rrm page.
//
// No webServer: the runtime runbook starts the viewer preview server and the original's
// dev server itself, with owned process custody, and passes their URLs in:
//   PARITY_VIEWER_URL    e.g. http://127.0.0.1:<port>   (anonymous viewer)
//   PARITY_ORIGINAL_URL  e.g. http://127.0.0.1:<port>   (root app dev server)
//   PARITY_EVIDENCE_DIR  absolute folder for screenshots + summaries
//
// Credentials use ONLY the repository's established mechanism: @next/env loadEnvConfig
// (env files are read in place, never copied), E2E_AUTH_ENABLED=true plus
// E2E_TEST_EMAIL/E2E_TEST_PASSWORD, and the root e2e/global.setup.ts project, which writes
// the established storageState e2e/.auth/user.json. PARITY_ENV_DIR names the directory
// whose env files are loaded (default: this repository root).
const viewerRoot = __dirname;
const repoRoot = path.resolve(viewerRoot, '../..');
loadEnvConfig(process.env.PARITY_ENV_DIR ?? repoRoot);

const viewerBaseURL = process.env.PARITY_VIEWER_URL;
const originalBaseURL = process.env.PARITY_ORIGINAL_URL;
const userAuthState = path.join(repoRoot, 'e2e', '.auth', 'user.json');
const authEnabled =
  process.env.E2E_AUTH_ENABLED === 'true' && Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);

if (!viewerBaseURL || !process.env.PARITY_EVIDENCE_DIR) {
  throw new Error('PARITY_VIEWER_URL and PARITY_EVIDENCE_DIR are required.');
}
// The parity run must compare against the original; a silently missing auth project
// would report green having compared nothing.
if (process.env.PARITY_REQUIRE_ORIGINAL === 'true' && (!authEnabled || !originalBaseURL)) {
  throw new Error('PARITY_REQUIRE_ORIGINAL is set but the established E2E auth variables or PARITY_ORIGINAL_URL are missing.');
}

export default defineConfig({
  testDir: './e2e',
  // Never write an HTML report or trace: the setup project's step titles hold credentials.
  reporter: [['list']],
  timeout: 180_000,
  expect: { timeout: 30_000 },
  workers: 1,
  fullyParallel: false,
  use: { trace: 'off', screenshot: 'off', video: 'off' },
  projects: [
    {
      name: 'viewer-anon',
      testMatch: /parity\.spec\.ts/,
      grep: /@viewer/,
      use: { ...devices['Desktop Chrome'], baseURL: viewerBaseURL, storageState: { cookies: [], origins: [] } },
    },
    ...(authEnabled && originalBaseURL
      ? [
          {
            name: 'setup',
            testDir: path.join(repoRoot, 'e2e'),
            testMatch: /global\.setup\.ts/,
            use: { baseURL: originalBaseURL, trace: 'off' as const },
          },
          {
            name: 'original-auth',
            testMatch: /parity\.spec\.ts/,
            grep: /@original/,
            dependencies: ['setup'],
            use: { ...devices['Desktop Chrome'], baseURL: originalBaseURL, storageState: userAuthState },
          },
          {
            name: 'compare',
            testMatch: /parity\.spec\.ts/,
            grep: /@compare/,
            dependencies: ['viewer-anon', 'original-auth'],
          },
        ]
      : []),
  ],
});
