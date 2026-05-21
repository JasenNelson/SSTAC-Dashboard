// =====================================================================
// Matrix Interactive Map -- page shell (PR-MAP-2)
// =====================================================================
//
// Route:  /matrix-map
// Lane:   Matrix Interactive Map
// Branch: feat/matrix-map-pr-map-2-map-ui
// Plan:   docs/design/matrix-map/PLAN_V3_4_2.md section 7 (PR-MAP-2 row)
//         + R-7 (overlay set reused from BN-RRM) + R-11 (ZERO Jermilova
//         GeoJSON artifacts carry over).
//
// SERVER COMPONENT (no 'use client'). Responsibilities:
//   1. Auth gate -- redirect to /login when there is no Supabase session.
//   2. Reviewer-allowlist gate -- redirect to /dashboard when the user
//      has no user_roles row at all. Per plan v3.4.2 + grants v2.3 the
//      dashboard-level allowlist for this surface is "has any user_roles
//      row" (R-5 dev allowlist convention). Reviewers need access -- this
//      is NOT admin-only.
//   3. Render the MatrixMap client component via next/dynamic with
//      `ssr: false` so the react-leaflet tree never executes server-side
//      (leaflet touches `window` at module load).
//
// PR-MAP-2 scope per plan v3.4.2:
//   - Empty map (no sample markers).
//   - 4 base tile layer choices (Streets / Satellite / Topographic /
//     Terrain) -- one active at a time, picked in a small top-bar UI.
//   - 14 BC public WMS overlays mirroring the BN-RRM OVERLAY_LAYERS
//     catalog -- one checkbox per overlay in the left-rail panel,
//     default visibility = false for all overlays in v1.
//
// NOT in PR-MAP-2 (deferred to PR-MAP-3..7):
//   - Sample point rendering (PR-MAP-3).
//   - Identify tool, identify-area, selection tools (PR-MAP-3..4).
//   - Selection stats, Measurement Workbench, Calculator bridge.
//
// Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
// Literal '->' for arrow text. Per L0 CLAUDE.md section 1.1.
// =====================================================================

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import MatrixMapLoader from './MatrixMapLoader';
import { EMPTY_MATRIX_MAP_DATA, type MatrixMapData } from './types';

export const metadata = {
  title: 'Matrix Interactive Map | SSTAC Dashboard',
  description:
    'Province-wide BC sediment-data interactive map (PR-MAP-2: empty map + base tiles + 14 BC WMS overlays).',
};

// Route-segment config: this page reads cookies + Supabase per-request,
// so it cannot be statically generated.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function buildSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    },
  );
}

export default async function MatrixMapPage() {
  const supabase = await buildSupabase();

  // 1. Auth gate.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 2. Reviewer allowlist -- ANY user_roles row is sufficient (R-5).
  // Peer admin surfaces (e.g. /admin/matrix-map/health) restrict to
  // {'admin', 'matrix_admin'} -- this is the reviewer-facing surface
  // so the gate is broader: any role at all unlocks access.
  const { data: roleRows, error: roleErr } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .limit(1);
  if (roleErr) {
    // Fail closed on role lookup error so the page is never leaked.
    redirect('/dashboard');
  }
  if (!roleRows || roleRows.length === 0) redirect('/dashboard');

  // 3. Server-side RPC fetch (PR-MAP-3a). Per
  //    docs/design/matrix-map/PR_MAP_3_PLAN.md section 2.1 Q-1 (owner
  //    default accepted 2026-05-20): server-side fetch yields a single
  //    coherent snapshot with NO RLS-race between visible-row + hidden-
  //    summary computation.
  //
  //    The RPC body runs as matrix_map_owner (BYPASSRLS) and enforces
  //    caller auth + email allowlist internally; the client never sees
  //    hidden DRA titles or rows.
  //
  //    Try/catch around the call so the page still renders if the RPC
  //    migration has not yet deployed -- the MatrixMap surfaces an
  //    inline "samples data temporarily unavailable" notice.
  let initialMapData: MatrixMapData = EMPTY_MATRIX_MAP_DATA;
  let fetchErrorMessage: string | null = null;
  try {
    // Schema-scoped per codex PR-MAP-3a R1 P1.2: the RPC lives in
    // matrix_map, which is exposed via "Exposed schemas" (Project
    // Settings -> API). Without .schema('matrix_map'), PostgREST
    // routes the call to the default schema (public) and fails with
    // PGRST202 function not found. Mirrors the /admin/matrix-map/health
    // pattern using .schema('matrix_map').from(...).
    const { data: rpcData, error: rpcErr } = await supabase
      .schema('matrix_map')
      .rpc('fetch_samples_with_hidden_summary', { p_bbox: null });
    if (rpcErr) {
      // Diagnostic logging 2026-05-20: owner reported the "samples data
      // temporarily unavailable" notice still showing after the JWT-via-
      // current-setting refactor (PR #145) applied. Surface the actual
      // PostgREST error to the dev server terminal + production logs so
      // we can diagnose the remaining failure mode. Logs structured
      // fields explicitly (message + details + hint + code) because
      // supabase-js wraps PostgREST errors in a non-Error object that
      // console.log({...err}) would otherwise serialize as '[object]'.
      console.error('[matrix-map page] RPC fetch_samples_with_hidden_summary failed:', {
        message: rpcErr.message,
        details: (rpcErr as { details?: unknown }).details,
        hint: (rpcErr as { hint?: unknown }).hint,
        code: (rpcErr as { code?: unknown }).code,
        user_id: user.id,
      });
      fetchErrorMessage =
        'Samples data temporarily unavailable -- check ' +
        '/admin/matrix-map/health';
    } else if (rpcData) {
      // The RPC returns a JSON object (jsonb on the wire). Cast through
      // unknown so we are explicit about the boundary; downstream code
      // trusts MatrixMapData (the canonical contract from
      // PR_MAP_3_PLAN section 2.2) and structurally validates the
      // critical fields below.
      const parsed = rpcData as unknown as Partial<MatrixMapData>;
      initialMapData = {
        visible_samples: Array.isArray(parsed.visible_samples)
          ? parsed.visible_samples
          : [],
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
      };
    }
  } catch (thrownErr) {
    // Defensive -- supabase-js may throw on transport errors before
    // returning an { error } shape. Pin the same user-visible message.
    // Diagnostic logging 2026-05-20: same rationale as the rpcErr path
    // above; surface the thrown error to dev terminal + production logs.
    console.error('[matrix-map page] RPC fetch_samples_with_hidden_summary THREW:', thrownErr);
    fetchErrorMessage =
      'Samples data temporarily unavailable -- check ' +
      '/admin/matrix-map/health';
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Matrix Options
        </p>
        <h1 className="mt-0.5 text-lg font-bold text-slate-900 dark:text-slate-100">
          Interactive Map -- PR-MAP-3a (samples + symbology)
        </h1>
        <p className="mt-1 max-w-3xl text-xs text-slate-600 dark:text-slate-300">
          PR-MAP-3a renders matrix-map samples with the 9-state symbology
          (3 classifications x 3 coordinate-quality tiers) + the partial-
          visibility banner. Identify (PR-MAP-3b) + selection (PR-MAP-4)
          follow. Toggle BC public WMS overlays in the left rail; switch
          base tiles from the top bar.
        </p>
      </header>
      <div className="relative min-h-0 flex-1">
        <MatrixMapLoader
          initialMapData={initialMapData}
          fetchErrorMessage={fetchErrorMessage}
        />
      </div>
    </div>
  );
}
