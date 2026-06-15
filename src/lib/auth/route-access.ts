// src/lib/auth/route-access.ts
// Single source of truth for route access policy.
//
// GATED_ROUTE_PREFIXES mirrors the config.matcher in src/middleware.ts exactly.
// Next.js requires config.matcher to be a static literal (no runtime imports),
// so the middleware keeps its own literal and a test asserts they match.
//
// PUBLIC_ROUTES are intentionally unauthenticated:
//   - matrix-options: public-by-design per 2026-05-20 Codex P1 decision
//     (educational content; the live map data RPC is gated separately by RLS)
//   - cew-polls routes: public poll participation
//   - /, /login, /signup: standard public entry points

export const GATED_ROUTE_PREFIXES: string[] = [
  '/dashboard',
  '/twg',
  '/survey-results',
  '/cew-2025',
  '/regulatory-review',
  '/bn-rrm',
  '/demo-matrix-graph',
]

export const PUBLIC_ROUTES: string[] = [
  '/',
  '/login',
  '/signup',
  '/matrix-options',
  '/cew-polls',
]
