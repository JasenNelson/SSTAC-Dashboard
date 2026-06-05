// Tests for runProposeCli in propose_policies.ts.
//
// Contract fixture: src/lib/engine-v2/fixtures/proposer_cli/sample_output_warp_like.json
// Source-of-truth: engine commit 6df0f87e. Re-copy fixture on contract change.
//
// All tests mock child_process.spawn; no real Python subprocess is spawned.
//
// NOTE on event ordering: runProposeCli settles its SUCCESS/exit-code path on the
// child "close" event (streams fully flushed), NOT "exit". Tests therefore emit
// "exit" THEN "close" to mirror Node's real lifecycle.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import type { ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";

// vi.mock must be hoisted; propose_policies.ts imports spawn from 'child_process'.
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

import {
  runProposeCli,
  PROPOSE_TIMEOUT_MS,
} from "../propose_policies";

// Load the copied contract fixture.
const FIXTURE_PATH = path.resolve(
  __dirname,
  "../fixtures/proposer_cli/sample_output_warp_like.json",
);
const FIXTURE_RAW = fs.readFileSync(FIXTURE_PATH, "utf-8");
const FIXTURE = JSON.parse(FIXTURE_RAW) as {
  schema_version: string;
  signal_fired: unknown[];
  floor_tail_policy_ids: unknown[];
  counts: unknown;
};

// cliPath uses the real engine layout so deriveSrcDir(cliPath) yields a path
// ending in engine_v2/src.
const ARGS = {
  pythonPath: "python",
  cliPath: "C:/Projects/Regulatory-Review-worktrees/engine-v2/engine_v2/scripts/propose_applicable_policies_cli.py",
  appContextPath: "C:/tmp/ctx_test.json",
};

// Build a fake ChildProcess with stdout/stderr EventEmitters and a kill mock.
function makeFakeChild() {
  const ee = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
    exitCode: number | null;
    signalCode: NodeJS.Signals | null;
  };
  ee.stdout = new EventEmitter();
  ee.stderr = new EventEmitter();
  ee.kill = vi.fn();
  ee.exitCode = null;
  ee.signalCode = null;
  return ee;
}

describe("runProposeCli", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with parsed ProposerCliOutput when child emits fixture on stdout + exit 0 + close", async () => {
    const fake = makeFakeChild();
    spawnMock.mockReturnValue(fake as unknown as ChildProcess);

    const p = runProposeCli(ARGS);

    // Emit fixture on stdout then exit then close.
    setImmediate(() => {
      fake.stdout.emit("data", Buffer.from(FIXTURE_RAW));
      fake.emit("exit", 0);
      fake.emit("close", 0);
    });

    const result = await p;
    expect(result.schema_version).toBe("proposer_cli/0.1.0");
    expect(Array.isArray(result.signal_fired)).toBe(true);
    expect(Array.isArray(result.floor_tail_policy_ids)).toBe(true);
    // Fixture has 10 signal_fired entries.
    expect(result.signal_fired).toHaveLength(10);
    expect(result.counts.signal_fired_count).toBe(3518);
  });

  it("spawns with a PYTHONPATH whose first entry ends with engine_v2/src", async () => {
    const fake = makeFakeChild();
    spawnMock.mockReturnValue(fake as unknown as ChildProcess);

    const p = runProposeCli(ARGS);
    setImmediate(() => {
      fake.stdout.emit("data", Buffer.from(FIXTURE_RAW));
      fake.emit("exit", 0);
      fake.emit("close", 0);
    });
    await p;

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [, , opts] = spawnMock.mock.calls[0] as [
      string,
      string[],
      { env?: Record<string, string> },
    ];
    expect(opts.env).toBeDefined();
    const pythonPath = opts.env!["PYTHONPATH"];
    expect(typeof pythonPath).toBe("string");
    // Derive the expected srcDir the same way the implementation does so the
    // check works on both win32 (path.delimiter=";") and posix (":").
    // On posix a Windows-style cliPath contains "C:" which embeds a colon;
    // splitting by ":" would shatter the srcDir itself, so compare via
    // startsWith on the normalised PYTHONPATH value instead.
    const expectedSrcDir = path
      .resolve(path.dirname(ARGS.cliPath), "..", "src")
      .replace(/\\/g, "/");
    const normalisedPythonPath = pythonPath!.replace(/\\/g, "/");
    expect(normalisedPythonPath.startsWith(expectedSrcDir)).toBe(true);
  });

  it("PYTHONPATH prepends srcDir ahead of an existing PYTHONPATH", async () => {
    const saved = process.env.PYTHONPATH;
    // Use a colon-free path so the test works on both win32 (delimiter=";")
    // and posix (delimiter=":"). A Windows-style "C:/..." path contains a
    // colon that posix split(":") would shatter into extra parts, and the
    // srcDir itself (derived from the Windows-style cliPath) also contains
    // "C:" on posix -- so we verify structure via startsWith/endsWith rather
    // than counting delimiter-split parts.
    const EXISTING_PYTHONPATH = "/tmp/existing/path";
    process.env.PYTHONPATH = EXISTING_PYTHONPATH;
    try {
      const fake = makeFakeChild();
      spawnMock.mockReturnValue(fake as unknown as ChildProcess);
      const p = runProposeCli(ARGS);
      setImmediate(() => {
        fake.stdout.emit("data", Buffer.from(FIXTURE_RAW));
        fake.emit("exit", 0);
        fake.emit("close", 0);
      });
      await p;
      const [, , opts] = spawnMock.mock.calls[0] as [
        string,
        string[],
        { env?: Record<string, string> },
      ];
      const pythonPath = opts.env!["PYTHONPATH"]!;
      // Derive the expected srcDir the same way the implementation does.
      const expectedSrcDir = path
        .resolve(path.dirname(ARGS.cliPath), "..", "src")
        .replace(/\\/g, "/");
      const normalisedPythonPath = pythonPath.replace(/\\/g, "/");
      // srcDir must be the prefix.
      expect(normalisedPythonPath.startsWith(expectedSrcDir)).toBe(true);
      // Existing PYTHONPATH must follow the delimiter immediately after srcDir.
      const expectedSuffix = path.delimiter + EXISTING_PYTHONPATH;
      expect(normalisedPythonPath.endsWith(expectedSuffix)).toBe(true);
      // No other content between srcDir and the existing path.
      expect(normalisedPythonPath).toBe(
        expectedSrcDir + expectedSuffix,
      );
    } finally {
      if (saved === undefined) delete process.env.PYTHONPATH;
      else process.env.PYTHONPATH = saved;
    }
  });

  it("splits stdout across multiple data events (stream chunking)", async () => {
    const fake = makeFakeChild();
    spawnMock.mockReturnValue(fake as unknown as ChildProcess);

    const p = runProposeCli(ARGS);
    const half = Math.floor(FIXTURE_RAW.length / 2);
    setImmediate(() => {
      fake.stdout.emit("data", Buffer.from(FIXTURE_RAW.slice(0, half)));
      fake.stdout.emit("data", Buffer.from(FIXTURE_RAW.slice(half)));
      fake.emit("exit", 0);
      fake.emit("close", 0);
    });

    const result = await p;
    expect(result.schema_version).toBe("proposer_cli/0.1.0");
  });

  it("parses successfully when a final stdout chunk arrives between exit and close (flush race)", async () => {
    // Regression for the exit-vs-close race: on multi-MB stdout the final chunk
    // can arrive AFTER "exit". Settling on "close" must still see the full buffer.
    const fake = makeFakeChild();
    spawnMock.mockReturnValue(fake as unknown as ChildProcess);

    const half = Math.floor(FIXTURE_RAW.length / 2);
    const p = runProposeCli(ARGS);
    setImmediate(() => {
      // First half before exit.
      fake.stdout.emit("data", Buffer.from(FIXTURE_RAW.slice(0, half)));
      fake.emit("exit", 0);
      // Final chunk arrives AFTER exit but before close.
      fake.stdout.emit("data", Buffer.from(FIXTURE_RAW.slice(half)));
      fake.emit("close", 0);
    });

    const result = await p;
    expect(result.schema_version).toBe("proposer_cli/0.1.0");
    expect(result.signal_fired).toHaveLength(10);
  });

  it("rejects on exit 2 (bad input) with stderr tail in message", async () => {
    const fake = makeFakeChild();
    spawnMock.mockReturnValue(fake as unknown as ChildProcess);

    const p = runProposeCli(ARGS);
    setImmediate(() => {
      fake.stderr.emit("data", Buffer.from("bad app_context JSON at line 1"));
      fake.emit("exit", 2);
      fake.emit("close", 2);
    });

    await expect(p).rejects.toSatisfy((err: unknown) => {
      const msg = (err as Error).message;
      return msg.includes("proposer_exit_2") && msg.includes("bad app_context");
    });
  });

  it("rejects on malformed JSON stdout", async () => {
    const fake = makeFakeChild();
    spawnMock.mockReturnValue(fake as unknown as ChildProcess);

    const p = runProposeCli(ARGS);
    setImmediate(() => {
      fake.stdout.emit("data", Buffer.from("NOT VALID JSON {{{"));
      fake.emit("exit", 0);
      fake.emit("close", 0);
    });

    await expect(p).rejects.toThrow(/propose_parse_error/);
  });

  it("rejects on wrong schema_version", async () => {
    const fake = makeFakeChild();
    spawnMock.mockReturnValue(fake as unknown as ChildProcess);

    const badOutput = {
      ...FIXTURE,
      schema_version: "proposer_cli/0.9.9",
    };

    const p = runProposeCli(ARGS);
    setImmediate(() => {
      fake.stdout.emit("data", Buffer.from(JSON.stringify(badOutput)));
      fake.emit("exit", 0);
      fake.emit("close", 0);
    });

    await expect(p).rejects.toThrow(/propose_shape_invalid/);
  });

  it("rejects when signal_fired is missing", async () => {
    const fake = makeFakeChild();
    spawnMock.mockReturnValue(fake as unknown as ChildProcess);

    const bad = {
      schema_version: "proposer_cli/0.1.0",
      app_context_echo: {},
      floor_tail_policy_ids: [],
      counts: {},
      // signal_fired deliberately omitted
    };

    const p = runProposeCli(ARGS);
    setImmediate(() => {
      fake.stdout.emit("data", Buffer.from(JSON.stringify(bad)));
      fake.emit("exit", 0);
      fake.emit("close", 0);
    });

    await expect(p).rejects.toThrow(/propose_shape_invalid/);
  });

  it("rejects with index when a signal_fired entry has an empty policy_id", async () => {
    const fake = makeFakeChild();
    spawnMock.mockReturnValue(fake as unknown as ChildProcess);

    const bad = {
      schema_version: "proposer_cli/0.1.0",
      app_context_echo: {},
      signal_fired: [
        { policy_id: "OK-001", score: 1, rationale: "r", inclusive_fallback: false },
        { policy_id: "", score: 1, rationale: "r", inclusive_fallback: false },
      ],
      floor_tail_policy_ids: [],
      counts: {},
    };

    const p = runProposeCli(ARGS);
    setImmediate(() => {
      fake.stdout.emit("data", Buffer.from(JSON.stringify(bad)));
      fake.emit("exit", 0);
      fake.emit("close", 0);
    });

    await expect(p).rejects.toThrow(/signal_fired\[1\]\.policy_id/);
  });

  it("rejects with index when a signal_fired entry has a non-finite score", async () => {
    const fake = makeFakeChild();
    spawnMock.mockReturnValue(fake as unknown as ChildProcess);

    // JSON cannot encode NaN; use a string score to trip the finite-number guard.
    const bad = {
      schema_version: "proposer_cli/0.1.0",
      app_context_echo: {},
      signal_fired: [
        { policy_id: "OK-001", score: "not-a-number", rationale: "r", inclusive_fallback: false },
      ],
      floor_tail_policy_ids: [],
      counts: {},
    };

    const p = runProposeCli(ARGS);
    setImmediate(() => {
      fake.stdout.emit("data", Buffer.from(JSON.stringify(bad)));
      fake.emit("exit", 0);
      fake.emit("close", 0);
    });

    await expect(p).rejects.toThrow(/signal_fired\[0\]\.score/);
  });

  it("rejects with index when a floor_tail entry is an empty string", async () => {
    const fake = makeFakeChild();
    spawnMock.mockReturnValue(fake as unknown as ChildProcess);

    const bad = {
      schema_version: "proposer_cli/0.1.0",
      app_context_echo: {},
      signal_fired: [],
      floor_tail_policy_ids: ["CSAP-ERA-BIO-001", ""],
      counts: {},
    };

    const p = runProposeCli(ARGS);
    setImmediate(() => {
      fake.stdout.emit("data", Buffer.from(JSON.stringify(bad)));
      fake.emit("exit", 0);
      fake.emit("close", 0);
    });

    await expect(p).rejects.toThrow(/floor_tail_policy_ids\[1\]/);
  });

  it("sends SIGTERM at timeout and SIGKILL after 2s grace, then rejects with propose_timeout", async () => {
    vi.useFakeTimers();
    const fake = makeFakeChild();
    spawnMock.mockReturnValue(fake as unknown as ChildProcess);

    const p = runProposeCli({ ...ARGS, timeoutMs: PROPOSE_TIMEOUT_MS });
    let rejected: Error | null = null;
    const tracked = p.catch((err: Error) => {
      rejected = err;
    });

    // Advance to timeout -- SIGTERM fires.
    await vi.advanceTimersByTimeAsync(PROPOSE_TIMEOUT_MS);
    expect(fake.kill).toHaveBeenCalledWith("SIGTERM");

    // Advance past 2s grace -- SIGKILL fires (child has not exited).
    await vi.advanceTimersByTimeAsync(2000);
    expect(fake.kill).toHaveBeenCalledWith("SIGKILL");

    await tracked;
    expect(rejected).not.toBeNull();
    expect((rejected as unknown as Error).message).toContain("propose_timeout");
    expect((rejected as unknown as Error).message).toContain(
      `${PROPOSE_TIMEOUT_MS}ms exceeded`,
    );
  });

  it("uses custom timeoutMs when provided", async () => {
    vi.useFakeTimers();
    const fake = makeFakeChild();
    spawnMock.mockReturnValue(fake as unknown as ChildProcess);

    const p = runProposeCli({ ...ARGS, timeoutMs: 5000 });
    let rejected: Error | null = null;
    const tracked = p.catch((err: Error) => {
      rejected = err;
    });

    await vi.advanceTimersByTimeAsync(5000);
    await tracked;
    expect(rejected).not.toBeNull();
    expect((rejected as unknown as Error).message).toContain("5000ms exceeded");
  });
});
