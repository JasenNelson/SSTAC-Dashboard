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

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-3">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Matrix Options
        </p>
        <h1 className="mt-0.5 text-lg font-bold text-slate-900">
          Interactive Map -- PR-MAP-2 (empty map + base tiles + BC overlays)
        </h1>
        <p className="mt-1 max-w-3xl text-xs text-slate-600">
          PR-MAP-2 ships the empty map skeleton. Sample rendering, identify,
          and selection tools follow in PR-MAP-3..PR-MAP-5. Toggle BC public
          WMS overlays in the left rail; switch base tiles from the top bar.
        </p>
      </header>
      <div className="relative min-h-0 flex-1">
        <MatrixMapLoader />
      </div>
    </div>
  );
}
