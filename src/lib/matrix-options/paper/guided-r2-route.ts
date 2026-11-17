import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getAuthAndRateLimit } from '@/app/api/_helpers/rate-limit-wrapper';
import { resolveMatrixOptionsPaperReviewNavigationGate } from '@/lib/matrix-options/navigation';
import { guidedR2IdentitySchema } from './guided-r2-contract';
import { getGuidedR2Manifest } from './guided-r2-manifest';

export const guidedNoStore = { 'Cache-Control': 'no-store' };

export function guidedR2UiEnabled(): boolean {
  return process.env.MATRIX_R2_GUIDED_REVIEW_UI === 'true'
    && resolveMatrixOptionsPaperReviewNavigationGate(process.env.MATRIX_OPTIONS_PAPER_WORKSPACE, process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION) === 'REVIEW_NAVIGATION';
}

export function guidedR2WritesEnabled(): boolean { return process.env.MATRIX_R2_GUIDED_REVIEW_WRITES === 'true'; }

export function guidedResponse(body: unknown, status = 200, rateHeaders?: HeadersInit) {
  return NextResponse.json(body, { status, headers: { ...guidedNoStore, ...rateHeaders } });
}

export function guidedGateResponse() { return guidedResponse({ error: 'Not found' }, 404); }

export function guidedR2Identity(raw: unknown): { documentVersion: string; guidedManifestSha256: string; reviewManifestSha256: string } | null | 'stale' {
  const parsed = guidedR2IdentitySchema.safeParse(raw);
  if (!parsed.success) return null;
  const manifest = getGuidedR2Manifest();
  if (parsed.data.documentVersion !== manifest.documentVersion || parsed.data.guidedManifestSha256 !== manifest.guidedManifestSha256 || parsed.data.reviewManifestSha256 !== manifest.reviewManifestSha256) return 'stale';
  return parsed.data;
}

export function guidedQueryIdentity(request: NextRequest) {
  const query = (request.nextUrl ?? new URL(request.url)).searchParams;
  if (Array.from(query.keys()).some((key) => !['documentVersion', 'guidedManifestSha256', 'reviewManifestSha256'].includes(key))) return null;
  const values = ['documentVersion', 'guidedManifestSha256', 'reviewManifestSha256'].map((key) => query.getAll(key));
  if (values.some((value) => value.length !== 1)) return null;
  return guidedR2Identity(Object.fromEntries(['documentVersion', 'guidedManifestSha256', 'reviewManifestSha256'].map((key, index) => [key, values[index][0]])));
}

export async function guidedAuth(request: NextRequest) {
  const auth = await getAuthAndRateLimit(request, 'default');
  return { ...auth, denied: auth.rateLimitResponse ?? (!auth.user || auth.user.is_anonymous !== false ? guidedResponse({ outcome: 'unauthenticated' }, 401) : null) };
}

export async function guidedReviewerGate(supabase: SupabaseClient, rateHeaders?: HeadersInit) {
  const manifest = getGuidedR2Manifest();
  try {
    const { data, error } = await supabase.rpc('matrix_guided_r2_reviewer_allowed', {
      p_document_version: manifest.documentVersion,
      p_guided_manifest_sha256: manifest.guidedManifestSha256,
      p_review_manifest_sha256: manifest.reviewManifestSha256,
    });
    if (error) return guidedResponse({ outcome: 'persistence_unavailable' }, 503, rateHeaders);
    const allowed = Array.isArray(data) ? data[0] : data;
    if (allowed === true) return null;
    if (allowed === false) return guidedResponse({ outcome: 'reviewer_not_allowed' }, 403, rateHeaders);
  } catch { /* A missing or failed admission RPC must not expose guided data. */ }
  return guidedResponse({ outcome: 'persistence_unavailable' }, 503, rateHeaders);
}

export async function guidedSessionUnchanged(supabase: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && user?.is_anonymous === false && user.id === userId;
  } catch { return false; }
}

export async function guidedActivationStatus(supabase: SupabaseClient, manifest = getGuidedR2Manifest()): Promise<boolean | null> {
  const { data, error } = await supabase.rpc('matrix_guided_r2_activation_status', {
    p_document_version: manifest.documentVersion,
    p_guided_manifest_sha256: manifest.guidedManifestSha256,
    p_review_manifest_sha256: manifest.reviewManifestSha256,
  });
  if (error) return null;
  const value = Array.isArray(data) ? data[0] : data;
  return typeof value === 'boolean' ? value : null;
}

export function guidedRpcOutcome(data: unknown): Record<string, unknown> | null {
  const value = Array.isArray(data) ? data[0] : data;
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function guidedRpcErrorResponse(error: { readonly code?: string; readonly message?: string }, rateHeaders?: HeadersInit) {
  const denied = error.code === '42501' || /permission denied for function|insufficient privilege/i.test(error.message ?? '');
  return guidedResponse({ outcome: denied ? 'release_read_only' : 'persistence_unavailable' }, denied ? 403 : 503, rateHeaders);
}

export function guidedOutcomeStatus(outcome: unknown): number {
  switch (outcome) {
    case 'ok': case 'noop_already_completed': return 200;
    case 'release_read_only': case 'reviewer_not_allowed': return 403;
    case 'stale_manifest': case 'stale_revision': case 'identity_changed': case 'draft_set_changed': return 409;
    case 'unknown_target': return 404;
    case 'too_large': return 413;
    case 'invalid_choice': case 'invalid_payload': return 422;
    case 'rate_limited': return 429;
    case 'unauthenticated': return 401;
    default: return 503;
  }
}
