// Export audit (T3) behavior, proven two-sided on synthetic bundles.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  auditBundleMarkers,
  authenticatePinnedApiRouteSources,
  FORBIDDEN_MARKERS,
  NEXT_API_ROUTE_SOURCE_PINS,
} from '../scripts/audit-export-core.mjs';

const repoRoot = path.resolve(__dirname, '../../..');
const file = (relativePath: string, text: string) => ({ relativePath, bytes: Buffer.from(text, 'utf8') });

// Minified webpack module exporting Next's isAPIRoute (the one allowed '/api/').
const NEXT_IS_API_ROUTE_CHUNK =
  '(self.webpackChunk=self.webpackChunk||[]).push([[1],{123:function(e,t){"use strict";' +
  'function r(e){return"/api"===e||!!(null==e?void 0:e.startsWith("/api/"))}' +
  'Object.defineProperty(t,"isAPIRoute",{enumerable:!0,get:function(){return r}})}}]);';

function pinnedSources() {
  const records = (NEXT_API_ROUTE_SOURCE_PINS as Array<{ path: string; kind: string }>).map((pin) => {
    const bytes = fs.readFileSync(path.join(repoRoot, ...pin.path.split('/')));
    return { path: pin.path, kind: pin.kind, bytes, bytes_count: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  });
  return { records, inputs: records.map((r) => ({ path: r.path, bytes: r.bytes_count, sha256: r.sha256 })) };
}

describe('export audit core', () => {
  it('passes a clean bundle and flags every forbidden marker and other pack id', () => {
    expect(auditBundleMarkers([file('a.js', 'console.log(1)')], true, ['other-pack'])).toEqual([]);
    for (const marker of [...(FORBIDDEN_MARKERS as string[]), 'other-pack']) {
      const findings = auditBundleMarkers([file('a.js', `x="${marker.toUpperCase()}"`)], true, ['other-pack']) as Array<{ marker: string }>;
      expect(findings.map((f) => f.marker), marker).toContain(marker);
    }
  });

  it('authenticates the pinned Next isAPIRoute sources and rejects tampered bytes', () => {
    const { records, inputs } = pinnedSources();
    expect(authenticatePinnedApiRouteSources(records, inputs).authenticated).toBe(true);
    const tampered = records.map((r, i) => (i === 0 ? { ...r, bytes: Buffer.concat([r.bytes, Buffer.from(' ')]) } : r));
    expect(authenticatePinnedApiRouteSources(tampered, inputs).authenticated).toBe(false);
  });

  it('allows only the sole proven isAPIRoute occurrence of /api/', () => {
    expect(auditBundleMarkers([file('chunk.js', NEXT_IS_API_ROUTE_CHUNK)], true)).toEqual([]);
    // Unauthenticated provenance, a second occurrence, or a real API call all fail.
    expect(auditBundleMarkers([file('chunk.js', NEXT_IS_API_ROUTE_CHUNK)], false)).not.toEqual([]);
    expect(auditBundleMarkers([file('chunk.js', NEXT_IS_API_ROUTE_CHUNK), file('b.js', 'fetch("/api/bn-rrm/wms-identify")')], true)).not.toEqual([]);
    expect(auditBundleMarkers([file('b.js', 'fetch("/api/x")')], true)).not.toEqual([]);
  });
});
