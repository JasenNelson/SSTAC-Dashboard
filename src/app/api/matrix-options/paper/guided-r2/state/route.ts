import { NextRequest } from 'next/server';

import { guidedEntrySchema, guidedCompletionSchema, guidedR2EntryValid } from '@/lib/matrix-options/paper/guided-r2-contract';
import { getGuidedR2Manifest } from '@/lib/matrix-options/paper/guided-r2-manifest';
import { guidedActivationStatus, guidedAuth, guidedGateResponse, guidedQueryIdentity, guidedR2UiEnabled, guidedR2WritesEnabled, guidedResponse, guidedReviewerGate, guidedSessionUnchanged } from '@/lib/matrix-options/paper/guided-r2-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!guidedR2UiEnabled()) return guidedGateResponse();
  const identity = guidedQueryIdentity(request);
  if (identity === null) return guidedResponse({ outcome: 'invalid_identity' }, 400);
  if (identity === 'stale') return guidedResponse({ outcome: 'stale_manifest' }, 409);
  const { user, supabase, denied, rateLimitHeaders } = await guidedAuth(request);
  if (denied) return denied;
  if (!user) return guidedResponse({ outcome: 'unauthenticated' }, 401);
  const reviewerDenied = await guidedReviewerGate(supabase, rateLimitHeaders);
  if (reviewerDenied) return reviewerDenied;
  const manifest = getGuidedR2Manifest();
  const [activation, entriesResult, completionResult] = await Promise.all([
    guidedActivationStatus(supabase, manifest),
    supabase.from('matrix_guided_r2_entries').select('user_id,document_version,guided_manifest_sha256,review_manifest_sha256,target_kind,target_id,revision,draft_choice_id,draft_rationale,draft_text,submitted_choice_id,submitted_rationale,submitted_text,submitted_revision,submitted_at,updated_at').eq('user_id', user.id).eq('document_version', manifest.documentVersion).eq('guided_manifest_sha256', manifest.guidedManifestSha256).order('target_kind').order('target_id'),
    supabase.from('matrix_guided_r2_completion').select('user_id,document_version,guided_manifest_sha256,review_manifest_sha256,revision,submitted_set_digest,submitted_at').eq('user_id', user.id).eq('document_version', manifest.documentVersion).eq('guided_manifest_sha256', manifest.guidedManifestSha256).maybeSingle(),
  ]);
  if (activation === null || entriesResult.error || completionResult.error || !Array.isArray(entriesResult.data)) return guidedResponse({ outcome: 'persistence_unavailable' }, 503, rateLimitHeaders);
  const entries = entriesResult.data.map((value: unknown) => guidedEntrySchema.safeParse(value));
  const completion = completionResult.data === null ? null : guidedCompletionSchema.safeParse(completionResult.data);
  if (entries.some((entry) => !entry.success || !guidedR2EntryValid(entry.data, user.id, manifest.guidedManifestSha256, manifest.reviewManifestSha256)) || (completion && (!completion.success || completion.data.user_id !== user.id || completion.data.document_version !== manifest.documentVersion || completion.data.guided_manifest_sha256 !== manifest.guidedManifestSha256 || completion.data.review_manifest_sha256 !== manifest.reviewManifestSha256))) return guidedResponse({ outcome: 'persistence_unavailable' }, 503, rateLimitHeaders);
  if (!await guidedSessionUnchanged(supabase, user.id)) return guidedResponse({ outcome: 'identity_changed' }, 409, rateLimitHeaders);
  return guidedResponse({ mode: guidedR2WritesEnabled() && activation ? 'writable' : 'read-only', userKey: user.id, documentVersion: manifest.documentVersion, guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256, entries: entries.map((entry) => entry.data), completion: completion?.success ? completion.data : null }, 200, rateLimitHeaders);
}
