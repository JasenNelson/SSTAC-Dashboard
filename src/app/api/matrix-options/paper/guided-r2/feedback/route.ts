import { NextRequest } from 'next/server';

import { guidedR2FeedbackSources, normalizeGuidedR2Feedback } from '@/lib/matrix-options/paper/guided-r2-feedback';
import { getGuidedR2Manifest } from '@/lib/matrix-options/paper/guided-r2-manifest';
import { guidedAuth, guidedGateResponse, guidedQueryIdentity, guidedR2UiEnabled, guidedResponse, guidedReviewerGate, guidedSessionUnchanged } from '@/lib/matrix-options/paper/guided-r2-route';

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
  const sources = guidedR2FeedbackSources();
  const results = await Promise.all(sources.map((source) => supabase.from('matrix_paper_review_responses')
    .select('user_id,id,document_version,manifest_sha256,cohort_id,question_id,draft_text,submitted_text,revision,submitted_revision,submitted_at,updated_at')
    .eq('user_id', user.id).eq('document_version', source.sourceRelease.documentVersion).eq('manifest_sha256', source.sourceManifest.sha256)
    .in('question_id', [...source.byId.keys()]).order('question_id')));
  if (results.some((result) => result.error || !Array.isArray(result.data))) return guidedResponse({ outcome: 'feedback_unavailable', items: [] }, 503, rateLimitHeaders);
  const items = normalizeGuidedR2Feedback(results.flatMap((result) => result.data ?? []), user.id);
  if (!items) return guidedResponse({ outcome: 'feedback_unavailable', items: [] }, 503, rateLimitHeaders);
  if (!await guidedSessionUnchanged(supabase, user.id)) return guidedResponse({ outcome: 'identity_changed', items: [] }, 409, rateLimitHeaders);
  const manifest = getGuidedR2Manifest();
  return guidedResponse({ guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256, items }, 200, rateLimitHeaders);
}
