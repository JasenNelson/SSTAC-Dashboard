// Route-level tests for GET /api/engine-v2/evaluations/[evalId]/submission/chunk/[evidenceItemId].
//
// Covers:
//   - Non-admin -> 403.
//   - LOCAL_ENGINE_ENABLED!='true' -> 503.
//   - Invalid evidenceItemId (regex reject) -> 400.
//   - Ownership probe null -> 404; error -> 500.
//   - Chunk not found -> 404.
//   - Happy path -> 200 with chunk fields + cited_by[] list.

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
const EVIDENCE_ITEM_ID = "slice_abc123";
const USER_ID = "admin-user";

function makeReq(): import("next/server").NextRequest {
  return {
    headers: new Headers(),
    nextUrl: new URL(
      `https://test/api/engine-v2/evaluations/${EVAL_ID}/submission/chunk/${EVIDENCE_ITEM_ID}`,
    ),
  } as unknown as import("next/server").NextRequest;
}

function makeContext(
  evidenceItemId: string = EVIDENCE_ITEM_ID,
): { params: Promise<{ evalId: string; evidenceItemId: string }> } {
  return {
    params: Promise.resolve({ evalId: EVAL_ID, evidenceItemId }),
  };
}

interface ClientCfg {
  ownershipRow?: { id: string; v2_projects: { user_id: string } } | null;
  ownershipError?: { message: string };
  chunkRow?: {
    evidence_item_id: string;
    source_chunk_id: string | null;
    doc_section: string;
    page_num: number | null;
    content: string;
    indigenous_flagged: boolean;
  } | null;
  chunkError?: { message: string };
  citationRows?: Array<{ policy_id: string }>;
  citationError?: { message: string };
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
      if (table === "v2_submission_chunks") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            if (cfg.chunkError) {
              return { data: null, error: cfg.chunkError };
            }
            return { data: cfg.chunkRow ?? null, error: null };
          },
        };
      }
      if (table === "v2_chunk_policy_citations") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async order() {
            if (cfg.citationError) {
              return { data: null, error: cfg.citationError };
            }
            return { data: cfg.citationRows ?? [], error: null };
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

describe("GET /api/engine-v2/evaluations/[evalId]/submission/chunk/[evidenceItemId]", () => {
  it("403 non-admin", async () => {
    adminForbidden();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(403);
  });

  it("503 local_engine_disabled when LOCAL_ENGINE_ENABLED!='true'", async () => {
    adminOk();
    localEngineDisabled();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("local_engine_disabled");
  });

  it("400 invalid_evidence_item_id for SQL-meta characters", async () => {
    adminOk();
    localEngineOk();
    const res = await GET(makeReq(), makeContext("slice'; DROP TABLE--"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_evidence_item_id");
  });

  it("400 invalid_evidence_item_id for empty string", async () => {
    adminOk();
    localEngineOk();
    const res = await GET(makeReq(), makeContext(""));
    expect(res.status).toBe(400);
  });

  it("400 invalid_evidence_item_id for over-length input", async () => {
    adminOk();
    localEngineOk();
    const long = "a".repeat(129);
    const res = await GET(makeReq(), makeContext(long));
    expect(res.status).toBe(400);
  });

  it("404 ownership probe null", async () => {
    const client = makeClient({ ownershipRow: null });
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("evaluation_not_found");
  });

  it("500 ownership probe errors", async () => {
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

  it("404 when chunk row missing", async () => {
    const client = makeClient({ chunkRow: null });
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("chunk_not_found");
  });

  it("happy path: 200 with chunk + cited_by list ordered by policy_id", async () => {
    const client = makeClient({
      chunkRow: {
        evidence_item_id: EVIDENCE_ITEM_ID,
        source_chunk_id: "src_chunk_42",
        doc_section: "4.2 Soil",
        page_num: 22,
        content: "Verbatim chunk text...",
        indigenous_flagged: false,
      },
      citationRows: [
        { policy_id: "CSR-1" },
        { policy_id: "CSR-2" },
      ],
    });
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.evidence_item_id).toBe(EVIDENCE_ITEM_ID);
    expect(body.source_chunk_id).toBe("src_chunk_42");
    expect(body.section).toBe("4.2 Soil");
    expect(body.page).toBe(22);
    expect(body.content).toBe("Verbatim chunk text...");
    expect(body.indigenous_flagged).toBe(false);
    expect(body.cited_by).toEqual([
      { policy_id: "CSR-1" },
      { policy_id: "CSR-2" },
    ]);
  });

  it("indigenous_flagged surfaces unchanged on flagged chunks", async () => {
    const client = makeClient({
      chunkRow: {
        evidence_item_id: EVIDENCE_ITEM_ID,
        source_chunk_id: null,
        doc_section: "3.1 Receptors",
        page_num: 18,
        content: "Traditional foods document.",
        indigenous_flagged: true,
      },
      citationRows: [],
    });
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.indigenous_flagged).toBe(true);
    expect(body.cited_by).toEqual([]);
  });

  it("500 on chunk query failure", async () => {
    const client = makeClient({
      chunkError: { message: "db down" },
    });
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(500);
  });

  it("500 on citation query failure", async () => {
    const client = makeClient({
      chunkRow: {
        evidence_item_id: EVIDENCE_ITEM_ID,
        source_chunk_id: null,
        doc_section: "S",
        page_num: 1,
        content: "x",
        indigenous_flagged: false,
      },
      citationError: { message: "cite db down" },
    });
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq(), makeContext());
    expect(res.status).toBe(500);
  });
});
