// Agentic OS PTY token-mint route -- POST /api/agentic-os/pty-token (step 9).
//
// Hands the browser a short-lived JWT that the PTY sidecar server
// (scripts/agentic-os-pty-server.mjs) accepts on its WebSocket handshake.
// The token binds a SPECIFIC {exe, args, cwd, runId} triple -- the PTY
// server spawns ONLY that command, not whatever the WS client requests.
//
// Same 6-gate pattern as /api/agentic-os/launch -- plus a 7th gate that
// enforces the stricter `isAgenticOsPtyEnabled()` (which requires both
// AGENTIC_OS_PTY_SECRET and node-pty loaded). After validation, the route:
//   1. resolves the {exe, args, cwd} via the shared launch-validator
//      (same allowlists as the launch route -- single source of truth),
//   2. mints a 30s JWT,
//   3. appends an audit-log entry (run_id, project, action='open_embedded',
//      runMode='pty'),
//   4. returns { token, port, runId } 200.
//
// The PTY child is NOT spawned here -- only the token is minted. The WS
// server spawns when the browser presents the token. This split means a
// minted-but-never-redeemed token costs zero PTY resources (the JWT
// expires on its own after 30s).
//
// Architecture spec: .tmp_presentation/master/AGENTIC_OS_HANDOFF.md §7
// (Pattern E embedded modal).

import { randomUUID } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/engine-v2/admin_guards';
import { checkCsrf } from '@/lib/engine-v2/csrf';
import {
  isAgenticOsLaunchEnabled,
  isAgenticOsPtyEnabled,
} from '@/lib/agentic-os/feature-flag';
import { PtyTokenRequestSchema } from '@/lib/agentic-os/launch-schemas';
import { validateLaunchRequest } from '@/lib/agentic-os/launch-validator';
import { appendLaunchAudit } from '@/lib/agentic-os/launch-audit-log';
import {
  signPtyToken,
  PTY_DEFAULT_PORT,
} from '@/lib/agentic-os/pty-token';

export const runtime = 'nodejs';

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
  // GATE 1a: launch enabled (cheapest reject).
  if (!isAgenticOsLaunchEnabled()) {
    return NextResponse.json(
      { error: 'launch_disabled_in_non_dev' },
      { status: 403 },
    );
  }
  // GATE 1b: stricter PTY-specific gate (secret set + node-pty loaded).
  // Distinct error code so the client can render a precise reason for the
  // disabled state ("set AGENTIC_OS_PTY_SECRET" vs "running on prod").
  if (!isAgenticOsPtyEnabled()) {
    return NextResponse.json(
      { error: 'pty_disabled', detail: 'AGENTIC_OS_PTY_SECRET unset or node-pty not loaded' },
      { status: 403 },
    );
  }

  // GATE 2: localhost origin.
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

  // GATE 3: CSRF.
  const csrf = checkCsrf(request);
  if (!csrf.ok) {
    return NextResponse.json(
      { error: csrf.reason, detail: csrf.detail },
      { status: 415 },
    );
  }

  // GATE 4: admin role.
  const auth = await requireAdminForApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  const { user } = auth;

  // GATE 5: zod-shape body. Tighter than the launch route -- action MUST be
  // the open_embedded literal; cols/rows are bounded.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_payload', detail: 'invalid_json' },
      { status: 400 },
    );
  }
  const parsed = PtyTokenRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // GATE 6: allowlist + command template. Reuses the launch-validator so the
  // project allowlist + command template registry stays the single source
  // of truth across the Pattern A/B/C/D/E surfaces.
  const validation = validateLaunchRequest({
    project: parsed.data.project,
    action: 'open_embedded',
  });
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.reason },
      { status: 400 },
    );
  }
  const { exe, args, cwd } = validation.value;

  // Mint the token. The runId is generated BEFORE signing so the audit log
  // and the token payload share the same identifier; the client uses it as
  // the WS subprotocol key in case multiple modals are open at once.
  const runId = randomUUID();
  const port = (() => {
    const raw = process.env.AGENTIC_OS_PTY_PORT;
    if (typeof raw === 'string' && /^[0-9]+$/.test(raw)) {
      const n = Number(raw);
      if (n > 0 && n < 65536) return n;
    }
    return PTY_DEFAULT_PORT;
  })();
  let token: string;
  try {
    token = signPtyToken({
      runId,
      project: parsed.data.project,
      exe,
      args,
      cwd,
      cols: parsed.data.cols,
      rows: parsed.data.rows,
    });
  } catch (err) {
    // signPtyToken throws only when AGENTIC_OS_PTY_SECRET is missing -- but
    // GATE 1b already verified that. A throw here is a tight race (env var
    // unset between gate 1b and now), so 500 + detail.
    return NextResponse.json(
      { error: 'pty_token_sign_failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  appendLaunchAudit({
    ts: new Date().toISOString(),
    user_email: user.email,
    pid: undefined,
    run_id: runId,
    exe,
    args,
    cwd,
    project: parsed.data.project,
    action: 'open_embedded',
  });

  // We deliberately do NOT include the token in the audit log -- it's a
  // short-lived bearer credential. Run_id, exe, args, cwd, and project
  // are the audit-relevant fields.
  return NextResponse.json(
    {
      runId,
      token,
      port,
      status: 'minted',
    },
    { status: 200 },
  );
}
