// Shared extract-adapter runner for engine_v2 route handlers.
//
// Runs the engine's extract_to_submission_adapter subprocess to convert a
// Lane 1 Docling VERBATIM JSON into a typed submission JSON. Exported here
// (not from route.ts) so it can be imported by unit tests without causing
// Next.js App Router TS strict-mode errors on non-HTTP-verb route exports.

import { spawn } from "child_process";
import * as path from "path";
import { tailLogFile } from "@/lib/engine-v2/log_tail";

export const ADAPTER_TIMEOUT_MS = 60000;
const ADAPTER_SIGKILL_GRACE_MS = 2000;
const ADAPTER_STDERR_TAIL_BYTES = 1000;

export async function runExtractAdapter(args: {
  pythonPath: string;
  adapterPath: string;
  inputPath: string;
  outputPath: string;
  evalRunDir: string;
  timeoutMs?: number;
}): Promise<void> {
  const cli = [
    args.adapterPath,
    "--input",
    args.inputPath,
    "--output",
    args.outputPath,
  ];
  const timeoutMs = args.timeoutMs ?? ADAPTER_TIMEOUT_MS;
  const stderrLogPath = path.join(args.evalRunDir, "subprocess_stderr.log");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(args.pythonPath, cli, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stderrBuf = "";
    let promiseSettled = false;
    let timedOut = false;
    let killTimer: NodeJS.Timeout | null = null;
    child.stderr?.on("data", (d) => {
      stderrBuf += d.toString();
    });
    const settlePromise = (fn: () => void): void => {
      if (promiseSettled) return;
      promiseSettled = true;
      clearTimeout(deadline);
      fn();
    };
    const deadline = setTimeout(() => {
      // Timeout: send SIGTERM immediately, arm a 2s grace timer for SIGKILL,
      // and reject the promise now. The killTimer is intentionally NOT
      // cleared by settlePromise so the SIGKILL fallback fires even after
      // the route has already moved on. Reject message uses the tail of
      // subprocess_stderr.log per spec; "stderr=null" when absent.
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
      }, ADAPTER_SIGKILL_GRACE_MS);
      const fileTail = tailLogFile(stderrLogPath, ADAPTER_STDERR_TAIL_BYTES);
      const tailRepr = fileTail === null ? "null" : JSON.stringify(fileTail);
      settlePromise(() =>
        reject(
          new Error(
            `adapter_timeout: ${timeoutMs}ms exceeded. stderr=${tailRepr}`,
          ),
        ),
      );
    }, timeoutMs);
    child.once("error", (err) => settlePromise(() => reject(err)));
    child.once("exit", (code) => {
      // If the process exits cleanly before the 2s grace, cancel the SIGKILL
      // fallback so we do not signal a dead process.
      if (killTimer !== null) {
        clearTimeout(killTimer);
        killTimer = null;
      }
      if (timedOut) return; // Promise already rejected.
      if (code === 0) settlePromise(resolve);
      else
        settlePromise(() =>
          reject(
            new Error(
              `adapter_exit_${code}: ${stderrBuf.trim().slice(0, 400)}`,
            ),
          ),
        );
    });
  });
}
