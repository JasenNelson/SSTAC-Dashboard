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

  it('returns false when launch is disabled, even with secret set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AGENTIC_OS_LOCAL', '');
    vi.stubEnv('AGENTIC_OS_PTY_SECRET', 'some-secret');
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

  it('returns true in dev when secret is set AND node-pty loads', () => {
    // node-pty is installed in the workspace; the probe should succeed.
    // If this test ever fails, it's a signal that node-pty has regressed
    // on this platform -- not a test bug.
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AGENTIC_OS_PTY_SECRET', 'test-secret');
    expect(isAgenticOsPtyEnabled()).toBe(true);
  });

  it('CRITICAL: returns false in production even when NEXT_PUBLIC_AGENTIC_OS_ENABLED=true and secret is set', () => {
    // Reinforces the layered-gate invariant: NEXT_PUBLIC_* never crosses
    // into spawn-class behaviors. AGENTIC_OS_LOCAL is the only escape.
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_AGENTIC_OS_ENABLED', 'true');
    vi.stubEnv('AGENTIC_OS_LOCAL', '');
    vi.stubEnv('AGENTIC_OS_PTY_SECRET', 'test-secret');
    expect(isAgenticOsPtyEnabled()).toBe(false);
  });

  it('returns true in production when AGENTIC_OS_LOCAL=true AND secret is set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AGENTIC_OS_LOCAL', 'true');
    vi.stubEnv('AGENTIC_OS_PTY_SECRET', 'test-secret');
    expect(isAgenticOsPtyEnabled()).toBe(true);
  });
});
