// Coverage and boundary guard for the Option C candidate lifecycle surface.
// Plain ASCII.
//
// SCOPE, STATED HONESTLY. This file no longer makes any claim about WHICH RPCs
// the route calls. It previously carried a regex RPC allow-list and a
// TypeScript-compiler AST walker asserting a "TRUE allow-list". Both were
// RETIRED by mission-control ruling: they claimed more than they enforced. An
// RPC reached through an alias or a bound function is not a call expression
// whose callee is named `rpc`, so the real call escaped the scanner while the
// allowed calls kept the test green.
//
// That claim is now proved BEHAVIOURALLY in route.test.ts, which records the
// RPC names the route ACTUALLY invokes on a real request and asserts exactly
// the audited upsert followed by one exact-ID readback. Auth, CSRF, payload
// validation and server-side actor resolution are likewise proved there by
// execution.
//
// Do NOT reintroduce regex, AST, token-window, identifier-name or
// source-concatenation analysis here.
//
// What remains are two things behavioural tests genuinely cannot express:
// that the behavioural suites still EXIST (coverage cannot be silently
// dropped), and that this surface is never proven by a live-backed browser
// test.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..', '..', '..', '..', '..');
const COMPONENT = path.join(
  REPO_ROOT,
  'src/app/(dashboard)/admin/matrix-map/site-aggregates/SiteAggregateAdminActions.tsx'
);

describe('candidate lifecycle - coverage guard', () => {
  it('keeps a behavioural test suite for the route', () => {
    expect(existsSync(path.join(HERE, 'route.test.ts'))).toBe(true);
  });

  it('keeps a behavioural test suite for the admin actions component', () => {
    const componentTest = path.join(
      REPO_ROOT,
      'src/app/(dashboard)/admin/matrix-map/site-aggregates/__tests__/SiteAggregateAdminActions.test.tsx'
    );
    expect(existsSync(componentTest)).toBe(true);
  });

  it('keeps the component client-side so the server page stays read-only', () => {
    expect(readFileSync(COMPONENT, 'utf8').startsWith("'use client'")).toBe(true);
  });
});

describe('candidate route - NOT proven by e2e', () => {
  it('no e2e spec exercises the candidate route end-to-end', () => {
    // This surface is proven by vitest plus executed SQL against a disposable
    // PostGIS container -- never by a live-backed browser test. Gate 5 boots a
    // dev server that loads a real .env.local and therefore talks to PRODUCTION
    // Supabase, so an e2e spec hitting this route would issue live admin writes.
    const e2eDir = path.join(REPO_ROOT, 'e2e');
    if (!existsSync(e2eDir)) return;

    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(spec|test)\.[tj]sx?$/.test(entry.name)) continue;
        const text = readFileSync(full, 'utf8');
        if (text.includes('site-aggregates/candidate')) {
          offenders.push(path.relative(REPO_ROOT, full));
        }
      }
    };
    walk(e2eDir);

    expect(offenders).toEqual([]);
  });
});
