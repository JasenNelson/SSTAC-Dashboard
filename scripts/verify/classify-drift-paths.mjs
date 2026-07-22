#!/usr/bin/env node
// classify-drift-paths.mjs -- classify a "production is behind main" drift as DOCS_ONLY vs
// APP_AFFECTING for the prod-health check (Top-50 row 2b docs-only-drift fix).
//
// Why: Vercel's deploy ignore policy (vercel.json `ignoreCommand`) SKIPS deploying commits
// whose changes are entirely docs/scripts/supabase/e2e/*.md. So production legitimately lags
// main whenever every intervening commit was one of those -- that is EXPECTED, not a pending
// app deploy, and prod-health.yml should not hard-fail on it. This classifier decides, from
// the set of paths changed between the deployed SHA and the main tip, whether ALL of them are
// deploy-ignored (docs-only lag -> GREEN) or at least one is app/runtime-affecting (a real
// deploy is pending -> the caller fails).
//
// The ignore rules MIRROR vercel.json's ignoreCommand pathspec, which today is:
//   git diff --quiet HEAD^ HEAD -- ':!*.md' ':!docs/' ':!supabase/' ':!scripts/' ':!e2e/'
// A drift-detection test (classify-drift-paths.test.mjs) reads vercel.json and asserts the
// rule tokens below still match that pathspec, so the two cannot silently diverge.
//
// Usage: node scripts/verify/classify-drift-paths.mjs <fromSHA> <toSHA>
//   fromSHA = the SHA production is deployed at; toSHA = the main tip (or a ref name).
// Exit codes:
//   0 = DOCS_ONLY   -- every changed path is deploy-ignored; no production deploy was expected.
//   1 = APP_AFFECTING -- at least one deploy-worthy path changed; a production deploy is pending.
//   2 = UNDETERMINED  -- missing args / git error / empty diff. The caller MUST fail safe
//                        (treat as app-affecting), never green, when it cannot be determined.

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Single source of truth for the Vercel deploy-ignore pathspec. Each entry pairs the exact
// vercel.json pathspec token with the equivalent path matcher. The token is asserted against
// vercel.json by the drift-detection test; the matcher reproduces git's pathspec semantics for
// that token (git pathspec `*.md` matches `.md` at any depth; `docs/` etc. match a subtree).
export const VERCEL_IGNORE_RULES = [
  [':!*.md', (p) => p.endsWith('.md')],
  [':!docs/', (p) => p.startsWith('docs/')],
  [':!supabase/', (p) => p.startsWith('supabase/')],
  [':!scripts/', (p) => p.startsWith('scripts/')],
  [':!e2e/', (p) => p.startsWith('e2e/')],
];

// True iff `path` is ignored by Vercel's deploy policy (a change to it does NOT trigger a
// production deploy).
export function isDeployIgnored(path) {
  // Match the RAW path -- do NOT trim. git's pathspec matches byte-exact paths, so a path with
  // leading/trailing whitespace (e.g. ` scripts/foo.ts` or `src/foo.md `) is NOT under scripts/
  // and does NOT end in .md -> it is deploy-worthy. Trimming would collapse it onto an ignored
  // path and could false-green app-affecting drift. An empty string is treated as not-ignored
  // (deploy-worthy), the safe direction.
  const p = String(path ?? '');
  if (p.length === 0) return false;
  return VERCEL_IGNORE_RULES.some(([, match]) => match(p));
}

// Classify a list of changed paths. Returns { docsOnly, deployWorthy }. `docsOnly` is true
// ONLY when there is at least one changed path AND every one is deploy-ignored. An empty list
// returns docsOnly:false -- a docs-only lag cannot be proven from no changes, so callers fail safe.
export function classifyDrift(changedPaths) {
  // Keep RAW paths -- coerce to string and drop only empty entries (the trailing NUL-split
  // sentinel). Do NOT trim: a whitespace-padded path is a distinct, deploy-worthy path under
  // git's pathspec, and normalizing it could false-green app-affecting drift (see isDeployIgnored).
  const paths = (changedPaths ?? []).map((p) => String(p)).filter((p) => p.length > 0);
  if (paths.length === 0) {
    return { docsOnly: false, deployWorthy: [] };
  }
  const deployWorthy = paths.filter((p) => !isDeployIgnored(p));
  return { docsOnly: deployWorthy.length === 0, deployWorthy };
}

function changedPathsBetween(fromSha, toSha) {
  // core.quotePath=false + -z emit RAW, NUL-separated paths. Without them, git octal-escapes
  // and double-quotes any path with non-ASCII/control bytes (e.g. `"docs/caf\303\251.md"`),
  // which the prefix/suffix matchers would then treat as deploy-worthy and mis-flag a docs-only
  // merge as app-affecting. NUL-splitting also survives paths that contain newlines.
  // --no-renames is REQUIRED for correctness, not cosmetics. With git's default rename detection,
  // `git diff --name-only` reports only the NEW path of a rename, so an app->docs rename (e.g.
  // `src/foo.ts` -> `docs/foo.ts`) would surface only `docs/foo.ts` (ignored) and be false-greened.
  // But Vercel's ignoreCommand (`git diff --quiet -- ':!docs/' ...`) is NOT rename-aware: it sees the
  // change to the non-excluded `src/` source and DEPLOYS (verified: exit 1). --no-renames decomposes
  // the rename into delete-old + add-new so the deploy-worthy source path is matched, mirroring Vercel.
  const out = execFileSync(
    'git',
    ['-c', 'core.quotePath=false', 'diff', '--name-only', '--no-renames', '-z', fromSha, toSha],
    { encoding: 'utf8' },
  );
  return out.split('\0').filter(Boolean);
}

function main() {
  const fromSha = String(process.argv[2] || '').trim();
  const toSha = String(process.argv[3] || '').trim();
  if (!fromSha || !toSha) {
    console.error('UNDETERMINED: usage: classify-drift-paths.mjs <fromSHA> <toSHA>');
    process.exitCode = 2;
    return;
  }

  let paths;
  try {
    paths = changedPathsBetween(fromSha, toSha);
  } catch (err) {
    console.error(
      `UNDETERMINED: git diff ${fromSha}..${toSha} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exitCode = 2;
    return;
  }

  if (paths.length === 0) {
    // Equal SHAs are handled upstream as ALIGNED; an empty range here is unexpected. Cannot
    // prove a docs-only lag from nothing -> fail safe.
    console.error(`UNDETERMINED: no changed paths between ${fromSha} and ${toSha}.`);
    process.exitCode = 2;
    return;
  }

  const { docsOnly, deployWorthy } = classifyDrift(paths);
  if (docsOnly) {
    console.log(
      `DOCS_ONLY: all ${paths.length} changed path(s) between production and main are Vercel-ignored; no production deploy was expected.`,
    );
    process.exitCode = 0;
    return;
  }
  console.error(
    `APP_AFFECTING: ${deployWorthy.length} deploy-worthy path(s) changed (e.g. ${deployWorthy.slice(0, 5).join(', ')}); a production deploy is pending.`,
  );
  process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
