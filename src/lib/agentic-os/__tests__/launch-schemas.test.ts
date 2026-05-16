import { describe, it, expect } from 'vitest';

import { LaunchRequestSchema } from '../launch-schemas';

describe('LaunchRequestSchema', () => {
  it('accepts a valid {project, action} payload', () => {
    const result = LaunchRequestSchema.safeParse({
      project: 'SSTAC-Dashboard',
      action: 'run_safe_exit',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        project: 'SSTAC-Dashboard',
        action: 'run_safe_exit',
      });
    }
  });

  it('rejects empty project', () => {
    expect(
      LaunchRequestSchema.safeParse({ project: '', action: 'run_safe_exit' })
        .success,
    ).toBe(false);
  });

  it('rejects empty action', () => {
    expect(
      LaunchRequestSchema.safeParse({ project: 'SSTAC-Dashboard', action: '' })
        .success,
    ).toBe(false);
  });

  it('rejects project longer than 120 chars', () => {
    expect(
      LaunchRequestSchema.safeParse({
        project: 'a'.repeat(121),
        action: 'run_safe_exit',
      }).success,
    ).toBe(false);
  });

  it('rejects action longer than 60 chars', () => {
    expect(
      LaunchRequestSchema.safeParse({
        project: 'SSTAC-Dashboard',
        action: 'a'.repeat(61),
      }).success,
    ).toBe(false);
  });

  it('rejects missing project', () => {
    expect(
      LaunchRequestSchema.safeParse({ action: 'run_safe_exit' }).success,
    ).toBe(false);
  });

  it('rejects missing action', () => {
    expect(
      LaunchRequestSchema.safeParse({ project: 'SSTAC-Dashboard' }).success,
    ).toBe(false);
  });

  it('rejects non-string project (numeric)', () => {
    expect(
      LaunchRequestSchema.safeParse({ project: 42, action: 'run_safe_exit' })
        .success,
    ).toBe(false);
  });

  it('rejects unknown extra keys (strict mode)', () => {
    // Strict rejection is the load-bearing invariant -- a sloppy client
    // cannot smuggle extra fields past the schema.
    const result = LaunchRequestSchema.safeParse({
      project: 'SSTAC-Dashboard',
      action: 'run_safe_exit',
      shellOverride: '/bin/sh',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-object payload', () => {
    expect(LaunchRequestSchema.safeParse('hello').success).toBe(false);
    expect(LaunchRequestSchema.safeParse(null).success).toBe(false);
    expect(LaunchRequestSchema.safeParse([]).success).toBe(false);
  });
});
