import { spawnSync } from 'node:child_process';
import path from 'node:path';
import pkg from '@next/env';
const { loadEnvConfig } = pkg;

loadEnvConfig(process.cwd());

const baseEnv = { ...process.env };
const playwrightCli = path.resolve(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js');

const probe = spawnSync(process.execPath, [playwrightCli, '--version'], {
  cwd: process.cwd(),
  env: baseEnv,
  encoding: 'utf8',
});
if (probe.error || probe.status !== 0) {
  throw new Error(`Playwright CLI probe failed: ${probe.error?.message ?? probe.stderr ?? `status ${probe.status}`}`);
}
console.log(`Playwright CLI probe: ${probe.stdout.trim()}`);

if (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD) {
  throw new Error('REAL_V16_E2E_BLOCKED: E2E_TEST_EMAIL and E2E_TEST_PASSWORD are required for authenticated Chromium acceptance.');
}

function run(label, args, overrides) {
  const result = spawnSync(process.execPath, [playwrightCli, 'test', ...args], {
    cwd: process.cwd(),
    env: { ...baseEnv, ...overrides },
    stdio: 'inherit',
  });
  if (result.error) throw new Error(`${label} failed to start: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('flags-off regression', [], {
  MATRIX_OPTIONS_PAPER_WORKSPACE: 'false',
  MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION: 'false',
});

run('real V16 authenticated acceptance', [
  'e2e/matrix-options-paper.spec.ts',
  '--project=chromium-auth',
  '--grep', 'authenticated real release',
], {
  MATRIX_OPTIONS_PAPER_WORKSPACE: 'true',
  MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION: 'true',
  E2E_AUTH_ENABLED: 'true',
});
