import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import type { ChildProcess } from "child_process";

// vi.mock must be hoisted. The module imports `spawn` from 'child_process' and
// `* as fsSync` from 'fs' (sync openSync for log file descriptors).
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

// openSync is called before spawn to open stdout/stderr log FDs. Return a
// stable sentinel integer (42 / 43) so spawn opts can assert the fd values.
vi.mock("fs", async (importActual) => {
  const actual = await importActual<typeof import("fs")>();
  const openSyncMock = vi.fn((p: string) => (p.includes("stdout") ? 42 : 43));
  const overlay = { ...actual, openSync: openSyncMock };
  return { ...overlay, default: overlay };
});

import { spawnScenarioRunner } from "../spawn_scenario";

const BASE_ARGS = {
  pythonPath: "C:/Python311/pythonw.exe",
  scriptPath: "C:/scripts/run_owner_scenario.py",
  scenarioConfigPath: "C:/runs/eval-1/scenario.yaml",
  outputDir: "C:/runs/eval-1",
};

// Build a fake ChildProcess (EventEmitter + .unref) identical to the pattern
// used in spawn_extraction.test.ts.
function makeFakeChild() {
  const ee = new EventEmitter() as EventEmitter & {
    unref: ReturnType<typeof vi.fn>;
  };
  ee.unref = vi.fn();
  return ee;
}

describe("spawnScenarioRunner", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it("invokes spawn with the base CLI shape when derivePolicyText/policyTextWorkspace are absent", async () => {
    const fake = makeFakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => fake.emit("spawn"));
      return fake as unknown as ChildProcess;
    });

    await spawnScenarioRunner(BASE_ARGS);

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [pythonPath, cliArgs] = spawnMock.mock.calls[0] as [
      string,
      string[],
    ];
    expect(pythonPath).toBe(BASE_ARGS.pythonPath);
    expect(cliArgs).toEqual([
      BASE_ARGS.scriptPath,
      "--scenario-config",
      BASE_ARGS.scenarioConfigPath,
      "--output-dir",
      BASE_ARGS.outputDir,
    ]);
  });

  it("appends --derive-policy-text when derivePolicyText is true", async () => {
    const fake = makeFakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => fake.emit("spawn"));
      return fake as unknown as ChildProcess;
    });

    await spawnScenarioRunner({ ...BASE_ARGS, derivePolicyText: true });

    const [, cliArgs] = spawnMock.mock.calls[0] as [string, string[]];
    expect(cliArgs).toContain("--derive-policy-text");
    // Confirm it appears after the base args (order matters for argparse).
    const deriveIdx = cliArgs.indexOf("--derive-policy-text");
    const outputIdx = cliArgs.indexOf("--output-dir");
    expect(deriveIdx).toBeGreaterThan(outputIdx);
  });

  it("does NOT append --derive-policy-text when derivePolicyText is false", async () => {
    const fake = makeFakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => fake.emit("spawn"));
      return fake as unknown as ChildProcess;
    });

    await spawnScenarioRunner({ ...BASE_ARGS, derivePolicyText: false });

    const [, cliArgs] = spawnMock.mock.calls[0] as [string, string[]];
    expect(cliArgs).not.toContain("--derive-policy-text");
  });

  it("does NOT append --derive-policy-text when derivePolicyText is undefined", async () => {
    const fake = makeFakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => fake.emit("spawn"));
      return fake as unknown as ChildProcess;
    });

    await spawnScenarioRunner({ ...BASE_ARGS, derivePolicyText: undefined });

    const [, cliArgs] = spawnMock.mock.calls[0] as [string, string[]];
    expect(cliArgs).not.toContain("--derive-policy-text");
  });

  it("appends --policy-text-workspace + value when policyTextWorkspace is set", async () => {
    const fake = makeFakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => fake.emit("spawn"));
      return fake as unknown as ChildProcess;
    });

    const workspace = "C:\\Projects\\Sediment-DRA-Pipeline\\lightrag_workspace";
    await spawnScenarioRunner({ ...BASE_ARGS, policyTextWorkspace: workspace });

    const [, cliArgs] = spawnMock.mock.calls[0] as [string, string[]];
    const idx = cliArgs.indexOf("--policy-text-workspace");
    expect(idx).toBeGreaterThan(-1);
    expect(cliArgs[idx + 1]).toBe(workspace);
  });

  it("does NOT append --policy-text-workspace when policyTextWorkspace is undefined", async () => {
    const fake = makeFakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => fake.emit("spawn"));
      return fake as unknown as ChildProcess;
    });

    await spawnScenarioRunner({ ...BASE_ARGS, policyTextWorkspace: undefined });

    const [, cliArgs] = spawnMock.mock.calls[0] as [string, string[]];
    expect(cliArgs).not.toContain("--policy-text-workspace");
  });

  it("appends both flags when both are set", async () => {
    const fake = makeFakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => fake.emit("spawn"));
      return fake as unknown as ChildProcess;
    });

    const workspace = "C:\\Projects\\lightrag_ws";
    await spawnScenarioRunner({
      ...BASE_ARGS,
      derivePolicyText: true,
      policyTextWorkspace: workspace,
    });

    const [, cliArgs] = spawnMock.mock.calls[0] as [string, string[]];
    expect(cliArgs).toContain("--derive-policy-text");
    const idx = cliArgs.indexOf("--policy-text-workspace");
    expect(idx).toBeGreaterThan(-1);
    expect(cliArgs[idx + 1]).toBe(workspace);
  });

  it("appends --retrieval-backend + value as two argv elements when retrievalBackend is set", async () => {
    const fake = makeFakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => fake.emit("spawn"));
      return fake as unknown as ChildProcess;
    });

    await spawnScenarioRunner({ ...BASE_ARGS, retrievalBackend: "lightrag" });

    const [, cliArgs] = spawnMock.mock.calls[0] as [string, string[]];
    const idx = cliArgs.indexOf("--retrieval-backend");
    expect(idx).toBeGreaterThan(-1);
    expect(cliArgs[idx + 1]).toBe("lightrag");
  });

  it("does NOT append --retrieval-backend when retrievalBackend is undefined", async () => {
    const fake = makeFakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => fake.emit("spawn"));
      return fake as unknown as ChildProcess;
    });

    await spawnScenarioRunner({ ...BASE_ARGS, retrievalBackend: undefined });

    const [, cliArgs] = spawnMock.mock.calls[0] as [string, string[]];
    expect(cliArgs).not.toContain("--retrieval-backend");
  });

  it("appends --retrieval-workspace + value as two argv elements when retrievalWorkspace is set", async () => {
    const fake = makeFakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => fake.emit("spawn"));
      return fake as unknown as ChildProcess;
    });

    const workspace = "C:\\Projects\\Sediment-DRA-Pipeline\\lightrag_workspace";
    await spawnScenarioRunner({ ...BASE_ARGS, retrievalWorkspace: workspace });

    const [, cliArgs] = spawnMock.mock.calls[0] as [string, string[]];
    const idx = cliArgs.indexOf("--retrieval-workspace");
    expect(idx).toBeGreaterThan(-1);
    expect(cliArgs[idx + 1]).toBe(workspace);
  });

  it("does NOT append --retrieval-workspace when retrievalWorkspace is undefined", async () => {
    const fake = makeFakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => fake.emit("spawn"));
      return fake as unknown as ChildProcess;
    });

    await spawnScenarioRunner({ ...BASE_ARGS, retrievalWorkspace: undefined });

    const [, cliArgs] = spawnMock.mock.calls[0] as [string, string[]];
    expect(cliArgs).not.toContain("--retrieval-workspace");
  });

  it("appends all four Phase 2 flags when all are set", async () => {
    const fake = makeFakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => fake.emit("spawn"));
      return fake as unknown as ChildProcess;
    });

    const workspace = "C:\\Projects\\lightrag_ws";
    await spawnScenarioRunner({
      ...BASE_ARGS,
      retrievalBackend: "lightrag",
      retrievalWorkspace: workspace,
      derivePolicyText: true,
      policyTextWorkspace: workspace,
    });

    const [, cliArgs] = spawnMock.mock.calls[0] as [string, string[]];
    const rbIdx = cliArgs.indexOf("--retrieval-backend");
    expect(rbIdx).toBeGreaterThan(-1);
    expect(cliArgs[rbIdx + 1]).toBe("lightrag");
    const rwIdx = cliArgs.indexOf("--retrieval-workspace");
    expect(rwIdx).toBeGreaterThan(-1);
    expect(cliArgs[rwIdx + 1]).toBe(workspace);
    expect(cliArgs).toContain("--derive-policy-text");
    const ptIdx = cliArgs.indexOf("--policy-text-workspace");
    expect(ptIdx).toBeGreaterThan(-1);
    expect(cliArgs[ptIdx + 1]).toBe(workspace);
  });

  it("backward-compat: BASE_ARGS (no phase-2 fields) yields the pre-Phase-2 5-element cli array", async () => {
    const fake = makeFakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => fake.emit("spawn"));
      return fake as unknown as ChildProcess;
    });

    await spawnScenarioRunner(BASE_ARGS);

    const [, cliArgs] = spawnMock.mock.calls[0] as [string, string[]];
    // Golden equality: exactly the 5-element pre-Phase-2 list. Omitting all
    // optional phase-2 fields (retrievalBackend, retrievalWorkspace,
    // derivePolicyText, policyTextWorkspace) must not expand the array.
    expect(cliArgs).toEqual([
      BASE_ARGS.scriptPath,
      "--scenario-config",
      BASE_ARGS.scenarioConfigPath,
      "--output-dir",
      BASE_ARGS.outputDir,
    ]);
  });

  it("sets RRAA_V2_SUBMISSION_RETRIEVAL_ENABLED=1 in subprocess env (P0 fix invariant)", async () => {
    const fake = makeFakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => fake.emit("spawn"));
      return fake as unknown as ChildProcess;
    });

    await spawnScenarioRunner(BASE_ARGS);

    const [, , opts] = spawnMock.mock.calls[0] as [
      string,
      string[],
      { env?: Record<string, string> },
    ];
    expect(opts.env?.RRAA_V2_SUBMISSION_RETRIEVAL_ENABLED).toBe("1");
  });

  it("opens stdout/stderr log files in the outputDir before spawning", async () => {
    const fake = makeFakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => fake.emit("spawn"));
      return fake as unknown as ChildProcess;
    });

    await spawnScenarioRunner(BASE_ARGS);

    // Confirm stdio uses the fd sentinels returned by our openSync mock (42/43).
    const [, , opts] = spawnMock.mock.calls[0] as [
      string,
      string[],
      { stdio?: unknown[] },
    ];
    expect(opts.stdio).toEqual(["ignore", 42, 43]);
  });

  it("rejects when child emits async ENOENT error", async () => {
    const fake = makeFakeChild();
    spawnMock.mockImplementation(() => {
      setImmediate(() => {
        const err = new Error("spawn ENOENT") as NodeJS.ErrnoException;
        err.code = "ENOENT";
        fake.emit("error", err);
      });
      return fake as unknown as ChildProcess;
    });

    await expect(spawnScenarioRunner(BASE_ARGS)).rejects.toThrow(/ENOENT/);
  });
});
