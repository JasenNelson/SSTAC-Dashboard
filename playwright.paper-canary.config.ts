import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { defineConfig, devices } from '@playwright/test';

// Production canary for the Matrix Options paper review workflow (plan R4 s7).
// NEVER part of the default or paper e2e runs (those configs testIgnore the spec).
// Package manifest the owner approves: e2e/canary/CANARY_PACKAGE.md.
//
// Hard rules encoded here:
//   - exact HTTPS production baseURL, NO webServer (nothing is started locally);
//   - only the canary spec matches; one worker, no retries, serial;
//   - NO trace/video (they would capture credentials in request bodies); a failure
//     screenshot may be written, only under the private gitignored .tmp/ tree;
//   - no setup project: the spec signs in each identity itself in a FRESH browser context.
// Load-time guard: runs when Playwright loads this config, before it resolves or cleans any output
// directory. cwd and this file's own directory must both equal the approved worktree, and no output
// override may be on the command line (Playwright has only the long flag --output; it has no short
// alias, and any argument beginning with --output is refused, as is a bare -o).
const APPROVED_ROOT = 'C:' + String.fromCharCode(92) + 'Projects' + String.fromCharCode(92) + 'SSTAC-Dashboard-worktrees' + String.fromCharCode(92) + 'matrix-v0991-review-activation';
const normRoot = (p: string): string => {
  const n = path.resolve(p).split(String.fromCharCode(92)).join('/').replace(/[/]+$/, '');
  return process.platform === 'win32' ? n.toLowerCase() : n;
};
if (normRoot(process.cwd()) !== normRoot(APPROVED_ROOT)) {
  throw new Error('Canary config refused: the working directory is not the approved worktree.');
}
if (normRoot(__dirname) !== normRoot(APPROVED_ROOT)) {
  throw new Error('Canary config refused: this config file is not located in the approved worktree.');
}
if (process.argv.some((arg) => arg === '-o' || arg.startsWith('--output'))) {
  throw new Error('Canary config refused: an output override was supplied on the command line.');
}

// Reparse-point guard: every existing path component from the approved root down to the artifact
// tree must be a real directory (no symlink / junction; on Windows lstat reports a junction as a
// symbolic link) and the real path must equal the expected path (case-insensitive on Windows).
// Nothing is created here; the spec re-runs the same check before and after creating directories.
const sameReal = (a: string, b: string): boolean => normRoot(a) === normRoot(b);
const assertNoReparse = (rootDir: string, targetDir: string): void => {
  const root = path.resolve(rootDir);
  const target = path.resolve(targetDir);
  const rel = path.relative(root, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Canary config refused: an artifact path is outside the approved root.');
  const steps = [root, ...rel.split(path.sep).filter((seg) => seg !== '').map((seg, i, all) => path.join(root, ...all.slice(0, i + 1)))];
  let last = '';
  for (const cur of steps) {
    let st: fs.Stats;
    try { st = fs.lstatSync(cur); } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') break;
      throw new Error('Canary config refused: an artifact path component could not be inspected.');
    }
    if (st.isSymbolicLink()) throw new Error('Canary config refused: an artifact path component is a symlink or junction.');
    if (!st.isDirectory()) throw new Error('Canary config refused: an artifact path component is not a directory.');
    if (!sameReal(fs.realpathSync(cur), cur)) throw new Error('Canary config refused: an artifact path component resolves elsewhere (reparse point).');
    last = cur;
  }
  if (last !== '' && last === target && !sameReal(fs.realpathSync(target), target)) throw new Error('Canary config refused: the artifact directory resolves elsewhere.');
};
assertNoReparse(APPROVED_ROOT, path.join(APPROVED_ROOT, '.tmp', 'canary-output', 'playwright'));

// Single-shot guard (ALLOWLIST): the ONE allowed launch is
//   npx playwright test --config playwright.paper-canary.config.ts [--list]
// In the runner process (argv[1] is the Playwright CLI) the arguments after the `test` subcommand must be
// exactly: `--config`/`-c` followed by a path resolving to THIS file, or `--config=<that path>`, plus an
// optional `--list`. Every other flag, flag value or positional (test file filters, --max-failures, -x,
// --headed, --reporter, --retries, ...) throws at load. Worker processes (forked from Playwright's
// common/process.js, which re-load this config with no CLI flags) are not the runner and are skipped.
// Worker detection uses TRUSTED process state only (never an environment variable): argv[1] must be
// Playwright's own worker entry inside a node_modules/playwright* package AND this process must have an
// IPC channel to its parent (process.send is a function). The runner (argv[1] = Playwright cli.js) fails both.
const argv1 = normRoot(process.argv[1] ?? '');
const isWorker = /[/]node_modules[/]playwright(-core)?[/]lib[/]common[/]process[.]js$/.test(argv1) && typeof process.send === 'function';
if (!isWorker) {
  // Environment guard (runner only). Playwright reads many env knobs that change what a run does: TEST_WORKER_INDEX /
  // TEST_PARALLEL_INDEX (worker identity), PW_* / PWTEST_* / PWDEBUG* / PLAYWRIGHT_* (watch mode, reporter override
  // PW_TEST_REPORTER, reporter output dirs such as PLAYWRIGHT_HTML_OUTPUT_DIR, debug, TTY and timeout switches),
  // DEBUG (pw:api logging would print request data incl. credentials), CI (flips reporter/forbidOnly/html defaults and
  // is refused rather than reasoned about), FORCE_COLOR (output mode). Any such name is refused; values are never shown.
  // Only PLAYWRIGHT_BROWSERS_PATH (browser binary location, no run behaviour) is allowed.
  const ALLOWED_ENV = new Set(['PLAYWRIGHT_BROWSERS_PATH']);
  const refused = Object.keys(process.env)
    .filter((k) => /^(PW_|PWTEST_|PWDEBUG|PWMCP|PLAYWRIGHT_|TEST_WORKER_INDEX$|TEST_PARALLEL_INDEX$|DEBUG$|CI$|FORCE_COLOR$)/i.test(k) && !ALLOWED_ENV.has(k.toUpperCase()))
    .sort();
  if (refused.length > 0) {
    throw new Error('Canary config refused: forbidden environment variable name(s) set in the launch shell: ' + refused.join(', ') + ' (values not shown). Unset them and relaunch.');
  }
  const bad = (what: string): never => { throw new Error('Canary config refused: ' + what + ' is not allowed (only --config <this file> and --list are accepted).'); };
  const thisFile = path.resolve(__filename);
  const isThisConfig = (v: string | undefined): boolean => v !== undefined && v !== '' && normRoot(path.resolve(process.cwd(), v)) === normRoot(thisFile);
  const args = process.argv.slice(2);
  if (args[0] !== 'test') bad('subcommand ' + String(args[0]));
  const rest = args.slice(1);
  let sawConfig = false;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--list') continue;
    if (a === '--config' || a === '-c') {
      if (sawConfig || !isThisConfig(rest[i + 1])) bad(a + ' value');
      sawConfig = true; i++; continue;
    }
    if (a.startsWith('--config=')) {
      if (sawConfig || !isThisConfig(a.slice('--config='.length))) bad('--config value');
      sawConfig = true; continue;
    }
    bad('argument ' + a);
  }
  if (!sawConfig) bad('a missing --config');

  // Config-load gates below run BEFORE Playwright resolves or cleans outputDir and before any request.
  const listOnly = rest.includes('--list');
  const outRoot = path.join(APPROVED_ROOT, '.tmp', 'canary-output');
  const RUN_ID_FIXED = 'canary-20261014-2849';

  // (1) Single-run refusal at config load: a refused rerun must not reach Playwright's outputDir cleanup,
  // which would delete the first run's failure screenshots.
  if (!listOnly) {
    for (const f of [path.join(outRoot, RUN_ID_FIXED + '.started'), path.join(outRoot, 'results-' + RUN_ID_FIXED + '.json')]) {
      if (fs.existsSync(f)) {
        throw new Error('Canary config refused: ' + RUN_ID_FIXED + ' has already been started (marker or results file exists). The canary runs once; a new run needs a new approved package. Nothing was touched.');
      }
    }
  }

  // (2) Byte binding: every scoped local file must be byte-identical to the approved deployed commit
  // (CANARY_EXPECTED_SHA = the merge sha the package is approved with). A real run requires the env value;
  // --list without it skips the binding check (a dry listing makes no request and writes nothing).
  const expectedSha = process.env.CANARY_EXPECTED_SHA ?? '';
  if (!listOnly && !/^[0-9a-f]{40}$/.test(expectedSha)) {
    throw new Error('Canary config refused: CANARY_EXPECTED_SHA must be set to the 40-hex approved merge sha before a real run (byte binding needs it).');
  }
  if (expectedSha !== '') {
    if (!/^[0-9a-f]{40}$/.test(expectedSha)) throw new Error('Canary config refused: CANARY_EXPECTED_SHA must be a 40-hex commit sha.');
    const git = (gitArgs: string[]): string => execFileSync('git', gitArgs, { cwd: APPROVED_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    try { git(['cat-file', '-e', expectedSha + '^{commit}']); } catch {
      throw new Error('Canary config refused: the approved commit is not present locally. Run `git fetch origin` and relaunch.');
    }
    // Scoped paths: the canary spec, this config, the package, and every src/ module the spec imports
    // transitively (enumerated; the contracts directory holds the JSON files the modules load).
    const scopedFiles = [
      'e2e/matrix-options-paper-canary.spec.ts',
      'playwright.paper-canary.config.ts',
      'e2e/canary/CANARY_PACKAGE.md',
      'src/lib/matrix-options/cohort-contract.ts',
      'src/lib/matrix-options/reviewer-guide.ts',
      'src/lib/matrix-options/paper/contracts.ts',
      'src/lib/matrix-options/paper/releases.ts',
      'src/lib/matrix-options/paper/contracts/cohorts-v0.9.88-r4-presentation-001.json',
      'src/lib/matrix-options/paper/contracts/cohorts-v0.9.91-run109-001.json',
      'src/lib/matrix-options/paper/contracts/cohorts-v1.json',
      'src/lib/matrix-options/paper/contracts/reviewer-guide-v0.9.88-r4-presentation-001.json',
      'src/lib/matrix-options/paper/contracts/reviewer-guide-v0.9.91-run109-001.json',
      'src/lib/matrix-options/paper/contracts/reviewer-guide-v1.json',
    ];
    const scopedPaths = [...scopedFiles, 'src/lib/matrix-options/paper'];
    const unbound = (what: string): never => { throw new Error('Canary config refused: ' + what + ' differs from the approved commit ' + expectedSha + '. Check out a commit whose scoped paths equal it (clean tree) and relaunch.'); };
    try { git(['diff', '--quiet', expectedSha, '--', ...scopedPaths]); } catch { unbound('a scoped file (git diff)'); }
    if (git(['status', '--porcelain', '--untracked-files=all', '--ignored', '--', ...scopedPaths]).trim() !== '') unbound('a scoped path (git status: modified, staged, untracked or ignored)');
    for (const f of scopedFiles) {
      let committed = '';
      let local = '';
      try { committed = git(['rev-parse', expectedSha + ':' + f]).trim(); local = git(['hash-object', '--', f]).trim(); } catch { unbound(f + ' (missing in the commit or locally)'); }
      if (committed === '' || committed !== local) unbound(f);
    }
  }
}

export default defineConfig({
  testDir: './e2e',
  testMatch: /matrix-options-paper-canary\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  repeatEach: 1,
  // Reporter pinned; any reporter env override is refused by the environment guard above.
  reporter: [['list']],
  outputDir: path.join(__dirname, '.tmp', 'canary-output', 'playwright'),
  timeout: 5 * 60 * 1000,
  use: {
    baseURL: 'https://sstac-dashboard.vercel.app',
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'canary-chromium',
      repeatEach: 1,
      retries: 0,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
