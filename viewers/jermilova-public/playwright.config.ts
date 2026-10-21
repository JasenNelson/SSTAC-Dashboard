import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';

// Parity run: the anonymous Jermilova viewer vs the authenticated original /bn-rrm page.
//
// The runtime runbook starts the viewer preview server itself (owned process custody).
// The original's dev server is either already running or, with PARITY_START_ORIGINAL=true,
// started by Playwright below. URLs are passed in:
//   PARITY_VIEWER_URL    e.g. http://127.0.0.1:<port>   (anonymous viewer)
//   PARITY_ORIGINAL_URL  e.g. http://127.0.0.1:<port>   (root app dev server)
//   PARITY_EVIDENCE_DIR  absolute folder for screenshots, summaries and test output
//
// Credentials use ONLY the repository's established mechanism: @next/env loadEnvConfig
// (env files are read in place, never copied), E2E_AUTH_ENABLED=true plus
// E2E_TEST_EMAIL/E2E_TEST_PASSWORD, and the root e2e/global.setup.ts project, which writes
// the established storageState e2e/.auth/user.json. PARITY_ENV_DIR names the directory
// whose env files are loaded (default: this repository root).
const viewerRoot = __dirname;
const repoRoot = path.resolve(viewerRoot, '../..');
loadEnvConfig(process.env.PARITY_ENV_DIR ?? repoRoot);

// Never write Playwright's failure page snapshot (error-context.md): it copies every
// input's value, including the e2e password field on a failed sign-in. Set here so the
// runner and every worker (both load this config) inherit it.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

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

// Optional: let Playwright start the ORIGINAL (root app) dev server from this worktree,
// as the root playwright.config.ts does, so it inherits the env loaded above in memory
// (Supabase settings included) without any env file being copied. On Windows Playwright
// stops it with `taskkill /T /F`; the runbook still verifies afterwards that no process
// references this worktree's dev server and that the port is released.
const startOriginal = process.env.PARITY_START_ORIGINAL === 'true';
let originalPort = 0;
if (startOriginal) {
  // Unprivileged ports only (1024-65535; the runbook uses 3131). URL parsing drops a
  // default port such as :80, which therefore fails closed here by design.
  const parsed = originalBaseURL ? new URL(originalBaseURL) : null;
  originalPort = parsed && /^[0-9]+$/.test(parsed.port) ? Number(parsed.port) : 0;
  if (
    !parsed ||
    parsed.protocol !== 'http:' ||
    parsed.hostname !== '127.0.0.1' ||
    parsed.pathname !== '/' ||
    originalPort < 1024 ||
    originalPort > 65535
  ) {
    throw new Error('PARITY_START_ORIGINAL needs PARITY_ORIGINAL_URL of the form http://127.0.0.1:<port 1024-65535>.');
  }
  // Never start the original without a consumer: it exists only for the auth parity run.
  if (!authEnabled || process.env.PARITY_REQUIRE_ORIGINAL !== 'true') {
    throw new Error('PARITY_START_ORIGINAL requires PARITY_REQUIRE_ORIGINAL=true and the established E2E auth variables.');
  }
}

export default defineConfig({
  testDir: './e2e',
  // Test output goes to the evidence folder, never into the repository.
  outputDir: path.join(process.env.PARITY_EVIDENCE_DIR, 'test-output'),
  // Whole-run ceiling, below the runbook's outer bound, so Playwright's own teardown
  // (which stops the webServer tree) runs before any outer kill could orphan it.
  globalTimeout: 1_200_000,
  webServer: startOriginal
    ? {
        command: `"${process.execPath}" "${path.join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next')}" dev --hostname 127.0.0.1 --port ${originalPort}`,
        cwd: repoRoot,
        // Probing /login also warms the page the auth setup visits first.
        url: `${originalBaseURL!.replace(/\/$/, '')}/login`,
        reuseExistingServer: false,
        timeout: 240_000,
        stdout: 'ignore',
        stderr: 'pipe',
        // Same safety pin as the root playwright.config.ts webServer.
        env: { ...(process.env as Record<string, string>), AGENTIC_OS_SPAWN_STUB: 'true' },
      }
    : undefined,
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
            // `next dev` compiles /bn-rrm and each dynamic tab chunk on first use.
            timeout: 360_000,
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
