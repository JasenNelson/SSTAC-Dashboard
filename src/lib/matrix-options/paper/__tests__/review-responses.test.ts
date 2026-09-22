import { describe, expect, it } from 'vitest';

import { REVIEW_RESPONSE_TEXT_LIMIT, reviewResponseOutcomeStatus, reviewResponseRequestSchema, reviewResponseStatusLabel } from '../review-responses';

describe('review response contracts', () => {
  it('accepts the exact save and submit payload shape and rejects extra fields', () => {
    const base = { documentVersion: '1.0.11-remediated-7-8-successor-20260918-D', manifestSha256: 'a'.repeat(64), cohortId: 'categories', action: 'save-draft', text: 'draft', expectedRevision: null };
    expect(reviewResponseRequestSchema.safeParse(base).success).toBe(true);
    expect(reviewResponseRequestSchema.safeParse({ ...base, userId: 'attacker' }).success).toBe(false);
  });

  it('enforces the shared response text limit and maps outcomes to HTTP', () => {
    const base = { documentVersion: '1.0.11-remediated-7-8-successor-20260918-D', manifestSha256: 'a'.repeat(64), cohortId: 'categories', action: 'save-draft', expectedRevision: null };
    expect(reviewResponseRequestSchema.safeParse({ ...base, text: 'x'.repeat(REVIEW_RESPONSE_TEXT_LIMIT) }).success).toBe(true);
    expect(reviewResponseRequestSchema.safeParse({ ...base, text: 'x'.repeat(REVIEW_RESPONSE_TEXT_LIMIT + 1) }).success).toBe(false);
    expect(reviewResponseOutcomeStatus('ok')).toBe(200);
    expect(reviewResponseOutcomeStatus('noop_already_submitted')).toBe(200);
    expect(reviewResponseOutcomeStatus('stale_revision')).toBe(409);
    expect(reviewResponseOutcomeStatus('unknown_identity')).toBe(404);
    expect(reviewResponseOutcomeStatus('unauthenticated')).toBe(401);
    expect(reviewResponseOutcomeStatus('too_large')).toBe(413);
  });

  it('distinguishes submitted, changed, drafted and not-started rows', () => {
    expect(reviewResponseStatusLabel(null)).toBe('not-started');
    expect(reviewResponseStatusLabel({ draft_text: 'draft', submitted_text: null, revision: 1, submitted_revision: null } as never)).toBe('drafted');
    expect(reviewResponseStatusLabel({ draft_text: 'same', submitted_text: 'same', revision: 1, submitted_revision: 1 } as never)).toBe('submitted');
    expect(reviewResponseStatusLabel({ draft_text: 'new', submitted_text: 'old', revision: 2, submitted_revision: 1 } as never)).toBe('changed-since-submit');
  });
});
