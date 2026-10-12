// Cross-platform entry point for the e2e gate preflight.
//
// WHY THIS EXISTS
// `pretest:e2e` was pointed straight at gate-preflight.ps1 so the preflight's
// exit code could actually stop a gate (previously nothing invoked the script,
// so it was advisory and got skipped by exactly the sessions that needed it).
// That broke CI: the E2E job runs inside the official Playwright container
// (mcr.microsoft.com/playwright:*-jammy, Linux), which has no PowerShell, so
// `npm run test:e2e` failed at the pre-hook before a single test ran -- the job
// died in ~1m with `npm ci` and the version check both green.
//
// The preflight only ever solved a LOCAL problem: a dev server left holding the
// Playwright port by an earlier session in this same worktree. CI starts from a
// clean container and has no such state, so the correct behaviour there is to
// do nothing at all rather than to emulate the check.
//
// Contract: exit 0 = proceed with e2e. Non-zero = stop, the port is held and the
// run would fail for a reason that has nothing to do with the tests.

import { fileURLToPath } from 'node:url';
import { runPowerShellPortPreflight } from './gate-preflight-programdata.mjs';

const isWindows = process.platform === 'win32';
const isCI = process.env.CI === 'true';

if (isCI || !isWindows) {
  // Not a no-op for convenience -- a no-op because the failure class this guards
  // against cannot occur here. Say so, so a reader of CI logs is not left
  // wondering whether the preflight silently passed or silently did nothing.
  const why = isCI ? 'CI (fresh container, no leftover dev server)' : `platform ${process.platform}`;
  console.log(`gate-preflight: skipped -- ${why}`);
  process.exit(0);
}

// Resolved from this module, not from process.cwd(): under npm the cwd is the
// package root and either form works, but invoked directly from a subdirectory a
// cwd-relative path makes PowerShell report a missing FILE rather than a held
// PORT -- fail-closed, but with a message that sends the reader the wrong way.
const scriptPath = fileURLToPath(new URL('./gate-preflight.ps1', import.meta.url));

// Forward extra args. `npm run gate:preflight -- -Kill` used to work, because the
// script WAS the literal powershell command line and npm appended to it. Dropping
// them silently would have the script print "Re-run with -Kill to free it" and
// then ignore the -Kill the caller just passed.
process.exit(runPowerShellPortPreflight({ scriptPath, args: process.argv.slice(2) }));
