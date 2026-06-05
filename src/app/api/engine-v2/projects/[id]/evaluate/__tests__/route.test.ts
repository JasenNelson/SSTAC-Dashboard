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

// --- Mocks for the M1c route-level POST tests (added 2026-06-05). ---
// These modules are NOT used by the existing runExtractAdapter / tailStderrLog /
// spawnScenarioRunner unit tests above (those use the REAL implementations + the
// hoisted spawnMock + sync `fs`), so mocking them here does not disturb them.
// extract_adapter and spawn_scenario are deliberately left REAL: the route's POST
// drives them through the same spawnMock, keeping behavior consistent.
vi.mock("@/lib/engine-v2/admin_guards", () => ({
  requireAdminForApi: vi.fn(),
}));
vi.mock("@/lib/engine-v2/csrf", () => ({
  checkCsrf: vi.fn(),
}));
// Mock fs/promises (the route's async fs). The existing tests use sync `fs`
// (imported as fsSync), so this does not affect them. writeFile records
// [path, content] pairs so the policy_ids.json + scenario.yaml writes can be
// asserted; readdir/mkdir/unlink are stubbed to resolve.
const writeFileCalls: Array<{ path: string; content: string }> = [];
const readdirMock = vi.fn();
vi.mock("fs/promises", async () => {
  // mkdir is backed by REAL sync mkdir so spawn_scenario.ts's fsSync.openSync on
  // the run dir's stdout/stderr log files succeeds (the run dir must exist on disk).
  const realFs = await import("fs");
  return {
    readdir: (...args: unknown[]) => readdirMock(...args),
    mkdir: vi.fn((p: string, opts?: unknown) => {
      realFs.mkdirSync(String(p), opts as Parameters<typeof realFs.mkdirSync>[1]);
      return Promise.resolve(undefined);
    }),
    writeFile: vi.fn((p: string, content: string) => {
      writeFileCalls.push({ path: String(p), content: String(content) });
      return Promise.resolve();
    }),
    unlink: vi.fn().mockResolvedValue(undefined),
  };
});

// Import AFTER the mock so the route uses the hoisted spawn.
import {
  runExtractAdapter,
  ADAPTER_TIMEOUT_MS,
} from "@/lib/engine-v2/extract_adapter";
import { tailLogFile as tailStderrLog } from "@/lib/engine-v2/log_tail";
import { spawnScenarioRunner } from "@/lib/engine-v2/spawn_scenario";
import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import { POST as EVALUATE_POST } from "../route";
import { NextResponse } from "next/server";

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

// M1c cutover (2026-06-05): the evaluate route writes policy_ids.json into the
// run dir and points the scenario YAML at it when the project has a HITL-confirmed
// applicable_policy_ids list. Empty / null / all-filtered -> nothing written and
// the scenario YAML omits the key (byte-identical to the pre-M1c fallback path).
//
// These tests drive the REAL POST handler with admin_guards + csrf + fs/promises
// mocked, and the REAL runExtractAdapter + spawnScenarioRunner driven through the
// hoisted spawnMock (adapter child emits exit 0; runner child emits spawn).
describe("POST /api/engine-v2/projects/[id]/evaluate -- M1c applicable_policy_ids cutover", () => {
  const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
  const EXTRACTION_RUN_ID = "22222222-2222-4222-8222-222222222222";
  const EVALUATION_ID = "33333333-3333-4333-8333-333333333333";
  let baseTmpDir = "";
  let savedBase: string | undefined;
  let savedLocalEngine: string | undefined;
  let savedBackendDefault: string | undefined;

  // Build a supabase client stub:
  //   v2_projects.select(...).eq(...).maybeSingle() -> { project }
  //   v2_extraction_runs.select(...)...maybeSingle() -> completed run
  //   v2_evaluations.insert(...).select(...).single() -> { id, status }
  //   v2_evaluations.update(...).eq(...) -> resolves (used only on error paths)
  function makeClient(applicablePolicyIds: unknown) {
    return {
      from(table: string) {
        if (table === "v2_projects") {
          return {
            select() { return this; },
            eq() { return this; },
            async maybeSingle() {
              return {
                data: {
                  id: PROJECT_ID,
                  user_id: "u1",
                  applicable_policy_ids: applicablePolicyIds,
                },
                error: null,
              };
            },
          };
        }
        if (table === "v2_extraction_runs") {
          return {
            select() { return this; },
            eq() { return this; },
            in() { return this; },
            order() { return this; },
            limit() { return this; },
            async maybeSingle() {
              return {
                data: {
                  id: EXTRACTION_RUN_ID,
                  status: "completed",
                  started_at: "2026-06-05T00:00:00Z",
                },
                error: null,
              };
            },
          };
        }
        if (table === "v2_evaluations") {
          return {
            insert() {
              return {
                select() { return this; },
                async single() {
                  return {
                    data: { id: EVALUATION_ID, status: "pending" },
                    error: null,
                  };
                },
              };
            },
            update() {
              return {
                eq: async () => ({ data: null, error: null }),
              };
            },
          };
        }
        return {} as never;
      },
    };
  }

  function makeReq(): import("next/server").NextRequest {
    return {
      headers: new Headers({
        "content-type": "application/json",
        origin: "http://localhost:3000",
      }),
      nextUrl: { origin: "http://localhost:3000" } as never,
      async text() {
        return "";
      },
    } as unknown as import("next/server").NextRequest;
  }

  function makeCtx() {
    return { params: Promise.resolve({ id: PROJECT_ID }) };
  }

  // Orchestrate the two sequential spawns the route makes:
  //   call 1 = runExtractAdapter (listens for "exit"); emit exit 0.
  //   call 2 = spawnScenarioRunner (listens for "spawn"); emit spawn; has unref.
  function armSpawnSequence() {
    let callIndex = 0;
    spawnMock.mockImplementation(() => {
      callIndex += 1;
      if (callIndex === 1) {
        const child = makeFakeChild();
        setImmediate(() => child.emit("exit", 0));
        return child;
      }
      const runner = new EventEmitter() as EventEmitter & {
        unref: ReturnType<typeof vi.fn>;
      };
      runner.unref = vi.fn();
      setImmediate(() => runner.emit("spawn"));
      return runner;
    });
  }

  beforeEach(() => {
    spawnMock.mockReset();
    writeFileCalls.length = 0;
    readdirMock.mockReset();
    // Single extracted JSON artifact so Step 8 resolves to exactly one file.
    readdirMock.mockResolvedValue(["submission_VERBATIM.json"]);

    baseTmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), "m1c-eval-"));
    savedBase = process.env.REG_REVIEW_ENGINE_V2_BASE_PATH;
    process.env.REG_REVIEW_ENGINE_V2_BASE_PATH = baseTmpDir;
    savedLocalEngine = process.env.LOCAL_ENGINE_ENABLED;
    process.env.LOCAL_ENGINE_ENABLED = "true";
    savedBackendDefault = process.env.ENGINE_V2_EVAL_BACKEND_DEFAULT;
    // Force stub backend so no Ollama preflight runs.
    delete process.env.ENGINE_V2_EVAL_BACKEND_DEFAULT;

    (checkCsrf as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ ok: true });
    armSpawnSequence();
  });

  afterEach(() => {
    if (savedBase === undefined) delete process.env.REG_REVIEW_ENGINE_V2_BASE_PATH;
    else process.env.REG_REVIEW_ENGINE_V2_BASE_PATH = savedBase;
    if (savedLocalEngine === undefined) delete process.env.LOCAL_ENGINE_ENABLED;
    else process.env.LOCAL_ENGINE_ENABLED = savedLocalEngine;
    if (savedBackendDefault === undefined)
      delete process.env.ENGINE_V2_EVAL_BACKEND_DEFAULT;
    else process.env.ENGINE_V2_EVAL_BACKEND_DEFAULT = savedBackendDefault;
    try {
      fsSync.rmSync(baseTmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  function findWrite(suffix: string) {
    return writeFileCalls.find((c) => c.path.replace(/\\/g, "/").endsWith(suffix));
  }

  it("(a) writes policy_ids.json with the exact array and points the scenario YAML at it", async () => {
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      client: makeClient(["CSAP-X-1", "CSAP-X-2"]),
      user: { id: "u1" },
    });

    const res = await EVALUATE_POST(makeReq(), makeCtx());
    expect((res as NextResponse).status).toBe(200);

    // policy_ids.json was written with exactly the confirmed array.
    const policyWrite = findWrite("policy_ids.json");
    expect(policyWrite).toBeDefined();
    expect(JSON.parse(policyWrite!.content)).toEqual(["CSAP-X-1", "CSAP-X-2"]);

    // scenario.yaml references applicable_policy_ids_file pointing at policy_ids.json.
    const yamlWrite = findWrite("scenario.yaml");
    expect(yamlWrite).toBeDefined();
    expect(yamlWrite!.content).toContain("applicable_policy_ids_file:");
    expect(yamlWrite!.content.replace(/\\/g, "/")).toContain("policy_ids.json");
  });

  it("(b) empty applicable_policy_ids -> no policy_ids.json, scenario YAML omits the key (fallback)", async () => {
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      client: makeClient([]),
      user: { id: "u1" },
    });

    const res = await EVALUATE_POST(makeReq(), makeCtx());
    expect((res as NextResponse).status).toBe(200);

    expect(findWrite("policy_ids.json")).toBeUndefined();
    const yamlWrite = findWrite("scenario.yaml");
    expect(yamlWrite).toBeDefined();
    expect(yamlWrite!.content).not.toContain("applicable_policy_ids_file");
  });

  it("(b2) null applicable_policy_ids -> fallback (no key, no file)", async () => {
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      client: makeClient(null),
      user: { id: "u1" },
    });

    const res = await EVALUATE_POST(makeReq(), makeCtx());
    expect((res as NextResponse).status).toBe(200);
    expect(findWrite("policy_ids.json")).toBeUndefined();
    expect(findWrite("scenario.yaml")!.content).not.toContain(
      "applicable_policy_ids_file",
    );
  });

  it("(c) non-string entries are filtered out; surviving strings are written", async () => {
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      client: makeClient(["CSAP-X-1", 42, null, "", "CSAP-X-2", { id: "x" }]),
      user: { id: "u1" },
    });

    const res = await EVALUATE_POST(makeReq(), makeCtx());
    expect((res as NextResponse).status).toBe(200);

    const policyWrite = findWrite("policy_ids.json");
    expect(policyWrite).toBeDefined();
    expect(JSON.parse(policyWrite!.content)).toEqual(["CSAP-X-1", "CSAP-X-2"]);
  });

  it("(c2) all entries filtered out -> fallback (no file, no key)", async () => {
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      client: makeClient([42, null, "", { id: "x" }]),
      user: { id: "u1" },
    });

    const res = await EVALUATE_POST(makeReq(), makeCtx());
    expect((res as NextResponse).status).toBe(200);
    expect(findWrite("policy_ids.json")).toBeUndefined();
    expect(findWrite("scenario.yaml")!.content).not.toContain(
      "applicable_policy_ids_file",
    );
  });
});
