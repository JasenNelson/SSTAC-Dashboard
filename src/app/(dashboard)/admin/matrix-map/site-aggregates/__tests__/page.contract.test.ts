/**
 * Contract / containment guards for the Option C site-aggregate admin preview.
 *
 * The preview is an async server component, which jsdom cannot render meaningfully. These are
 * therefore SOURCE-LEVEL guards on the properties that actually matter for safety, so a future
 * edit that widens the projection or introduces a write path fails a test rather than a review.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGE_PATH = join(
  process.cwd(),
  'src',
  'app',
  '(dashboard)',
  'admin',
  'matrix-map',
  'site-aggregates',
  'page.tsx'
);
const source = readFileSync(PAGE_PATH, 'utf8');

/**
 * Source with comments stripped. The oracle-parameter assertions must test CODE, not prose --
 * the page's own doc comment legitimately mentions "bbox" and "radius" while explaining that it
 * accepts neither, and matching that would be a false positive.
 */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('site-aggregate preview -- caching contract', () => {
  it('is never cached (server-component equivalent of Cache-Control private, no-store)', () => {
    expect(source).toMatch(/export const dynamic = 'force-dynamic'/);
    expect(source).toMatch(/export const revalidate = 0/);
  });
});

describe('site-aggregate preview -- admin gate', () => {
  it('gates on the same admin roles as the other matrix-map admin surfaces', () => {
    expect(source).toMatch(/ADMIN_ROLES = \['admin', 'matrix_admin'\]/);
    expect(source).toContain("redirect('/login')");
    expect(source).toContain("redirect('/dashboard')");
  });

  it('fails closed when the role query errors, rather than falling through', () => {
    // A `!role` check alone would let a query error render the page.
    expect(source).toMatch(/if \(roleError \|\| !role\) redirect\('\/dashboard'\)/);
  });
});

describe('site-aggregate preview -- containment', () => {
  const ALLOWED_SAMPLE_COLUMNS = [
    'source_dra_id',
    'coordinate_quality_tier',
    'coordinate_source',
    'latitude',
    'longitude',
  ];

  function sampleSelectArg(): string {
    // The `.select(...)` immediately following `.from('samples')`.
    const m = source.match(/from\('samples'\)\s*\.select\(\s*'([^']+)'/);
    expect(m, 'expected a .select() on the samples table').toBeTruthy();
    return m![1];
  }

  it('selects exactly the five permitted sample columns', () => {
    const cols = sampleSelectArg()
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    expect(cols.sort()).toEqual([...ALLOWED_SAMPLE_COLUMNS].sort());
  });

  it('never selects a per-sample identifier or measurement column', () => {
    const selected = sampleSelectArg();
    for (const forbidden of ['id', 'station_id', 'bnrrm_station_id', 'geometry', 'notes', 'display_name']) {
      // Word-boundary match so `source_dra_id` does not trip the bare `id` check.
      expect(selected).not.toMatch(new RegExp(`(^|[,\\s])${forbidden}([,\\s]|$)`));
    }
  });

  it('accepts no caller-supplied parameter at all (oracle constraint)', () => {
    // The real invariant is structural, not lexical: a Next.js server component can only
    // receive caller input via props (`searchParams` / `params`). If the default export takes
    // NO arguments, there is no channel through which a caller could scope the aggregate --
    // which is why this preview is a page rather than an HTTP route.
    //
    // Deliberately NOT asserted by searching for the words "bbox"/"radius": the page's own UI
    // text explains that it accepts neither, and matching prose would fail on the explanation
    // rather than on a real parameter.
    expect(code).toMatch(/export default async function \w+\(\s*\)/);
    expect(code).not.toMatch(/searchParams/);
    expect(code).not.toMatch(/\bparams\s*[:,}]/);
  });
});

describe('site-aggregate preview -- no write path', () => {
  it('performs no insert, update, upsert, delete, or RPC call', () => {
    for (const forbidden of ['.insert(', '.update(', '.upsert(', '.delete(', '.rpc(']) {
      expect(code).not.toContain(forbidden);
    }
  });

  it('never calls the publication primitive', () => {
    // Comment-stripped: prose may legitimately explain why the primitive is NOT called.
    expect(code).not.toContain('flip_dra_public');
  });

  it('states plainly in the UI that nothing is published', () => {
    expect(source).toContain('Nothing here is published');
  });
});

describe('site-aggregate preview -- reuses shared vocabulary', () => {
  it('imports tier labels rather than inventing new wording', () => {
    expect(source).toMatch(
      /import \{ COORD_TIER_LABEL, COORD_TIER_CAPTION \} from '@\/lib\/matrix-map\/coordinate-provenance'/
    );
    // The honest-provenance caption must be shown verbatim, not paraphrased.
    expect(source).toContain('COORD_TIER_CAPTION.medium');
  });
});

describe('site-aggregate preview -- pagination correctness', () => {
  it('surfaces a hard warning instead of silently reporting partial counts', () => {
    expect(source).toMatch(/truncated/);
    expect(source).toContain('INCOMPLETE');
  });

  it('paginates under a TOTAL order, with a unique tiebreaker after source_dra_id', () => {
    // source_dra_id is not unique -- one DRA can hold hundreds of rows, so its ties straddle
    // page boundaries. Without a unique tiebreaker, Postgres may order ties differently between
    // independent .range() calls, silently skipping or duplicating rows while `truncated` stays
    // false. That corrupts the counts with no visible symptom, so this ordering is load-bearing.
    const orders = [...code.matchAll(/\.order\('([^']+)'/g)].map((m) => m[1]);
    expect(orders).toContain('source_dra_id');
    expect(orders).toContain('id');
    expect(orders.indexOf('id')).toBeGreaterThan(orders.indexOf('source_dra_id'));
  });

  it('orders by the primary key without selecting it, preserving containment', () => {
    // ORDER BY a non-selected column is valid in PostgREST; this is what lets us have a total
    // order without letting a per-sample id reach the helper or the render.
    expect(code).toMatch(/\.order\('id'/);
    const m = code.match(/from\('samples'\)\s*\.select\(\s*'([^']+)'/);
    expect(m).toBeTruthy();
    expect(m![1]).not.toMatch(/(^|[,\s])id([,\s]|$)/);
  });
});
