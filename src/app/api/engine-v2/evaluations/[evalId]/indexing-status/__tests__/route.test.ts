// Route-level tests for GET /api/engine-v2/evaluations/[evalId]/indexing-status.
//
// Covers:
//   - Non-admin -> 403 (via mocked requireAdminForApi).
//   - LOCAL_ENGINE_ENABLED!='true' -> 503 with normalized local_engine_disabled.
//   - Ownership probe failure -> 500; non-owner / missing -> 404.
//   - status row found -> 200 with the row's status + auxiliary fields.
//   - status row missing -> 200 with status='absent' (backwards-compat).
//   - status query error -> 500 status_query_failed.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/engine-v2/admin_guards", () => ({
  requireAdminForApi: vi.fn(),
}));
vi.mock("@/lib/api-guards", () => ({
  requireLocalEngine: vi.fn(),
}));

import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { requireLocalEngine } from "@/lib/api-guards";
import { GET } from "../route";

const mockedRequireAdmin = vi.mocked(requireAdminForApi);
const mockedRequireLocalEngine = vi.mocked(requireLocalEngine);

const EVAL_ID = "11111111-2222-3333-4444-555555555555";
const USER_ID = "admin-user";

function makeReq(): import("next/server").NextRequest {
  return {
    headers: new Headers(),
    nextUrl: new URL(
      `https://test/api/engine-v2/evaluations/${EVAL_ID}/indexing-status`,
    ),
  } as unknown as import("next/server").NextRequest;
}

function makeContext(): { params: Promise<{ evalId: string }> } {
  return { params: Promise.resolve({ evalId: EVAL_ID }) };
}

interface ClientCfg {
  ownershipRow?: { id: string; v2_projects: { user_id: string } } | null;
  ownershipError?: { message: string };
  statusRow?: {
    status: string;
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
    updated_at: string;
  } | null;
  statusError?: { message: string };
}

function makeClient(cfg: ClientCfg) {
  return {
    from(table: string) {
      if (table === "v2_evaluations") {
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
            const defaultRow =
              cfg.ownershipRow === undefined
                ? { id: EVAL_ID, v2_projects: { user_id: USER_ID } }
                : cfg.ownershipRow;
            return { data: defaultRow, error: null };
          },
        };
      }
      if (table === "v2_submission_chunks_indexing_status") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            if (cfg.statusError) {
              return { data: null, error: cfg.statusError };
            }
            return { data: cfg.statusRow ?? null, error: null };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

function adminOk(client: unknown = makeClient({})): void {
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

let originalLocalEngine: string | undefined;
beforeEach(() => {
  originalLocalEngine = process.env.LOCAL_ENGINE_ENABLED;
  process.env.LOCAL_ENGINE_ENABLED = "true";
  vi.clearAllMocks();
});
afterEach(() => {
  if (originalLocalEngine === undefined) {
    delete process.env.LOCAL_ENGINE_ENABLED;
  } else {
    process.env.LOCAL_ENGINE_ENABLED = originalLocalEngine;
  }
});

describe("GET /api/engine-v2/evaluations/[evalId]/indexing-status", () => {
  it("403 when non-admin", async () => {
    adminForbidden();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(403);
  });

  it("503 with normalized local_engine_disabled when local engine disabled", async () => {
    adminOk();
    localEngineDisabled();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("local_engine_disabled");
  });

  it("404 when ownership probe returns null", async () => {
    const client = makeClient({ ownershipRow: null });
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("evaluation_not_found");
  });

  it("500 when ownership probe errors", async () => {
    const client = makeClient({
      ownershipError: { message: "ownership_db_error" },
    });
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("ownership_probe_failed");
  });

  it("200 with status='absent' when no status row exists", async () => {
    const client = makeClient({ statusRow: null });
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("absent");
  });

  it("200 with full payload on status='complete'", async () => {
    const client = makeClient({
      statusRow: {
        status: "complete",
        error_message: null,
        started_at: "2026-05-12T00:00:00Z",
        completed_at: "2026-05-12T00:00:30Z",
        updated_at: "2026-05-12T00:00:30Z",
      },
    });
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("complete");
    expect(body.completed_at).toBe("2026-05-12T00:00:30Z");
    expect(body.error_message).toBeNull();
  });

  it("200 with status='error' and error_message when indexer failed", async () => {
    const client = makeClient({
      statusRow: {
        status: "error",
        error_message: "rpc_failure: connection_lost",
        started_at: "2026-05-12T00:00:00Z",
        completed_at: null,
        updated_at: "2026-05-12T00:00:10Z",
      },
    });
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(body.error_message).toBe("rpc_failure: connection_lost");
  });

  it("500 when status query fails", async () => {
    const client = makeClient({ statusError: { message: "boom" } });
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("status_query_failed");
  });
});
