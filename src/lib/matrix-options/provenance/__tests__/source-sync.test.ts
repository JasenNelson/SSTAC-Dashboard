import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchHitlSources, submitSource, deleteHitlSource } from '../source-sync';
import { createAuthenticatedClient } from '@/lib/supabase-auth';

// Chainable Supabase builder mock (thenable -> the queued result).
const mockFrom = vi.fn();
let result: Record<string, unknown> = { data: null, error: null };

function builder() {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'order', 'eq', 'insert', 'single']) {
    b[m] = vi.fn(() => b);
  }
  (b as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return b;
}

vi.mock('@/lib/supabase-auth', () => ({
  createAuthenticatedClient: vi.fn(() =>
    Promise.resolve({ auth: { getUser: vi.fn() }, from: mockFrom }),
  ),
}));

beforeEach(() => {
  mockFrom.mockReset();
  mockFrom.mockImplementation(() => builder());
  result = { data: null, error: null };
  // The error-path tests below intentionally drive the module's console.error /
  // console.warn logging; suppress it so the suite output stays clean.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

function dbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    source_id: 'src-1',
    short_citation: 'x',
    title: 't',
    year: 2024,
    publisher: 'p',
    doi: null,
    url: null,
    zotero_key: null,
    zotero_item_type: null,
    zotero_parent_key: null,
    authority_scope: 'BC',
    authority_tier: 'tier_1_government_or_regulatory',
    currentness_status: 'current',
    bc_protocol_alignment: 'none',
    canonical_source_status: 'direct_source_verified',
    role: 'canonical_candidate',
    retrieval_status: 'partial',
    retrieval_date: '2026-05-01',
    source_date: '2024-01-01',
    qa_date: '2026-05-02',
    created_at: 't',
    created_by: null,
    updated_at: 't',
    ...overrides,
  };
}

describe('source-sync rowToSource retrieval fields (P2-4)', () => {
  it('maps retrieval_status + the three dates from the db row', async () => {
    result = { data: [dbRow()], error: null };
    const rows = await fetchHitlSources();
    expect(rows[0].retrieval_status).toBe('partial');
    expect(rows[0].retrieval_date).toBe('2026-05-01');
    expect(rows[0].source_date).toBe('2024-01-01');
    expect(rows[0].qa_date).toBe('2026-05-02');
  });

  it('narrows an invalid retrieval_status to null', async () => {
    result = { data: [dbRow({ retrieval_status: 'bogus' })], error: null };
    const rows = await fetchHitlSources();
    expect(rows[0].retrieval_status).toBeNull();
  });

  it('defaults missing retrieval fields to null', async () => {
    result = {
      data: [
        dbRow({
          retrieval_status: null,
          retrieval_date: null,
          source_date: null,
          qa_date: null,
        }),
      ],
      error: null,
    };
    const rows = await fetchHitlSources();
    expect(rows[0].retrieval_status).toBeNull();
    expect(rows[0].retrieval_date).toBeNull();
    expect(rows[0].source_date).toBeNull();
    expect(rows[0].qa_date).toBeNull();
  });

  it('coalesces null optional db fields to safe defaults', async () => {
    result = {
      data: [
        dbRow({
          year: null,
          publisher: null,
          authority_scope: null,
          authority_tier: null,
          currentness_status: null,
          bc_protocol_alignment: null,
          canonical_source_status: null,
          role: null,
        }),
      ],
      error: null,
    };
    const rows = await fetchHitlSources();
    expect(rows[0].year).toBeNull();
    expect(rows[0].publisher).toBe('');
    expect(rows[0].authority_scope).toBe('');
    expect(rows[0].authority_tier).toBe('');
    expect(rows[0].currentness_status).toBe('');
    expect(rows[0].bc_protocol_alignment).toBe('');
    expect(rows[0].canonical_source_status).toBe('');
    expect(rows[0].role).toBe('');
  });

  it('returns [] on a Supabase error', async () => {
    result = { data: null, error: { message: 'relation does not exist' } };
    expect(await fetchHitlSources()).toEqual([]);
  });

  it('returns [] when data is null but there is no error', async () => {
    result = { data: null, error: null };
    expect(await fetchHitlSources()).toEqual([]);
  });

  it('returns [] when createAuthenticatedClient throws', async () => {
    vi.mocked(createAuthenticatedClient).mockRejectedValueOnce(new Error('boom'));
    expect(await fetchHitlSources()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// submitSource + deleteHitlSource: auth, role, mutation, and error branches.
//
// These exercise multi-call flows (auth.getUser, a user_roles query, and a
// catalog_sources mutation), so they install a per-test client via
// createAuthenticatedClient().mockResolvedValueOnce(...) rather than the shared
// `result` builder used by the fetch tests above. Each function-under-test
// awaits createAuthenticatedClient exactly once, so the once-override is fully
// consumed and never leaks into the existing tests.
// ---------------------------------------------------------------------------

interface ClientOpts {
  user?: { id: string } | null;
  rolesData?: unknown;
  // Terminal { data, error } for any catalog_sources op (insert/delete/select).
  mutationError?: { code?: string; message?: string } | null;
}

function makeClient(opts: ClientOpts) {
  const make = (terminal: unknown) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'order', 'eq', 'in', 'insert', 'delete', 'single']) {
      b[m] = vi.fn(() => b);
    }
    (b as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(terminal);
    return b;
  };
  return {
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: opts.user ?? null } }),
      ),
    },
    from: vi.fn((table: string) => {
      if (table === 'user_roles') {
        return make({ data: opts.rolesData ?? null, error: null });
      }
      // catalog_sources insert/delete return { error }; select returns { data, error }.
      return make({ data: null, error: opts.mutationError ?? null });
    }),
  };
}

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    source_id: '',
    short_citation: 'My Citation',
    title: 'A Title',
    year: 2024,
    publisher: 'Pub',
    doi: null,
    url: null,
    zotero_key: null,
    authority_scope: 'BC',
    authority_tier: 'tier_1_government_or_regulatory',
    canonical_source_status: 'direct_source_verified',
    role: 'canonical_candidate',
    ...overrides,
  };
}

const ADMIN = { user: { id: 'u1' }, rolesData: [{ role: 'admin' }] };

describe('submitSource', () => {
  it('returns admin_required when there is no authenticated user', async () => {
    vi.mocked(createAuthenticatedClient).mockResolvedValueOnce(
      makeClient({ user: null }) as never,
    );
    expect(await submitSource(baseRequest())).toEqual({
      success: false,
      source_id: null,
      error: 'admin_required',
    });
  });

  it('returns admin_required when the user lacks an admin role', async () => {
    vi.mocked(createAuthenticatedClient).mockResolvedValueOnce(
      makeClient({ user: { id: 'u1' }, rolesData: [] }) as never,
    );
    expect(await submitSource(baseRequest())).toEqual({
      success: false,
      source_id: null,
      error: 'admin_required',
    });
  });

  it('returns invalid_source_id when a manual source_id slugifies to empty', async () => {
    vi.mocked(createAuthenticatedClient).mockResolvedValueOnce(
      makeClient(ADMIN) as never,
    );
    const r = await submitSource(baseRequest({ source_id: '////' }));
    expect(r).toEqual({ success: false, source_id: null, error: 'invalid_source_id' });
  });

  it('slugifies a manual source_id and inserts it on success', async () => {
    vi.mocked(createAuthenticatedClient).mockResolvedValueOnce(
      makeClient(ADMIN) as never,
    );
    const r = await submitSource(baseRequest({ source_id: 'src-Custom Source/2024' }));
    expect(r).toEqual({
      success: true,
      source_id: 'src-custom-source-2024',
      error: null,
    });
  });

  it('auto-generates a src-hitl- source_id from the citation when none is given', async () => {
    vi.mocked(createAuthenticatedClient).mockResolvedValueOnce(
      makeClient(ADMIN) as never,
    );
    const r = await submitSource(baseRequest({ source_id: '' }));
    expect(r.success).toBe(true);
    expect(r.error).toBeNull();
    expect(r.source_id).toMatch(/^src-hitl-my-citation-\d+$/);
  });

  it('maps a 23505 unique-violation to duplicate_source_id', async () => {
    vi.mocked(createAuthenticatedClient).mockResolvedValueOnce(
      makeClient({ ...ADMIN, mutationError: { code: '23505' } }) as never,
    );
    const r = await submitSource(baseRequest({ source_id: 'src-dup' }));
    expect(r).toEqual({ success: false, source_id: null, error: 'duplicate_source_id' });
  });

  it('maps any other insert error to unknown', async () => {
    vi.mocked(createAuthenticatedClient).mockResolvedValueOnce(
      makeClient({ ...ADMIN, mutationError: { code: '500', message: 'boom' } }) as never,
    );
    const r = await submitSource(baseRequest({ source_id: 'src-x' }));
    expect(r).toEqual({ success: false, source_id: null, error: 'unknown' });
  });

  it('returns unknown when createAuthenticatedClient throws', async () => {
    vi.mocked(createAuthenticatedClient).mockRejectedValueOnce(new Error('boom'));
    const r = await submitSource(baseRequest({ source_id: 'src-x' }));
    expect(r).toEqual({ success: false, source_id: null, error: 'unknown' });
  });
});

describe('deleteHitlSource', () => {
  it('returns false when there is no authenticated user', async () => {
    vi.mocked(createAuthenticatedClient).mockResolvedValueOnce(
      makeClient({ user: null }) as never,
    );
    expect(await deleteHitlSource('src-1')).toBe(false);
  });

  it('returns false when the user lacks an admin role', async () => {
    vi.mocked(createAuthenticatedClient).mockResolvedValueOnce(
      makeClient({ user: { id: 'u1' }, rolesData: null }) as never,
    );
    expect(await deleteHitlSource('src-1')).toBe(false);
  });

  it('returns true on a successful delete', async () => {
    vi.mocked(createAuthenticatedClient).mockResolvedValueOnce(
      makeClient(ADMIN) as never,
    );
    expect(await deleteHitlSource('src-1')).toBe(true);
  });

  it('returns false when the delete errors', async () => {
    vi.mocked(createAuthenticatedClient).mockResolvedValueOnce(
      makeClient({ ...ADMIN, mutationError: { message: 'boom' } }) as never,
    );
    expect(await deleteHitlSource('src-1')).toBe(false);
  });

  it('returns false when createAuthenticatedClient throws', async () => {
    vi.mocked(createAuthenticatedClient).mockRejectedValueOnce(new Error('boom'));
    expect(await deleteHitlSource('src-1')).toBe(false);
  });
});
