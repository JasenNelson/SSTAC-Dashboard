// Route-level unit tests for POST /api/engine-v2/projects/propose-policies.
//
// Covers:
//   1. 200 happy path: runProposeCli resolves -> fixture JSON returned verbatim.
//   2. 401 unauthenticated (admin gate).
//   3. 403 non-admin (admin gate).
//   4. 400 bad body (strict Zod schema).
//   5. 503 LOCAL_ENGINE_ENABLED unset.
//   6. 502 runProposeCli rejects.
//   7. 415 missing Content-Type (CSRF gate).
//   8. 403 origin mismatch (CSRF gate).
//
// NOTE: fs/promises.writeFile and unlink are also mocked so no real temp files
// are written during tests.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

// --- Module mocks (hoisted before imports) ---

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

// Load the contract fixture for the happy-path response.
// __dirname here is src/app/api/engine-v2/projects/propose-policies/__tests__
// The fixture lives at src/lib/engine-v2/fixtures/proposer_cli/...
const FIXTURE_PATH = path.resolve(
  __dirname,
  "../../../../../../lib/engine-v2/fixtures/proposer_cli/sample_output_warp_like.json",
);
const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8")) as Record<
  string,
  unknown
>;

type MockFn = ReturnType<typeof vi.fn>;

function makeAdminStub() {
  return { client: {}, user: { id: "u1" } };
}

function makeReq(body: unknown = {}): import("next/server").NextRequest {
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

  (requireAdminForApi as unknown as MockFn).mockResolvedValue(makeAdminStub());
  (checkCsrf as unknown as MockFn).mockReturnValue({ ok: true });
  (runProposeCli as unknown as MockFn).mockResolvedValue(FIXTURE);
});

afterEach(() => {
  if (savedLocalEngine === undefined) {
    delete process.env.LOCAL_ENGINE_ENABLED;
  } else {
    process.env.LOCAL_ENGINE_ENABLED = savedLocalEngine;
  }
});

describe("POST /api/engine-v2/projects/propose-policies", () => {
  it("200 happy path: resolves and returns CLI fixture JSON verbatim", async () => {
    const req = makeReq({
      selected_services: ["era-review"],
      media_types: ["soil"],
      lifecycle_stages: [],
      application_types: ["risk_assessment"],
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body["schema_version"]).toBe("proposer_cli/0.1.0");
    expect(Array.isArray(body["signal_fired"])).toBe(true);
    expect(Array.isArray(body["floor_tail_policy_ids"])).toBe(true);
  });

  it("200 with empty arrays (all fields use .default([]))", async () => {
    const req = makeReq({});
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("401 when admin gate returns NextResponse(401)", async () => {
    (requireAdminForApi as unknown as MockFn).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const req = makeReq({});
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("403 when admin gate returns NextResponse(403)", async () => {
    (requireAdminForApi as unknown as MockFn).mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
    const req = makeReq({});
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("415 when CSRF fails on missing Content-Type", async () => {
    (checkCsrf as unknown as MockFn).mockReturnValue({
      ok: false,
      reason: "missing_content_type",
    });
    const req = makeReq({});
    const res = await POST(req);
    expect(res.status).toBe(415);
    const body = await readJson(res);
    expect(body["error"]).toBe("missing_content_type");
  });

  it("403 when CSRF fails on origin mismatch", async () => {
    (checkCsrf as unknown as MockFn).mockReturnValue({
      ok: false,
      reason: "origin_mismatch",
      detail: "https://evil.example.com",
    });
    const req = makeReq({});
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await readJson(res);
    expect(body["error"]).toBe("origin_mismatch");
  });

  it("503 when LOCAL_ENGINE_ENABLED is not 'true'", async () => {
    process.env.LOCAL_ENGINE_ENABLED = "false";
    const req = makeReq({});
    const res = await POST(req);
    expect(res.status).toBe(503);
    const body = await readJson(res);
    expect(body["error"]).toBe("local_engine_disabled");
  });

  it("503 when LOCAL_ENGINE_ENABLED is unset", async () => {
    delete process.env.LOCAL_ENGINE_ENABLED;
    const req = makeReq({});
    const res = await POST(req);
    expect(res.status).toBe(503);
  });

  it("400 when body fails strict Zod schema (extra key rejected)", async () => {
    const req = makeReq({ selected_services: ["era-review"], unexpected_key: true });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body["error"]).toBe("invalid_payload");
  });

  it("400 when body is not JSON", async () => {
    const badReq = {
      headers: new Headers({
        "content-type": "application/json",
        origin: "http://localhost:3000",
      }),
      nextUrl: { origin: "http://localhost:3000" } as never,
      async json() {
        throw new SyntaxError("Unexpected token");
      },
    } as unknown as import("next/server").NextRequest;
    const res = await POST(badReq);
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body["error"]).toBe("invalid_json");
  });

  it("502 when runProposeCli rejects", async () => {
    (runProposeCli as unknown as MockFn).mockRejectedValue(
      new Error("proposer_exit_1: engine internal error"),
    );
    const req = makeReq({ selected_services: ["era-review"] });
    const res = await POST(req);
    expect(res.status).toBe(502);
    const body = await readJson(res);
    expect(body["error"]).toBe("proposer_failed");
    expect(typeof body["detail"]).toBe("string");
  });
});
