import { z } from 'zod';

export const REVIEW_RESPONSE_TEXT_LIMIT = 20000;
export const REVIEW_RESPONSE_ACTIONS = ['save-draft', 'submit'] as const;
export type ReviewResponseAction = (typeof REVIEW_RESPONSE_ACTIONS)[number];

export const reviewResponseRequestSchema = z.object({
  documentVersion: z.string().trim().min(1).max(128),
  manifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  cohortId: z.string().trim().min(1).max(80),
  action: z.enum(REVIEW_RESPONSE_ACTIONS),
  text: z.string().max(REVIEW_RESPONSE_TEXT_LIMIT),
  expectedRevision: z.number().int().nonnegative().nullable(),
}).strict();

export type ReviewResponseRequest = z.infer<typeof reviewResponseRequestSchema>;

export const reviewResponseRowSchema = z.object({
  id: z.string().optional(),
  document_version: z.string(),
  manifest_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  cohort_id: z.string(),
  question_id: z.string(),
  draft_text: z.string().max(REVIEW_RESPONSE_TEXT_LIMIT).nullable(),
  submitted_text: z.string().max(REVIEW_RESPONSE_TEXT_LIMIT).nullable(),
  revision: z.number().int().nonnegative(),
  submitted_revision: z.number().int().nonnegative().nullable(),
  submitted_at: z.string().nullable(),
  updated_at: z.string().nullable(),
}).strict();

export type ReviewResponseRow = z.infer<typeof reviewResponseRowSchema>;

export type ReviewResponseOutcome =
  | { readonly outcome: 'ok'; readonly row?: ReviewResponseRow | null }
  | { readonly outcome: 'noop_already_submitted'; readonly row?: ReviewResponseRow | null }
  | { readonly outcome: 'stale_revision'; readonly row?: ReviewResponseRow | null }
  | { readonly outcome: 'unknown_identity' }
  | { readonly outcome: 'stale_manifest' }
  | { readonly outcome: 'unauthenticated' }
  | { readonly outcome: 'too_large' }
  | { readonly outcome: 'persistence_unavailable' };

export function reviewResponseOutcomeStatus(outcome: ReviewResponseOutcome['outcome']): number {
  switch (outcome) {
    case 'ok': return 200;
    case 'noop_already_submitted': return 200;
    case 'stale_revision': return 409;
    case 'unknown_identity': return 404;
    case 'stale_manifest': return 409;
    case 'unauthenticated': return 401;
    case 'too_large': return 413;
    case 'persistence_unavailable': return 503;
  }
}

export function reviewResponseStatusLabel(row: ReviewResponseRow | null | undefined): 'not-started' | 'drafted' | 'submitted' | 'changed-since-submit' {
  if (!row || row.revision === 0 || (!row.draft_text && !row.submitted_text)) return 'not-started';
  if (row.submitted_revision !== null && row.revision > row.submitted_revision) return 'changed-since-submit';
  if (row.submitted_revision !== null && row.submitted_text) return 'submitted';
  return 'drafted';
}
