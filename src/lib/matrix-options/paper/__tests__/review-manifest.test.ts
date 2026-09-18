import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { computeReviewManifestSha256, getReviewManifest, reviewManifestCanonicalBytes, REVIEW_MANIFEST_SCHEMA_VERSION } from '../review-manifest';
import type { ReviewManifestIdentity } from '../review-manifest';

describe('review manifest', () => {
  it('deterministically binds the paper release and validated review contracts', () => {
    const first = getReviewManifest();
    const second = getReviewManifest();
    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe(REVIEW_MANIFEST_SCHEMA_VERSION);
    expect(first.documentVersion).toBe('1.0.11-remediated-7-8-successor-20260918-D');
    expect(first.paperSha256).toBe('feb62bd63c46f9b799a705da9ccb6db41974512ca4c73d9582111eeb3ae47337');
    expect(first.questionIds).toHaveLength(12);
    expect(Object.keys(first.cohortQuestionIds)).toHaveLength(5);
    expect(first.sha256).toMatch(/^[a-f0-9]{64}$/);
    const { sha256: _sha256, ...identity } = first;
    const reviewIdentity = identity as ReviewManifestIdentity;
    expect(first.sha256).toBe(computeReviewManifestSha256(reviewIdentity));
    expect(first.sha256).toBe(createHash('sha256').update(reviewManifestCanonicalBytes(reviewIdentity), 'utf8').digest('hex'));
    expect(computeReviewManifestSha256({ ...reviewIdentity, paperSha256: '0'.repeat(64) })).not.toBe(first.sha256);
    expect(first.sha256).toBe('5d83a3c9ba78e4da234c70678fcf57db9abbefc189002303879ebc0c80ac926e');
  });
});
