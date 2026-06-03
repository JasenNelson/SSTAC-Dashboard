import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  submitEvidenceItem,
  fetchEvidenceItems,
  deleteEvidenceItem,
} from '../evidence-sync';

// Chainable Supabase builder mock (queued-result style). We cover the
// deterministic role-gating, mapper defaults, and error branches, not network.

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
let resultQueue: Array<Record<string, unknown>> = [];
let lastInsertPayload: Record<string, unknown> | undefined;

function builder() {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'insert', 'delete']) {
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

const item = {
  parameter_value_id: 'pv-1',
  source_id: 'src-1',
  locator: 'p. 12',
  locator_type: 'source_page',
  value_text: '0.5',
  note: 'a note',
};

describe('submitEvidenceItem -- auth + role gating', () => {
  it('returns false when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect(await submitEvidenceItem(item)).toBe(false);
  });

  it('returns false when the user has no admin/matrix_admin role', async () => {
    resultQueue = [{ data: [], error: null }];
    expect(await submitEvidenceItem(item)).toBe(false);
  });

  it('returns false when the role query returns null', async () => {
    resultQueue = [{ data: null, error: null }];
    expect(await submitEvidenceItem(item)).toBe(false);
  });
});

describe('submitEvidenceItem -- insert', () => {
  it('inserts a server-stamped payload and returns true', async () => {
    resultQueue = [
      { data: [{ role: 'admin' }], error: null }, // role check
      { error: null }, // insert
    ];
    expect(await submitEvidenceItem(item)).toBe(true);
    // Server-controlled fields are stamped, not taken from client input.
    expect(lastInsertPayload).toMatchObject({
      parameter_value_id: 'pv-1',
      source_id: 'src-1',
      extraction_method: 'hitl_manual',
      extracted_by: 'user-1',
      qa_status: 'needs_review',
      created_by: 'user-1',
    });
  });

  it('returns false on an insert error', async () => {
    resultQueue = [
      { data: [{ role: 'matrix_admin' }], error: null },
      { error: { message: 'boom' } },
    ];
    expect(await submitEvidenceItem(item)).toBe(false);
  });
});

describe('fetchEvidenceItems -- rowToEvidenceItem mapping', () => {
  function dbRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'ev-1',
      parameter_value_id: 'pv-1',
      source_id: 'src-1',
      locator: 'p.1',
      locator_type: 'source_page',
      value_text: '1.0',
      extraction_method: 'manual_source_extraction',
      extracted_by: 'someone',
      qa_status: 'approved',
      note: 'noted',
      created_at: 't1',
      created_by: 'u',
      updated_at: 't2',
      ...overrides,
    };
  }

  it('maps a full row faithfully', () => {
    resultQueue = [{ data: [dbRow()], error: null }];
    return fetchEvidenceItems('pv-1').then((rows) => {
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('ev-1');
      expect(rows[0].extraction_method).toBe('manual_source_extraction');
      expect(rows[0].qa_status).toBe('approved');
    });
  });

  it('applies defaults for null nullable fields', () => {
    resultQueue = [
      {
        data: [
          dbRow({
            value_text: null,
            extraction_method: null,
            extracted_by: null,
            qa_status: null,
            note: null,
            created_by: null,
          }),
        ],
        error: null,
      },
    ];
    return fetchEvidenceItems('pv-1').then((rows) => {
      const r = rows[0];
      expect(r.value_text).toBeNull();
      expect(r.extraction_method).toBe('hitl_manual');
      expect(r.extracted_by).toBe('');
      expect(r.qa_status).toBe('needs_review');
      expect(r.note).toBe('');
      expect(r.created_by).toBeNull();
    });
  });

  it('returns [] on a Supabase error', () => {
    resultQueue = [{ data: null, error: { message: 'relation does not exist' } }];
    return fetchEvidenceItems('pv-1').then((rows) => expect(rows).toEqual([]));
  });

  it('returns [] when data is null', () => {
    resultQueue = [{ data: null, error: null }];
    return fetchEvidenceItems('pv-1').then((rows) => expect(rows).toEqual([]));
  });
});

describe('deleteEvidenceItem -- auth + role gating', () => {
  it('returns false when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect(await deleteEvidenceItem('ev-1')).toBe(false);
  });

  it('returns false when the user lacks an admin/matrix_admin role', async () => {
    resultQueue = [{ data: [], error: null }];
    expect(await deleteEvidenceItem('ev-1')).toBe(false);
  });

  it('returns true on success', async () => {
    resultQueue = [
      { data: [{ role: 'admin' }], error: null },
      { error: null },
    ];
    expect(await deleteEvidenceItem('ev-1')).toBe(true);
  });

  it('returns false on a delete error', async () => {
    resultQueue = [
      { data: [{ role: 'admin' }], error: null },
      { error: { message: 'boom' } },
    ];
    expect(await deleteEvidenceItem('ev-1')).toBe(false);
  });
});
