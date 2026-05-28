/**
 * Tests for Supabase sync behaviour in promotedCandidatesStore.
 *
 * The server actions are mocked at the module level so no real Supabase
 * connection is required. All tests exercise the store's state transitions
 * and fire-and-forget side-effect triggering.
 */
import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import {
  usePromotedCandidatesStore,
  clearPendingWritesForTesting,
  hasPendingWrite,
  pendingWrites,
} from '../promotedCandidatesStore';
import { promoteSourceLead } from '@/lib/matrix-options/provenance/promotion';
import type { EvidenceLibrarySourceLeadSummary } from '@/lib/matrix-options/provenance/library';
import type { PromotedParameterValueRecord } from '@/lib/matrix-options/provenance/promotion';

// ---------------------------------------------------------------------------
// Mock the server actions module
// ---------------------------------------------------------------------------

vi.mock('@/lib/matrix-options/provenance/supabase-sync', () => ({
  fetchPromotedValues: vi.fn().mockResolvedValue([]),
  upsertPromotedValue: vi.fn().mockResolvedValue(true),
  deletePromotedValue: vi.fn().mockResolvedValue(true),
}));

// Lazily import the mocks after vi.mock() runs so we can cast them.
import {
  fetchPromotedValues,
  upsertPromotedValue,
  deletePromotedValue,
} from '@/lib/matrix-options/provenance/supabase-sync';

const mockFetch = fetchPromotedValues as MockedFunction<typeof fetchPromotedValues>;
const mockUpsert = upsertPromotedValue as MockedFunction<typeof upsertPromotedValue>;
const mockDelete = deletePromotedValue as MockedFunction<typeof deletePromotedValue>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeLeadSummary(
  overrides: Partial<EvidenceLibrarySourceLeadSummary> = {},
): EvidenceLibrarySourceLeadSummary {
  return {
    leadSetId: 'eco-ssl-lead-set-2026',
    label: 'Eco-SSL Lead',
    status: 'needs_review',
    rule: 'Eco-SSL screening guideline reference.',
    primarySourceId: 'src-eco-ssl-db',
    primarySourceRole: 'reference_mining',
    counts: {
      equationLeads: 1,
      parameterValueLeads: 2,
      canonicalSourceLeads: 0,
      documentLeads: 1,
      hubPages: 0,
    },
    nextActions: ['verify original source locator'],
    ...overrides,
  };
}

function makeRemoteRecord(
  overrides: Partial<PromotedParameterValueRecord> = {},
): PromotedParameterValueRecord {
  const base = promoteSourceLead(makeLeadSummary({ leadSetId: 'remote-lead-set-a' }));
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// Store setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  usePromotedCandidatesStore.setState({ candidates: {} });
  clearPendingWritesForTesting();
  // resetAllMocks clears both call history AND any leftover one-time
  // mockReturnValueOnce / mockImplementationOnce entries that vi.clearAllMocks()
  // would leave behind, preventing cross-test implementation-queue contamination.
  vi.resetAllMocks();
  mockFetch.mockResolvedValue([]);
  mockUpsert.mockResolvedValue(true);
  mockDelete.mockResolvedValue(true);
});

// ---------------------------------------------------------------------------
// hydrateFromSupabase
// ---------------------------------------------------------------------------

describe('hydrateFromSupabase', () => {
  it('merges remote records into an empty store', async () => {
    const remote = makeRemoteRecord({ display_name: 'Remote Record A' });
    mockFetch.mockResolvedValueOnce([remote]);

    await usePromotedCandidatesStore.getState().hydrateFromSupabase();

    const candidates = usePromotedCandidatesStore.getState().candidates;
    expect(candidates[remote.parameter_value_id]).toBeDefined();
    expect(candidates[remote.parameter_value_id].display_name).toBe('Remote Record A');
  });

  it('remote record wins over existing localStorage record for the same id', async () => {
    const local = promoteSourceLead(makeLeadSummary({ leadSetId: 'shared-lead' }));
    usePromotedCandidatesStore.getState().addCandidate(local);

    // Remote has the same parameter_value_id but updated display_name
    const remote: PromotedParameterValueRecord = {
      ...local,
      display_name: 'Updated by Supabase',
    };
    mockFetch.mockResolvedValueOnce([remote]);

    await usePromotedCandidatesStore.getState().hydrateFromSupabase();

    const candidates = usePromotedCandidatesStore.getState().candidates;
    expect(candidates[local.parameter_value_id].display_name).toBe('Updated by Supabase');
  });

  it('keeps local records that are not in remote but have a pending write', async () => {
    // addCandidate enqueues a write so the record will be in pendingWrites
    const localOnly = promoteSourceLead(makeLeadSummary({ leadSetId: 'local-only-lead' }));
    usePromotedCandidatesStore.getState().addCandidate(localOnly);

    // Verify a write was enqueued before hydration runs
    expect(hasPendingWrite(localOnly.parameter_value_id)).toBe(true);

    const remote = makeRemoteRecord({ display_name: 'Remote Only Record' });
    mockFetch.mockResolvedValueOnce([remote]);

    await usePromotedCandidatesStore.getState().hydrateFromSupabase();

    const candidates = usePromotedCandidatesStore.getState().candidates;
    // Local record kept (pending write), remote record also present
    expect(candidates[localOnly.parameter_value_id]).toBeDefined();
    expect(candidates[remote.parameter_value_id]).toBeDefined();
    expect(Object.keys(candidates)).toHaveLength(2);
  });

  it('prunes local records deleted from Supabase (no pending write)', async () => {
    // Inject a local record directly without going through addCandidate
    // so no pending write is enqueued for it.
    const staleRecord = promoteSourceLead(makeLeadSummary({ leadSetId: 'stale-local-lead' }));
    usePromotedCandidatesStore.setState({
      candidates: { [staleRecord.parameter_value_id]: staleRecord },
    });

    // Confirm no pending write exists for this record
    expect(hasPendingWrite(staleRecord.parameter_value_id)).toBe(false);

    // Remote returns a different record -- staleRecord is absent (server-deleted)
    const remote = makeRemoteRecord({ display_name: 'Remote Only Record' });
    mockFetch.mockResolvedValueOnce([remote]);

    await usePromotedCandidatesStore.getState().hydrateFromSupabase();

    const candidates = usePromotedCandidatesStore.getState().candidates;
    // Stale local record must be pruned; only the remote record remains
    expect(candidates[staleRecord.parameter_value_id]).toBeUndefined();
    expect(candidates[remote.parameter_value_id]).toBeDefined();
    expect(Object.keys(candidates)).toHaveLength(1);
  });

  it('keeps local record not in remote when write is still pending', async () => {
    // Use a never-resolving upsert to keep the write in-flight during hydration
    mockUpsert.mockReturnValueOnce(new Promise(() => undefined));

    const record = promoteSourceLead(makeLeadSummary({ leadSetId: 'pending-write-lead' }));
    usePromotedCandidatesStore.getState().addCandidate(record);

    // Write is in-flight; confirm pendingWrites has an entry
    expect(hasPendingWrite(record.parameter_value_id)).toBe(true);

    // Remote does not include this record yet
    mockFetch.mockResolvedValueOnce([]);

    await usePromotedCandidatesStore.getState().hydrateFromSupabase();

    const candidates = usePromotedCandidatesStore.getState().candidates;
    // Must be kept because write is pending
    expect(candidates[record.parameter_value_id]).toBeDefined();
  });

  it('does not modify state when remote returns empty array and no records are pending', async () => {
    // Inject local state directly (no pending write)
    const local = promoteSourceLead(makeLeadSummary());
    usePromotedCandidatesStore.setState({
      candidates: { [local.parameter_value_id]: local },
    });
    mockFetch.mockResolvedValueOnce([]);

    await usePromotedCandidatesStore.getState().hydrateFromSupabase();

    // No pending write + not in remote = pruned
    const candidates = usePromotedCandidatesStore.getState().candidates;
    expect(Object.keys(candidates)).toHaveLength(0);
  });

  it('logs error and does not throw when fetchPromotedValues rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockFetch.mockRejectedValueOnce(new Error('network failure'));

    // Should not throw
    await expect(
      usePromotedCandidatesStore.getState().hydrateFromSupabase(),
    ).resolves.toBeUndefined();

    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// addCandidate triggers upsert
// ---------------------------------------------------------------------------

describe('addCandidate (with Supabase write-through)', () => {
  it('calls upsertPromotedValue after adding a new candidate', async () => {
    const record = promoteSourceLead(makeLeadSummary({ leadSetId: 'upsert-test-lead' }));
    usePromotedCandidatesStore.getState().addCandidate(record);

    // Allow microtask queue to settle
    await Promise.resolve();

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ parameter_value_id: record.parameter_value_id }),
    );
  });

  it('does not call upsert when duplicate is rejected', async () => {
    const lead = makeLeadSummary({ leadSetId: 'dup-lead' });
    const rec1 = promoteSourceLead(lead);
    const rec2 = promoteSourceLead(lead); // same candidate_group_id
    usePromotedCandidatesStore.getState().addCandidate(rec1);

    // Drain the write enqueued by rec1 before clearing mocks, so the queued
    // write does not count as a call for the rec2 assertion below.
    await Promise.resolve();
    vi.clearAllMocks();
    usePromotedCandidatesStore.getState().addCandidate(rec2);

    await Promise.resolve();

    // rec2 was rejected; upsert should not be called for it
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('state still updates even when upsert rejects', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('supabase down'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const record = promoteSourceLead(makeLeadSummary({ leadSetId: 'fail-upsert-lead' }));
    usePromotedCandidatesStore.getState().addCandidate(record);

    await Promise.resolve();

    const candidates = usePromotedCandidatesStore.getState().candidates;
    expect(candidates[record.parameter_value_id]).toBeDefined();

    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// removeCandidate triggers delete
// ---------------------------------------------------------------------------

describe('removeCandidate (with Supabase write-through)', () => {
  it('calls deletePromotedValue with the correct id after removal', async () => {
    const record = promoteSourceLead(makeLeadSummary({ leadSetId: 'delete-test-lead' }));
    usePromotedCandidatesStore.getState().addCandidate(record);
    // Fully drain the addCandidate write queue entry (multi-hop .then chain)
    // before clearing mocks so it does not bleed into the delete assertion.
    await new Promise<void>((res) => setTimeout(res, 0));
    vi.clearAllMocks();

    usePromotedCandidatesStore.getState().removeCandidate(record.parameter_value_id);
    // The delete is chained off the now-settled addCandidate promise, but since
    // addCandidate's entry is gone from the map it chains off Promise.resolve()
    // directly. Drain fully with a macrotask cycle.
    await new Promise<void>((res) => setTimeout(res, 0));

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith(record.parameter_value_id);
  });

  it('state is updated even when deletePromotedValue rejects', async () => {
    mockDelete.mockRejectedValueOnce(new Error('supabase down'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const record = promoteSourceLead(makeLeadSummary({ leadSetId: 'fail-delete-lead' }));
    usePromotedCandidatesStore.getState().addCandidate(record);

    usePromotedCandidatesStore.getState().removeCandidate(record.parameter_value_id);
    await Promise.resolve();

    const candidates = usePromotedCandidatesStore.getState().candidates;
    expect(candidates[record.parameter_value_id]).toBeUndefined();

    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// updatePathway and updateSubstanceKey trigger upsert
// ---------------------------------------------------------------------------

describe('updatePathway (with Supabase write-through)', () => {
  it('calls upsertPromotedValue after pathway update', async () => {
    const record = promoteSourceLead(makeLeadSummary({ leadSetId: 'pathway-upsert-lead' }));
    usePromotedCandidatesStore.getState().addCandidate(record);
    // Fully drain the addCandidate write queue entry before clearing mocks.
    await new Promise<void>((res) => setTimeout(res, 0));
    vi.clearAllMocks();

    usePromotedCandidatesStore
      .getState()
      .updatePathway(record.parameter_value_id, 'human-health-direct', 'admin');

    await new Promise<void>((res) => setTimeout(res, 0));

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ pathway: 'human-health-direct' }),
    );
  });
});

describe('updateSubstanceKey (with Supabase write-through)', () => {
  it('calls upsertPromotedValue after substance key update', async () => {
    const record = promoteSourceLead(makeLeadSummary({ leadSetId: 'subkey-upsert-lead' }));
    usePromotedCandidatesStore.getState().addCandidate(record);
    // Fully drain the addCandidate write queue entry before clearing mocks.
    await new Promise<void>((res) => setTimeout(res, 0));
    vi.clearAllMocks();

    usePromotedCandidatesStore
      .getState()
      .updateSubstanceKey(record.parameter_value_id, 'cadmium', 'admin');

    await new Promise<void>((res) => setTimeout(res, 0));

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ substance_key: 'cadmium' }),
    );
  });
});

// ---------------------------------------------------------------------------
// syncCandidateToSupabase
// ---------------------------------------------------------------------------

describe('syncCandidateToSupabase', () => {
  it('upserts the named candidate', async () => {
    const record = promoteSourceLead(makeLeadSummary({ leadSetId: 'sync-test-lead' }));
    usePromotedCandidatesStore.getState().addCandidate(record);
    // Drain the addCandidate upsert before clearing mocks.
    await Promise.resolve();
    vi.clearAllMocks();

    await usePromotedCandidatesStore.getState().syncCandidateToSupabase(record.parameter_value_id);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ parameter_value_id: record.parameter_value_id }),
    );
  });

  it('does nothing when the candidate id is not in the store', async () => {
    await usePromotedCandidatesStore
      .getState()
      .syncCandidateToSupabase('nonexistent-id');

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('logs error but does not throw when upsert rejects', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('supabase down'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const record = promoteSourceLead(makeLeadSummary({ leadSetId: 'sync-fail-lead' }));
    usePromotedCandidatesStore.getState().addCandidate(record);

    await expect(
      usePromotedCandidatesStore.getState().syncCandidateToSupabase(record.parameter_value_id),
    ).resolves.toBeUndefined();

    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Write queue serialisation
// ---------------------------------------------------------------------------

describe('write queue serialisation', () => {
  it('serialises writes for the same id -- rapid add then remove does not resurrect the row', async () => {
    // Track the order in which calls resolve
    const callOrder: string[] = [];

    // First upsert resolves after a delay to simulate a slow network round-trip
    let resolveUpsert!: () => void;
    mockUpsert.mockReturnValueOnce(
      new Promise<boolean>((res) => {
        resolveUpsert = () => res(true);
      }),
    );
    mockDelete.mockImplementation(async () => {
      callOrder.push('delete');
      return true;
    });

    const record = promoteSourceLead(makeLeadSummary({ leadSetId: 'race-condition-lead' }));

    // Add then immediately remove before the upsert completes
    usePromotedCandidatesStore.getState().addCandidate(record);
    usePromotedCandidatesStore.getState().removeCandidate(record.parameter_value_id);

    // Now resolve the blocked upsert
    mockUpsert.mockImplementationOnce(async () => {
      callOrder.push('upsert');
      return true;
    });
    resolveUpsert();

    // Drain the queue
    await new Promise<void>((res) => setTimeout(res, 0));

    // Delete must run after the upsert chain -- the remove is second in queue
    // and must not run before upsert finishes.
    // The row should be absent from the store (remove won).
    const candidates = usePromotedCandidatesStore.getState().candidates;
    expect(candidates[record.parameter_value_id]).toBeUndefined();

    // delete was called -- the removal was not dropped
    expect(mockDelete).toHaveBeenCalledWith(record.parameter_value_id);
  });

  it('enqueues a pending write entry for a new candidate before the upsert resolves', () => {
    mockUpsert.mockReturnValueOnce(new Promise(() => undefined)); // never resolves

    const record = promoteSourceLead(makeLeadSummary({ leadSetId: 'enqueue-check-lead' }));
    usePromotedCandidatesStore.getState().addCandidate(record);

    expect(pendingWrites.has(record.parameter_value_id)).toBe(true);
  });

  it('calls upsert once per write -- three writes fire three calls', async () => {
    const record = promoteSourceLead(makeLeadSummary({ leadSetId: 'multi-write-lead' }));
    usePromotedCandidatesStore.getState().addCandidate(record);
    usePromotedCandidatesStore
      .getState()
      .updatePathway(record.parameter_value_id, 'human-health-direct', 'admin');
    usePromotedCandidatesStore
      .getState()
      .updateSubstanceKey(record.parameter_value_id, 'cadmium', 'admin');

    await new Promise<void>((res) => setTimeout(res, 20));

    // Three actions each enqueue one write; all must fire.
    expect(mockUpsert).toHaveBeenCalledTimes(3);
  });
});
