// PROOF THAT THE ADMIN PAGE ACTUALLY INVOKES ITS LOADERS.
//
// A review demonstrated that scanning the page and the loader module as
// CONCATENATED TEXT proves only that the code EXISTS somewhere: removing the
// page's `loadAdminCandidates(...)` call while keeping the import left all 44
// relocated contract assertions green, in a state where the admin page would
// silently lose every candidate and every lifecycle control.
//
// Three properties are therefore distinguished and proved SEPARATELY:
//
//   1. the implementation EXISTS         -- the loader unit tests
//   2. the implementation is CONSTRAINED -- the column-projection and
//                                           containment checks in the page
//                                           contract test, plus the OBSERVED
//                                           runtime RPC, table and ordering
//                                           calls recorded in
//                                           site-aggregate-pagination-behaviour.test.ts
//   3. the page INVOKES it               -- see site-aggregate-page-binding.test.ts
//
// (2) deliberately makes NO claim about which RPCs are reachable in the module
// as a static universe. The regex/AST allow-list that once asserted that was
// retired: a call reached through an alias or a bound function is not a call
// expression whose callee is named `rpc`, so it could not enforce the claim.
// What replaced it is evidence of the calls actually made on the paths those
// tests exercise -- narrower, but true.
//
// An import-only assertion is explicitly insufficient for (3), and a structural
// source assertion that merely proves the call exists was RETIRED: it could not
// distinguish a page that awaits the orchestration from one that awaits it and
// discards the result.

import { describe, expect, it } from 'vitest';
import { loadSiteAggregateAdminSurface } from '../site-aggregate-admin-loaders';
import { PAGE_SIZE } from '../site-aggregate-pagination';

/**
 * Records which tables and RPCs the orchestration actually touched, so
 * "all three loaders ran" is proved by OBSERVED CALLS rather than by source.
 */
function recordingClient(rows: {
  samples?: Record<string, unknown>[];
  dras?: Record<string, unknown>[];
  candidates?: Record<string, unknown>[];
}) {
  const tables: string[] = [];
  const rpcs: string[] = [];
  const makeQuery = (table: string) => {
    const q = {
      select: () => q,
      eq: () => q,
      order: () => q,
      range: async () => ({
        data: table === 'samples' ? (rows.samples ?? []) : (rows.dras ?? []),
        error: null,
      }),
    };
    return q;
  };
  const client = {
    schema: () => ({
      from: (table: string) => {
        tables.push(table);
        return makeQuery(table);
      },
      rpc: async (fn: string) => {
        rpcs.push(fn);
        return { data: rows.candidates ?? [], error: null };
      },
    }),
  };
  return { client, tables, rpcs };
}

describe('admin surface orchestration: the loaders are actually invoked', () => {
  it('runs ALL THREE loaders and returns each result', async () => {
    const { client, tables, rpcs } = recordingClient({
      samples: [{ source_dra_id: 'd1', coordinate_quality_tier: 'medium' }],
      dras: [{ id: 'd1', title: 'DRA one', public: false }],
      candidates: [{ publication_id: 'p1', source_dra_id: 'd1' }],
    });

    const out = await loadSiteAggregateAdminSurface(client as never);

    // OBSERVED CALLS, not source text.
    expect(tables).toEqual(['samples', 'dras']);
    expect(rpcs).toEqual(['fetch_admin_site_aggregate_publications']);

    // ...and each loader's result reaches the returned surface.
    expect(out.samples).toHaveLength(1);
    expect(out.draRows).toHaveLength(1);
    expect(out.candidates).toHaveLength(1);
    expect(out.loadError).toBeNull();
    expect(out.candidateError).toBeNull();
  });

  it('NEGATIVE CONTROL: dropping the candidates load is observable', async () => {
    // The exact regression the concatenated-source guard could not see -- if the
    // candidates never load, the lifecycle surface is empty. This test fails on
    // the RESULT, so no amount of dead-but-present loader code satisfies it.
    const { client } = recordingClient({ samples: [], dras: [], candidates: [] });
    const out = await loadSiteAggregateAdminSurface(client as never);
    expect(out.candidates).toEqual([]);
    // A surface with no candidates is distinguishable from one with candidates,
    // which is what makes the positive assertion above meaningful.
    const populated = recordingClient({
      samples: [],
      dras: [],
      candidates: [{ publication_id: 'p1' }],
    });
    const out2 = await loadSiteAggregateAdminSurface(populated.client as never);
    expect(out2.candidates).toHaveLength(1);
    expect(out2.candidates).not.toEqual(out.candidates);
  });

  it('preserves error ROUTING: a candidate failure never reaches loadError', async () => {
    const client = {
      schema: () => ({
        from: () => {
          const q = {
            select: () => q,
            eq: () => q,
            order: () => q,
            range: async () => ({ data: [], error: null }),
          };
          return q;
        },
        rpc: async () => ({ data: null, error: { message: 'rpc exploded' } }),
      }),
    };
    const out = await loadSiteAggregateAdminSurface(client as never);
    expect(out.candidateError).toBe('rpc exploded');
    // The preview axis must stay clean, or a failing candidate RPC would blank
    // the medium-tier table, summary and map.
    expect(out.loadError).toBeNull();
  });

  it('preserves error ROUTING: a DRA failure fills loadError only if samples did not', async () => {
    let call = 0;
    const client = {
      schema: () => ({
        from: () => {
          const isSamples = call === 0;
          call += 1;
          const q = {
            select: () => q,
            eq: () => q,
            order: () => q,
            range: async () =>
              isSamples
                ? { data: [], error: { message: 'samples exploded' } }
                : { data: [], error: { message: 'dras exploded' } },
          };
          return q;
        },
        rpc: async () => ({ data: [], error: null }),
      }),
    };
    const out = await loadSiteAggregateAdminSurface(client as never);
    // Samples ran first, so its message wins -- unchanged from the inline code.
    expect(out.loadError).toBe('samples exploded');
  });

  it('preserves TRUNCATION flags across all three loaders', async () => {
    const full = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `x${i}` }));
    const { client } = recordingClient({
      samples: full(PAGE_SIZE),
      dras: full(PAGE_SIZE),
      candidates: full(PAGE_SIZE),
    });
    const out = await loadSiteAggregateAdminSurface(client as never);
    expect(out.truncated).toBe(true);
    expect(out.drasTruncated).toBe(true);
    expect(out.candidatesTruncated).toBe(true);
  });
});
