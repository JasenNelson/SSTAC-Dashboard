# Route Access Allowlist

Source of truth: src/lib/auth/route-access.ts
Middleware: src/middleware.ts (config.matcher mirrors GATED_ROUTE_PREFIXES)

---

## Public Routes (no authentication required)

| Route prefix     | Rationale                                                                 |
|------------------|---------------------------------------------------------------------------|
| /                | Public landing page                                                       |
| /login           | Auth entry point                                                          |
| /signup          | Auth entry point                                                          |
| /matrix-options  | Public by design: Codex P1 decision 2026-05-20. Educational reference    |
|                  | content; anyone may read Protocol 28 policy evidence. The live map data  |
|                  | RPC is gated separately at the database layer (Supabase RLS).            |
| /cew-polls       | Public poll participation; respondents must not be required to log in    |

---

## Gated Routes (authentication required)

All routes below are intercepted by the Next.js middleware before rendering.
The middleware is the FIRST layer only -- sensitive data is also protected by:
  - Supabase Row Level Security (RLS) policies on every table
  - Per-page server-side auth checks (supabase.auth.getUser() in Server Components)

| Middleware matcher     | Description                                        |
|------------------------|----------------------------------------------------|
| /dashboard/:path*      | Main dashboard and sub-routes                      |
| /twg/:path*            | Technical Working Group review portal              |
| /survey-results/:path* | Restricted survey result views                     |
| /cew-2025/:path*       | CEW 2025 authenticated portal                      |
| /regulatory-review/:path* | RRAA engine regulatory-review views            |
| /bn-rrm/:path*         | BN-RRM interactive maps and HITL packet views      |
| /demo-matrix-graph/:path* | Matrix graph demo (hardcoded data but not a   |
|                        | public route; added 2026-06-15 hardening PR)       |

---

## Auth Error Handling Policy (middleware)

| Error class              | Classification | Action                                      |
|--------------------------|----------------|---------------------------------------------|
| AuthRetryableFetchError  | RETRYABLE      | Redirect to /login WITHOUT signOut          |
| status 0 (network error) | RETRYABLE      | Redirect to /login WITHOUT signOut          |
| status 502/503/504       | RETRYABLE      | Redirect to /login WITHOUT signOut          |
| 'Invalid Refresh Token'  | TERMINAL       | signOut() then redirect to /login           |
| 'refresh_token_not_found'| TERMINAL       | signOut() then redirect to /login           |
| status 401/403 (non-retryable) | TERMINAL | signOut() then redirect to /login         |
| No user, no error        | CLEAN no-session | Redirect to /login (no signOut needed)   |
| 'Auth session missing!'  | EXPECTED anon  | Silenced (handled by no-user redirect)      |

Rationale: retryable errors must NOT destroy cookies. Calling signOut() on a
transient 502 would log out a user whose session is perfectly valid. Terminal
errors (bad/expired refresh token) warrant signOut to clear stale cookies.

---

## Keeping This in Sync

The config.matcher array in src/middleware.ts MUST mirror GATED_ROUTE_PREFIXES
in src/lib/auth/route-access.ts. The test at
src/lib/auth/__tests__/route-access.test.ts asserts this at CI time.

When adding a new gated route:
  1. Add the /:path* entry to config.matcher in src/middleware.ts
  2. Add the prefix (without /:path*) to GATED_ROUTE_PREFIXES in route-access.ts
  3. Add a row to this doc
  4. Run npx vitest run src/lib/auth/__tests__/route-access.test.ts to confirm

When marking a route public:
  1. Remove from config.matcher and GATED_ROUTE_PREFIXES
  2. Add to PUBLIC_ROUTES with a rationale comment in route-access.ts
  3. Ensure Supabase RLS and per-page checks gate any sensitive data independently
