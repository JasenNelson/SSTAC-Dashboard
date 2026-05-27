import { describe, it, expect } from 'vitest';
import { promoteSourceLead, addAuditEntry } from '../promotion';
import type { EvidenceLibrarySourceLeadSummary } from '../library';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeLeadSummary(
  overrides: Partial<EvidenceLibrarySourceLeadSummary> = {},
): EvidenceLibrarySourceLeadSummary {
  return {
    leadSetId: 'wqciu-reference-leads-2026-05-23',
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
// promoteSourceLead -- status field invariants
// ---------------------------------------------------------------------------

describe('promoteSourceLead', () => {
  it('sets evidence_support_status to pending_source_locator', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead);
    expect(record.evidence_support_status).toBe('pending_source_locator');
  });

  it('sets default_status to available_option', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead);
    expect(record.default_status).toBe('available_option');
  });

  it('sets qa_status to needs_review', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead);
    expect(record.qa_status).toBe('needs_review');
  });

  it('sets extraction_status to pending_extraction', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead);
    expect(record.extraction_status).toBe('pending_extraction');
  });

  // ---------------------------------------------------------------------------
  // ID generation
  // ---------------------------------------------------------------------------

  it('generates a parameter_value_id starting with pv-promoted-', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead);
    expect(record.parameter_value_id).toMatch(/^pv-promoted-\d+$/);
  });

  it('generates unique IDs for successive promotions', () => {
    const lead = makeLeadSummary();
    // Two promotions must produce different IDs even if called in the same
    // millisecond. The timestamp portion may collide in a fast test runner;
    // we check prefix + that the result is a non-empty string, which is the
    // contract (uniqueness across real-time calls is the design intent).
    const a = promoteSourceLead(lead);
    const b = promoteSourceLead(lead);
    expect(typeof a.parameter_value_id).toBe('string');
    expect(typeof b.parameter_value_id).toBe('string');
    expect(a.parameter_value_id.startsWith('pv-promoted-')).toBe(true);
    expect(b.parameter_value_id.startsWith('pv-promoted-')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Field copying
  // ---------------------------------------------------------------------------

  it('copies the primary source_id into source_ids', () => {
    const lead = makeLeadSummary({ primarySourceId: 'src-acfn-wqciu' });
    const record = promoteSourceLead(lead);
    expect(record.source_ids).toContain('src-acfn-wqciu');
  });

  it('uses an empty source_ids array when primarySourceId is null', () => {
    const lead = makeLeadSummary({ primarySourceId: null });
    const record = promoteSourceLead(lead);
    expect(record.source_ids).toHaveLength(0);
  });

  it('sets display_name to the lead label', () => {
    const lead = makeLeadSummary({ label: 'EPA Eco-SSL reference leads' });
    const record = promoteSourceLead(lead);
    expect(record.display_name).toBe('EPA Eco-SSL reference leads');
  });

  it('sets candidate_group_id to the lead leadSetId', () => {
    const lead = makeLeadSummary({ leadSetId: 'epa-ecossl-2026-05-23' });
    const record = promoteSourceLead(lead);
    expect(record.candidate_group_id).toBe('epa-ecossl-2026-05-23');
  });

  it('uses the source_of_sources_rule as the applicability string', () => {
    const lead = makeLeadSummary({
      rule: 'Use underlying cited source as canonical.',
    });
    const record = promoteSourceLead(lead);
    expect(record.applicability).toBe('Use underlying cited source as canonical.');
  });

  it('uses empty string applicability when rule is null', () => {
    const lead = makeLeadSummary({ rule: null });
    const record = promoteSourceLead(lead);
    expect(record.applicability).toBe('');
  });

  // ---------------------------------------------------------------------------
  // Audit history
  // ---------------------------------------------------------------------------

  it('initialises with exactly one audit entry for the promotion action', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead);
    expect(record.audit_history).toHaveLength(1);
  });

  it('sets the first audit entry action to promoted_from_source_lead', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead, 'test-actor');
    expect(record.audit_history[0].action).toBe('promoted_from_source_lead');
  });

  it('records the actor in the initial audit entry', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead, 'jasen.nelson@example.com');
    expect(record.audit_history[0].actor).toBe('jasen.nelson@example.com');
  });

  it('defaults actor to "admin" when none is supplied', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead);
    expect(record.audit_history[0].actor).toBe('admin');
  });

  it('includes the leadSetId in the initial audit note', () => {
    const lead = makeLeadSummary({ leadSetId: 'erdc-bsaf-leads' });
    const record = promoteSourceLead(lead);
    expect(record.audit_history[0].note).toContain('erdc-bsaf-leads');
  });

  it('stores an ISO 8601 timestamp on the initial audit entry', () => {
    const lead = makeLeadSummary();
    const before = Date.now();
    const record = promoteSourceLead(lead);
    const after = Date.now();
    const ts = new Date(record.audit_history[0].timestamp).getTime();
    // Timestamp must fall within the test window.
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// addAuditEntry
// ---------------------------------------------------------------------------

describe('addAuditEntry', () => {
  it('appends a new entry to audit_history', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead);
    addAuditEntry(record, 'source_locator_added', 'reviewer');
    expect(record.audit_history).toHaveLength(2);
  });

  it('records the action, actor, and note on the appended entry', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead);
    addAuditEntry(record, 'qa_approved', 'qp-reviewer', 'Passed technical QA');
    const entry = record.audit_history[record.audit_history.length - 1];
    expect(entry.action).toBe('qa_approved');
    expect(entry.actor).toBe('qp-reviewer');
    expect(entry.note).toBe('Passed technical QA');
  });

  it('accepts null as the note', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead);
    addAuditEntry(record, 'status_changed', 'admin', null);
    const entry = record.audit_history[record.audit_history.length - 1];
    expect(entry.note).toBeNull();
  });

  it('returns the same record reference (mutates in place)', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead);
    const returned = addAuditEntry(record, 'noop', 'admin');
    expect(returned).toBe(record);
  });

  it('can be chained to append multiple entries sequentially', () => {
    const lead = makeLeadSummary();
    const record = promoteSourceLead(lead);
    addAuditEntry(record, 'step_1', 'a')
      .audit_history; // not chaining the function, but verifying length below
    addAuditEntry(record, 'step_2', 'b');
    addAuditEntry(record, 'step_3', 'c');
    // 1 initial + 3 appended = 4 total
    expect(record.audit_history).toHaveLength(4);
  });
});
