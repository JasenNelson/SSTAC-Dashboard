// engine_v2 frontend Lane 2d / Module L2d-1: Policy KB search API.
//
// GET /api/engine-v2/policies/search?q=...&tier=...&topic=...&limit=...
//
// Reads the canonical RRAA knowledge base
// (`C:/Projects/Regulatory-Review/engine/data/rraa_v3_2.db`) via the shared
// `policy_kb` adapter. Local-engine only (Vercel returns 503).
//
// Flow:
//   1. requireAdminForApi          -> 401/403 NextResponse on failure.
//   2. requireLocalEngine          -> the shared v1 helper returns a human-
//      readable string body; this route NORMALIZES the 503 response shape so
//      every 503 emitted from this endpoint is uniformly
//      `{error: 'local_engine_disabled'}` regardless of which branch (guard,
//      driver-unavailable) tripped. Adversarial Round 2 IMPORTANT #2 fix.
//   3. Parse + validate query params (q >= 2 chars; tier closed enum;
//      topic non-empty or 'all'; limit clamped to [1, 100]).
//   4. searchPolicies(q, {tier, topic, limit}) -> rows.
//   5. Return { query, count, results, filters: { topics, tiers } }.
//
// 503 contract: this endpoint always returns
//   { error: 'local_engine_disabled' }
// with status 503 when LOCAL_ENGINE_ENABLED !== 'true' OR the better-sqlite3
// native binding is unavailable. Auth + local-engine guards are MANDATORY
// per ED-2d-4.

import { type NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { requireLocalEngine } from "@/lib/api-guards";
import {
  searchPolicies,
  isDriverAvailable,
  POLICY_TIERS,
} from "@/lib/engine-v2/policy_kb";

export const runtime = "nodejs";

const MIN_QUERY_LEN = 2;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;

const TIER_ENUM = new Set<string>(POLICY_TIERS as readonly string[]);

function clampLimit(raw: string | null): number {
  if (raw === null) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  if (parsed < MIN_LIMIT) return MIN_LIMIT;
  if (parsed > MAX_LIMIT) return MAX_LIMIT;
  return parsed;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Step 1: admin gate.
  const auth = await requireAdminForApi();
  if (auth instanceof NextResponse) return auth;

  // Step 2: local-engine gate.
  // The shared v1 helper returns `{error: 'This feature requires the local
  // evaluation engine.'}`; we normalize the shape so this route's single 503
  // contract is `{error: 'local_engine_disabled'}` regardless of which branch
  // tripped (env-disabled OR native binding unavailable). Modifying the v1
  // helper would change the contract for all v1 callers, so we wrap locally
  // (lower blast radius). Adversarial Round 2 IMPORTANT #2 fix.
  const engineError = requireLocalEngine();
  if (engineError || !isDriverAvailable()) {
    return NextResponse.json(
      { error: "local_engine_disabled" },
      { status: 503 },
    );
  }

  // Step 3: parse + validate query params.
  const sp = request.nextUrl.searchParams;
  const rawQ = sp.get("q");
  const rawTier = sp.get("tier");
  const rawTopic = sp.get("topic");
  const rawLimit = sp.get("limit");

  if (rawQ === null || rawQ.trim().length < MIN_QUERY_LEN) {
    return NextResponse.json({ error: "query_too_short" }, { status: 400 });
  }
  const query = rawQ.trim();

  let tier: string | null = null;
  if (rawTier !== null && rawTier !== "all" && rawTier.length > 0) {
    if (!TIER_ENUM.has(rawTier)) {
      return NextResponse.json({ error: "invalid_tier" }, { status: 400 });
    }
    tier = rawTier;
  }

  let topic: string | null = null;
  if (rawTopic !== null && rawTopic !== "all" && rawTopic.length > 0) {
    // Topic is free-form (from the DB), so just length-bound it. Defense in
    // depth: the value is parameter-bound, never concatenated.
    if (rawTopic.length > 200) {
      return NextResponse.json({ error: "invalid_topic" }, { status: 400 });
    }
    topic = rawTopic;
  }

  const limit = clampLimit(rawLimit);

  // Step 4: run search.
  try {
    const { rows, topics } = searchPolicies(query, { tier, topic, limit });
    return NextResponse.json({
      query,
      count: rows.length,
      results: rows,
      filters: {
        topics,
        tiers: [...POLICY_TIERS],
      },
    });
  } catch (err) {
    console.error("[engine-v2 policy search] error:", err);
    return NextResponse.json(
      { error: "search_failed", detail: String(err) },
      { status: 500 },
    );
  }
}
