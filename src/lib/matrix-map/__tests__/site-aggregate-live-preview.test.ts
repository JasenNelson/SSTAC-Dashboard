/**
 * F2 -- behavioural tests for the live-preview keyset loader.
 *
 * These execute the loader against a recording fake client, so the RPC name, the
 * cursor arguments and the traversal/termination rules are proved by OBSERVED
 * CALLS rather than by reading source. That distinction is load-bearing in this
 * repository: a review previously showed that a consumer computing
 * `(page + 1) * PAGE_SIZE` would fail closed at the SQL ceiling while every
 * source-shaped assertion stayed green.
 */
import { describe, it, expect } from 'vitest';

import {
  LIVE_PREVIEW_RPC,
  loadAdminLivePreview,
  loadSiteAggregateLiveAdminSurface,
  parseLivePreviewRow,
  sortPreviewRowsForDisplay,
} from '../site-aggregate-live-preview';
import { PAGE_SIZE, MAX_PAGES } from '../site-aggregate-pagination';
import type { AdminLoaderClient } from '../site-aggregate-admin-loaders';

/**
 * A REAL UUID, not `'d1'`.
 *
 * The placeholder was itself SQL-impossible -- the RPC declares
 * `source_dra_id uuid` -- and it masked a SEAM MISMATCH: the parser accepted the
 * row and left Create enabled, while the candidate route rejects any non-UUID
 * `source_dra_id` outright. A fixture that cannot occur in production hid a
 * defect that only shows up after the operator clicks.
 */
const DRA_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

/**
 * A row the SQL could ACTUALLY EMIT.
 *
 * THIS FIXTURE WAS WRONG and the error was instructive. It carried lifecycle
 * counts 3/6/1 with tier `high`, but the dominant-tier CASE yields `medium` for
 * those counts (high 3 is not >= medium 6), so no execution of the function could
 * ever produce this row. Because the fixture is the base for every other case in
 * this file, an impossible baseline silently weakens the whole suite -- and it was
 * the reason the parser's tier check looked adequate when it was not.
 *
 * The counts are now 7/6/1, which genuinely yields `high`, preserving the point
 * the fixture exists to make: the LIFECYCLE block and the PREVIEW block differ,
 * so a consumer that confuses them fails visibly.
 *
 * Note `preview_sample_count_medium === lifecycle_sample_count_medium === 6`:
 * both are the same filtered aggregate in the SQL and cannot diverge.
 */
function rawRow(over: Record<string, unknown> = {}) {
  return {
    source_dra_id: DRA_ID,
    source_dra_title: 'DRA One',
    canonical_cluster_id: '49.28270,-123.12070',
    preview_representative_latitude: 49.2827,
    preview_representative_longitude: -123.1207,
    preview_coordinate_quality_tier: 'medium',
    preview_coordinate_source: 'bc_csr_centroid',
    preview_coordinate_sources: ['bc_csr_centroid'],
    preview_sample_count_total: 6,
    preview_sample_count_high: 0,
    preview_sample_count_medium: 6,
    preview_sample_count_low: 0,
    preview_distinct_point_count: 1,
    lifecycle_representative_latitude: 49.2827,
    lifecycle_representative_longitude: -123.1207,
    lifecycle_coordinate_quality_tier: 'high',
    lifecycle_coordinate_source: 'bc_csr_centroid; survey',
    lifecycle_coordinate_sources: ['bc_csr_centroid', 'survey'],
    lifecycle_sample_count_total: 14,
    lifecycle_sample_count_high: 7,
    lifecycle_sample_count_medium: 6,
    lifecycle_sample_count_low: 1,
    lifecycle_distinct_point_count: 1,
    ...over,
  };
}

/**
 * A cluster id that sorts strictly AFTER the default fixture's
 * `49.28270,-123.12070`, ascending in `index`.
 *
 * THE BASE MOVED FROM 49 TO 50 and that is not cosmetic. The loader now verifies
 * the RPC's promised strict keyset order, and the old base produced ids like
 * `49.00001,...` that sort BELOW the default row -- so a two-row page built from
 * `rawRow()` plus `clusterFor(1)` was DESCENDING and is now correctly rejected.
 * The fixtures were never ordered; nothing checked them before.
 */
function clusterFor(index: number): string {
  const lat = (50 + index / 100000).toFixed(5);
  return `${lat},-123.12070`;
}

/**
 * A row at `index` whose CLUSTER KEY AND REPRESENTATIVE PAIR AGREE.
 *
 * Overriding `canonical_cluster_id` alone -- which every multi-row fixture here
 * used to do -- leaves the representative pair at the default `49.2827`, so the
 * key claims one location and the pair another. `parseServerClusterIdentity` now
 * rejects that, correctly: the SQL DERIVES the key from the pair, so the two can
 * never disagree in a real response. Every such fixture was describing a row the
 * server cannot emit.
 *
 * The coordinates are parsed back OUT of the key text rather than recomputed from
 * `index`, so the two are equal by construction and no float-formatting
 * difference can creep between them.
 */
function rowAt(index: number, over: Record<string, unknown> = {}) {
  const cluster = clusterFor(index);
  const [latText, lngText] = cluster.split(',');
  const latitude = Number(latText);
  const longitude = Number(lngText);
  return rawRow({
    canonical_cluster_id: cluster,
    preview_representative_latitude: latitude,
    preview_representative_longitude: longitude,
    lifecycle_representative_latitude: latitude,
    lifecycle_representative_longitude: longitude,
    ...over,
  });
}

/**
 * A full page whose keys continue ASCENDING from `startIndex`.
 *
 * Multi-page fixtures previously reused ONE `full` array for every page, so each
 * page restarted at the same key. A real keyset traversal never does that, and
 * the loader now treats it as the contract violation it is.
 */
function fullPageFrom(startIndex: number) {
  return Array.from({ length: PAGE_SIZE }, (_, i) => rowAt(startIndex + i));
}

interface Call {
  fn: string;
  args: Record<string, unknown>;
}

/**
 * Recording fake. `pages` is consumed one RPC call at a time, so the traversal
 * is driven by what the loader actually asks for.
 */
function fakeClient(
  pages: unknown[][],
  opts: { errorOnCall?: number; errorMessage?: string } = {},
): { client: AdminLoaderClient; calls: Call[] } {
  const calls: Call[] = [];
  let call = 0;
  const client = {
    schema() {
      return {
        from() {
          throw new Error('the live-preview loader must not touch a table directly');
        },
        async rpc(fn: string, args: Record<string, unknown>) {
          calls.push({ fn, args });
          call += 1;
          if (opts.errorOnCall === call) {
            return { data: null, error: { message: opts.errorMessage ?? 'boom' } };
          }
          // VERBATIM, not `pages[call - 1] ?? []`. That coalesce made this fake
          // incapable of delivering a `null` or `undefined` payload at all: it
          // silently rewrote the exact malformed shape under test into an empty
          // array, so a test asserting the absent-payload behaviour could only
          // ever exercise the empty-array path. Running PAST the end of `pages`
          // still yields `[]`, which is what a real exhausted traversal returns.
          return { data: call - 1 < pages.length ? pages[call - 1] : [], error: null };
        },
      };
    },
  } as unknown as AdminLoaderClient;
  return { client, calls };
}

describe('loadAdminLivePreview -- RPC and cursor contract', () => {
  it('calls the live-preview RPC with a NULL cursor and the shared page size first', async () => {
    const { client, calls } = fakeClient([[rawRow()]]);

    const result = await loadAdminLivePreview(client);

    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe(LIVE_PREVIEW_RPC);
    expect(calls[0].args).toEqual({
      p_after_source_dra_id: null,
      p_after_canonical_cluster: null,
      p_limit: PAGE_SIZE,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.truncated).toBe(false);
    expect(result.unparsableRowCount).toBe(0);
    expect(result.loadError).toBeNull();
  });

  it('stops on a SHORT page without asking for another', async () => {
    // Explicit truncation contract: fewer than p_limit rows means the traversal
    // is complete. A second call would be a wasted round trip at best and, on a
    // shifting population, a source of duplicates.
    const { client, calls } = fakeClient([[rawRow(), rowAt(1)]]);

    const result = await loadAdminLivePreview(client);

    expect(calls).toHaveLength(1);
    expect(result.rows).toHaveLength(2);
    expect(result.truncated).toBe(false);
  });

  it('advances the cursor from the LAST row of a full page', async () => {
    const full = fullPageFrom(0);
    const { client, calls } = fakeClient([full, [rowAt(9999)]]);

    const result = await loadAdminLivePreview(client);

    expect(calls).toHaveLength(2);
    // BOTH cursor fields move together -- the SQL raises UE422 on a
    // half-supplied cursor rather than coercing it into a first page.
    expect(calls[1].args).toEqual({
      p_after_source_dra_id: DRA_ID,
      p_after_canonical_cluster: clusterFor(PAGE_SIZE - 1),
      p_limit: PAGE_SIZE,
    });
    expect(result.rows).toHaveLength(PAGE_SIZE + 1);
    expect(result.truncated).toBe(false);
  });

  it('never computes an OFFSET, and never sends one', async () => {
    const full = fullPageFrom(0);
    const { client, calls } = fakeClient([full, []]);

    await loadAdminLivePreview(client);

    for (const c of calls) {
      expect(c.args).not.toHaveProperty('p_offset');
      expect(Object.keys(c.args).sort()).toEqual([
        'p_after_canonical_cluster',
        'p_after_source_dra_id',
        'p_limit',
      ]);
    }
  });

  it('stops at the page ceiling and reports truncation', async () => {
    // Each page continues where the previous one stopped, as a real keyset
    // traversal does -- reusing one page would now be rejected as a duplicate.
    const pages = Array.from({ length: MAX_PAGES }, (_, p) => fullPageFrom(p * PAGE_SIZE));
    const { client, calls } = fakeClient(pages);

    const result = await loadAdminLivePreview(client);

    expect(calls).toHaveLength(MAX_PAGES);
    expect(result.truncated).toBe(true);
    expect(result.rows).toHaveLength(MAX_PAGES * PAGE_SIZE);
  });

  it('reports an RPC error and stops, leaving rows partial but flagged', async () => {
    const full = fullPageFrom(0);
    const { client, calls } = fakeClient([full, []], {
      errorOnCall: 2,
      errorMessage: 'UE422 cursor rejected',
    });

    const result = await loadAdminLivePreview(client);

    expect(calls).toHaveLength(2);
    expect(result.loadError).toBe('UE422 cursor rejected');
    expect(result.rows).toHaveLength(PAGE_SIZE);
  });
});

/**
 * THE KEYSET ORDER IS A CONTRACT, SO IT IS VERIFIED.
 *
 * The RPC promises a strict total order on
 * `(source_dra_id, canonical_cluster_id COLLATE "C")`. The loader used to trust
 * that and decide completeness from PAGE LENGTH alone, so a version-skewed or
 * hostile response that repeated or reordered rows was accepted as COMPLETE --
 * the summary and map double-counted, and the table rendered two independent
 * Create/Refresh controls aimed at the SAME SQL identity.
 */
describe('loadAdminLivePreview -- a non-monotonic response FAILS CLOSED', () => {
  it('stops and reports incomplete when a page REPEATS a key', async () => {
    const { client } = fakeClient([[rawRow(), rawRow()]]);

    const result = await loadAdminLivePreview(client);

    expect(result.truncated).toBe(true);
    // The duplicate is NOT appended, so the summary cannot double-count it.
    expect(result.rows).toHaveLength(1);
  });

  it('stops when a page goes BACKWARDS', async () => {
    const { client } = fakeClient([
      [rowAt(5), rowAt(4)],
    ]);

    const result = await loadAdminLivePreview(client);

    expect(result.truncated).toBe(true);
    expect(result.rows).toHaveLength(1);
  });

  it('stops when the SECOND PAGE restarts at an earlier key', async () => {
    // The cross-page case. Page length alone cannot detect it, which is why the
    // last key is carried ACROSS pages rather than reset per page.
    const { client, calls } = fakeClient([fullPageFrom(0), fullPageFrom(0)]);

    const result = await loadAdminLivePreview(client);

    expect(calls).toHaveLength(2);
    expect(result.truncated).toBe(true);
    expect(result.rows).toHaveLength(PAGE_SIZE);
  });

  it('DISCRIMINATES: a genuinely ascending traversal is still COMPLETE', async () => {
    // Without this the assertions above could pass against a loader that always
    // reported truncation.
    const { client } = fakeClient([fullPageFrom(0), [rowAt(PAGE_SIZE)]]);

    const result = await loadAdminLivePreview(client);

    expect(result.truncated).toBe(false);
    expect(result.rows).toHaveLength(PAGE_SIZE + 1);
    expect(result.unparsableRowCount).toBe(0);
  });

  it('orders by source_dra_id FIRST, so a lower cluster under a higher DRA is fine', async () => {
    // The composite key is (dra, cluster). A cluster id that decreases is only a
    // violation when the DRA is unchanged.
    const { client } = fakeClient([
      [
        rowAt(9),
        rowAt(1, { source_dra_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' }),
      ],
    ]);

    const result = await loadAdminLivePreview(client);

    expect(result.truncated).toBe(false);
    expect(result.rows).toHaveLength(2);
  });
});

describe('loadAdminLivePreview -- unparsable rows are COUNTED, not silently dropped', () => {
  it('counts a malformed row and still returns the good ones', async () => {
    const { client } = fakeClient([
      [rawRow(), rawRow({ canonical_cluster_id: 'not-canonical' }), rawRow({ source_dra_id: null })],
    ]);

    const result = await loadAdminLivePreview(client);

    expect(result.rows).toHaveLength(1);
    expect(result.unparsableRowCount).toBe(2);
  });

  it('terminates rather than looping when a FULL page carries no usable cursor', async () => {
    // The failure this prevents: a full page whose last row has no cursor could
    // otherwise be requested forever with the same arguments. Reporting it as
    // truncated is honest -- the traversal genuinely did not complete.
    const full = fullPageFrom(0);
    full[PAGE_SIZE - 1] = rawRow({ canonical_cluster_id: null });
    const { client, calls } = fakeClient([full, full, full]);

    const result = await loadAdminLivePreview(client);

    expect(calls).toHaveLength(1);
    expect(result.truncated).toBe(true);
    // EXACTLY ONE, not `> 0`. The loose assertion masked a double count: the
    // terminal row was tallied once by the row parser and again by the cursor
    // branch, so a page with one unreadable row reported two.
    expect(result.unparsableRowCount).toBe(1);
    expect(result.rows).toHaveLength(PAGE_SIZE - 1);
  });
});

describe('parseLivePreviewRow', () => {
  it('splits the PREVIEW and LIFECYCLE blocks without mixing them', async () => {
    const parsed = parseLivePreviewRow(rawRow());
    expect(parsed).not.toBeNull();
    expect(parsed?.preview_sample_count_total).toBe(6);
    expect(parsed?.preview_coordinate_quality_tier).toBe('medium');
    expect(parsed?.lifecycle_sample_count_total).toBe(14);
    expect(parsed?.lifecycle_coordinate_quality_tier).toBe('high');
    // The identity travels with the LIFECYCLE pair, because that is the
    // population the upsert persists.
    expect(parsed?.lifecycle_representative).toEqual({
      latitude: 49.2827,
      longitude: -123.1207,
    });
  });

  it('builds a stable aggregate id from the DRA and the SERVER key', () => {
    expect(parseLivePreviewRow(rawRow())?.aggregate_id).toBe(`${DRA_ID}:49.28270,-123.12070`);
  });

  it.each([
    ['a missing count', { lifecycle_sample_count_low: undefined }],
    ['a non-numeric count', { preview_sample_count_total: '6' }],
    // COUNT DOMAIN. Reverting `asCount` to a bare finite-number check would leave
    // every other case here green, so these are what actually pin it.
    ['a negative count', { preview_sample_count_total: -1 }],
    ['a negative lifecycle count', { lifecycle_sample_count_high: -3 }],
    ['a fractional count', { preview_sample_count_medium: 2.5 }],
    ['a fractional distinct-point count', { lifecycle_distinct_point_count: 1.5 }],
    ['an infinite count', { preview_sample_count_low: Number.POSITIVE_INFINITY }],
    // PREVIEW COORDINATE BOUNDS. Only the LIFECYCLE pair went through the
    // eligibility check before; a finite-but-out-of-range preview latitude was
    // accepted and would have been plotted on the map.
    ['an out-of-range preview latitude', { preview_representative_latitude: 500 }],
    ['a preview latitude just past 90', { preview_representative_latitude: 90.00001 }],
    ['an out-of-range preview longitude', { preview_representative_longitude: -180.5 }],
    ['a NaN preview latitude', { preview_representative_latitude: Number.NaN }],
    ['an unknown preview tier', { preview_coordinate_quality_tier: 'extreme' }],
    ['a missing preview coordinate', { preview_representative_latitude: undefined }],
    ['an ineligible lifecycle coordinate', { lifecycle_representative_latitude: 500 }],
    ['an empty source_dra_id', { source_dra_id: '' }],
    // The RPC declares `source_dra_id uuid`, and the candidate route rejects any
    // non-UUID. Accepting one here left Create enabled on a request the write end
    // would refuse.
    ['a non-UUID source_dra_id', { source_dra_id: 'd1' }],
    ['a UUID missing its last group', { source_dra_id: '3f2504e0-4f89-41d3-9a0c' }],
    ['a UUID with a non-hex character', { source_dra_id: '3f2504e0-4f89-41d3-9a0c-0305e82c330g' }],
    ['a UUID with a group of the wrong length', { source_dra_id: '3f2504e0-4f8-41d3-9a0c-0305e82c3301' }],
  ])('rejects %s', (_label, over) => {
    expect(parseLivePreviewRow(rawRow(over))).toBeNull();
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'row'],
    ['a number', 7],
  ])('rejects %s outright', (_label, value) => {
    expect(parseLivePreviewRow(value)).toBeNull();
  });
  /**
   * CROSS-FIELD INVARIANTS -- one mutation per check, and each mutation is
   * rejected by EXACTLY ONE of them.
   *
   * That isolation is the whole point and it is not free. Every count here is
   * already a valid in-domain integer, so none of these rows is caught by
   * `asCount`; each is a row the per-field checks accept and only a cross-field
   * check refuses. Reverting any single invariant in `parseLivePreviewRow`
   * therefore turns exactly the cases named for it red -- a table where several
   * checks overlap would let a deleted check hide behind its neighbours, which is
   * how the looser per-field validation survived review in the first place.
   *
   * THE COMPENSATING EDITS ARE THE WORK. A mutation that changes one count almost
   * always breaks a second invariant too: the two medium counts are the same
   * aggregate, the lifecycle counts must still partition their total, and the tier
   * must still be the one those counts imply. So each case moves every OTHER field
   * needed to keep the remaining checks satisfied. Where a case looks
   * over-specified, that is why.
   *
   * `.tmp/f2-v7-run-20260729/FIXA_MUTATION_RECEIPT.txt` is the machine-checked
   * proof that the attribution below is real and not merely intended.
   */
  it.each([
    // preview high is the literal `0::integer`. total and medium move together so
    // `medium === total` holds, and the lifecycle medium follows so the
    // same-aggregate check holds; high stays dominant so the tier still matches.
    [
      'a non-zero preview high count',
      {
        preview_sample_count_high: 1,
        preview_sample_count_total: 7,
        preview_sample_count_medium: 7,
        lifecycle_sample_count_medium: 7,
        lifecycle_sample_count_total: 15,
      },
    ],
    // preview low is the literal `0::integer`. The lifecycle high is raised so
    // `high` remains dominant once the medium count grows.
    [
      'a non-zero preview low count',
      {
        preview_sample_count_low: 2,
        preview_sample_count_total: 8,
        preview_sample_count_medium: 8,
        lifecycle_sample_count_medium: 8,
        lifecycle_sample_count_high: 9,
        lifecycle_sample_count_total: 18,
      },
    ],
    // preview total and medium are the SAME filtered count expression. Moving the
    // TOTAL alone leaves the medium counts agreeing with each other.
    ['a preview total that differs from the preview medium', { preview_sample_count_total: 9 }],
    // ...and the other direction, with the lifecycle side moved to match so only
    // the preview-internal equality can fire.
    [
      'a preview medium that differs from the preview total',
      {
        preview_sample_count_medium: 5,
        lifecycle_sample_count_medium: 5,
        lifecycle_sample_count_total: 13,
      },
    ],
    // preview medium and lifecycle medium are the SAME aggregate. Here the preview
    // side stays internally consistent and only the cross-block equality breaks.
    [
      'a preview medium that differs from the lifecycle medium',
      { preview_sample_count_total: 5, preview_sample_count_medium: 5 },
    ],
    // both distinct-point counts are the literal `1::integer`.
    ['a preview distinct-point count that is not 1', { preview_distinct_point_count: 2 }],
    ['a preview distinct-point count of 0', { preview_distinct_point_count: 0 }],
    ['a lifecycle distinct-point count that is not 1', { lifecycle_distinct_point_count: 3 }],
    ['a lifecycle distinct-point count of 0', { lifecycle_distinct_point_count: 0 }],
    // the three lifecycle tier counts PARTITION the lifecycle total. Both cases
    // keep `high` dominant so the derived-tier check stays satisfied.
    ['a lifecycle total that exceeds its tier counts', { lifecycle_sample_count_total: 15 }],
    ['a lifecycle tier count that breaks the partition', { lifecycle_sample_count_high: 8 }],
    // THE LIFECYCLE TIER IS A FUNCTION OF ITS COUNTS. These are the cases an
    // enum-membership check could not tell apart from a valid row.
    ['a lifecycle tier that contradicts its own counts', { lifecycle_coordinate_quality_tier: 'low' }],
    [
      'a tier of high where the counts make medium dominant',
      { lifecycle_sample_count_high: 5, lifecycle_sample_count_total: 12 },
    ],
    ['an arbitrary lifecycle tier string', { lifecycle_coordinate_quality_tier: 'unknown' }],
    ['an empty lifecycle tier', { lifecycle_coordinate_quality_tier: '' }],
    ['a null lifecycle tier', { lifecycle_coordinate_quality_tier: null }],
    ['a non-string lifecycle tier', { lifecycle_coordinate_quality_tier: 2 }],
    // the preview tier is the LITERAL 'medium', not any member of the enum.
    ['a preview tier of high', { preview_coordinate_quality_tier: 'high' }],
    ['a preview tier of low', { preview_coordinate_quality_tier: 'low' }],
    // the two coordinate pairs are the SAME projected grouping key. Both values
    // are independently ELIGIBLE, so only the coincidence check can reject them.
    [
      'a preview latitude that diverges from the lifecycle latitude',
      { preview_representative_latitude: 49.2828 },
    ],
    [
      'a preview longitude that diverges from the lifecycle longitude',
      { preview_representative_longitude: -123.1208 },
    ],
    // COUNTS OUTSIDE THE DECLARED `integer` DOMAIN. This is the row a review
    // constructed: at 2^53 IEEE-754 addition is inexact, so
    // `9007199254740992 + 1 + 0` evaluates back to `9007199254740992` and the
    // PARTITION CHECK PASSES on a row `integer` columns could never carry. Only
    // the domain bound rejects it.
    [
      'a lifecycle count beyond the PostgreSQL integer domain',
      {
        lifecycle_sample_count_total: 9007199254740992,
        lifecycle_sample_count_high: 9007199254740992,
        lifecycle_sample_count_medium: 1,
        lifecycle_sample_count_low: 0,
        preview_sample_count_total: 1,
        preview_sample_count_medium: 1,
      },
    ],
    ['a preview count one past the integer maximum', { preview_distinct_point_count: 2147483648 }],
    // NULLABLE TEXT is `string | null` and nothing else. A wrong type used to
    // collapse into `null`, silently dropping PROVENANCE while the row still
    // parsed and the write controls stayed enabled.
    ['a numeric preview coordinate source', { preview_coordinate_source: 42 }],
    ['an object lifecycle coordinate source', { lifecycle_coordinate_source: { a: 1 } }],
    ['a numeric source_dra_title', { source_dra_title: 7 }],
    ['an absent preview coordinate source', { preview_coordinate_source: undefined }],
    // A NON-NULL preview source implies a NON-NULL lifecycle source: the preview
    // aggregate's filter is a strict medium-tier SUBSET of the lifecycle one.
    ['a preview source with a null lifecycle source', { lifecycle_coordinate_source: null }],
    // --- V2 SOURCE-ARRAY CONTRACT, malformed shapes that fail closed ---
    // NULLABILITY IS A BICONDITIONAL: text and array are null together.
    ['a null source text with a non-null array', { preview_coordinate_source: null }],
    ['a null source array with non-null text', { preview_coordinate_sources: null }],
    ['a null lifecycle array with non-null text', { lifecycle_coordinate_sources: null }],
    // EMPTY IS NOT A SHAPE THE SQL EMITS -- an empty FILTER yields NULL.
    [
      'an empty preview source array',
      { preview_coordinate_source: null, preview_coordinate_sources: [] },
    ],
    // ELEMENT VALIDITY: non-blank strings only.
    ['a non-string source element', { preview_coordinate_sources: [42] }],
    ['an empty-string source element', { preview_coordinate_sources: [''] }],
    // SPACE-ONLY is what PostgreSQL's trim() strips, so `length(trim(x)) > 0`
    // excludes it and the SQL cannot emit it. Rejecting it is EXACT, not strict:
    // the U+00A0 case above proves the check did not widen to JS whitespace.
    // ISOLATING, and the shape of these cases is the point. Putting the
    // space-only value in the PREVIEW array alone would be caught by the SUBSET
    // check instead (it is absent from the lifecycle set), so the mutation would
    // attribute to the wrong invariant. Both arrays carry it, both texts render
    // it, and the populations coincide, so every other check passes and only the
    // space-only rejection can fire.
    [
      'a space-only source element',
      {
        preview_coordinate_source: '   ',
        preview_coordinate_sources: ['   '],
        lifecycle_coordinate_source: '   ',
        lifecycle_coordinate_sources: ['   '],
        lifecycle_sample_count_high: 0,
        lifecycle_sample_count_low: 0,
        lifecycle_sample_count_total: 6,
        lifecycle_coordinate_quality_tier: 'medium',
      },
    ],
    [
      'a single-space source element',
      {
        preview_coordinate_source: ' ',
        preview_coordinate_sources: [' '],
        lifecycle_coordinate_source: ' ',
        lifecycle_coordinate_sources: [' '],
        lifecycle_sample_count_high: 0,
        lifecycle_sample_count_low: 0,
        lifecycle_sample_count_total: 6,
        lifecycle_coordinate_quality_tier: 'medium',
      },
    ],
    ['a non-array source column', { preview_coordinate_sources: 'bc_csr_centroid' }],
    // ORDER AND UNIQUENESS come from ORDER BY over a COLLATE "C" column plus
    // DISTINCT, so a descending or duplicated array is version skew.
    [
      'a descending lifecycle source array',
      {
        lifecycle_coordinate_source: 'survey; bc_csr_centroid',
        lifecycle_coordinate_sources: ['survey', 'bc_csr_centroid'],
      },
    ],
    [
      'a duplicated source element',
      {
        lifecycle_coordinate_source: 'bc_csr_centroid; bc_csr_centroid',
        lifecycle_coordinate_sources: ['bc_csr_centroid', 'bc_csr_centroid'],
      },
    ],
    // THE TEXT MUST BE THE ARRAY'S RENDERING.
    [
      'text that does not match its array rendering',
      { lifecycle_coordinate_source: 'bc_csr_centroid; survey; extra' },
    ],
    [
      'text joined with the wrong separator',
      { lifecycle_coordinate_source: 'bc_csr_centroid,survey' },
    ],
    // SUBSET: a preview source absent from the lifecycle set means the panel
    // shows provenance the upsert would not persist.
    [
      'a preview source missing from the lifecycle set',
      {
        preview_coordinate_source: 'orphan',
        preview_coordinate_sources: ['orphan'],
      },
    ],
    // EQUALITY when the populations coincide -- subset alone would admit extras.
    [
      'a lifecycle set with extras although both tiers are zero',
      {
        lifecycle_sample_count_high: 0,
        lifecycle_sample_count_low: 0,
        lifecycle_sample_count_total: 6,
        lifecycle_coordinate_quality_tier: 'medium',
      },
    ],
    // When high and low are BOTH zero the lifecycle population IS the preview
    // population, so the two source aggregates run over identical rows and cannot
    // differ. The fixture is medium-only here so only this check can fire.
    [
      'differing sources when the two populations coincide',
      {
        lifecycle_sample_count_high: 0,
        lifecycle_sample_count_low: 0,
        lifecycle_sample_count_total: 6,
        lifecycle_coordinate_quality_tier: 'medium',
        lifecycle_coordinate_source: 'a different source',
      },
    ],
    // The SQL's row scope is `HAVING count(*) FILTER (medium) > 0`, so a
    // previewable cluster always has at least one medium sample. Everything else
    // about this row is internally consistent, which is why only this check
    // catches it.
    [
      'a preview medium count of zero',
      {
        preview_sample_count_total: 0,
        preview_sample_count_medium: 0,
        lifecycle_sample_count_medium: 0,
        lifecycle_sample_count_high: 1,
        lifecycle_sample_count_low: 0,
        lifecycle_sample_count_total: 1,
      },
    ],
    // PostgreSQL SERIALISES uuid values in lowercase, so an uppercase id is a
    // malformed response. It matters because `lifecycleRowKey` matches on exact
    // string equality while the candidate route lowercases: an existing candidate
    // would look ABSENT, and the page would offer Create for a write that would
    // actually refresh it.
    ['an uppercase source_dra_id', { source_dra_id: '3F2504E0-4F89-41D3-9A0C-0305E82C3301' }],
    ['a mixed-case source_dra_id', { source_dra_id: '3f2504e0-4f89-41d3-9A0C-0305e82c3301' }],
  ])('rejects %s', (_label, over) => {
    expect(parseLivePreviewRow(rawRow(over))).toBeNull();
  });

  /**
   * THE VALIDATOR MUST NOT BE STRICTER THAN THE DATABASE.
   *
   * A revision of this parser copied the candidate route's UUID regex wholesale,
   * including its RFC 4122 `[1-5]` version and `[89ab]` variant classes. The
   * PostgreSQL `uuid` type stores any 128-bit value and requires no such
   * conformance, so that rejected ids the RPC legitimately returns -- marking real
   * rows unreadable and DISABLING Create, Refresh and Publish for those DRAs.
   *
   * Every id below is taken from this repository's own replay and perf fixtures.
   * They are the regression test: a parser stricter than its producer is a
   * denial of service on valid data, not extra safety.
   */
  it.each([
    ['all-ones, non-RFC version and variant', '11111111-1111-1111-1111-111111111111'],
    ['leading a, non-RFC variant', 'a1111111-1111-1111-1111-111111111111'],
    ['all zeroes', '00000000-0000-0000-0000-000000000000'],
    ['an RFC 4122 v4 id, which must still work', 'a7600000-0000-4000-8000-000000000076'],
  ])('ACCEPTS %s -- PostgreSQL uuid is not restricted to RFC 4122', (_label, id) => {
    const parsed = parseLivePreviewRow(rawRow({ source_dra_id: id }));
    expect(parsed).not.toBeNull();
    expect(parsed?.source_dra_id).toBe(id);
  });

  /**
   * BOTH REPRESENTATIVE PAIRS ARE IDENTITY ASSERTIONS, and each is validated
   * against the SAME server key by the SAME sanctioned parser.
   *
   * The preview pair used to get only an eligibility check plus a hand-rolled
   * `!==` comparison against the lifecycle pair. That was a second, weaker copy of
   * a rule `parseServerClusterIdentity` already owns, and it drifted: `-0 !== 0`
   * is FALSE, so a `-0` preview latitude against a `+0` lifecycle latitude
   * compared EQUAL and the row was accepted.
   *
   * Equality between the two pairs is now TRANSITIVE -- each must match the key
   * exactly, so they match each other -- which is why no direct comparison
   * remains. These cases exercise the PREVIEW position specifically, because the
   * lifecycle position was the only one covered before.
   */
  describe('preview representative pair', () => {
    const zeroKey = { canonical_cluster_id: '0.00000,0.00000' } as const;

    it.each([
      ['a negative-zero preview LATITUDE against a positive-zero lifecycle', -0, 0, 0, 0],
      ['a negative-zero preview LONGITUDE against a positive-zero lifecycle', 0, -0, 0, 0],
      ['negative zero in BOTH preview axes', -0, -0, 0, 0],
      ['a negative-zero LIFECYCLE latitude against a positive-zero preview', 0, 0, -0, 0],
      ['negative zero in BOTH pairs, which agree with each other', -0, -0, -0, -0],
    ])('rejects %s', (_label, pLat, pLng, lLat, lLng) => {
      expect(
        parseLivePreviewRow(
          rawRow({
            ...zeroKey,
            preview_representative_latitude: pLat,
            preview_representative_longitude: pLng,
            lifecycle_representative_latitude: lLat,
            lifecycle_representative_longitude: lLng,
          }),
        ),
      ).toBeNull();
    });

    it('ACCEPTS a genuine positive-zero origin on both pairs', () => {
      // DISCRIMINATING: the signed-zero rejections must not take the reachable
      // origin with them.
      expect(
        parseLivePreviewRow(
          rawRow({
            ...zeroKey,
            preview_representative_latitude: 0,
            preview_representative_longitude: 0,
            lifecycle_representative_latitude: 0,
            lifecycle_representative_longitude: 0,
          }),
        ),
      ).not.toBeNull();
    });

    it('ACCEPTS ordinary negative nonzero coordinates on both pairs', () => {
      expect(
        parseLivePreviewRow(
          rawRow({
            canonical_cluster_id: '-49.28270,-123.12070',
            preview_representative_latitude: -49.2827,
            preview_representative_longitude: -123.1207,
            lifecycle_representative_latitude: -49.2827,
            lifecycle_representative_longitude: -123.1207,
          }),
        ),
      ).not.toBeNull();
    });

    it.each([
      ['a HALF-STEP preview latitude the key would round differently', 49.2827050005, -123.1207],
      ['an UNROUNDED preview longitude', 49.2827, -123.12070004],
      ['an out-of-range preview latitude', 500, -123.1207],
      ['a NaN preview longitude', 49.2827, Number.NaN],
    ])('rejects %s in the PREVIEW position', (_label, lat, lng) => {
      expect(
        parseLivePreviewRow(
          rawRow({
            preview_representative_latitude: lat,
            preview_representative_longitude: lng,
          }),
        ),
      ).toBeNull();
    });

    it('returns the PARSED preview coordinates, not the raw row fields', () => {
      // Validating one value and returning another is how a check becomes
      // decorative. These must be the numbers the parser vetted.
      const parsed = parseLivePreviewRow(rawRow());
      expect(parsed?.preview_representative_latitude).toBe(49.2827);
      expect(parsed?.preview_representative_longitude).toBe(-123.1207);
    });
  });

  it('still accepts the row the SQL actually emits', () => {
    // THE CONTROL. Without it the block above could pass against a parser that
    // rejects everything -- including every real row, which would disable the
    // admin surface entirely rather than harden it.
    const parsed = parseLivePreviewRow(rawRow());
    expect(parsed).not.toBeNull();
    expect(parsed?.preview_sample_count_total).toBe(6);
    expect(parsed?.lifecycle_sample_count_total).toBe(14);
  });

  /**
   * THE DERIVED-TIER CHECK MUST NOT BE NARROWER THAN THE SQL.
   *
   * The dominant-tier CASE can emit any of the three, and every one of these count
   * combinations is a row the function genuinely produces. A check that only ever
   * admitted the fixture's `high` would reject real rows and disable the admin
   * surface -- so this reversal is what stops the hardening from overshooting.
   *
   * The tie rows are the interesting ones: ties break high > medium > low, so
   * equal counts must resolve to the MORE severe tier, matching
   * `current_site_aggregate_snapshot` and the client's severity-ordered scan.
   */
  it.each([
    ['high dominant', 'high', { high: 7, medium: 6, low: 1 }],
    ['medium dominant', 'medium', { high: 2, medium: 6, low: 1 }],
    ['low dominant', 'low', { high: 1, medium: 2, low: 9 }],
    ['a high/medium tie resolving to high', 'high', { high: 6, medium: 6, low: 1 }],
    ['a medium/low tie resolving to medium', 'medium', { high: 0, medium: 6, low: 6 }],
    ['a three-way tie resolving to high', 'high', { high: 6, medium: 6, low: 6 }],
  ])('accepts %s and returns %s', (_label, tier, counts) => {
    const parsed = parseLivePreviewRow(
      rawRow({
        lifecycle_coordinate_quality_tier: tier,
        lifecycle_sample_count_high: counts.high,
        lifecycle_sample_count_medium: counts.medium,
        lifecycle_sample_count_low: counts.low,
        lifecycle_sample_count_total: counts.high + counts.medium + counts.low,
        // The two medium counts are the same aggregate, so the preview side moves
        // with it.
        preview_sample_count_total: counts.medium,
        preview_sample_count_medium: counts.medium,
      }),
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.lifecycle_coordinate_quality_tier).toBe(tier);
  });

  it('tolerates a null title and a null coordinate source', () => {
    // The TEXT and the ARRAY are null TOGETHER. `array_agg` with a FILTER that
    // matches nothing returns NULL exactly as `string_agg` does, so nulling only
    // one of the pair is a response shape the server cannot produce -- and the
    // parser now rejects it, which is why this fixture nulls both.
    const parsed = parseLivePreviewRow(
      rawRow({
        source_dra_title: null,
        preview_coordinate_source: null,
        preview_coordinate_sources: null,
      }),
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.source_dra_title).toBeNull();
    expect(parsed?.preview_coordinate_source).toBeNull();
    expect(parsed?.preview_coordinate_sources).toBeNull();
  });

  /**
   * V2 -- PROVENANCE IS VALIDATED AS A SET, and the text is only a rendering.
   *
   * The whole reason the RPC now returns arrays is that `coordinate_source` is
   * FREE-FORM TEXT and may contain the '; ' separator, which makes the flattened
   * `string_agg` output a LOSSY serialization. Any check that split the text back
   * into a set could reject legitimate database output. These cases pin the safe
   * direction: validate the array, and verify the text by JOINING.
   */
  describe('source arrays', () => {
    it('carries the sets through and keeps the text as their rendering', () => {
      const parsed = parseLivePreviewRow(rawRow());
      expect(parsed?.preview_coordinate_sources).toEqual(['bc_csr_centroid']);
      expect(parsed?.lifecycle_coordinate_sources).toEqual(['bc_csr_centroid', 'survey']);
      expect(parsed?.lifecycle_coordinate_source).toBe('bc_csr_centroid; survey');
    });

    it('ACCEPTS a source value that CONTAINS the separator', () => {
      // THE CASE THAT MOTIVATES THE WHOLE CHANGE. A split-based validator would
      // see three members here and could reject a perfectly legitimate row; the
      // join-based check reproduces the server text exactly.
      const sources = ['a; b', 'c'];
      const parsed = parseLivePreviewRow(
        rawRow({
          preview_coordinate_source: 'a; b; c',
          preview_coordinate_sources: sources,
          lifecycle_coordinate_source: 'a; b; c',
          lifecycle_coordinate_sources: sources,
          lifecycle_sample_count_high: 0,
          lifecycle_sample_count_low: 0,
          lifecycle_sample_count_total: 6,
          lifecycle_coordinate_quality_tier: 'medium',
        }),
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.preview_coordinate_sources).toEqual(['a; b', 'c']);
      expect(parsed?.preview_coordinate_source).toBe('a; b; c');
    });

    it('ACCEPTS a mixed-tier row whose preview set is a PROPER subset', () => {
      const parsed = parseLivePreviewRow(
        rawRow({
          preview_coordinate_source: 'bc_csr_centroid',
          preview_coordinate_sources: ['bc_csr_centroid'],
          lifecycle_coordinate_source: 'bc_csr_centroid; survey',
          lifecycle_coordinate_sources: ['bc_csr_centroid', 'survey'],
        }),
      );
      expect(parsed).not.toBeNull();
    });

    it('ACCEPTS both sets null together', () => {
      const parsed = parseLivePreviewRow(
        rawRow({
          preview_coordinate_source: null,
          preview_coordinate_sources: null,
          lifecycle_coordinate_source: null,
          lifecycle_coordinate_sources: null,
        }),
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.lifecycle_coordinate_sources).toBeNull();
    });

    it('ACCEPTS a source that is whitespace under JS trim but NOT under SQL trim', () => {
      // U+00A0. PostgreSQL's one-argument trim() strips SPACES only, so this
      // value SURVIVES `length(trim(x)) > 0` and legitimately reaches the client.
      // JavaScript's String.prototype.trim strips all Unicode whitespace, so a
      // mirrored blank-check here would reject a row the server can really send
      // -- a validator stricter than its producer. The parser therefore tests
      // EMPTINESS only, and this case is what stops that from regressing.
      const sources = ['\u00a0'];
      const parsed = parseLivePreviewRow(
        rawRow({
          preview_coordinate_source: '\u00a0',
          preview_coordinate_sources: sources,
          lifecycle_coordinate_source: '\u00a0',
          lifecycle_coordinate_sources: sources,
          lifecycle_sample_count_high: 0,
          lifecycle_sample_count_low: 0,
          lifecycle_sample_count_total: 6,
          lifecycle_coordinate_quality_tier: 'medium',
        }),
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.preview_coordinate_sources).toEqual(['\u00a0']);
    });

    it('ACCEPTS non-ASCII sources in UTF-8 byte order, which is COLLATE "C"', () => {
      // Byte order, not UTF-16 code-unit order. An emoji (4 UTF-8 bytes, leading
      // 0xF0) sorts ABOVE a BMP character such as U+00E9 (0xC3 0xA9) under
      // COLLATE "C", and the parser must agree with that rather than with
      // JavaScript's default string comparison.
      const sources = ['\u00e9cole', '\u{1f600}'];
      const parsed = parseLivePreviewRow(
        rawRow({
          preview_coordinate_source: sources.join('; '),
          preview_coordinate_sources: sources,
          lifecycle_coordinate_source: sources.join('; '),
          lifecycle_coordinate_sources: sources,
          lifecycle_sample_count_high: 0,
          lifecycle_sample_count_low: 0,
          lifecycle_sample_count_total: 6,
          lifecycle_coordinate_quality_tier: 'medium',
        }),
      );
      expect(parsed).not.toBeNull();
    });
  });
});

describe('loadAdminLivePreview -- a non-array payload FAILS CLOSED', () => {
  it.each([
    ['an object', { rows: [] }],
    ['a string', 'unexpected'],
    ['a number', 42],
    ['a boolean', true],
  ])('reports %s payload as a load error rather than an empty complete page', async (_l, payload) => {
    // The regression this pins: `Array.isArray(data) ? data : []` turned a
    // malformed successful response into a COMPLETE preview of zero rows, with no
    // error and no unreadable count -- so the page would have re-enabled the
    // lifecycle write controls on evidence it never actually received.
    const { client } = fakeClient([payload as unknown as unknown[]]);

    const result = await loadAdminLivePreview(client);

    expect(result.loadError).toMatch(/payload where a row array was expected/);
    expect(result.rows).toEqual([]);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('reports an ABSENT %s payload as a load error, not an empty complete page', async (_l, payload) => {
    // THIS ASSERTION IS REVERSED FROM ITS EARLIER FORM, deliberately. It used to
    // require that `null`/`undefined` be accepted as a legitimately empty page,
    // on the grounds that this is what PostgREST returns for an empty set. That
    // is not true of a SET-RETURNING function: its empty result is `[]`. A `null`
    // from the client accompanies an error, which the error branch already
    // handles -- so an absent payload on a SUCCESSFUL call is version skew, and
    // accepting it as complete re-enabled the lifecycle write controls on
    // evidence that was never received.
    const { client } = fakeClient([payload as unknown as unknown[]]);

    const result = await loadAdminLivePreview(client);

    expect(result.loadError).toMatch(/no payload where a row array was expected/);
    expect(result.rows).toEqual([]);
  });

  it('still treats a genuinely EMPTY ARRAY as a complete empty page', async () => {
    // The other side of the reversal, and the reason it is safe: `[]` IS what an
    // empty set-returning result looks like, so a database with no
    // preview-eligible clusters must still read as complete rather than broken.
    const { client } = fakeClient([[]]);

    const result = await loadAdminLivePreview(client);

    expect(result.loadError).toBeNull();
    expect(result.rows).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(result.unparsableRowCount).toBe(0);
  });
});

describe('sortPreviewRowsForDisplay', () => {
  const row = (id: string, total: number) =>
    ({ ...parseLivePreviewRow(rawRow())!, aggregate_id: id, preview_sample_count_total: total });

  it('orders by preview sample count DESCENDING, not by traversal order', () => {
    const sorted = sortPreviewRowsForDisplay([row('b', 5), row('a', 50), row('c', 20)]);
    expect(sorted.map((r) => r.aggregate_id)).toEqual(['a', 'c', 'b']);
  });

  it('breaks ties on aggregate_id ASCENDING, so repeated renders are identical', () => {
    const sorted = sortPreviewRowsForDisplay([row('z', 7), row('m', 7), row('a', 7)]);
    expect(sorted.map((r) => r.aggregate_id)).toEqual(['a', 'm', 'z']);
  });

  it('is DISCRIMINATING: the input order is not already the output order', () => {
    // Without this the two assertions above could pass against a no-op sort.
    const input = [row('b', 5), row('a', 50), row('c', 20)];
    expect(input.map((r) => r.aggregate_id)).not.toEqual(
      sortPreviewRowsForDisplay(input).map((r) => r.aggregate_id),
    );
  });

  it('does not mutate the caller array, which is the traversal result', () => {
    const input = [row('b', 5), row('a', 50)];
    sortPreviewRowsForDisplay(input);
    expect(input.map((r) => r.aggregate_id)).toEqual(['b', 'a']);
  });
});

describe('loadSiteAggregateLiveAdminSurface', () => {
  it('keeps the preview and candidate error axes separate', async () => {
    // The default state while the Option C SQL is unapplied: the candidate RPC
    // does not exist, so it errors. That must NOT reach the preview's error,
    // which gates the table, summary and map.
    const calls: Call[] = [];
    const client = {
      schema() {
        return {
          from() {
            throw new Error('unexpected table read');
          },
          async rpc(fn: string, args: Record<string, unknown>) {
            calls.push({ fn, args });
            if (fn === LIVE_PREVIEW_RPC) {
              return { data: [rawRow()], error: null };
            }
            return { data: null, error: { message: 'function does not exist' } };
          },
        };
      },
    } as unknown as AdminLoaderClient;

    const result = await loadSiteAggregateLiveAdminSurface(client);

    expect(result.preview.loadError).toBeNull();
    expect(result.preview.rows).toHaveLength(1);
    expect(result.candidateError).toBe('function does not exist');
    expect(result.candidates).toEqual([]);
    expect(calls[0].fn).toBe(LIVE_PREVIEW_RPC);
    expect(calls.some((c) => c.fn === 'fetch_admin_site_aggregate_publications')).toBe(true);
  });
});
