import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';

import {
  appendLaunchAudit,
  getLaunchAuditLog,
  __resetLaunchAuditLogForTest,
  __getAuditFileFailedForTest,
  __AUDIT_LOG_CAP_FOR_TEST,
  type AuditEntry,
} from '../launch-audit-log';

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    ts: '2026-05-15T00:00:00.000Z',
    user_email: 'admin@example.com',
    pid: 4242,
    exe: 'claude',
    args: ['-p', '/safe-exit'],
    cwd: 'C:\\Projects\\SSTAC-Dashboard',
    ...overrides,
  };
}

beforeEach(() => {
  __resetLaunchAuditLogForTest();
});

describe('launch-audit-log', () => {
  it('appends entries in order and returns them via getLaunchAuditLog', () => {
    appendLaunchAudit(makeEntry({ pid: 1 }));
    appendLaunchAudit(makeEntry({ pid: 2 }));
    appendLaunchAudit(makeEntry({ pid: 3 }));
    const log = getLaunchAuditLog();
    expect(log.map((e) => e.pid)).toEqual([1, 2, 3]);
  });

  it('returns a defensive copy (caller mutation does not affect the store)', () => {
    appendLaunchAudit(makeEntry({ pid: 1 }));
    const snap = getLaunchAuditLog() as AuditEntry[];
    snap.push(makeEntry({ pid: 999 }));
    const after = getLaunchAuditLog();
    expect(after.map((e) => e.pid)).toEqual([1]);
  });

  it('caps the log at AUDIT_LOG_CAP entries, dropping the oldest', () => {
    const cap = __AUDIT_LOG_CAP_FOR_TEST;
    for (let i = 0; i < cap + 10; i++) {
      appendLaunchAudit(makeEntry({ pid: i }));
    }
    const log = getLaunchAuditLog();
    expect(log.length).toBe(cap);
    expect(log[0]!.pid).toBe(10); // first 10 dropped
    expect(log[log.length - 1]!.pid).toBe(cap + 9);
  });

  it('__resetLaunchAuditLogForTest clears the log', () => {
    appendLaunchAudit(makeEntry());
    expect(getLaunchAuditLog().length).toBe(1);
    __resetLaunchAuditLogForTest();
    expect(getLaunchAuditLog().length).toBe(0);
  });
});

// NIT-3: one-shot warn flag for persistent file-write failures.
// Previously every failed appendFileSync call emitted a console.warn -- on a
// disk-full or permission-denied dev box this flooded the terminal. The fix
// gates the warn behind a module-scope flag that is set on first failure and
// cleared on the next successful write.
describe('launch-audit-log — one-shot warn on persistent write failure (NIT-3)', () => {
  // Bare `let` typing -- vitest's vi.spyOn return type narrowing for
  // overloaded targets (console.warn) fights with ReturnType inference in
  // strict mode; we just rely on the inferred type from the assignment.
  let warnSpy: ReturnType<typeof vi.fn>;
  let appendSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetLaunchAuditLogForTest();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    appendSpy = vi.spyOn(fs, 'appendFileSync') as any;
  });

  afterEach(() => {
    warnSpy.mockRestore();
    appendSpy.mockRestore();
  });

  it('warns ONCE across many consecutive failures (not once per failed write)', () => {
    appendSpy.mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });

    for (let i = 0; i < 10; i++) {
      appendLaunchAudit(makeEntry({ pid: i }));
    }

    // 10 failed writes -> 1 warn only.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/append to logs\/agentic-os-launches\.log failed/);
    // Flag is sticky after persistent failure.
    expect(__getAuditFileFailedForTest()).toBe(true);
    // In-memory ring buffer is still fully populated regardless.
    expect(getLaunchAuditLog().length).toBe(10);
  });

  it('resets the one-shot flag on the next successful write and warns again on a fresh subsequent failure', () => {
    // First two appends fail -> 1 warn.
    appendSpy.mockImplementationOnce(() => {
      throw new Error('ENOSPC: no space left on device');
    });
    appendSpy.mockImplementationOnce(() => {
      throw new Error('ENOSPC: no space left on device');
    });
    // Third append succeeds (disk freed up).
    appendSpy.mockImplementationOnce(() => undefined);
    // Fourth append fails again with a NEW failure mode -> 1 new warn.
    appendSpy.mockImplementationOnce(() => {
      throw new Error('EACCES: permission denied');
    });
    // Fifth fails (still EACCES) -> NO additional warn (flag sticky again).
    appendSpy.mockImplementationOnce(() => {
      throw new Error('EACCES: permission denied');
    });

    appendLaunchAudit(makeEntry({ pid: 1 }));
    appendLaunchAudit(makeEntry({ pid: 2 }));
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(__getAuditFileFailedForTest()).toBe(true);

    appendLaunchAudit(makeEntry({ pid: 3 })); // success -> flag clears
    expect(__getAuditFileFailedForTest()).toBe(false);

    appendLaunchAudit(makeEntry({ pid: 4 })); // first new failure -> warn
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(__getAuditFileFailedForTest()).toBe(true);

    appendLaunchAudit(makeEntry({ pid: 5 })); // sticky -> no extra warn
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('successful writes alone never emit warnings (sanity)', () => {
    appendSpy.mockImplementation(() => undefined);
    for (let i = 0; i < 5; i++) {
      appendLaunchAudit(makeEntry({ pid: i }));
    }
    expect(warnSpy).not.toHaveBeenCalled();
    expect(__getAuditFileFailedForTest()).toBe(false);
  });
});
