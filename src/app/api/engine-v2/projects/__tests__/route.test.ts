// Route-level unit tests for POST /api/engine-v2/projects (create).
//
// Covers new B3 behaviour:
//   1. applicable_policy_ids accepted and included in insert when present.
//   2. applicable_policy_ids absent -> insert proceeds without the field.
//   3. 400 when submitted id not in proposer universe (mocked runProposeCli).
//   4. Existing tests: basic happy path, 401/403, 400 bad body still pass.
//
// NOTE: all Supabase client interactions and runProposeCli are mocked.
// No real DB or Python process is invoked.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

// --- Module mocks ---

vi.mock("@/lib/engine-v2/admin_guards", () => ({
  requireAdminForApi: vi.fn(),
}));
vi.mock("@/lib/engine-v2/csrf", () => ({
  checkCsrf: vi.fn(),
}));
vi.mock("@/lib/engine-v2/propose_policies", () => ({
  runProposeCli: vi.fn(),
}));
vi.mock("fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import { runProposeCli } from "@/lib/engine-v2/propose_policies";
import { POST } from "../route";

type MockFn = ReturnType<typeof vi.fn>;

const PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// A minimal ProposerCliOutput whose universe contains known test ids.
const UNIVERSE_OUTPUT = {
  schema_version: "proposer_cli/0.1.0",
  app_context_echo: {},
  signal_fired: [
    { policy_id: "CSAP-COP-GW-001", score: 12, rationale: "r", inclusive_fallback: false },
  ],
  floor_tail_policy_ids: ["FLOOR-001"],
  counts: { total_scored: 5860, signal_fired_count: 1, floor_tail_count: 1, ceiling_hit: false },
};

function makeClient(insertRow?: Record<string, unknown>, insertErr?: { message: string; code?: string }) {
  let capturedInsert: Record<string, unknown> = {};
  let insertCalled = false;
  return {
    _captured: () => capturedInsert,
    _insertCalled: () => insertCalled,
    from(_table: string) {
      return {
        insert(payload: Record<string, unknown>) {
          insertCalled = true;
          capturedInsert = payload;
          return {
            select() { return this; },
            async single() {
              if (insertErr) return { data: null, error: insertErr };
              return {
                data: insertRow ?? { id: PROJECT_ID, ...payload },
                error: null,
              };
            },
          };
        },
      };
    },
  };
}

function makeAdminStub(client?: ReturnType<typeof makeClient>) {
  return {
    client: client ?? makeClient(),
    user: { id: "u1" },
  };
}

function makeReq(body: unknown): import("next/server").NextRequest {
  return {
    headers: new Headers({
      "content-type": "application/json",
      origin: "http://localhost:3000",
    }),
    nextUrl: { origin: "http://localhost:3000" } as never,
    async json() {
      return body;
    },
  } as unknown as import("next/server").NextRequest;
}

async function readJson(res: NextResponse): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

let savedLocalEngine: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  savedLocalEngine = process.env.LOCAL_ENGINE_ENABLED;
  process.env.LOCAL_ENGINE_ENABLED = "true";

  (checkCsrf as unknown as MockFn).mockReturnValue({ ok: true });
  (runProposeCli as unknown as MockFn).mockResolvedValue(UNIVERSE_OUTPUT);
});

afterEach(() => {
  if (savedLocalEngine === undefined) {
    delete process.env.LOCAL_ENGINE_ENABLED;
  } else {
    process.env.LOCAL_ENGINE_ENABLED = savedLocalEngine;
  }
});

describe("POST /api/engine-v2/projects", () => {
  it("201 happy path without applicable_policy_ids", async () => {
    const client = makeClient();
    (requireAdminForApi as unknown as MockFn).mockResolvedValue(makeAdminStub(client));
    const req = makeReq({ name: "Test Project" });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("201 with applicable_policy_ids included in insert", async () => {
    const client = makeClient();
    (requireAdminForApi as unknown as MockFn).mockResolvedValue(makeAdminStub(client));
    const ids = ["CSAP-COP-GW-001"];
    const req = makeReq({ name: "Test Project", applicable_policy_ids: ids });
    const res = await POST(req);
    expect(res.status).toBe(201);
    // The insert payload captured by the fake client should include the ids.
    const captured = client._captured();
    expect(captured["applicable_policy_ids"]).toEqual(ids);
  });

  it("201 without applicable_policy_ids in insert when list is absent", async () => {
    const client = makeClient();
    (requireAdminForApi as unknown as MockFn).mockResolvedValue(makeAdminStub(client));
    const req = makeReq({ name: "Test Project" });
    await POST(req);
    const captured = client._captured();
    expect(captured["applicable_policy_ids"]).toBeUndefined();
  });

  it("400 when submitted id is not in proposer universe", async () => {
    const client = makeClient();
    (requireAdminForApi as unknown as MockFn).mockResolvedValue(makeAdminStub(client));
    const req = makeReq({
      name: "Test Project",
      applicable_policy_ids: ["UNKNOWN-POLICY-999"],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body["error"]).toBe("invalid_applicable_policy_id");
    expect(String(body["detail"])).toContain("UNKNOWN-POLICY-999");
  });

  it("401 when admin gate returns 401", async () => {
    (requireAdminForApi as unknown as MockFn).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const req = makeReq({ name: "Test Project" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("403 when admin gate returns 403", async () => {
    (requireAdminForApi as unknown as MockFn).mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
    const req = makeReq({ name: "Test Project" });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("400 on Zod validation failure (extra key rejected by .strict())", async () => {
    const client = makeClient();
    (requireAdminForApi as unknown as MockFn).mockResolvedValue(makeAdminStub(client));
    const req = makeReq({ name: "Test Project", unexpected_key: true });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body["error"]).toBe("invalid_payload");
  });

  it("400 on empty name", async () => {
    const client = makeClient();
    (requireAdminForApi as unknown as MockFn).mockResolvedValue(makeAdminStub(client));
    const req = makeReq({ name: "" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("502 proposer_unavailable + NO insert when runProposeCli fails during universe check (FAIL-CLOSED)", async () => {
    // FAIL-CLOSED: an unvalidated curated policy set must NOT be persisted.
    (runProposeCli as unknown as MockFn).mockRejectedValue(
      new Error("proposer_exit_1: CLI not found"),
    );
    const client = makeClient();
    (requireAdminForApi as unknown as MockFn).mockResolvedValue(makeAdminStub(client));
    const req = makeReq({
      name: "Test Project",
      applicable_policy_ids: ["CSAP-COP-GW-001"],
    });
    const res = await POST(req);
    expect(res.status).toBe(502);
    const body = await readJson(res);
    expect(body["error"]).toBe("proposer_unavailable");
    // Critical: the insert path must NOT have been reached.
    expect(client._insertCalled()).toBe(false);
  });

  it("502 detail is capped at 300 chars", async () => {
    const longMsg = "x".repeat(5000);
    (runProposeCli as unknown as MockFn).mockRejectedValue(new Error(longMsg));
    const client = makeClient();
    (requireAdminForApi as unknown as MockFn).mockResolvedValue(makeAdminStub(client));
    const req = makeReq({
      name: "Test Project",
      applicable_policy_ids: ["CSAP-COP-GW-001"],
    });
    const res = await POST(req);
    expect(res.status).toBe(502);
    const body = await readJson(res);
    expect(String(body["detail"]).length).toBeLessThanOrEqual(300);
  });

  it("empty applicable_policy_ids never invokes the universe check (existing flow unaffected)", async () => {
    const proposeSpy = runProposeCli as unknown as MockFn;
    proposeSpy.mockClear();
    const client = makeClient();
    (requireAdminForApi as unknown as MockFn).mockResolvedValue(makeAdminStub(client));
    // Empty array provided explicitly.
    const req = makeReq({ name: "Test Project", applicable_policy_ids: [] });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(proposeSpy).not.toHaveBeenCalled();
  });
});
