import { describe, it, expect, vi, beforeEach } from 'vitest';

import { fetchTriageState, setTriageStatus } from '../triage-sync';

// Chainable Supabase builder mock: each builder method returns the builder, and
// awaiting it shifts the next queued result. Mirrors the saved-views-sync test
// pattern. We test only the deterministic coercion / validation / error branches,
// never network behaviour.

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
let resultQueue: Array<Record<string, unknown>> = [];
let upsertArg: { onConflict?: string } | undefined;

function builder() {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'upsert']) {
    b[m] = vi.fn((...args: unknown[]) => {
      if (m === 'upsert') upsertArg = args[1] as { onConflict?: string };
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
  upsertArg = undefined;
  mockFrom.mockReset();
  mockFrom.mockImplementation(() => builder());
  mockGetUser.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
});

describe('fetchTriageState', () => {
  it('keys mapped rows by lead_set_id and coerces fields', () => {
    resultQueue = [
      {
        data: [
          {
            id: 't1',
            lead_set_id: 'lead-A',
            triage_status: 'promoted',
            triage_note: 'note A',
            triaged_by: 'u',
            triaged_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-02T00:00:00.000Z',
          },
        ],
        error: null,
      },
    ];
    return fetchTriageState().then((state) => {
      expect(Object.keys(state)).toEqual(['lead-A']);
      expect(state['lead-A'].triage_status).toBe('promoted');
      expect(state['lead-A'].triage_note).toBe('note A');
    });
  });

  it('narrows an invalid triage_status to untriaged', () => {
    resultQueue = [
      {
        data: [
          {
            id: 't2',
            lead_set_id: 'lead-B',
            triage_status: 'bogus',
            triage_note: null,
            triaged_by: null,
            triaged_at: null,
            updated_at: null,
          },
        ],
        error: null,
      },
    ];
    return fetchTriageState().then((state) => {
      expect(state['lead-B'].triage_status).toBe('untriaged');
      // null fields are coerced to safe defaults
      expect(state['lead-B'].triage_note).toBe('');
      expect(state['lead-B'].triaged_by).toBeNull();
      expect(state['lead-B'].triaged_at).toBe(new Date(0).toISOString());
      expect(state['lead-B'].updated_at).toBe(new Date(0).toISOString());
    });
  });

  it('returns {} on a Supabase error (table-not-found case)', () => {
    resultQueue = [{ data: null, error: { message: 'relation does not exist' } }];
    return fetchTriageState().then((state) => expect(state).toEqual({}));
  });

  it('returns {} when data is null', () => {
    resultQueue = [{ data: null, error: null }];
    return fetchTriageState().then((state) => expect(state).toEqual({}));
  });

  it('last-write-wins when two rows share a lead_set_id', () => {
    resultQueue = [
      {
        data: [
          { id: 'a', lead_set_id: 'dup', triage_status: 'promoted', triage_note: 'first', triaged_by: null, triaged_at: null, updated_at: null },
          { id: 'b', lead_set_id: 'dup', triage_status: 'dismissed', triage_note: 'second', triaged_by: null, triaged_at: null, updated_at: null },
        ],
        error: null,
      },
    ];
    return fetchTriageState().then((state) => {
      expect(Object.keys(state)).toEqual(['dup']);
      expect(state['dup'].triage_status).toBe('dismissed');
    });
  });
});

describe('setTriageStatus -- input validation (before any DB call)', () => {
  it('rejects an empty / whitespace lead_set_id without touching auth', async () => {
    expect(await setTriageStatus('   ', 'promoted', 'n')).toBe(false);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects an invalid status without touching auth', async () => {
    // @ts-expect-error -- exercising the runtime guard at the server boundary
    expect(await setTriageStatus('lead-A', 'not-a-status', 'n')).toBe(false);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('accepts each valid status', async () => {
    for (const status of ['untriaged', 'promoted', 'dismissed', 'deferred'] as const) {
      resultQueue = [
        { data: [{ role: 'admin' }], error: null }, // role check
        { error: null }, // upsert
      ];
      expect(await setTriageStatus('lead-A', status, 'n')).toBe(true);
    }
  });
});

describe('setTriageStatus -- auth + role gating', () => {
  it('returns false when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect(await setTriageStatus('lead-A', 'promoted', 'n')).toBe(false);
  });

  it('returns false when the user lacks an admin/matrix_admin role', async () => {
    resultQueue = [{ data: [], error: null }]; // empty roles
    expect(await setTriageStatus('lead-A', 'promoted', 'n')).toBe(false);
  });

  it('returns false when the role query yields null', async () => {
    resultQueue = [{ data: null, error: null }];
    expect(await setTriageStatus('lead-A', 'promoted', 'n')).toBe(false);
  });
});

describe('setTriageStatus -- upsert behaviour', () => {
  it('upserts with onConflict lead_set_id and returns true', async () => {
    resultQueue = [
      { data: [{ role: 'matrix_admin' }], error: null },
      { error: null },
    ];
    expect(await setTriageStatus('lead-A', 'deferred', 'n')).toBe(true);
    expect(upsertArg).toEqual({ onConflict: 'lead_set_id' });
  });

  it('returns false on an upsert error', async () => {
    resultQueue = [
      { data: [{ role: 'admin' }], error: null },
      { error: { message: 'boom' } },
    ];
    expect(await setTriageStatus('lead-A', 'promoted', 'n')).toBe(false);
  });
});
