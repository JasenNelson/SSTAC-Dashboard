import { describe, it, expect } from 'vitest';

import { LaunchRequestSchema, PtyTokenRequestSchema } from '../launch-schemas';

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

  // ---- Step 8 (Pattern C) skillSlug acceptance / rejection. ---------------

  it('accepts an optional skillSlug matching SKILL_SLUG_PATTERN', () => {
    const result = LaunchRequestSchema.safeParse({
      project: 'SSTAC-Dashboard',
      action: 'run_skill',
      skillSlug: 'doc-navigator',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skillSlug).toBe('doc-navigator');
    }
  });

  it('rejects a skillSlug that violates the slug pattern', () => {
    const hostile = [
      '../etc',
      'foo/bar',
      '.foo',
      '-foo',
      'foo bar',
      'foo;bar',
      '$(echo)',
      '`whoami`',
      'a'.repeat(42),
    ];
    for (const skillSlug of hostile) {
      const result = LaunchRequestSchema.safeParse({
        project: 'SSTAC-Dashboard',
        action: 'run_skill',
        skillSlug,
      });
      expect(result.success, `expected reject for slug "${skillSlug}"`).toBe(false);
    }
  });

  it('still accepts payloads without skillSlug (optional field)', () => {
    const result = LaunchRequestSchema.safeParse({
      project: 'SSTAC-Dashboard',
      action: 'run_safe_exit',
    });
    expect(result.success).toBe(true);
  });
});

describe('PtyTokenRequestSchema (step 9 / Pattern E)', () => {
  it('accepts a minimal open_embedded payload', () => {
    const result = PtyTokenRequestSchema.safeParse({
      project: 'SSTAC-Dashboard',
      action: 'open_embedded',
    });
    expect(result.success).toBe(true);
  });

  it('accepts cols/rows when within bounds', () => {
    const result = PtyTokenRequestSchema.safeParse({
      project: 'SSTAC-Dashboard',
      action: 'open_embedded',
      cols: 120,
      rows: 40,
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-open_embedded actions', () => {
    for (const action of ['run_safe_exit', 'open_session', 'run_skill', 'run_agent']) {
      const result = PtyTokenRequestSchema.safeParse({
        project: 'SSTAC-Dashboard',
        action,
      });
      expect(result.success, `expected reject for action "${action}"`).toBe(false);
    }
  });

  it('rejects cols/rows outside bounds', () => {
    expect(
      PtyTokenRequestSchema.safeParse({
        project: 'SSTAC-Dashboard',
        action: 'open_embedded',
        cols: 0,
        rows: 24,
      }).success,
    ).toBe(false);
    expect(
      PtyTokenRequestSchema.safeParse({
        project: 'SSTAC-Dashboard',
        action: 'open_embedded',
        cols: 80,
        rows: 100000,
      }).success,
    ).toBe(false);
    expect(
      PtyTokenRequestSchema.safeParse({
        project: 'SSTAC-Dashboard',
        action: 'open_embedded',
        cols: -1,
        rows: 24,
      }).success,
    ).toBe(false);
  });

  it('rejects extra unknown keys (strict)', () => {
    const result = PtyTokenRequestSchema.safeParse({
      project: 'SSTAC-Dashboard',
      action: 'open_embedded',
      smuggled: 'whoami',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing project', () => {
    expect(
      PtyTokenRequestSchema.safeParse({ action: 'open_embedded' }).success,
    ).toBe(false);
  });
});
