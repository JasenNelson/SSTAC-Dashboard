// Route-level unit tests for the evaluate POST handler's adapter timeout
// (Codex Round 1 fix, Lane 2c retro).
//
// Covers runExtractAdapter:
//   - 60s timeout fires when the subprocess never exits; SIGTERM is sent first,
//     SIGKILL after 2s grace, rejection message starts with
//     "adapter_timeout: 60000ms exceeded" and contains the on-disk stderr tail.
//   - When subprocess_stderr.log is absent, the stderr tail is the literal
//     string "null" (so log-greppers can match a deterministic shape).

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
import { runExtractAdapter, ADAPTER_TIMEOUT_MS, tailStderrLog } from "../route";

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
