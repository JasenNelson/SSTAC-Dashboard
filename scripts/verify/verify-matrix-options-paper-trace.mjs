// Proves the built Next.js server traces (.nft.json) for every route that reads the
// authenticated revised Matrix Options paper at runtime contain BOTH the paper and its
// sha256 sidecar. Vercel packages a serverless function from these traces, so a route
// whose trace omits either file fails closed in production (MATRIX-TWG-PROD-HOTFIX-001:
// next.config.ts traced an obsolete paper after the loader moved to candidate/paper/).
//
// Usage (after a build): node scripts/verify/verify-matrix-options-paper-trace.mjs [--next-dir .next]
// Exit 0 = every required trace contains both files; exit 1 = failure (details on stderr).
// Plain ASCII.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Server entries (relative to <next-dir>/server/app) whose route code can reach the
// runtime fs reads in src/lib/matrix-options/revised-paper.ts (loadRevisedPaper directly,
// or via loadRevisedPaperStructure / download-manifest-server / paper-admin-guard). The
// first three are unconditional in production; the paper/publication/sections entries are
// behind the paper review-navigation flags; the last two are the admin review surfaces.
export const REQUIRED_TRACE_ENTRIES = [
  '(dashboard)/matrix-options/page.js.nft.json',
  'api/matrix-options/paper/downloads/route.js.nft.json',
  'api/matrix-options/paper/downloads/[packageId]/route.js.nft.json',
  '(dashboard)/matrix-options/paper/v/[documentVersion]/page.js.nft.json',
  '(dashboard)/matrix-options/paper/v/[documentVersion]/[stableSectionId]/page.js.nft.json',
  '(dashboard)/matrix-options/paper/publication/v/[documentVersion]/page.js.nft.json',
  '(dashboard)/matrix-options/paper/publication/v/[documentVersion]/nodes/[canonicalNodeId]/page.js.nft.json',
  '(dashboard)/matrix-options/paper/publication/v/[documentVersion]/questions/[questionId]/page.js.nft.json',
  'api/matrix-options/paper/v/[documentVersion]/sections/[sectionAnchor]/route.js.nft.json',
  '(dashboard)/admin/matrix-options-paper-reviews/page.js.nft.json',
  'api/matrix-options/paper/reviews/export/route.js.nft.json',
];

const LOADER_SOURCE = path.join('src', 'lib', 'matrix-options', 'revised-paper.ts');

// Derive the expected repo-relative paths from the loader source itself, so a future
// paper rename that forgets next.config.ts fails this check instead of silently passing.
export function expectedPaperFiles(repoRoot = REPO_ROOT) {
  const source = fs.readFileSync(path.join(repoRoot, LOADER_SOURCE), 'utf8');
  const filename = /export const REVISED_PAPER_FILENAME =\s*'([^']+)';/.exec(source)?.[1];
  if (!filename) throw new Error(`REVISED_PAPER_FILENAME literal not found in ${LOADER_SOURCE}`);
  const relTemplate = /export const REVISED_PAPER_RELATIVE_PATH =\s*`([^`$]*)\$\{REVISED_PAPER_FILENAME\}`;/.exec(source)?.[1];
  const sidecarTemplate = /export const REVISED_PAPER_SIDECAR_RELATIVE_PATH =\s*`([^`$]*)\$\{REVISED_PAPER_SIDECAR_FILENAME\}`;/.exec(source)?.[1];
  if (relTemplate === undefined || sidecarTemplate === undefined) {
    throw new Error(`REVISED_PAPER_(SIDECAR_)RELATIVE_PATH template not found in ${LOADER_SOURCE}`);
  }
  return [`${relTemplate}${filename}`, `${sidecarTemplate}${filename}.sha256`];
}

// Case-fold only on Windows (case-insensitive FS); on Linux/Vercel a case-only
// mismatch is a real missing file and must fail.
function normalize(p) {
  const resolved = path.resolve(p).replaceAll('\\', '/');
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export function checkTraces({ repoRoot = REPO_ROOT, nextDir = path.join(repoRoot, '.next'), entries = REQUIRED_TRACE_ENTRIES, expected = expectedPaperFiles(repoRoot) } = {}) {
  const failures = [];
  const appDir = path.join(nextDir, 'server', 'app');
  for (const rel of expected) {
    if (!fs.existsSync(path.join(repoRoot, rel))) failures.push(`expected file missing on disk: ${rel}`);
  }
  const wanted = expected.map((rel) => [rel, normalize(path.join(repoRoot, rel))]);
  let checked = 0;
  for (const entry of entries) {
    const nftPath = path.join(appDir, ...entry.split('/'));
    if (!fs.existsSync(nftPath)) {
      failures.push(`trace missing: ${entry}`);
      continue;
    }
    let files;
    try {
      files = JSON.parse(fs.readFileSync(nftPath, 'utf8')).files;
    } catch (error) {
      failures.push(`trace unreadable: ${entry} (${error instanceof Error ? error.message : 'unknown'})`);
      continue;
    }
    if (!Array.isArray(files)) {
      failures.push(`trace has no files array: ${entry}`);
      continue;
    }
    const traced = new Set(files.map((f) => normalize(path.join(path.dirname(nftPath), f))));
    for (const [rel, abs] of wanted) {
      if (!traced.has(abs)) failures.push(`${entry} does not trace ${rel}`);
    }
    checked += 1;
  }
  return { ok: failures.length === 0, checked, expected, failures };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const i = process.argv.indexOf('--next-dir');
  const nextDir = i > -1 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : path.join(REPO_ROOT, '.next');
  const result = checkTraces({ nextDir });
  if (result.ok) {
    process.stdout.write(`PASS matrix-options paper trace: ${result.checked}/${REQUIRED_TRACE_ENTRIES.length} traces contain ${result.expected.join(' + ')}\n`);
  } else {
    process.stderr.write(`FAIL matrix-options paper trace (${result.failures.length} failure(s)):\n${result.failures.map((f) => `  - ${f}`).join('\n')}\n`);
    process.exitCode = 1;
  }
}
