// =====================================================================
// GET /api/matrix-map/samples -- browser-callable viewport sample fetch
// =====================================================================
//
// bbox-lane Stage 2: lets the client refetch matrix-map samples for the
// current map viewport (so the deferred full 345-site dataset does not ship
// in one province-wide payload). Server-side wrapper around the SECDEF RPC
// matrix_map.fetch_samples_with_hidden_summary, called via the shared helper
// fetchMatrixMapSamplesServerSide(supabase, bbox).
//
// Query params (all optional; any missing/blank/invalid => province-wide):
//   ?min_lng&min_lat&max_lng&max_lat  (WGS84 viewport edges)
//
// SECURITY POSTURE (carry the Stage 1 rigor):
//   - Auth: must be a logged-in user (401) holding ANY user_roles row (403) --
//     mirrors the reviewer gate on /matrix-map/page.tsx (R-5). The RPC ALSO
//     enforces caller auth + email allowlist + the visibility predicate
//     internally and keeps hidden_* PROVINCE-WIDE (no spatial oracle).
//   - GET read, no mutation => no CSRF token required (unlike the export POST).
//   - COOKIES: this route is OUTSIDE the middleware matcher, so it owns its own
//     getAll/setAll and PROPAGATES any auth-refresh Set-Cookie onto the response
//     (codex P2: get-only would risk stale-token random logouts).
//   - The bbox is parsed STRICTLY (trim + finite) then handed to the typed
//     helper -> toRpcBbox (WGS84 / degenerate guard) -> jsonb; no interpolation.
//   - Cache-Control private, no-store: this is per-user RLS-scoped data.
//
// Plain ASCII only.
// =====================================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { fetchMatrixMapSamplesServerSide } from '@/lib/matrix-map/fetch-samples-server';
import type { MatrixMapBbox } from '@/lib/matrix-map/bbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Shape the 4 bbox query params into a MatrixMapBbox, or null (province-wide).
 * STRICT + fail-safe: any missing / blank / whitespace-only / non-finite edge
 * => null (codex P3: Number(" ") === 0 would otherwise forge a 0 coordinate).
 * Range / degenerate checks live in the helper's toRpcBbox.
 */
export function parseBboxParams(sp: URLSearchParams): MatrixMapBbox | null {
  const raw = ['min_lng', 'min_lat', 'max_lng', 'max_lat'].map((k) => sp.get(k)?.trim());
  if (raw.some((v) => !v)) return null;
  const nums = (raw as string[]).map((v) => Number(v));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [minLng, minLat, maxLng, maxLat] = nums;
  return { minLng, minLat, maxLng, maxLat };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Collect any cookies the auth layer wants to set (token refresh) and
  // propagate them onto whatever response we return (codex P2).
  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => pendingCookies.push(c));
        },
      },
    },
  );

  const respond = (body: unknown, status: number): NextResponse => {
    const res = NextResponse.json(body, {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    });
    pendingCookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  };

  // Auth gate (mirrors /matrix-map/page.tsx, returns JSON instead of redirect).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return respond({ error: 'unauthorized' }, 401);
  }

  // Reviewer allowlist: ANY user_roles row (R-5). Fail CLOSED on lookup error.
  const { data: roleRows, error: roleErr } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .limit(1);
  if (roleErr) {
    return respond({ error: 'role_lookup_failed' }, 500);
  }
  if (!roleRows || roleRows.length === 0) {
    return respond({ error: 'forbidden' }, 403);
  }

  const bbox = parseBboxParams(request.nextUrl.searchParams);
  const { initialMapData, fetchErrorMessage } =
    await fetchMatrixMapSamplesServerSide(supabase, bbox);

  return respond({ ...initialMapData, fetchErrorMessage }, 200);
}
