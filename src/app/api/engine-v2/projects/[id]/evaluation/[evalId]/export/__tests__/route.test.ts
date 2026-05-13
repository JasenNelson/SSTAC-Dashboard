// Route-level tests for POST /api/engine-v2/projects/[id]/evaluation/[evalId]/export (L2d-3).
//
// Covers:
//   - 401 / 403 from admin guard short-circuits before DB access.
//   - 415 / 403 from CSRF check.
//   - 400 on missing / invalid `format` query parameter.
//   - 403 cross-owner (v2_projects miss).
//   - 404 cross-owner / mismatched evalId (v2_evaluations miss).
//   - 200 happy paths for csv / md / html with proper Content-Type +
//     Content-Disposition + ASCII filename.
//   - Acceptance regression: TIER_2 rows never contain "ADEQUATE" and
//     TIER_3 rows are "OBSERVATION_ONLY" only in the response body.
//   - 422 export_invariant_violation when the DB returns a corrupt
//     tier/verdict pair.

import { describe, it, expect, vi, beforeEach } from "vitest";
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

// --- Helpers --------------------------------------------------------------

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const EVAL_ID = "22222222-2222-4222-8222-222222222222";
const RESULT_ID_T1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RESULT_ID_T2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const RESULT_ID_T3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const NOW_ISO = "2026-05-13T12:00:00.000Z";

interface MakeReqOpts {
  format?: string | null;
  contentType?: string;
}

function makeReq(opts: MakeReqOpts = {}): import("next/server").NextRequest {
  const ct = opts.contentType ?? "application/json";
  const headers = new Headers({ "content-type": ct, origin: "https://test" });
  const urlBase = `https://test/api/engine-v2/projects/${PROJECT_ID}/evaluation/${EVAL_ID}/export`;
  const url =
    opts.format !== undefined && opts.format !== null
      ? `${urlBase}?format=${encodeURIComponent(opts.format)}`
      : urlBase;
  // Build a minimal NextRequest stub that supports nextUrl.searchParams
  // (the route only reads `format` from there).
  const u = new URL(url);
  return {
    headers,
    nextUrl: u,
    async text() {
      return "";
    },
  } as unknown as import("next/server").NextRequest;
}

function makeContext(
  id: string,
  evalId: string,
): { params: Promise<{ id: string; evalId: string }> } {
  return { params: Promise.resolve({ id, evalId }) };
}

interface ClientBuilders {
  projectRow?: { id: string; name: string } | null;
  projectError?: { message: string };
  evalRow?: Record<string, unknown> | null;
  evalError?: { message: string };
  perPolicyRows?: Record<string, unknown>[];
  perPolicyError?: { message: string };
  judgmentRows?: Record<string, unknown>[];
  judgmentError?: { message: string };
}

function makeSupabaseClient(b: ClientBuilders) {
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
            if (b.projectError) return { data: null, error: b.projectError };
            return { data: b.projectRow ?? null, error: null };
          },
        };
      }
      if (table === "v2_evaluations") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            if (b.evalError) return { data: null, error: b.evalError };
            return { data: b.evalRow ?? null, error: null };
          },
        };
      }
      if (table === "v2_per_policy_results") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          order() {
            return this;
          },
          async then(resolve: (val: unknown) => unknown) {
            if (b.perPolicyError) {
              return resolve({ data: null, error: b.perPolicyError });
            }
            return resolve({ data: b.perPolicyRows ?? [], error: null });
          },
        };
      }
      if (table === "v2_judgments") {
        return {
          select() {
            return this;
          },
          in() {
            return this;
          },
          async then(resolve: (val: unknown) => unknown) {
            if (b.judgmentError) {
              return resolve({ data: null, error: b.judgmentError });
            }
            return resolve({ data: b.judgmentRows ?? [], error: null });
          },
        };
      }
      return {} as never;
    },
  };
}

function mockAuthOk(client: ReturnType<typeof makeSupabaseClient>) {
  (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    client,
    user: { id: USER_ID },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (checkCsrf as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ ok: true });
});

function evalRow(): Record<string, unknown> {
  return {
    id: EVAL_ID,
    project_id: PROJECT_ID,
    extraction_run_id: null,
    status: "completed",
    run_id_engine: null,
    variant_config_hash: null,
    evaluation_backend: "stub",
    embedder_backend: "stub",
    reranker_backend: "stub",
    model: null,
    bench_fixture: "bench_v0_3",
    applicability_mode: "off",
    coverage_statement: {},
    errors: [],
    raw_eval_result_json: null,
    started_at: NOW_ISO,
    completed_at: NOW_ISO,
    updated_at: NOW_ISO,
  };
}

function perPolicyRow(
  id: string,
  policyId: string,
  tier: string | null,
): Record<string, unknown> {
  return {
    id,
    evaluation_id: EVAL_ID,
    policy_id: policyId,
    stage: "S4",
    packet_id: null,
    tier,
    verdict_suggestion: null,
    ai_suggestion: "PASS",
    confidence: 0.85,
    confidence_method: "rubric",
    summary: "summary",
    evidence_packet: {},
    pathway_notes: {},
    rubric_self_score: null,
    raw_result_json: {},
    created_at: NOW_ISO,
  };
}

function judgmentRow(
  resultId: string,
  tier: string,
  verdict: string,
  rationale: string | null = "ok",
): Record<string, unknown> {
  return {
    id: `j-${resultId}`,
    per_policy_result_id: resultId,
    reviewer_user_id: USER_ID,
    tier,
    verdict,
    rationale,
    evidence_refs: [],
    created_at: NOW_ISO,
    updated_at: NOW_ISO,
  };
}

// --- Tests ----------------------------------------------------------------

describe("POST /api/engine-v2/projects/[id]/evaluation/[evalId]/export", () => {
  it("401 from requireAdminForApi short-circuits before DB access", async () => {
    const denied = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      denied,
    );
    const res = await POST(
      makeReq({ format: "csv" }),
      makeContext(PROJECT_ID, EVAL_ID),
    );
    expect(res.status).toBe(401);
  });

  it("403 from requireAdminForApi (non-admin) short-circuits", async () => {
    const denied = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      denied,
    );
    const res = await POST(
      makeReq({ format: "csv" }),
      makeContext(PROJECT_ID, EVAL_ID),
    );
    expect(res.status).toBe(403);
  });

  it("415 on wrong Content-Type", async () => {
    const client = makeSupabaseClient({});
    mockAuthOk(client);
    (checkCsrf as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ok: false,
      reason: "wrong_content_type",
    });
    const res = await POST(
      makeReq({ format: "csv" }),
      makeContext(PROJECT_ID, EVAL_ID),
    );
    expect(res.status).toBe(415);
  });

  it("403 on Origin mismatch (CSRF)", async () => {
    const client = makeSupabaseClient({});
    mockAuthOk(client);
    (checkCsrf as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ok: false,
      reason: "origin_mismatch",
    });
    const res = await POST(
      makeReq({ format: "csv" }),
      makeContext(PROJECT_ID, EVAL_ID),
    );
    expect(res.status).toBe(403);
  });

  it("400 invalid_format when format param is missing", async () => {
    const client = makeSupabaseClient({});
    mockAuthOk(client);
    const res = await POST(
      makeReq({ format: null }),
      makeContext(PROJECT_ID, EVAL_ID),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("invalid_format");
  });

  it("400 invalid_format when format param is unknown", async () => {
    const client = makeSupabaseClient({});
    mockAuthOk(client);
    const res = await POST(
      makeReq({ format: "docx" }),
      makeContext(PROJECT_ID, EVAL_ID),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("invalid_format");
  });

  it("403 forbidden_or_not_found when project miss (cross-owner)", async () => {
    const client = makeSupabaseClient({ projectRow: null });
    mockAuthOk(client);
    const res = await POST(
      makeReq({ format: "csv" }),
      makeContext(PROJECT_ID, EVAL_ID),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("forbidden_or_not_found");
  });

  it("404 evaluation_not_found on cross-owner / mismatched evalId", async () => {
    const client = makeSupabaseClient({
      projectRow: { id: PROJECT_ID, name: "Test" },
      evalRow: null,
    });
    mockAuthOk(client);
    const res = await POST(
      makeReq({ format: "csv" }),
      makeContext(PROJECT_ID, EVAL_ID),
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("evaluation_not_found");
  });

  it("200 CSV happy path with header + tier rows + ASCII filename", async () => {
    const client = makeSupabaseClient({
      projectRow: { id: PROJECT_ID, name: "Test Project" },
      evalRow: evalRow(),
      perPolicyRows: [
        perPolicyRow(RESULT_ID_T1, "POL-T1", "TIER_1_BINARY"),
        perPolicyRow(RESULT_ID_T2, "POL-T2", "TIER_2_PROFESSIONAL"),
        perPolicyRow(RESULT_ID_T3, "POL-T3", "TIER_3_STATUTORY"),
      ],
      judgmentRows: [
        judgmentRow(RESULT_ID_T1, "TIER_1_BINARY", "ADEQUATE"),
        judgmentRow(RESULT_ID_T2, "TIER_2_PROFESSIONAL", "DEFICIENT"),
        judgmentRow(RESULT_ID_T3, "TIER_3_STATUTORY", "OBSERVATION_ONLY"),
      ],
    });
    mockAuthOk(client);
    const res = await POST(
      makeReq({ format: "csv" }),
      makeContext(PROJECT_ID, EVAL_ID),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/^text\/csv/);
    const cd = res.headers.get("Content-Disposition") ?? "";
    expect(cd.includes("attachment;")).toBe(true);
    expect(cd.endsWith('.csv"')).toBe(true);
    // ASCII filename:
    for (const ch of cd) {
      const cp = ch.codePointAt(0)!;
      expect(cp).toBeGreaterThanOrEqual(0x20);
      expect(cp).toBeLessThanOrEqual(0x7e);
    }
    const text = await res.text();
    // Acceptance criteria regression:
    //   - TIER_2 row's verdict is not ADEQUATE.
    //   - TIER_3 row's verdict is OBSERVATION_ONLY only.
    const t2Line = text
      .split("\r\n")
      .find((l) => l.startsWith("POL-T2,"));
    const t3Line = text
      .split("\r\n")
      .find((l) => l.startsWith("POL-T3,"));
    expect(t2Line).toBeDefined();
    expect(t3Line).toBeDefined();
    expect(t2Line!.includes("ADEQUATE")).toBe(false);
    expect(t3Line!.includes("OBSERVATION_ONLY")).toBe(true);
  });

  it("200 MD happy path with locale-locked date and tier rows", async () => {
    const client = makeSupabaseClient({
      projectRow: { id: PROJECT_ID, name: "Test Project" },
      evalRow: evalRow(),
      perPolicyRows: [
        perPolicyRow(RESULT_ID_T1, "POL-T1", "TIER_1_BINARY"),
      ],
      judgmentRows: [
        judgmentRow(RESULT_ID_T1, "TIER_1_BINARY", "ADEQUATE"),
      ],
    });
    mockAuthOk(client);
    const res = await POST(
      makeReq({ format: "md" }),
      makeContext(PROJECT_ID, EVAL_ID),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/^text\/markdown/);
    const cd = res.headers.get("Content-Disposition") ?? "";
    expect(cd.endsWith('.md"')).toBe(true);
    const text = await res.text();
    expect(text).toContain("# Test Project: Regulatory Review Export");
    expect(text).toContain("May 13, 2026"); // locale-locked
  });

  it("200 HTML happy path with HTML5 doctype and tier rows", async () => {
    const client = makeSupabaseClient({
      projectRow: { id: PROJECT_ID, name: "Test Project" },
      evalRow: evalRow(),
      perPolicyRows: [
        perPolicyRow(RESULT_ID_T3, "POL-T3", "TIER_3_STATUTORY"),
      ],
      judgmentRows: [
        judgmentRow(
          RESULT_ID_T3,
          "TIER_3_STATUTORY",
          "OBSERVATION_ONLY",
        ),
      ],
    });
    mockAuthOk(client);
    const res = await POST(
      makeReq({ format: "html" }),
      makeContext(PROJECT_ID, EVAL_ID),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/^text\/html/);
    const cd = res.headers.get("Content-Disposition") ?? "";
    expect(cd.endsWith('.html"')).toBe(true);
    const text = await res.text();
    expect(text.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(text).toContain("<table>");
    expect(text).toContain("OBSERVATION_ONLY");
  });

  it("422 export_invariant_violation when DB has TIER_2 + ADEQUATE", async () => {
    const client = makeSupabaseClient({
      projectRow: { id: PROJECT_ID, name: "Test Project" },
      evalRow: evalRow(),
      perPolicyRows: [
        perPolicyRow(RESULT_ID_T2, "POL-T2", "TIER_2_PROFESSIONAL"),
      ],
      judgmentRows: [
        // Simulated corrupt row (DB CHECK trigger somehow bypassed). The export
        // generator MUST throw rather than render.
        judgmentRow(RESULT_ID_T2, "TIER_2_PROFESSIONAL", "ADEQUATE"),
      ],
    });
    mockAuthOk(client);
    const res = await POST(
      makeReq({ format: "csv" }),
      makeContext(PROJECT_ID, EVAL_ID),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("export_invariant_violation");
  });

  it("200 with no per-policy rows returns header-only CSV", async () => {
    const client = makeSupabaseClient({
      projectRow: { id: PROJECT_ID, name: "Test Project" },
      evalRow: evalRow(),
      perPolicyRows: [],
      judgmentRows: [],
    });
    mockAuthOk(client);
    const res = await POST(
      makeReq({ format: "csv" }),
      makeContext(PROJECT_ID, EVAL_ID),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.split("\r\n").length).toBe(1);
    expect(text).toContain("Policy ID");
  });
});
