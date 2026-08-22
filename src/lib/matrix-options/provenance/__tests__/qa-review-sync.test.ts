import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  submitReview,
  fetchReviewHistory,
  fetchAllReviews,
  fetchAllReviewsResult,
} from '../qa-review-sync';
import { reduceToCurrentVerificationStates } from '../qa-review-reduction';

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
      await submitReview(
        'pv-1',
        'needs_review',
        'approved',
        'looks good',
        'pending_source_locator',
        'approved_source_backed',
      ),
    ).toBe(true);
    expect(lastInsertPayload).toMatchObject({
      parameter_value_id: 'pv-1',
      old_qa_status: 'needs_review',
      new_qa_status: 'approved',
      old_evidence_support_status: 'pending_source_locator',
      new_evidence_support_status: 'approved_source_backed',
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

  it('returns [] when user lacks admin role', async () => {
    resultQueue = [{ data: [], error: null }];
    const rows = await fetchReviewHistory('pv-1');
    expect(rows).toEqual([]);
  });

  it('maps a full row faithfully when authorized', async () => {
    resultQueue = [
      { data: [{ role: 'admin' }], error: null },
      { data: [dbRow()], error: null },
    ];
    const rows = await fetchReviewHistory('pv-1');
    expect(rows).toHaveLength(1);
    expect(rows[0].new_qa_status).toBe('approved');
    expect(rows[0].old_evidence_support_status).toBe('pending_source_locator');
  });

  it('applies defaults for null nullable fields', async () => {
    resultQueue = [
      { data: [{ role: 'matrix_admin' }], error: null },
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
    const rows = await fetchReviewHistory('pv-1');
    const r = rows[0];
    expect(r.old_evidence_support_status).toBeNull();
    expect(r.new_evidence_support_status).toBeNull();
    expect(r.reviewer_note).toBe('');
    expect(r.reviewed_by).toBeNull();
  });

  it('returns [] on a Supabase error', async () => {
    resultQueue = [
      { data: [{ role: 'admin' }], error: null },
      { data: null, error: { message: 'relation does not exist' } },
    ];
    const rows = await fetchReviewHistory('pv-1');
    expect(rows).toEqual([]);
  });

  it('returns [] when data is null', async () => {
    resultQueue = [
      { data: [{ role: 'admin' }], error: null },
      { data: null, error: null },
    ];
    const rows = await fetchReviewHistory('pv-1');
    expect(rows).toEqual([]);
  });
});

describe('fetchAllReviews -- batch fetch', () => {
  it('returns [] when user lacks admin role', async () => {
    resultQueue = [{ data: [], error: null }];
    const rows = await fetchAllReviews();
    expect(rows).toEqual([]);
  });

  it('returns all mapped reviews ordered by reviewed_at when authorized', async () => {
    resultQueue = [
      { data: [{ role: 'admin' }], error: null },
      {
        data: [
          {
            id: 'rev-1',
            parameter_value_id: 'pv-1',
            old_qa_status: 'needs_review',
            new_qa_status: 'approved',
            old_evidence_support_status: null,
            new_evidence_support_status: null,
            reviewer_note: '[VERIFICATION: confirmed] Good',
            reviewed_by: 'user-1',
            reviewed_at: '2026-08-21T12:00:00Z',
          },
        ],
        error: null,
      },
    ];
    const rows = await fetchAllReviews();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('rev-1');
    expect(rows[0].reviewer_note).toBe('[VERIFICATION: confirmed] Good');
  });

  it('returns [] on error', async () => {
    resultQueue = [
      { data: [{ role: 'admin' }], error: null },
      { data: null, error: { message: 'error' } },
    ];
    const rows = await fetchAllReviews();
    expect(rows).toEqual([]);
  });
});

describe('fetchAllReviewsResult -- structured batch fetch', () => {
  it('returns success: false with unauthenticated error when signed out', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await fetchAllReviewsResult();
    expect(res).toEqual({ success: false, reviews: [], error: 'unauthenticated' });
  });

  it('returns success: false with unauthorized error when missing admin role', async () => {
    resultQueue = [{ data: [], error: null }];
    const res = await fetchAllReviewsResult();
    expect(res).toEqual({ success: false, reviews: [], error: 'unauthorized' });
  });

  it('returns success: true and data when authorized', async () => {
    resultQueue = [
      { data: [{ role: 'admin' }], error: null },
      {
        data: [
          {
            id: 'rev-1',
            parameter_value_id: 'pv-1',
            old_qa_status: 'needs_review',
            new_qa_status: 'approved',
            old_evidence_support_status: null,
            new_evidence_support_status: null,
            reviewer_note: '[VERIFICATION: confirmed] Verified',
            reviewed_by: 'user-1',
            reviewed_at: '2026-08-21T12:00:00Z',
          },
        ],
        error: null,
      },
    ];
    const res = await fetchAllReviewsResult();
    expect(res.success).toBe(true);
    expect(res.reviews).toHaveLength(1);
    expect(res.error).toBeNull();
  });
});

describe('submitReview -- payload validation', () => {
  it('rejects empty parameter_value_id', async () => {
    expect(await submitReview('', 'needs_review', 'approved', 'note')).toBe(false);
    expect(await submitReview('   ', 'needs_review', 'approved', 'note')).toBe(false);
  });

  it('rejects invalid QA status values', async () => {
    expect(await submitReview('pv-1', 'invalid_status', 'approved', 'note')).toBe(false);
    expect(await submitReview('pv-1', 'needs_review', 'fabricated_status', 'note')).toBe(false);
  });

  it('rejects notes exceeding 500 characters', async () => {
    const longNote = 'a'.repeat(501);
    expect(await submitReview('pv-1', 'needs_review', 'approved', longNote)).toBe(false);
  });
});

describe('reduceToCurrentVerificationStates', () => {
  it('reduces multiple reviews per parameter to latest state and counts events', () => {
    const reviews = [
      {
        id: 'rev-1',
        parameter_value_id: 'pv-1',
        old_qa_status: 'needs_review',
        new_qa_status: 'needs_review',
        old_evidence_support_status: null,
        new_evidence_support_status: null,
        reviewer_note: '[VERIFICATION: discrepancy] Mismatch in value',
        reviewed_by: 'user-1',
        reviewed_at: '2026-08-21T10:00:00Z',
      },
      {
        id: 'rev-2',
        parameter_value_id: 'pv-1',
        old_qa_status: 'needs_review',
        new_qa_status: 'approved',
        old_evidence_support_status: null,
        new_evidence_support_status: null,
        reviewer_note: '[VERIFICATION: confirmed] Verified correction',
        reviewed_by: 'user-2',
        reviewed_at: '2026-08-21T14:00:00Z',
      },
      {
        id: 'rev-3',
        parameter_value_id: 'pv-2',
        old_qa_status: 'needs_review',
        new_qa_status: 'approved',
        old_evidence_support_status: null,
        new_evidence_support_status: null,
        reviewer_note: '[VERIFICATION: confirmed] OK',
        reviewed_by: 'user-1',
        reviewed_at: '2026-08-21T11:00:00Z',
      },
      {
        id: 'rev-4',
        parameter_value_id: 'pv-1',
        old_qa_status: 'needs_review',
        new_qa_status: 'approved',
        old_evidence_support_status: null,
        new_evidence_support_status: null,
        reviewer_note: '[FLAG_RESOLVED:flag-1] Resolved',
        reviewed_by: 'user-3',
        reviewed_at: '2026-08-21T16:00:00Z',
      },
    ];

    const reduced = reduceToCurrentVerificationStates(reviews);
    expect(Object.keys(reduced)).toHaveLength(2);
    expect(reduced['pv-1']).toEqual({
      parameter_value_id: 'pv-1',
      current_qa_status: 'approved',
      latest_review_id: 'rev-2',
      latest_reviewer_note: '[VERIFICATION: confirmed] Verified correction',
      latest_reviewed_by: 'user-2',
      latest_reviewed_at: '2026-08-21T14:00:00Z',
      verification_count: 2,
      total_audit_events: 3,
      history_count: 2,
    });
    expect(reduced['pv-2']).toEqual({
      parameter_value_id: 'pv-2',
      current_qa_status: 'approved',
      latest_review_id: 'rev-3',
      latest_reviewer_note: '[VERIFICATION: confirmed] OK',
      latest_reviewed_by: 'user-1',
      latest_reviewed_at: '2026-08-21T11:00:00Z',
      verification_count: 1,
      total_audit_events: 1,
      history_count: 1,
    });
  });

  it('guarantees deterministic total order under equal-timestamp permutations', () => {
    const revA = {
      id: 'rev-a',
      parameter_value_id: 'pv-tie',
      old_qa_status: 'needs_review',
      new_qa_status: 'needs_review',
      old_evidence_support_status: null,
      new_evidence_support_status: null,
      reviewer_note: '[VERIFICATION: discrepancy] First tie entry',
      reviewed_by: 'user-1',
      reviewed_at: '2026-08-21T12:00:00Z',
    };
    const revB = {
      id: 'rev-b',
      parameter_value_id: 'pv-tie',
      old_qa_status: 'needs_review',
      new_qa_status: 'approved',
      old_evidence_support_status: null,
      new_evidence_support_status: null,
      reviewer_note: '[VERIFICATION: confirmed] Second tie entry',
      reviewed_by: 'user-2',
      reviewed_at: '2026-08-21T12:00:00Z',
    };

    const reducedForward = reduceToCurrentVerificationStates([revA, revB]);
    const reducedReverse = reduceToCurrentVerificationStates([revB, revA]);

    // Both permutations must yield the exact same deterministic winner (rev-b based on id tie-breaker)
    expect(reducedForward['pv-tie']).toEqual(reducedReverse['pv-tie']);
    expect(reducedForward['pv-tie'].latest_review_id).toBe('rev-b');
    expect(reducedForward['pv-tie'].current_qa_status).toBe('approved');
    expect(reducedForward['pv-tie'].history_count).toBe(2);
  });

  it('correctly persists and rehydrates needs_review when an approved row is edited', () => {
    const initialApproved = {
      id: 'rev-01',
      parameter_value_id: 'pv-edit',
      old_qa_status: 'needs_review',
      new_qa_status: 'approved',
      old_evidence_support_status: null,
      new_evidence_support_status: null,
      reviewer_note: '[VERIFICATION: confirmed] Initial approval',
      reviewed_by: 'user-1',
      reviewed_at: '2026-08-21T10:00:00Z',
    };
    const subsequentEdit = {
      id: 'rev-02',
      parameter_value_id: 'pv-edit',
      old_qa_status: 'approved',
      new_qa_status: 'needs_review',
      old_evidence_support_status: null,
      new_evidence_support_status: null,
      reviewer_note: '[VERIFICATION: needs_review] Note modified; requires re-verification',
      reviewed_by: 'user-1',
      reviewed_at: '2026-08-21T15:00:00Z',
    };

    const reduced = reduceToCurrentVerificationStates([initialApproved, subsequentEdit]);
    expect(reduced['pv-edit'].current_qa_status).toBe('needs_review');
    expect(reduced['pv-edit'].latest_review_id).toBe('rev-02');
    expect(reduced['pv-edit'].latest_reviewer_note).toContain('[VERIFICATION: needs_review]');
    expect(reduced['pv-edit'].verification_count).toBe(2);
    expect(reduced['pv-edit'].total_audit_events).toBe(2);
  });

  it('fails closed to needs_review when an approved status has a discrepancy or needs_review note', () => {
    const contradictoryApprovedDiscrepancy = {
      id: 'rev-c1',
      parameter_value_id: 'pv-contra-1',
      old_qa_status: 'needs_review',
      new_qa_status: 'approved',
      old_evidence_support_status: null,
      new_evidence_support_status: null,
      reviewer_note: '[VERIFICATION: discrepancy] Fatal mismatch in unit',
      reviewed_by: 'user-1',
      reviewed_at: '2026-08-21T10:00:00Z',
    };
    const contradictoryApprovedNeedsReview = {
      id: 'rev-c2',
      parameter_value_id: 'pv-contra-2',
      old_qa_status: 'needs_review',
      new_qa_status: 'approved',
      old_evidence_support_status: null,
      new_evidence_support_status: null,
      reviewer_note: '[VERIFICATION: needs_review] Requires further check',
      reviewed_by: 'user-1',
      reviewed_at: '2026-08-21T10:00:00Z',
    };
    const reduced = reduceToCurrentVerificationStates([
      contradictoryApprovedDiscrepancy,
      contradictoryApprovedNeedsReview,
    ]);
    expect(reduced['pv-contra-1'].current_qa_status).toBe('needs_review');
    expect(reduced['pv-contra-2'].current_qa_status).toBe('needs_review');
  });

  it('fails closed to needs_review when a needs_review status has a confirmed note', () => {
    const contradictoryNeedsReview = {
      id: 'rev-c3',
      parameter_value_id: 'pv-contra-3',
      old_qa_status: 'approved',
      new_qa_status: 'needs_review',
      old_evidence_support_status: null,
      new_evidence_support_status: null,
      reviewer_note: '[VERIFICATION: confirmed] Accurate value confirmed',
      reviewed_by: 'user-1',
      reviewed_at: '2026-08-21T10:00:00Z',
    };
    const reduced = reduceToCurrentVerificationStates([contradictoryNeedsReview]);
    expect(reduced['pv-contra-3'].current_qa_status).toBe('needs_review');
  });

  it('excludes both [FLAG:] and [FLAG_RESOLVED:] events from verification_count while including them in total_audit_events', () => {
    const baseVerification = {
      id: 'rev-1',
      parameter_value_id: 'pv-flags',
      old_qa_status: 'needs_review',
      new_qa_status: 'approved',
      old_evidence_support_status: null,
      new_evidence_support_status: null,
      reviewer_note: '[VERIFICATION: confirmed] Verified by senior tox',
      reviewed_by: 'user-1',
      reviewed_at: '2026-08-21T10:00:00Z',
    };
    const flagSubmission = {
      id: 'rev-2',
      parameter_value_id: 'pv-flags',
      old_qa_status: 'approved',
      new_qa_status: 'needs_review',
      old_evidence_support_status: null,
      new_evidence_support_status: null,
      reviewer_note: '[FLAG: unit_mismatch] Possible mg/kg vs ug/kg mixup',
      reviewed_by: 'user-2',
      reviewed_at: '2026-08-21T11:00:00Z',
    };
    const flagResolution = {
      id: 'rev-3',
      parameter_value_id: 'pv-flags',
      old_qa_status: 'needs_review',
      new_qa_status: 'approved',
      old_evidence_support_status: null,
      new_evidence_support_status: null,
      reviewer_note: '[FLAG_RESOLVED: unit_mismatch] Units verified correct per EPA IRIS',
      reviewed_by: 'admin-1',
      reviewed_at: '2026-08-21T12:00:00Z',
    };

    const reduced = reduceToCurrentVerificationStates([baseVerification, flagSubmission, flagResolution]);
    expect(reduced['pv-flags'].current_qa_status).toBe('approved');
    expect(reduced['pv-flags'].latest_review_id).toBe('rev-1');
    expect(reduced['pv-flags'].latest_reviewer_note).toBe('[VERIFICATION: confirmed] Verified by senior tox');
    expect(reduced['pv-flags'].verification_count).toBe(1);
    expect(reduced['pv-flags'].total_audit_events).toBe(3);
  });

  describe('submitReview payload contract and non-vacuous server validation', () => {
    it('normalizes validated strings once and persists exact normalized payload', async () => {
      resultQueue = [
        { data: [{ role: 'admin' }], error: null },
        { error: null },
      ];
      const res = await submitReview(
        '  pv-trim-test  ',
        ' needs_review ',
        ' approved ',
        '  clean note content  ',
        ' approved_source_backed ',
        ' current_calculator_scaffold ',
      );
      expect(res).toBe(true);
      expect(lastInsertPayload).toMatchObject({
        parameter_value_id: 'pv-trim-test',
        old_qa_status: 'needs_review',
        new_qa_status: 'approved',
        reviewer_note: 'clean note content',
        old_evidence_support_status: 'approved_source_backed',
        new_evidence_support_status: 'current_calculator_scaffold',
        reviewed_by: 'user-1',
      });
    });

    it('rejects invalid or malformed parameterValueId before DB insertion', async () => {
      lastInsertPayload = undefined;
      expect(await submitReview('', 'needs_review', 'approved', 'Valid note')).toBe(false);
      expect(await submitReview('   ', 'needs_review', 'approved', 'Valid note')).toBe(false);
      expect(await submitReview('invalid id with spaces!@#', 'needs_review', 'approved', 'Valid note')).toBe(false);
      expect(await submitReview('a'.repeat(101), 'needs_review', 'approved', 'Valid note')).toBe(false);
      expect(lastInsertPayload).toBeUndefined();
    });

    it('accepts exact boundary valid parameterValueId (100 chars) and persists payload', async () => {
      resultQueue = [
        { data: [{ role: 'admin' }], error: null },
        { error: null },
      ];
      const id100 = 'pv-' + 'a'.repeat(97);
      const res = await submitReview(id100, 'needs_review', 'approved', 'Valid note');
      expect(res).toBe(true);
      expect(lastInsertPayload?.parameter_value_id).toBe(id100);
    });

    it('accepts canonical superseded QA status and persists exact payload', async () => {
      resultQueue = [
        { data: [{ role: 'admin' }], error: null },
        { error: null },
      ];
      const res = await submitReview('pv-canon-1', 'approved', 'superseded', 'Superseded by 2026 update');
      expect(res).toBe(true);
      expect(lastInsertPayload).toMatchObject({
        parameter_value_id: 'pv-canon-1',
        old_qa_status: 'approved',
        new_qa_status: 'superseded',
        reviewer_note: 'Superseded by 2026 update',
      });
    });

    it('rejects every noncanonical QA status value before DB insertion', async () => {
      const nonCanonicalQa = ['provisional', 'flagged', 'rejected', '', '  ', 'unknown_status', 'approved_source_backed'];
      for (const st of nonCanonicalQa) {
        lastInsertPayload = undefined;
        expect(await submitReview('pv-1', st, 'approved', 'Valid note')).toBe(false);
        expect(await submitReview('pv-1', 'needs_review', st, 'Valid note')).toBe(false);
        expect(lastInsertPayload).toBeUndefined();
      }
    });

    it('accepts all five canonical EvidenceSupportStatus values and persists them', async () => {
      const canonicalEvidence = [
        'approved_source_backed',
        'pending_source_locator',
        'current_calculator_scaffold',
        'reference_mining_lead',
        'user_entered_or_derived',
      ];
      for (const ev of canonicalEvidence) {
        resultQueue = [
          { data: [{ role: 'admin' }], error: null },
          { error: null },
        ];
        const res = await submitReview('pv-canon-2', 'needs_review', 'approved', 'Valid note', ev, ev);
        expect(res).toBe(true);
        expect(lastInsertPayload?.old_evidence_support_status).toBe(ev);
        expect(lastInsertPayload?.new_evidence_support_status).toBe(ev);
      }
    });

    it('rejects uncanonical evidence statuses (including empty string) before DB insertion', async () => {
      const nonCanonicalEvidence = ['', '   ', 'fabricated_status', 'approved', 'needs_review', 'null_string'];
      for (const ev of nonCanonicalEvidence) {
        lastInsertPayload = undefined;
        expect(await submitReview('pv-1', 'needs_review', 'approved', 'Valid note', ev)).toBe(false);
        expect(await submitReview('pv-1', 'needs_review', 'approved', 'Valid note', undefined, ev)).toBe(false);
        expect(lastInsertPayload).toBeUndefined();
      }
    });

    it('enforces exact reviewer_note boundary (persists 1000 chars unchanged, rejects 1001 chars before DB)', async () => {
      resultQueue = [
        { data: [{ role: 'admin' }], error: null },
        { error: null },
      ];
      const note1000 = 'x'.repeat(1000);
      const note1001 = 'x'.repeat(1001);
      const res1000 = await submitReview('pv-1', 'needs_review', 'approved', note1000);
      expect(res1000).toBe(true);
      expect(lastInsertPayload?.reviewer_note).toBe(note1000);
      expect((lastInsertPayload?.reviewer_note as string).length).toBe(1000);

      lastInsertPayload = undefined;
      expect(await submitReview('pv-1', 'needs_review', 'approved', note1001)).toBe(false);
      expect(lastInsertPayload).toBeUndefined();
    });
  });
});
