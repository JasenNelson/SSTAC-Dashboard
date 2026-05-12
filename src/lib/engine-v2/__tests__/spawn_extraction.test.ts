import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import type { ChildProcess } from "child_process";

// vi.mock must be hoisted; the helper imports `spawn` from 'child_process'.
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

import { spawnExtractor } from "../spawn_extraction";

const ARGS = {
  pythonPath: "C:/Python311/pythonw.exe",
  scriptPath: "C:/scripts/dashboard_extract.py",
  sourceDir: "C:/staging/uploads/p1",
  outputDir: "C:/staging/extracts/p1",
  progressFilePath: "C:/staging/uploads/p1/.extraction_status.json",
};

// Build a fake ChildProcess that exposes the EventEmitter interface plus the
// .unref() method that spawnExtractor calls after the spawn/error race settles.
function makeFakeChild() {
  const ee = new EventEmitter() as EventEmitter & { unref: ReturnType<typeof vi.fn> };
  ee.unref = vi.fn();
  return ee;
}

describe("spawnExtractor", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it("invokes child_process.spawn with the pinned arg shape on a successful start", async () => {
    const fake = makeFakeChild();
    spawnMock.mockImplementation(() => {
      // Emit 'spawn' asynchronously, the way Node really does.
      setImmediate(() => fake.emit("spawn"));
      return fake as unknown as ChildProcess;
    });

    const child = await spawnExtractor(ARGS);
    expect(child).toBeTruthy();
    expect(fake.unref).toHaveBeenCalledTimes(1);

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [pythonPath, cliArgs, opts] = spawnMock.mock.calls[0] as [
      string,
      string[],
      Record<string, unknown>,
    ];
    expect(pythonPath).toBe(ARGS.pythonPath);
    expect(cliArgs).toEqual([
      ARGS.scriptPath,
      "--source-dir",
      ARGS.sourceDir,
      "--output-dir",
      ARGS.outputDir,
      "--progress-file",
      ARGS.progressFilePath,
    ]);
    expect(opts).toEqual({
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
  });

  it("rejects when child emits async ENOENT error (regression: codex blocker)", async () => {
    const fake = makeFakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => {
        const err = new Error("spawn ENOENT") as NodeJS.ErrnoException;
        err.code = "ENOENT";
        fake.emit("error", err);
      });
      return fake as unknown as ChildProcess;
    });

    await expect(spawnExtractor(ARGS)).rejects.toThrow(/ENOENT/);
    expect(fake.unref).not.toHaveBeenCalled();
  });

  it("rejects when child emits async EACCES error", async () => {
    const fake = makeFakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => {
        const err = new Error("spawn EACCES") as NodeJS.ErrnoException;
        err.code = "EACCES";
        fake.emit("error", err);
      });
      return fake as unknown as ChildProcess;
    });

    await expect(spawnExtractor(ARGS)).rejects.toThrow(/EACCES/);
    expect(fake.unref).not.toHaveBeenCalled();
  });

  it("propagates synchronous spawn-throw (legacy code path)", async () => {
    spawnMock.mockImplementation(() => {
      const err = new Error("spawn ENOENT sync") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      throw err;
    });

    await expect(spawnExtractor(ARGS)).rejects.toThrow(/ENOENT sync/);
  });
});
