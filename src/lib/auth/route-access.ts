// src/lib/auth/route-access.ts
// Single source of truth for route access policy.
//
// GATED_ROUTE_PREFIXES mirrors the config.matcher in src/middleware.ts exactly.
// Next.js requires config.matcher to be a static literal (no runtime imports),
// so the middleware keeps its own literal and a test asserts they match.
//
// PUBLIC_ROUTES are intentionally unauthenticated:
//   - cew-polls routes: anonymous conference-poll participation (attendees have
//     no accounts; they use a 6-digit CEW access code, not login)
//   - /, /login, /signup: standard public entry points
// NOTE (2026-06-15): /matrix-options was made GATED (owner directive -- the
// (dashboard) group is authenticated-only). The earlier 2026-05-20 "public by
// design" decision was not owner-approved and has been reverted.

export const GATED_ROUTE_PREFIXES: string[] = [
  '/dashboard',
  '/twg',
  '/survey-results',
  '/cew-2025',
  '/regulatory-review',
  '/bn-rrm',
  '/demo-matrix-graph',
  '/matrix-options',
]

export const PUBLIC_ROUTES: string[] = [
  '/',
  '/login',
  '/signup',
  '/cew-polls',
]
