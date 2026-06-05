// engine_v2 frontend Lane 1 / Module L1-4b: subprocess runner for the
// propose_applicable_policies_cli.py engine script.
//
// Contract source-of-truth: engine commit 6df0f87e
// (engine_v2/scripts/propose_applicable_policies_cli.py).
// Fixture: src/lib/engine-v2/fixtures/proposer_cli/sample_output_warp_like.json
// Re-copy fixture on engine CLI contract change.
//
// Modelled on extract_adapter.ts (settle-once, deadline + SIGTERM + 2s SIGKILL
// grace) with two differences:
//   1. stdout is accumulated into a string (payloads up to ~2MB; spawn+pipe has
//      no maxBuffer cap for accumulated string builds).
//   2. The SUCCESS/exit-code path settles on the child "close" event, NOT "exit".
//      Node guarantees stdio streams are fully flushed only at "close"; on
//      multi-MB stdout the final chunks can arrive after "exit", which would
//      otherwise cause flaky truncated-JSON parse errors.
//
// Deferred nit (P3): no request-abort / AbortSignal hookup is wired here. Child
// lifetime is already bounded by the 60s SIGTERM/SIGKILL ladder below, so an
// aborted HTTP request leaves at most one short-lived subprocess; wiring an
// AbortSignal to kill the child eagerly on client disconnect is a future
// refinement, not a correctness gap.

import { spawn } from "child_process";
import * as path from "path";

export const PROPOSE_TIMEOUT_MS = 60000;
const PROPOSE_SIGKILL_GRACE_MS = 2000;
const PROPOSE_STDERR_TAIL_BYTES = 1000;

// ProposerSignalEntry: one entry from signal_fired.
export interface ProposerSignalEntry {
  policy_id: string;
  score: number;
  rationale: string;
  inclusive_fallback: boolean;
}

// ProposerCounts: counts block from the CLI output.
export interface ProposerCounts {
  total_scored: number;
  signal_fired_count: number;
  floor_tail_count: number;
  ceiling_hit: boolean;
}

// ProposerCliOutput: the typed CLI contract.
// schema_version must be "proposer_cli/0.1.0".
export interface ProposerCliOutput {
  schema_version: string;
  app_context_echo: Record<string, unknown>;
  signal_fired: ProposerSignalEntry[];
  floor_tail_policy_ids: string[];
  counts: ProposerCounts;
}

export interface RunProposeCliArgs {
  pythonPath: string;
  cliPath: string;
  appContextPath: string;
  timeoutMs?: number;
}

// Result of the shape validation: ok=true OR a reason string naming the first
// violation (with index where applicable) so callers can surface actionable
// detail.
type ShapeCheck = { ok: true } | { ok: false; reason: string };

// Validate the parsed CLI output against the proposer_cli/0.1.0 contract,
// including a per-entry guard over signal_fired and floor_tail_policy_ids.
function validateProposerOutput(v: unknown): ShapeCheck {
  if (!v || typeof v !== "object") {
    return { ok: false, reason: "output is not an object" };
  }
  const o = v as Record<string, unknown>;
  if (o["schema_version"] !== "proposer_cli/0.1.0") {
    return { ok: false, reason: "schema_version mismatch" };
  }
  if (!Array.isArray(o["signal_fired"])) {
    return { ok: false, reason: "signal_fired missing or not an array" };
  }
  if (!Array.isArray(o["floor_tail_policy_ids"])) {
    return { ok: false, reason: "floor_tail_policy_ids missing or not an array" };
  }
  if (!o["counts"] || typeof o["counts"] !== "object") {
    return { ok: false, reason: "counts missing or not an object" };
  }

  // Per-entry guard over signal_fired.
  const signal = o["signal_fired"] as unknown[];
  for (let i = 0; i < signal.length; i++) {
    const e = signal[i];
    if (!e || typeof e !== "object") {
      return { ok: false, reason: `signal_fired[${i}] is not an object` };
    }
    const entry = e as Record<string, unknown>;
    if (typeof entry["policy_id"] !== "string" || entry["policy_id"].length === 0) {
      return { ok: false, reason: `signal_fired[${i}].policy_id is not a non-empty string` };
    }
    if (typeof entry["score"] !== "number" || !Number.isFinite(entry["score"])) {
      return { ok: false, reason: `signal_fired[${i}].score is not a finite number` };
    }
    if (typeof entry["rationale"] !== "string") {
      return { ok: false, reason: `signal_fired[${i}].rationale is not a string` };
    }
  }

  // Per-entry guard over floor_tail_policy_ids.
  const floor = o["floor_tail_policy_ids"] as unknown[];
  for (let i = 0; i < floor.length; i++) {
    if (typeof floor[i] !== "string" || (floor[i] as string).length === 0) {
      return { ok: false, reason: `floor_tail_policy_ids[${i}] is not a non-empty string` };
    }
  }

  return { ok: true };
}

// Derive the engine PYTHONPATH src dir from the CLI path. The proposer CLI lives
// at engine_v2/scripts/propose_applicable_policies_cli.py and imports the
// rraa_v2 package from engine_v2/src. Unlike the extract adapter (which
// self-bootstraps sys.path), the propose CLI deliberately does NOT, so we must
// supply PYTHONPATH ourselves -- mirroring run_owner_scenario.py's
// env["PYTHONPATH"] = _SRC_DIR convention (where _SRC_DIR = scripts/../src).
// Without it the CLI exits 1 with "No module named 'rraa_v2'".
function deriveSrcDir(cliPath: string): string {
  return path.resolve(path.dirname(cliPath), "..", "src");
}

// runProposeCli: spawn the engine proposer CLI, accumulate stdout, parse JSON.
// Resolves with ProposerCliOutput on exit 0 + valid shape.
// Rejects with an Error on non-zero exit, JSON parse failure, or timeout.
export async function runProposeCli(
  args: RunProposeCliArgs,
): Promise<ProposerCliOutput> {
  const cli = [args.cliPath, "--app-context", args.appContextPath];
  const timeoutMs = args.timeoutMs ?? PROPOSE_TIMEOUT_MS;

  const srcDir = deriveSrcDir(args.cliPath);
  const existingPythonPath = process.env.PYTHONPATH;
  const pythonPathEnv = existingPythonPath
    ? srcDir + path.delimiter + existingPythonPath
    : srcDir;

  return new Promise<ProposerCliOutput>((resolve, reject) => {
    const child = spawn(args.pythonPath, cli, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONPATH: pythonPathEnv,
      },
    });

    let stdoutBuf = "";
    let stderrBuf = "";
    let promiseSettled = false;
    let timedOut = false;
    let exitCode: number | null = null;
    let killTimer: NodeJS.Timeout | null = null;

    child.stdout?.on("data", (d: Buffer) => {
      stdoutBuf += d.toString();
    });
    child.stderr?.on("data", (d: Buffer) => {
      stderrBuf += d.toString();
    });

    const settlePromise = (fn: () => void): void => {
      if (promiseSettled) return;
      promiseSettled = true;
      clearTimeout(deadline);
      fn();
    };

    const deadline = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGTERM");
      } catch {
        // ignore
      }
      killTimer = setTimeout(() => {
        killTimer = null;
        try {
          if (child.exitCode === null && child.signalCode === null) {
            child.kill("SIGKILL");
          }
        } catch {
          // ignore
        }
      }, PROPOSE_SIGKILL_GRACE_MS);
      const tail = stderrBuf.slice(-PROPOSE_STDERR_TAIL_BYTES).trim();
      settlePromise(() =>
        reject(
          new Error(
            `propose_timeout: ${timeoutMs}ms exceeded. stderr=${tail || "null"}`,
          ),
        ),
      );
    }, timeoutMs);

    child.once("error", (err) => settlePromise(() => reject(err)));

    // Record the exit code, but do NOT settle here. Node only guarantees stdio
    // streams are fully flushed at "close"; settling on "exit" can truncate
    // multi-MB stdout. Cancel the SIGKILL grace timer if the child exited
    // cleanly before the timeout fired.
    child.once("exit", (code) => {
      exitCode = code;
      if (killTimer !== null) {
        clearTimeout(killTimer);
        killTimer = null;
      }
    });

    // SUCCESS / exit-code path settles on "close" (streams fully flushed).
    child.once("close", (closeCode) => {
      if (timedOut) return; // Promise already rejected.

      // Prefer the exit code captured on "exit"; fall back to the close code.
      const code = exitCode !== null ? exitCode : closeCode;

      if (code !== 0) {
        const tail = stderrBuf.slice(-400).trim();
        settlePromise(() =>
          reject(
            new Error(
              `proposer_exit_${String(code)}: ${tail}`,
            ),
          ),
        );
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(stdoutBuf);
      } catch (parseErr) {
        settlePromise(() =>
          reject(
            new Error(
              `propose_parse_error: ${(parseErr as Error).message}. stdout_head=${stdoutBuf.slice(0, 200)}`,
            ),
          ),
        );
        return;
      }

      const check = validateProposerOutput(parsed);
      if (!check.ok) {
        settlePromise(() =>
          reject(
            new Error(
              `propose_shape_invalid: ${check.reason}. stdout_head=${stdoutBuf.slice(0, 200)}`,
            ),
          ),
        );
        return;
      }

      settlePromise(() => resolve(parsed as ProposerCliOutput));
    });
  });
}
