// Route-level unit tests for the evaluate POST handler's adapter timeout
// (Codex Round 1 fix, Lane 2c retro) and spawn env regression (P0 fix 2026-05-14).
//
// Covers runExtractAdapter:
//   - 60s timeout fires when the subprocess never exits; SIGTERM is sent first,
//     SIGKILL after 2s grace, rejection message starts with
//     "adapter_timeout: 60000ms exceeded" and contains the on-disk stderr tail.
//   - When subprocess_stderr.log is absent, the stderr tail is the literal
//     string "null" (so log-greppers can match a deterministic shape).
//
// Covers spawnScenarioRunner (P0 regression guard):
//   - spawn() is called with env.RRAA_V2_SUBMISSION_RETRIEVAL_ENABLED === "1"
//     so BM25 submission-side retrieval fires on every dashboard eval.
//   - The pre-fix absence of the flag would cause this test to fail (verified by
//     inverting the assertion before applying the fix).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import * as fsSync from "fs";
import * as os from "os";
import * as path from "path";

// Hoisted mock for child_process.spawn (vi.mock must be at module top level).
const spawnMock = vi.fn();
vi.mock("child_process", async (importActual) => {
  const actual = await importActual<typeof import("child_process")>();
  const overlay = {
    ...actual,
    spawn: (...args: unknown[]) => spawnMock(...args),
  };
  return {
    ...overlay,
    default: overlay,
  };
});

// Import AFTER the mock so the route uses the hoisted spawn.
import {
  runExtractAdapter,
  ADAPTER_TIMEOUT_MS,
} from "@/lib/engine-v2/extract_adapter";
import { tailLogFile as tailStderrLog } from "@/lib/engine-v2/log_tail";
import { spawnScenarioRunner } from "@/lib/engine-v2/spawn_scenario";

interface FakeChild extends EventEmitter {
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
}

function makeFakeChild(): FakeChild {
  const ee = new EventEmitter() as FakeChild;
  ee.stderr = new EventEmitter();
  ee.kill = vi.fn();
  ee.exitCode = null;
  ee.signalCode = null;
  return ee;
}

describe("runExtractAdapter timeout", () => {
  let tmpDir = "";

  beforeEach(() => {
    spawnMock.mockReset();
    tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), "rea-timeout-"));
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    try {
      fsSync.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("fires SIGTERM at the timeout, SIGKILL after the 2s grace, and rejects with adapter_timeout shape", async () => {
    const fake = makeFakeChild();
    spawnMock.mockReturnValue(fake);

    // Seed a stderr log so the rejection message includes the tail.
    fsSync.writeFileSync(
      path.join(tmpDir, "subprocess_stderr.log"),
      "boom: adapter failed somewhere",
      "utf-8",
    );

    const p = runExtractAdapter({
      pythonPath: "C:/python/pythonw.exe",
      adapterPath: "C:/scripts/extract_to_submission_adapter.py",
      inputPath: "C:/in/verbatim.json",
      outputPath: "C:/out/submission.json",
      evalRunDir: tmpDir,
      // Use the real default so the error message asserts "60000ms exceeded"
      // verbatim per spec.
      timeoutMs: ADAPTER_TIMEOUT_MS,
    });

    // Catch the promise rejection eagerly so vitest does not flag it as
    // unhandled while we advance fake timers.
    let rejectedWith: Error | null = null;
    const tracked = p.catch((err: Error) => {
      rejectedWith = err;
      return null;
    });

    // Advance to the timeout: SIGTERM is sent, killTimer is armed.
    await vi.advanceTimersByTimeAsync(ADAPTER_TIMEOUT_MS);
    expect(fake.kill).toHaveBeenCalledWith("SIGTERM");

    // Advance past the 2s grace; child has not exited, so SIGKILL fires.
    await vi.advanceTimersByTimeAsync(2000);
    expect(fake.kill).toHaveBeenCalledWith("SIGKILL");

    // The promise is already rejected at the timeout instant. Wait for it.
    await tracked;
    expect(rejectedWith).not.toBeNull();
    const msg = (rejectedWith as unknown as Error).message;
    expect(msg).toContain("adapter_timeout: 60000ms exceeded");
    expect(msg).toContain("boom: adapter failed somewhere");
  });

  it("when subprocess_stderr.log is absent, rejection message has stderr=null literal", async () => {
    const fake = makeFakeChild();
    spawnMock.mockReturnValue(fake);

    // No stderr file written -- tailStderrLog should return null.
    const p = runExtractAdapter({
      pythonPath: "C:/python/pythonw.exe",
      adapterPath: "C:/scripts/extract_to_submission_adapter.py",
      inputPath: "C:/in/verbatim.json",
      outputPath: "C:/out/submission.json",
      evalRunDir: tmpDir,
      timeoutMs: ADAPTER_TIMEOUT_MS,
    });
    let rejectedWith: Error | null = null;
    const tracked = p.catch((err: Error) => {
      rejectedWith = err;
      return null;
    });

    await vi.advanceTimersByTimeAsync(ADAPTER_TIMEOUT_MS);
    await tracked;

    expect(rejectedWith).not.toBeNull();
    const msg = (rejectedWith as unknown as Error).message;
    expect(msg).toContain("adapter_timeout: 60000ms exceeded");
    expect(msg).toContain("stderr=null");
  });
});

describe("tailStderrLog", () => {
  let tmpDir = "";

  beforeEach(() => {
    tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), "rea-tail-"));
  });

  afterEach(() => {
    try {
      fsSync.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("returns null when the file does not exist", () => {
    const p = path.join(tmpDir, "missing.log");
    expect(tailStderrLog(p, 1000)).toBeNull();
  });

  it("returns the last N bytes when the file is larger than N", () => {
    const p = path.join(tmpDir, "big.log");
    const filler = "x".repeat(500);
    const tail = "tail-marker-content";
    fsSync.writeFileSync(p, filler + tail, "utf-8");
    const result = tailStderrLog(p, tail.length);
    expect(result).toBe(tail);
  });

  it("returns the whole file when shorter than N", () => {
    const p = path.join(tmpDir, "small.log");
    fsSync.writeFileSync(p, "short content", "utf-8");
    expect(tailStderrLog(p, 1000)).toBe("short content");
  });
});

// P0 regression guard (2026-05-14): spawnScenarioRunner must pass
// RRAA_V2_SUBMISSION_RETRIEVAL_ENABLED=1 in the subprocess env.
//
// Without this flag the engine runs the legacy corpus-leak path and returns an
// empty evidence_packet across all policies (packet §11.5). This test fails on
// the pre-fix code and passes on the fixed code, confirming the spawn site is
// correct. The guard was validated empirically on eval 8bfc1c30 (site 13254
// Stage 2 PSI, 2026-05-14): 43/43 policies returned "No submission evidence
// cited" before the fix.
describe("spawnScenarioRunner -- P0 env var regression guard", () => {
  let tmpDir = "";

  beforeEach(() => {
    spawnMock.mockReset();
    tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), "spawn-scenario-"));
    vi.useFakeTimers();
    // Create the output dir so openSync calls on stdout/stderr log paths succeed.
    fsSync.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    try {
      fsSync.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("passes RRAA_V2_SUBMISSION_RETRIEVAL_ENABLED=1 in the subprocess env", async () => {
    // Return a fake child that emits 'spawn' so the promise resolves cleanly.
    const fake = new EventEmitter() as EventEmitter & {
      unref: ReturnType<typeof vi.fn>;
    };
    fake.unref = vi.fn();
    spawnMock.mockReturnValue(fake);

    const p = spawnScenarioRunner({
      pythonPath: "C:/python/pythonw.exe",
      scriptPath: "C:/scripts/run_owner_scenario.py",
      scenarioConfigPath: path.join(tmpDir, "scenario.yaml"),
      outputDir: tmpDir,
    });

    // Emit 'spawn' so spawnScenarioRunner resolves.
    fake.emit("spawn");
    await p;

    expect(spawnMock).toHaveBeenCalledOnce();
    const spawnOptions = spawnMock.mock.calls[0]?.[2] as {
      env?: Record<string, string>;
    };
    expect(spawnOptions?.env?.["RRAA_V2_SUBMISSION_RETRIEVAL_ENABLED"]).toBe(
      "1",
    );
  });

  it("inherits process.env alongside the new flag (no env isolation)", async () => {
    // This confirms ...process.env is spread, not replaced, so PATH etc. survive.
    const fake = new EventEmitter() as EventEmitter & {
      unref: ReturnType<typeof vi.fn>;
    };
    fake.unref = vi.fn();
    spawnMock.mockReturnValue(fake);

    // Set a canary var in process.env to verify it is inherited.
    const originalCanary = process.env["RRAA_TEST_CANARY"];
    process.env["RRAA_TEST_CANARY"] = "canary-value";

    try {
      const p = spawnScenarioRunner({
        pythonPath: "C:/python/pythonw.exe",
        scriptPath: "C:/scripts/run_owner_scenario.py",
        scenarioConfigPath: path.join(tmpDir, "scenario.yaml"),
        outputDir: tmpDir,
      });
      fake.emit("spawn");
      await p;

      const spawnOptions = spawnMock.mock.calls[0]?.[2] as {
        env?: Record<string, string>;
      };
      // Both the new flag AND the inherited canary must be present.
      expect(spawnOptions?.env?.["RRAA_V2_SUBMISSION_RETRIEVAL_ENABLED"]).toBe(
        "1",
      );
      expect(spawnOptions?.env?.["RRAA_TEST_CANARY"]).toBe("canary-value");
    } finally {
      if (originalCanary === undefined) {
        delete process.env["RRAA_TEST_CANARY"];
      } else {
        process.env["RRAA_TEST_CANARY"] = originalCanary;
      }
    }
  });
});
