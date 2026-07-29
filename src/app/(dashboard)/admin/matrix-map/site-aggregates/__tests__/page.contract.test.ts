/**
 * Containment guards for the Option C site-aggregate admin preview.
 *
 * The preview is an async server component, which jsdom cannot render meaningfully. These are
 * SOURCE-LEVEL guards on projection and containment properties, so a future edit that widens the
 * column projection or introduces a write path fails a test rather than a review.
 *
 * SCOPE, STATED HONESTLY: nothing here proves a universal static RPC allow-list. The regex
 * allow-list and TypeScript-compiler AST walker that once claimed that were RETIRED by
 * mission-control ruling -- they claimed more than they enforced. What the page and its loaders
 * ACTUALLY call is proved by execution: the loaders' recorded RPC and range calls are asserted in
 * src/lib/matrix-map/__tests__/site-aggregate-pagination-behaviour.test.ts, and the rendered
 * surface is proved by the real async page test in site-aggregate-page-binding.test.ts.
 *
 * Do NOT reintroduce regex, AST, token-window, identifier-name or source-concatenation analysis.
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
/**
 * THE ADMIN PREVIEW SURFACE = the page PLUS the read-only loaders it delegates
 * to.
 *
 * The three pagination loops were extracted VERBATIM into
 * `src/lib/matrix-map/site-aggregate-admin-loaders.ts` so their actual RPC and
 * range arguments could be executed in a test -- the admin path was the one
 * consumer whose pagination arguments had no runtime evidence, and a review
 * showed a `(page + 1) * PAGE_SIZE` mutation would have gone unnoticed there.
 *
 * The safety properties these guards protect -- the five-column projection,
 * paged-to-exhaustion reads, the truncation flags -- did not move OUT of scope;
 * they moved to a second file. Scanning only `page.tsx` would therefore quietly
 * stop checking them, which is worse than the coupling the extraction removed.
 * Both files are read together so those assertions keep their original meaning.
 *
 * WHICH RPCs ARE CALLED IS NOT AMONG THEM any more. That claim was retired and
 * now lives in site-aggregate-pagination-behaviour.test.ts as observed runtime
 * behaviour.
 */
const LOADERS_PATH = join(
  process.cwd(),
  'src',
  'lib',
  'matrix-map',
  'site-aggregate-admin-loaders.ts',
);
const pageSource = readFileSync(PAGE_PATH, 'utf8');
const loadersSource = readFileSync(LOADERS_PATH, 'utf8');
const source = `${pageSource}\n${loadersSource}`;

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

describe('site-aggregate preview -- drift is SERVER-authoritative', () => {
  // The page briefly loaded all tiers and recomputed a lifecycle aggregate in
  // TypeScript so it could compare against the SQL snapshot. That made the
  // client a second implementation of a PostgreSQL aggregate and could not be
  // reconciled over an unconstrained text column. The RPC now returns
  // snapshot_drift_state, so the page carries no comparison at all.

  it('keeps the visible preview medium-tier only', () => {
    expect(code).toContain(".eq('coordinate_quality_tier', 'medium')");
    expect(code).toContain("computeSiteAggregates(samples, dras, { tier: 'medium' })");
  });

  it('computes NO second all-tier aggregate for drift', () => {
    expect(code).not.toContain('lifecycleAggregates');
    expect(code).not.toContain('lifecycleByKey');
  });

  it('passes no live snapshot to the actions component', () => {
    // Nothing for the client to compare against, because it no longer compares.
    expect(code).not.toContain('liveSnapshot={');
  });

  it('reimplements no SQL string aggregation or hash semantics', () => {
    for (const forbidden of ['source_sample_hash =', "join('; ')", '.trim().length', 'COLLATE']) {
      expect(code).not.toContain(forbidden);
    }
  });

  it('preserves the server-only column projection', () => {
    expect(code).toContain(
      "'source_dra_id, coordinate_quality_tier, coordinate_source, latitude, longitude'",
    );
    expect(code).not.toContain("select('*')");
  });

  it('states the medium-tier scope of the preview, and that actions capture all tiers', () => {
    // The table is a MEDIUM-TIER preview while Create/Refresh capture an
    // ALL-TIER candidate. Conflating them let an operator review one population
    // and publish another, so the page must say which is which.
    expect(source).toMatch(/MEDIUM-TIER preview/);
    expect(source).toMatch(/ALL-TIER candidate/);
  });

  it('carries no stale capability claims that the page renders no map or adds no publication primitive', () => {
    // Both were false once the map and the lifecycle actions shipped.
    expect(source).not.toMatch(/renders no map layer/i);
    expect(source).not.toMatch(/It renders no map layer yet/i);
    expect(source).not.toMatch(/adds no publication primitive/i);
    expect(source).not.toMatch(/publishes nothing, writes nothing/i);
  });

  it('still states plainly that DRA and sample visibility are never flipped here', () => {
    expect(source).toMatch(/dras\.public/);
    expect(source).toMatch(/samples\.public/);
    expect(code).not.toMatch(/flip_dra_public/);
  });
});

describe('site-aggregate preview -- no write path', () => {
  it('performs no insert, update, upsert, or delete', () => {
    for (const forbidden of ['.insert(', '.update(', '.upsert(', '.delete(']) {
      expect(code).not.toContain(forbidden);
    }
  });

  // THE ALLOW-LIST CLAIM WAS RETIRED HERE (2026-07-28 mission-control ruling).
  //
  // A regex RPC allow-list and a TypeScript-compiler AST walker used to assert
  // that the only `.rpc(...)` literals reachable from the page and its loaders
  // were the permitted read. Both claimed more than they enforced: an RPC
  // reached through an alias or a bound function is not a call expression whose
  // callee is named `rpc`, so the real call escaped the scanner while the
  // allowed calls kept the test green. The self-tests proved the walker caught
  // the evasions it already knew about -- not that it caught the ones it did
  // not.
  //
  // That claim now lives where it can be enforced: the loaders' permitted read
  // RPC calls are recorded and asserted BY EXECUTION in
  // src/lib/matrix-map/__tests__/site-aggregate-pagination-behaviour.test.ts.
  //
  // Do NOT reintroduce regex, AST, token-window, identifier-name or
  // source-concatenation analysis to replace it.

  it('never calls the publication primitive', () => {
    // Comment-stripped: prose may legitimately explain why the primitive is NOT called.
    expect(code).not.toContain('flip_dra_public');
  });

  it('states plainly in the UI that DRA visibility is never changed by this page', () => {
    // NOTE: this assertion previously required the string 'Nothing here is
    // published'. That claim became FALSE in the same change that added the
    // candidate lifecycle controls (create / refresh / publish / unpublish) to
    // this page, so the copy was corrected rather than the test deleted.
    // The honesty invariant actually worth protecting is the SAFETY one, and it
    // is strictly stronger: publishing a site aggregate must never be presented
    // as -- or become -- a change to DRA visibility.
    expect(source).toContain('DRA visibility is never changed by this page');
  });

  it('does not claim to be read-only now that it renders mutating controls', () => {
    // Guards against the inverse regression: reinstating "Read-only preview" or
    // "Nothing here is published" while the actions column is still rendered.
    const claimsReadOnly =
      source.includes('Read-only preview') || source.includes('Nothing here is published');
    const rendersActions = code.includes('SiteAggregateAdminActions');
    expect(claimsReadOnly && rendersActions).toBe(false);
  });
});

describe('site-aggregate preview -- map layer containment', () => {
  it('passes ONLY server-derived markers to the client map, never raw samples or aggregates', () => {
    // The client map must receive the marker projection, which carries no per-sample data.
    expect(code).toMatch(/const markers = toAggregateMarkers\(aggregates\)/);
    expect(code).toMatch(/<SiteAggregateMapLoader markers=\{markers\}/);
    // It must NOT hand the client the raw sample array or the full aggregate rows.
    expect(code).not.toMatch(/MapLoader[^>]*samples=/);
    expect(code).not.toMatch(/MapLoader[^>]*aggregates=/);
  });

  it('derives markers server-side (the map component makes no data fetch of its own)', () => {
    // toAggregateMarkers is called in the server component, not delegated to the client.
    expect(code).toMatch(/import \{ toAggregateMarkers \} from '@\/lib\/matrix-map\/siteAggregateMarkers'/);
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

describe('site-aggregate preview -- DRA load is paged to exhaustion (F11)', () => {
  // The defect: the DRA query was the ONE evidence source on this page that was
  // never paged. Above the PostgREST row cap it silently omitted rows,
  // computeSiteAggregates drops every sample whose DRA is missing, and that
  // omission never reached `previewIncomplete` -- so a server-confirmed live
  // candidate could be labelled "outside this medium-tier preview" purely
  // because the DRA read truncated.

  function draLoadSlice(): string {
    const idx = code.indexOf("from('dras')");
    expect(idx, 'expected a .from(\'dras\') call').toBeGreaterThan(-1);
    // Wide enough to cover the whole paging loop this call sits inside.
    return code.slice(Math.max(0, idx - 400), idx + 700);
  }

  it('pages the DRA query with .range( and a stable .order( on id', () => {
    const slice = draLoadSlice();
    expect(slice).toMatch(/\.range\(/);
    expect(slice).toMatch(/\.order\('id'/);
  });

  it('declares a drasTruncated flag and feeds it into the axes derivation', () => {
    expect(code).toMatch(/let drasTruncated\s*=\s*false/);
    const deriveIdx = code.indexOf('deriveLifecycleEvidenceAxes({');
    expect(deriveIdx).toBeGreaterThan(-1);
    const deriveArgs = code.slice(deriveIdx, code.indexOf('});', deriveIdx));
    expect(deriveArgs).toContain('drasTruncated');
  });

  it('sets drasTruncated only once the page ceiling is actually hit, mirroring the sample loop', () => {
    const slice = draLoadSlice();
    // The INVARIANT is unchanged: the flag is set only on the LAST permitted
    // page, never on every iteration. The page index now comes from the shared
    // `siteAggregatePageIndexes()` authority rather than a local MAX_PAGES
    // literal, so the comparison is against the last element of that list.
    expect(slice).toMatch(/if \(page === pages\[pages\.length - 1\]\) drasTruncated = true;/);
    // ...and it must NOT be set unconditionally inside the loop body.
    expect(slice).not.toMatch(/^\s*drasTruncated = true;\s*$/m);
  });

  it('renders a distinct DRA-truncation warning', () => {
    expect(source).toMatch(/\{drasTruncated \? \(/);
    expect(source).toContain('DRA load hit the');
    expect(source).toContain('INCOMPLETE');
  });

  it('still merges a DRA load error into the shared preview error sentinel', () => {
    // draError is already the extracted message string (assigned inside the
    // paging loop from error.message), unlike the RPC loops below which merge
    // a raw PostgrestError's .message field directly.
    expect(code).toContain('if (draError && !loadError) loadError = draError;');
  });
});

describe('site-aggregate preview -- evidence completeness gates classification (F1/F5)', () => {
  it('derives the evidence axes BEFORE classifying rows', () => {
    // Ordering is the defect: classifying first meant a failed load produced an
    // empty `aggregates` and therefore a table full of unfounded claims.
    const deriveIdx = code.indexOf('deriveLifecycleEvidenceAxes({');
    const classifyIdx = code.indexOf('classifyLifecycleRows({');
    expect(deriveIdx).toBeGreaterThan(-1);
    expect(classifyIdx).toBeGreaterThan(-1);
    expect(deriveIdx).toBeLessThan(classifyIdx);
  });

  it('gates the medium-tier aggregates on the PREVIEW axis alone', () => {
    // The F6 regression: a candidate-RPC failure must not blank a preview that
    // loaded fine. `previewRenderable` is derived from preview signals only.
    expect(code).toContain('previewRenderable');
    expect(code).toContain('? computeSiteAggregates(samples, dras');
    // The old conflated gate must be gone.
    expect(code).not.toContain('loadError ? [] : computeSiteAggregates');
    expect(code).not.toContain('const incompleteLoad =');
  });

  it('never writes a candidate failure into the preview error sentinel', () => {
    // `candidateError` is a separate variable precisely so it cannot reach
    // `loadError`, which gates the preview.
    expect(code).toContain('let candidateError: string | null = null;');
    const loopIdx = code.indexOf("rpc('fetch_admin_site_aggregate_publications'");
    const loopTail = code.slice(loopIdx, loopIdx + 900);
    // Spelling gained a fallback when the loop moved into the extracted
    // loader; the invariant -- a candidate failure lands in `candidateError`
    // and never in the preview's `loadError` sentinel -- is unchanged.
    expect(loopTail).toMatch(/if \(!candidateError\) candidateError = error\.message/);
    expect(loopTail).not.toContain('loadError = error.message');
  });

  it('delegates classification to the shared module rather than reimplementing it', () => {
    expect(code).toContain("from '@/lib/matrix-map/site-aggregate-lifecycle-rows'");
    // No second liveKeys/orphan derivation may reappear in the page.
    expect(code).not.toContain('const liveKeys =');
    expect(code).not.toContain('const orphanedCandidates =');
  });

  it('never calls candidates.find while rendering aggregates (F5)', () => {
    // The O(n*m) lookup: ~625M comparisons at the documented 25,000-row cap.
    expect(code).not.toMatch(/candidates\s*\.\s*find\s*\(/);
    expect(code).toContain('candidateByKey.get(');
  });

  it('makes NO absence claim anywhere in the page', () => {
    // `unknown` is overloaded server-side -- it covers both "no snapshot" and
    // "DRA soft-deleted" -- so nothing in the RPC contract proves absence. The
    // page must therefore never assert that a live aggregate does not exist.
    expect(code).not.toContain('No live aggregate');
    expect(code).not.toContain('confirmedOrphans');
  });

  it('states only that the status is unavailable, without naming a cause', () => {
    // The earlier wording blamed "preview evidence incomplete", which is false
    // when every read succeeded and only the drift state was unrecognized.
    expect(code).toContain('Live aggregate status unavailable');
    expect(code).not.toContain('Live aggregate status unavailable: preview evidence incomplete');
  });

  it('keeps Unpublish reachable for BOTH candidate row kinds', () => {
    // The escape hatch is a settled ruling: neither branch may drop the control.
    const tierIdx = code.indexOf('{outsidePreviewTier.map(');
    const unknownIdx = code.indexOf('{unknownStatusCandidates.map(');
    expect(tierIdx).toBeGreaterThan(-1);
    expect(unknownIdx).toBeGreaterThan(tierIdx);
    expect(code.slice(tierIdx, unknownIdx)).toContain('<SiteAggregateAdminActions');
    expect(code.slice(unknownIdx)).toContain('<SiteAggregateAdminActions');
  });
});

describe('site-aggregate preview -- the table cannot hide a reachable row', () => {
  it('tests EVERY rendered bucket for emptiness, not just unmatched', () => {
    // Quarantined duplicates are excluded from `unmatchedCandidates` by design.
    // Testing that alone hid the whole table -- and every Unpublish control --
    // when all candidates were quarantined and no medium aggregate existed.
    const idx = code.indexOf('aggregates.length === 0');
    expect(idx).toBeGreaterThan(-1);
    const condition = code.slice(idx, code.indexOf('? (', idx));
    for (const bucket of [
      'unknownStatusCandidates.length === 0',
      'outsidePreviewTier.length === 0',
    ]) {
      expect(condition).toContain(bucket);
    }
    // The old, insufficient test must be gone.
    expect(condition).not.toContain('unmatchedCandidates.length === 0');
  });

  it('renders both candidate row kinds', () => {
    for (const bucket of ['unknownStatusCandidates.map(', 'outsidePreviewTier.map(']) {
      expect(code).toContain(bucket);
    }
  });
});
