import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchHitlSources } from '../source-sync';

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
});
