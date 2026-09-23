import { describe, expect, it } from 'vitest';
import { buildReviewCsv, normalizeReviewRows, normalizeTimestamp } from '../review-csv';
import { REVIEW_RESPONSE_TEXT_LIMIT } from '../review-responses';

const trusted = { documentVersion: '1.0.11-remediated-7-8-successor-20260918-D', manifestSha256: 'a'.repeat(64), releaseIdentity: 'matrix-options-paper:1.0.11-remediated-7-8-successor-20260918-D:feb62bd63c46f9b799a705da9ccb6db41974512ca4c73d9582111eeb3ae47337', cohortIds: new Set(['c1']), questionIds: new Set(['q1']), cohortQuestionIds: new Map([['c1', new Set(['q1'])]]) } as const;
const base = { id: 'r1', user_id: 'u1', document_version: '1.0.11-remediated-7-8-successor-20260918-D', manifest_sha256: 'a'.repeat(64), cohort_id: 'c1', question_id: 'q1', draft_text: 'new draft', submitted_text: 'old submitted', revision: 2, submitted_revision: 1, submitted_at: '2026-09-17T01:02:03Z', updated_at: '2026-09-17T01:02:04.000Z' };
const row = (extra: Record<string, unknown> = {}) => ({ ...base, ...extra });

describe('review row and CSV integrity', () => {
  it('derives changed-since-submit and preserves current and submitted revisions', () => { const result = normalizeReviewRows([row()], trusted)!; expect(result[0]).toMatchObject({ currentRevision: 2, submittedRevision: 1, status: 'changed-since-submit' }); });
  it('derives draft and submitted status from M3 row fields', () => { expect(normalizeReviewRows([row({ submitted_text: null, submitted_revision: null, revision: 1 })], trusted)![0].status).toBe('drafted'); expect(normalizeReviewRows([row({ draft_text: null, submitted_text: 'final', submitted_revision: 1, revision: 1 })], trusted)![0].status).toBe('submitted'); });
  it('accepts symmetric equal aliases and rejects conflicting aliases', () => { expect(normalizeReviewRows([row({ documentVersion: '1.0.11-remediated-7-8-successor-20260918-D', manifestSha256: 'A'.repeat(64), cohortId: 'c1', questionId: 'q1', userId: 'u1', draftText: 'new draft', submittedText: 'old submitted', currentRevision: 2, submittedRevision: 1, submittedAt: '2026-09-17T01:02:03Z', updatedAt: '2026-09-17T01:02:04Z' })], trusted)).toHaveLength(1); for (const extra of [{ documentVersion: 'other' }, { manifestSha256: 'b'.repeat(64) }, { cohortId: 'other' }, { questionId: 'other' }, { userId: 'other' }, { submittedText: 'other' }, { submitted_revision: 1, submittedRevision: 2 }, { submitted_at: '2026-09-17T01:02:03Z', submittedAt: '2026-09-17T01:02:04Z' }]) expect(normalizeReviewRows([row(extra)], trusted)).toBeNull(); });
  it.each([{ revision: '2' }, { revision: true }, { revision: 1.2 }, { revision: -1 }, { user_id: '   ' }, { submitted_at: '2026-02-30T01:02:03Z' }, { submittedAt: 'bad' }, { updatedAt: 'bad' }])('rejects malformed rows %#', (extra) => { expect(normalizeReviewRows([row(extra)], trusted)).toBeNull(); });
  it('rejects invalid aliases even when the other alias is valid', () => { expect(normalizeReviewRows([row({ submitted_at: '2026-09-17T01:02:03Z', submittedAt: 'bad' })], trusted)).toBeNull(); expect(normalizeReviewRows([row({ updated_at: null, updatedAt: 'bad' })], trusted)).toBeNull(); expect(normalizeTimestamp('2026-02-30T01:02:03Z')).toBeNull(); });
  it('accepts the exact M3 text limit and rejects over-limit draft and submitted aliases', () => { const exact = 'x'.repeat(REVIEW_RESPONSE_TEXT_LIMIT); for (const extra of [{ draft_text: exact }, { draft_text: null, draftText: exact }, { submitted_text: exact }, { submitted_text: null, submittedText: exact }]) expect(normalizeReviewRows([row(extra)], trusted)).toHaveLength(1); for (const extra of [{ draft_text: exact + 'x' }, { draft_text: null, draftText: exact + 'x' }, { submitted_text: exact + 'x' }, { submitted_text: null, submittedText: exact + 'x' }]) expect(normalizeReviewRows([row(extra)], trusted)).toBeNull(); });
  it('hardens formula cells with leading whitespace/control, BOM, CRLF, and quotes', () => { const rows = [row({ submitted_text: ' \t=SUM(A1:A2)' }), row({ submitted_text: '\u0000+1' })].map((value) => normalizeReviewRows([value], trusted)![0]); const csv = buildReviewCsv(rows); expect(csv.startsWith('\ufeff')).toBe(true); expect(csv).toContain("' \t=SUM"); expect(csv).toContain("'\u0000+1"); expect(csv).toContain('\r\n'); });
  it('accepts PostgREST timestamptz output in any zone, normalized to UTC, and rejects zone-less or impossible values', () => {
    expect(normalizeTimestamp('2026-09-22T12:00:00.123456+00:00')).toBe('2026-09-22T12:00:00.123Z');
    expect(normalizeTimestamp('2026-09-22T12:00:00+00:00')).toBe('2026-09-22T12:00:00.000Z');
    expect(normalizeTimestamp('2026-09-22T12:00:00.5Z')).toBe('2026-09-22T12:00:00.500Z');
    expect(normalizeTimestamp('2026-09-22T12:00:00.123Z')).toBe('2026-09-22T12:00:00.123Z');
    expect(normalizeTimestamp('2026-09-22T12:00:00.123456-07:00')).toBe('2026-09-22T19:00:00.123Z');
    expect(normalizeTimestamp('2026-09-22T01:30:00+05:30')).toBe('2026-09-21T20:00:00.000Z');
    expect(normalizeTimestamp('2026-09-22T12:00:00+15:00')).toBeNull();
    expect(normalizeTimestamp('2026-09-22T12:00:00+14:00')).toBe('2026-09-21T22:00:00.000Z');
    expect(normalizeTimestamp('2026-09-22T12:00:00+14:01')).toBeNull();
    expect(normalizeTimestamp('2026-09-22T12:00:00')).toBeNull();
    expect(normalizeTimestamp('2026-02-30T12:00:00+00:00')).toBeNull();
    expect(normalizeTimestamp('2026-09-22 12:00:00+00')).toBeNull();
  });
});
