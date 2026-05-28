import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePromotedCandidatesStore } from '../promotedCandidatesStore';
import { promoteSourceLead } from '@/lib/matrix-options/provenance/promotion';
import type { EvidenceLibrarySourceLeadSummary } from '@/lib/matrix-options/provenance/library';

// Silence fire-and-forget Supabase side-effects that are out-of-scope for these
// state-only tests. The supabase.test.ts file covers sync behaviour separately.
vi.mock('@/lib/matrix-options/provenance/supabase-sync', () => ({
  fetchPromotedValues: vi.fn().mockResolvedValue([]),
  upsertPromotedValue: vi.fn().mockResolvedValue(true),
  deletePromotedValue: vi.fn().mockResolvedValue(true),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeLeadSummary(
  overrides: Partial<EvidenceLibrarySourceLeadSummary> = {},
): EvidenceLibrarySourceLeadSummary {
  return {
    leadSetId: 'wqciu-reference-leads-2026-05-27',
    label: 'ACFN WQCIU report',
    status: 'needs_review',
    rule: 'WQCIU is a reference-mining and Indigenous-use framing source.',
    primarySourceId: 'src-acfn-wqciu',
    primarySourceRole: 'reference_mining',
    counts: {
      equationLeads: 3,
      parameterValueLeads: 2,
      canonicalSourceLeads: 1,
      documentLeads: 0,
      hubPages: 0,
    },
    nextActions: ['verify canonical source locators'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Store setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  usePromotedCandidatesStore.setState({ candidates: {} });
});

// ---------------------------------------------------------------------------
// addCandidate
// ---------------------------------------------------------------------------

describe('addCandidate', () => {
  it('adds a record to the store keyed by parameter_value_id', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead);
    usePromotedCandidatesStore.getState().addCandidate(record);
    const candidates = usePromotedCandidatesStore.getState().candidates;
    expect(candidates[record.parameter_value_id]).toBeDefined();
    expect(candidates[record.parameter_value_id].display_name).toBe(lead.label);
  });

  it('stores multiple records independently', () => {
    const lead1 = makeLeadSummary({ leadSetId: 'lead-set-a', label: 'Lead A' });
    const lead2 = makeLeadSummary({ leadSetId: 'lead-set-b', label: 'Lead B' });
    const rec1 = promoteSourceLead(lead1);
    const rec2 = promoteSourceLead(lead2);
    const store = usePromotedCandidatesStore.getState();
    store.addCandidate(rec1);
    store.addCandidate(rec2);
    const candidates = usePromotedCandidatesStore.getState().candidates;
    expect(Object.keys(candidates)).toHaveLength(2);
  });

  it('rejects duplicate promotions for the same candidate_group_id', () => {
    const lead = makeLeadSummary({ leadSetId: 'same-lead' });
    const rec1 = promoteSourceLead(lead);
    const rec2 = promoteSourceLead(lead);
    const store = usePromotedCandidatesStore.getState();
    store.addCandidate(rec1);
    store.addCandidate(rec2);
    const candidates = usePromotedCandidatesStore.getState().candidates;
    expect(Object.keys(candidates)).toHaveLength(1);
    expect(Object.values(candidates)[0].parameter_value_id).toBe(rec1.parameter_value_id);
  });
});

// ---------------------------------------------------------------------------
// updatePathway
// ---------------------------------------------------------------------------

describe('updatePathway', () => {
  it('changes the pathway on an existing candidate', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead);
    usePromotedCandidatesStore.getState().addCandidate(record);
    usePromotedCandidatesStore
      .getState()
      .updatePathway(record.parameter_value_id, 'human-health-direct', 'admin');
    const updated = usePromotedCandidatesStore.getState().candidates[record.parameter_value_id];
    expect(updated.pathway).toBe('human-health-direct');
  });

  it('appends an audit entry for pathway_assigned', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead);
    const initialAuditLength = record.audit_history.length;
    usePromotedCandidatesStore.getState().addCandidate(record);
    usePromotedCandidatesStore
      .getState()
      .updatePathway(record.parameter_value_id, 'eco-food-bsaf', 'reviewer');
    const updated = usePromotedCandidatesStore.getState().candidates[record.parameter_value_id];
    expect(updated.audit_history.length).toBeGreaterThan(initialAuditLength);
    const lastEntry = updated.audit_history[updated.audit_history.length - 1];
    expect(lastEntry.action).toBe('pathway_assigned');
    expect(lastEntry.actor).toBe('reviewer');
    expect(lastEntry.note).toContain('eco-food-bsaf');
  });

  it('does nothing when id does not exist in store', () => {
    const before = usePromotedCandidatesStore.getState().candidates;
    usePromotedCandidatesStore
      .getState()
      .updatePathway('nonexistent-id', 'eco-food-bsaf', 'admin');
    const after = usePromotedCandidatesStore.getState().candidates;
    expect(after).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// updateSubstanceKey
// ---------------------------------------------------------------------------

describe('updateSubstanceKey', () => {
  it('changes the substance_key on an existing candidate', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead);
    usePromotedCandidatesStore.getState().addCandidate(record);
    usePromotedCandidatesStore
      .getState()
      .updateSubstanceKey(record.parameter_value_id, 'arsenic', 'admin');
    const updated = usePromotedCandidatesStore.getState().candidates[record.parameter_value_id];
    expect(updated.substance_key).toBe('arsenic');
  });

  it('appends an audit entry for substance_key_assigned', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead);
    const initialAuditLength = record.audit_history.length;
    usePromotedCandidatesStore.getState().addCandidate(record);
    usePromotedCandidatesStore
      .getState()
      .updateSubstanceKey(record.parameter_value_id, 'lead', 'admin');
    const updated = usePromotedCandidatesStore.getState().candidates[record.parameter_value_id];
    expect(updated.audit_history.length).toBeGreaterThan(initialAuditLength);
    const lastEntry = updated.audit_history[updated.audit_history.length - 1];
    expect(lastEntry.action).toBe('substance_key_assigned');
    expect(lastEntry.note).toContain('lead');
  });

  it('does nothing when id does not exist in store', () => {
    const before = usePromotedCandidatesStore.getState().candidates;
    usePromotedCandidatesStore
      .getState()
      .updateSubstanceKey('nonexistent-id', 'arsenic', 'admin');
    const after = usePromotedCandidatesStore.getState().candidates;
    expect(after).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// removeCandidate
// ---------------------------------------------------------------------------

describe('removeCandidate', () => {
  it('removes a candidate from the store', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead);
    usePromotedCandidatesStore.getState().addCandidate(record);
    usePromotedCandidatesStore.getState().removeCandidate(record.parameter_value_id);
    const candidates = usePromotedCandidatesStore.getState().candidates;
    expect(candidates[record.parameter_value_id]).toBeUndefined();
  });

  it('leaves other candidates intact when removing one', () => {
    const rec1 = promoteSourceLead(makeLeadSummary({ leadSetId: 'set-a', label: 'A' }));
    const rec2 = promoteSourceLead(makeLeadSummary({ leadSetId: 'set-b', label: 'B' }));
    const store = usePromotedCandidatesStore.getState();
    store.addCandidate(rec1);
    store.addCandidate(rec2);
    usePromotedCandidatesStore.getState().removeCandidate(rec1.parameter_value_id);
    const candidates = usePromotedCandidatesStore.getState().candidates;
    expect(candidates[rec1.parameter_value_id]).toBeUndefined();
    expect(candidates[rec2.parameter_value_id]).toBeDefined();
  });

  it('is a no-op when id does not exist', () => {
    const rec = promoteSourceLead(makeLeadSummary());
    usePromotedCandidatesStore.getState().addCandidate(rec);
    usePromotedCandidatesStore.getState().removeCandidate('nonexistent-id');
    expect(Object.keys(usePromotedCandidatesStore.getState().candidates)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// isPromoted
// ---------------------------------------------------------------------------

describe('isPromoted', () => {
  it('returns false when no candidates are in the store', () => {
    expect(usePromotedCandidatesStore.getState().isPromoted('some-lead-set-id')).toBe(false);
  });

  it('returns true when a candidate with the given candidate_group_id exists', () => {
    const lead = makeLeadSummary({ leadSetId: 'lead-set-x' });
    const record = promoteSourceLead(lead);
    usePromotedCandidatesStore.getState().addCandidate(record);
    expect(usePromotedCandidatesStore.getState().isPromoted('lead-set-x')).toBe(true);
  });

  it('returns false for a different candidate_group_id', () => {
    const lead = makeLeadSummary({ leadSetId: 'lead-set-x' });
    const record = promoteSourceLead(lead);
    usePromotedCandidatesStore.getState().addCandidate(record);
    expect(usePromotedCandidatesStore.getState().isPromoted('lead-set-y')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getCandidateCount
// ---------------------------------------------------------------------------

describe('getCandidateCount', () => {
  it('returns 0 when store is empty', () => {
    expect(usePromotedCandidatesStore.getState().getCandidateCount()).toBe(0);
  });

  it('returns the correct count after adding candidates', () => {
    const rec1 = promoteSourceLead(makeLeadSummary({ leadSetId: 'a', label: 'A' }));
    const rec2 = promoteSourceLead(makeLeadSummary({ leadSetId: 'b', label: 'B' }));
    const rec3 = promoteSourceLead(makeLeadSummary({ leadSetId: 'c', label: 'C' }));
    const store = usePromotedCandidatesStore.getState();
    store.addCandidate(rec1);
    store.addCandidate(rec2);
    store.addCandidate(rec3);
    expect(usePromotedCandidatesStore.getState().getCandidateCount()).toBe(3);
  });

  it('decrements after removing a candidate', () => {
    const rec = promoteSourceLead(makeLeadSummary());
    usePromotedCandidatesStore.getState().addCandidate(rec);
    usePromotedCandidatesStore.getState().removeCandidate(rec.parameter_value_id);
    expect(usePromotedCandidatesStore.getState().getCandidateCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getUnscopedCount
// ---------------------------------------------------------------------------

describe('getUnscopedCount', () => {
  it('returns 0 when store is empty', () => {
    expect(usePromotedCandidatesStore.getState().getUnscopedCount()).toBe(0);
  });

  it('counts candidates where pathway is eco-direct-eqp and substance_key is empty', () => {
    // promoteSourceLead defaults to eco-direct-eqp + empty substance_key = unscoped
    const rec1 = promoteSourceLead(makeLeadSummary({ leadSetId: 'a', label: 'A' }));
    const rec2 = promoteSourceLead(makeLeadSummary({ leadSetId: 'b', label: 'B' }));
    const store = usePromotedCandidatesStore.getState();
    store.addCandidate(rec1);
    store.addCandidate(rec2);
    expect(usePromotedCandidatesStore.getState().getUnscopedCount()).toBe(2);
  });

  it('does not count a candidate that has been given a non-default pathway', () => {
    const rec = promoteSourceLead(makeLeadSummary({ leadSetId: 'a', label: 'A' }));
    usePromotedCandidatesStore.getState().addCandidate(rec);
    usePromotedCandidatesStore
      .getState()
      .updatePathway(rec.parameter_value_id, 'human-health-direct', 'admin');
    expect(usePromotedCandidatesStore.getState().getUnscopedCount()).toBe(0);
  });

  it('does not count a candidate that has a non-empty substance_key', () => {
    const rec = promoteSourceLead(makeLeadSummary({ leadSetId: 'a', label: 'A' }));
    usePromotedCandidatesStore.getState().addCandidate(rec);
    usePromotedCandidatesStore
      .getState()
      .updateSubstanceKey(rec.parameter_value_id, 'arsenic', 'admin');
    expect(usePromotedCandidatesStore.getState().getUnscopedCount()).toBe(0);
  });

  it('returns correct partial count when some are scoped and some are not', () => {
    const recUnscoped = promoteSourceLead(makeLeadSummary({ leadSetId: 'u', label: 'U' }));
    const recScoped = promoteSourceLead(makeLeadSummary({ leadSetId: 's', label: 'S' }));
    const store = usePromotedCandidatesStore.getState();
    store.addCandidate(recUnscoped);
    store.addCandidate(recScoped);
    usePromotedCandidatesStore
      .getState()
      .updatePathway(recScoped.parameter_value_id, 'eco-food-bsaf', 'admin');
    expect(usePromotedCandidatesStore.getState().getUnscopedCount()).toBe(1);
  });
});
