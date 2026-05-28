'use server';

/**
 * Supabase sync functions for promoted_parameter_values table.
 *
 * These are Next.js server actions callable from client code.
 * They never throw; on error they log and return a safe fallback value.
 *
 * The table does NOT have an `evidence_items` column -- that field lives
 * only in the TypeScript type. When mapping to/from Supabase rows we
 * exclude `evidence_items` (it is always [] for promoted records).
 */

import { createAuthenticatedClient } from '@/lib/supabase-auth';
import type { PromotedParameterValueRecord } from '@/lib/matrix-options/provenance/promotion';
import type { AuditEntry } from '@/lib/matrix-options/provenance/promotion';

// ---------------------------------------------------------------------------
// Row shape (subset of columns we read/write)
// ---------------------------------------------------------------------------

interface PromotedParameterValueRow {
  id?: string;
  parameter_value_id: string;
  substance_key: string;
  pathway: string;
  input_key: string;
  display_name: string;
  value: string;
  unit: string;
  value_type: string;
  candidate_group_id: string;
  default_status: string;
  evidence_support_status: string;
  extraction_status: string;
  qa_status: string;
  source_ids: string[];
  equation_ids: string[];
  jurisdiction: string;
  applicability: string;
  uncertainty: string | null;
  review_notes: string;
  audit_history: AuditEntry[];
  created_at?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// Mapper: Supabase row -> PromotedParameterValueRecord
// ---------------------------------------------------------------------------

function rowToRecord(row: PromotedParameterValueRow): PromotedParameterValueRecord {
  return {
    parameter_value_id: row.parameter_value_id,
    substance_key: row.substance_key ?? '',
    pathway: row.pathway as PromotedParameterValueRecord['pathway'],
    input_key: row.input_key ?? '',
    display_name: row.display_name ?? '',
    value: row.value ?? '',
    unit: row.unit ?? '',
    value_type: row.value_type as PromotedParameterValueRecord['value_type'],
    candidate_group_id: row.candidate_group_id ?? '',
    default_status: row.default_status as PromotedParameterValueRecord['default_status'],
    evidence_support_status:
      row.evidence_support_status as PromotedParameterValueRecord['evidence_support_status'],
    extraction_status:
      row.extraction_status as PromotedParameterValueRecord['extraction_status'],
    qa_status: row.qa_status as PromotedParameterValueRecord['qa_status'],
    source_ids: Array.isArray(row.source_ids) ? row.source_ids : [],
    equation_ids: Array.isArray(row.equation_ids) ? row.equation_ids : [],
    jurisdiction: row.jurisdiction ?? '',
    applicability: row.applicability ?? '',
    uncertainty: row.uncertainty ?? null,
    review_notes: row.review_notes ?? '',
    // evidence_items is not stored in Supabase; always empty for promoted records
    evidence_items: [],
    audit_history: Array.isArray(row.audit_history) ? row.audit_history : [],
  };
}

// ---------------------------------------------------------------------------
// Mapper: PromotedParameterValueRecord -> Supabase upsert payload
// ---------------------------------------------------------------------------

function recordToUpsertPayload(
  record: PromotedParameterValueRecord,
): Omit<PromotedParameterValueRow, 'id' | 'created_at'> & { updated_at: string } {
  return {
    parameter_value_id: record.parameter_value_id,
    substance_key: record.substance_key,
    pathway: record.pathway,
    input_key: record.input_key,
    display_name: record.display_name,
    value: String(record.value),
    unit: record.unit,
    value_type: record.value_type,
    candidate_group_id: record.candidate_group_id,
    default_status: record.default_status,
    evidence_support_status: record.evidence_support_status,
    extraction_status: record.extraction_status,
    qa_status: record.qa_status,
    source_ids: record.source_ids,
    equation_ids: record.equation_ids,
    jurisdiction: record.jurisdiction,
    applicability: record.applicability,
    uncertainty: record.uncertainty ?? null,
    review_notes: record.review_notes,
    audit_history: record.audit_history,
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// fetchPromotedValues
// ---------------------------------------------------------------------------

/**
 * Fetches all promoted parameter value records from Supabase.
 *
 * Returns an empty array on any error (network, auth, RLS).
 * The caller is responsible for merging with localStorage state.
 */
export async function fetchPromotedValues(): Promise<PromotedParameterValueRecord[]> {
  try {
    const supabase = await createAuthenticatedClient();
    const { data, error } = await supabase
      .from('promoted_parameter_values')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[supabase-sync] fetchPromotedValues error:', error.message);
      return [];
    }

    if (!data) {
      return [];
    }

    return (data as PromotedParameterValueRow[]).map(rowToRecord);
  } catch (err) {
    console.error('[supabase-sync] fetchPromotedValues unexpected error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// upsertPromotedValue
// ---------------------------------------------------------------------------

/**
 * Upserts a single promoted parameter value record to Supabase.
 *
 * Uses parameter_value_id as the conflict key (UNIQUE constraint on the table).
 * Returns true on success, false on error.
 */
export async function upsertPromotedValue(
  record: PromotedParameterValueRecord,
): Promise<boolean> {
  try {
    const supabase = await createAuthenticatedClient();
    const payload = recordToUpsertPayload(record);

    const { error } = await supabase
      .from('promoted_parameter_values')
      .upsert(payload, { onConflict: 'parameter_value_id' });

    if (error) {
      console.error('[supabase-sync] upsertPromotedValue error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[supabase-sync] upsertPromotedValue unexpected error:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// deletePromotedValue
// ---------------------------------------------------------------------------

/**
 * Deletes a promoted parameter value record from Supabase by parameter_value_id.
 *
 * Returns true on success, false on error.
 */
export async function deletePromotedValue(
  parameterValueId: string,
): Promise<boolean> {
  try {
    const supabase = await createAuthenticatedClient();

    const { error } = await supabase
      .from('promoted_parameter_values')
      .delete()
      .eq('parameter_value_id', parameterValueId);

    if (error) {
      console.error('[supabase-sync] deletePromotedValue error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[supabase-sync] deletePromotedValue unexpected error:', err);
    return false;
  }
}
