import { NextRequest } from 'next/server';

import { guidedEntrySchema, guidedR2EntryValid, guidedR2SaveSchema, guidedR2Target } from '@/lib/matrix-options/paper/guided-r2-contract';
import { getGuidedR2Manifest } from '@/lib/matrix-options/paper/guided-r2-manifest';
import { guidedAuth, guidedGateResponse, guidedOutcomeStatus, guidedR2Identity, guidedR2UiEnabled, guidedResponse, guidedReviewerGate, guidedRpcErrorResponse, guidedRpcOutcome, guidedSessionUnchanged, guidedWriteOutcomeResponse } from '@/lib/matrix-options/paper/guided-r2-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ targetId: string }> }) {
  if (!guidedR2UiEnabled()) return guidedGateResponse();
  if (Number(request.headers.get('content-length') ?? 0) > 80000) return guidedResponse({ outcome: 'too_large' }, 413);
  let raw: unknown;
  try { const body = await request.text(); if (body.length > 80000) return guidedResponse({ outcome: 'too_large' }, 413); raw = JSON.parse(body); } catch { return guidedResponse({ outcome: 'invalid_payload' }, 422); }
  const parsed = guidedR2SaveSchema.safeParse(raw);
  if (!parsed.success) return guidedResponse({ outcome: 'invalid_payload' }, 422);
  const identity = guidedR2Identity(raw && typeof raw === 'object' ? Object.fromEntries(Object.entries(raw).filter(([key]) => ['documentVersion', 'guidedManifestSha256', 'reviewManifestSha256'].includes(key))) : null);
  if (identity === 'stale') return guidedResponse({ outcome: 'stale_manifest' }, 409);
  if (!identity) return guidedResponse({ outcome: 'invalid_payload' }, 422);
  const { targetId } = await params;
  const target = guidedR2Target(parsed.data.targetKind, targetId);
  if (!target) return guidedResponse({ outcome: 'unknown_target' }, 404);
  const draft = parsed.data.draft;
  if ((draft.choiceId && !target.options.includes(draft.choiceId)) || (target.kind === 'choice-prompt' ? draft.text !== undefined && draft.text !== null : draft.choiceId !== undefined || draft.rationale !== undefined)) return guidedResponse({ outcome: 'invalid_choice' }, 422);
  const { user, supabase, denied, rateLimitHeaders } = await guidedAuth(request);
  if (denied) return denied;
  if (!user) return guidedResponse({ outcome: 'unauthenticated' }, 401);
  if (parsed.data.expectedUserId !== user.id) return guidedResponse({ outcome: 'identity_changed' }, 409, rateLimitHeaders);
  const reviewerDenied = await guidedReviewerGate(supabase, rateLimitHeaders);
  if (reviewerDenied) return reviewerDenied;
  if (!await guidedSessionUnchanged(supabase, user.id)) return guidedResponse({ outcome: 'identity_changed' }, 409, rateLimitHeaders);
  const { data, error } = await supabase.rpc('matrix_guided_r2_save', {
    p_document_version: identity.documentVersion, p_guided_manifest_sha256: identity.guidedManifestSha256,
    p_review_manifest_sha256: identity.reviewManifestSha256, p_target_kind: target.kind, p_target_id: target.id,
    p_choice_id: draft.choiceId ?? null, p_rationale: draft.rationale ?? null, p_text: draft.text ?? null,
    p_expected_revision: parsed.data.expectedRevision, p_expected_user_id: parsed.data.expectedUserId,
  });
  if (error) return guidedRpcErrorResponse(error, rateLimitHeaders);
  const result = guidedRpcOutcome(data);
  if (!result) return guidedResponse({ outcome: 'persistence_unavailable' }, 503, rateLimitHeaders);
  const status = guidedOutcomeStatus(result.outcome);
  if (status === 503) return guidedResponse({ outcome: 'persistence_unavailable' }, 503, rateLimitHeaders);
  if (result.outcome === 'ok') {
    const row = guidedEntrySchema.safeParse(result.row);
    const manifest = getGuidedR2Manifest();
    if (!row.success || !guidedR2EntryValid(row.data, user.id, manifest.guidedManifestSha256, manifest.reviewManifestSha256) || row.data.target_kind !== target.kind || row.data.target_id !== target.id) return guidedResponse({ outcome: 'persistence_unavailable' }, 503, rateLimitHeaders);
    return guidedResponse({ outcome: 'ok', guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256, row: row.data }, 200, rateLimitHeaders);
  }
  return guidedWriteOutcomeResponse(result.outcome, status, rateLimitHeaders);
}
