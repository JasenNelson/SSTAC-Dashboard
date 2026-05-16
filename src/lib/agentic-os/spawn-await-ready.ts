// Agentic OS spawn helper (step 6a).
//
// Mirrors engine_v2's spawn_extraction.ts pattern (commit 49b1cb0 fix):
// Node's child_process.spawn emits ENOENT / EACCES ASYNCHRONOUSLY on the
// returned child's 'error' event, NOT as a synchronous throw. A naive
// `const child = spawn(...); return child` therefore lets a misconfigured
// exe silently succeed -- the route would return a pid that points at
// nothing. spawnAwaitingReady races the 'spawn' (success) and 'error'
// (failure) events with a small wait window so the caller can quarantine
// launch failures via try/catch.
//
// KEY DIFFERENCE FROM spawn_extraction.ts: we do NOT detach + unref the
// child. Step 6b will introduce an SSE endpoint that pipes the child's
// stdout/stderr back to the admin page; detaching closes those pipes.
// For step 6a we still return a healthy ChildProcess; the launch route
// captures pid + timestamp into an in-memory audit log and lets the OS
// reap the child when it exits (the stdio: 'pipe' setting keeps pipes
// available for step 6b to subscribe to without re-spawning).
//
// Architecture spec: .tmp_presentation/master/AGENTIC_OS_ARCHITECTURE.md
// section 5 lines 217-228 (spawnAwaitingReady reference implementation).
// Engine_v2 precedent: src/lib/engine-v2/spawn_extraction.ts.

import { spawn, type ChildProcess, type SpawnOptions } from 'child_process';
import { EventEmitter } from 'events';
import { Readable } from 'stream';

// How long to wait for either 'spawn' or 'error' before concluding the
// subprocess started successfully. Node emits both events within microtasks
// in practice; 500ms is a generous safety margin without blocking the route.
// Matches SPAWN_RACE_WINDOW_MS in src/lib/engine-v2/spawn_extraction.ts.
const SPAWN_RACE_WINDOW_MS = 500;

// Test-only spawn stub (step 12 / Playwright E2E).
//
// When AGENTIC_OS_SPAWN_STUB === 'true', spawnAwaitingReady short-circuits
// the real child_process.spawn() call and returns a fake ChildProcess that:
//   - exposes readable .stdout / .stderr streams that emit a couple of canned
//     lines via 'data' events, then end,
//   - emits 'close' with exit code 0 after a short timeout,
//   - has a stable .pid for audit display.
//
// This is the right injection boundary because every gate (1-6) in the
// launch route runs BEFORE spawnAwaitingReady -- the stub does NOT bypass
// the feature flag, localhost check, CSRF, admin auth, payload validation,
// or allowlist. It only swaps the syscall that would have launched
// `claude` / `wt.exe` so Playwright tests can exercise the full route +
// SSE plumbing without any external CLI on the runner.
//
// Hard rule: this branch is INERT unless AGENTIC_OS_SPAWN_STUB is exactly
// the string 'true'. We re-check on every call so a single process can
// flip the flag (tests do not, but defense in depth costs nothing).
function isStubEnabled(): boolean {
  return process.env.AGENTIC_OS_SPAWN_STUB === 'true';
}

/**
 * How long after stub spawn before we emit 'close' on the fake child.
 * Short enough that E2E assertions complete fast; long enough that the
 * launch route returns + the client opens the SSE stream before close
 * fires (otherwise the client would never observe the running state).
 */
const STUB_CLOSE_DELAY_MS = 50;

/**
 * Build a fake ChildProcess that emits a couple of canned stdout lines,
 * then closes with exit 0 after STUB_CLOSE_DELAY_MS. The stdout/stderr
 * streams are real Readable instances (in object mode off) so the
 * registerRun() data listeners attach without special-casing.
 */
function createStubChild(exe: string, args: readonly string[]): ChildProcess {
  const stdout = new Readable({ read() { /* no-op; we push manually */ } });
  const stderr = new Readable({ read() { /* no-op */ } });

  const child = new EventEmitter() as EventEmitter & {
    pid: number;
    stdout: Readable;
    stderr: Readable;
    kill: (signal?: NodeJS.Signals | number) => boolean;
  };
  // Synthetic but deterministic-ish pid; the launch route only uses it for
  // audit display, and runId is the real handle.
  child.pid = 99000 + Math.floor(Math.random() * 1000);
  child.stdout = stdout;
  child.stderr = stderr;
  // No-op kill so callers that try to terminate the stub don't throw.
  child.kill = () => true;

  // Emit canned output + close on the next tick so the caller can attach
  // listeners (registerRun does this BEFORE this function returns? No:
  // spawnAwaitingReady returns the child first, registerRun then attaches.
  // We therefore delay the emissions just enough to let that happen).
  setImmediate(() => {
    // 'spawn' must fire so the await in spawnAwaitingReady resolves; we
    // emit it manually here on the stub path too for symmetry with the
    // real spawn semantics, even though spawnAwaitingReady doesn't await
    // the race when the stub branch is taken (see below).
    child.emit('spawn');
    stdout.push(`[stub] launched ${exe} ${args.join(' ')}\n`);
    stdout.push('[stub] done\n');
    // End the streams so any consumer that awaits 'end' settles.
    stdout.push(null);
    stderr.push(null);
  });

  setTimeout(() => {
    child.emit('close', 0, null);
    // 'exit' is what node's ChildProcess fires for process termination;
    // some consumers listen to either. Emit both for parity.
    child.emit('exit', 0, null);
  }, STUB_CLOSE_DELAY_MS);

  return child as unknown as ChildProcess;
}

/**
 * Spawn `exe` with `args` and `options`, awaiting either the child's
 * 'spawn' event (success) or 'error' event (failure -- ENOENT, EACCES, etc.).
 *
 * On 'spawn'  -> resolves with the ChildProcess.
 * On 'error'  -> rejects with the Error (caller's try/catch quarantines).
 * On timeout  -> resolves with the ChildProcess (per engine_v2 precedent;
 *                a healthy spawn within 500ms is the empirically dominant
 *                case, and a late 'error' would be unobserved which is
 *                acceptable here because the audit log captures pid + ts
 *                and step 6b's SSE pipe will surface any post-spawn death
 *                to the user anyway).
 *
 * The child is NOT detached and NOT unref'd: step 6b will pipe its stdout
 * back over SSE. Callers should set stdio: ['ignore', 'pipe', 'pipe'] in
 * `options` to keep stdout/stderr pipes available without holding stdin open.
 *
 * ERROR SEMANTICS (post-race-window contract):
 *
 *   This function resolves once 'spawn' fires OR the 500ms race window
 *   elapses without any 'error'. It REJECTS only on an 'error' event that
 *   fires BEFORE 'spawn' AND BEFORE the race window elapses. After this
 *   function settles (resolve OR reject), its event listeners are removed
 *   via `child.removeListener` in `settle()` -- meaning any subsequent
 *   'error' event will NOT reject this promise and will NOT propagate to
 *   the caller's `await` site.
 *
 *   Two post-settle failure modes the caller MUST handle:
 *
 *     1. Late 'error' (rare): the child emits 'error' after both the race
 *        window elapsed AND 'spawn' never fired -- e.g. an ENOENT delivered
 *        after the 500ms timer. The promise has already resolved with a
 *        ChildProcess whose .pid is undefined. The caller's downstream
 *        consumer (run registry / SSE handler) is responsible for detecting
 *        the missing pid and the eventually-emitted 'error' event.
 *
 *     2. Post-spawn 'error': the child started, then died later (e.g.
 *        write-after-exit on stdin, OS-level kill). This is normal lifecycle
 *        and is delivered to whichever listener the caller attached after
 *        this function returned -- for the agentic-os launch route that is
 *        the run registry's 'error' handler which sets status='failed' and
 *        flushes the SSE stream with an 'exit' event.
 *
 *   Neither path is a bug in this function; both are explicitly the caller's
 *   responsibility per the launch route's design (see route.ts: post-spawn
 *   wire-up of stdout / stderr / exit / error listeners on the registry).
 *
 *   No behavior change is intended by this documentation block -- the
 *   contract above describes the implementation that has shipped since
 *   step 6a (commit 3bb5479).
 */
export async function spawnAwaitingReady(
  exe: string,
  args: readonly string[],
  options: SpawnOptions,
): Promise<ChildProcess> {
  // Test-only stub branch (step 12). Guarded behind an explicit env-var
  // string equality so production / dev runs without the env var follow
  // the real-spawn path verbatim. The check is INSIDE the function so a
  // mid-run flip would apply on the next call, but tests do not rely on
  // that property -- they set the var via Playwright's webServer.env.
  if (isStubEnabled()) {
    return createStubChild(exe, args);
  }

  // child_process.spawn's TS overloads accept readonly string[] as args; cast
  // through string[] to satisfy the signature without copying. Args have
  // already been validated by launch-validator (or hardcoded by caller).
  const child = spawn(exe, args as string[], options);

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const onSpawn = () => settle(resolve);
    const onError = (err: Error) => settle(() => reject(err));
    const timer = setTimeout(() => settle(resolve), SPAWN_RACE_WINDOW_MS);

    function settle(fn: () => void) {
      if (settled) return;
      settled = true;
      child.removeListener('spawn', onSpawn);
      child.removeListener('error', onError);
      clearTimeout(timer);
      fn();
    }

    child.once('spawn', onSpawn);
    child.once('error', onError);
  });

  return child;
}

// Export for test assertions (spawnAwaitingReady's race-window length).
export const __SPAWN_RACE_WINDOW_MS_FOR_TEST = SPAWN_RACE_WINDOW_MS;
export const __STUB_CLOSE_DELAY_MS_FOR_TEST = STUB_CLOSE_DELAY_MS;
