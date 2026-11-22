import { createHash } from 'node:crypto';

import type { Page } from '@playwright/test';

/**
 * Redacted administrator evidence for the disposable local Guided R2 journey
 * (e2e/matrix-options-paper-r2-fullstack.spec.ts and its unit tests; no application route imports
 * it). The administrator's Guided R2 view and scoped CSV must EXACTLY match one reviewer's entries
 * and completion: the same targets, no more and no fewer, and every field equal, including labels
 * and timestamps. Expected values are derived independently of the export under test: values and
 * timestamps from the local database state (expectedReviewFromDatabase), labels from the pinned
 * journey fixture below (whose labels a unit test pins to the reviewed manifest prompts). Nothing is
 * derived from the export or view being checked, and nothing is derived through guided-r2-admin.ts.
 * Text is compared but never reported: failures carry booleans, counts and digests only.
 */
export interface GuidedReleaseIdentity { readonly documentVersion: string; readonly guidedManifestSha256: string; readonly reviewManifestSha256: string }
export interface ExpectedGuidedEntry {
  readonly targetKind: string; readonly targetId: string; readonly targetLabel: string;
  readonly draftChoiceId: string | null; readonly draftChoiceLabel: string | null; readonly draftRationale: string | null; readonly draftText: string | null;
  readonly submittedChoiceId: string | null; readonly submittedChoiceLabel: string | null; readonly submittedRationale: string | null; readonly submittedText: string | null;
  readonly revision: number; readonly submittedRevision: number | null;
  readonly updatedAt: string; readonly submittedAt: string | null;
}
export interface ExpectedGuidedCompletion { readonly revision: number; readonly digest: string; readonly completedAt: string }
export interface ExpectedGuidedReview {
  readonly userId: string;
  readonly identity: GuidedReleaseIdentity;
  readonly entries: readonly ExpectedGuidedEntry[];
  readonly completion: ExpectedGuidedCompletion | null;
}

/** One target of the reviewed journey fixture, with its pinned display labels. */
export interface JourneyTarget {
  readonly targetKind: string; readonly targetId: string; readonly targetLabel: string;
  readonly choiceLabels?: Readonly<Record<string, string>>;
}
const CHOICE_LABELS = Object.freeze({ sound: 'Sound as proposed', refine: 'Needs refinement', unsure: 'Unsure' });
/**
 * The EXACT four targets reviewer A has saved when the administrator step runs (journey steps 1-8):
 * the structure choice, section 5, the site-assignment prompt and the whole-paper comment. The
 * administrator evidence accepts this set only: no subset, no superset. Sorted as the admin view
 * and export sort rows (kind, then id).
 */
export const R2_JOURNEY_REVIEWER_A_TARGETS: readonly JourneyTarget[] = Object.freeze([
  { targetKind: 'choice-prompt', targetId: 'structure-approach', targetLabel: 'How well does the proposed overall structure work?', choiceLabels: CHOICE_LABELS },
  { targetKind: 'section-comment', targetId: 'sec-phase2-5', targetLabel: 'Section 5' },
  { targetKind: 'text-prompt', targetId: 'site-assignment', targetLabel: 'Where might assigning a real site to a sediment use or waterbody group be ambiguous?' },
  { targetKind: 'whole-paper-comment', targetId: 'whole-paper', targetLabel: 'Whole-paper comment' },
]);

/** One reviewer's stored entry as read from the local database (timestamps as JSON text, UTC). */
export interface StoredGuidedEntry {
  readonly targetKind: string; readonly targetId: string;
  readonly draftChoiceId: string | null; readonly draftRationale: string | null; readonly draftText: string | null;
  readonly submittedChoiceId: string | null; readonly submittedRationale: string | null; readonly submittedText: string | null;
  readonly revision: number; readonly submittedRevision: number | null;
  readonly updatedAt: string; readonly submittedAt: string | null;
}
export interface StoredGuidedCompletion { readonly revision: number; readonly digest: string; readonly completedAt: string }

const keyOf = (kind: string, id: string) => `${kind}:${id}`;

/**
 * The expected administrator rows for one reviewer, from the database state and the pinned fixture.
 * Throws (counts only, never text) unless the stored targets are exactly the fixture's targets.
 */
export function expectedReviewFromDatabase(input: {
  readonly userId: string; readonly identity: GuidedReleaseIdentity; readonly entries: readonly StoredGuidedEntry[];
  readonly completion: StoredGuidedCompletion | null; readonly fixture: readonly JourneyTarget[];
}): ExpectedGuidedReview {
  const fixtureKeys = input.fixture.map((target) => keyOf(target.targetKind, target.targetId));
  const storedKeys = input.entries.map((entry) => keyOf(entry.targetKind, entry.targetId));
  const exact = new Set(fixtureKeys).size === fixtureKeys.length && new Set(storedKeys).size === storedKeys.length
    && storedKeys.length === fixtureKeys.length && fixtureKeys.every((key) => storedKeys.includes(key));
  if (!exact) throw new Error(`stored targets are not exactly the journey fixture's targets (stored ${storedKeys.length}, fixture ${fixtureKeys.length}, shared ${storedKeys.filter((key) => fixtureKeys.includes(key)).length})`);
  const label = (target: JourneyTarget, choiceId: string | null) => {
    if (choiceId === null) return null;
    const value = target.choiceLabels?.[choiceId];
    if (!value) throw new Error(`stored choice of ${target.targetKind}:${target.targetId} has no pinned label`);
    return value;
  };
  const entries = input.fixture.map((target) => {
    const stored = input.entries.find((entry) => keyOf(entry.targetKind, entry.targetId) === keyOf(target.targetKind, target.targetId))!;
    return {
      ...stored, targetLabel: target.targetLabel,
      draftChoiceLabel: label(target, stored.draftChoiceId), submittedChoiceLabel: label(target, stored.submittedChoiceId),
    };
  });
  return { userId: input.userId, identity: input.identity, entries, completion: input.completion };
}
export interface SafeEvidence {
  readonly ok: boolean;
  readonly checks: Readonly<Record<string, boolean>>;
  readonly counts: Readonly<Record<string, number>>;
  readonly bodySha256: string;
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Message for a failed check: booleans, counts and the body digest only, never cell text. */
export function safeEvidenceMessage(what: string, evidence: SafeEvidence): string {
  return `${what} failed: ${JSON.stringify({ checks: evidence.checks, counts: evidence.counts, bodySha256: evidence.bodySha256 })}`;
}

/** The admin status label for an entry (guided-r2-admin.ts normalizeGuidedAdminRows). */
export function expectedStatus(entry: ExpectedGuidedEntry): 'saved-draft' | 'submitted' | 'changed-since-submit' {
  if (entry.submittedRevision === null) return 'saved-draft';
  return entry.revision > entry.submittedRevision ? 'changed-since-submit' : 'submitted';
}

/** The CSV cell hardening of guided-r2-admin.ts (a leading formula character is prefixed with a quote). */
function csvValue(value: string | number | null): string {
  const raw = value === null ? '' : String(value);
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
}

/** RFC 4180 parser for the admin export (leading BOM, CRLF, quoted cells, doubled quotes). */
export function parseCsv(body: string): string[][] | null {
  const text = body.startsWith('\uFEFF') ? body.slice(1) : body;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let atCellStart = true;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { cell += '"'; index += 1; } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"' && atCellStart) { quoted = true; atCellStart = false; continue; }
    if (char === '"') return null;
    if (char === ',') { row.push(cell); cell = ''; atCellStart = true; continue; }
    if (char === '\r' && text[index + 1] === '\n') { index += 1; row.push(cell); rows.push(row); row = []; cell = ''; atCellStart = true; continue; }
    if (char === '\n' || char === '\r') return null;
    cell += char;
    atCellStart = false;
  }
  if (quoted) return null;
  if (!atCellStart || cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

/**
 * The scoped guided CSV (`/api/matrix-options/paper/guided-r2/export?userId=<reviewer>`) against the
 * reviewer's database state. Columns are matched by header name.
 */
export function checkGuidedAdminCsvMatches(body: string, expected: ExpectedGuidedReview, columns: readonly string[]): SafeEvidence {
  const bodySha256 = sha256Hex(body);
  const parsed = parseCsv(body);
  const header = parsed?.[0] ?? [];
  const data = parsed ? parsed.slice(1) : [];
  const at = (row: readonly string[], name: string) => { const index = header.indexOf(name); return index < 0 ? undefined : row[index]; };
  const byKey = new Map(data.map((row) => [keyOf(at(row, 'targetKind') ?? '', at(row, 'targetId') ?? ''), row]));
  const expectedKeys = expected.entries.map((entry) => keyOf(entry.targetKind, entry.targetId));
  const all = (fn: (entry: ExpectedGuidedEntry, row: readonly string[]) => boolean) =>
    expected.entries.every((entry) => { const row = byKey.get(keyOf(entry.targetKind, entry.targetId)); return row !== undefined && fn(entry, row); });
  const checks = {
    parsed: parsed !== null,
    header: header.length === columns.length && columns.every((name, index) => header[index] === name),
    rowCount: data.length === expected.entries.length && byKey.size === data.length,
    sameTargets: expectedKeys.length === byKey.size && expectedKeys.every((key) => byKey.has(key)),
    rowWidth: data.every((row) => row.length === columns.length),
    reviewer: data.every((row) => at(row, 'userId') === expected.userId),
    release: data.every((row) => at(row, 'documentVersion') === expected.identity.documentVersion
      && at(row, 'guidedManifestSha256') === expected.identity.guidedManifestSha256 && at(row, 'reviewManifestSha256') === expected.identity.reviewManifestSha256),
    draftChoice: all((entry, row) => at(row, 'draftChoiceId') === csvValue(entry.draftChoiceId)),
    draftRationale: all((entry, row) => at(row, 'draftRationale') === csvValue(entry.draftRationale)),
    draftText: all((entry, row) => at(row, 'draftText') === csvValue(entry.draftText)),
    submittedChoice: all((entry, row) => at(row, 'submittedChoiceId') === csvValue(entry.submittedChoiceId)),
    submittedRationale: all((entry, row) => at(row, 'submittedRationale') === csvValue(entry.submittedRationale)),
    submittedText: all((entry, row) => at(row, 'submittedText') === csvValue(entry.submittedText)),
    revisions: all((entry, row) => at(row, 'revision') === String(entry.revision) && at(row, 'submittedRevision') === csvValue(entry.submittedRevision)),
    status: all((entry, row) => at(row, 'status') === expectedStatus(entry)),
    labels: all((entry, row) => at(row, 'targetLabel') === csvValue(entry.targetLabel)
      && at(row, 'draftChoiceLabel') === csvValue(entry.draftChoiceLabel) && at(row, 'submittedChoiceLabel') === csvValue(entry.submittedChoiceLabel)),
    timestamps: all((entry, row) => at(row, 'updatedAt') === csvValue(entry.updatedAt) && at(row, 'submittedAt') === csvValue(entry.submittedAt)),
    completion: data.every((row) => (expected.completion === null
      ? at(row, 'completionRevision') === '' && at(row, 'completionDigest') === '' && at(row, 'completedAt') === ''
      : at(row, 'completionRevision') === String(expected.completion.revision) && at(row, 'completionDigest') === expected.completion.digest
        && at(row, 'completedAt') === csvValue(expected.completion.completedAt))),
  };
  return { ok: Object.values(checks).every(Boolean), checks, counts: { rows: data.length, expectedRows: expected.entries.length, columns: header.length }, bodySha256 };
}

/** Column headings of the guided admin table (GuidedAdminClient.tsx; a unit test pins them to that source). */
export const GUIDED_ADMIN_VIEW_HEADINGS = Object.freeze(['Reviewer', 'Target', 'Draft choice', 'Draft rationale', 'Draft text', 'Submitted choice', 'Submitted rationale', 'Submitted text', 'Status', 'Revision', 'Submitted revision', 'Updated', 'Submitted', 'Completion revision', 'Completed']);
export interface GuidedAdminTable { readonly headers: readonly string[]; readonly rows: readonly (readonly string[])[] }

/** Reads the guided admin table's headings and every body cell's rendered text (nothing is printed). */
export async function readGuidedAdminTable(page: Page): Promise<GuidedAdminTable> {
  const table = page.getByRole('table', { name: 'Guided R2 review responses' });
  await table.waitFor({ state: 'visible', timeout: 30_000 });
  const headers = (await table.locator('thead th').allInnerTexts()).map((value) => value.trim());
  const rows = await table.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td as HTMLElement).innerText)));
  return { headers, rows };
}

/**
 * The administrator's guided view, filtered to the reviewer, against the reviewer's database state:
 * exactly the same targets, and every displayed field (reviewer, target label, choice labels,
 * rationale and text, status, revisions, timestamps, completion) checked exactly.
 */
export function checkGuidedAdminViewMatches(table: GuidedAdminTable, expected: ExpectedGuidedReview): SafeEvidence {
  const bodySha256 = sha256Hex(JSON.stringify(table.rows));
  const at = (row: readonly string[], name: string) => { const index = table.headers.indexOf(name); return index < 0 ? undefined : (row[index] ?? '').trim(); };
  const targetKey = (row: readonly string[]) => (at(row, 'Target') ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1)?.replace(/\s+/, ':') ?? '';
  const byKey = new Map(table.rows.map((row) => [targetKey(row), row]));
  const expectedKeys = expected.entries.map((entry) => keyOf(entry.targetKind, entry.targetId));
  const all = (fn: (entry: ExpectedGuidedEntry, row: readonly string[]) => boolean) =>
    expected.entries.every((entry) => { const row = byKey.get(keyOf(entry.targetKind, entry.targetId)); return row !== undefined && fn(entry, row); });
  const choice = (cell: string | undefined, id: string | null, label: string | null) => (id === null ? cell === '' : cell === `${label ?? ''} (${id})`);
  const targetLines = (row: readonly string[]) => (at(row, 'Target') ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const text = (cell: string | undefined, value: string | null) => (cell ?? '') === (value ?? '').trim();
  const checks = {
    headers: table.headers.length === GUIDED_ADMIN_VIEW_HEADINGS.length && GUIDED_ADMIN_VIEW_HEADINGS.every((name, index) => table.headers[index] === name),
    rowCount: table.rows.length === expected.entries.length && byKey.size === table.rows.length,
    sameTargets: expectedKeys.length === byKey.size && expectedKeys.every((key) => byKey.has(key)),
    reviewer: table.rows.every((row) => at(row, 'Reviewer') === expected.userId),
    targetLabels: all((entry, row) => { const lines = targetLines(row); return lines.length === 2 && lines[0] === entry.targetLabel && lines[1] === `${entry.targetKind} ${entry.targetId}`; }),
    choices: all((entry, row) => choice(at(row, 'Draft choice'), entry.draftChoiceId, entry.draftChoiceLabel) && choice(at(row, 'Submitted choice'), entry.submittedChoiceId, entry.submittedChoiceLabel)),
    rationales: all((entry, row) => text(at(row, 'Draft rationale'), entry.draftRationale) && text(at(row, 'Submitted rationale'), entry.submittedRationale)),
    texts: all((entry, row) => text(at(row, 'Draft text'), entry.draftText) && text(at(row, 'Submitted text'), entry.submittedText)),
    status: all((entry, row) => at(row, 'Status') === expectedStatus(entry)),
    revisions: all((entry, row) => at(row, 'Revision') === String(entry.revision) && at(row, 'Submitted revision') === (entry.submittedRevision === null ? '' : String(entry.submittedRevision))),
    timestamps: all((entry, row) => at(row, 'Updated') === entry.updatedAt && at(row, 'Submitted') === (entry.submittedAt ?? '')),
    completion: table.rows.every((row) => (expected.completion === null
      ? at(row, 'Completion revision') === '' && at(row, 'Completed') === ''
      : at(row, 'Completion revision') === String(expected.completion.revision) && at(row, 'Completed') === expected.completion.completedAt)),
  };
  return { ok: Object.values(checks).every(Boolean), checks, counts: { rows: table.rows.length, expectedRows: expected.entries.length, columns: table.headers.length }, bodySha256 };
}
