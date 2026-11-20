import 'server-only';

import { randomUUID } from 'node:crypto';

import { guidedR2DraftSetDigest } from './guided-r2-digest';
import { guidedR2Target, type GuidedEntry } from './guided-r2-contract';
import { getGuidedR2Manifest } from './guided-r2-manifest';
import { getReviewManifest } from './review-manifest';
import { getPaperRelease, PHASE2_PAPER_VERSION } from './releases';
import {
  guidedCompleteReplySchema,
  guidedFeedbackReplySchema,
  guidedSaveReplySchema,
  guidedStateReplySchema,
  previewTransportRequestSchema,
} from './guided-r2-transport';

type Completion = NonNullable<ReturnType<typeof guidedStateReplySchema.parse>['completion']>;
type PreviewSession = { readonly userKey: string; readonly entries: Map<string, GuidedEntry>; completion: Completion | null; lastAccess: number; sequence: number };
type PreviewReply = { readonly status: number; readonly body: unknown; readonly sessionToken?: string };
type PreviewOptions = { readonly now?: () => number; readonly ttlMs?: number; readonly maxSessions?: number };

const failure = (outcome: string, status: number): PreviewReply => ({ status, body: { outcome } });
const entryKey = (kind: string, id: string) => `${kind}:${id}`;
const savedText = (value: string | null | undefined) => value === undefined || value === null || !/[^ ]/.test(value) ? null : value;

function boundIdentity(value: { documentVersion: string; guidedManifestSha256: string; reviewManifestSha256: string }): boolean {
  const manifest = getGuidedR2Manifest();
  return value.documentVersion === manifest.documentVersion
    && value.guidedManifestSha256 === manifest.guidedManifestSha256
    && value.reviewManifestSha256 === manifest.reviewManifestSha256;
}

/** Process-only fixture state. The route keeps the opaque token in an HttpOnly cookie. */
export function createPreviewR2Service(writable = true, options: PreviewOptions = {}) {
  const clockNow = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? 60 * 60 * 1000;
  const maxSessions = options.maxSessions ?? 64;
  if (!Number.isInteger(ttlMs) || ttlMs < 1 || !Number.isInteger(maxSessions) || maxSessions < 1) throw new Error('Invalid preview session limits');
  const sessions = new Map<string, PreviewSession>();
  let sequence = 0;
  function prune(time: number) {
    for (const [key, session] of sessions) if (time - session.lastAccess >= ttlMs) sessions.delete(key);
  }
  function makeRoom() {
    if (sessions.size < maxSessions) return;
    const oldest = [...sessions].sort((a, b) => a[1].lastAccess - b[1].lastAccess || a[1].sequence - b[1].sequence)[0];
    if (oldest) sessions.delete(oldest[0]);
  }
  return {
    sessionCount: () => sessions.size,
    adminSnapshot: () => {
      prune(clockNow());
      return {
        entries: [...sessions.values()].flatMap((session) => [...session.entries.values()]),
        completions: [...sessions.values()].flatMap((session) => session.completion ? [session.completion] : []),
      };
    },
    async handle(raw: unknown, token: string | undefined): Promise<PreviewReply> {
      const parsed = previewTransportRequestSchema.safeParse(raw);
      if (!parsed.success) return failure('invalid_payload', 422);
      const request = parsed.data;
      const identity = request.operation === 'state' || request.operation === 'feedback' ? request.identity : request.body;
      if (!boundIdentity(identity)) return failure('stale_manifest', 409);

      const time = clockNow();
      prune(time);
      let session = token ? sessions.get(token) : undefined;
      let newToken: string | undefined;
      if (!session && request.operation === 'state') {
        makeRoom();
        newToken = randomUUID();
        session = { userKey: randomUUID(), entries: new Map(), completion: null, lastAccess: time, sequence: sequence++ };
        sessions.set(newToken, session);
      }
      if (!session) return failure('unauthenticated', 401);
      session.lastAccess = time;
      const manifest = getGuidedR2Manifest();

      if (request.operation === 'state') {
        const body = guidedStateReplySchema.parse({
          mode: writable ? 'writable' : 'read-only', userKey: session.userKey,
          documentVersion: manifest.documentVersion, guidedManifestSha256: manifest.guidedManifestSha256,
          reviewManifestSha256: manifest.reviewManifestSha256, entries: [...session.entries.values()],
          completion: session.completion,
        });
        return { status: 200, body, sessionToken: newToken };
      }

      if (request.operation === 'feedback') {
        const source = getPaperRelease(PHASE2_PAPER_VERSION);
        const review = getReviewManifest(PHASE2_PAPER_VERSION);
        if (!source) return failure('persistence_unavailable', 503);
        const body = guidedFeedbackReplySchema.parse({
          guidedManifestSha256: manifest.guidedManifestSha256,
          reviewManifestSha256: manifest.reviewManifestSha256,
          items: [{
            areaId: 'uses-waterbodies', sectionAnchor: 'sec-phase2-5',
            sourceReleaseIdentity: source.documentVersion, sourcePaperSha256: source.sha256,
            sourceGuideSha256: review.reviewerGuideSha256, sourceManifestSha256: review.sha256,
            originalQuestionId: 'preview-example', relationType: 'exact-continuation',
            responseStatus: 'preview-example', timestamp: null,
            displayLabel: 'Preview example of earlier feedback', text: 'Synthetic preview feedback. No provider data was read.',
          }],
        });
        return { status: 200, body };
      }

      if (!writable) return failure('release_read_only', 403);
      if (request.body.expectedUserId !== session.userKey) return failure('identity_changed', 409);

      if (request.operation === 'save') {
        const target = guidedR2Target(request.body.targetKind, request.targetId);
        if (!target) return failure('unknown_target', 404);
        const draft = request.body.draft;
        if ((draft.choiceId && !target.options.includes(draft.choiceId))
          || (target.kind === 'choice-prompt' ? draft.text !== undefined && draft.text !== null : draft.choiceId !== undefined || draft.rationale !== undefined)) {
          return failure('invalid_choice', 422);
        }
        const key = entryKey(target.kind, target.id);
        const old = session.entries.get(key);
        if (request.body.expectedRevision !== (old?.revision ?? 0)) return failure('stale_revision', 409);
        const now = new Date().toISOString();
        const row: GuidedEntry = {
          user_id: session.userKey, document_version: manifest.documentVersion,
          guided_manifest_sha256: manifest.guidedManifestSha256, review_manifest_sha256: manifest.reviewManifestSha256,
          target_kind: target.kind, target_id: target.id, revision: (old?.revision ?? 0) + 1,
          draft_choice_id: draft.choiceId ?? null, draft_rationale: savedText(draft.rationale),
          draft_text: savedText(draft.text), submitted_choice_id: old?.submitted_choice_id ?? null,
          submitted_rationale: old?.submitted_rationale ?? null, submitted_text: old?.submitted_text ?? null,
          submitted_revision: old?.submitted_revision ?? null, submitted_at: old?.submitted_at ?? null,
          updated_at: now,
        };
        const body = guidedSaveReplySchema.parse({ outcome: 'ok', guidedManifestSha256: manifest.guidedManifestSha256,
          reviewManifestSha256: manifest.reviewManifestSha256, row });
        session.entries.set(key, row);
        return { status: 200, body };
      }

      const entries = [...session.entries.values()];
      if (request.body.draftSetDigest !== await guidedR2DraftSetDigest(entries)) return failure('draft_set_changed', 409);
      if (session.completion?.submitted_set_digest === request.body.draftSetDigest) {
        const body = guidedCompleteReplySchema.parse({ outcome: 'noop_already_completed',
          guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256,
          completion: session.completion, entries });
        return { status: 200, body };
      }
      if (request.body.expectedCompletionRevision !== (session.completion?.revision ?? 0)) return failure('stale_revision', 409);
      const now = new Date().toISOString();
      for (const entry of entries) {
        const hasDraft = entry.draft_choice_id !== null || entry.draft_rationale !== null || entry.draft_text !== null;
        session.entries.set(entryKey(entry.target_kind, entry.target_id), {
          ...entry, submitted_choice_id: hasDraft ? entry.draft_choice_id : null,
          submitted_rationale: hasDraft ? entry.draft_rationale : null, submitted_text: hasDraft ? entry.draft_text : null,
          submitted_revision: hasDraft ? entry.revision : null, submitted_at: hasDraft ? now : null,
        });
      }
      session.completion = {
        user_id: session.userKey, document_version: manifest.documentVersion,
        guided_manifest_sha256: manifest.guidedManifestSha256,
        review_manifest_sha256: manifest.reviewManifestSha256,
        revision: (session.completion?.revision ?? 0) + 1,
        submitted_set_digest: request.body.draftSetDigest, submitted_at: now,
      };
      const body = guidedCompleteReplySchema.parse({ outcome: 'ok', guidedManifestSha256: manifest.guidedManifestSha256,
        reviewManifestSha256: manifest.reviewManifestSha256, completion: session.completion,
        entries: [...session.entries.values()] });
      return { status: 200, body };
    },
  };
}
