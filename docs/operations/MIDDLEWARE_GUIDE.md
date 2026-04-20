# Middleware Guide

**Lifecycle:** REFERENCE
**Source of truth:** `src/middleware.ts`. This doc describes current behavior; if it diverges from the file, the file wins.

## Purpose

`src/middleware.ts` is the single Next.js middleware. It runs on every request matching the `config.matcher` glob and does three jobs:

1. Set production-grade response security headers.
2. Refresh and validate the Supabase session.
3. Redirect unauthenticated users (or users with broken sessions) to `/login`, preserving the original path.

## Matcher (which routes go through middleware)

```ts
matcher: [
  '/dashboard/:path*',
  '/twg/:path*',
  '/survey-results/:path*',
  '/cew-2025/:path*',
  '/regulatory-review/:path*',
  '/bn-rrm/:path*',
]
```

Source: `src/middleware.ts:128-137`. Routes outside this set bypass middleware entirely — no auth check, no header set. API routes (`/api/**`) are not in the matcher; per-route guards (e.g. `requireAdmin()` in `src/lib/api-guards.ts`) handle their auth.

## Request flow

1. Construct a passthrough `NextResponse` carrying the original request headers.
2. Apply seven response headers (see "Headers" below).
3. Build a Supabase server client bound to the request/response cookie store.
4. Call `supabase.auth.getUser()`. This refreshes the session if the access token is expired and the refresh token is valid.
5. On error: classify, optionally `signOut()`, redirect to `/login?redirect=<path>`.
6. On success but no user: redirect to `/login?redirect=<path>`.
7. On success with user: return the prepared response (request continues).

The `redirect` query param preserves the originally requested path so the login page can bounce the user back after authentication.

## Headers

Set unconditionally on every middleware-matched response:

| Header | Value (abbreviated) | Purpose |
|--------|---------------------|---------|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' <CDNs> <vercel-scripts>; …` | Restrict resource loading to same-origin + trusted CDNs |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=(), …` | Disable unused browser features |

Plus production-only:

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS |

The HSTS gate (`process.env.NODE_ENV === 'production'`) is the only headers-related branch. Source: `src/middleware.ts:17-54`.

The CSP `script-src` allowlist currently includes `cdn.jsdelivr.net`, `cdn.tailwindcss.com`, and `va.vercel-scripts.com`. `connect-src` allows `*.supabase.co` and `va.vercel-scripts.com`. Adding a new third-party script or fetch endpoint requires an explicit edit here.

## Auth-error handling and the "Auth session missing!" silencing

When `supabase.auth.getUser()` returns an error, middleware classifies it before deciding what to log and what to do.

### Why an error path runs at all

`supabase.auth.getUser()` returns `{ error: { message: 'Auth session missing!' } }` for **any anonymous request to a protected route** — there is no session cookie present, so the call cannot succeed. This is the expected steady-state for first-time visitors hitting `/dashboard/*` etc. Treating it as a real error pollutes server logs.

### What was changed (commit `66b787a`)

`src/middleware.ts:79-90` checks the message before logging:

```ts
const isExpectedAnonymous = error.message === 'Auth session missing!'
if (!isExpectedAnonymous) {
  console.error('[Middleware] Auth error:', { ... })
}
```

`Auth session missing!` is now silent; every other auth error is still logged with `message`, `status`, and `path`. The redirect-to-login behavior below runs regardless of what was logged.

### Refresh-token / JWT / 401 errors

If the error matches any of:

- `error.message?.includes('Refresh Token')`
- `error.message?.includes('Invalid refresh token')`
- `error.message?.includes('JWT')`
- `error.status === 401`

Middleware calls `supabase.auth.signOut()` (errors swallowed — we're redirecting anyway), then redirects to `/login?redirect=<path>`. This forces a clean re-authentication when a session is broken or stale, instead of leaving the client in a half-valid state. Source: `src/middleware.ts:94-114`.

### Other auth errors

Non-refresh, non-401 errors fall through to the "no user" path below — redirect to login without the explicit `signOut()`.

## "No user" redirect

If `getUser()` succeeded but `user` is null, middleware redirects to `/login?redirect=<path>`. Source: `src/middleware.ts:118-123`.

## Cookies

The Supabase server client is wired to the request/response cookie store via `get` / `set` / `remove` adapters. `set` and `remove` write to the response so the new cookie reaches the browser. Source: `src/middleware.ts:60-71`.

## What this middleware does NOT do

- It does not enforce role-based access (admin vs. viewer). Per-route guards (`requireAdmin()` in `src/lib/api-guards.ts`) handle role checks for API routes; per-page checks live in route components.
- It does not run on `/api/**` routes. They are not in the matcher.
- It does not log or redirect for the unauthenticated-anonymous case (see silencing above).
- It does not validate CSRF tokens. Cookie-based CSRF protection is delegated to Supabase + the Next.js framework defaults.

## Related files

- `src/lib/api-guards.ts` — `requireAdmin()`, `requireLocalEngine()` for API routes
- `src/lib/supabase/middleware.ts` (referenced from `api-guards.ts`) — server-client cookie pattern shared with route handlers
- `src/app/login/page.tsx` — login UI that consumes the `redirect` query param
- `src/app/api/auth/callback/route.ts` — Supabase OAuth callback (does not go through this middleware)
