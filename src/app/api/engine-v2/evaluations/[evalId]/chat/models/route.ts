// engine_v2 frontend Lane 2d / Phase D: chat models availability route.
//
// GET /api/engine-v2/evaluations/[evalId]/chat/models
//
// Returns, per mode, the resolved model id and an availability flag the
// AskAiTab uses to render the status chip dots. Both this route and the
// POST chat route share the same getOllamaTags() cache helper so they
// agree on which models are loaded without spamming Ollama.
//
// Flow:
//   1. requireAdminForApi -> 401/403.
//   2. requireLocalEngine -> 503 with { error: 'local_engine_disabled' }.
//   3. Ownership probe via JOIN -> 404.
//   4. getOllamaTags() (cached; 30s TTL).
//   5. For each mode: resolveChatModel walks default -> fallbacks; the
//      route surfaces the chosen id + availability flag.
//
// ASCII only.

import { NextResponse, type NextRequest } from "next/server";

import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { requireLocalEngine } from "@/lib/api-guards";
import { getOllamaTags } from "@/lib/engine-v2/ollama_tags_cache";
import {
  MODE_TO_MODEL,
  resolveChatModel,
} from "@/lib/engine-v2/chat-model-registry";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ evalId: string }> },
): Promise<NextResponse> {
  // Step 1: admin gate.
  const auth = await requireAdminForApi();
  if (auth instanceof NextResponse) return auth;
  const { client, user } = auth;

  // Step 2: local-engine gate.
  const engineErr = requireLocalEngine();
  if (engineErr) {
    return NextResponse.json(
      { error: "local_engine_disabled" },
      { status: 503 },
    );
  }

  const { evalId } = await context.params;

  // Step 3: ownership probe via JOIN.
  const { data: ownership, error: ownershipErr } = await client
    .from("v2_evaluations")
    .select("id, v2_projects!inner(user_id)")
    .eq("id", evalId)
    .eq("v2_projects.user_id", user.id)
    .maybeSingle();
  if (ownershipErr) {
    return NextResponse.json(
      { error: "ownership_probe_failed", detail: ownershipErr.message },
      { status: 500 },
    );
  }
  if (!ownership) {
    return NextResponse.json(
      { error: "evaluation_not_found" },
      { status: 404 },
    );
  }

  // Step 4: cached probe.
  const tags = await getOllamaTags();

  // Step 5: per-mode resolution.
  const fast = resolveChatModel("fast", tags);
  const thinking = resolveChatModel("thinking", tags);

  return NextResponse.json({
    fast: {
      model_id: fast?.model ?? MODE_TO_MODEL.fast.default,
      available: fast !== null,
    },
    thinking: {
      model_id: thinking?.model ?? MODE_TO_MODEL.thinking.default,
      available: thinking !== null,
    },
  });
}
