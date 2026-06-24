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
//   - Auth: must be a logged-in user (401). NO user_roles gate here -- the route
//     authorization is INTENTIONALLY aligned with the SSR fetch on BOTH consumer
//     pages (fetchMatrixMapSamplesServerSide), so the client refetch can never be
//     stricter than the initial server render. The real data-access authority is
//     the SECDEF RPC, which enforces caller auth + matrix_map.is_email_allowlisted
//     (JWT sub) + the visibility predicate internally and keeps hidden_* PROVINCE-
//     WIDE (no spatial oracle). A non-allowlisted authed user gets exactly the
//     RPC-scoped (public / empty) payload the SSR path already returns to them --
//     no new exposure. Page-level reviewer gating (R-5: ANY user_roles row) stays
//     where it belongs: on /matrix-map/page.tsx for PAGE access. Embedding the map
//     on the any-authenticated-user /matrix-options surface (#330) is why a route
//     user_roles 403 would mismatch that page's initial SSR fetch and strand
//     refetches (codex IMPORTANT 2026-06-23).
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
// parseBboxParams lives in @/lib/matrix-map/bbox -- a Next.js route module may
// only export route handlers + config, so the bbox parser cannot be exported here.
import { parseBboxParams } from '@/lib/matrix-map/bbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  // Auth gate (returns JSON instead of redirect). Auth-only by design: the RPC
  // (matrix_map.is_email_allowlisted + visibility predicate) is the data-access
  // authority and matches the SSR fetch on both consumer pages -- see the
  // SECURITY POSTURE note above. No user_roles gate here.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return respond({ error: 'unauthorized' }, 401);
  }

  const bbox = parseBboxParams(request.nextUrl.searchParams);
  const { initialMapData, fetchErrorMessage } =
    await fetchMatrixMapSamplesServerSide(supabase, bbox);

  return respond({ ...initialMapData, fetchErrorMessage }, 200);
}
