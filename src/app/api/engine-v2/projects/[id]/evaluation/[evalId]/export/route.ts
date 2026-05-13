// engine_v2 frontend Lane 2d / Module L2d-3: multi-format export route.
//
// POST /api/engine-v2/projects/[id]/evaluation/[evalId]/export?format=csv|md|html
//
// Flow:
//   1. requireAdminForApi      -> 401/403 NextResponse on failure.
//   2. checkCsrf               -> 415 (Content-Type) or 403 (Origin) on failure.
//   3. Parse + validate `format` query param against closed enum.
//   4. Ownership probe v2_projects (RLS scopes to admin owner) -> 403/404.
//   5. SELECT v2_evaluations scoped to (project_id, id). 404 on miss.
//   6. SELECT v2_per_policy_results for the evaluation.
//   7. SELECT v2_judgments for those per-policy results.
//   8. Call generateExport(format, ...) -- pure function (tier-discretion
//      invariants asserted inside).
//   9. Return as Content-Disposition: attachment with ASCII filename + MIME.
//
// Scope (per docs/engine_v2_frontend_lane2d_plan_2026_05_13.md L2d-3 v0.3):
//   - CSV / MD / HTML ONLY. docx is NOT a L2d-3 format -- Lane 2b's
//     ExportMemoButton remains the canonical docx artifact.
//   - POST (not GET) to keep CSRF gating + clean URLs for logging.
//   - No DB persistence; the response IS the export.

import { NextResponse, type NextRequest } from "next/server";

import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import {
  ExportInvariantError,
  buildExportFilename,
  generateExport,
  getFormatDescriptor,
  type ExportFormat,
} from "@/lib/engine-v2/export_formats";
import type {
  V2Evaluation,
  V2Judgment,
  V2PerPolicyResult,
} from "@/lib/engine-v2/types_lane2";
import type { V2Project } from "@/lib/engine-v2/types";

export const runtime = "nodejs";

const VALID_FORMATS: readonly ExportFormat[] = ["csv", "md", "html"] as const;

function isValidFormat(value: string | null): value is ExportFormat {
  return (
    value !== null && (VALID_FORMATS as readonly string[]).includes(value)
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; evalId: string }> },
): Promise<NextResponse> {
  // 1. Admin gate.
  const auth = await requireAdminForApi();
  if (auth instanceof NextResponse) return auth;
  const { client } = auth;

  // 2. CSRF.
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

  // 3. Format validation.
  const formatParam = request.nextUrl.searchParams.get("format");
  if (!isValidFormat(formatParam)) {
    return NextResponse.json(
      {
        error: "invalid_format",
        detail: `expected one of ${VALID_FORMATS.join(",")}; got ${String(formatParam)}`,
      },
      { status: 400 },
    );
  }
  const format: ExportFormat = formatParam;

  // 4. Resolve params + ownership probe.
  const { id: projectId, evalId } = await context.params;

  const { data: projectRow, error: projectErr } = await client
    .from("v2_projects")
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();
  if (projectErr) {
    return NextResponse.json(
      { error: "project_query_failed", detail: projectErr.message },
      { status: 500 },
    );
  }
  if (!projectRow) {
    return NextResponse.json(
      { error: "forbidden_or_not_found" },
      { status: 403 },
    );
  }
  const project = projectRow as Pick<V2Project, "id" | "name">;

  // 5. Evaluation row (scoped by project + id; RLS already filters).
  const { data: evalRow, error: evalErr } = await client
    .from("v2_evaluations")
    .select(
      "id, project_id, extraction_run_id, status, run_id_engine, variant_config_hash, evaluation_backend, embedder_backend, reranker_backend, model, bench_fixture, applicability_mode, coverage_statement, errors, raw_eval_result_json, started_at, completed_at, updated_at",
    )
    .eq("project_id", projectId)
    .eq("id", evalId)
    .maybeSingle();
  if (evalErr) {
    return NextResponse.json(
      { error: "evaluation_query_failed", detail: evalErr.message },
      { status: 500 },
    );
  }
  if (!evalRow) {
    return NextResponse.json(
      { error: "evaluation_not_found" },
      { status: 404 },
    );
  }
  const evaluation = evalRow as V2Evaluation;

  // 6. Per-policy results.
  const { data: resultsData, error: resultsErr } = await client
    .from("v2_per_policy_results")
    .select(
      "id, evaluation_id, policy_id, stage, packet_id, tier, verdict_suggestion, ai_suggestion, confidence, confidence_method, summary, evidence_packet, pathway_notes, rubric_self_score, raw_result_json, created_at",
    )
    .eq("evaluation_id", evaluation.id)
    .order("policy_id", { ascending: true });
  if (resultsErr) {
    return NextResponse.json(
      { error: "per_policy_query_failed", detail: resultsErr.message },
      { status: 500 },
    );
  }
  const perPolicy = (resultsData ?? []) as V2PerPolicyResult[];

  // 7. Judgments.
  let judgments: V2Judgment[] = [];
  if (perPolicy.length > 0) {
    const ppIds = perPolicy.map((r) => r.id);
    const { data: judgmentsData, error: judgmentsErr } = await client
      .from("v2_judgments")
      .select(
        "id, per_policy_result_id, reviewer_user_id, tier, verdict, rationale, evidence_refs, created_at, updated_at",
      )
      .in("per_policy_result_id", ppIds);
    if (judgmentsErr) {
      return NextResponse.json(
        { error: "judgments_query_failed", detail: judgmentsErr.message },
        { status: 500 },
      );
    }
    judgments = (judgmentsData ?? []) as V2Judgment[];
  }

  // 8. Pure render.
  let body: string;
  try {
    body = generateExport(format, {
      project,
      evaluation,
      perPolicy,
      judgments,
    });
  } catch (err) {
    if (err instanceof ExportInvariantError) {
      return NextResponse.json(
        { error: "export_invariant_violation", detail: err.message },
        { status: 422 },
      );
    }
    return NextResponse.json(
      {
        error: "export_render_failed",
        detail: (err as Error).message ?? "unknown_error",
      },
      { status: 500 },
    );
  }

  // 9. Stream as attachment.
  const descriptor = getFormatDescriptor(format);
  const filename = buildExportFilename(format, evaluation.id);
  const byteLength = Buffer.byteLength(body, "utf8");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": descriptor.mime,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
