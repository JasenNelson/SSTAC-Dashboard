// engine_v2 frontend Lane 2a: thin spawn wrapper for the run_owner_scenario.py
// evaluator subprocess.
//
// Extracted from route.ts (like runExtractAdapter in extract_adapter.ts) to keep
// route.ts free of non-HTTP-verb exports (Next.js App Router TS strict-mode).
//
// P0 fix (2026-05-14): this module is the ONLY place that spawns the evaluator.
// It sets RRAA_V2_SUBMISSION_RETRIEVAL_ENABLED=1 in the subprocess env so every
// dashboard-triggered evaluation exercises the Commit 2-4 BM25 retrieval wiring
// (packet §11.5). Without this flag the engine defaults the flag OFF and runs the
// legacy corpus-leak path: S4 still receives submission_text via direct injection
// so AI Determinations look submission-grounded, but evidence_packet is empty
// across all policies because BM25 retrieval never fires.

import { spawn } from "child_process";
import * as fsSync from "fs";

export const SPAWN_RACE_WINDOW_MS = 500;

export interface SpawnScenarioArgs {
  pythonPath: string;
  scriptPath: string;
  scenarioConfigPath: string;
  outputDir: string;
}

export async function spawnScenarioRunner(
  args: SpawnScenarioArgs,
): Promise<void> {
  const cli = [
    args.scriptPath,
    "--scenario-config",
    args.scenarioConfigPath,
    "--output-dir",
    args.outputDir,
  ];

  // Capture subprocess stdout/stderr to log files in the run dir so a crash
  // is diagnosable from the dashboard (previously stdio:'ignore' threw away
  // the engine's anti-leak guard error, costing a 30-min stale-timeout to
  // surface). The stale-handler in /evaluation-status reads stderr.log
  // when present and appends a tail into v2_evaluations.errors.
  const stdoutPath = `${args.outputDir}/subprocess_stdout.log`;
  const stderrPath = `${args.outputDir}/subprocess_stderr.log`;
  const outFd = fsSync.openSync(stdoutPath, "a");
  const errFd = fsSync.openSync(stderrPath, "a");

  const child = spawn(args.pythonPath, cli, {
    detached: true,
    stdio: ["ignore", outFd, errFd],
    windowsHide: true,
    // P0 fix: the engine defaults RRAA_V2_SUBMISSION_RETRIEVAL_ENABLED to OFF
    // (packet §11.5). Opting in explicitly so BM25 submission-side retrieval
    // fires on every dashboard eval and populates evidence_packet.
    env: {
      ...process.env,
      RRAA_V2_SUBMISSION_RETRIEVAL_ENABLED: "1",
    },
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
    const timer = setTimeout(() => settle(resolve), SPAWN_RACE_WINDOW_MS);
  });

  child.unref();
}
