import { GUIDED_R2_PROMPTS, guidedCompletionSchema, guidedEntrySchema, guidedR2Target, type GuidedEntry } from './guided-r2-contract';

export interface GuidedAdminIdentity { documentVersion: string; guidedManifestSha256: string; reviewManifestSha256: string }
export interface GuidedAdminRow {
  userId: string; targetKind: string; targetId: string; targetLabel: string;
  draftChoiceId: string | null; draftChoiceLabel: string | null; draftRationale: string | null; draftText: string | null;
  submittedChoiceId: string | null; submittedChoiceLabel: string | null; submittedRationale: string | null; submittedText: string | null;
  revision: number | null; submittedRevision: number | null; updatedAt: string | null; submittedAt: string | null;
  status: 'saved-draft' | 'submitted' | 'changed-since-submit' | 'completion-only';
  completionRevision: number | null; completedAt: string | null; completionDigest: string | null;
}

function labelFor(entry: GuidedEntry): string {
  if (entry.target_kind === 'whole-paper-comment') return 'Whole-paper comment';
  if (entry.target_kind === 'section-comment') {
    const slug = entry.target_id.replace(/^sec-phase2-/, '');
    return `Section ${/^\d+(?:-\d+)*$/.test(slug) ? slug.replaceAll('-', '.') : slug.replaceAll('-', ' ')}`;
  }
  return GUIDED_R2_PROMPTS.find((prompt) => prompt.id === entry.target_id)?.label ?? entry.target_id;
}

function choiceLabel(entry: GuidedEntry, choiceId: string | null): string | null {
  if (!choiceId) return null;
  const prompt = GUIDED_R2_PROMPTS.find((item) => item.id === entry.target_id);
  return prompt?.kind === 'choice' ? prompt.options.find((option) => option.id === choiceId)?.label ?? null : null;
}

export function normalizeGuidedAdminRows(rawEntries: unknown, rawCompletions: unknown, identity: GuidedAdminIdentity): GuidedAdminRow[] | null {
  if (!Array.isArray(rawEntries) || !Array.isArray(rawCompletions)) return null;
  const entries = rawEntries.map((value) => guidedEntrySchema.safeParse(value));
  const completions = rawCompletions.map((value) => guidedCompletionSchema.safeParse(value));
  if (entries.some((item) => !item.success) || completions.some((item) => !item.success)) return null;
  const bound = (row: { document_version: string; guided_manifest_sha256: string; review_manifest_sha256: string }) =>
    row.document_version === identity.documentVersion && row.guided_manifest_sha256 === identity.guidedManifestSha256 && row.review_manifest_sha256 === identity.reviewManifestSha256;
  const rows = entries.map((item) => item.data!);
  const completed = completions.map((item) => item.data!);
  if (rows.some((row) => !bound(row) || !guidedR2Target(row.target_kind, row.target_id) ||
    row.draft_choice_id !== null && !guidedR2Target(row.target_kind, row.target_id)!.options.includes(row.draft_choice_id) ||
    row.submitted_choice_id !== null && !guidedR2Target(row.target_kind, row.target_id)!.options.includes(row.submitted_choice_id)) ||
    completed.some((row) => !bound(row))) return null;
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.user_id}:${row.target_kind}:${row.target_id}`;
    if (seen.has(key)) return null;
    seen.add(key);
  }
  const completionByUser = new Map<string, (typeof completed)[number]>();
  for (const row of completed) { if (completionByUser.has(row.user_id)) return null; completionByUser.set(row.user_id, row); }
  const result: GuidedAdminRow[] = rows.map((row) => {
    const completion = completionByUser.get(row.user_id);
    return {
      userId: row.user_id, targetKind: row.target_kind, targetId: row.target_id, targetLabel: labelFor(row),
      draftChoiceId: row.draft_choice_id, draftChoiceLabel: choiceLabel(row, row.draft_choice_id),
      draftRationale: row.draft_rationale, draftText: row.draft_text,
      submittedChoiceId: row.submitted_choice_id, submittedChoiceLabel: choiceLabel(row, row.submitted_choice_id),
      submittedRationale: row.submitted_rationale, submittedText: row.submitted_text,
      revision: row.revision, submittedRevision: row.submitted_revision, updatedAt: row.updated_at, submittedAt: row.submitted_at,
      status: row.submitted_revision === null ? 'saved-draft' : row.revision > row.submitted_revision ? 'changed-since-submit' : 'submitted',
      completionRevision: completion?.revision ?? null, completedAt: completion?.submitted_at ?? null,
      completionDigest: completion?.submitted_set_digest ?? null,
    };
  });
  for (const completion of completed) if (!rows.some((row) => row.user_id === completion.user_id)) result.push({
    userId: completion.user_id, targetKind: '', targetId: '', targetLabel: 'Empty review completed',
    draftChoiceId: null, draftChoiceLabel: null, draftRationale: null, draftText: null,
    submittedChoiceId: null, submittedChoiceLabel: null, submittedRationale: null, submittedText: null,
    revision: null, submittedRevision: null, updatedAt: null, submittedAt: null,
    status: 'completion-only', completionRevision: completion.revision,
    completedAt: completion.submitted_at, completionDigest: completion.submitted_set_digest,
  });
  return result.sort((a, b) => a.userId.localeCompare(b.userId) || a.targetKind.localeCompare(b.targetKind) || a.targetId.localeCompare(b.targetId));
}

export const GUIDED_ADMIN_CSV_COLUMNS = ['userId','documentVersion','guidedManifestSha256','reviewManifestSha256','targetKind','targetId','targetLabel','draftChoiceId','draftChoiceLabel','draftRationale','draftText','submittedChoiceId','submittedChoiceLabel','submittedRationale','submittedText','revision','submittedRevision','updatedAt','submittedAt','status','completionRevision','completedAt','completionDigest'] as const;
function csvCell(value: string | number | null): string {
  const raw = value === null ? '' : String(value);
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function buildGuidedAdminCsv(rows: readonly GuidedAdminRow[], identity: GuidedAdminIdentity): string {
  const lines = [GUIDED_ADMIN_CSV_COLUMNS.map(csvCell).join(',')];
  for (const row of rows) lines.push([
    row.userId, identity.documentVersion, identity.guidedManifestSha256, identity.reviewManifestSha256,
    row.targetKind, row.targetId, row.targetLabel, row.draftChoiceId, row.draftChoiceLabel,
    row.draftRationale, row.draftText, row.submittedChoiceId, row.submittedChoiceLabel,
    row.submittedRationale, row.submittedText, row.revision, row.submittedRevision,
    row.updatedAt, row.submittedAt, row.status, row.completionRevision, row.completedAt, row.completionDigest,
  ].map(csvCell).join(','));
  return `\ufeff${lines.join('\r\n')}\r\n`;
}
