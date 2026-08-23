/**
 * Pure deterministic reduction helper for parameter_value_reviews.
 *
 * Separated from qa-review-sync.ts ('use server') so it remains a pure synchronous
 * calculation without Next.js Server Action async constraints.
 */

import type { ParameterValueReview } from './qa-review-sync';

export interface CurrentVerificationState {
  parameter_value_id: string;
  current_qa_status: string;
  latest_review_id: string;
  latest_reviewer_note: string;
  latest_reviewed_by: string | null;
  latest_reviewed_at: string;
  verification_count: number;
  total_audit_events: number;
  /** @deprecated Use verification_count or total_audit_events explicitly */
  history_count: number;
}

export function reduceToCurrentVerificationStates(
  reviews: ParameterValueReview[],
): Record<string, CurrentVerificationState> {
  const map: Record<string, CurrentVerificationState> = {};
  const totalAuditCounts: Record<string, number> = {};

  // Count all raw audit events per parameter ID
  for (const r of reviews) {
    totalAuditCounts[r.parameter_value_id] = (totalAuditCounts[r.parameter_value_id] ?? 0) + 1;
  }

  // Total ordering: strictly chronological by reviewed_at, with deterministic immutable id tie-breaking
  const sorted = [...reviews].sort((a, b) => {
    const timeA = new Date(a.reviewed_at).getTime();
    const timeB = new Date(b.reviewed_at).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return a.id.localeCompare(b.id);
  });

  for (const r of sorted) {
    // Exclude both flag submission ([FLAG:...) and flag resolution ([FLAG_RESOLVED:...) events
    // from verification_count and current parameter verification state selection
    if (r.reviewer_note.startsWith('[FLAG:') || r.reviewer_note.startsWith('[FLAG_RESOLVED:')) {
      continue;
    }

    let status = r.new_qa_status || 'needs_review';
    // Fail closed on contradictory status/note combinations
    if (
      status === 'approved' &&
      (r.reviewer_note.includes('[VERIFICATION: discrepancy]') ||
        r.reviewer_note.includes('[VERIFICATION: needs_review]'))
    ) {
      status = 'needs_review';
    } else if (
      status !== 'approved' &&
      r.reviewer_note.includes('[VERIFICATION: confirmed]')
    ) {
      status = 'needs_review';
    }

    const prev = map[r.parameter_value_id];
    const verificationCount = (prev?.verification_count ?? 0) + 1;
    map[r.parameter_value_id] = {
      parameter_value_id: r.parameter_value_id,
      current_qa_status: status,
      latest_review_id: r.id,
      latest_reviewer_note: r.reviewer_note,
      latest_reviewed_by: r.reviewed_by,
      latest_reviewed_at: r.reviewed_at,
      verification_count: verificationCount,
      total_audit_events: totalAuditCounts[r.parameter_value_id] ?? verificationCount,
      history_count: verificationCount,
    };
  }

  return map;
}
