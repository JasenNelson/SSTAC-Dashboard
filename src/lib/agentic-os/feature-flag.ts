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

// Step 9 / Pattern E (embedded xterm.js modal via node-pty WebSocket).
//
// The embedded terminal modal connects the browser to a real PTY through a
// sidecar Node server (scripts/agentic-os-pty-server.mjs) on ws://localhost:3101.
// This surface is gated more strictly than the launch route because:
//   1. It requires node-pty -- a native module that ships prebuilt binaries
//      but may not be present in some serverless / docker images, so we
//      probe-load it server-side and cache the result.
//   2. It requires AGENTIC_OS_PTY_SECRET -- a JWT-signing secret used to
//      hand off the validated {exe, args, cwd} from the token-mint route to
//      the WebSocket server. The PTY server WILL NOT START without this set
//      so a missing secret in dev becomes a clear "off" state rather than
//      a hidden auth bypass.
//   3. It piggy-backs on isAgenticOsLaunchEnabled() so the dev / prod gate
//      stays a single source of truth.
//
// The check is intentionally additive: launch-enabled stays the floor,
// PTY-enabled is the strictly-stricter superset. A Vercel deploy that
// enables the read-only public view (NEXT_PUBLIC_AGENTIC_OS_ENABLED=true)
// will see this helper return false because both AGENTIC_OS_LOCAL and the
// PTY secret are unset on the deploy.
//
// node-pty probe: wrapped in try/catch at module require time so a build
// trace on Vercel (where node-pty may have been excluded via webpack
// externals) does NOT cause this file to throw at import.

let ptyModuleLoaded: boolean | null = null;
function isNodePtyAvailable(): boolean {
  if (ptyModuleLoaded !== null) return ptyModuleLoaded;
  // Probe behavior:
  //   - Browser (real one): `window` exists, `process.versions?.node` is undef.
  //     Refuse the probe so we don't pull node-pty into the client bundle.
  //   - jsdom (vitest test env): `window` exists too, but `process.versions.node`
  //     IS defined because we still run inside the Node process. We MUST allow
  //     the probe there or the route + flag tests would always see "off".
  //   - Server-side / Node: window undef, probe runs normally.
  const isBrowser =
    typeof window !== 'undefined' &&
    (typeof process === 'undefined' || !process?.versions?.node);
  if (isBrowser) {
    ptyModuleLoaded = false;
    return false;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pty = require('node-pty');
    ptyModuleLoaded = typeof pty?.spawn === 'function';
  } catch {
    ptyModuleLoaded = false;
  }
  return ptyModuleLoaded;
}

/**
 * Strictest gate -- enables the embedded xterm.js terminal modal (step 9 /
 * Pattern E). Returns true ONLY when all three are satisfied:
 *   1. isAgenticOsLaunchEnabled() is true (dev or AGENTIC_OS_LOCAL=true)
 *   2. process.env.AGENTIC_OS_PTY_SECRET is a non-empty string
 *   3. node-pty loaded successfully at module require time
 *
 * Client components reach this via a server-rendered prop or the
 * `/api/agentic-os/pty-token` route's response shape (not by importing
 * this module directly; node-pty would be pulled into the client bundle).
 */
export function isAgenticOsPtyEnabled(): boolean {
  if (!isAgenticOsLaunchEnabled()) return false;
  const secret = process.env.AGENTIC_OS_PTY_SECRET;
  if (typeof secret !== 'string' || secret.length === 0) return false;
  if (!isNodePtyAvailable()) return false;
  return true;
}

/**
 * Test-only reset for the cached node-pty probe result. Without this, a
 * vitest case that wants to assert the "module unavailable" path cannot
 * roll back from a previous successful probe in the same process.
 */
export function __resetPtyModuleProbeForTest(): void {
  ptyModuleLoaded = null;
}
