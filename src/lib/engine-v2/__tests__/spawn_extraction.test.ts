import { describe, it, expect, vi, beforeEach } from "vitest";
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

describe("spawnExtractor", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it("invokes child_process.spawn with the pinned arg shape", () => {
    const unref = vi.fn();
    spawnMock.mockReturnValue({ unref } as unknown as ChildProcess);

    const child = spawnExtractor(ARGS);
    expect(child).toBeTruthy();
    expect(unref).toHaveBeenCalledTimes(1);

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

  it("propagates spawn-throw (ENOENT) so the route can catch and quarantine", () => {
    spawnMock.mockImplementation(() => {
      const err = new Error("spawn ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      throw err;
    });

    expect(() => spawnExtractor(ARGS)).toThrow(/ENOENT/);
  });

  it("propagates EACCES the same way", () => {
    spawnMock.mockImplementation(() => {
      const err = new Error("spawn EACCES") as NodeJS.ErrnoException;
      err.code = "EACCES";
      throw err;
    });

    expect(() => spawnExtractor(ARGS)).toThrow(/EACCES/);
  });
});
