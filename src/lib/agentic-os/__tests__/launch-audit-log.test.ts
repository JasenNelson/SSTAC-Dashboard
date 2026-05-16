import { describe, it, expect, beforeEach } from 'vitest';

import {
  appendLaunchAudit,
  getLaunchAuditLog,
  __resetLaunchAuditLogForTest,
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
