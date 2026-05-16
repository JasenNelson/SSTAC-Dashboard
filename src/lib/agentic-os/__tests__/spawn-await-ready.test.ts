import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';

// Engine-v2 spawn-mock pattern (see git-activity.test.ts and
// spawn_extraction.test.ts). vi.mock must be hoisted; the module-scope mock
// fn is referenced inside the factory and survives hoisting.
const spawnMock = vi.fn();
vi.mock('child_process', async (importActual) => {
  const actual = await importActual<typeof import('child_process')>();
  const overlay = {
    ...actual,
    spawn: (...args: unknown[]) => spawnMock(...args),
  };
  return {
    ...overlay,
    default: overlay,
  };
});

import {
  spawnAwaitingReady,
  __SPAWN_RACE_WINDOW_MS_FOR_TEST,
  __STUB_CLOSE_DELAY_MS_FOR_TEST,
} from '../spawn-await-ready';

// Build a fake ChildProcess that emits 'spawn' / 'error' / neither on demand.
interface FakeChildOpts {
  // 'spawn'   -> emit 'spawn' on next microtask
  // 'error'   -> emit 'error' on next microtask with the provided Error
  // 'hang'    -> emit nothing; race must time out
  mode: 'spawn' | 'error' | 'hang';
  err?: Error;
  pid?: number;
}

function makeFakeChild(opts: FakeChildOpts) {
  const proc = new EventEmitter() as EventEmitter & {
    pid: number | undefined;
    removeListener: EventEmitter['removeListener'];
  };
  proc.pid = opts.pid ?? 12345;

  queueMicrotask(() => {
    if (opts.mode === 'spawn') {
      proc.emit('spawn');
    } else if (opts.mode === 'error') {
      proc.emit('error', opts.err ?? new Error('boom'));
    }
    // 'hang' -> emit nothing
  });

  return proc as unknown as ChildProcess;
}

beforeEach(() => {
  spawnMock.mockReset();
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('spawnAwaitingReady', () => {
  it('resolves with the child when the spawn event fires', async () => {
    const fake = makeFakeChild({ mode: 'spawn', pid: 4242 });
    spawnMock.mockReturnValueOnce(fake);

    const child = await spawnAwaitingReady('claude', ['-p', '/safe-exit'], {
      cwd: 'C:\\Projects\\SSTAC-Dashboard',
    });

    expect(child).toBe(fake);
    expect(child.pid).toBe(4242);
  });

  it('rejects with the error when the error event fires first', async () => {
    const enoent = new Error('spawn claude ENOENT');
    const fake = makeFakeChild({ mode: 'error', err: enoent });
    spawnMock.mockReturnValueOnce(fake);

    await expect(
      spawnAwaitingReady('claude', ['-p', '/safe-exit'], { cwd: 'C:\\x' }),
    ).rejects.toThrow('spawn claude ENOENT');
  });

  it('resolves with the child when neither event fires within the race window (treat as healthy spawn)', async () => {
    const fake = makeFakeChild({ mode: 'hang' });
    spawnMock.mockReturnValueOnce(fake);

    const t0 = Date.now();
    const child = await spawnAwaitingReady('claude', ['-p', '/safe-exit'], {
      cwd: 'C:\\x',
    });
    const elapsed = Date.now() - t0;

    expect(child).toBe(fake);
    // Should resolve within ~SPAWN_RACE_WINDOW_MS, not before.
    expect(elapsed).toBeGreaterThanOrEqual(__SPAWN_RACE_WINDOW_MS_FOR_TEST - 50);
    expect(elapsed).toBeLessThan(__SPAWN_RACE_WINDOW_MS_FOR_TEST + 500);
  });

  it('passes args array through to spawn verbatim (no shell parsing)', async () => {
    const fake = makeFakeChild({ mode: 'spawn' });
    spawnMock.mockReturnValueOnce(fake);

    const args = ['-p', '/safe-exit'];
    await spawnAwaitingReady('claude', args, {
      cwd: 'C:\\Projects\\Site3250-KB',
      windowsHide: true,
    });

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const callArgs = spawnMock.mock.calls[0];
    expect(callArgs[0]).toBe('claude');
    // args should be passed as an array, not a shell string. Even hostile
    // looking strings inside args would not be shell-interpreted by spawn.
    expect(Array.isArray(callArgs[1])).toBe(true);
    expect(callArgs[1]).toEqual(['-p', '/safe-exit']);
    expect(callArgs[2]).toMatchObject({
      cwd: 'C:\\Projects\\Site3250-KB',
      windowsHide: true,
    });
  });

  it('treats args as readonly at the type level (regression: do not mutate input)', async () => {
    const fake = makeFakeChild({ mode: 'spawn' });
    spawnMock.mockReturnValueOnce(fake);

    const args: readonly string[] = Object.freeze(['-p', '/update-docs']);
    // Should NOT throw "cannot assign to read only" -- the helper passes a
    // shallow-cast through to spawn() but never mutates the input array.
    await spawnAwaitingReady('claude', args, { cwd: 'C:\\x' });
    expect(args).toEqual(['-p', '/update-docs']);
  });

  it('removes event listeners after resolving (no leak on the EventEmitter)', async () => {
    const fake = makeFakeChild({ mode: 'spawn' });
    spawnMock.mockReturnValueOnce(fake);

    await spawnAwaitingReady('claude', ['-p', '/safe-exit'], { cwd: 'C:\\x' });

    // After the race settles, neither 'spawn' nor 'error' should still be
    // registered. Use the raw EventEmitter view to assert.
    const ee = fake as unknown as EventEmitter;
    expect(ee.listenerCount('spawn')).toBe(0);
    expect(ee.listenerCount('error')).toBe(0);
  });
});

describe('spawnAwaitingReady stub branch (AGENTIC_OS_SPAWN_STUB)', () => {
  // Each test sets/unsets the env var locally so the global vitest environment
  // is unaffected. The stub branch must be OPT-IN per call.
  const origEnv = process.env.AGENTIC_OS_SPAWN_STUB;
  afterEach(() => {
    if (origEnv === undefined) {
      delete process.env.AGENTIC_OS_SPAWN_STUB;
    } else {
      process.env.AGENTIC_OS_SPAWN_STUB = origEnv;
    }
  });

  it('returns a stub ChildProcess WITHOUT invoking real spawn when env-var is set', async () => {
    process.env.AGENTIC_OS_SPAWN_STUB = 'true';
    // Configure the spawn mock to throw if called -- proof of bypass.
    spawnMock.mockImplementation(() => {
      throw new Error('real spawn should not be called in stub mode');
    });

    const child = await spawnAwaitingReady('claude', ['-p', '/safe-exit'], {
      cwd: 'C:\\Projects\\SSTAC-Dashboard',
    });

    expect(spawnMock).not.toHaveBeenCalled();
    expect(typeof child.pid).toBe('number');
    expect(child.stdout).toBeTruthy();
    expect(child.stderr).toBeTruthy();
  });

  it('stub emits canned stdout lines via the data event', async () => {
    process.env.AGENTIC_OS_SPAWN_STUB = 'true';
    spawnMock.mockImplementation(() => {
      throw new Error('real spawn should not be called in stub mode');
    });

    const child = await spawnAwaitingReady('claude', ['-p', '/safe-exit'], {
      cwd: 'C:\\Projects\\SSTAC-Dashboard',
    });

    const chunks: string[] = [];
    // child.stdout is a Readable on the stub; attach a data listener and
    // collect emitted text. Wait for the stream's 'end' signal.
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('timed out waiting for stub stdout')),
        2000,
      );
      child.stdout!.on('data', (c: Buffer | string) => {
        chunks.push(typeof c === 'string' ? c : c.toString('utf-8'));
      });
      child.stdout!.on('end', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    const joined = chunks.join('');
    expect(joined).toMatch(/\[stub\] launched claude -p \/safe-exit/);
    expect(joined).toMatch(/\[stub\] done/);
  });

  it('stub emits close with exit code 0 after the short delay', async () => {
    process.env.AGENTIC_OS_SPAWN_STUB = 'true';
    spawnMock.mockImplementation(() => {
      throw new Error('real spawn should not be called in stub mode');
    });

    const t0 = Date.now();
    const child = await spawnAwaitingReady('claude', ['-p', '/safe-exit'], {
      cwd: 'C:\\Projects\\SSTAC-Dashboard',
    });

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('timed out waiting for stub close')),
        2000,
      );
      child.on('close', (code: number | null) => {
        clearTimeout(timeout);
        resolve(code);
      });
    });
    const elapsed = Date.now() - t0;

    expect(exitCode).toBe(0);
    // Close should fire approximately STUB_CLOSE_DELAY_MS after the call.
    // Allow generous slack for slow CI runners (especially Windows).
    expect(elapsed).toBeGreaterThanOrEqual(
      Math.max(0, __STUB_CLOSE_DELAY_MS_FOR_TEST - 20),
    );
    expect(elapsed).toBeLessThan(__STUB_CLOSE_DELAY_MS_FOR_TEST + 2000);
  });

  it('does NOT activate the stub branch when env-var is unset', async () => {
    delete process.env.AGENTIC_OS_SPAWN_STUB;
    // With the env var unset we expect the real-spawn path: configure the
    // mock to return a successful child so we observe the call.
    const fake = makeFakeChild({ mode: 'spawn', pid: 7777 });
    spawnMock.mockReturnValueOnce(fake);

    const child = await spawnAwaitingReady('claude', ['-p', '/safe-exit'], {
      cwd: 'C:\\x',
    });

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(child).toBe(fake);
  });

  it('does NOT activate the stub branch when env-var is the wrong value (defense in depth)', async () => {
    // Any value other than the exact string 'true' MUST fall through to the
    // real-spawn path. Common typos / case-variants must NOT enable stub.
    for (const wrong of ['1', 'yes', 'TRUE', 'True', 'on']) {
      process.env.AGENTIC_OS_SPAWN_STUB = wrong;
      const fake = makeFakeChild({ mode: 'spawn', pid: 1111 });
      spawnMock.mockReturnValueOnce(fake);
      const child = await spawnAwaitingReady('claude', ['-p', '/safe-exit'], {
        cwd: 'C:\\x',
      });
      expect(child).toBe(fake);
    }
    expect(spawnMock).toHaveBeenCalledTimes(5);
  });
});
