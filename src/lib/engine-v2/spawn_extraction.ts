// engine_v2 frontend Lane 1: thin spawn wrapper for the Docling extractor subprocess.
//
// Pinned invocation pattern (Finding 7 / Engineering Decisions / L1-6 step 9):
//   - detached: true (subprocess survives the request handler returning)
//   - stdio: 'ignore' (no in-process pipes that would hold the request open)
//   - windowsHide: true (no console window flash on Windows)
//   - subprocess.unref() so the Node event loop is not held open by the child
//
// This helper does NOT validate args nor existsSync the python path -- the route
// caller chooses to spawn directly when LOCAL_ENGINE_ENABLED='true' and wraps the
// call in try/catch to translate spawn ENOENT/EACCES into row.status='error' +
// quarantine + HTTP 500 (L1-6 step 9 catch).

import { spawn, type ChildProcess } from "child_process";

export interface SpawnExtractorArgs {
  pythonPath: string;
  scriptPath: string;
  sourceDir: string;
  outputDir: string;
  progressFilePath: string;
}

export function spawnExtractor(args: SpawnExtractorArgs): ChildProcess {
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
  child.unref();
  return child;
}
