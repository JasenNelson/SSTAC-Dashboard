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
// Wiring this into CI or an alerting cadence is intentionally NOT done here --
// that is the owner decision (row 2b). This script is the check only.

import { execFileSync } from 'node:child_process';

function shortOriginMain() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'origin/main'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
}

async function main() {
  const prodUrl = (process.argv[2] || process.env.PROD_URL || '').replace(/\/+$/, '');
  const expected = (process.argv[3] || shortOriginMain() || '').trim();

  if (!prodUrl) {
    console.error('UNREACHABLE: no prod URL (pass as arg 1 or set PROD_URL).');
    process.exit(2);
  }
  if (!expected) {
    console.error('UNREACHABLE: no expected SHA (pass as arg 2 or ensure origin/main is fetched).');
    process.exit(2);
  }

  const healthUrl = `${prodUrl}/api/health`;
  let payload;
  try {
    const res = await fetch(healthUrl, { headers: { 'cache-control': 'no-cache' } });
    if (!res.ok) {
      console.error(`UNREACHABLE: ${healthUrl} returned HTTP ${res.status}.`);
      process.exit(2);
    }
    payload = await res.json();
  } catch (err) {
    console.error(`UNREACHABLE: failed to GET ${healthUrl}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  }

  const deployed = String(payload?.sha ?? '').trim();
  if (!deployed || deployed === 'unknown') {
    console.error(`UNREACHABLE: /api/health did not report a build SHA (got ${JSON.stringify(payload?.sha)}).`);
    process.exit(2);
  }

  // `expected` is Git's own abbreviation (>= 7 chars, longer if 7 is ambiguous).
  // Require the deployed SHA to START WITH that full disambiguating abbreviation --
  // never cap to a shorter (ambiguous) prefix, or a commit sharing only the first
  // 7 chars could false-match. The route emits the full 40-char SHA, so this holds.
  const dep = deployed.toLowerCase();
  const exp = expected.toLowerCase();
  const aligned = dep.length >= exp.length && dep.slice(0, exp.length) === exp;

  if (aligned) {
    console.log(`ALIGNED: production ${deployed} matches origin/main ${expected} (env=${payload?.env ?? 'unknown'}).`);
    process.exit(0);
  }
  console.error(`DRIFT: production is on ${deployed} but origin/main is ${expected} (env=${payload?.env ?? 'unknown'}). A production deploy of the current tip is pending (owner action).`);
  process.exit(1);
}

main();
