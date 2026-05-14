// Route-level test for the stale-handler stderr-tail append behavior
// (Codex Round 1 fix, Lane 2c retro).
//
// Verifies that when the stale-handler trips:
//   - errors[0] keeps the generic "Subprocess silent beyond stale timeout".
//   - errors[1] contains the tail of subprocess_stderr.log when present.
//   - When subprocess_stderr.log is absent (ENOENT), errors stays length 1.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fsSync from "fs";
import * as os from "os";
import * as path from "path";
import { NextResponse } from "next/server";

vi.mock("@/lib/engine-v2/admin_guards", () => ({
  requireAdminForApi: vi.fn(),
}));
vi.mock("@/lib/engine-v2/csrf", () => ({
  checkCsrf: vi.fn(),
}));

import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import { POST } from "../route";
import { tailLogFile as tailStaleStderrLog } from "@/lib/engine-v2/log_tail";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const EVAL_ID = "22222222-2222-4222-8222-222222222222";

interface MakeReqOpts {
  body?: unknown;
  contentType?: string;
}

function makeReq(opts: MakeReqOpts = {}): import("next/server").NextRequest {
  const ct = opts.contentType ?? "application/json";
  const body = JSON.stringify(opts.body ?? {});
  const headers = new Headers({ "content-type": ct, origin: "https://test" });
  return {
    headers,
    nextUrl: { origin: "https://test" } as never,
    async json() {
      return JSON.parse(body);
    },
  } as unknown as import("next/server").NextRequest;
}

function makeContext(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

// Build a minimal supabase client double scoped to the columns this route
// reads. Returns a non-terminal row with started_at set far enough in the
// past that the stale-handler fires.
function makeClient(opts: {
  startedAt: string;
  updatedRowCapture: { last: Record<string, unknown> | null };
}) {
  return {
    from(table: string) {
      if (table === "v2_projects") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            return { data: { id: PROJECT_ID }, error: null };
          },
        };
      }
      if (table === "v2_evaluations") {
        const row = {
          id: EVAL_ID,
          project_id: PROJECT_ID,
          extraction_run_id: "extraction-1",
          status: "running",
          run_id_engine: null,
          variant_config_hash: null,
          evaluation_backend: "live",
          embedder_backend: "real",
          reranker_backend: "disabled",
          model: "qwen2.5",
          bench_fixture: "bench_43_full",
          applicability_mode: "off",
          coverage_statement: {},
          errors: [],
          raw_eval_result_json: null,
          started_at: opts.startedAt,
          completed_at: null,
          updated_at: opts.startedAt,
        };
        return {
          select(_cols: string) {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            return { data: row, error: null };
          },
          update(patch: Record<string, unknown>) {
            opts.updatedRowCapture.last = patch;
            return {
              eq() {
                return this;
              },
              select(_cols: string) {
                return this;
              },
              async single() {
                return { data: { ...row, ...patch }, error: null };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

describe("evaluation-status stale handler stderr tail", () => {
  let tmpBase = "";
  let evalRunDir = "";

  beforeEach(() => {
    vi.resetAllMocks();
    tmpBase = fsSync.mkdtempSync(path.join(os.tmpdir(), "eval-stale-"));
    evalRunDir = path.join(tmpBase, "data", "v2_dashboard_eval_runs", EVAL_ID);
    fsSync.mkdirSync(evalRunDir, { recursive: true });
    process.env.REG_REVIEW_ENGINE_V2_BASE_PATH = tmpBase;
    // Use a tiny stale window so "1ms ago" is already stale.
    process.env.EVAL_STALE_TIMEOUT_MS = "1";
    (checkCsrf as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ok: true,
    });
  });

  afterEach(() => {
    delete process.env.REG_REVIEW_ENGINE_V2_BASE_PATH;
    delete process.env.EVAL_STALE_TIMEOUT_MS;
    try {
      fsSync.rmSync(tmpBase, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("appends the stderr tail when subprocess_stderr.log exists", async () => {
    const stderrPath = path.join(evalRunDir, "subprocess_stderr.log");
    const tailContent =
      "Traceback (most recent call last):\n  File 'engine.py', line 42\n  ImportError: missing dep";
    fsSync.writeFileSync(stderrPath, tailContent, "utf-8");

    const captured = { last: null as Record<string, unknown> | null };
    const client = makeClient({
      startedAt: new Date(Date.now() - 60000).toISOString(),
      updatedRowCapture: captured,
    });
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      { client },
    );

    const resp = await POST(
      makeReq({ body: { evaluation_id: EVAL_ID } }),
      makeContext(PROJECT_ID),
    );
    expect(resp).toBeInstanceOf(NextResponse);
    expect((resp as NextResponse).status).toBe(200);

    expect(captured.last).not.toBeNull();
    const updated = captured.last as { status: string; errors: string[] };
    expect(updated.status).toBe("error");
    expect(updated.errors).toHaveLength(2);
    expect(updated.errors[0]).toBe("Subprocess silent beyond stale timeout");
    expect(updated.errors[1]).toContain("subprocess_stderr_tail:");
    expect(updated.errors[1]).toContain("ImportError: missing dep");
  });

  it("keeps a single-entry errors[] when subprocess_stderr.log is absent", async () => {
    // No stderr file written.
    const captured = { last: null as Record<string, unknown> | null };
    const client = makeClient({
      startedAt: new Date(Date.now() - 60000).toISOString(),
      updatedRowCapture: captured,
    });
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      { client },
    );

    const resp = await POST(
      makeReq({ body: { evaluation_id: EVAL_ID } }),
      makeContext(PROJECT_ID),
    );
    expect((resp as NextResponse).status).toBe(200);
    const updated = captured.last as { status: string; errors: string[] };
    expect(updated.status).toBe("error");
    expect(updated.errors).toHaveLength(1);
    expect(updated.errors[0]).toBe("Subprocess silent beyond stale timeout");
  });
});

describe("tailStaleStderrLog", () => {
  let tmpDir = "";

  beforeEach(() => {
    tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), "stale-tail-"));
  });

  afterEach(() => {
    try {
      fsSync.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("returns null when the file does not exist", () => {
    expect(tailStaleStderrLog(path.join(tmpDir, "missing.log"), 100)).toBeNull();
  });

  it("returns the tail when the file is larger than N", () => {
    const p = path.join(tmpDir, "big.log");
    const tail = "ending-bytes-only";
    fsSync.writeFileSync(p, "x".repeat(2000) + tail, "utf-8");
    expect(tailStaleStderrLog(p, tail.length)).toBe(tail);
  });
});
