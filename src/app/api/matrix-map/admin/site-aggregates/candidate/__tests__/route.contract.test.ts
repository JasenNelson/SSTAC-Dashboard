// Contract guard for the Option C candidate lifecycle surface. Plain ASCII.
//
// These are SOURCE-level invariants, deliberately separate from the behavioural
// suite in route.test.ts. They pin properties that behavioural tests cannot:
// that the write path stays audited, that coverage is not silently dropped, and
// that this surface is never proven by a live-backed browser test.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..', '..', '..', '..', '..');
const ROUTE = path.join(HERE, '..', 'route.ts');
const COMPONENT = path.join(
  REPO_ROOT,
  'src/app/(dashboard)/admin/matrix-map/site-aggregates/SiteAggregateAdminActions.tsx'
);

const routeSource = readFileSync(ROUTE, 'utf8');
// Comment-stripped, so prose explaining why something is NOT done cannot satisfy
// or trip a source assertion.
const routeCode = routeSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('candidate route - audited write path only', () => {
  it('performs no direct table insert, update, upsert, or delete', () => {
    // Every candidate mutation must go through the audited SECURITY DEFINER RPC.
    // A direct table write would bypass the audit trail and the published-state
    // guard entirely.
    for (const forbidden of ['.insert(', '.update(', '.upsert(', '.delete(']) {
      expect(routeCode).not.toContain(forbidden);
    }
  });

  it('mutates only through upsert_site_aggregate_candidate', () => {
    expect(routeCode).toContain("rpc('upsert_site_aggregate_candidate'");
  });

  it('never calls the DRA publication primitive', () => {
    // Creating or refreshing a candidate must never touch DRA visibility.
    expect(routeCode).not.toContain('flip_dra_public');
  });

  it('never calls the aggregate publication flip', () => {
    // Publishing is a separate, separately-audited action on a different route.
    expect(routeCode).not.toContain('flip_site_aggregate_public');
  });

  it('resolves the actor id server-side, never from the request body', () => {
    expect(routeCode).toContain('p_actor_id: auth.user.id');
  });

  it('enforces CSRF before performing any mutation', () => {
    const csrfAt = routeCode.indexOf('checkCsrf');
    const rpcAt = routeCode.indexOf("rpc('upsert_site_aggregate_candidate'");
    expect(csrfAt).toBeGreaterThan(-1);
    expect(rpcAt).toBeGreaterThan(-1);
    expect(csrfAt).toBeLessThan(rpcAt);
  });

  it('restricts admin roles to exactly admin and matrix_admin', () => {
    expect(routeCode).toContain("const ADMIN_ROLES = ['admin', 'matrix_admin']");
  });
});

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
