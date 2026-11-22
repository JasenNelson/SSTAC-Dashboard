import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { GUIDED_R2_PROMPTS, GUIDED_R2_TARGETS } from '../guided-r2-contract';
import { GUIDED_ADMIN_CSV_COLUMNS, buildGuidedAdminCsv, normalizeGuidedAdminRows, type GuidedAdminRow } from '../guided-r2-admin';
import {
  GUIDED_ADMIN_VIEW_HEADINGS,
  R2_JOURNEY_REVIEWER_A_TARGETS,
  checkGuidedAdminCsvMatches,
  checkGuidedAdminViewMatches,
  expectedReviewFromDatabase,
  expectedStatus,
  parseCsv,
  safeEvidenceMessage,
  sha256Hex,
  type ExpectedGuidedEntry,
  type ExpectedGuidedReview,
  type StoredGuidedEntry,
} from '../guided-r2-admin-evidence';

// The disposable local journey's administrator evidence: the admin view and the scoped CSV must
// exactly match one reviewer's stored entries and completion (labels and timestamps included),
// against expectations derived from the database state and the pinned fixture; failures never
// contain reviewer text.
const identity = { documentVersion: 'phase2-review-2026-11-fa356b89', guidedManifestSha256: 'a'.repeat(64), reviewManifestSha256: 'b'.repeat(64) };
const USER = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const T = (n: number) => `2026-11-21T00:00:0${n}.123456+00:00`;
/** Reviewer A's four stored targets, as read from the database (sorted kind, id). */
const stored: StoredGuidedEntry[] = [
  { targetKind: 'choice-prompt', targetId: 'structure-approach', draftChoiceId: 'refine', draftRationale: 'Clarify placement.', draftText: null, submittedChoiceId: 'unsure', submittedRationale: 'Clarify placement.', submittedText: null, revision: 3, submittedRevision: 2, updatedAt: T(1), submittedAt: T(2) },
  { targetKind: 'section-comment', targetId: 'sec-phase2-5', draftChoiceId: null, draftRationale: null, draftText: 'Section 5 needs a worked example.', submittedChoiceId: null, submittedRationale: null, submittedText: 'Section 5 needs a worked example.', revision: 1, submittedRevision: 1, updatedAt: T(3), submittedAt: T(4) },
  { targetKind: 'text-prompt', targetId: 'site-assignment', draftChoiceId: null, draftRationale: null, draftText: 'Estuary sites are ambiguous.', submittedChoiceId: null, submittedRationale: null, submittedText: 'Estuary sites are ambiguous.', revision: 2, submittedRevision: 2, updatedAt: T(5), submittedAt: T(6) },
  { targetKind: 'whole-paper-comment', targetId: 'whole-paper', draftChoiceId: null, draftRationale: null, draftText: '=SUM(A1) is not a formula here', submittedChoiceId: null, submittedRationale: null, submittedText: null, revision: 1, submittedRevision: null, updatedAt: T(7), submittedAt: null },
];
const completion = { revision: 2, digest: 'c'.repeat(64), completedAt: T(8) };
const expected: ExpectedGuidedReview = expectedReviewFromDatabase({ userId: USER, identity, entries: stored, completion, fixture: R2_JOURNEY_REVIEWER_A_TARGETS });
const entries = expected.entries;
/** The admin row the application would produce for an entry (built here independently of guided-r2-admin.ts). */
const adminRow = (entry: ExpectedGuidedEntry, patch: Partial<GuidedAdminRow> = {}): GuidedAdminRow => ({
  userId: USER, targetKind: entry.targetKind, targetId: entry.targetId, targetLabel: entry.targetLabel,
  draftChoiceId: entry.draftChoiceId, draftChoiceLabel: entry.draftChoiceLabel, draftRationale: entry.draftRationale, draftText: entry.draftText,
  submittedChoiceId: entry.submittedChoiceId, submittedChoiceLabel: entry.submittedChoiceLabel, submittedRationale: entry.submittedRationale, submittedText: entry.submittedText,
  revision: entry.revision, submittedRevision: entry.submittedRevision, updatedAt: entry.updatedAt, submittedAt: entry.submittedAt,
  status: expectedStatus(entry), completionRevision: 2, completedAt: T(8), completionDigest: 'c'.repeat(64), ...patch,
});
const csv = (rows: GuidedAdminRow[]) => buildGuidedAdminCsv(rows, identity);
const goodCsv = () => csv(entries.map((entry) => adminRow(entry)));
const withRow = (index: number, patch: Partial<GuidedAdminRow>) => csv(entries.map((entry, at) => adminRow(entry, at === index ? patch : {})));
/** The rendered view cells as GuidedAdminClient.tsx renders them (innerText). */
const viewRow = (entry: ExpectedGuidedEntry, patch: Partial<Record<string, string>> = {}) => {
  const values: Record<string, string> = {
    Reviewer: USER, Target: `${entry.targetLabel}\n${entry.targetKind} ${entry.targetId}`,
    'Draft choice': entry.draftChoiceId ? `${entry.draftChoiceLabel} (${entry.draftChoiceId})` : '', 'Draft rationale': entry.draftRationale ?? '', 'Draft text': entry.draftText ?? '',
    'Submitted choice': entry.submittedChoiceId ? `${entry.submittedChoiceLabel} (${entry.submittedChoiceId})` : '', 'Submitted rationale': entry.submittedRationale ?? '', 'Submitted text': entry.submittedText ?? '',
    Status: expectedStatus(entry), Revision: String(entry.revision), 'Submitted revision': entry.submittedRevision === null ? '' : String(entry.submittedRevision),
    Updated: entry.updatedAt, Submitted: entry.submittedAt ?? '', 'Completion revision': '2', Completed: T(8), ...patch,
  };
  return GUIDED_ADMIN_VIEW_HEADINGS.map((name) => values[name]);
};
const goodView = () => ({ headers: [...GUIDED_ADMIN_VIEW_HEADINGS], rows: entries.map((entry) => viewRow(entry)) });

describe('the pinned journey fixture and independent expectations', () => {
  it('is exactly the four reviewer-A targets, each a real target, with labels equal to the reviewed manifest prompts', () => {
    expect(R2_JOURNEY_REVIEWER_A_TARGETS.map((target) => `${target.targetKind}:${target.targetId}`)).toEqual(['choice-prompt:structure-approach', 'section-comment:sec-phase2-5', 'text-prompt:site-assignment', 'whole-paper-comment:whole-paper']);
    for (const target of R2_JOURNEY_REVIEWER_A_TARGETS) expect(GUIDED_R2_TARGETS.some((item) => item.kind === target.targetKind && item.id === target.targetId), target.targetId).toBe(true);
    const structure = GUIDED_R2_PROMPTS.find((prompt) => prompt.id === 'structure-approach')!;
    const site = GUIDED_R2_PROMPTS.find((prompt) => prompt.id === 'site-assignment')!;
    expect(R2_JOURNEY_REVIEWER_A_TARGETS[0].targetLabel).toBe(structure.label);
    expect(structure.kind === 'choice' && Object.fromEntries(structure.options.map((option) => [option.id, option.label]))).toEqual(R2_JOURNEY_REVIEWER_A_TARGETS[0].choiceLabels);
    expect(R2_JOURNEY_REVIEWER_A_TARGETS[2].targetLabel).toBe(site.label);
  });

  it('derives labels from the fixture and values and timestamps from the stored rows', () => {
    expect(entries[0]).toMatchObject({ targetLabel: 'How well does the proposed overall structure work?', draftChoiceLabel: 'Needs refinement', submittedChoiceLabel: 'Unsure', updatedAt: T(1), submittedAt: T(2) });
    expect(entries[1]).toMatchObject({ targetLabel: 'Section 5', draftChoiceLabel: null });
    expect(expected.completion).toEqual(completion);
  });

  it.each([
    ['a subset (three of four)', stored.slice(0, 3)],
    ['a superset (a fifth target)', [...stored, { ...stored[2], targetId: 'ecological-approach' }]],
    ['a substituted target', [...stored.slice(0, 3), { ...stored[3], targetKind: 'text-prompt', targetId: 'work-sequence' }]],
    ['a duplicated target', [...stored.slice(0, 3), stored[2]]],
  ])('refuses %s of stored targets, reporting counts only', (_label, rows) => {
    expect(() => expectedReviewFromDatabase({ userId: USER, identity, entries: rows, completion, fixture: R2_JOURNEY_REVIEWER_A_TARGETS })).toThrow(/not exactly the journey fixture's targets \(stored \d+, fixture 4, shared \d+\)$/);
  });

  it('the application\'s own rows for the stored state pass the independent check (so the journey can pass)', () => {
    const release = { document_version: identity.documentVersion, guided_manifest_sha256: identity.guidedManifestSha256, review_manifest_sha256: identity.reviewManifestSha256 };
    const raw = stored.map((entry) => ({
      user_id: USER, ...release, target_kind: entry.targetKind, target_id: entry.targetId, revision: entry.revision,
      draft_choice_id: entry.draftChoiceId, draft_rationale: entry.draftRationale, draft_text: entry.draftText,
      submitted_choice_id: entry.submittedChoiceId, submitted_rationale: entry.submittedRationale, submitted_text: entry.submittedText,
      submitted_revision: entry.submittedRevision, submitted_at: entry.submittedAt, updated_at: entry.updatedAt,
    }));
    const rows = normalizeGuidedAdminRows(raw, [{ user_id: USER, ...release, revision: 2, submitted_set_digest: 'c'.repeat(64), submitted_at: T(8) }], identity);
    expect(rows).not.toBeNull();
    expect(checkGuidedAdminCsvMatches(buildGuidedAdminCsv(rows!, identity), expected, GUIDED_ADMIN_CSV_COLUMNS)).toMatchObject({ ok: true });
  });

  it('refuses a stored choice that has no pinned label', () => {
    expect(() => expectedReviewFromDatabase({ userId: USER, identity, entries: [{ ...stored[0], draftChoiceId: 'invented' }, ...stored.slice(1)], completion, fixture: R2_JOURNEY_REVIEWER_A_TARGETS })).toThrow(/no pinned label/);
  });
});

describe('scoped CSV matches the stored review exactly', () => {
  it('accepts the CSV the real builder produces for the stored entries and completion', () => {
    expect(checkGuidedAdminCsvMatches(goodCsv(), expected, GUIDED_ADMIN_CSV_COLUMNS)).toMatchObject({ ok: true, counts: { rows: 4, expectedRows: 4 } });
  });

  it.each([
    ['a missing entry', () => csv(entries.slice(0, 3).map((entry) => adminRow(entry))), 'rowCount'],
    ['an extra entry', () => csv([...entries.map((entry) => adminRow(entry)), adminRow({ ...entries[2], targetId: 'work-sequence' })]), 'rowCount'],
    ['another reviewer\'s row', () => withRow(0, { userId: OTHER }), 'reviewer'],
    ['a changed draft text', () => withRow(2, { draftText: 'Edited elsewhere' }), 'draftText'],
    ['a stale submitted text', () => withRow(1, { submittedText: 'Even older' }), 'submittedText'],
    ['a wrong choice', () => withRow(0, { draftChoiceId: 'sound' }), 'draftChoice'],
    ['a wrong target label', () => withRow(1, { targetLabel: 'Section 6' }), 'labels'],
    ['a wrong choice label', () => withRow(0, { draftChoiceLabel: 'Sound as proposed' }), 'labels'],
    ['a shifted updated timestamp', () => withRow(2, { updatedAt: '2026-11-21T00:00:05.123457+00:00' }), 'timestamps'],
    ['a reformatted submitted timestamp', () => withRow(0, { submittedAt: '2026-11-21T00:00:02.123Z' }), 'timestamps'],
    ['a wrong revision', () => withRow(2, { revision: 5 }), 'revisions'],
    ['a wrong status', () => withRow(3, { status: 'submitted' }), 'status'],
    ['a stale completion', () => csv(entries.map((entry) => adminRow(entry, { completionRevision: 1 }))), 'completion'],
    ['a wrong completion digest', () => csv(entries.map((entry) => adminRow(entry, { completionDigest: 'd'.repeat(64) }))), 'completion'],
    ['a wrong completion time', () => csv(entries.map((entry) => adminRow(entry, { completedAt: T(9) }))), 'completion'],
  ])('rejects %s', (_label, body, failing) => {
    const result = checkGuidedAdminCsvMatches(body(), expected, GUIDED_ADMIN_CSV_COLUMNS);
    expect(result.ok).toBe(false);
    expect(result.checks[failing]).toBe(false);
  });

  it('applies the export\'s formula hardening when comparing (the text starting with = still matches)', () => {
    expect(goodCsv()).toContain("\"'=SUM(A1) is not a formula here\"");
    expect(checkGuidedAdminCsvMatches(goodCsv(), expected, GUIDED_ADMIN_CSV_COLUMNS).checks.draftText).toBe(true);
  });

  it('rejects a reordered header and malformed CSV', () => {
    expect(checkGuidedAdminCsvMatches(goodCsv().replace('"draftText","submittedChoiceId"', '"submittedChoiceId","draftText"'), expected, GUIDED_ADMIN_CSV_COLUMNS).checks.header).toBe(false);
    expect(checkGuidedAdminCsvMatches('"unterminated', expected, GUIDED_ADMIN_CSV_COLUMNS).checks.parsed).toBe(false);
  });

  it('parses the BOM, CRLF and quoted cells', () => {
    expect(parseCsv(String.fromCharCode(0xfeff) + '"a","b"\r\n"x, ""y""","line\r\nbreak"\r\n')).toEqual([['a', 'b'], ['x, "y"', 'line\r\nbreak']]);
    expect(parseCsv('a"b\r\n')).toBeNull();
  });
});

describe('admin view matches the stored review exactly, field by field', () => {
  it('pins the headings to the GuidedAdminClient source', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../../../app/(dashboard)/admin/matrix-options-paper-reviews/GuidedAdminClient.tsx'), 'utf8');
    expect(source).toContain(`{[${GUIDED_ADMIN_VIEW_HEADINGS.map((name) => `'${name}'`).join(',')}].map((heading)`);
  });

  it('accepts the rendered rows of the stored entries', () => {
    expect(checkGuidedAdminViewMatches(goodView(), expected)).toMatchObject({ ok: true });
  });

  it.each([
    ['another reviewer', 1, { Reviewer: OTHER }, 'reviewer'],
    ['another target', 2, { Target: `${entries[2].targetLabel}\ntext-prompt work-sequence` }, 'sameTargets'],
    ['a wrong target label', 1, { Target: 'Section 6\nsection-comment sec-phase2-5' }, 'targetLabels'],
    ['a wrong choice label', 0, { 'Draft choice': 'Sound as proposed (refine)' }, 'choices'],
    ['a changed text', 2, { 'Draft text': 'Edited elsewhere' }, 'texts'],
    ['a wrong status', 2, { Status: 'saved-draft' }, 'status'],
    ['a wrong revision', 2, { Revision: '9' }, 'revisions'],
    ['a wrong updated time', 2, { Updated: T(9) }, 'timestamps'],
    ['a missing submitted time', 1, { Submitted: '' }, 'timestamps'],
    ['no completion shown', 2, { 'Completion revision': '', Completed: '' }, 'completion'],
    ['a wrong completion time', 2, { Completed: T(9) }, 'completion'],
  ])('rejects %s', (_label, index, patch, failing) => {
    const view = goodView();
    const rows = view.rows.map((row, at) => (at === index ? viewRow(entries[index], patch) : row));
    const result = checkGuidedAdminViewMatches({ headers: view.headers, rows }, expected);
    expect(result.ok).toBe(false);
    expect(result.checks[failing]).toBe(false);
  });

  it('does not pass because the expected text appears in some arbitrary cell', () => {
    const rows = goodView().rows.map((row, index) => (index === 2 ? viewRow(entries[2], { 'Draft text': '', 'Draft rationale': entries[2].draftText! }) : row));
    expect(JSON.stringify(rows)).toContain(entries[2].draftText);
    const result = checkGuidedAdminViewMatches({ headers: [...GUIDED_ADMIN_VIEW_HEADINGS], rows }, expected);
    expect(result.ok).toBe(false);
    expect(result.checks.texts).toBe(false);
    expect(result.checks.rationales).toBe(false);
  });

  it('rejects a missing row or an extra row', () => {
    const view = goodView();
    expect(checkGuidedAdminViewMatches({ headers: view.headers, rows: view.rows.slice(1) }, expected).checks.rowCount).toBe(false);
    expect(checkGuidedAdminViewMatches({ headers: view.headers, rows: [...view.rows, viewRow({ ...entries[2], targetId: 'work-sequence' })] }, expected).checks.rowCount).toBe(false);
  });

  it('reports failures as booleans, counts and a digest only, never reviewer text', () => {
    const rows = goodView().rows.map((row, index) => (index === 2 ? viewRow(entries[2], { 'Draft text': 'Private reviewer words' }) : row));
    const result = checkGuidedAdminViewMatches({ headers: [...GUIDED_ADMIN_VIEW_HEADINGS], rows }, expected);
    const message = safeEvidenceMessage('view', result);
    expect(message).not.toContain('Private reviewer words');
    expect(message).not.toContain(USER);
    expect(message).toContain(result.bodySha256);
    expect(result.bodySha256).toBe(sha256Hex(JSON.stringify(rows)));
  });
});
