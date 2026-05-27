/**
 * Source-lead promotion logic.
 *
 * Promotes a source-lead summary to a ParameterValueRecord stub.
 * Client-side only -- no Supabase write. The produced record is
 * LOCAL STATE and must go through the normal source-review QA
 * workflow before it can influence calculator defaults.
 *
 * Status constraints applied at promotion time:
 *   evidence_support_status : 'pending_source_locator'
 *   default_status          : 'available_option'
 *   qa_status               : 'needs_review'
 *   extraction_status       : 'pending_extraction'
 */

import type { ParameterValueRecord } from './types';
import type { EvidenceLibrarySourceLeadSummary } from './library';

// ---------------------------------------------------------------------------
// AuditEntry
// ---------------------------------------------------------------------------

export interface AuditEntry {
  action: string;
  actor: string;
  timestamp: string;
  note: string | null;
}

// ---------------------------------------------------------------------------
// PromotedParameterValueRecord
// A ParameterValueRecord extended with an audit_history array.
// ---------------------------------------------------------------------------

export interface PromotedParameterValueRecord extends ParameterValueRecord {
  audit_history: AuditEntry[];
}

// ---------------------------------------------------------------------------
// promoteSourceLead
// ---------------------------------------------------------------------------

/**
 * Creates a ParameterValueRecord stub from an EvidenceLibrarySourceLeadSummary.
 *
 * The resulting record:
 *   - Has a unique parameter_value_id using the pattern pv-promoted-{timestamp}
 *   - Copies substance_key, pathway, source_ids, and other available fields
 *   - Sets status fields to their required initial values
 *   - Starts with an empty audit_history (use addAuditEntry to populate)
 *
 * The record is LOCAL STATE only. It is not written to Supabase or the catalog.
 */
export function promoteSourceLead(
  lead: EvidenceLibrarySourceLeadSummary,
  actor: string = 'admin',
): PromotedParameterValueRecord {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const parameterId = `pv-promoted-${timestamp}-${random}`;

  // Derive source_ids from the primary source if available.
  const sourceIds: string[] = lead.primarySourceId ? [lead.primarySourceId] : [];

  const record: PromotedParameterValueRecord = {
    parameter_value_id: parameterId,
    // substance_key and pathway cannot be reliably derived from a lead summary
    // because a single lead set can cover multiple pathways and substances.
    // Use placeholder strings so the caller can set them explicitly.
    substance_key: '',
    pathway: 'eco-direct-eqp',
    input_key: '',
    display_name: lead.label,
    value: '',
    unit: '',
    value_type: 'single_value',
    candidate_group_id: lead.leadSetId,
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    extraction_status: 'pending_extraction',
    qa_status: 'needs_review',
    source_ids: sourceIds,
    equation_ids: [],
    jurisdiction: '',
    applicability: lead.rule ?? '',
    uncertainty: null,
    evidence_items: [],
    review_notes: `Promoted from source-lead set "${lead.leadSetId}" by ${actor} at ${new Date(timestamp).toISOString()}. Exact source locator, currentness, applicability, QA, and approval are required before this record can support calculator defaults.`,
    audit_history: [],
  };

  // Stamp the initial promotion audit entry.
  addAuditEntry(record, 'promoted_from_source_lead', actor, `Lead set: ${lead.leadSetId}`);

  return record;
}

// ---------------------------------------------------------------------------
// addAuditEntry
// ---------------------------------------------------------------------------

/**
 * Appends an AuditEntry to the record's audit_history array.
 * Mutates the record in place and returns it for chaining.
 */
export function addAuditEntry(
  record: PromotedParameterValueRecord,
  action: string,
  actor: string,
  note: string | null = null,
): PromotedParameterValueRecord {
  record.audit_history.push({
    action,
    actor,
    timestamp: new Date().toISOString(),
    note,
  });
  return record;
}
