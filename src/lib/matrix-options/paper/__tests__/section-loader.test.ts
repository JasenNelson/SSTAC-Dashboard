import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSectionLoader, defaultYieldToMain, SECTION_LOADER_MAX_IN_FLIGHT } from '../section-loader';

interface Pending {
  readonly index: number;
  readonly signal: AbortSignal;
  resolve(value: string): void;
  reject(error: unknown): void;
}

function harness(total: number, initiallyLoaded: readonly number[] = [0], yieldToMain: () => Promise<void> = () => Promise.resolve()) {
  const pending: Pending[] = [];
  const started: number[] = [];
  let active = 0;
  let maxActive = 0;
  const loader = createSectionLoader<string>({
    total,
    initiallyLoaded,
    yieldToMain,
    load: (index, signal) => {
      started.push(index);
      active += 1;
      maxActive = Math.max(maxActive, active);
      return new Promise<string>((resolve, reject) => {
        const done = () => {
          active -= 1;
        };
        pending.push({ index, signal, resolve: (value) => { done(); resolve(value); }, reject: (error) => { done(); reject(error); } });
      });
    },
  });
  return { loader, pending, started, stats: () => ({ active, maxActive }) };
}

async function flush() {
  for (let round = 0; round < 20; round += 1) await Promise.resolve();
}

async function settleFirst(pending: Pending[], value = 'ok') {
  const next = pending.shift();
  if (!next) throw new Error('nothing pending');
  next.resolve(`${value}-${next.index}`);
  await flush();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('createSectionLoader', () => {
  it('loads every section in document order with at most 2 requests in flight and reports progress', async () => {
    const { loader, pending, started, stats } = harness(6);
    const progress: number[] = [];
    loader.subscribe(() => progress.push(loader.getSnapshot().loadedCount));
    expect(loader.getSnapshot()).toMatchObject({ total: 6, loadedCount: 1, complete: false, loadingAll: false });
    loader.loadAll();
    expect(loader.getSnapshot().loadingAll).toBe(true);
    expect(started).toEqual([1, 2]);
    expect(loader.getSnapshot().inFlight).toBe(SECTION_LOADER_MAX_IN_FLIGHT);
    expect(loader.getSnapshot().statuses).toEqual(['loaded', 'loading', 'loading', 'queued', 'queued', 'queued']);
    while (pending.length > 0) await settleFirst(pending);
    expect(started).toEqual([1, 2, 3, 4, 5]);
    expect(stats().maxActive).toBe(2);
    const done = loader.getSnapshot();
    expect(done).toMatchObject({ loadedCount: 6, complete: true, loadingAll: false, inFlight: 0 });
    expect(done.results).toEqual([undefined, 'ok-1', 'ok-2', 'ok-3', 'ok-4', 'ok-5']);
    expect(Math.max(...progress)).toBe(6);
    expect(progress.filter((value, index) => index > 0 && value < progress[index - 1])).toEqual([]);
  });

  it('deduplicates requests per section and lets a navigation request jump the load-all queue', async () => {
    const { loader, pending, started } = harness(6);
    loader.request(3);
    loader.request(3);
    loader.request(3, { priority: true });
    expect(started).toEqual([3]);
    loader.loadAll();
    expect(started).toEqual([3, 1]);
    loader.request(5, { priority: true });
    await settleFirst(pending);
    expect(started).toEqual([3, 1, 5]);
    while (pending.length > 0) await settleFirst(pending);
    expect(started.filter((index) => index === 3)).toHaveLength(1);
    expect(started).toEqual([3, 1, 5, 2, 4]);
    expect(loader.getSnapshot().complete).toBe(true);
    const before = loader.getSnapshot();
    loader.request(3);
    loader.request(0);
    loader.request(99);
    expect(loader.getSnapshot()).toBe(before);
  });

  it('yields to the main thread after a completion before starting the next queued request', async () => {
    let releaseYield: () => void = () => undefined;
    const yieldToMain = vi.fn(() => new Promise<void>((resolve) => {
      releaseYield = resolve;
    }));
    const { loader, pending, started } = harness(4, [0], yieldToMain);
    loader.loadAll();
    expect(started).toEqual([1, 2]);
    await settleFirst(pending);
    expect(yieldToMain).toHaveBeenCalledTimes(1);
    expect(started).toEqual([1, 2]);
    releaseYield();
    await flush();
    expect(started).toEqual([1, 2, 3]);
  });

  it('aborts in-flight requests on abort(), returns pending sections to idle, and ignores late results', async () => {
    const { loader, pending } = harness(5);
    loader.loadAll();
    const signals = pending.map((entry) => entry.signal);
    loader.abort();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(loader.getSnapshot()).toMatchObject({ statuses: ['loaded', 'idle', 'idle', 'idle', 'idle'], inFlight: 0, loadingAll: false });
    pending.splice(0).forEach((entry) => entry.resolve('late'));
    await flush();
    expect(loader.getSnapshot().statuses).toEqual(['loaded', 'idle', 'idle', 'idle', 'idle']);
    // The loader stays usable after an abort (a remounted view reuses it).
    loader.request(2);
    expect(loader.getSnapshot().statuses[2]).toBe('loading');
  });

  it('keeps a per-section error until retry and completes after a successful retry', async () => {
    const { loader, pending } = harness(3);
    loader.loadAll();
    const failing = pending.shift();
    failing?.reject(new Error('Paper section request failed: 500'));
    await flush();
    await settleFirst(pending);
    const failed = loader.getSnapshot();
    expect(failed.statuses).toEqual(['loaded', 'error', 'loaded']);
    expect(failed.errors[1]).toBe('Paper section request failed: 500');
    expect(failed).toMatchObject({ complete: false, loadingAll: false, loadedCount: 2 });
    loader.retry(2);
    expect(loader.getSnapshot()).toBe(failed);
    loader.retry(1);
    expect(loader.getSnapshot().statuses[1]).toBe('loading');
    await settleFirst(pending);
    expect(loader.getSnapshot()).toMatchObject({ complete: true, loadedCount: 3, errors: [null, null, null] });
  });

  it('treats an AbortError rejection as idle rather than an error', async () => {
    const { loader, pending } = harness(2);
    loader.request(1);
    pending.shift()?.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await flush();
    expect(loader.getSnapshot().statuses).toEqual(['loaded', 'idle']);
  });
});

describe('defaultYieldToMain', () => {
  it('uses scheduler.yield when present', async () => {
    const yieldSpy = vi.fn(() => Promise.resolve());
    vi.stubGlobal('scheduler', { yield: yieldSpy });
    await defaultYieldToMain();
    expect(yieldSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to setTimeout(0) without scheduler.yield', async () => {
    vi.stubGlobal('scheduler', undefined);
    vi.useFakeTimers();
    let resolved = false;
    const pendingYield = defaultYieldToMain().then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    await pendingYield;
    expect(resolved).toBe(true);
  });
});
