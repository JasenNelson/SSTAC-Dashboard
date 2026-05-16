// Feature flag for the Agentic OS admin page family.
//
// The page is intentionally a single-machine local-only feature: it reads
// Knowledge-Base/PROJECTS_MAP.md from the developer's local filesystem and
// spawns `git log` per project. Neither works in a serverless deployment
// (filesystem is read-only; git is not installed; project paths are
// Windows-style absolute references to C:\Projects\* which Linux serverless
// can't resolve anyway).
//
// Without this gate, a Vercel deploy would render the page but show every
// project as "Git unavailable" + an empty sparkline -- the holistic
// lane-boundary review (after step 5) flagged this as IMPORTANT-1.
//
// Enabled when EITHER:
//   - NODE_ENV is "development" (running `next dev` locally), OR
//   - NEXT_PUBLIC_AGENTIC_OS_ENABLED=true is set in the runtime environment
//
// The NEXT_PUBLIC_ prefix is required because this helper is also used by
// CLIENT components (the AdminFunctionsNav pill, the AdminDashboardClient
// quick-action card) to conditionally render their entry points. Next.js
// only ships NEXT_PUBLIC_* env vars to the client bundle; NODE_ENV is also
// inlined at build time by Next.js's webpack DefinePlugin so the dev check
// works in both server and client contexts.
//
// Step 6's launch route will layer an additional stricter gate
// (AGENTIC_OS_LOCAL=true server-side) so admin-friendly view-only rendering
// can be enabled in some preview environments without enabling spawning.

export function isAgenticOsEnabled(): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  if (process.env.NEXT_PUBLIC_AGENTIC_OS_ENABLED === 'true') return true;
  return false;
}

/**
 * Stricter local-only gate for the launch route (and any future server
 * endpoint that spawns local subprocesses). Returns true ONLY in dev mode
 * OR when AGENTIC_OS_LOCAL=true is set server-side. The NEXT_PUBLIC_*
 * variant (used by the page render gate) is INSUFFICIENT here -- it can
 * be turned on in a production deployment by accident, and that must
 * never enable spawning.
 *
 * Source-of-truth check order:
 *   1. process.env.NODE_ENV === 'development'    -> true
 *   2. process.env.AGENTIC_OS_LOCAL === 'true'   -> true
 *   3. otherwise                                  -> false
 *
 * Note: AGENTIC_OS_LOCAL is intentionally NOT prefixed with NEXT_PUBLIC_.
 * Next.js does not inline non-public env vars into the client bundle, so
 * this value lives strictly server-side. A flip of NEXT_PUBLIC_AGENTIC_OS_ENABLED
 * in a Vercel deploy will NOT enable spawning here.
 */
export function isAgenticOsLaunchEnabled(): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  if (process.env.AGENTIC_OS_LOCAL === 'true') return true;
  return false;
}

// The PTY-enabled gate for step 9 (embedded xterm.js modal) lives in the
// sibling SERVER-ONLY module `./feature-flag-server` because it probe-loads
// node-pty, which would otherwise leak into client bundles that import any
// helper from this file. Server components / route handlers that need
// `isAgenticOsPtyEnabled()` import from `./feature-flag-server` directly.
