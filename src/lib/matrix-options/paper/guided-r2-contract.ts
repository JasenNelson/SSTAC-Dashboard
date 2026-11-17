import { z } from 'zod';

import { PREVIEW_FOCUS_AREAS, PREVIEW_PROMPTS } from './r2-review-preview';
import { PHASE2_R2_PAPER_VERSION } from './releases';

export const GUIDED_R2_SCHEMA_VERSION = 'matrix-paper-guided-r2-v1' as const;
export const GUIDED_R2_FOCUS_AREAS = PREVIEW_FOCUS_AREAS;
export const GUIDED_R2_PROMPTS = PREVIEW_PROMPTS;
export const GUIDED_R2_SECTION_ANCHORS = Object.freeze([
  'sec-phase2-about-this-paper', 'sec-phase2-acknowledgements',
  'sec-phase2-1', 'sec-phase2-2', 'sec-phase2-3', 'sec-phase2-4', 'sec-phase2-5',
  'sec-phase2-6', 'sec-phase2-6-1', 'sec-phase2-6-2', 'sec-phase2-6-3', 'sec-phase2-6-4',
  'sec-phase2-7', 'sec-phase2-8', 'sec-phase2-9', 'sec-phase2-references',
] as const);

export type GuidedTargetKind = 'choice-prompt' | 'text-prompt' | 'section-comment' | 'whole-paper-comment';
export interface GuidedTarget { readonly kind: GuidedTargetKind; readonly id: string; readonly options: readonly string[] }

export const GUIDED_R2_TARGETS: readonly GuidedTarget[] = Object.freeze([
  ...GUIDED_R2_PROMPTS.map((prompt) => ({ kind: prompt.kind === 'choice' ? 'choice-prompt' as const : 'text-prompt' as const, id: prompt.id, options: prompt.kind === 'choice' ? prompt.options.map((option) => option.id) : [] })),
  ...GUIDED_R2_SECTION_ANCHORS.map((id) => ({ kind: 'section-comment' as const, id, options: [] })),
  { kind: 'whole-paper-comment', id: 'whole-paper', options: [] },
]);

export function guidedR2Target(kind: string, id: string): GuidedTarget | null {
  return GUIDED_R2_TARGETS.find((target) => target.kind === kind && target.id === id) ?? null;
}

const hex = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.string().max(20000);
export const guidedR2IdentitySchema = z.object({
  documentVersion: z.string(), guidedManifestSha256: hex, reviewManifestSha256: hex,
}).strict();
export const guidedR2SaveSchema = guidedR2IdentitySchema.extend({
  targetKind: z.enum(['choice-prompt', 'text-prompt', 'section-comment', 'whole-paper-comment']),
  expectedRevision: z.number().int().nonnegative(),
  expectedUserId: z.string().uuid(),
  draft: z.object({ choiceId: z.string().max(32).nullable().optional(), rationale: text.nullable().optional(), text: text.nullable().optional() }).strict(),
}).strict();
export const guidedR2CompleteSchema = guidedR2IdentitySchema.extend({
  expectedUserId: z.string().uuid(), expectedCompletionRevision: z.number().int().nonnegative(), draftSetDigest: hex,
}).strict();

export interface GuidedEntry {
  readonly user_id: string;
  readonly document_version: string;
  readonly guided_manifest_sha256: string;
  readonly review_manifest_sha256: string;
  readonly target_kind: GuidedTargetKind;
  readonly target_id: string;
  readonly revision: number;
  readonly draft_choice_id: string | null;
  readonly draft_rationale: string | null;
  readonly draft_text: string | null;
  readonly submitted_choice_id: string | null;
  readonly submitted_rationale: string | null;
  readonly submitted_text: string | null;
  readonly submitted_revision: number | null;
  readonly submitted_at: string | null;
  readonly updated_at: string;
}

export const guidedEntrySchema = z.object({
  user_id: z.string().uuid(), document_version: z.string(), guided_manifest_sha256: hex, review_manifest_sha256: hex,
  target_kind: z.enum(['choice-prompt', 'text-prompt', 'section-comment', 'whole-paper-comment']), target_id: z.string(),
  revision: z.number().int().nonnegative(), draft_choice_id: z.string().nullable(), draft_rationale: text.nullable(), draft_text: text.nullable(),
  submitted_choice_id: z.string().nullable(), submitted_rationale: text.nullable(), submitted_text: text.nullable(),
  submitted_revision: z.number().int().nonnegative().nullable(), submitted_at: z.string().nullable(), updated_at: z.string(),
});
export const guidedCompletionSchema = z.object({
  user_id: z.string().uuid(), document_version: z.string(), guided_manifest_sha256: hex, review_manifest_sha256: hex,
  revision: z.number().int().nonnegative(), submitted_set_digest: hex, submitted_at: z.string(),
});

export function guidedR2EntryValid(entry: GuidedEntry, userId: string, guidedSha: string, reviewSha: string): boolean {
  const target = guidedR2Target(entry.target_kind, entry.target_id);
  return entry.user_id === userId && entry.document_version === PHASE2_R2_PAPER_VERSION && entry.guided_manifest_sha256 === guidedSha && entry.review_manifest_sha256 === reviewSha
    && target !== null && (entry.draft_choice_id === null || target.options.includes(entry.draft_choice_id))
    && (entry.submitted_choice_id === null || target.options.includes(entry.submitted_choice_id));
}
