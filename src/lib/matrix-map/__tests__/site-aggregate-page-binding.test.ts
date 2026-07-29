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
  cluster: 'SENTINEL-CLUSTER-9b2c',
  dra: 'SENTINEL-DRA-TITLE-4d1e',
};

const loadSiteAggregateAdminSurface = vi.fn();

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

vi.mock('@/lib/matrix-map/site-aggregate-admin-loaders', () => ({
  loadSiteAggregateAdminSurface: (...args: unknown[]) =>
    loadSiteAggregateAdminSurface(...args),
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

function surface(over: Record<string, unknown> = {}) {
  return {
    samples: [
      {
        source_dra_id: 'd1',
        coordinate_quality_tier: 'medium',
        coordinate_source: 'bc_csr_centroid',
        latitude: 49.5,
        longitude: -123.5,
      },
    ],
    truncated: false,
    draRows: [{ id: 'd1', title: sentinel.dra, public: false }],
    drasTruncated: false,
    candidates: [
      {
        publication_id: 'p1',
        source_dra_id: 'd1',
        coordinate_cluster_id: sentinel.cluster,
        member_display_label: sentinel.label,
        is_published: false,
        sample_count_total: 1,
        snapshot_drift_state: 'match',
      },
    ],
    candidatesTruncated: false,
    loadError: null,
    candidateError: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});

describe('admin page binds the orchestration result into what it renders', () => {
  it('sentinel values from the orchestration reach the rendered tree', async () => {
    loadSiteAggregateAdminSurface.mockResolvedValue(surface());
    const { default: Page } = await import(
      '@/app/(dashboard)/admin/matrix-map/site-aggregates/page'
    );

    const tree = await Page();

    expect(loadSiteAggregateAdminSurface).toHaveBeenCalledTimes(1);
    const text = collectText(tree).join('\n');
    // The candidate's stored member label is the value an operator approves
    // before it becomes member-visible, so its presence is the strongest single
    // proof the candidate data was actually consumed.
    expect(text).toContain(sentinel.label);
  });

  it('NEGATIVE CONTROL: awaiting the orchestration but discarding its result fails', async () => {
    // Exactly the state the retired structural pin could not detect: the call
    // happens, the result is thrown away. Rendering with an EMPTY surface must
    // produce a tree without the sentinels, so the positive assertion above is
    // discriminating rather than incidental.
    loadSiteAggregateAdminSurface.mockResolvedValue(
      surface({ candidates: [], draRows: [], samples: [] }),
    );
    const { default: Page } = await import(
      '@/app/(dashboard)/admin/matrix-map/site-aggregates/page'
    );

    const tree = await Page();
    const text = collectText(tree).join('\n');

    expect(loadSiteAggregateAdminSurface).toHaveBeenCalledTimes(1);
    expect(text).not.toContain(sentinel.label);
    expect(text).not.toContain(sentinel.cluster);
  });
});
