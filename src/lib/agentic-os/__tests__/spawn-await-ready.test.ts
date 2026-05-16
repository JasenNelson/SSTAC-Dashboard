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
