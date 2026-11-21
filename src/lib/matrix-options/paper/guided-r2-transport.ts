import { z } from 'zod';

import {
  guidedCompletionSchema,
  guidedEntrySchema,
  guidedR2CompleteSchema,
  guidedR2IdentitySchema,
  guidedR2SaveSchema,
  guidedR2Target,
  guidedR2EntryValid,
} from './guided-r2-contract';

export const guidedStateReplySchema = guidedR2IdentitySchema.extend({
  mode: z.enum(['read-only', 'writable']),
  userKey: z.string().uuid(),
  entries: z.array(guidedEntrySchema),
  completion: guidedCompletionSchema.nullable(),
}).strict();

export const guidedFeedbackItemSchema = z.object({
  areaId: z.string(), sectionAnchor: z.string(), sourceReleaseIdentity: z.string(),
  sourcePaperSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sourceGuideSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sourceManifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  originalQuestionId: z.string(), relationType: z.string(), responseStatus: z.string(),
  timestamp: z.string().nullable(), displayLabel: z.string(), text: z.string(),
}).strict();

export const guidedFeedbackReplySchema = z.object({
  guidedManifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  reviewManifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  items: z.array(guidedFeedbackItemSchema),
}).strict();

export const guidedSaveReplySchema = z.object({
  outcome: z.literal('ok'),
  guidedManifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  reviewManifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  row: guidedEntrySchema,
}).strict();

export const guidedCompleteReplySchema = z.object({
  outcome: z.enum(['ok', 'noop_already_completed']),
  guidedManifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  reviewManifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  completion: guidedCompletionSchema,
  entries: z.array(guidedEntrySchema),
}).strict();

export const previewTransportRequestSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('state'), identity: guidedR2IdentitySchema }).strict(),
  z.object({ operation: z.literal('feedback'), identity: guidedR2IdentitySchema }).strict(),
  z.object({ operation: z.literal('save'), targetId: z.string(), body: guidedR2SaveSchema }).strict(),
  z.object({ operation: z.literal('complete'), body: guidedR2CompleteSchema }).strict(),
]);

export type GuidedIdentity = z.infer<typeof guidedR2IdentitySchema>;
export type GuidedStateReply = z.infer<typeof guidedStateReplySchema>;
export type GuidedFeedbackItem = z.infer<typeof guidedFeedbackItemSchema>;
export type GuidedSaveBody = z.infer<typeof guidedR2SaveSchema>;
export type GuidedCompleteBody = z.infer<typeof guidedR2CompleteSchema>;
export const guidedFailureOutcomeSchema = z.enum([
  'persistence_unavailable', 'invalid_identity', 'invalid_payload', 'stale_manifest',
  'unauthenticated', 'identity_changed', 'release_read_only', 'reviewer_not_allowed',
  'stale_revision', 'draft_set_changed', 'unknown_target', 'invalid_choice',
  'too_large', 'rate_limited', 'feedback_unavailable', 'not_found', 'origin_denied',
]);
export type GuidedFailureOutcome = z.infer<typeof guidedFailureOutcomeSchema>;
export type GuidedResult<T> = { readonly ok: true; readonly status: number; readonly value: T }
  | { readonly ok: false; readonly status: number; readonly outcome: GuidedFailureOutcome; readonly retryAfterSeconds?: number };

/** Whole seconds from a delta-seconds Retry-After header; HTTP-date and invalid values are ignored. */
export function guidedRetryAfterSeconds(header: string | null): number | undefined {
  if (header === null || !/^\d{1,4}$/.test(header.trim())) return undefined;
  const seconds = Number(header.trim());
  return seconds > 0 ? seconds : undefined;
}

export interface GuidedTransport {
  state(identity: GuidedIdentity): Promise<GuidedResult<GuidedStateReply>>;
  feedback(identity: GuidedIdentity): Promise<GuidedResult<z.infer<typeof guidedFeedbackReplySchema>>>;
  save(targetId: string, body: GuidedSaveBody): Promise<GuidedResult<z.infer<typeof guidedSaveReplySchema>>>;
  complete(body: GuidedCompleteBody): Promise<GuidedResult<z.infer<typeof guidedCompleteReplySchema>>>;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
type Mode = 'production' | 'preview';
const previewPath = '/api/matrix-options/paper/preview-r2';
const productionPath = '/api/matrix-options/paper/guided-r2';

const unavailable = (): GuidedResult<never> => ({ ok: false, status: 503, outcome: 'persistence_unavailable' });
const identityMatches = (actual: GuidedIdentity, expected: GuidedIdentity): boolean =>
  actual.documentVersion === expected.documentVersion
  && actual.guidedManifestSha256 === expected.guidedManifestSha256
  && actual.reviewManifestSha256 === expected.reviewManifestSha256;
const entryMatches = (entry: z.infer<typeof guidedEntrySchema>, user: string, identity: GuidedIdentity): boolean =>
  guidedR2EntryValid(entry, user, identity.guidedManifestSha256, identity.reviewManifestSha256);
const completionMatches = (completion: z.infer<typeof guidedCompletionSchema>, user: string, identity: GuidedIdentity): boolean =>
  completion.user_id === user && completion.document_version === identity.documentVersion
  && completion.guided_manifest_sha256 === identity.guidedManifestSha256
  && completion.review_manifest_sha256 === identity.reviewManifestSha256;

/** Longest wait derived from a reset time; anything later or unparseable falls back to the queue default. */
export const GUIDED_MAX_RESET_WAIT_SECONDS = 3600;

/**
 * Whole seconds until an epoch-millisecond reset time (the application rate-limit wrapper's
 * `resetTime`). Past, non-finite, non-numeric or implausibly distant values are ignored.
 */
export function guidedResetTimeSeconds(resetTime: unknown, now: number = Date.now()): number | undefined {
  if (typeof resetTime !== 'number' || !Number.isFinite(resetTime)) return undefined;
  const seconds = Math.ceil((resetTime - now) / 1000);
  return seconds > 0 && seconds <= GUIDED_MAX_RESET_WAIT_SECONDS ? seconds : undefined;
}

/**
 * Any HTTP 429 is a rate refusal, whichever layer produced it: the route wrapper replies
 * `{error, resetTime}` with Retry-After, the RPC path replies `{outcome: 'rate_limited'}` with
 * Retry-After. It is normalized BEFORE envelope validation so it never becomes a 503. Retry-After
 * wins; the wrapper's resetTime is the fallback; neither present leaves the queue default.
 */
async function rateLimited(response: Response): Promise<GuidedResult<never>> {
  let retryAfterSeconds = guidedRetryAfterSeconds(response.headers.get('Retry-After'));
  if (retryAfterSeconds === undefined) {
    try {
      const raw: unknown = await response.json();
      if (raw && typeof raw === 'object') retryAfterSeconds = guidedResetTimeSeconds((raw as Record<string, unknown>).resetTime);
    } catch { /* An unreadable 429 body is still a rate refusal. */ }
  }
  return retryAfterSeconds === undefined ? { ok: false, status: 429, outcome: 'rate_limited' }
    : { ok: false, status: 429, outcome: 'rate_limited', retryAfterSeconds };
}

async function result<T>(response: Response, schema: z.ZodType<T>, matches: (value: T) => boolean): Promise<GuidedResult<T>> {
  if (response.status === 429) return rateLimited(response);
  let raw: unknown;
  try { raw = await response.json(); } catch { return unavailable(); }
  if (response.ok) {
    const parsed = schema.safeParse(raw);
    return parsed.success && matches(parsed.data) ? { ok: true, status: response.status, value: parsed.data } : unavailable();
  }
  const failure = z.object({ outcome: guidedFailureOutcomeSchema }).passthrough().safeParse(raw);
  if (!failure.success) return unavailable();
  return { ok: false, status: response.status, outcome: failure.data.outcome };
}

function identityValid(value: unknown): value is GuidedIdentity {
  return guidedR2IdentitySchema.safeParse(value).success;
}

/** Both adapters use the same request checks and response schemas. Invalid mode never fetches. */
export function createGuidedTransport(mode: Mode, fetcher: Fetcher = fetch): GuidedTransport {
  if (mode !== 'production' && mode !== 'preview') throw new Error('Invalid guided transport selection');
  const preview = mode === 'preview';
  let previewReady = false;
  let previewBootstrap: Promise<GuidedResult<GuidedStateReply>> | null = null;
  const postPreview = (body: z.infer<typeof previewTransportRequestSchema>) => fetcher(previewPath, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store',
  });
  return {
    async state(identity) {
      if (!identityValid(identity)) return { ok: false, status: 422, outcome: 'invalid_identity' };
      if (preview && !previewReady) {
        if (!previewBootstrap) previewBootstrap = postPreview({ operation: 'state', identity })
          .then((response) => result(response, guidedStateReplySchema, (value) => identityMatches(value, identity)
            && value.entries.every((entry) => entryMatches(entry, value.userKey, identity))
            && (value.completion === null || completionMatches(value.completion, value.userKey, identity))))
          .then((reply) => { previewReady = reply.ok; if (!reply.ok) previewBootstrap = null; return reply; });
        return previewBootstrap;
      }
      const response = preview ? await postPreview({ operation: 'state', identity })
        : await fetcher(`${productionPath}/state?${new URLSearchParams(identity)}`, { cache: 'no-store' });
      return result(response, guidedStateReplySchema, (value) => identityMatches(value, identity)
        && value.entries.every((entry) => entryMatches(entry, value.userKey, identity))
        && (value.completion === null || completionMatches(value.completion, value.userKey, identity)));
    },
    async feedback(identity) {
      if (!identityValid(identity)) return { ok: false, status: 422, outcome: 'invalid_identity' };
      if (preview && previewBootstrap) await previewBootstrap;
      const response = preview ? await postPreview({ operation: 'feedback', identity })
        : await fetcher(`${productionPath}/feedback?${new URLSearchParams(identity)}`, { cache: 'no-store' });
      return result(response, guidedFeedbackReplySchema, (value) => value.guidedManifestSha256 === identity.guidedManifestSha256
        && value.reviewManifestSha256 === identity.reviewManifestSha256);
    },
    async save(targetId, body) {
      const parsed = guidedR2SaveSchema.safeParse(body);
      if (!parsed.success) return { ok: false, status: 422, outcome: 'invalid_payload' };
      if (!guidedR2Target(body.targetKind, targetId)) return { ok: false, status: 404, outcome: 'unknown_target' };
      const response = preview ? await postPreview({ operation: 'save', targetId, body })
        : await fetcher(`${productionPath}/targets/${encodeURIComponent(targetId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return result(response, guidedSaveReplySchema, (value) => value.guidedManifestSha256 === body.guidedManifestSha256
        && value.reviewManifestSha256 === body.reviewManifestSha256
        && entryMatches(value.row, body.expectedUserId, body)
        && value.row.target_kind === body.targetKind && value.row.target_id === targetId
        && value.row.revision === body.expectedRevision + 1);
    },
    async complete(body) {
      if (!guidedR2CompleteSchema.safeParse(body).success) return { ok: false, status: 422, outcome: 'invalid_payload' };
      const response = preview ? await postPreview({ operation: 'complete', body })
        : await fetcher(`${productionPath}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return result(response, guidedCompleteReplySchema, (value) => value.guidedManifestSha256 === body.guidedManifestSha256
        && value.reviewManifestSha256 === body.reviewManifestSha256
        && completionMatches(value.completion, body.expectedUserId, body)
        && value.completion.submitted_set_digest === body.draftSetDigest
        && (value.outcome === 'noop_already_completed' || value.completion.revision === body.expectedCompletionRevision + 1)
        && value.entries.every((entry) => entryMatches(entry, body.expectedUserId, body)));
    },
  };
}
