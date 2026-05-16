import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';

import {
  registerRun,
  getRun,
  listRuns,
  toSerializable,
  subscribe,
  __resetRunsForTest,
  __BUFFER_CAP_FOR_TEST,
  type LogLine,
} from '../launch-runs';

// Build a fake ChildProcess that exposes stdout / stderr EventEmitters plus
// emit-on-close. Mirrors the engine-v2 spawn-mock pattern from git-activity.test.ts.
function makeFakeChild(pid = 4242) {
  const proc = new EventEmitter() as EventEmitter & {
    pid: number;
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  proc.pid = pid;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  return proc as unknown as ChildProcess;
}

beforeEach(() => {
  __resetRunsForTest();
});

describe('launch-runs', () => {
  it('registerRun adds the run to the map and getRun retrieves it', () => {
    const child = makeFakeChild();
    const state = registerRun({
      runId: 'r1',
      project: 'SSTAC-Dashboard',
      action: 'run_safe_exit',
      command: { exe: 'claude', args: ['-p', '/safe-exit'], cwd: 'C:\\Projects\\SSTAC-Dashboard' },
      child,
    });
    expect(state.runId).toBe('r1');
    expect(state.status).toBe('running');
    expect(state.exitCode).toBeNull();
    const retrieved = getRun('r1');
    expect(retrieved).toBe(state);
  });

  it('captures stdout lines into the buffer and notifies subscribers', () => {
    const child = makeFakeChild();
    registerRun({
      runId: 'r2',
      project: 'p',
      action: 'run_safe_exit',
      command: { exe: 'claude', args: [], cwd: 'C:\\x' },
      child,
    });
    const received: LogLine[] = [];
    const unsubscribe = subscribe('r2', (line) => received.push(line), () => {});
    (child.stdout as EventEmitter).emit('data', Buffer.from('hello\nworld\n', 'utf-8'));
    const state = getRun('r2')!;
    expect(state.stdoutBuffer.length).toBe(2);
    expect(state.stdoutBuffer[0].text).toBe('hello');
    expect(state.stdoutBuffer[1].text).toBe('world');
    expect(received.map((l) => l.text)).toEqual(['hello', 'world']);
    unsubscribe();
  });

  it('handles partial lines across multiple data events', () => {
    const child = makeFakeChild();
    registerRun({
      runId: 'r3',
      project: 'p',
      action: 'run_safe_exit',
      command: { exe: 'claude', args: [], cwd: 'C:\\x' },
      child,
    });
    (child.stdout as EventEmitter).emit('data', Buffer.from('part', 'utf-8'));
    (child.stdout as EventEmitter).emit('data', Buffer.from('ial\nnext', 'utf-8'));
    const state = getRun('r3')!;
    expect(state.stdoutBuffer.length).toBe(1);
    expect(state.stdoutBuffer[0].text).toBe('partial');
    // Flush residual on close.
    child.emit('close', 0);
    expect(state.stdoutBuffer.length).toBe(2);
    expect(state.stdoutBuffer[1].text).toBe('next');
    expect(state.status).toBe('completed');
  });

  it('strips CRLF when splitting lines', () => {
    const child = makeFakeChild();
    registerRun({
      runId: 'r4',
      project: 'p',
      action: 'run_safe_exit',
      command: { exe: 'claude', args: [], cwd: 'C:\\x' },
      child,
    });
    (child.stdout as EventEmitter).emit('data', Buffer.from('line1\r\nline2\r\n', 'utf-8'));
    const state = getRun('r4')!;
    expect(state.stdoutBuffer.map((l) => l.text)).toEqual(['line1', 'line2']);
  });

  it('caps each buffer at BUFFER_CAP and sets truncated flag', () => {
    const child = makeFakeChild();
    registerRun({
      runId: 'r5',
      project: 'p',
      action: 'run_safe_exit',
      command: { exe: 'claude', args: [], cwd: 'C:\\x' },
      child,
    });
    const cap = __BUFFER_CAP_FOR_TEST;
    // Emit cap + 10 lines individually so the splitter sees newline-terminated input.
    const chunk = Array.from({ length: cap + 10 }, (_, i) => `line${i}`).join('\n') + '\n';
    (child.stdout as EventEmitter).emit('data', Buffer.from(chunk, 'utf-8'));
    const state = getRun('r5')!;
    expect(state.stdoutBuffer.length).toBe(cap);
    expect(state.truncated).toBe(true);
    // Oldest 10 were dropped.
    expect(state.stdoutBuffer[0].text).toBe('line10');
    expect(state.stdoutBuffer[state.stdoutBuffer.length - 1].text).toBe(`line${cap + 9}`);
  });

  it('close handler sets exit fields, status, and notifies exit subscribers', () => {
    const child = makeFakeChild();
    registerRun({
      runId: 'r6',
      project: 'p',
      action: 'run_safe_exit',
      command: { exe: 'claude', args: [], cwd: 'C:\\x' },
      child,
    });
    let exitInfo: { exitCode: number | null; exitedAt: string } | null = null;
    subscribe('r6', () => {}, (info) => { exitInfo = info; });
    child.emit('close', 0);
    const state = getRun('r6')!;
    expect(state.status).toBe('completed');
    expect(state.exitCode).toBe(0);
    expect(state.exitedAt).not.toBeNull();
    expect(exitInfo).not.toBeNull();
    expect(exitInfo!.exitCode).toBe(0);

    // Non-zero -> failed.
    const child2 = makeFakeChild(4243);
    registerRun({
      runId: 'r6b',
      project: 'p',
      action: 'run_safe_exit',
      command: { exe: 'claude', args: [], cwd: 'C:\\x' },
      child: child2,
    });
    child2.emit('close', 1);
    expect(getRun('r6b')!.status).toBe('failed');
    expect(getRun('r6b')!.exitCode).toBe(1);
  });

  it('toSerializable omits the child handle', () => {
    const child = makeFakeChild();
    const state = registerRun({
      runId: 'r7',
      project: 'p',
      action: 'run_safe_exit',
      command: { exe: 'claude', args: [], cwd: 'C:\\x' },
      child,
    });
    const ser = toSerializable(state);
    // 'child' must not leak.
    expect(Object.prototype.hasOwnProperty.call(ser, 'child')).toBe(false);
    // Must round-trip through JSON without losing data or throwing.
    const json = JSON.stringify(ser);
    expect(json).toContain('"runId":"r7"');
  });

  it('subscribe returns an unsubscribe that stops further notifications', () => {
    const child = makeFakeChild();
    registerRun({
      runId: 'r8',
      project: 'p',
      action: 'run_safe_exit',
      command: { exe: 'claude', args: [], cwd: 'C:\\x' },
      child,
    });
    const received: string[] = [];
    const unsub = subscribe('r8', (l) => received.push(l.text), () => {});
    (child.stdout as EventEmitter).emit('data', Buffer.from('a\n', 'utf-8'));
    expect(received).toEqual(['a']);
    unsub();
    (child.stdout as EventEmitter).emit('data', Buffer.from('b\n', 'utf-8'));
    expect(received).toEqual(['a']); // unchanged after unsubscribe
  });

  it('subscribe on already-exited run fires onExit on a microtask', async () => {
    const child = makeFakeChild();
    registerRun({
      runId: 'r9',
      project: 'p',
      action: 'run_safe_exit',
      command: { exe: 'claude', args: [], cwd: 'C:\\x' },
      child,
    });
    child.emit('close', 0);
    const onExit = vi.fn();
    subscribe('r9', () => {}, onExit);
    // Microtask flush: await a resolved promise.
    await Promise.resolve();
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onExit.mock.calls[0][0].exitCode).toBe(0);
  });

  it('subscribe on unknown runId still resolves with synthetic exit on a microtask', async () => {
    const onExit = vi.fn();
    subscribe('nonexistent', () => {}, onExit);
    await Promise.resolve();
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onExit.mock.calls[0][0].exitCode).toBe(-1);
  });

  it('listRuns returns most-recent first', async () => {
    const c1 = makeFakeChild(1);
    registerRun({
      runId: 'a',
      project: 'p',
      action: 'run_safe_exit',
      command: { exe: 'claude', args: [], cwd: 'C:\\x' },
      child: c1,
      startedAt: '2026-05-15T00:00:00.000Z',
    });
    const c2 = makeFakeChild(2);
    registerRun({
      runId: 'b',
      project: 'p',
      action: 'run_safe_exit',
      command: { exe: 'claude', args: [], cwd: 'C:\\x' },
      child: c2,
      startedAt: '2026-05-15T00:01:00.000Z',
    });
    const arr = listRuns();
    expect(arr.map((r) => r.runId)).toEqual(['b', 'a']);
  });

  it('duplicate runId registration throws', () => {
    const c1 = makeFakeChild();
    registerRun({
      runId: 'dupe',
      project: 'p',
      action: 'run_safe_exit',
      command: { exe: 'claude', args: [], cwd: 'C:\\x' },
      child: c1,
    });
    expect(() =>
      registerRun({
        runId: 'dupe',
        project: 'p',
        action: 'run_safe_exit',
        command: { exe: 'claude', args: [], cwd: 'C:\\x' },
        child: c1,
      }),
    ).toThrow(/duplicate runId/);
  });

  it('subscriber callback exceptions do not break the producer', () => {
    const child = makeFakeChild();
    registerRun({
      runId: 'r-crash',
      project: 'p',
      action: 'run_safe_exit',
      command: { exe: 'claude', args: [], cwd: 'C:\\x' },
      child,
    });
    let goodReceived = 0;
    subscribe('r-crash', () => { throw new Error('crash'); }, () => {});
    subscribe('r-crash', () => { goodReceived++; }, () => {});
    (child.stdout as EventEmitter).emit('data', Buffer.from('hello\n', 'utf-8'));
    expect(goodReceived).toBe(1);
    expect(getRun('r-crash')!.stdoutBuffer.length).toBe(1);
  });
});
