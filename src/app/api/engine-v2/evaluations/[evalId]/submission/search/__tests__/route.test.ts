// Route-level tests for GET /api/engine-v2/evaluations/[evalId]/submission/search.
//
// Round 2 (Phase C IMPORTANT 1 fix): the route now calls the
// `search_submission_chunks` RPC instead of the PostgREST query builder.
// The RPC returns rank-ordered rows with server-side ts_headline
// snippets and an aggregated cited_by_count column, so the route no
// longer batches a separate IN-query against v2_chunk_policy_citations
// and no longer builds snippets in JS.
//
// Covers:
//   - Non-admin -> 403.
//   - LOCAL_ENGINE_ENABLED!='true' -> 503.
//   - Ownership probe failure -> 500; non-owner / missing -> 404.
//   - q.trim().length < 2 -> 400 query_too_short.
//   - q.trim().length > 200 -> 400 query_too_long (whitespace counted
//     against TRIMMED length, not raw).
//   - happy path -> 200 with results, snippet preserved verbatim from
//     RPC, cited_by_count + rank surfaced.
//   - indigenous_flagged surfaces unchanged.
//   - limit clamping: limit=9999 -> p_limit=100; limit=0 -> p_limit=1;
//     default (omitted) -> p_limit=20.
//   - RPC error -> 500 search_failed.
//   - RPC called with exactly { p_evaluation_id, p_query, p_limit }.

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

function makeReq(
  qs: string,
): import("next/server").NextRequest {
  return {
    headers: new Headers(),
    nextUrl: new URL(
      `https://test/api/engine-v2/evaluations/${EVAL_ID}/submission/search${qs}`,
    ),
  } as unknown as import("next/server").NextRequest;
}
function makeContext(): { params: Promise<{ evalId: string }> } {
  return { params: Promise.resolve({ evalId: EVAL_ID }) };
}

interface RpcRow {
  id: string;
  evidence_item_id: string;
  source_chunk_id: string | null;
  doc_section: string;
  page_num: number | null;
  snippet: string;
  indigenous_flagged: boolean;
  cited_by_count: number;
  rank: number;
}

interface RpcCall {
  fn: string;
  args: { p_evaluation_id: string; p_query: string; p_limit: number };
}

interface ClientCfg {
  ownershipRow?: { id: string; v2_projects: { user_id: string } } | null;
  ownershipError?: { message: string };
  rpcRows?: RpcRow[];
  rpcError?: { message: string };
  rpcCalls?: RpcCall[];
}

function makeClient(cfg: ClientCfg) {
  cfg.rpcCalls = cfg.rpcCalls ?? [];

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
      throw new Error(`unexpected table: ${table}`);
    },
    async rpc(
      fn: string,
      args: {
        p_evaluation_id: string;
        p_query: string;
        p_limit: number;
      },
    ) {
      cfg.rpcCalls!.push({ fn, args });
      if (cfg.rpcError) {
        return { data: null, error: cfg.rpcError };
      }
      return { data: cfg.rpcRows ?? [], error: null };
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

describe("GET /api/engine-v2/evaluations/[evalId]/submission/search", () => {
  it("403 when non-admin", async () => {
    adminForbidden();
    const res = await GET(makeReq("?q=arsenic"), makeContext());
    expect(res.status).toBe(403);
  });

  it("503 local_engine_disabled when LOCAL_ENGINE_ENABLED!='true'", async () => {
    adminOk();
    localEngineDisabled();
    const res = await GET(makeReq("?q=arsenic"), makeContext());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("local_engine_disabled");
  });

  it("500 when ownership probe errors", async () => {
    const client = makeClient({ ownershipError: { message: "db down" } });
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq("?q=arsenic"), makeContext());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("ownership_probe_failed");
  });

  it("404 when ownership probe returns null", async () => {
    const client = makeClient({ ownershipRow: null });
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq("?q=arsenic"), makeContext());
    expect(res.status).toBe(404);
  });

  it("400 when q missing", async () => {
    adminOk();
    localEngineOk();
    const res = await GET(makeReq(""), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("query_too_short");
  });

  it("400 when q.length < 2", async () => {
    adminOk();
    localEngineOk();
    const res = await GET(makeReq("?q=a"), makeContext());
    expect(res.status).toBe(400);
  });

  it("400 when raw q is whitespace-only (trimmed length < 2)", async () => {
    adminOk();
    localEngineOk();
    const ws = encodeURIComponent("    ");
    const res = await GET(makeReq(`?q=${ws}`), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("query_too_short");
  });

  it("400 when q.trim().length > 200", async () => {
    adminOk();
    localEngineOk();
    const long = "a".repeat(201);
    const res = await GET(
      makeReq(`?q=${encodeURIComponent(long)}`),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("query_too_long");
  });

  it("happy path: returns rank-ordered results with snippet + cited_by_count + rank surfaced", async () => {
    const cfg: ClientCfg = {
      rpcRows: [
        {
          id: "00000000-0000-0000-0000-00000000aaaa",
          evidence_item_id: "slice_aaa",
          source_chunk_id: "sc_aaa",
          doc_section: "1.2 Site",
          page_num: 12,
          snippet:
            "Arsenic concentrations in the upper <mark>arsenic</mark> soil.",
          indigenous_flagged: false,
          cited_by_count: 2,
          rank: 0.87,
        },
      ],
    };
    const client = makeClient(cfg);
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq("?q=arsenic"), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.query).toBe("arsenic");
    expect(body.count).toBe(1);
    expect(body.results[0].evidence_item_id).toBe("slice_aaa");
    expect(body.results[0].section).toBe("1.2 Site");
    expect(body.results[0].page).toBe(12);
    expect(body.results[0].indigenous_flagged).toBe(false);
    expect(body.results[0].cited_by_count).toBe(2);
    expect(body.results[0].snippet).toContain("<mark>");
    expect(body.results[0].snippet.toLowerCase()).toContain("arsenic");
    expect(body.results[0].rank).toBe(0.87);
    // RPC invoked exactly once with the right shape.
    expect(cfg.rpcCalls!.length).toBe(1);
    expect(cfg.rpcCalls![0]!.fn).toBe("search_submission_chunks");
    expect(cfg.rpcCalls![0]!.args.p_evaluation_id).toBe(EVAL_ID);
    expect(cfg.rpcCalls![0]!.args.p_query).toBe("arsenic");
  });

  it("indigenous_flagged surfaces unchanged on flagged chunks", async () => {
    const cfg: ClientCfg = {
      rpcRows: [
        {
          id: "00000000-0000-0000-0000-00000000bbbb",
          evidence_item_id: "slice_iii",
          source_chunk_id: null,
          doc_section: "3.1 Receptors",
          page_num: 18,
          snippet:
            "Traditional gardens documented within the assessment area.",
          indigenous_flagged: true,
          cited_by_count: 0,
          rank: 0.42,
        },
      ],
    };
    const client = makeClient(cfg);
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq("?q=traditional"), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].indigenous_flagged).toBe(true);
  });

  it("cited_by_count is preserved as the integer the RPC returned", async () => {
    const cfg: ClientCfg = {
      rpcRows: [
        {
          id: "00000000-0000-0000-0000-00000000c000",
          evidence_item_id: "slice_a",
          source_chunk_id: null,
          doc_section: "S",
          page_num: 1,
          snippet: "alpha",
          indigenous_flagged: false,
          cited_by_count: 1,
          rank: 0.5,
        },
        {
          id: "00000000-0000-0000-0000-00000000c001",
          evidence_item_id: "slice_b",
          source_chunk_id: null,
          doc_section: "S",
          page_num: 2,
          snippet: "beta",
          indigenous_flagged: false,
          cited_by_count: 0,
          rank: 0.4,
        },
        {
          id: "00000000-0000-0000-0000-00000000c002",
          evidence_item_id: "slice_c",
          source_chunk_id: null,
          doc_section: "S",
          page_num: 3,
          snippet: "gamma",
          indigenous_flagged: false,
          cited_by_count: 2,
          rank: 0.3,
        },
      ],
    };
    const client = makeClient(cfg);
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq("?q=foo"), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    const counts = new Map(
      body.results.map(
        (r: { evidence_item_id: string; cited_by_count: number }) => [
          r.evidence_item_id,
          r.cited_by_count,
        ],
      ),
    );
    expect(counts.get("slice_a")).toBe(1);
    expect(counts.get("slice_b")).toBe(0);
    expect(counts.get("slice_c")).toBe(2);
  });

  it("cited_by_count tolerates bigint-as-string from PostgREST", async () => {
    // PostgREST encodes Postgres bigints as JSON strings for very large
    // values; the route must coerce safely.
    const cfg: ClientCfg = {
      rpcRows: [
        {
          id: "00000000-0000-0000-0000-00000000d000",
          evidence_item_id: "slice_big",
          source_chunk_id: null,
          doc_section: "S",
          page_num: 1,
          snippet: "snippet",
          indigenous_flagged: false,
          // intentional string-shape to mimic PostgREST big-int serialization
          cited_by_count: "5" as unknown as number,
          rank: 0.5,
        },
      ],
    };
    const client = makeClient(cfg);
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq("?q=foo"), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].cited_by_count).toBe(5);
  });

  it("limit clamped to <= 100 when caller passes oversize value", async () => {
    const cfg: ClientCfg = { rpcRows: [] };
    const client = makeClient(cfg);
    adminOk(client);
    localEngineOk();
    const res = await GET(
      makeReq("?q=arsenic&limit=9999"),
      makeContext(),
    );
    expect(res.status).toBe(200);
    expect(cfg.rpcCalls!.length).toBe(1);
    expect(cfg.rpcCalls![0]!.args.p_limit).toBe(100);
  });

  it("limit clamped to >= 1 when caller passes 0", async () => {
    const cfg: ClientCfg = { rpcRows: [] };
    const client = makeClient(cfg);
    adminOk(client);
    localEngineOk();
    const res = await GET(
      makeReq("?q=arsenic&limit=0"),
      makeContext(),
    );
    expect(res.status).toBe(200);
    expect(cfg.rpcCalls!.length).toBe(1);
    expect(cfg.rpcCalls![0]!.args.p_limit).toBe(1);
  });

  it("limit defaults to 20 when caller omits the param", async () => {
    const cfg: ClientCfg = { rpcRows: [] };
    const client = makeClient(cfg);
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq("?q=arsenic"), makeContext());
    expect(res.status).toBe(200);
    expect(cfg.rpcCalls!.length).toBe(1);
    expect(cfg.rpcCalls![0]!.args.p_limit).toBe(20);
  });

  it("500 on RPC failure", async () => {
    const cfg: ClientCfg = { rpcError: { message: "rpc boom" } };
    const client = makeClient(cfg);
    adminOk(client);
    localEngineOk();
    const res = await GET(makeReq("?q=arsenic"), makeContext());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("search_failed");
  });
});
