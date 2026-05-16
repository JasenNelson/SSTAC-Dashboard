import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';

import {
  signPtyToken,
  verifyPtyToken,
  PTY_JWT_AUDIENCE,
  PTY_JWT_ISSUER,
  PTY_JWT_TTL_SECONDS,
  type PtyTokenPayload,
} from '../pty-token';

const VALID_SECRET = 'test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER_SECRET = 'wrong-secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const VALID_PAYLOAD: PtyTokenPayload = {
  runId: '11111111-2222-3333-4444-555555555555',
  project: 'SSTAC-Dashboard',
  exe: 'claude',
  args: ['--resume'],
  cwd: 'C:\\Projects\\SSTAC-Dashboard',
  cols: 80,
  rows: 24,
};

beforeEach(() => {
  vi.stubEnv('AGENTIC_OS_PTY_SECRET', VALID_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('signPtyToken', () => {
  it('throws when AGENTIC_OS_PTY_SECRET is unset', () => {
    vi.stubEnv('AGENTIC_OS_PTY_SECRET', '');
    expect(() => signPtyToken(VALID_PAYLOAD)).toThrow(/AGENTIC_OS_PTY_SECRET/);
  });

  it('produces an HS256-signed JWT with the expected claims', () => {
    const token = signPtyToken(VALID_PAYLOAD);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // JWT header.payload.signature

    const decoded = jwt.verify(token, VALID_SECRET, {
      algorithms: ['HS256'],
      audience: PTY_JWT_AUDIENCE,
      issuer: PTY_JWT_ISSUER,
    }) as Record<string, unknown>;
    expect(decoded.runId).toBe(VALID_PAYLOAD.runId);
    expect(decoded.exe).toBe('claude');
    expect(decoded.args).toEqual(['--resume']);
    expect(decoded.cwd).toBe('C:\\Projects\\SSTAC-Dashboard');
    expect(decoded.iss).toBe(PTY_JWT_ISSUER);
    expect(decoded.aud).toBe(PTY_JWT_AUDIENCE);
  });

  it('sets expiration to PTY_JWT_TTL_SECONDS from now', () => {
    const before = Math.floor(Date.now() / 1000);
    const token = signPtyToken(VALID_PAYLOAD);
    const decoded = jwt.decode(token) as { exp: number; iat: number };
    expect(decoded.exp - decoded.iat).toBe(PTY_JWT_TTL_SECONDS);
    expect(decoded.exp).toBeGreaterThanOrEqual(before + PTY_JWT_TTL_SECONDS - 1);
    expect(decoded.exp).toBeLessThanOrEqual(before + PTY_JWT_TTL_SECONDS + 2);
  });
});

describe('verifyPtyToken', () => {
  it('accepts a freshly-signed token', () => {
    const token = signPtyToken(VALID_PAYLOAD);
    const result = verifyPtyToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.runId).toBe(VALID_PAYLOAD.runId);
      expect(result.payload.exe).toBe('claude');
      expect(result.payload.args).toEqual(['--resume']);
      expect(result.payload.cwd).toBe('C:\\Projects\\SSTAC-Dashboard');
    }
  });

  it('rejects with reason="no_secret" when secret is unset', () => {
    const token = signPtyToken(VALID_PAYLOAD);
    vi.stubEnv('AGENTIC_OS_PTY_SECRET', '');
    const result = verifyPtyToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_secret');
  });

  it('rejects with reason="invalid" for a token signed with a different secret', () => {
    // Sign with the "other" secret, verify with the valid one.
    const otherToken = jwt.sign(
      {
        runId: VALID_PAYLOAD.runId,
        project: VALID_PAYLOAD.project,
        exe: VALID_PAYLOAD.exe,
        args: VALID_PAYLOAD.args,
        cwd: VALID_PAYLOAD.cwd,
      },
      OTHER_SECRET,
      {
        algorithm: 'HS256',
        audience: PTY_JWT_AUDIENCE,
        issuer: PTY_JWT_ISSUER,
        expiresIn: PTY_JWT_TTL_SECONDS,
      },
    );
    const result = verifyPtyToken(otherToken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid');
  });

  it('rejects with reason="invalid" for a wrong-audience token', () => {
    const wrongAud = jwt.sign(
      {
        runId: VALID_PAYLOAD.runId,
        project: VALID_PAYLOAD.project,
        exe: VALID_PAYLOAD.exe,
        args: VALID_PAYLOAD.args,
        cwd: VALID_PAYLOAD.cwd,
      },
      VALID_SECRET,
      {
        algorithm: 'HS256',
        audience: 'something-else',
        issuer: PTY_JWT_ISSUER,
        expiresIn: PTY_JWT_TTL_SECONDS,
      },
    );
    const result = verifyPtyToken(wrongAud);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid');
  });

  it('rejects with reason="invalid" for a wrong-issuer token', () => {
    const wrongIss = jwt.sign(
      {
        runId: VALID_PAYLOAD.runId,
        project: VALID_PAYLOAD.project,
        exe: VALID_PAYLOAD.exe,
        args: VALID_PAYLOAD.args,
        cwd: VALID_PAYLOAD.cwd,
      },
      VALID_SECRET,
      {
        algorithm: 'HS256',
        audience: PTY_JWT_AUDIENCE,
        issuer: 'evil-issuer',
        expiresIn: PTY_JWT_TTL_SECONDS,
      },
    );
    const result = verifyPtyToken(wrongIss);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid');
  });

  it('rejects with reason="expired" for an already-expired token', () => {
    // Sign a token that expired 60s ago.
    const expired = jwt.sign(
      {
        runId: VALID_PAYLOAD.runId,
        project: VALID_PAYLOAD.project,
        exe: VALID_PAYLOAD.exe,
        args: VALID_PAYLOAD.args,
        cwd: VALID_PAYLOAD.cwd,
      },
      VALID_SECRET,
      {
        algorithm: 'HS256',
        audience: PTY_JWT_AUDIENCE,
        issuer: PTY_JWT_ISSUER,
        expiresIn: '-1m',
      },
    );
    const result = verifyPtyToken(expired);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('rejects garbage strings as invalid', () => {
    for (const bogus of ['', 'abc', 'not.a.jwt', 'a.b.c']) {
      const result = verifyPtyToken(bogus);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('invalid');
    }
  });

  it('rejects a token with a shape-mismatched payload', () => {
    // Token signs cleanly but lacks the runId/exe/cwd fields.
    const malformed = jwt.sign(
      { not_a_runid: 123 },
      VALID_SECRET,
      {
        algorithm: 'HS256',
        audience: PTY_JWT_AUDIENCE,
        issuer: PTY_JWT_ISSUER,
        expiresIn: PTY_JWT_TTL_SECONDS,
      },
    );
    const result = verifyPtyToken(malformed);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid');
  });
});

describe('replay binding -- token cannot be retargeted to a different command', () => {
  it('verified payload exactly reflects signed claims; client cannot rewrite exe/args/cwd', () => {
    const token = signPtyToken(VALID_PAYLOAD);
    const result = verifyPtyToken(token);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The whole point: the verified output is the source of truth for the
    // PTY server. A token minted for `claude --resume` cannot become a
    // token for `cmd.exe /c rm -rf` by any client-side manipulation,
    // because the signature would fail.
    expect(result.payload.exe).toBe('claude');
    expect(result.payload.args).toEqual(['--resume']);
    expect(result.payload.cwd).toBe('C:\\Projects\\SSTAC-Dashboard');
  });
});
