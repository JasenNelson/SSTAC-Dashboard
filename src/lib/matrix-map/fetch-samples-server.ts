// =====================================================================
// Shared server-side helper -- matrix_map.fetch_samples_with_hidden_summary
// =====================================================================
//
// Lane: Matrix Interactive Map embed refactor (2026-05-20)
//
// Owner asked 2026-05-20: should /matrix-map open as an embedded panel
// within /matrix-options (BN-RRM tab pattern) instead of routing to a
// standalone /matrix-map page that loses the matrix-options tabs?
// Answer: yes. This helper lifts the server-side RPC fetch logic out
// of /matrix-map/page.tsx so /matrix-options/page.tsx can call the
// same code path without duplication. Both routes hand the result to
// MatrixMapLoader.
//
// The RPC is matrix_map.fetch_samples_with_hidden_summary -- a SECDEF
// function owned by matrix_map_owner that returns the visible-rows
// payload + the hidden-summary aggregate (per PR_MAP_3_PLAN section
// 2.2 + PR-MAP-3a deploy 20260520000001; the post-2026-05-20 refactor
// reads the JWT claims via matrix_map.current_user_id() instead of
// auth.uid() per migration 20260520000004).
//
// Caller must pass an already-built supabase client (createServerClient
// from @supabase/ssr with cookies attached). This helper does NOT do
// auth gating -- that's the caller's responsibility because different
// pages have different gate semantics:
//   /matrix-map         -- requires user_roles row (R-5 R-3)
//   /matrix-options     -- requires (dashboard) layout middleware auth
//                          (broader gate; assumed enforced upstream)
//
// Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
// =====================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { EMPTY_MATRIX_MAP_DATA, type MatrixMapData } from '@/app/(dashboard)/matrix-map/types';

export interface FetchSamplesServerSideResult {
  initialMapData: MatrixMapData;
  fetchErrorMessage: string | null;
}

/**
 * Server-side fetch wrapper for matrix_map.fetch_samples_with_hidden_summary.
 *
 * Returns a normalized { initialMapData, fetchErrorMessage } pair safe to
 * pass to MatrixMapLoader. On any error (PostgREST, transport, type-shape
 * mismatch), initialMapData is the empty fallback and fetchErrorMessage
 * is the user-visible notice; the page still renders.
 *
 * Logs structured PostgREST error fields to the server console (dev
 * terminal + production function logs) so the actual failure mode is
 * diagnosable. Logs are non-PII (no JWT, no row data, no secrets).
 *
 * @param supabase  A server-side Supabase client with the user's JWT
 *                  attached via cookies (createServerClient from
 *                  @supabase/ssr). Helper does NOT construct one.
 * @param p_bbox    Optional bbox jsonb. v1 RPC ignores this; v1.x will
 *                  use it. Default: null (province-wide).
 */
export async function fetchMatrixMapSamplesServerSide(
  supabase: SupabaseClient,
  p_bbox: unknown = null,
): Promise<FetchSamplesServerSideResult> {
  let initialMapData: MatrixMapData = EMPTY_MATRIX_MAP_DATA;
  let fetchErrorMessage: string | null = null;

  try {
    // Schema-scoped per codex PR-MAP-3a R1 P1.2: the RPC lives in
    // matrix_map, which must be in Supabase Project Settings -> API ->
    // Exposed schemas. Without that setting, PostgREST returns PGRST106
    // ("schema not in exposed schemas"). Without .schema('matrix_map'),
    // PostgREST routes to the default schema (public) and fails with
    // PGRST202 ("function not found").
    const { data: rpcData, error: rpcErr } = await supabase
      .schema('matrix_map')
      .rpc('fetch_samples_with_hidden_summary', { p_bbox });

    if (rpcErr) {
      // Diagnostic logging: surface the actual PostgREST error to the
      // server console. Structured fields (message + details + hint +
      // code) because supabase-js wraps PostgREST errors in a non-Error
      // object that would otherwise serialize as '[object]'.
      console.error('[matrix-map] RPC fetch_samples_with_hidden_summary failed:', {
        message: rpcErr.message,
        details: (rpcErr as { details?: unknown }).details,
        hint: (rpcErr as { hint?: unknown }).hint,
        code: (rpcErr as { code?: unknown }).code,
      });
      fetchErrorMessage =
        'Samples data temporarily unavailable -- check ' +
        '/admin/matrix-map/health';
    } else if (rpcData) {
      // The RPC returns a JSON object (jsonb on the wire). Cast through
      // unknown so we are explicit about the boundary; the structural
      // validation below pins the contract per PR_MAP_3_PLAN section 2.2.
      const parsed = rpcData as unknown as Partial<MatrixMapData>;
      const visible = Array.isArray(parsed.visible_samples)
        ? parsed.visible_samples
        : [];
      initialMapData = {
        visible_samples: visible,
        hidden_sample_count:
          typeof parsed.hidden_sample_count === 'number'
            ? parsed.hidden_sample_count
            : 0,
        hidden_dra_count:
          typeof parsed.hidden_dra_count === 'number'
            ? parsed.hidden_dra_count
            : 0,
        hidden_dra_ids: Array.isArray(parsed.hidden_dra_ids)
          ? parsed.hidden_dra_ids
          : [],
        data_snapshot_version:
          typeof parsed.data_snapshot_version === 'string'
            ? parsed.data_snapshot_version
            : 'unknown',
        // bbox-lane Stage 1 additive fields. The pre-migration RPC omits these;
        // fall back so a pre-deploy / old-RPC response still validates province-wide.
        total_in_bbox:
          typeof parsed.total_in_bbox === 'number'
            ? parsed.total_in_bbox
            : visible.length,
        returned_sample_count:
          typeof parsed.returned_sample_count === 'number'
            ? parsed.returned_sample_count
            : visible.length,
        truncated: parsed.truncated === true,
        bbox_applied: parsed.bbox_applied === true,
      };
    }
  } catch (thrownErr) {
    // Defensive -- supabase-js may throw on transport errors before
    // returning an { error } shape (e.g. network failure, Node fetch
    // abort). Same user-facing message + log the thrown error.
    console.error('[matrix-map] RPC fetch_samples_with_hidden_summary THREW:', thrownErr);
    fetchErrorMessage =
      'Samples data temporarily unavailable -- check ' +
      '/admin/matrix-map/health';
  }

  return { initialMapData, fetchErrorMessage };
}
