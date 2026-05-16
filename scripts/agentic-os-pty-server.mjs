#!/usr/bin/env node
// Agentic OS PTY sidecar server (step 9 / Pattern E).
//
// Runs alongside `next dev` on a local dev machine. Accepts WebSocket
// connections at ws://localhost:3101/pty?token=<jwt>. The token is a
// short-lived JWT minted by /api/agentic-os/pty-token; it binds a specific
// {exe, args, cwd, runId} triple that this server spawns via node-pty.
//
// Security model (in order of enforcement at handshake time):
//   1. Origin header MUST be http://localhost:* or http://127.0.0.1:*.
//      Block all other origins (incl. empty, file://, external hosts).
//   2. JWT MUST verify with HS256 against AGENTIC_OS_PTY_SECRET, with the
//      issuer/audience claims this server expects, AND not be expired.
//   3. The payload's {exe, args, cwd} are the EXCLUSIVE source of the
//      spawned command. The client's WS messages are stdin only; resize
//      messages are JSON {cols, rows} -- never `command` overrides.
//   4. WS close => pty.kill('SIGHUP'). pty.onExit => ws.close(1000).
//   5. Heartbeat ping every 20s; terminate dead connections.
//
// Production: this script is NOT bundled by Next.js and not deployed to
// Vercel. It runs only as part of `npm run dev` (concurrently). If
// AGENTIC_OS_PTY_SECRET is unset the server logs an error and exits with
// status 1 -- never starts listening on a secretless port.
//
// File extension is .mjs to make this a pure Node ESM module (no
// TypeScript transpilation, no Next.js bundling). The token-verification
// logic is duplicated rather than imported from src/lib so this script
// can run before any TS build step.

import http from 'node:http';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import pty from 'node-pty';

const PTY_JWT_AUDIENCE = 'agentic-os.pty';
const PTY_JWT_ISSUER = 'agentic-os.dashboard';
const DEFAULT_PORT = 3101;
const HEARTBEAT_INTERVAL_MS = 20_000;
const MAX_INBOUND_MESSAGE_BYTES = 64 * 1024; // 64 KiB; way more than any keystroke burst

// PTY secret must be at least 32 chars (codex 2026-05-16 P2-5 hardening).
// The .env.example points users at `openssl rand -hex 32` which produces 64
// hex chars; a typed-in or accidentally-short secret would let any
// localhost process forge HS256 tokens against a guessable secret. Refuse
// to start under any non-empty-but-weak value so the failure is loud at
// dev-server start rather than silent at the first PTY handshake.
const MIN_SECRET_LENGTH = 32;
const SECRET = process.env.AGENTIC_OS_PTY_SECRET;
if (typeof SECRET !== 'string' || SECRET.length === 0) {
  // Refuse to start. A secretless server would either reject every handshake
  // (best case) or, if any caller in the dev environment generated tokens
  // with a different secret, accept tokens that the dashboard never minted.
  console.error(
    '[agentic-os pty-server] AGENTIC_OS_PTY_SECRET is not set. ' +
      'Generate one (openssl rand -hex 32) and put it in .env.local. ' +
      'Refusing to start.',
  );
  process.exit(1);
}
if (SECRET.length < MIN_SECRET_LENGTH) {
  console.error(
    `[agentic-os pty-server] AGENTIC_OS_PTY_SECRET is only ${SECRET.length} ` +
      `chars; minimum is ${MIN_SECRET_LENGTH} chars to keep HS256 token ` +
      'forging infeasible on a localhost-shared machine. Generate a stronger ' +
      'secret (openssl rand -hex 32 -> 64 hex chars) and put it in .env.local. ' +
      'Refusing to start.',
  );
  process.exit(1);
}

const PORT = (() => {
  const raw = process.env.AGENTIC_OS_PTY_PORT;
  if (typeof raw === 'string' && /^[0-9]+$/.test(raw)) {
    const n = Number(raw);
    if (n > 0 && n < 65536) return n;
  }
  return DEFAULT_PORT;
})();

// Per-process registry of live PTYs. Allows graceful shutdown to kill them
// all instead of leaving orphaned shells if the dev server restarts.
const activePtys = new Set();

function logInfo(...args) {
  console.log('[agentic-os pty-server]', ...args);
}
function logWarn(...args) {
  console.warn('[agentic-os pty-server]', ...args);
}

function isLocalhostOrigin(origin) {
  if (typeof origin !== 'string' || origin.length === 0) return false;
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

function verifyToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    return { ok: false, reason: 'invalid' };
  }
  try {
    const decoded = jwt.verify(token, SECRET, {
      algorithms: ['HS256'],
      audience: PTY_JWT_AUDIENCE,
      issuer: PTY_JWT_ISSUER,
    });
    if (
      !decoded ||
      typeof decoded !== 'object' ||
      typeof decoded.runId !== 'string' ||
      typeof decoded.project !== 'string' ||
      typeof decoded.exe !== 'string' ||
      !Array.isArray(decoded.args) ||
      typeof decoded.cwd !== 'string'
    ) {
      return { ok: false, reason: 'invalid' };
    }
    return {
      ok: true,
      payload: {
        runId: decoded.runId,
        project: decoded.project,
        exe: decoded.exe,
        args: decoded.args.map((a) => String(a)),
        cwd: decoded.cwd,
        cols: typeof decoded.cols === 'number' ? decoded.cols : 80,
        rows: typeof decoded.rows === 'number' ? decoded.rows : 24,
      },
    };
  } catch (err) {
    if (err && err.name === 'TokenExpiredError') {
      return { ok: false, reason: 'expired' };
    }
    return { ok: false, reason: 'invalid' };
  }
}

// Minimal HTTP server so we can issue tailored close codes during the
// upgrade. `ws` exposes verifyClient but a manual upgrade gives us cleaner
// control over WS close codes per failure mode.
const httpServer = http.createServer((req, res) => {
  // The HTTP path is only used for /health (dev-tooling convenience).
  // Everything else returns 404. The WS upgrade is handled in `upgrade`.
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, activePtys: activePtys.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (request, socket, head) => {
  // Defensive: drop any upgrade that isn't /pty.
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname !== '/pty') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }
  // Origin check BEFORE token check. A non-localhost origin gets a generic
  // 403 -- no token shape leaked to the attacker.
  const origin = request.headers.origin ?? '';
  if (!isLocalhostOrigin(origin)) {
    logWarn('upgrade rejected: non-localhost origin', origin || '(empty)');
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  const token = url.searchParams.get('token') ?? '';
  const verdict = verifyToken(token);
  if (!verdict.ok) {
    logWarn('upgrade rejected: token', verdict.reason);
    // 401 -- caller should re-mint, not retry blindly.
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  // Hand off to ws. We attach the verified payload so the connection
  // handler doesn't have to re-verify.
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request, verdict.payload);
  });
});

wss.on('connection', (ws, _request, payload) => {
  // Spawn the PTY using the EXACT command the token says, never anything
  // the client sent over WS. The client cannot influence exe/args/cwd.
  let ptyProcess;
  try {
    ptyProcess = pty.spawn(payload.exe, payload.args, {
      name: 'xterm-color',
      cols: payload.cols,
      rows: payload.rows,
      cwd: payload.cwd,
      env: { ...process.env },
    });
  } catch (err) {
    logWarn(
      `pty spawn failed for runId=${payload.runId}:`,
      err instanceof Error ? err.message : String(err),
    );
    try {
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'pty_spawn_failed',
          detail: err instanceof Error ? err.message : String(err),
        }),
      );
    } catch {
      // ignore
    }
    try {
      ws.close(1011, 'pty_spawn_failed');
    } catch {
      // ignore
    }
    return;
  }

  activePtys.add(ptyProcess);
  logInfo(
    `pty connected: runId=${payload.runId} project=${payload.project} pid=${ptyProcess.pid}`,
  );
  // Surface the pid to the client for the modal footer.
  try {
    ws.send(JSON.stringify({ type: 'ready', pid: ptyProcess.pid, runId: payload.runId }));
  } catch {
    // ignore
  }

  // Stream PTY output to the WS as BINARY frames (codex 2026-05-16 P2-3
  // fix). node-pty's onData emits strings; we wrap into a Buffer so the
  // ws library sends a binary frame. This disambiguates PTY output from
  // the JSON control envelopes ({type:'ready'|'exit'|'error'}) which
  // remain as text frames -- otherwise any PTY output that happened to
  // start with `{` and parse as JSON-with-known-type would be silently
  // swallowed (or mis-interpreted as session-end) by the modal's
  // text-frame JSON-control parser. The modal already handles binary
  // frames via its ArrayBuffer branch (ws.binaryType='arraybuffer').
  const onDataDisposable = ptyProcess.onData((data) => {
    try {
      ws.send(Buffer.from(data, 'utf-8'));
    } catch {
      // ws closed mid-write; ignore
    }
  });

  let exited = false;
  const onExitDisposable = ptyProcess.onExit(({ exitCode, signal }) => {
    exited = true;
    try {
      ws.send(
        JSON.stringify({
          type: 'exit',
          exitCode: typeof exitCode === 'number' ? exitCode : null,
          signal: typeof signal === 'number' ? signal : null,
        }),
      );
    } catch {
      // ignore
    }
    try {
      ws.close(1000, 'pty_exited');
    } catch {
      // ignore
    }
    activePtys.delete(ptyProcess);
  });

  // Client messages: either raw keystroke text (binary or string) OR a
  // small JSON envelope {type: 'resize'|'input', ...}. We accept both
  // shapes for robustness. Anything larger than MAX_INBOUND_MESSAGE_BYTES
  // is dropped -- prevents a hostile client from blowing up memory.
  ws.on('message', (raw, isBinary) => {
    if (exited) return;
    const buf = raw;
    if (buf.length > MAX_INBOUND_MESSAGE_BYTES) {
      logWarn(`oversize message dropped (${buf.length} bytes) for runId=${payload.runId}`);
      return;
    }
    // Try to parse as JSON control envelope; on failure treat as raw input.
    if (!isBinary) {
      const text = buf.toString('utf-8');
      // Quick check: only attempt JSON parse if it looks like an object.
      if (text.length > 0 && text[0] === '{') {
        try {
          const obj = JSON.parse(text);
          if (obj && typeof obj === 'object') {
            if (obj.type === 'resize') {
              const cols = Number(obj.cols);
              const rows = Number(obj.rows);
              if (
                Number.isFinite(cols) && cols > 0 && cols <= 1000 &&
                Number.isFinite(rows) && rows > 0 && rows <= 1000
              ) {
                try {
                  ptyProcess.resize(Math.floor(cols), Math.floor(rows));
                } catch {
                  // ignore -- resize is best-effort
                }
              }
              return;
            }
            if (obj.type === 'input' && typeof obj.data === 'string') {
              ptyProcess.write(obj.data);
              return;
            }
            // Unknown envelope -- fall through to raw write.
          }
        } catch {
          // not JSON -- fall through
        }
      }
      ptyProcess.write(text);
      return;
    }
    // Binary frame -- pass straight through as input bytes.
    ptyProcess.write(buf.toString('utf-8'));
  });

  // Heartbeat to detect dead connections.
  let alive = true;
  ws.on('pong', () => { alive = true; });
  const heartbeat = setInterval(() => {
    if (!alive) {
      try { ws.terminate(); } catch { /* ignore */ }
      return;
    }
    alive = false;
    try { ws.ping(); } catch { /* ignore */ }
  }, HEARTBEAT_INTERVAL_MS);

  const cleanup = () => {
    clearInterval(heartbeat);
    try { onDataDisposable.dispose(); } catch { /* ignore */ }
    try { onExitDisposable.dispose(); } catch { /* ignore */ }
    if (!exited) {
      try {
        ptyProcess.kill('SIGHUP');
      } catch {
        // Process may already be gone -- ignore.
      }
    }
    activePtys.delete(ptyProcess);
    logInfo(`pty disconnected: runId=${payload.runId} pid=${ptyProcess.pid}`);
  };

  ws.on('close', cleanup);
  ws.on('error', (err) => {
    logWarn(`ws error for runId=${payload.runId}:`, err?.message ?? String(err));
    cleanup();
  });
});

httpServer.listen(PORT, '127.0.0.1', () => {
  logInfo(`listening on ws://127.0.0.1:${PORT}/pty (origin-restricted to localhost)`);
});

// Graceful shutdown: kill every active PTY so they don't outlive the
// dev-server restart cycle.
function shutdown(signal) {
  logInfo(`received ${signal}; killing ${activePtys.size} active PTY(s) and exiting`);
  for (const p of activePtys) {
    try {
      p.kill('SIGHUP');
    } catch {
      // ignore
    }
  }
  activePtys.clear();
  httpServer.close(() => process.exit(0));
  // Hard exit after 2s if a hanging child blocks the server close.
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
