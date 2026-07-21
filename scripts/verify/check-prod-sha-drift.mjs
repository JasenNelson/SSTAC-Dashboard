#!/usr/bin/env node
// check-prod-sha-drift.mjs -- READ-ONLY production deploy-health check (Top-50 row 2).
//
// Detects whether the SHA the production deployment was built from has drifted
// from `origin/main`. It performs NO writes, NO deploys, and touches NO secrets:
// it GETs the app's own /api/health endpoint and compares the short SHA it
// reports to `git rev-parse --short origin/main`.
//
// Usage:
//   node scripts/verify/check-prod-sha-drift.mjs <prod-url> [expected-sha]
//   PROD_URL=https://<app> node scripts/verify/check-prod-sha-drift.mjs
//
//   <prod-url>      base URL of the production deployment (or set PROD_URL).
//   [expected-sha]  short SHA to compare against (default: origin/main short SHA).
//
// Exit codes: 0 = ALIGNED, 1 = DRIFT, 2 = UNREACHABLE / usage / probe error.
//
// The comparison + exit-code logic is exported (`isAligned`, `evaluateDrift`) so it
// can be unit-tested without a live network or git; the CLI path (auto-run at the
// bottom) is behaviorally unchanged.
//
// Wiring this into CI or an alerting cadence is intentionally NOT done here -- that
// is the owner decision (row 2b). This script is the check only.

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function shortOriginMain() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'origin/main'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
}

// True iff `deployed` starts with the FULL `expected` abbreviation (case-insensitive).
// `expected` is Git's own disambiguating abbreviation (>= 7 chars, longer if 7 is
// ambiguous); requiring the deployed SHA to start with the WHOLE abbreviation -- never
// a shorter, ambiguous prefix -- is what prevents a commit that only shares the first
// 7 chars from false-matching. The route emits the full 40-char SHA, so this holds.
export function isAligned(deployed, expected) {
  const dep = String(deployed ?? '').toLowerCase();
  const exp = String(expected ?? '').toLowerCase();
  return exp.length > 0 && dep.length >= exp.length && dep.slice(0, exp.length) === exp;
}

// Pure decision function: given the resolved inputs and a fetch implementation,
// returns { code, stream: 'out' | 'err', message } without touching process state.
// `fetchFn` defaults to the global fetch; tests pass a stub.
export async function evaluateDrift({ prodUrl, expected, fetchFn = fetch }) {
  const url = String(prodUrl ?? '').replace(/\/+$/, '');
  const exp = String(expected ?? '').trim();

  if (!url) {
    return { code: 2, stream: 'err', message: 'UNREACHABLE: no prod URL (pass as arg 1 or set PROD_URL).' };
  }
  if (!exp) {
    return { code: 2, stream: 'err', message: 'UNREACHABLE: no expected SHA (pass as arg 2 or ensure origin/main is fetched).' };
  }

  const healthUrl = `${url}/api/health`;
  let payload;
  try {
    const res = await fetchFn(healthUrl, { headers: { 'cache-control': 'no-cache' } });
    if (!res.ok) {
      return { code: 2, stream: 'err', message: `UNREACHABLE: ${healthUrl} returned HTTP ${res.status}.` };
    }
    payload = await res.json();
  } catch (err) {
    return {
      code: 2,
      stream: 'err',
      message: `UNREACHABLE: failed to GET ${healthUrl}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const deployed = String(payload?.sha ?? '').trim();
  if (!deployed || deployed === 'unknown') {
    return {
      code: 2,
      stream: 'err',
      message: `UNREACHABLE: /api/health did not report a build SHA (got ${JSON.stringify(payload?.sha)}).`,
    };
  }

  if (isAligned(deployed, exp)) {
    return {
      code: 0,
      stream: 'out',
      message: `ALIGNED: production ${deployed} matches origin/main ${exp} (env=${payload?.env ?? 'unknown'}).`,
    };
  }
  return {
    code: 1,
    stream: 'err',
    message: `DRIFT: production is on ${deployed} but origin/main is ${exp} (env=${payload?.env ?? 'unknown'}). A production deploy of the current tip is pending (owner action).`,
  };
}

async function main() {
  const prodUrl = process.argv[2] || process.env.PROD_URL || '';
  const expected = process.argv[3] || shortOriginMain() || '';
  const { code, stream, message } = await evaluateDrift({ prodUrl, expected });
  if (stream === 'out') {
    console.log(message);
  } else {
    console.error(message);
  }
  // Set the exit code and let Node drain and exit naturally rather than calling
  // process.exit(): a synchronous process.exit() while undici's keepalive socket from
  // the fetch above is still open aborts with a libuv assertion on Windows
  // (UV_HANDLE_CLOSING, src\win\async.c). undici unrefs its idle keepalive sockets, so
  // the process exits promptly with this code on every platform.
  process.exitCode = code;
}

// Auto-run only as a CLI (node scripts/verify/check-prod-sha-drift.mjs ...), NOT when
// imported by a test. Compare as file URLs (robust to win32 drive-letter casing) rather
// than raw path strings -- the standard ESM "is this the entry module?" check.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
