/*
 * S1 section request queue (pure, framework-free).
 *
 * - At most SECTION_LOADER_MAX_IN_FLIGHT (2) section requests run at once, counted
 *   globally for the loader.
 * - Requests are deduplicated per section index.
 * - loadAll queues every unloaded section FIFO in document order; a navigation
 *   request may jump to the front of the queue (priority) without exceeding the cap.
 * - After each completion the loader yields to the main thread (scheduler.yield when
 *   present, else setTimeout(0)) before starting the next queued request.
 * - abort() cancels in-flight requests through one AbortController and returns
 *   pending sections to idle; late results from before an abort are ignored.
 * - A failed section keeps a per-section error until retry().
 * Snapshots are immutable and replaced on every change (useSyncExternalStore safe).
 */

export const SECTION_LOADER_MAX_IN_FLIGHT = 2;

export type SectionLoadStatus = 'idle' | 'queued' | 'loading' | 'loaded' | 'error';

export interface SectionLoaderSnapshot<T> {
  readonly total: number;
  readonly statuses: readonly SectionLoadStatus[];
  readonly results: readonly (T | undefined)[];
  readonly errors: readonly (string | null)[];
  readonly loadedCount: number;
  readonly inFlight: number;
  readonly loadingAll: boolean;
  readonly complete: boolean;
}

export interface SectionLoaderOptions<T> {
  readonly total: number;
  /** Sections already present without a request (the server-rendered window). */
  readonly initiallyLoaded?: readonly number[];
  readonly load: (index: number, signal: AbortSignal) => Promise<T>;
  readonly yieldToMain?: () => Promise<void>;
}

export interface SectionLoader<T> {
  request(index: number, options?: { readonly priority?: boolean }): void;
  loadAll(): void;
  retry(index: number): void;
  abort(): void;
  getSnapshot(): SectionLoaderSnapshot<T>;
  subscribe(listener: () => void): () => void;
}

export function defaultYieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler && typeof scheduler.yield === 'function') return scheduler.yield();
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function isAbortError(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError');
}

export function createSectionLoader<T>(options: SectionLoaderOptions<T>): SectionLoader<T> {
  const { total, load } = options;
  const yieldToMain = options.yieldToMain ?? defaultYieldToMain;
  if (!Number.isInteger(total) || total < 0) throw new Error('Section loader total must be a non-negative integer');
  const statuses: SectionLoadStatus[] = Array.from({ length: total }, () => 'idle');
  const results: (T | undefined)[] = Array.from({ length: total }, () => undefined);
  const errors: (string | null)[] = Array.from({ length: total }, () => null);
  for (const index of options.initiallyLoaded ?? []) {
    if (Number.isInteger(index) && index >= 0 && index < total) statuses[index] = 'loaded';
  }
  let queue: number[] = [];
  const inFlight = new Set<number>();
  let controller: AbortController | null = null;
  let generation = 0;
  let loadingAll = false;
  const listeners = new Set<() => void>();

  const buildSnapshot = (): SectionLoaderSnapshot<T> => {
    const loadedCount = statuses.filter((status) => status === 'loaded').length;
    return Object.freeze({
      total,
      statuses: Object.freeze([...statuses]),
      results: Object.freeze([...results]),
      errors: Object.freeze([...errors]),
      loadedCount,
      inFlight: inFlight.size,
      loadingAll,
      complete: loadedCount === total,
    });
  };
  let snapshot = buildSnapshot();

  const emit = () => {
    if (loadingAll && queue.length === 0 && inFlight.size === 0) loadingAll = false;
    snapshot = buildSnapshot();
    for (const listener of [...listeners]) listener();
  };

  const validIndex = (index: number) => Number.isInteger(index) && index >= 0 && index < total;

  const start = (index: number) => {
    statuses[index] = 'loading';
    errors[index] = null;
    inFlight.add(index);
    controller ??= new AbortController();
    const signal = controller.signal;
    const startedGeneration = generation;
    let request: Promise<T>;
    try {
      request = load(index, signal);
    } catch (error) {
      request = Promise.reject(error);
    }
    request.then(
      (value) => {
        if (startedGeneration !== generation) return;
        results[index] = value;
        statuses[index] = 'loaded';
      },
      (error: unknown) => {
        if (startedGeneration !== generation) return;
        if (isAbortError(error, signal)) {
          statuses[index] = 'idle';
        } else {
          statuses[index] = 'error';
          errors[index] = error instanceof Error ? error.message : String(error);
        }
      },
    ).then(() => {
      if (startedGeneration !== generation) return;
      inFlight.delete(index);
      emit();
      void yieldToMain().then(() => {
        if (startedGeneration === generation) pump();
      });
    });
  };

  function pump() {
    let started = false;
    while (inFlight.size < SECTION_LOADER_MAX_IN_FLIGHT && queue.length > 0) {
      const index = queue.shift() as number;
      if (statuses[index] !== 'queued') continue;
      start(index);
      started = true;
    }
    if (started) emit();
  }

  const enqueue = (index: number, priority: boolean): boolean => {
    const status = statuses[index];
    if (status === 'loaded' || status === 'loading') return false;
    if (status === 'queued') {
      if (!priority) return false;
      queue = [index, ...queue.filter((candidate) => candidate !== index)];
      return true;
    }
    statuses[index] = 'queued';
    errors[index] = null;
    if (priority) queue.unshift(index);
    else queue.push(index);
    return true;
  };

  return {
    request(index, requestOptions) {
      if (!validIndex(index)) return;
      if (!enqueue(index, requestOptions?.priority === true)) return;
      emit();
      pump();
    },
    loadAll() {
      let changed = false;
      for (let index = 0; index < total; index += 1) {
        if (statuses[index] === 'idle' || statuses[index] === 'error') changed = enqueue(index, false) || changed;
      }
      loadingAll = queue.length > 0 || inFlight.size > 0;
      if (changed || loadingAll) emit();
      pump();
    },
    retry(index) {
      if (!validIndex(index) || statuses[index] !== 'error') return;
      enqueue(index, true);
      emit();
      pump();
    },
    abort() {
      generation += 1;
      controller?.abort();
      controller = null;
      for (const index of [...inFlight, ...queue]) {
        if (statuses[index] === 'loading' || statuses[index] === 'queued') statuses[index] = 'idle';
      }
      inFlight.clear();
      queue = [];
      loadingAll = false;
      emit();
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
