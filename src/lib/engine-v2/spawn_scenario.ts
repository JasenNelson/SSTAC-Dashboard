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
  // Phase 2 LightRAG graph-retrieval wiring. All four flags are omitted from the
  // subprocess CLI when not supplied (backward-compatible: absent => byte-identical
  // arg list to the pre-Phase-2 spawn). Retrieval flags driven by
  // ENGINE_V2_RETRIEVAL_BACKEND and ENGINE_V2_RETRIEVAL_WORKSPACE env vars.
  // Policy-text flags driven by ENGINE_V2_DERIVE_POLICY_TEXT and
  // ENGINE_V2_POLICY_TEXT_WORKSPACE env vars in the evaluate route.
  derivePolicyText?: boolean;
  policyTextWorkspace?: string;
  retrievalBackend?: string;
  retrievalWorkspace?: string;
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
  if (args.retrievalBackend) {
    cli.push("--retrieval-backend", args.retrievalBackend);
  }
  if (args.retrievalWorkspace) {
    cli.push("--retrieval-workspace", args.retrievalWorkspace);
  }
  if (args.derivePolicyText) {
    cli.push("--derive-policy-text");
  }
  if (args.policyTextWorkspace) {
    cli.push("--policy-text-workspace", args.policyTextWorkspace);
  }

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
