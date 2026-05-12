// engine_v2 frontend Lane 2b / Module L2b-2: POST /api/engine-v2/per-policy/[id]/judgment.
//
// Upserts an HITL judgment row for a single v2_per_policy_results record.
// Server-side only; the matching UI lives in L2b-3 (table inline editor).
//
// Flow:
//   1. requireAdminForApi             -> 401/403 NextResponse on failure.
//   2. checkCsrf                      -> 415 (Content-Type) or 403 (Origin) on failure.
//   3. Body parse + Zod validation    -> 400 invalid_json | invalid_payload.
//      Also enforces that payload.per_policy_result_id === URL [id] -> 400 mismatched_id.
//   4. Resolve tier from v2_per_policy_results WHERE id = [id]. RLS scopes ownership,
//      so non-owners and missing rows both fall through to 404 per_policy_result_not_found.
//   5. assertVerdictAllowedForTier(tier, verdict) -> 422 verdict_not_allowed_for_tier.
//   6. UPSERT v2_judgments on conflict per_policy_result_id (BEFORE UPDATE trigger
//      archives the prior row into v2_judgment_history). reviewer_user_id is ALWAYS
//      taken from the authenticated user; any body-provided value is ignored.
//   7. SELECT the upserted row and return 200 with V2Judgment shape.

import { NextResponse, type NextRequest } from "next/server";

import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import {
  ALLOWED_VERDICTS_BY_TIER,
  type JudgmentTier,
  type JudgmentVerdict,
  type V2Judgment,
} from "@/lib/engine-v2/types_lane2";
import {
  JudgmentUpsertPayloadSchema,
  assertVerdictAllowedForTier,
} from "@/lib/engine-v2/zod_lane2";

export const runtime = "nodejs";

const VALID_TIERS: readonly JudgmentTier[] = [
  "TIER_1_BINARY",
  "TIER_2_PROFESSIONAL",
  "TIER_3_STATUTORY",
] as const;

function isValidTier(value: unknown): value is JudgmentTier {
  return typeof value === "string" && (VALID_TIERS as readonly string[]).includes(value);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // Step 1: admin gate.
  const auth = await requireAdminForApi();
  if (auth instanceof NextResponse) return auth;
  const { client, user } = auth;

  // Step 2: CSRF.
  const csrf = checkCsrf(request);
  if (!csrf.ok) {
    const status =
      csrf.reason === "missing_content_type" ||
      csrf.reason === "wrong_content_type"
        ? 415
        : 403;
    return NextResponse.json(
      { error: csrf.reason, detail: csrf.detail },
      { status },
    );
  }

  const { id: perPolicyResultId } = await context.params;

  // Step 3: body parse + Zod validation.
  let payload: unknown;
  try {
    const raw = await request.text();
    payload = raw.length === 0 ? {} : JSON.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_json", detail: (err as Error).message },
      { status: 400 },
    );
  }
  const parsed = JudgmentUpsertPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", detail: parsed.error.message },
      { status: 400 },
    );
  }
  if (parsed.data.per_policy_result_id !== perPolicyResultId) {
    return NextResponse.json(
      {
        error: "mismatched_id",
        url_id: perPolicyResultId,
        body_id: parsed.data.per_policy_result_id,
      },
      { status: 400 },
    );
  }

  // Step 4: resolve tier (also acts as ownership probe via RLS).
  const { data: perPolicyRow, error: perPolicyErr } = await client
    .from("v2_per_policy_results")
    .select("id, tier")
    .eq("id", perPolicyResultId)
    .maybeSingle();
  if (perPolicyErr) {
    return NextResponse.json(
      {
        error: "per_policy_result_query_failed",
        detail: perPolicyErr.message,
      },
      { status: 500 },
    );
  }
  if (!perPolicyRow) {
    return NextResponse.json(
      { error: "per_policy_result_not_found" },
      { status: 404 },
    );
  }
  const rawTier = (perPolicyRow as { tier: unknown }).tier;
  if (!isValidTier(rawTier)) {
    return NextResponse.json(
      {
        error: "per_policy_result_tier_invalid",
        detail: `tier=${String(rawTier)}`,
      },
      { status: 500 },
    );
  }
  const tier: JudgmentTier = rawTier;
  const verdict: JudgmentVerdict = parsed.data.verdict;

  // Step 5: tier-discretion check (CLAUDE.md NON-NEGOTIABLE).
  try {
    assertVerdictAllowedForTier(tier, verdict);
  } catch {
    return NextResponse.json(
      {
        error: "verdict_not_allowed_for_tier",
        tier,
        verdict,
        allowed: ALLOWED_VERDICTS_BY_TIER[tier],
      },
      { status: 422 },
    );
  }

  // Step 6: UPSERT v2_judgments. reviewer_user_id ALWAYS comes from auth.user.id;
  // any body-provided reviewer is ignored (defence-in-depth alongside RLS).
  const rationale: string | null =
    parsed.data.rationale === undefined ? null : parsed.data.rationale;
  const evidenceRefs: unknown[] = parsed.data.evidence_refs ?? [];

  const upsertResp = await client
    .from("v2_judgments")
    .upsert(
      {
        per_policy_result_id: perPolicyResultId,
        reviewer_user_id: user.id,
        tier,
        verdict,
        rationale,
        evidence_refs: evidenceRefs,
      },
      { onConflict: "per_policy_result_id" },
    )
    .select("id")
    .single();
  if (upsertResp.error || !upsertResp.data) {
    return NextResponse.json(
      {
        error: "upsert_failed",
        detail: upsertResp.error?.message ?? "no_row_returned",
      },
      { status: 500 },
    );
  }

  // Step 7: SELECT the upserted row in full V2Judgment shape.
  const judgmentId = (upsertResp.data as { id: string }).id;
  const selectResp = await client
    .from("v2_judgments")
    .select(
      "id, per_policy_result_id, reviewer_user_id, tier, verdict, rationale, evidence_refs, created_at, updated_at",
    )
    .eq("id", judgmentId)
    .maybeSingle();
  if (selectResp.error || !selectResp.data) {
    return NextResponse.json(
      {
        error: "post_upsert_select_failed",
        detail: selectResp.error?.message ?? "no_row_returned",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(selectResp.data as V2Judgment, { status: 200 });
}
