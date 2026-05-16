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

// How long to wait for either 'spawn' or 'error' before concluding the
// subprocess started successfully. Node emits both events within microtasks
// in practice; 500ms is a generous safety margin without blocking the route.
// Matches SPAWN_RACE_WINDOW_MS in src/lib/engine-v2/spawn_extraction.ts.
const SPAWN_RACE_WINDOW_MS = 500;

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
