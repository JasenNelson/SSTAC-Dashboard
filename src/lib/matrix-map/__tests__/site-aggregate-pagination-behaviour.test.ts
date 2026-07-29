// RUNTIME EVIDENCE for the consolidated pagination envelope. This file is the
// PRIMARY evidence for the envelope -- not a supplement to a source-shape check.
//
// Source-shape guards previously stood alongside these tests and were RETIRED by
// mission-control ruling: they claimed more than they enforced, and a review
// demonstrated that a consumer computing `(page + 1) * PAGE_SIZE` would reach
// offset 25000, fail closed at the SQL ceiling with UE422, and leave every
// source-shape assertion green. Do not reintroduce them and do not substitute a
// regex, token window or AST approximation for what is asserted here.
//
// These tests CAPTURE THE ACTUAL ARGUMENTS each consumer sends and compare them
// ELEMENT FOR ELEMENT -- never a count, a minimum, a maximum or the endpoints.
// All three consumers are covered, including the admin path, whose loops were
// extracted into `site-aggregate-admin-loaders.ts` precisely so they could be
// executed here. Each paginating consumer carries BOTH traversal modes: the full
// 25-page traversal and a short-page termination.

import { describe, expect, it, vi } from 'vitest';

type PageArgs = { p_limit: number; p_offset: number };

import { fetchMatrixMapSiteAggregatesServerSide } from '../fetch-site-aggregates-server';
import {
  loadAdminCandidates,
  loadAdminDras,
  loadAdminMediumTierSamples,
} from '../site-aggregate-admin-loaders';
import {
  PAGE_SIZE,
  MAX_PAGES,
  MAX_PAGE_OFFSET,
  siteAggregatePageArgs,
  siteAggregatePageIndexes,
} from '../site-aggregate-pagination';

const FIRST_CALL = { p_limit: 1000, p_offset: 0 };
const LAST_CALL = { p_limit: 1000, p_offset: 24000 };

function row(i: number) {
  return { id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}` };
}
const fullPage = () => Array.from({ length: PAGE_SIZE }, (_, i) => row(i));

/**
 * The COMPLETE expected offset sequence, derived through the shared authority
 * rather than restated: [0, 1000, 2000, ..., 24000].
 */
const EXPECTED_OFFSETS = siteAggregatePageIndexes().map(
  (page) => siteAggregatePageArgs(page).p_offset,
);

/**
 * Asserts the FULL ordered call sequence, element for element.
 *
 * Deliberately NOT count + endpoints + range. A review mutated page 10 to return
 * offset 9000: the count stayed 25, the first and last elements were still 0 and
 * 24000, and every element remained inside [0, 24000] -- so an
 * aggregate-properties check stayed green while the run DUPLICATED offset 9000
 * and OMITTED offset 10000, silently double-reading one page and skipping rows
 * 10000-10999. Only an exact sequence comparison catches that.
 */
const EXPECTED_RANGES: Array<[number, number]> = EXPECTED_OFFSETS.map((o) => [o, o + PAGE_SIZE - 1]);

/** Exact inclusive range windows, element-for-element. Never count/min/max. */
function expectExactRanges(ranges: Array<[number, number]>) {
  expect(ranges).toEqual(EXPECTED_RANGES);
}

/** Exact ordered PREFIX for a short-page stop, and proof nothing followed it. */
function expectExactPrefix(args: PageArgs[], pages: number) {
  expect(args).toEqual(
    EXPECTED_OFFSETS.slice(0, pages).map((p_offset) => ({ p_limit: PAGE_SIZE, p_offset })),
  );
  // The equality above already fixes the length; these state the termination
  // claim directly, so "nothing was requested after the short page" is an
  // assertion in its own right rather than a side effect of deep equality.
  expect(args).toHaveLength(pages);
  expect(args[pages]).toBeUndefined();
}

function expectExactRangePrefix(ranges: Array<[number, number]>, pages: number) {
  expect(ranges).toEqual(EXPECTED_RANGES.slice(0, pages));
  expect(ranges).toHaveLength(pages);
  expect(ranges[pages]).toBeUndefined();
}

function expectExactSequence(args: PageArgs[]) {
  expect(args.map((a) => a.p_offset)).toEqual(EXPECTED_OFFSETS);
  expect(args.map((a) => a.p_limit)).toEqual(EXPECTED_OFFSETS.map(() => PAGE_SIZE));
  // Endpoints restated for readability; the sequence equality above is the claim.
  expect(args[0]).toEqual(FIRST_CALL);
  expect(args[args.length - 1]).toEqual(LAST_CALL);
  expect(EXPECTED_OFFSETS[EXPECTED_OFFSETS.length - 1]).toBe(MAX_PAGE_OFFSET);
}

describe('the sequence assertion is capable of firing', () => {
  it('NEGATIVE CONTROL: rejects a sequence that duplicates 9000 and omits 10000', () => {
    // The exact regression the aggregate-properties version could not see.
    const corrupted = EXPECTED_OFFSETS.map((offset) => (offset === 10000 ? 9000 : offset)).map(
      (p_offset) => ({ p_limit: PAGE_SIZE, p_offset }),
    );
    // Same length, same endpoints, every element still within range...
    expect(corrupted).toHaveLength(MAX_PAGES);
    expect(corrupted[0]).toEqual(FIRST_CALL);
    expect(corrupted[corrupted.length - 1]).toEqual(LAST_CALL);
    expect(corrupted.every((a) => a.p_offset >= 0 && a.p_offset <= MAX_PAGE_OFFSET)).toBe(true);
    // ...yet 9000 appears twice and 10000 not at all.
    expect(corrupted.filter((a) => a.p_offset === 9000)).toHaveLength(2);
    expect(corrupted.some((a) => a.p_offset === 10000)).toBe(false);
    // And the sequence assertion MUST reject it.
    expect(() => expectExactSequence(corrupted)).toThrow();

    // The SAME corruption expressed as range windows must be rejected too, so
    // the range consumers are covered by the identical method rather than by a
    // weaker endpoint check.
    const corruptedRanges: Array<[number, number]> = EXPECTED_RANGES.map(([from, to]) =>
      from === 10000 ? ([9000, 9999] as [number, number]) : ([from, to] as [number, number]),
    );
    expect(corruptedRanges).toHaveLength(MAX_PAGES);
    expect(corruptedRanges[0]).toEqual([0, 999]);
    expect(corruptedRanges[corruptedRanges.length - 1]).toEqual([24000, 24999]);
    expect(corruptedRanges.filter(([f]) => f === 9000)).toHaveLength(2);
    expect(corruptedRanges.some(([f]) => f === 10000)).toBe(false);
    expect(() => expectExactRanges(corruptedRanges)).toThrow();
  });

  it('accepts the true sequence', () => {
    expect(() =>
      expectExactSequence(EXPECTED_OFFSETS.map((p_offset) => ({ p_limit: PAGE_SIZE, p_offset }))),
    ).not.toThrow();
  });
});

describe('the shared constructor is the sole authority', () => {
  it('produces the first and last legitimate calls exactly', () => {
    expect(siteAggregatePageArgs(0)).toEqual(FIRST_CALL);
    expect(siteAggregatePageArgs(MAX_PAGES - 1)).toEqual(LAST_CALL);
  });

  it('refuses invalid, non-integer and out-of-range page indexes', () => {
    for (const bad of [-1, MAX_PAGES, MAX_PAGES + 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => siteAggregatePageArgs(bad), `page ${bad}`).toThrow(RangeError);
    }
  });
});

/**
 * Records every `.rpc()` argument object and every `.range()` window.
 *
 * `pageFor` is keyed on the OFFSET THE LOADER ACTUALLY SUPPLIED, never on the
 * call index. Keying on the index would make a loader that re-requested the
 * same offset -- the duplicate-page-9 regression -- receive the fixtures for
 * the pages it skipped, so a short-page scenario would terminate identically
 * whether or not the sequence was corrupt. Keyed on the offset, a corrupted
 * traversal is served the page it really asked for and the exact-sequence
 * assertions below are what decide the outcome.
 */
function recordingClient(pageFor: (offset: number) => unknown[]) {
  const rpcArgs: PageArgs[] = [];
  const ranges: Array<[number, number]> = [];
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    range: async (from: number, to: number) => {
      ranges.push([from, to]);
      return { data: pageFor(from), error: null };
    },
  };
  const client = {
    schema: () => ({
      from: () => query,
      rpc: async (_fn: string, args: PageArgs) => {
        rpcArgs.push({ p_limit: args.p_limit, p_offset: args.p_offset });
        return { data: pageFor(args.p_offset), error: null };
      },
    }),
  };
  return { client, rpcArgs, ranges };
}

/** Full pages up to (but excluding) `shortAtOffset`, then one short page. */
function shortAt(shortAtOffset: number, shortRow: unknown) {
  return (offset: number) => (offset < shortAtOffset ? fullPage() : [shortRow]);
}

describe('admin loaders: OBSERVED runtime RPC and table calls on the exercised paths', () => {
  // SCOPE, STATED NARROWLY. These record what the loaders ACTUALLY invoked when
  // executed on the paths exercised here. They are NOT a universal static RPC
  // allow-list and must not be described as one: a path not exercised by these
  // tests is simply not covered by them.
  //
  // That is a deliberate downgrade in claim. page.contract.test.ts used to
  // assert, by regex and by a TypeScript-compiler AST walk, that the only
  // `.rpc(...)` literals reachable from the page and its loaders were the
  // permitted read. It could not enforce that -- a call reached through an alias
  // or a bound function is not a call expression whose callee is named `rpc` --
  // so the claim was retired rather than restated here.
  //
  // What these DO give, which the scanner never did: evidence that cannot be
  // evaded by how a call is spelled.
  function namesRecordingClient() {
    const rpcNames: string[] = [];
    const tables: string[] = [];
    const orders: string[] = [];
    const query = {
      select: () => query,
      eq: () => query,
      order: (column: string) => {
        orders.push(column);
        return query;
      },
      range: async () => ({ data: [], error: null }),
    };
    const client = {
      schema: () => ({
        from: (table: string) => {
          tables.push(table);
          return query;
        },
        rpc: async (fn: string) => {
          rpcNames.push(fn);
          return { data: [], error: null };
        },
      }),
    };
    return { client, rpcNames, tables, orders };
  }

  it('the candidates loader, when executed, calls only the read RPC and touches no table', async () => {
    const { client, rpcNames, tables } = namesRecordingClient();
    await loadAdminCandidates(client as never);
    expect(rpcNames).toEqual(['fetch_admin_site_aggregate_publications']);
    expect(tables).toEqual([]);
  });

  it('the range loaders, when executed, read only their own table and call no RPC', async () => {
    const samples = namesRecordingClient();
    await loadAdminMediumTierSamples(samples.client as never);
    expect(samples.tables).toEqual(['samples']);
    expect(samples.rpcNames).toEqual([]);

    const dras = namesRecordingClient();
    await loadAdminDras(dras.client as never);
    expect(dras.tables).toEqual(['dras']);
    expect(dras.rpcNames).toEqual([]);
  });

  it('the range loaders order by a TOTAL order, proved by the columns actually ordered on', async () => {
    // `source_dra_id` is not unique -- one DRA holds many rows, so its ties
    // straddle a 1000-row page boundary. Without a unique tiebreaker Postgres
    // may order ties differently between independent .range() calls, silently
    // skipping or duplicating rows while `truncated` stays false. Asserted on
    // the columns the loader ACTUALLY ordered by, in order, rather than on how
    // the call happens to be spelled in source.
    const samples = namesRecordingClient();
    await loadAdminMediumTierSamples(samples.client as never);
    expect(samples.orders).toEqual(['source_dra_id', 'id']);

    // `id` is the primary key, so the DRA load needs no second tiebreaker.
    const dras = namesRecordingClient();
    await loadAdminDras(dras.client as never);
    expect(dras.orders).toEqual(['id']);
  });

  it('the member loader, when executed, calls only the published-aggregates read RPC', async () => {
    const rpcNames: string[] = [];
    const client = {
      schema: () => ({
        rpc: async (fn: string) => {
          rpcNames.push(fn);
          return { data: [], error: null };
        },
      }),
    };
    await fetchMatrixMapSiteAggregatesServerSide(client as never);
    expect(rpcNames).toEqual(['fetch_published_site_aggregates']);
  });

  it('NEGATIVE CONTROL: a loader calling an unapproved RPC would be caught', async () => {
    // Proves the assertion above is capable of firing, rather than passing
    // because nothing was ever recorded.
    const { client, rpcNames } = namesRecordingClient();
    await client.schema().rpc('unapproved_rpc');
    expect(rpcNames).toEqual(['unapproved_rpc']);
    expect(() => expect(rpcNames).toEqual(['fetch_admin_site_aggregate_publications'])).toThrow();
  });
});

describe('admin candidates loader: actual RPC arguments', () => {
  it('first call 0, final possible call 24000, none beyond', async () => {
    const { client, rpcArgs } = recordingClient(fullPage);
    const out = await loadAdminCandidates(client as never);
    expectExactSequence(rpcArgs);
    // Existing behaviour preserved: 25 full pages flag truncation, not an error.
    expect(out.candidatesTruncated).toBe(true);
    expect(out.candidateError).toBeNull();
  });

  it('stops normally on a short page', async () => {
    const { client, rpcArgs } = recordingClient(shortAt(2000, row(9)));
    const out = await loadAdminCandidates(client as never);
    expectExactPrefix(rpcArgs, 3);
    expect(out.candidatesTruncated).toBe(false);
  });
});

// BOTH range loaders get BOTH traversal modes.
//
// An earlier revision tested samples only at the FULL cap and DRAs only through
// a two-page SHORT stop. That left no sample short-prefix proof and no DRA
// 25-page traversal proof -- and, decisively, mutating the DRA loader to repeat
// page 9 and omit page 10 did not change the short-DRA scenario, so the
// regression was not caught INDEPENDENTLY for that loader. Each loader now
// carries a full traversal asserted element-for-element and a short-prefix
// termination, so the page-9/page-10 mutation fails that loader's OWN test.
describe('admin samples loader: actual range windows', () => {
  it('samples FULL traversal: exactly [0,999] ... [24000,24999], capped at 24000', async () => {
    const { client, ranges } = recordingClient(fullPage);
    const out = await loadAdminMediumTierSamples(client as never);
    expectExactRanges(ranges);
    expect(ranges[0]).toEqual([0, 999]);
    expect(ranges[ranges.length - 1]).toEqual([MAX_PAGE_OFFSET, MAX_PAGE_OFFSET + PAGE_SIZE - 1]);
    expect(ranges).toHaveLength(MAX_PAGES);
    expect(out.truncated).toBe(true);
    expect(out.loadError).toBeNull();
  });

  it('samples SHORT stop: exact prefix, and nothing requested after the short page', async () => {
    const { client, ranges } = recordingClient(shortAt(3000, row(7)));
    const out = await loadAdminMediumTierSamples(client as never);
    expectExactRangePrefix(ranges, 4);
    expect(out.truncated).toBe(false);
    expect(out.loadError).toBeNull();
  });
});

describe('admin DRA loader: actual range windows', () => {
  it('dras FULL traversal: exactly [0,999] ... [24000,24999], capped at 24000', async () => {
    const { client, ranges } = recordingClient(fullPage);
    const out = await loadAdminDras(client as never);
    expectExactRanges(ranges);
    expect(ranges[0]).toEqual([0, 999]);
    expect(ranges[ranges.length - 1]).toEqual([MAX_PAGE_OFFSET, MAX_PAGE_OFFSET + PAGE_SIZE - 1]);
    expect(ranges).toHaveLength(MAX_PAGES);
    expect(out.drasTruncated).toBe(true);
    expect(out.draError).toBeNull();
  });

  it('dras SHORT stop: exact prefix, and nothing requested after the short page', async () => {
    const { client, ranges } = recordingClient(shortAt(1000, row(3)));
    const out = await loadAdminDras(client as never);
    expectExactRangePrefix(ranges, 2);
    expect(out.drasTruncated).toBe(false);
    expect(out.draError).toBeNull();
  });
});

describe('member loader: actual RPC arguments and failure semantics', () => {
  // Keyed on the supplied `p_offset`, never on the call index -- same reason as
  // `recordingClient` above.
  function memberClient(pageFor: (offset: number) => unknown[]) {
    const rpcArgs: PageArgs[] = [];
    const rpc = vi.fn(async (fnName: string, args: PageArgs) => {
      expect(fnName).toBe('fetch_published_site_aggregates');
      rpcArgs.push({ p_limit: args.p_limit, p_offset: args.p_offset });
      return { data: pageFor(args.p_offset), error: null };
    });
    const client = { schema: vi.fn(() => ({ rpc })) };
    return { client, rpcArgs };
  }

  function publishedRow(i: number) {
    return {
      aggregate_id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      label: `Aggregate ${i}`,
      representative_latitude: 49.5,
      representative_longitude: -123.5,
      coordinate_quality_tier: 'medium',
      sample_count_bucket: '1',
      data_snapshot_version: 'v1',
      visible_sample_suppression_key: null,
    };
  }
  const fullPublishedPage = () => Array.from({ length: PAGE_SIZE }, (_, i) => publishedRow(i));

  it('first call 0, final possible call 24000, and FAILS CLOSED at the cap', async () => {
    const { client, rpcArgs } = memberClient(fullPublishedPage);
    const result = await fetchMatrixMapSiteAggregatesServerSide(client as never);
    expectExactSequence(rpcArgs);
    // Distinct from the admin loaders: an incomplete member map is not safe to
    // render, so the cap surfaces as an error rather than a truncation flag.
    expect(result.siteAggregateFetchErrorMessage).toBeTruthy();
  });

  it('stops at the first short page and asks for nothing beyond it', async () => {
    const { client, rpcArgs } = memberClient((offset) =>
      offset < 2000 ? fullPublishedPage() : [publishedRow(9999)],
    );
    const result = await fetchMatrixMapSiteAggregatesServerSide(client as never);
    expectExactPrefix(rpcArgs, 3);
    expect(result.siteAggregateFetchErrorMessage).toBeFalsy();
  });

  it('requests exactly one page when the very first page is short', async () => {
    const { client, rpcArgs } = memberClient(() => [publishedRow(1)]);
    await fetchMatrixMapSiteAggregatesServerSide(client as never);
    expectExactPrefix(rpcArgs, 1);
  });
});
