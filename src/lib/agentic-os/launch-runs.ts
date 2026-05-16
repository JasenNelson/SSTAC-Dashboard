// Agentic OS run registry (step 6b).
//
// Owns the in-memory map from runId -> RunState for every child spawned by
// /api/agentic-os/launch. The SSE endpoint at /api/agentic-os/stream/[runId]
// reads from this registry to (a) replay the captured buffer on connect and
// (b) subscribe to new stdout/stderr lines via a per-run pub/sub.
//
// Why runId (uuid) and not pid:
// PIDs are reused by the OS as soon as a process exits. A naive map keyed by
// pid would collide across two launches separated by mere seconds on a busy
// dev box. The route generates a fresh uuid per launch and that uuid is the
// only handle the client ever sees -- the pid is exposed only for audit /
// display purposes.
//
// Why module-scope state:
// This admin page is intentionally single-machine local-only (see
// feature-flag.ts isAgenticOsLaunchEnabled). A per-process Map is exactly
// the right scope; we never need to share it across replicas or survive a
// dev-server restart. A child whose registry entry is lost on restart is
// already orphaned from the user's perspective and will be cleaned up by
// the existing process-safety scripts in Regulatory-Review/.claude/scripts.
//
// Buffer-cap rationale:
// A chatty subprocess could otherwise grow each run's buffer without bound.
// 2000 lines at ~200 bytes each is ~400 KB per run -- a soft ceiling that
// keeps a dozen concurrent runs well under the dev server's heap. On
// overflow we drop the OLDEST line and set `truncated = true` so the client
// can display a "(earlier output truncated)" marker.

import type { ChildProcess } from 'child_process';

/**
 * One captured stdout/stderr line, with its stream of origin and a wall-clock
 * timestamp (ms-since-epoch). Lines are split on newlines as they arrive from
 * the child; partial fragments are buffered until the next newline.
 */
export interface LogLine {
  readonly stream: 'stdout' | 'stderr';
  readonly text: string;
  readonly ts: number;
}

/**
 * Subscriber callback shape. Called once per new line emitted by the child
 * after subscribe() is invoked (NOT replayed for buffered lines -- the SSE
 * endpoint replays buffers itself before subscribing so the order is correct).
 *
 * The 'exit' channel is delivered separately via onExit. Splitting line vs
 * exit keeps the subscriber's switch statement out of this module.
 */
export type LineSubscriber = (line: LogLine) => void;
export type ExitSubscriber = (info: { exitCode: number | null; exitedAt: string }) => void;

export interface RunState {
  readonly runId: string;
  readonly pid: number | undefined;
  readonly project: string;
  readonly action: string;
  /** Resolved {exe, args[]} for audit display. NOT a shell string. */
  readonly command: { exe: string; args: readonly string[]; cwd: string };
  readonly startedAt: string;
  /** ChildProcess handle. NEVER serialized to the client; see toSerializable. */
  readonly child: ChildProcess;
  readonly stdoutBuffer: LogLine[];
  readonly stderrBuffer: LogLine[];
  exitCode: number | null;
  exitedAt: string | null;
  status: 'running' | 'completed' | 'failed';
  truncated: boolean;
}

/**
 * Shape returned to the client. Strips `child` (a ChildProcess is not
 * JSON-serializable and would expose process internals if it were).
 */
export interface SerializableRunState {
  readonly runId: string;
  readonly pid: number | undefined;
  readonly project: string;
  readonly action: string;
  readonly command: { exe: string; args: readonly string[]; cwd: string };
  readonly startedAt: string;
  readonly stdoutBuffer: readonly LogLine[];
  readonly stderrBuffer: readonly LogLine[];
  readonly exitCode: number | null;
  readonly exitedAt: string | null;
  readonly status: 'running' | 'completed' | 'failed';
  readonly truncated: boolean;
}

// Soft cap per buffer. 2000 lines * 2 streams * ~200 bytes = ~800 KB per run.
const BUFFER_CAP = 2000;

// Cap total live runs in the registry. If exceeded, the OLDEST completed run
// (one whose status is not 'running') is evicted. Running runs are never
// evicted. 50 is well above expected concurrency on a single-developer box.
const REGISTRY_CAP = 50;

interface RunSubscribers {
  lineSubs: Set<LineSubscriber>;
  exitSubs: Set<ExitSubscriber>;
}

const runs = new Map<string, RunState>();
const subscribers = new Map<string, RunSubscribers>();

function getOrCreateSubscribers(runId: string): RunSubscribers {
  let s = subscribers.get(runId);
  if (!s) {
    s = { lineSubs: new Set(), exitSubs: new Set() };
    subscribers.set(runId, s);
  }
  return s;
}

function pushBounded(buffer: LogLine[], line: LogLine, state: RunState): void {
  buffer.push(line);
  if (buffer.length > BUFFER_CAP) {
    // Drop oldest 1 line at a time. This is amortized O(1) per overflow because
    // we only ever hit it once per push past the cap; the splice cost is
    // dominated by the V8 fast path for shift on small arrays.
    buffer.splice(0, buffer.length - BUFFER_CAP);
    state.truncated = true;
  }
}

/**
 * Split a chunk of bytes from a child stdio stream into newline-delimited
 * lines plus a residual partial. The caller threads `residual` through across
 * data events so a line that straddles two chunks doesn't get split in half.
 *
 * Empty trailing fragments (i.e. the chunk ends on '\n') produce no extra
 * empty line -- the residual just resets to ''. CRLF on Windows is handled
 * by stripping a trailing '\r' from each split line.
 */
function splitLines(
  chunk: string,
  residual: string,
): { lines: string[]; residual: string } {
  const combined = residual + chunk;
  const parts = combined.split('\n');
  const newResidual = parts.pop() ?? '';
  const lines = parts.map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));
  return { lines, residual: newResidual };
}

function evictOldestCompleted(): void {
  if (runs.size <= REGISTRY_CAP) return;
  let oldestId: string | null = null;
  let oldestStarted = Infinity;
  for (const [id, r] of runs) {
    if (r.status === 'running') continue;
    const ts = Date.parse(r.startedAt);
    if (ts < oldestStarted) {
      oldestStarted = ts;
      oldestId = id;
    }
  }
  if (oldestId) {
    runs.delete(oldestId);
    subscribers.delete(oldestId);
  }
}

export interface RegisterRunArgs {
  runId: string;
  project: string;
  action: string;
  command: { exe: string; args: readonly string[]; cwd: string };
  child: ChildProcess;
  startedAt?: string; // override for tests
}

/**
 * Register a freshly-spawned child with the registry. Attaches `data` listeners
 * to child.stdout / child.stderr that push lines into the buffer and notify
 * subscribers, and a `close` listener that finalizes the run.
 *
 * Idempotency: re-registering the same runId is a programming error (the route
 * generates a uuid per call). We throw rather than silently replace because a
 * collision indicates a serious upstream bug.
 */
export function registerRun(args: RegisterRunArgs): RunState {
  if (runs.has(args.runId)) {
    throw new Error(`registerRun: duplicate runId ${args.runId}`);
  }

  const state: RunState = {
    runId: args.runId,
    pid: args.child.pid,
    project: args.project,
    action: args.action,
    command: args.command,
    startedAt: args.startedAt ?? new Date().toISOString(),
    child: args.child,
    stdoutBuffer: [],
    stderrBuffer: [],
    exitCode: null,
    exitedAt: null,
    status: 'running',
    truncated: false,
  };
  runs.set(state.runId, state);
  evictOldestCompleted();

  // Residual strings live in the closure -- one per stream so a half-line in
  // stdout doesn't smear into stderr.
  let stdoutResidual = '';
  let stderrResidual = '';

  const onStdout = (chunk: Buffer | string): void => {
    const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
    const split = splitLines(text, stdoutResidual);
    stdoutResidual = split.residual;
    for (const lineText of split.lines) {
      const line: LogLine = { stream: 'stdout', text: lineText, ts: Date.now() };
      pushBounded(state.stdoutBuffer, line, state);
      const subs = subscribers.get(state.runId);
      if (subs) {
        for (const cb of subs.lineSubs) {
          try {
            cb(line);
          } catch {
            // Subscriber crash MUST NOT break the producer.
          }
        }
      }
    }
  };

  const onStderr = (chunk: Buffer | string): void => {
    const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
    const split = splitLines(text, stderrResidual);
    stderrResidual = split.residual;
    for (const lineText of split.lines) {
      const line: LogLine = { stream: 'stderr', text: lineText, ts: Date.now() };
      pushBounded(state.stderrBuffer, line, state);
      const subs = subscribers.get(state.runId);
      if (subs) {
        for (const cb of subs.lineSubs) {
          try {
            cb(line);
          } catch {
            // Subscriber crash MUST NOT break the producer.
          }
        }
      }
    }
  };

  // child.stdout / child.stderr are nullable on the type. With
  // stdio: ['ignore', 'pipe', 'pipe'] both are guaranteed Readable streams,
  // but we guard anyway in case a future caller omits 'pipe'.
  if (args.child.stdout) {
    args.child.stdout.on('data', onStdout);
  }
  if (args.child.stderr) {
    args.child.stderr.on('data', onStderr);
  }

  const onClose = (code: number | null): void => {
    // Flush residuals as a final line each, only if non-empty.
    if (stdoutResidual.length > 0) {
      const line: LogLine = {
        stream: 'stdout',
        text: stdoutResidual.endsWith('\r')
          ? stdoutResidual.slice(0, -1)
          : stdoutResidual,
        ts: Date.now(),
      };
      pushBounded(state.stdoutBuffer, line, state);
      stdoutResidual = '';
      const subs = subscribers.get(state.runId);
      if (subs) {
        for (const cb of subs.lineSubs) {
          try { cb(line); } catch { /* ignore */ }
        }
      }
    }
    if (stderrResidual.length > 0) {
      const line: LogLine = {
        stream: 'stderr',
        text: stderrResidual.endsWith('\r')
          ? stderrResidual.slice(0, -1)
          : stderrResidual,
        ts: Date.now(),
      };
      pushBounded(state.stderrBuffer, line, state);
      stderrResidual = '';
      const subs = subscribers.get(state.runId);
      if (subs) {
        for (const cb of subs.lineSubs) {
          try { cb(line); } catch { /* ignore */ }
        }
      }
    }

    state.exitCode = code;
    state.exitedAt = new Date().toISOString();
    state.status = code === 0 ? 'completed' : 'failed';

    const subs = subscribers.get(state.runId);
    if (subs) {
      const info = { exitCode: state.exitCode, exitedAt: state.exitedAt };
      for (const cb of subs.exitSubs) {
        try {
          cb(info);
        } catch {
          // ignore
        }
      }
    }
    evictOldestCompleted();
  };

  // 'close' fires after stdio is flushed (preferred over 'exit' which fires
  // before stdout/stderr drain). A spawn that fails with ENOENT post-race
  // still emits 'close' after 'error'; we record the error code via the
  // 'error' handler below so the run isn't stuck in 'running' forever.
  args.child.once('close', onClose);
  args.child.once('error', (err) => {
    // If the child errored before close (rare for our use case -- the route's
    // spawnAwaitingReady already raced this), set status accordingly. If
    // close has already fired, this is a no-op (state.status already set).
    if (state.status === 'running') {
      state.exitCode = -1;
      state.exitedAt = new Date().toISOString();
      state.status = 'failed';
      const subs = subscribers.get(state.runId);
      if (subs) {
        const info = { exitCode: state.exitCode, exitedAt: state.exitedAt };
        for (const cb of subs.exitSubs) {
          try { cb(info); } catch { /* ignore */ }
        }
      }
    }
    // Suppress further uncaught-emitter noise.
    void err;
  });

  return state;
}

export function getRun(runId: string): RunState | undefined {
  return runs.get(runId);
}

/**
 * Snapshot of all current runs, most recent first.
 */
export function listRuns(limit?: number): SerializableRunState[] {
  const arr = Array.from(runs.values()).sort(
    (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt),
  );
  const sliced = typeof limit === 'number' ? arr.slice(0, limit) : arr;
  return sliced.map(toSerializable);
}

/**
 * Strip the ChildProcess handle (and copy buffers defensively) before
 * shipping to a client. The buffers are shallow-copied; LogLine objects
 * are already frozen-by-convention (they're never mutated after push).
 */
export function toSerializable(state: RunState): SerializableRunState {
  return {
    runId: state.runId,
    pid: state.pid,
    project: state.project,
    action: state.action,
    command: state.command,
    startedAt: state.startedAt,
    stdoutBuffer: state.stdoutBuffer.slice(),
    stderrBuffer: state.stderrBuffer.slice(),
    exitCode: state.exitCode,
    exitedAt: state.exitedAt,
    status: state.status,
    truncated: state.truncated,
  };
}

/**
 * Subscribe to new lines + exit events from a run. Returns an unsubscribe
 * function. The subscriber will NOT receive existing buffered lines -- the
 * caller is expected to replay the buffer itself (see SSE route) before
 * subscribing, to keep ordering correct.
 *
 * If the run has already exited at subscribe time, onExit is invoked on the
 * next microtask so the caller's stream can emit a final exit event and close.
 */
export function subscribe(
  runId: string,
  onLine: LineSubscriber,
  onExit: ExitSubscriber,
): () => void {
  const state = runs.get(runId);
  if (!state) {
    // Subscribing to an unknown run is a programmer error at the route level;
    // surface as a no-op + immediate synthetic exit so the caller's SSE stream
    // gracefully closes.
    queueMicrotask(() => {
      onExit({ exitCode: -1, exitedAt: new Date().toISOString() });
    });
    return () => {};
  }
  const subs = getOrCreateSubscribers(runId);
  subs.lineSubs.add(onLine);
  subs.exitSubs.add(onExit);

  if (state.status !== 'running') {
    // Already exited. Fire onExit on a microtask AFTER subscribe returns so
    // the caller has a chance to install whatever surrounding state it needs.
    const exitedAt = state.exitedAt ?? new Date().toISOString();
    const exitCode = state.exitCode;
    queueMicrotask(() => {
      onExit({ exitCode, exitedAt });
    });
  }

  return () => {
    const live = subscribers.get(runId);
    if (!live) return;
    live.lineSubs.delete(onLine);
    live.exitSubs.delete(onExit);
  };
}

// --- Test-only exports ---

export function __resetRunsForTest(): void {
  runs.clear();
  subscribers.clear();
}

export const __BUFFER_CAP_FOR_TEST = BUFFER_CAP;
export const __REGISTRY_CAP_FOR_TEST = REGISTRY_CAP;
