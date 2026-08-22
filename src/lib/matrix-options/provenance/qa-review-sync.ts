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

const CANONICAL_QA_STATUSES = new Set<string>([
  'needs_review',
  'approved',
  'superseded',
]);

const CANONICAL_EVIDENCE_STATUSES = new Set<string>([
  'approved_source_backed',
  'pending_source_locator',
  'current_calculator_scaffold',
  'reference_mining_lead',
  'user_entered_or_derived',
]);

const MAX_STORED_NOTE_LENGTH = 1000;
const VALID_ID_PATTERN = /^[a-zA-Z0-9_\-.:]+$/;

export interface NormalizedReviewPayload {
  parameterValueId: string;
  oldQaStatus: string;
  newQaStatus: string;
  reviewerNote: string;
  oldEvidenceStatus: string | null;
  newEvidenceStatus: string | null;
}

function validateAndNormalizeReviewPayload(
  parameterValueId: string,
  oldQaStatus: string,
  newQaStatus: string,
  reviewerNote: string,
  oldEvidenceStatus?: string | null,
  newEvidenceStatus?: string | null,
): { valid: true; normalized: NormalizedReviewPayload } | { valid: false; error: string } {
  if (typeof parameterValueId !== 'string') {
    return { valid: false, error: 'parameter_value_id must be a string' };
  }
  const normId = parameterValueId.trim();
  if (!normId || normId.length > 100 || !VALID_ID_PATTERN.test(normId)) {
    return {
      valid: false,
      error: 'Invalid parameter_value_id: must be non-empty string <= 100 chars matching identifier format',
    };
  }

  if (typeof oldQaStatus !== 'string') {
    return { valid: false, error: 'old_qa_status must be a string' };
  }
  const normOldQa = oldQaStatus.trim();
  if (!CANONICAL_QA_STATUSES.has(normOldQa)) {
    return { valid: false, error: `Invalid old_qa_status: ${oldQaStatus}` };
  }

  if (typeof newQaStatus !== 'string') {
    return { valid: false, error: 'new_qa_status must be a string' };
  }
  const normNewQa = newQaStatus.trim();
  if (!CANONICAL_QA_STATUSES.has(normNewQa)) {
    return { valid: false, error: `Invalid new_qa_status: ${newQaStatus}` };
  }

  if (typeof reviewerNote !== 'string') {
    return { valid: false, error: 'reviewer_note must be a string' };
  }
  const normNote = reviewerNote.trim();
  if (normNote.length > MAX_STORED_NOTE_LENGTH) {
    return {
      valid: false,
      error: `Invalid reviewer_note: must be string <= ${MAX_STORED_NOTE_LENGTH} chars (got ${normNote.length})`,
    };
  }

  let normOldEvidence: string | null = null;
  if (oldEvidenceStatus !== undefined && oldEvidenceStatus !== null) {
    if (typeof oldEvidenceStatus !== 'string') {
      return { valid: false, error: 'old_evidence_status must be a string, null, or undefined' };
    }
    const trimmed = oldEvidenceStatus.trim();
    if (!CANONICAL_EVIDENCE_STATUSES.has(trimmed)) {
      return { valid: false, error: `Invalid old_evidence_status: ${oldEvidenceStatus}` };
    }
    normOldEvidence = trimmed;
  }

  let normNewEvidence: string | null = null;
  if (newEvidenceStatus !== undefined && newEvidenceStatus !== null) {
    if (typeof newEvidenceStatus !== 'string') {
      return { valid: false, error: 'new_evidence_status must be a string, null, or undefined' };
    }
    const trimmed = newEvidenceStatus.trim();
    if (!CANONICAL_EVIDENCE_STATUSES.has(trimmed)) {
      return { valid: false, error: `Invalid new_evidence_status: ${newEvidenceStatus}` };
    }
    normNewEvidence = trimmed;
  }

  return {
    valid: true,
    normalized: {
      parameterValueId: normId,
      oldQaStatus: normOldQa,
      newQaStatus: normNewQa,
      reviewerNote: normNote,
      oldEvidenceStatus: normOldEvidence,
      newEvidenceStatus: normNewEvidence,
    },
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
  oldEvidenceStatus?: string | null,
  newEvidenceStatus?: string | null,
): Promise<boolean> {
  try {
    const validation = validateAndNormalizeReviewPayload(
      parameterValueId,
      oldQaStatus,
      newQaStatus,
      reviewerNote,
      oldEvidenceStatus,
      newEvidenceStatus,
    );
    if (!validation.valid) {
      console.warn('[qa-review-sync] submitReview validation failed:', validation.error);
      return false;
    }

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

    const { normalized } = validation;
    const payload = {
      parameter_value_id: normalized.parameterValueId,
      old_qa_status: normalized.oldQaStatus,
      new_qa_status: normalized.newQaStatus,
      old_evidence_support_status: normalized.oldEvidenceStatus,
      new_evidence_support_status: normalized.newEvidenceStatus,
      reviewer_note: normalized.reviewerNote,
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return [];
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'matrix_admin']);

    if (!roles || roles.length === 0) {
      return [];
    }

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

// ---------------------------------------------------------------------------
export interface FetchAllReviewsResult {
  success: boolean;
  reviews: ParameterValueReview[];
  error: string | null;
}

/**
 * Fetches all review records with structured result shape.
 */
export async function fetchAllReviewsResult(): Promise<FetchAllReviewsResult> {
  try {
    const supabase = await createAuthenticatedClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, reviews: [], error: 'unauthenticated' };
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'matrix_admin']);

    if (!roles || roles.length === 0) {
      return { success: false, reviews: [], error: 'unauthorized' };
    }

    const { data, error } = await supabase
      .from('parameter_value_reviews')
      .select('*')
      .order('reviewed_at', { ascending: false });

    if (error) {
      console.error('[qa-review-sync] fetchAllReviewsResult error:', error.message);
      return { success: false, reviews: [], error: error.message };
    }

    if (!data) {
      return { success: true, reviews: [], error: null };
    }

    const reviews = (data as ParameterValueReviewRow[]).map(rowToReview);
    return { success: true, reviews, error: null };
  } catch (err) {
    console.error('[qa-review-sync] fetchAllReviewsResult unexpected error:', err);
    return { success: false, reviews: [], error: String(err) };
  }
}

/**
 * Fetches all review records across parameter values, newest first.
 *
 * Returns an empty array on any error (including table-not-found).
 */
export async function fetchAllReviews(): Promise<ParameterValueReview[]> {
  const res = await fetchAllReviewsResult();
  return res.reviews;
}
