'use server';

/**
 * Supabase sync functions for parameter_value_reviews table.
 *
 * These are Next.js server actions callable from client code.
 * They never throw; on error they log and return a safe fallback value.
 *
 * The table may not exist yet (owner creates it separately).
 * All functions handle the missing-table case gracefully by returning
 * false (writes) or [] (reads) on any Supabase error.
 */

import { createAuthenticatedClient } from '@/lib/supabase-auth';

// ---------------------------------------------------------------------------
// ParameterValueReview -- the public-facing type for review history entries
// ---------------------------------------------------------------------------

export interface ParameterValueReview {
  id: string;
  parameter_value_id: string;
  old_qa_status: string;
  new_qa_status: string;
  old_evidence_support_status: string | null;
  new_evidence_support_status: string | null;
  reviewer_note: string;
  reviewed_by: string | null;
  reviewed_at: string;
}

// ---------------------------------------------------------------------------
// Row shape as returned by Supabase
// ---------------------------------------------------------------------------

interface ParameterValueReviewRow {
  id: string;
  parameter_value_id: string;
  old_qa_status: string;
  new_qa_status: string;
  old_evidence_support_status: string | null;
  new_evidence_support_status: string | null;
  reviewer_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string;
}

// ---------------------------------------------------------------------------
// Mapper: Supabase row -> ParameterValueReview
// ---------------------------------------------------------------------------

function rowToReview(row: ParameterValueReviewRow): ParameterValueReview {
  return {
    id: row.id,
    parameter_value_id: row.parameter_value_id,
    old_qa_status: row.old_qa_status ?? '',
    new_qa_status: row.new_qa_status ?? '',
    old_evidence_support_status: row.old_evidence_support_status ?? null,
    new_evidence_support_status: row.new_evidence_support_status ?? null,
    reviewer_note: row.reviewer_note ?? '',
    reviewed_by: row.reviewed_by ?? null,
    reviewed_at: row.reviewed_at,
  };
}

// ---------------------------------------------------------------------------
// submitReview
// ---------------------------------------------------------------------------

/**
 * Inserts a QA review record into the parameter_value_reviews table.
 *
 * Returns true on success, false on error (including table-not-found).
 */
export async function submitReview(
  parameterValueId: string,
  oldQaStatus: string,
  newQaStatus: string,
  reviewerNote: string,
  oldEvidenceStatus?: string,
  newEvidenceStatus?: string,
): Promise<boolean> {
  try {
    const supabase = await createAuthenticatedClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('[qa-review-sync] submitReview: no authenticated user');
      return false;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'matrix_admin']);

    if (!roles || roles.length === 0) {
      console.warn('[qa-review-sync] submitReview: user lacks admin or matrix_admin role');
      return false;
    }

    const payload = {
      parameter_value_id: parameterValueId,
      old_qa_status: oldQaStatus,
      new_qa_status: newQaStatus,
      old_evidence_support_status: oldEvidenceStatus ?? null,
      new_evidence_support_status: newEvidenceStatus ?? null,
      reviewer_note: reviewerNote,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('parameter_value_reviews')
      .insert(payload);

    if (error) {
      console.error('[qa-review-sync] submitReview error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[qa-review-sync] submitReview unexpected error:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// fetchReviewHistory
// ---------------------------------------------------------------------------

/**
 * Fetches the review history for a single parameter value, newest first.
 *
 * Returns an empty array on any error (including table-not-found).
 */
export async function fetchReviewHistory(
  parameterValueId: string,
): Promise<ParameterValueReview[]> {
  try {
    const supabase = await createAuthenticatedClient();
    const { data, error } = await supabase
      .from('parameter_value_reviews')
      .select('*')
      .eq('parameter_value_id', parameterValueId)
      .order('reviewed_at', { ascending: false });

    if (error) {
      console.error('[qa-review-sync] fetchReviewHistory error:', error.message);
      return [];
    }

    if (!data) {
      return [];
    }

    return (data as ParameterValueReviewRow[]).map(rowToReview);
  } catch (err) {
    console.error('[qa-review-sync] fetchReviewHistory unexpected error:', err);
    return [];
  }
}
