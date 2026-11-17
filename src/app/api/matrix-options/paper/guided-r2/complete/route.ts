import { NextRequest } from 'next/server';

import { guidedCompletionSchema, guidedEntrySchema, guidedR2CompleteSchema, guidedR2EntryValid } from '@/lib/matrix-options/paper/guided-r2-contract';
import { getGuidedR2Manifest } from '@/lib/matrix-options/paper/guided-r2-manifest';
import { guidedAuth, guidedGateResponse, guidedOutcomeStatus, guidedR2Identity, guidedR2UiEnabled, guidedR2WritesEnabled, guidedResponse, guidedReviewerGate, guidedRpcErrorResponse, guidedRpcOutcome, guidedSessionUnchanged } from '@/lib/matrix-options/paper/guided-r2-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!guidedR2UiEnabled()) return guidedGateResponse();
  if (!guidedR2WritesEnabled()) return guidedResponse({ outcome: 'release_read_only' }, 403);
  if (Number(request.headers.get('content-length') ?? 0) > 4000) return guidedResponse({ outcome: 'too_large' }, 413);
  let raw: unknown;
  try { const body = await request.text(); if (body.length > 4000) return guidedResponse({ outcome: 'too_large' }, 413); raw = JSON.parse(body); } catch { return guidedResponse({ outcome: 'invalid_payload' }, 422); }
  const parsed = guidedR2CompleteSchema.safeParse(raw);
  if (!parsed.success) return guidedResponse({ outcome: 'invalid_payload' }, 422);
  const identity = guidedR2Identity(Object.fromEntries(Object.entries(parsed.data).filter(([key]) => ['documentVersion', 'guidedManifestSha256', 'reviewManifestSha256'].includes(key))));
  if (identity === 'stale') return guidedResponse({ outcome: 'stale_manifest' }, 409);
  if (!identity) return guidedResponse({ outcome: 'invalid_payload' }, 422);
  const { user, supabase, denied, rateLimitHeaders } = await guidedAuth(request);
  if (denied) return denied;
  if (!user) return guidedResponse({ outcome: 'unauthenticated' }, 401);
  if (parsed.data.expectedUserId !== user.id) return guidedResponse({ outcome: 'identity_changed' }, 409, rateLimitHeaders);
  const reviewerDenied = await guidedReviewerGate(supabase, rateLimitHeaders);
  if (reviewerDenied) return reviewerDenied;
  if (!await guidedSessionUnchanged(supabase, user.id)) return guidedResponse({ outcome: 'identity_changed' }, 409, rateLimitHeaders);
  const { data, error } = await supabase.rpc('matrix_guided_r2_complete', {
    p_document_version: identity.documentVersion, p_guided_manifest_sha256: identity.guidedManifestSha256,
    p_review_manifest_sha256: identity.reviewManifestSha256, p_expected_user_id: parsed.data.expectedUserId,
    p_expected_completion_revision: parsed.data.expectedCompletionRevision, p_draft_set_digest: parsed.data.draftSetDigest,
  });
  if (error) return guidedRpcErrorResponse(error, rateLimitHeaders);
  const result = guidedRpcOutcome(data);
  if (!result) return guidedResponse({ outcome: 'persistence_unavailable' }, 503, rateLimitHeaders);
  const status = guidedOutcomeStatus(result.outcome);
  if (status === 503) return guidedResponse({ outcome: 'persistence_unavailable' }, 503, rateLimitHeaders);
  if (status !== 200) return guidedResponse({ outcome: result.outcome }, status, rateLimitHeaders);
  const manifest = getGuidedR2Manifest();
  const completion = guidedCompletionSchema.safeParse(result.completion);
  const entries = Array.isArray(result.entries) ? result.entries.map((value) => guidedEntrySchema.safeParse(value)) : null;
  if (!completion.success || completion.data.user_id !== user.id || completion.data.document_version !== manifest.documentVersion || completion.data.guided_manifest_sha256 !== manifest.guidedManifestSha256 || completion.data.review_manifest_sha256 !== manifest.reviewManifestSha256 || !entries || entries.some((entry) => !entry.success || !guidedR2EntryValid(entry.data, user.id, manifest.guidedManifestSha256, manifest.reviewManifestSha256))) return guidedResponse({ outcome: 'persistence_unavailable' }, 503, rateLimitHeaders);
  return guidedResponse({ outcome: result.outcome, guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256, completion: completion.data, entries: entries.map((entry) => entry.data) }, 200, rateLimitHeaders);
}
