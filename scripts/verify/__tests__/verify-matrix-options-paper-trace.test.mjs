// Guards for verify-matrix-options-paper-trace.mjs (MATRIX-TWG-PROD-HOTFIX-001). Plain ASCII.

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {
  REPO_ROOT,
  REQUIRED_TRACE_ENTRIES,
  checkTraces,
  expectedPaperFiles,
} from '../verify-matrix-options-paper-trace.mjs';

const EXPECTED = expectedPaperFiles(REPO_ROOT);
const tempDirs = [];

function makeNextDir(tracedFilesFor) {
  const nextDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mo-paper-trace-'));
  tempDirs.push(nextDir);
  for (const entry of REQUIRED_TRACE_ENTRIES) {
    const nftPath = path.join(nextDir, 'server', 'app', ...entry.split('/'));
    fs.mkdirSync(path.dirname(nftPath), { recursive: true });
    const files = tracedFilesFor(entry).map((rel) =>
      path.relative(path.dirname(nftPath), path.join(REPO_ROOT, rel)).replaceAll('\\', '/'),
    );
    fs.writeFileSync(nftPath, JSON.stringify({ version: 1, files }));
  }
  return nextDir;
}

afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
});

describe('expectedPaperFiles', () => {
  it('derives the paper and sidecar from the loader constants under candidate/paper/', () => {
    expect(EXPECTED).toHaveLength(2);
    expect(EXPECTED[0]).toMatch(/^candidate\/paper\/BC_Matrix_Options_Paper_.+\.md$/);
    expect(EXPECTED[1]).toBe(`${EXPECTED[0]}.sha256`);
    for (const rel of EXPECTED) expect(fs.existsSync(path.join(REPO_ROOT, rel))).toBe(true);
  });
});

describe('checkTraces', () => {
  it('passes when every required trace contains both files', () => {
    const result = checkTraces({ nextDir: makeNextDir(() => EXPECTED) });
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.checked).toBe(REQUIRED_TRACE_ENTRIES.length);
  });

  it('fails every route when traces carry only the obsolete paper (the ba01159 defect)', () => {
    const stale = [
      'matrix_research/options_paper/BC_Matrix_Options_Paper_v1.0.11-remediated-20260913.md',
      'matrix_research/options_paper/BC_Matrix_Options_Paper_v1.0.11-remediated-20260913.md.sha256',
    ];
    const result = checkTraces({ nextDir: makeNextDir(() => stale) });
    expect(result.ok).toBe(false);
    expect(result.failures).toHaveLength(REQUIRED_TRACE_ENTRIES.length * 2);
  });

  it('fails when only the sidecar is missing from one API route', () => {
    const target = 'api/matrix-options/paper/downloads/route.js.nft.json';
    const result = checkTraces({
      nextDir: makeNextDir((entry) => (entry === target ? [EXPECTED[0]] : EXPECTED)),
    });
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([`${target} does not trace ${EXPECTED[1]}`]);
  });

  it('fails when a required trace file is absent', () => {
    const nextDir = makeNextDir(() => EXPECTED);
    fs.rmSync(path.join(nextDir, 'server', 'app', '(dashboard)', 'matrix-options', 'page.js.nft.json'));
    const result = checkTraces({ nextDir });
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(['trace missing: (dashboard)/matrix-options/page.js.nft.json']);
  });
});

describe('next.config.ts trace includes', () => {
  const config = fs.readFileSync(path.join(REPO_ROOT, 'next.config.ts'), 'utf8');

  it('lists the exact loader paper and sidecar paths', () => {
    for (const rel of EXPECTED) expect(config).toContain(`'./${rel}'`);
  });

  it('no longer traces the obsolete 20260913 paper', () => {
    expect(config).not.toContain('remediated-20260913');
  });
});

// Replicates Next 15 collect-build-traces key matching (normalizeAppPath + picomatch
// {dot, contains}) against the evaluated config, so a narrowed or removed include key
// fails in test:ci, not only in the post-build verifier. Next passes the 'app/'-prefixed
// entry name to normalizeAppPath, so routes read '/app/...'; this mirrors that exactly.
describe('next.config.ts include keys reach every paper-reading route', async () => {
  const require = createRequire(import.meta.url);
  const picomatch = require('next/dist/compiled/picomatch');
  const { normalizeAppPath } = require('next/dist/shared/lib/router/utils/app-paths');
  const { default: nextConfig } = await import('../../../next.config.ts');
  const includes = nextConfig.outputFileTracingIncludes ?? {};

  function includesForRoute(route) {
    const combined = new Set();
    for (const [key, files] of Object.entries(includes)) {
      if (picomatch(key, { dot: true, contains: true })(route)) {
        for (const f of files) combined.add(f.replace(/\\/g, '/').replace(/^\.\//, ''));
      }
    }
    return combined;
  }

  for (const entry of REQUIRED_TRACE_ENTRIES) {
    const route = normalizeAppPath(`app/${entry.replace(/\.js\.nft\.json$/, '')}`);
    it(`${route} includes the paper and sidecar`, () => {
      const combined = includesForRoute(route);
      for (const rel of EXPECTED) expect(combined.has(rel)).toBe(true);
    });
  }
});
