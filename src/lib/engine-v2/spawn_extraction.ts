// engine_v2 frontend Lane 1: thin spawn wrapper for the Docling extractor subprocess.
//
// Pinned invocation pattern (Finding 7 / Engineering Decisions / L1-6 step 9):
//   - detached: true (subprocess survives the request handler returning)
//   - stdio: 'ignore' (no in-process pipes that would hold the request open)
//   - windowsHide: true (no console window flash on Windows)
//   - subprocess.unref() so the Node event loop is not held open by the child
//
// Async semantics: Node's child_process.spawn emits ENOENT / EACCES on the
// returned child's 'error' event ASYNCHRONOUSLY, not as a synchronous throw.
// A naive `spawn(...); child.unref(); return child` therefore lets a misconfigured
// pythonPath silently succeed -- the route would stamp status='extracting' and
// never recover. spawnExtractor now races the 'spawn' (success) and 'error'
// (failure) events with a small wait window; the caller awaits and gets a real
// rejection on launch failure that the route's try/catch can quarantine.

import { spawn, type ChildProcess } from "child_process";

export interface SpawnExtractorArgs {
  pythonPath: string;
  scriptPath: string;
  sourceDir: string;
  outputDir: string;
  progressFilePath: string;
}

// How long to wait for either 'spawn' or 'error' before concluding the
// subprocess started successfully. Node emits both events within microtasks
// in practice; 500ms is a generous safety margin without blocking the route.
const SPAWN_RACE_WINDOW_MS = 500;

export async function spawnExtractor(args: SpawnExtractorArgs): Promise<ChildProcess> {
  const cli = [
    args.scriptPath,
    "--source-dir",
    args.sourceDir,
    "--output-dir",
    args.outputDir,
    "--progress-file",
    args.progressFilePath,
  ];

  const child = spawn(args.pythonPath, cli, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      child.removeListener("spawn", onSpawn);
      child.removeListener("error", onError);
      clearTimeout(timer);
      fn();
    };
    const onSpawn = () => settle(resolve);
    const onError = (err: Error) => settle(() => reject(err));
    child.once("spawn", onSpawn);
    child.once("error", onError);
    // If neither fires within the window, treat as success: the child is
    // detached, we cannot keep the request open longer. A subsequent error
    // event would be unobserved which is acceptable for fire-and-forget.
    const timer = setTimeout(() => settle(resolve), SPAWN_RACE_WINDOW_MS);
  });

  child.unref();
  return child;
}
