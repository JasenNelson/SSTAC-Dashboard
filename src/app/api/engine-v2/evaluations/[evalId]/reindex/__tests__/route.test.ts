// Route-level tests for POST /api/engine-v2/evaluations/[evalId]/reindex.
//
// Covers:
//   - Non-admin -> 401/403 (via mocked requireAdminForApi).
//   - LOCAL_ENGINE_ENABLED=false -> 503.
//   - CSRF: missing content-type -> 415; bad origin -> 403.
//   - Ownership probe (Round 2 / IMPORTANT 2): explicit
//     v2_evaluations -> v2_projects.user_id JOIN; non-owner -> 404.
//   - 500 on Supabase query failure.
//   - 200 + status=complete on indexer happy path; includes
//     status_write_error null.
//   - 200 + status=error when indexer fails (does NOT rethrow into route);
//     includes status_write_error.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/engine-v2/admin_guards", () => ({
  requireAdminForApi: vi.fn(),
}));
vi.mock("@/lib/api-guards", () => ({
  requireLocalEngine: vi.fn(),
}));
vi.mock("@/lib/engine-v2/csrf", () => ({
  checkCsrf: vi.fn(),
}));
vi.mock("@/lib/engine-v2/submission_chunks_indexing", () => ({
  runIndexerNonBlocking: vi.fn(),
}));

import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { requireLocalEngine } from "@/lib/api-guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import { runIndexerNonBlocking } from "@/lib/engine-v2/submission_chunks_indexing";
import { POST } from "../route";

const mockedRequireAdmin = vi.mocked(requireAdminForApi);
const mockedRequireLocalEngine = vi.mocked(requireLocalEngine);
const mockedCheckCsrf = vi.mocked(checkCsrf);
const mockedRunIndexer = vi.mocked(runIndexerNonBlocking);

const EVAL_ID = "11111111-2222-3333-4444-555555555555";
const USER_ID = "admin-user";

interface MakeReqOpts {
  contentType?: string | null;
  origin?: string | null;
}

function makeReq(opts: MakeReqOpts = {}): import("next/server").NextRequest {
  const headers = new Headers();
  if (opts.contentType !== null) {
    headers.set("content-type", opts.contentType ?? "application/json");
  }
  if (opts.origin !== null) {
    headers.set("origin", opts.origin ?? "https://test");
  }
  return {
    headers,
    nextUrl: { origin: "https://test" } as never,
    async text() {
      return "";
    },
  } as unknown as import("next/server").NextRequest;
}

function makeContext(): { params: Promise<{ evalId: string }> } {
  return { params: Promise.resolve({ evalId: EVAL_ID }) };
}

interface ClientCfg {
  // Ownership probe result. If undefined, defaults to a row indicating
  // owner = USER_ID. null means non-owner / not-found.
  ownershipRow?: { id: string; v2_projects: { user_id: string } } | null;
  ownershipError?: { message: string };
  // Raw envelope fetch.
  evalRow?: { id: string; raw_eval_result_json: unknown } | null;
  evalError?: { message: string };
  perPolicyError?: { message: string };
}

// Track which v2_evaluations select call we're on (route makes two:
// ownership probe first, raw fetch second).
function makeClient(cfg: ClientCfg) {
  let v2EvalSelectCallCount = 0;
  return {
    from(table: string) {
      if (table === "v2_evaluations") {
        v2EvalSelectCallCount += 1;
        const isOwnershipProbe = v2EvalSelectCallCount === 1;
        if (isOwnershipProbe) {
          // First call: ownership probe via JOIN. Build chainable mock.
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            async maybeSingle() {
              if (cfg.ownershipError) {
                return { data: null, error: cfg.ownershipError };
              }
              // Default to owned-by-USER_ID when not specified.
              const defaultRow =
                cfg.ownershipRow === undefined
                  ? { id: EVAL_ID, v2_projects: { user_id: USER_ID } }
                  : cfg.ownershipRow;
              return { data: defaultRow, error: null };
            },
          };
        }
        // Second call: raw envelope fetch.
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            if (cfg.evalError) {
              return { data: null, error: cfg.evalError };
            }
            return { data: cfg.evalRow ?? null, error: null };
          },
        };
      }
      if (table === "v2_per_policy_results") {
        return {
          select() {
            return this;
          },
          async eq() {
            if (cfg.perPolicyError) {
              return { data: null, error: cfg.perPolicyError };
            }
            return { data: [], error: null };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

function adminOk(client: unknown = makeClient({ evalRow: null })): void {
  mockedRequireAdmin.mockResolvedValue({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: client as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: { id: USER_ID } as any,
  });
}

function adminForbidden(): void {
  mockedRequireAdmin.mockResolvedValue(
    NextResponse.json({ error: "Forbidden" }, { status: 403 }),
  );
}

function localEngineOk(): void {
  mockedRequireLocalEngine.mockReturnValue(null);
}
function localEngineDisabled(): void {
  mockedRequireLocalEngine.mockReturnValue(
    NextResponse.json(
      { error: "This feature requires the local evaluation engine." },
      { status: 503 },
    ),
  );
}

function csrfOk(): void {
  mockedCheckCsrf.mockReturnValue({ ok: true });
}
function csrfMissingContentType(): void {
  mockedCheckCsrf.mockReturnValue({ ok: false, reason: "missing_content_type" });
}
function csrfBadOrigin(): void {
  mockedCheckCsrf.mockReturnValue({
    ok: false,
    reason: "origin_mismatch",
    detail: "https://evil.example",
  });
}

describe("POST /api/engine-v2/evaluations/[evalId]/reindex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("403 when requireAdmin rejects", async () => {
    adminForbidden();
    const res = await POST(makeReq(), makeContext());
    expect(res.status).toBe(403);
  });

  it("503 when local engine disabled", async () => {
    adminOk();
    localEngineDisabled();
    const res = await POST(makeReq(), makeContext());
    expect(res.status).toBe(503);
  });

  it("415 when content-type missing (CSRF)", async () => {
    adminOk();
    localEngineOk();
    csrfMissingContentType();
    const res = await POST(makeReq(), makeContext());
    expect(res.status).toBe(415);
  });

  it("403 when origin mismatch (CSRF)", async () => {
    adminOk();
    localEngineOk();
    csrfBadOrigin();
    const res = await POST(makeReq(), makeContext());
    expect(res.status).toBe(403);
  });

  it("404 when ownership probe returns null (Round 2 / IMPORTANT 2)", async () => {
    const client = makeClient({ ownershipRow: null });
    adminOk(client);
    localEngineOk();
    csrfOk();
    const res = await POST(makeReq(), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("evaluation_not_found");
  });

  it("500 when ownership probe errors (Round 2 / IMPORTANT 2)", async () => {
    const client = makeClient({
      ownershipError: { message: "ownership_db_error" },
    });
    adminOk(client);
    localEngineOk();
    csrfOk();
    const res = await POST(makeReq(), makeContext());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("ownership_probe_failed");
  });

  it("404 when raw envelope fetch returns null after ownership passes", async () => {
    const client = makeClient({
      // ownership passes (default), but raw fetch returns null
      evalRow: null,
    });
    adminOk(client);
    localEngineOk();
    csrfOk();
    const res = await POST(makeReq(), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("evaluation_not_found");
  });

  it("500 when raw envelope query fails", async () => {
    const client = makeClient({ evalError: { message: "db unreachable" } });
    adminOk(client);
    localEngineOk();
    csrfOk();
    const res = await POST(makeReq(), makeContext());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("evaluation_query_failed");
  });

  it("500 when v2_per_policy_results query fails", async () => {
    const client = makeClient({
      evalRow: { id: EVAL_ID, raw_eval_result_json: {} },
      perPolicyError: { message: "boom" },
    });
    adminOk(client);
    localEngineOk();
    csrfOk();
    const res = await POST(makeReq(), makeContext());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("per_policy_query_failed");
  });

  it("200 + status=complete on indexer success; includes status_write_error=null", async () => {
    const client = makeClient({
      evalRow: { id: EVAL_ID, raw_eval_result_json: { evidence_slices: {} } },
    });
    adminOk(client);
    localEngineOk();
    csrfOk();
    mockedRunIndexer.mockResolvedValue({
      ok: true,
      result: { chunkRows: 5, citationRows: 7, statusWriteError: null },
    });
    const res = await POST(makeReq(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("complete");
    expect(body.chunk_rows).toBe(5);
    expect(body.citation_rows).toBe(7);
    expect(body.status_write_error).toBeNull();
  });

  it("200 + status=complete + non-null status_write_error when data wrote but status table failed (Round 2 / IMPORTANT 4)", async () => {
    const client = makeClient({
      evalRow: { id: EVAL_ID, raw_eval_result_json: { evidence_slices: {} } },
    });
    adminOk(client);
    localEngineOk();
    csrfOk();
    mockedRunIndexer.mockResolvedValue({
      ok: true,
      result: {
        chunkRows: 5,
        citationRows: 7,
        statusWriteError: "status_upsert_failed",
      },
    });
    const res = await POST(makeReq(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("complete");
    expect(body.status_write_error).toBe("status_upsert_failed");
  });

  it("200 + status=error when indexer reports failure (no throw)", async () => {
    const client = makeClient({
      evalRow: { id: EVAL_ID, raw_eval_result_json: { evidence_slices: {} } },
    });
    adminOk(client);
    localEngineOk();
    csrfOk();
    mockedRunIndexer.mockResolvedValue({
      ok: false,
      error: "rpc_failure",
      statusWriteError: null,
    });
    const res = await POST(makeReq(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(body.error_message).toBe("rpc_failure");
    expect(body.status_write_error).toBeNull();
  });

  it("200 + status=error + non-null status_write_error when both data-write and a prior status-write failed (Round 3 / IMPORTANT 4 residual)", async () => {
    // The indexer surfaces a preserved prior status-write error via the
    // statusWriteError field of the failure result; the route must forward
    // it as status_write_error so the UI can distinguish "indexer failed
    // AND observability also degraded" from "indexer failed but status
    // table is current".
    const client = makeClient({
      evalRow: { id: EVAL_ID, raw_eval_result_json: { evidence_slices: {} } },
    });
    adminOk(client);
    localEngineOk();
    csrfOk();
    mockedRunIndexer.mockResolvedValue({
      ok: false,
      error: "rpc_failure",
      statusWriteError: "running_upsert_boom",
    });
    const res = await POST(makeReq(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(body.error_message).toBe("rpc_failure");
    expect(body.status_write_error).toBe("running_upsert_boom");
  });

  it("invokes runIndexerNonBlocking with evalId from URL params and the authenticated admin client (Phase B corrective follow-up)", async () => {
    const client = makeClient({
      evalRow: { id: EVAL_ID, raw_eval_result_json: { evidence_slices: {} } },
    });
    adminOk(client);
    localEngineOk();
    csrfOk();
    mockedRunIndexer.mockResolvedValue({
      ok: true,
      result: { chunkRows: 0, citationRows: 0, statusWriteError: null },
    });
    await POST(makeReq(), makeContext());
    expect(mockedRunIndexer).toHaveBeenCalledTimes(1);
    const arg = mockedRunIndexer.mock.calls[0]![0];
    expect(arg.evaluationId).toBe(EVAL_ID);
    expect(arg.rawEnvelope).toEqual({ evidence_slices: {} });
    // Phase B corrective follow-up (RLS alignment): the Phase B tables
    // now expose owner-AND-admin FOR ALL TO authenticated policies
    // (matching lane2a/lane2b), so the route forwards the authenticated
    // admin client to the indexer. No service-role construction.
    expect(arg.client).toBe(client);
  });
});
