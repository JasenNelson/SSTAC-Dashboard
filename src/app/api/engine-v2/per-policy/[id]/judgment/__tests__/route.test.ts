// Route-level tests for POST /api/engine-v2/per-policy/[id]/judgment (L2b-2).
//
// Covers:
//   - Happy paths for each tier with an allowed verdict (200 + V2Judgment shape).
//   - Tier-discretion rejections (422 verdict_not_allowed_for_tier).
//   - 404 when per_policy_result row is not found (also covers RLS cross-owner).
//   - 400 mismatched_id when URL [id] != body.per_policy_result_id.
//   - 400 invalid_json on malformed body.
//   - Defence-in-depth: reviewer_user_id is always set from auth, never from body.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// --- Module mocks ---------------------------------------------------------

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

const PER_POLICY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PER_POLICY_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const JUDGMENT_ID = "55555555-5555-4555-8555-555555555555";
const NOW_ISO = "2026-05-12T00:00:00.000Z";

interface MakeReqOpts {
  body?: unknown;
  bodyRaw?: string;
  contentType?: string;
}

function makeReq(opts: MakeReqOpts = {}): import("next/server").NextRequest {
  const ct = opts.contentType ?? "application/json";
  const body =
    opts.bodyRaw !== undefined
      ? opts.bodyRaw
      : JSON.stringify(opts.body ?? {});
  const headers = new Headers({ "content-type": ct, origin: "https://test" });
  return {
    headers,
    nextUrl: { origin: "https://test" } as never,
    async text() {
      return body;
    },
  } as unknown as import("next/server").NextRequest;
}

function makeContext(
  id: string,
): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

interface UpsertCall {
  payload: Record<string, unknown>;
  options: Record<string, unknown>;
}

interface ClientBuilders {
  perPolicyRow?: { id: string; tier: string | null } | null;
  perPolicyError?: { message: string };
  upsertError?: { code?: string; message?: string };
  selectJudgment?: Record<string, unknown> | null;
  selectError?: { message: string };
  upsertCallSink?: { last: UpsertCall | null };
}

function makeSupabaseClient(b: ClientBuilders) {
  return {
    from(table: string) {
      if (table === "v2_per_policy_results") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            if (b.perPolicyError) {
              return { data: null, error: b.perPolicyError };
            }
            return { data: b.perPolicyRow ?? null, error: null };
          },
        };
      }
      if (table === "v2_judgments") {
        return {
          upsert(payload: Record<string, unknown>, options: Record<string, unknown>) {
            if (b.upsertCallSink) {
              b.upsertCallSink.last = { payload, options };
            }
            return {
              select() {
                return this;
              },
              async single() {
                if (b.upsertError) {
                  return { data: null, error: b.upsertError };
                }
                return { data: { id: JUDGMENT_ID }, error: null };
              },
            };
          },
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            if (b.selectError) {
              return { data: null, error: b.selectError };
            }
            return { data: b.selectJudgment ?? null, error: null };
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

async function readJson(res: NextResponse): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

function judgmentRow(verdict: string, tier: string): Record<string, unknown> {
  return {
    id: JUDGMENT_ID,
    per_policy_result_id: PER_POLICY_ID,
    reviewer_user_id: USER_ID,
    tier,
    verdict,
    rationale: null,
    evidence_refs: [],
    created_at: NOW_ISO,
    updated_at: NOW_ISO,
  };
}

// --- Tests ---------------------------------------------------------------

describe("POST /api/engine-v2/per-policy/[id]/judgment", () => {
  it("TIER_1_BINARY + ADEQUATE -> 200 with V2Judgment row", async () => {
    const client = makeSupabaseClient({
      perPolicyRow: { id: PER_POLICY_ID, tier: "TIER_1_BINARY" },
      selectJudgment: judgmentRow("ADEQUATE", "TIER_1_BINARY"),
    });
    mockAuthOk(client);
    const res = await POST(
      makeReq({ body: { per_policy_result_id: PER_POLICY_ID, verdict: "ADEQUATE" } }),
      makeContext(PER_POLICY_ID),
    );
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.id).toBe(JUDGMENT_ID);
    expect(body.per_policy_result_id).toBe(PER_POLICY_ID);
    expect(body.tier).toBe("TIER_1_BINARY");
    expect(body.verdict).toBe("ADEQUATE");
    expect(body.reviewer_user_id).toBe(USER_ID);
  });

  it("TIER_2_PROFESSIONAL + ADEQUATE -> 422 verdict_not_allowed_for_tier", async () => {
    const client = makeSupabaseClient({
      perPolicyRow: { id: PER_POLICY_ID, tier: "TIER_2_PROFESSIONAL" },
    });
    mockAuthOk(client);
    const res = await POST(
      makeReq({ body: { per_policy_result_id: PER_POLICY_ID, verdict: "ADEQUATE" } }),
      makeContext(PER_POLICY_ID),
    );
    expect(res.status).toBe(422);
    const body = await readJson(res);
    expect(body.error).toBe("verdict_not_allowed_for_tier");
    expect(body.tier).toBe("TIER_2_PROFESSIONAL");
    expect(body.verdict).toBe("ADEQUATE");
    expect(body.allowed).toEqual(["DEFICIENT", "REQUIRES_REVIEW"]);
  });

  it("TIER_2_PROFESSIONAL + DEFICIENT -> 200", async () => {
    const client = makeSupabaseClient({
      perPolicyRow: { id: PER_POLICY_ID, tier: "TIER_2_PROFESSIONAL" },
      selectJudgment: judgmentRow("DEFICIENT", "TIER_2_PROFESSIONAL"),
    });
    mockAuthOk(client);
    const res = await POST(
      makeReq({ body: { per_policy_result_id: PER_POLICY_ID, verdict: "DEFICIENT" } }),
      makeContext(PER_POLICY_ID),
    );
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.verdict).toBe("DEFICIENT");
    expect(body.tier).toBe("TIER_2_PROFESSIONAL");
  });

  it("TIER_3_STATUTORY + INADEQUATE -> 422 verdict_not_allowed_for_tier", async () => {
    const client = makeSupabaseClient({
      perPolicyRow: { id: PER_POLICY_ID, tier: "TIER_3_STATUTORY" },
    });
    mockAuthOk(client);
    const res = await POST(
      makeReq({ body: { per_policy_result_id: PER_POLICY_ID, verdict: "INADEQUATE" } }),
      makeContext(PER_POLICY_ID),
    );
    expect(res.status).toBe(422);
    const body = await readJson(res);
    expect(body.error).toBe("verdict_not_allowed_for_tier");
    expect(body.allowed).toEqual(["OBSERVATION_ONLY"]);
  });

  it("TIER_3_STATUTORY + OBSERVATION_ONLY -> 200", async () => {
    const client = makeSupabaseClient({
      perPolicyRow: { id: PER_POLICY_ID, tier: "TIER_3_STATUTORY" },
      selectJudgment: judgmentRow("OBSERVATION_ONLY", "TIER_3_STATUTORY"),
    });
    mockAuthOk(client);
    const res = await POST(
      makeReq({
        body: { per_policy_result_id: PER_POLICY_ID, verdict: "OBSERVATION_ONLY" },
      }),
      makeContext(PER_POLICY_ID),
    );
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.verdict).toBe("OBSERVATION_ONLY");
    expect(body.tier).toBe("TIER_3_STATUTORY");
  });

  it("per_policy_result not found -> 404", async () => {
    const client = makeSupabaseClient({ perPolicyRow: null });
    mockAuthOk(client);
    const res = await POST(
      makeReq({ body: { per_policy_result_id: PER_POLICY_ID, verdict: "ADEQUATE" } }),
      makeContext(PER_POLICY_ID),
    );
    expect(res.status).toBe(404);
    const body = await readJson(res);
    expect(body.error).toBe("per_policy_result_not_found");
  });

  it("mismatched per_policy_result_id (URL vs body) -> 400 mismatched_id", async () => {
    const client = makeSupabaseClient({});
    mockAuthOk(client);
    const res = await POST(
      makeReq({
        body: { per_policy_result_id: OTHER_PER_POLICY_ID, verdict: "ADEQUATE" },
      }),
      makeContext(PER_POLICY_ID),
    );
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toBe("mismatched_id");
    expect(body.url_id).toBe(PER_POLICY_ID);
    expect(body.body_id).toBe(OTHER_PER_POLICY_ID);
  });

  it("invalid JSON body -> 400 invalid_json", async () => {
    const client = makeSupabaseClient({});
    mockAuthOk(client);
    const res = await POST(
      makeReq({ bodyRaw: "{not-json" }),
      makeContext(PER_POLICY_ID),
    );
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toBe("invalid_json");
  });

  it("reviewer_user_id is taken from auth.user.id even when body provides one", async () => {
    const sink: { last: UpsertCall | null } = { last: null };
    const client = makeSupabaseClient({
      perPolicyRow: { id: PER_POLICY_ID, tier: "TIER_1_BINARY" },
      selectJudgment: judgmentRow("ADEQUATE", "TIER_1_BINARY"),
      upsertCallSink: sink,
    });
    mockAuthOk(client);
    // Body has an extra reviewer_user_id field; Zod .strict() will reject it,
    // so this also confirms the schema actively blocks the spoof attempt.
    const res = await POST(
      makeReq({
        body: {
          per_policy_result_id: PER_POLICY_ID,
          verdict: "ADEQUATE",
          reviewer_user_id: "99999999-9999-4999-8999-999999999999",
        },
      }),
      makeContext(PER_POLICY_ID),
    );
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toBe("invalid_payload");

    // Now a legit body (no spoof) must record reviewer_user_id === auth user.
    sink.last = null;
    const res2 = await POST(
      makeReq({
        body: { per_policy_result_id: PER_POLICY_ID, verdict: "ADEQUATE" },
      }),
      makeContext(PER_POLICY_ID),
    );
    expect(res2.status).toBe(200);
    expect(sink.last).not.toBeNull();
    expect(sink.last!.payload.reviewer_user_id).toBe(USER_ID);
    expect(sink.last!.options.onConflict).toBe("per_policy_result_id");
  });

  it("401 from requireAdminForApi short-circuits before DB access", async () => {
    const denied = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(denied);
    const res = await POST(
      makeReq({ body: { per_policy_result_id: PER_POLICY_ID, verdict: "ADEQUATE" } }),
      makeContext(PER_POLICY_ID),
    );
    expect(res.status).toBe(401);
  });

  it("415 from CSRF wrong content-type", async () => {
    const client = makeSupabaseClient({});
    mockAuthOk(client);
    (checkCsrf as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ok: false,
      reason: "wrong_content_type",
    });
    const res = await POST(
      makeReq({ body: { per_policy_result_id: PER_POLICY_ID, verdict: "ADEQUATE" } }),
      makeContext(PER_POLICY_ID),
    );
    expect(res.status).toBe(415);
  });
});
