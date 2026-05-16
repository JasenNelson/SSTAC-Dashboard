import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  isAgenticOsEnabled,
  isAgenticOsLaunchEnabled,
} from '../feature-flag';
import {
  isAgenticOsPtyEnabled,
  __resetPtyModuleProbeForTest,
} from '../feature-flag-server';

// vi.stubEnv mutates process.env in a vitest-managed way that survives
// TypeScript's `readonly NODE_ENV` declaration. unstubAllEnvs in afterEach
// restores the previous values so suites do not leak env state.

beforeEach(() => {
  // Start each case from cleared state for the three env vars these helpers
  // read. vi.stubEnv handles the readonly NODE_ENV declaration cleanly.
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isAgenticOsEnabled (page-render gate)', () => {
  it('returns true in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_AGENTIC_OS_ENABLED', '');
    expect(isAgenticOsEnabled()).toBe(true);
  });

  it('returns true in production when NEXT_PUBLIC_AGENTIC_OS_ENABLED=true', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_AGENTIC_OS_ENABLED', 'true');
    expect(isAgenticOsEnabled()).toBe(true);
  });

  it('returns false in production by default', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_AGENTIC_OS_ENABLED', '');
    expect(isAgenticOsEnabled()).toBe(false);
  });
});

describe('isAgenticOsLaunchEnabled (stricter spawn gate)', () => {
  it('returns true in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AGENTIC_OS_LOCAL', '');
    expect(isAgenticOsLaunchEnabled()).toBe(true);
  });

  it('returns true in production when AGENTIC_OS_LOCAL=true', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AGENTIC_OS_LOCAL', 'true');
    expect(isAgenticOsLaunchEnabled()).toBe(true);
  });

  it('returns false in production by default', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AGENTIC_OS_LOCAL', '');
    vi.stubEnv('NEXT_PUBLIC_AGENTIC_OS_ENABLED', '');
    expect(isAgenticOsLaunchEnabled()).toBe(false);
  });

  it('CRITICAL: returns false in production even when NEXT_PUBLIC_AGENTIC_OS_ENABLED=true', () => {
    // This is the load-bearing invariant: a Vercel deploy that flips the
    // public flag (to enable the read-only page) must NOT incidentally
    // enable spawning. AGENTIC_OS_LOCAL is the only escape hatch.
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_AGENTIC_OS_ENABLED', 'true');
    vi.stubEnv('AGENTIC_OS_LOCAL', '');
    expect(isAgenticOsLaunchEnabled()).toBe(false);
  });

  it('returns false in production when AGENTIC_OS_LOCAL is set to any string other than the exact "true"', () => {
    vi.stubEnv('NODE_ENV', 'production');
    for (const val of ['TRUE', 'True', '1', 'yes', 'on', '']) {
      vi.stubEnv('AGENTIC_OS_LOCAL', val);
      expect(isAgenticOsLaunchEnabled()).toBe(false);
    }
  });

  it('the two helpers are independent (public flag does not enable launch)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_AGENTIC_OS_ENABLED', 'true');
    vi.stubEnv('AGENTIC_OS_LOCAL', '');
    expect(isAgenticOsEnabled()).toBe(true);
    expect(isAgenticOsLaunchEnabled()).toBe(false);
  });
});

describe('isAgenticOsPtyEnabled (Pattern E / embedded terminal modal gate)', () => {
  beforeEach(() => {
    __resetPtyModuleProbeForTest();
  });

  // Min-strength secret per codex 2026-05-16 P2-5 hardening. 32+ chars
  // (a 64-hex value mirrors `openssl rand -hex 32`). Tests that USED to
  // pass with weak strings like 'test-secret' now require this.
  const STRONG_SECRET = 'a'.repeat(64);

  it('returns false when launch is disabled, even with strong secret set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AGENTIC_OS_LOCAL', '');
    vi.stubEnv('AGENTIC_OS_PTY_SECRET', STRONG_SECRET);
    expect(isAgenticOsPtyEnabled()).toBe(false);
  });

  it('returns false in dev when secret is unset', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AGENTIC_OS_PTY_SECRET', '');
    expect(isAgenticOsPtyEnabled()).toBe(false);
  });

  it('returns false in dev when secret is the empty string', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AGENTIC_OS_PTY_SECRET', '');
    expect(isAgenticOsPtyEnabled()).toBe(false);
  });

  it('returns false in dev when secret is shorter than MIN_PTY_SECRET_LENGTH (codex P2-5)', () => {
    // Weak-secret guard. Anything under 32 chars must be rejected so
    // HS256 token forging stays infeasible on a localhost-shared
    // machine. The PTY sidecar refuses to start on the same condition.
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AGENTIC_OS_PTY_SECRET', 'a'.repeat(31));
    expect(isAgenticOsPtyEnabled()).toBe(false);
  });

  it('returns true in dev when secret is set with sufficient length AND node-pty loads', () => {
    // node-pty is installed in the workspace; the probe should succeed.
    // If this test ever fails, it's a signal that node-pty has regressed
    // on this platform -- not a test bug.
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AGENTIC_OS_PTY_SECRET', STRONG_SECRET);
    expect(isAgenticOsPtyEnabled()).toBe(true);
  });

  it('returns true in dev at the exact MIN_PTY_SECRET_LENGTH boundary', () => {
    // Boundary test: exactly 32 chars is acceptable (the `<` check is
    // strict-less-than, not less-than-or-equal).
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AGENTIC_OS_PTY_SECRET', 'a'.repeat(32));
    expect(isAgenticOsPtyEnabled()).toBe(true);
  });

  it('CRITICAL: returns false in production even when NEXT_PUBLIC_AGENTIC_OS_ENABLED=true and strong secret is set', () => {
    // Reinforces the layered-gate invariant: NEXT_PUBLIC_* never crosses
    // into spawn-class behaviors. AGENTIC_OS_LOCAL is the only escape.
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_AGENTIC_OS_ENABLED', 'true');
    vi.stubEnv('AGENTIC_OS_LOCAL', '');
    vi.stubEnv('AGENTIC_OS_PTY_SECRET', STRONG_SECRET);
    expect(isAgenticOsPtyEnabled()).toBe(false);
  });

  it('returns true in production when AGENTIC_OS_LOCAL=true AND strong secret is set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AGENTIC_OS_LOCAL', 'true');
    vi.stubEnv('AGENTIC_OS_PTY_SECRET', STRONG_SECRET);
    expect(isAgenticOsPtyEnabled()).toBe(true);
  });
});
