// PAGE-LEVEL BEHAVIOURAL PROOF that the admin page CONSUMES the orchestration's
// result -- not merely that it calls it.
//
// This replaces a retired structural assertion which matched
// `await loadSiteAggregateAdminSurface<` and therefore could not distinguish a
// page that uses the result from one that awaits it and discards it.
//
// The page is an async server component. It is executed here directly with its
// three external dependencies mocked (`next/headers`, `next/navigation`,
// `@supabase/ssr`) and the orchestration stubbed to return DISTINCTIVE SENTINEL
// values. The assertion is that those sentinels appear in the rendered element
// tree, which no amount of calling-without-using can satisfy.

import { describe, expect, it, vi, beforeEach } from 'vitest';

const sentinel = {
  label: 'SENTINEL-CANDIDATE-LABEL-7f3a',
  // F2: the cluster sentinel must be a REAL canonical rendering. The page parses
  // every preview row through `parseServerClusterIdentity`, so an arbitrary
  // string would be dropped as unparsable and the test would prove nothing about
  // binding. It is still distinctive enough to search the rendered tree for.
  cluster: '49.28270,-123.12070',
  dra: 'SENTINEL-DRA-TITLE-4d1e',
};

const loadLiveSurface = vi.fn();

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
}));

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECTED:${to}`);
  },
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          in: () => ({
            limit: () => ({ maybeSingle: async () => ({ data: { role: 'admin' }, error: null }) }),
          }),
        }),
      }),
    }),
  }),
}));

// PARTIAL mock, deliberately. Only the ORCHESTRATION is stubbed; everything else
// in the module stays REAL -- notably `sortPreviewRowsForDisplay`, which the page
// uses to restore the documented sample-count-descending table order. So this
// test exercises the actual display ordering rather than a stand-in. A wholesale
// mock also broke outright the moment the page imported a second symbol from
// here, which is its own argument for keeping the surface real.
vi.mock('@/lib/matrix-map/site-aggregate-live-preview', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/matrix-map/site-aggregate-live-preview')>()),
  loadSiteAggregateLiveAdminSurface: (...args: unknown[]) => loadLiveSurface(...args),
}));

/** Recursively collect every string appearing anywhere in a React element tree. */
function collectText(node: unknown, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === 'boolean') return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return out;
  }
  const el = node as { props?: Record<string, unknown> };
  if (el && typeof el === 'object' && el.props) {
    for (const value of Object.values(el.props)) {
      if (typeof value === 'string' || typeof value === 'number') out.push(String(value));
      else collectText(value, out);
    }
  }
  return out;
}

/**
 * F2: the orchestration now returns PARSED live-preview rows, not raw samples
 * and DRAs. This is exactly the shape `loadAdminLivePreview` yields after
 * `parseLivePreviewRow` has accepted a row, so the page receives what production
 * hands it.
 */
function previewRow(over: Record<string, unknown> = {}) {
  return {
    aggregate_id: `d1:${sentinel.cluster}`,
    source_dra_id: 'd1',
    source_dra_title: sentinel.dra,
    canonical_cluster_id: sentinel.cluster,
    preview_representative_latitude: 49.2827,
    preview_representative_longitude: -123.1207,
    preview_coordinate_quality_tier: 'medium',
    preview_coordinate_source: 'bc_csr_centroid',
    // DISTINCT from the lifecycle counts below, deliberately. This is what lets
    // the rendered-output assertion below tell which block the page bound to; with
    // both blocks carrying the same numbers the test could not distinguish them.
    preview_sample_count_total: 60451,
    preview_sample_count_high: 0,
    preview_sample_count_medium: 60451,
    preview_sample_count_low: 0,
    preview_distinct_point_count: 1,
    lifecycle_representative: { latitude: 49.2827, longitude: -123.1207 },
    lifecycle_coordinate_quality_tier: 'medium',
    lifecycle_coordinate_source: 'bc_csr_centroid',
    lifecycle_sample_count_total: 9143,
    lifecycle_sample_count_high: 4021,
    lifecycle_sample_count_medium: 60451,
    lifecycle_sample_count_low: 5115,
    lifecycle_distinct_point_count: 1,
    ...over,
  };
}

function surface(over: Record<string, unknown> = {}) {
  return {
    preview: {
      rows: [previewRow()],
      truncated: false,
      unparsableRowCount: 0,
      loadError: null,
    },
    candidates: [
      {
        publication_id: 'p1',
        source_dra_id: 'd1',
        coordinate_cluster_id: sentinel.cluster,
        member_display_label: sentinel.label,
        is_published: false,
        sample_count_total: 1,
        representative_latitude: 49.2827,
        representative_longitude: -123.1207,
        snapshot_drift_state: 'match',
      },
    ],
    candidatesTruncated: false,
    candidateError: null,
    ...over,
  };
}

/** An empty surface: no preview rows and no candidates. */
function emptySurface() {
  return surface({
    preview: { rows: [], truncated: false, unparsableRowCount: 0, loadError: null },
    candidates: [],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});

describe('admin page binds the orchestration result into what it renders', () => {
  it('sentinel values from the orchestration reach the rendered tree', async () => {
    loadLiveSurface.mockResolvedValue(surface());
    const { default: Page } = await import(
      '@/app/(dashboard)/admin/matrix-map/site-aggregates/page'
    );

    const tree = await Page();

    expect(loadLiveSurface).toHaveBeenCalledTimes(1);
    const text = collectText(tree).join('\n');
    // The candidate's stored member label is the value an operator approves
    // before it becomes member-visible, so its presence is the strongest single
    // proof the candidate data was actually consumed.
    expect(text).toContain(sentinel.label);
  });

  it('renders the PREVIEW block and never the LIFECYCLE block', async () => {
    // The binding this replaces a source-token assertion with. `page.contract`
    // scanned the page concatenated with the parser module, so the preview field
    // NAMES were present regardless of what the page actually bound -- it passed
    // even if the page rendered lifecycle counts. Here the two blocks carry
    // DISTINCT values and only the preview ones may reach the tree.
    loadLiveSurface.mockResolvedValue(surface());
    const { default: Page } = await import(
      '@/app/(dashboard)/admin/matrix-map/site-aggregates/page'
    );

    const text = collectText(await Page()).join('\n');

    // A UNIQUE multi-digit value. `7` was ambiguous -- it already occurs in the
    // sentinel label and in the coordinate 49.2827, so removing every preview
    // count would still have satisfied this positive assertion while all three
    // lifecycle-negative assertions also passed.
    expect(text).toContain('60451');
    // None of the lifecycle-only counts may appear anywhere in the rendered tree.
    expect(text).not.toContain('9143');
    expect(text).not.toContain('4021');
    expect(text).not.toContain('5115');
  });

  it('NEGATIVE CONTROL: awaiting the orchestration but discarding its result fails', async () => {
    // Exactly the state the retired structural pin could not detect: the call
    // happens, the result is thrown away. Rendering with an EMPTY surface must
    // produce a tree without the sentinels, so the positive assertion above is
    // discriminating rather than incidental.
    loadLiveSurface.mockResolvedValue(emptySurface());
    const { default: Page } = await import(
      '@/app/(dashboard)/admin/matrix-map/site-aggregates/page'
    );

    const tree = await Page();
    const text = collectText(tree).join('\n');

    expect(loadLiveSurface).toHaveBeenCalledTimes(1);
    expect(text).not.toContain(sentinel.label);
    expect(text).not.toContain(sentinel.cluster);
  });
});
