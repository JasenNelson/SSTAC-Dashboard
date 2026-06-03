import { describe, it, expect, vi, beforeEach } from 'vitest';

import { submitReview, fetchReviewHistory } from '../qa-review-sync';

// Chainable Supabase builder mock (queued-result style). Covers deterministic
// role-gating, payload stamping, mapper defaults, and error branches.

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
let resultQueue: Array<Record<string, unknown>> = [];
let lastInsertPayload: Record<string, unknown> | undefined;

function builder() {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'insert']) {
    b[m] = vi.fn((...args: unknown[]) => {
      if (m === 'insert') lastInsertPayload = args[0] as Record<string, unknown>;
      return b;
    });
  }
  (b as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve(resultQueue.shift() ?? { data: null, error: null });
  return b;
}

vi.mock('@/lib/supabase-auth', () => ({
  createAuthenticatedClient: vi.fn(() =>
    Promise.resolve({ auth: { getUser: mockGetUser }, from: mockFrom }),
  ),
}));

beforeEach(() => {
  resultQueue = [];
  lastInsertPayload = undefined;
  mockFrom.mockReset();
  mockFrom.mockImplementation(() => builder());
  mockGetUser.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
});

describe('submitReview -- auth + role gating', () => {
  it('returns false when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect(await submitReview('pv-1', 'needs_review', 'approved', 'note')).toBe(false);
  });

  it('returns false when the user lacks an admin/matrix_admin role', async () => {
    resultQueue = [{ data: [], error: null }];
    expect(await submitReview('pv-1', 'needs_review', 'approved', 'note')).toBe(false);
  });

  it('returns false when the role query returns null', async () => {
    resultQueue = [{ data: null, error: null }];
    expect(await submitReview('pv-1', 'needs_review', 'approved', 'note')).toBe(false);
  });
});

describe('submitReview -- insert payload', () => {
  it('stamps reviewer + timestamp and returns true', async () => {
    resultQueue = [
      { data: [{ role: 'admin' }], error: null },
      { error: null },
    ];
    expect(
      await submitReview('pv-1', 'needs_review', 'approved', 'looks good', 'old-ev', 'new-ev'),
    ).toBe(true);
    expect(lastInsertPayload).toMatchObject({
      parameter_value_id: 'pv-1',
      old_qa_status: 'needs_review',
      new_qa_status: 'approved',
      old_evidence_support_status: 'old-ev',
      new_evidence_support_status: 'new-ev',
      reviewer_note: 'looks good',
      reviewed_by: 'user-1',
    });
    expect(typeof lastInsertPayload?.reviewed_at).toBe('string');
    expect(Number.isNaN(Date.parse(lastInsertPayload?.reviewed_at as string))).toBe(false);
  });

  it('null-coalesces omitted optional evidence statuses to null', async () => {
    resultQueue = [
      { data: [{ role: 'matrix_admin' }], error: null },
      { error: null },
    ];
    await submitReview('pv-1', 'needs_review', 'approved', 'note');
    expect(lastInsertPayload?.old_evidence_support_status).toBeNull();
    expect(lastInsertPayload?.new_evidence_support_status).toBeNull();
  });

  it('returns false on an insert error', async () => {
    resultQueue = [
      { data: [{ role: 'admin' }], error: null },
      { error: { message: 'boom' } },
    ];
    expect(await submitReview('pv-1', 'needs_review', 'approved', 'note')).toBe(false);
  });
});

describe('fetchReviewHistory -- rowToReview mapping', () => {
  function dbRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'r-1',
      parameter_value_id: 'pv-1',
      old_qa_status: 'needs_review',
      new_qa_status: 'approved',
      old_evidence_support_status: 'pending_source_locator',
      new_evidence_support_status: 'approved_source_backed',
      reviewer_note: 'note',
      reviewed_by: 'u',
      reviewed_at: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  it('maps a full row faithfully', () => {
    resultQueue = [{ data: [dbRow()], error: null }];
    return fetchReviewHistory('pv-1').then((rows) => {
      expect(rows).toHaveLength(1);
      expect(rows[0].new_qa_status).toBe('approved');
      expect(rows[0].old_evidence_support_status).toBe('pending_source_locator');
    });
  });

  it('applies defaults for null nullable fields', () => {
    resultQueue = [
      {
        data: [
          dbRow({
            old_evidence_support_status: null,
            new_evidence_support_status: null,
            reviewer_note: null,
            reviewed_by: null,
          }),
        ],
        error: null,
      },
    ];
    return fetchReviewHistory('pv-1').then((rows) => {
      const r = rows[0];
      expect(r.old_evidence_support_status).toBeNull();
      expect(r.new_evidence_support_status).toBeNull();
      expect(r.reviewer_note).toBe('');
      expect(r.reviewed_by).toBeNull();
    });
  });

  it('returns [] on a Supabase error', () => {
    resultQueue = [{ data: null, error: { message: 'relation does not exist' } }];
    return fetchReviewHistory('pv-1').then((rows) => expect(rows).toEqual([]));
  });

  it('returns [] when data is null', () => {
    resultQueue = [{ data: null, error: null }];
    return fetchReviewHistory('pv-1').then((rows) => expect(rows).toEqual([]));
  });
});
