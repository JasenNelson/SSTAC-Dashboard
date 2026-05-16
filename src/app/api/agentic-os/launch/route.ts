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
// Step 6b: after successful spawn, the route:
//   - generates a runId (uuid) -- primary client-facing handle (NOT pid;
//     pids are OS-reused),
//   - registers the run with @/lib/agentic-os/launch-runs (line capture +
//     buffer + pub/sub for the SSE endpoint at /api/agentic-os/stream/[runId]),
//   - appends a JSON audit line to both the in-memory ring buffer and
//     logs/agentic-os-launches.log (best-effort persistence), and
//   - returns { runId, pid, status: 'spawned' } 200.
// The child's stdout/stderr are 'pipe' so launch-runs.ts can attach 'data'
// listeners without re-spawning.
//
// The child is NOT detached and NOT unref'd: the pipes must stay alive for
// step 6b. The OS reaps the child when it exits.
//
// Architecture spec: .tmp_presentation/master/AGENTIC_OS_ARCHITECTURE.md
// section 5 (lines 144-229). Handoff anti-patterns: HANDOFF.md section 10.

import { randomUUID } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/engine-v2/admin_guards';
import { checkCsrf } from '@/lib/engine-v2/csrf';
import { isAgenticOsLaunchEnabled } from '@/lib/agentic-os/feature-flag';
import { LaunchRequestSchema } from '@/lib/agentic-os/launch-schemas';
import { validateLaunchRequest } from '@/lib/agentic-os/launch-validator';
import { spawnAwaitingReady } from '@/lib/agentic-os/spawn-await-ready';
import { appendLaunchAudit } from '@/lib/agentic-os/launch-audit-log';
import { registerRun } from '@/lib/agentic-os/launch-runs';

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

  // GATE 6a: Pattern E (step 9) MUST go through /api/agentic-os/pty-token,
  // NOT through this route. The validator recognizes open_embedded so the
  // PTY token-mint route can reuse it, but the /launch route must never
  // spawn `claude --resume` into a piped child -- that path is reserved
  // for the PTY sidecar. Rejecting here keeps the surfaces explicitly
  // disjoint and means a regression in the client cannot accidentally
  // burn a Pattern A spawn slot on what should be an embedded PTY.
  if (parsed.data.action === 'open_embedded') {
    return NextResponse.json(
      { error: 'use_pty_token_route', detail: 'open_embedded is handled by /api/agentic-os/pty-token' },
      { status: 400 },
    );
  }

  // GATE 6b: allowlist + command template.
  const validation = validateLaunchRequest(parsed.data);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.reason },
      { status: 400 },
    );
  }
  const { exe, args, cwd, spawnOverrides } = validation.value;

  // SPAWN: await 'spawn' vs 'error' race (engine_v2 commit 49b1cb0 pattern).
  //
  // Defaults (used for Pattern A skill / Pattern C run_skill / Pattern D
  // run_agent -- everything whose output we want to surface via SSE):
  //   - stdin 'ignore': nothing to feed the child; never block on input.
  //   - stdout/stderr 'pipe': step 6b's SSE endpoint attaches to these
  //     via the runId -> stream registry without re-spawning.
  //   - windowsHide: prevents console flash on Windows admins.
  //
  // Per-template overrides (validator-provided): Pattern B / open_session
  // inverts windowsHide so wt.exe's window appears, sets detached:true so
  // wt.exe survives parent exit on Windows, and switches stdio to 'ignore'
  // so wt.exe isn't held back by our pipes. The override block wins on
  // conflict because it's spread AFTER the defaults. When detached is
  // requested we ALSO call child.unref() per Node docs -- on Windows the
  // unref()+detached pair is required for the child to outlive the parent.
  const spawnDefaults: import('child_process').SpawnOptions = {
    cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  };
  const spawnOpts: import('child_process').SpawnOptions = {
    ...spawnDefaults,
    ...(spawnOverrides ?? {}),
  };
  try {
    const child = await spawnAwaitingReady(exe, args, spawnOpts);
    if (spawnOpts.detached) {
      // Required on Windows when detached:true so the parent's exit
      // doesn't terminate wt.exe. Node docs:
      // https://nodejs.org/api/child_process.html#optionsdetached
      child.unref();
    }

    // runId is the primary client-facing handle. Generated AFTER spawn so a
    // spawn failure does not burn a uuid (and so the registry never holds a
    // half-initialized entry pointing at a dead child).
    const runId = randomUUID();
    const startedAt = new Date().toISOString();

    registerRun({
      runId,
      project: parsed.data.project,
      action: parsed.data.action,
      command: { exe, args, cwd },
      child,
      startedAt,
    });

    appendLaunchAudit({
      ts: startedAt,
      user_email: user.email,
      pid: child.pid,
      run_id: runId,
      exe,
      args,
      cwd,
      project: parsed.data.project,
      action: parsed.data.action,
    });

    return NextResponse.json(
      { runId, pid: child.pid, status: 'spawned' },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'spawn_failed', detail: String(err) },
      { status: 500 },
    );
  }
}
