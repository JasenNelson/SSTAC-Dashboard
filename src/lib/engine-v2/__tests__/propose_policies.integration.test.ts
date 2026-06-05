// Integration test for runProposeCli: exercises the REAL proposer CLI.
//
// This test is SKIPPED on CI (ubuntu-latest) because the engine checkout and
// Python venv are not present there. It runs locally when the env var
// RR_ENGINE_INTEGRATION=1 is set AND both the CLI script and venv Python
// exist at the paths below.
//
// To run locally:
//   $env:RR_ENGINE_INTEGRATION = "1"
//   npx vitest run src/lib/engine-v2/__tests__/propose_policies.integration.test.ts
//
// Contract source-of-truth: engine commit 6df0f87e
// (engine_v2/scripts/propose_applicable_policies_cli.py).
// Re-verify this test when the CLI contract changes.

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { runProposeCli } from "../propose_policies";

// Paths to the real engine CLI and venv Python.
const VENV_PYTHON =
  "C:/Projects/Regulatory-Review-worktrees/engine-v2/engine_v2/.venv/Scripts/python.exe";
const CLI_PATH =
  "C:/Projects/Regulatory-Review-worktrees/engine-v2-m1aphase3-2026-06-05/engine_v2/scripts/propose_applicable_policies_cli.py";

// Skip conditions: env var not set or either path absent.
const integrationEnabled = process.env["RR_ENGINE_INTEGRATION"] === "1";
const pythonExists = fs.existsSync(VENV_PYTHON);
const cliExists = fs.existsSync(CLI_PATH);
const shouldRun = integrationEnabled && pythonExists && cliExists;

const skipReason = !integrationEnabled
  ? "RR_ENGINE_INTEGRATION is not set to 1"
  : !pythonExists
    ? `venv Python not found: ${VENV_PYTHON}`
    : !cliExists
      ? `proposer CLI not found: ${CLI_PATH}`
      : "";

describe.skipIf(!shouldRun)(
  `runProposeCli integration (skip: ${skipReason || "none"})`,
  () => {
    it(
      "spawns the real CLI, returns a valid proposer_cli/0.1.0 output, and counts are coherent",
      async () => {
        // Write a minimal app_context JSON to a temp file.
        const tmpDir = os.tmpdir();
        const ctxPath = path.join(tmpDir, "rr_integration_ctx_test.json");
        const appCtx = {
          selected_services: ["era-review"],
        };
        fs.writeFileSync(ctxPath, JSON.stringify(appCtx), "utf-8");

        try {
          const result = await runProposeCli({
            pythonPath: VENV_PYTHON,
            cliPath: CLI_PATH,
            appContextPath: ctxPath,
            timeoutMs: 60000,
          });

          // Schema version must match the contract.
          expect(result.schema_version).toBe("proposer_cli/0.1.0");

          // signal_fired and floor_tail_policy_ids must be arrays.
          expect(Array.isArray(result.signal_fired)).toBe(true);
          expect(Array.isArray(result.floor_tail_policy_ids)).toBe(true);

          // counts must be present with the expected numeric fields.
          expect(typeof result.counts).toBe("object");
          expect(typeof result.counts.total_scored).toBe("number");
          expect(typeof result.counts.signal_fired_count).toBe("number");
          expect(typeof result.counts.floor_tail_count).toBe("number");
          expect(typeof result.counts.ceiling_hit).toBe("boolean");

          // Counts must be non-negative.
          expect(result.counts.total_scored).toBeGreaterThanOrEqual(0);
          expect(result.counts.signal_fired_count).toBeGreaterThanOrEqual(0);
          expect(result.counts.floor_tail_count).toBeGreaterThanOrEqual(0);

          // Coherence: when ceiling was NOT hit, signal_fired_count +
          // floor_tail_count must equal total_scored.
          if (!result.counts.ceiling_hit) {
            expect(
              result.counts.signal_fired_count + result.counts.floor_tail_count,
            ).toBe(result.counts.total_scored);
          }

          // Array lengths must match the counts fields.
          expect(result.signal_fired.length).toBe(
            result.counts.signal_fired_count,
          );
          expect(result.floor_tail_policy_ids.length).toBe(
            result.counts.floor_tail_count,
          );

          // Every signal_fired entry must have a non-empty policy_id and a
          // finite score.
          for (let i = 0; i < result.signal_fired.length; i++) {
            const e = result.signal_fired[i]!;
            expect(typeof e.policy_id).toBe("string");
            expect(e.policy_id.length).toBeGreaterThan(0);
            expect(Number.isFinite(e.score)).toBe(true);
          }

          // Every floor_tail entry must be a non-empty string.
          for (let i = 0; i < result.floor_tail_policy_ids.length; i++) {
            const pid = result.floor_tail_policy_ids[i]!;
            expect(typeof pid).toBe("string");
            expect(pid.length).toBeGreaterThan(0);
          }
        } finally {
          // Clean up temp file.
          try {
            fs.unlinkSync(ctxPath);
          } catch {
            // ignore cleanup errors
          }
        }
      },
      60000, // 60s timeout for real CLI invocation
    );
  },
);
