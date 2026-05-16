// Agentic OS launch route -- POST /api/agentic-os/launch (step 6a).
//
// Spawns a `claude` CLI subprocess on the developer's local machine. This is
// the most sensitive surface in the dashboard because the request flow ends
// in child_process.spawn() with a configurable exe / cwd. Defense in depth is
// implemented as a 6-gate pattern from the architecture spec:
//
//   GATE 1 (cheap): isAgenticOsLaunchEnabled()       -> 403 launch_disabled_in_non_dev
//   GATE 2 (cheap): isLocalhostOrigin(origin)        -> 403 localhost_only
//   GATE 3 (cheap): checkCsrf(request)               -> 415 (CT) / 403 (origin)
//   GATE 4 (auth):  requireAdminForApi()             -> 401/403
//   GATE 5 (shape): LaunchRequestSchema.safeParse    -> 400 invalid_payload
//   GATE 6 (sema):  validateLaunchRequest            -> 400 unknown_project/unknown_action
//
// Cheapest-first ordering means a misconfigured production deploy (gate 1)
// rejects without touching Supabase. CSRF runs before admin because origin
// rejection requires zero database I/O and shields the admin-role lookup
// from any cross-origin probing.
//
// IMPORTANT (step 6a scope only): the child's stdout/stderr are NOT yet
// routed back to the client. Step 6b will add an in-memory PID -> stream
// registry plus an SSE endpoint subscribing to it. For step 6a, we:
//   - spawn with stdio: ['ignore', 'pipe', 'pipe'] so step 6b's registry
//     can attach without re-spawning,
//   - append { pid, command, user_email, timestamp } to an in-memory audit
//     log that is inspectable from this same module, and
//   - return { pid, status: 'spawned' } 200 to the caller.
//
// The child is NOT detached and NOT unref'd: the pipes must stay alive for
// step 6b. The OS reaps the child when it exits.
//
// Architecture spec: .tmp_presentation/master/AGENTIC_OS_ARCHITECTURE.md
// section 5 (lines 144-229). Handoff anti-patterns: HANDOFF.md section 10.

import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/engine-v2/admin_guards';
import { checkCsrf } from '@/lib/engine-v2/csrf';
import { isAgenticOsLaunchEnabled } from '@/lib/agentic-os/feature-flag';
import { LaunchRequestSchema } from '@/lib/agentic-os/launch-schemas';
import { validateLaunchRequest } from '@/lib/agentic-os/launch-validator';
import { spawnAwaitingReady } from '@/lib/agentic-os/spawn-await-ready';
import { appendLaunchAudit } from '@/lib/agentic-os/launch-audit-log';

export const runtime = 'nodejs';

// Audit log lives in @/lib/agentic-os/launch-audit-log because Next.js App
// Router constrains route.ts to export only HTTP-verb handlers + a small
// allowlist of config exports. Non-handler exports here would fail the
// .next/types route-constraint check at build time.

/**
 * Localhost origin check. Returns true only when the origin/referer parses
 * to a URL whose hostname is localhost, 127.0.0.1, or ::1. Anything else
 * (including the empty string, malformed URLs, or any external hostname)
 * returns false. This complements checkCsrf -- csrf accepts any
 * NEXT_PUBLIC_SITE_URL on prod; this gate hard-caps the launch route to
 * loopback regardless of NEXT_PUBLIC_SITE_URL configuration.
 */
function isLocalhostOrigin(origin: string): boolean {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    return (
      u.hostname === 'localhost' ||
      u.hostname === '127.0.0.1' ||
      u.hostname === '[::1]' ||
      u.hostname === '::1'
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // GATE 1: feature flag (cheapest reject; no DB / no header parsing).
  if (!isAgenticOsLaunchEnabled()) {
    return NextResponse.json(
      { error: 'launch_disabled_in_non_dev' },
      { status: 403 },
    );
  }

  // GATE 2: localhost origin. Prefer Origin header (already in scheme://host
  // form). Fall back to Referer (a full URL) and reduce to its origin shape
  // before checking.
  const originHeader = request.headers.get('origin');
  const refererHeader = request.headers.get('referer');
  let candidate = '';
  if (originHeader) {
    candidate = originHeader;
  } else if (refererHeader) {
    try {
      candidate = new URL(refererHeader).origin;
    } catch {
      candidate = '';
    }
  }
  if (!isLocalhostOrigin(candidate)) {
    return NextResponse.json(
      { error: 'localhost_only' },
      { status: 403 },
    );
  }

  // GATE 3: CSRF (content-type + origin shape via shared helper).
  const csrf = checkCsrf(request);
  if (!csrf.ok) {
    return NextResponse.json(
      { error: csrf.reason, detail: csrf.detail },
      { status: 415 },
    );
  }

  // GATE 4: admin role (Supabase round-trip; runs after cheap rejects).
  const auth = await requireAdminForApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  const { user } = auth;

  // GATE 5: zod-shape body.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_payload', detail: 'invalid_json' },
      { status: 400 },
    );
  }
  const parsed = LaunchRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // GATE 6: allowlist + command template.
  const validation = validateLaunchRequest(parsed.data);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.reason },
      { status: 400 },
    );
  }
  const { exe, args, cwd } = validation.value;

  // SPAWN: await 'spawn' vs 'error' race (engine_v2 commit 49b1cb0 pattern).
  // stdio is intentionally ['ignore', 'pipe', 'pipe']:
  //   - stdin 'ignore': nothing to feed the child; never block on input.
  //   - stdout/stderr 'pipe': step 6b's SSE endpoint will attach to these
  //     via the (forthcoming) pid -> stream registry without re-spawning.
  // windowsHide prevents console flash on Windows admins.
  try {
    const child = await spawnAwaitingReady(exe, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    appendLaunchAudit({
      ts: new Date().toISOString(),
      user_email: user.email,
      pid: child.pid,
      exe,
      args,
      cwd,
    });

    return NextResponse.json(
      { pid: child.pid, status: 'spawned' },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'spawn_failed', detail: String(err) },
      { status: 500 },
    );
  }
}
