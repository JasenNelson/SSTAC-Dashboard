// JWT helpers for the Agentic OS PTY token-mint flow (step 9 / Pattern E).
//
// The token-mint route (POST /api/agentic-os/pty-token) signs a short-lived
// JWT that binds a specific {exe, args, cwd, runId} triple to a 30-second
// expiry. The browser sends the token in the WS handshake query string;
// the PTY sidecar server (scripts/agentic-os-pty-server.mjs) verifies it
// using HS256 against AGENTIC_OS_PTY_SECRET and spawns ONLY the bound
// command. The token cannot be replayed against a different command, and
// after 30 seconds it cannot be replayed at all.
//
// Design choices:
//   - HS256 + a shared secret (not RS256) because the token-mint route and
//     the PTY server both run in the same single-machine local-only
//     environment. No third-party verifier needs a public key.
//   - 30-second window: long enough for the browser to open the WS
//     immediately after receiving the token; short enough that a token
//     captured from a sloppy log or shoulder-surf is useless within
//     seconds. Renewal is one POST away.
//   - Audience and issuer claims pin the token to this specific surface;
//     a token minted for a different feature (or a different host) won't
//     pass verification here.
//
// Why a separate file (not inline in route.ts):
//   - The PTY server (.mjs) needs to verify these tokens with identical
//     logic. Keeping the constants here as exports lets the server import
//     them from the bundled output OR re-state the literals inline (the
//     server lives outside Next.js's bundling pipeline). The constants are
//     also test-importable for the vitest cases.
//
// This file MUST NOT import node-pty or any other native module -- it
// runs inside the Next.js server and must stay bundle-safe.

import jwt from 'jsonwebtoken';

export const PTY_JWT_AUDIENCE = 'agentic-os.pty';
export const PTY_JWT_ISSUER = 'agentic-os.dashboard';
// 30 seconds is the entire useful lifetime. The browser MUST open the WS
// immediately after receiving the token; otherwise it expires.
export const PTY_JWT_TTL_SECONDS = 30;
// Default port for the PTY sidecar. Chosen to avoid clashing with Next dev
// (3000) and Playwright (3100). Override via AGENTIC_OS_PTY_PORT.
export const PTY_DEFAULT_PORT = 3101;

export interface PtyTokenPayload {
  /** Run identifier; appears in the audit log AND uniquely names this PTY. */
  runId: string;
  /** Allowlisted project name (already passed the validator). */
  project: string;
  /** Validated executable name (hardcoded literal from launch-validator). */
  exe: string;
  /** Validated argv (derived from a hardcoded template + allowlisted project). */
  args: readonly string[];
  /** Validated cwd (path.join(PROJECTS_ROOT, allowlisted-project)). */
  cwd: string;
  /** Initial terminal columns (defaults to 80 if absent). */
  cols?: number;
  /** Initial terminal rows (defaults to 24 if absent). */
  rows?: number;
}

/**
 * Sign a PTY-handshake token. Throws if AGENTIC_OS_PTY_SECRET is unset or
 * empty -- callers MUST have already gated on isAgenticOsPtyEnabled() and
 * MUST NOT swallow this error silently.
 */
export function signPtyToken(payload: PtyTokenPayload): string {
  const secret = process.env.AGENTIC_OS_PTY_SECRET;
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error('AGENTIC_OS_PTY_SECRET is required to sign a PTY token');
  }
  return jwt.sign(
    {
      runId: payload.runId,
      project: payload.project,
      exe: payload.exe,
      args: payload.args,
      cwd: payload.cwd,
      cols: payload.cols,
      rows: payload.rows,
    },
    secret,
    {
      algorithm: 'HS256',
      audience: PTY_JWT_AUDIENCE,
      issuer: PTY_JWT_ISSUER,
      expiresIn: PTY_JWT_TTL_SECONDS,
    },
  );
}

export type PtyVerifyResult =
  | { ok: true; payload: PtyTokenPayload }
  | { ok: false; reason: 'no_secret' | 'expired' | 'invalid' };

/**
 * Verify a PTY-handshake token. Returns a structured result rather than
 * throwing so the PTY server can map each failure mode to a different WS
 * close code. NEVER logs the secret or the raw token.
 */
export function verifyPtyToken(token: string): PtyVerifyResult {
  const secret = process.env.AGENTIC_OS_PTY_SECRET;
  if (typeof secret !== 'string' || secret.length === 0) {
    return { ok: false, reason: 'no_secret' };
  }
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      audience: PTY_JWT_AUDIENCE,
      issuer: PTY_JWT_ISSUER,
    }) as Record<string, unknown>;
    // Shape-check the decoded payload. A token that decodes but is missing
    // required fields means the signer has drifted; reject as invalid.
    if (
      typeof decoded.runId !== 'string' ||
      typeof decoded.project !== 'string' ||
      typeof decoded.exe !== 'string' ||
      !Array.isArray(decoded.args) ||
      typeof decoded.cwd !== 'string'
    ) {
      return { ok: false, reason: 'invalid' };
    }
    const payload: PtyTokenPayload = {
      runId: decoded.runId,
      project: decoded.project,
      exe: decoded.exe,
      args: decoded.args.map((a) => String(a)),
      cwd: decoded.cwd,
      cols: typeof decoded.cols === 'number' ? decoded.cols : undefined,
      rows: typeof decoded.rows === 'number' ? decoded.rows : undefined,
    };
    return { ok: true, payload };
  } catch (err) {
    // jwt throws TokenExpiredError vs JsonWebTokenError. Distinguishing
    // lets the client surface "session expired -- please retry" vs the
    // more alarming "invalid token".
    const name = (err as { name?: string })?.name;
    if (name === 'TokenExpiredError') {
      return { ok: false, reason: 'expired' };
    }
    return { ok: false, reason: 'invalid' };
  }
}
