// SERVER-ONLY feature flags for the Agentic OS admin page.
//
// This file is split out from `feature-flag.ts` because it probe-loads
// `node-pty` -- a native module with a top-level `require('fs')` chain
// that turbopack/webpack will trace into the client bundle if the
// import graph reaches this file from any `'use client'` component.
//
// Previously, the PTY probe lived alongside the client-safe helpers
// (`isAgenticOsEnabled`, `isAgenticOsLaunchEnabled`) in feature-flag.ts.
// Client components import THOSE helpers, which pulled the whole module
// (including the require) into the browser bundle:
//
//   Module not found: Can't resolve 'fs'
//   ./node_modules/node-pty/lib/unixTerminal.js
//   ./node_modules/node-pty/lib/index.js
//   ./src/lib/agentic-os/feature-flag.ts
//   ./src/components/dashboard/AdminFunctionsNav.tsx [Client Component Browser]
//
// The `typeof window` runtime guard could not save us because turbopack
// resolves the import graph statically -- the require is already in the
// chunk by the time the runtime check would short-circuit.
//
// Splitting the module fixes this: client code can import the safe
// helpers from feature-flag.ts; server-only code (route handlers, server
// components) imports from THIS file. The `import 'server-only'`
// directive below is a build-time tripwire: any client component that
// reaches for this module produces a clear error rather than a baffling
// "Can't resolve 'fs'" deep in node_modules.

import 'server-only';

import { isAgenticOsLaunchEnabled } from './feature-flag';

// node-pty probe: cached on first call. The probe itself uses a string-
// eval'd require so static bundlers don't follow the import graph through
// it even if the file is somehow pulled into a client trace. The
// `import 'server-only'` directive above is the primary defence; this is
// defence-in-depth.
let ptyModuleLoaded: boolean | null = null;
function isNodePtyAvailable(): boolean {
  if (ptyModuleLoaded !== null) return ptyModuleLoaded;
  // Browser check is still defensive in case a future refactor leaks this
  // file into the client bundle despite `server-only` -- we still don't
  // want to crash by running `require` in the browser.
  const isBrowser =
    typeof window !== 'undefined' &&
    (typeof process === 'undefined' || !process?.versions?.node);
  if (isBrowser) {
    ptyModuleLoaded = false;
    return false;
  }
  try {
    // eval('require') hides the dependency from static bundler analysis,
    // so node-pty stays out of any chunk that traces this file. The
    // `as never` cast suppresses the lint complaint that we're typing
    // an arbitrary call expression as a require function.
    const dynamicRequire = eval('require') as NodeRequire;
    const pty = dynamicRequire('node-pty');
    ptyModuleLoaded = typeof (pty as { spawn?: unknown })?.spawn === 'function';
  } catch {
    ptyModuleLoaded = false;
  }
  return ptyModuleLoaded;
}

/**
 * Minimum PTY-secret length (codex 2026-05-16 P2-5 hardening). Matches the
 * PTY sidecar server's startup check. 32 chars catches the case where a
 * dev typed a weak placeholder ("test123") instead of running the
 * documented `openssl rand -hex 32` (which produces 64 hex chars). Any
 * value at least this long is considered acceptable; we do not enforce
 * hex format because base64 / arbitrary high-entropy strings are also OK.
 */
export const MIN_PTY_SECRET_LENGTH = 32;

/**
 * Strictest gate -- enables the embedded xterm.js terminal modal (step 9 /
 * Pattern E). Returns true ONLY when all four are satisfied:
 *   1. isAgenticOsLaunchEnabled() is true (dev or AGENTIC_OS_LOCAL=true)
 *   2. process.env.AGENTIC_OS_PTY_SECRET is a non-empty string
 *   3. The secret is at least MIN_PTY_SECRET_LENGTH chars
 *      (codex 2026-05-16 P2-5: refuse weak secrets so HS256 token forging
 *      stays infeasible on a localhost-shared machine)
 *   4. node-pty loaded successfully (probed lazily, cached)
 *
 * Client components must NOT import this function. The page server
 * component resolves it once and passes the result down as a prop
 * (`ptyEnabled: boolean`).
 */
export function isAgenticOsPtyEnabled(): boolean {
  if (!isAgenticOsLaunchEnabled()) return false;
  const secret = process.env.AGENTIC_OS_PTY_SECRET;
  if (typeof secret !== 'string' || secret.length === 0) return false;
  if (secret.length < MIN_PTY_SECRET_LENGTH) return false;
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
