// engine_v2 frontend Lane 2b / Module L2b-6: memo export route.
//
// POST  /api/engine-v2/projects/[id]/evaluation/[evalId]/memo
//   -> builds (or returns cached) v2_memo_exports row.
// GET   /api/engine-v2/projects/[id]/evaluation/[evalId]/memo?memo_id=<uuid>
//   -> streams the .docx binary back to the client.
//
// Idempotency:
//   unique (evaluation_id, judgment_snapshot_hash) on v2_memo_exports. If the
//   same judgment snapshot is already exported, we return the cached row.
//
// Tier discretion (CLAUDE.md NON-NEGOTIABLE):
//   The memo builder defensively re-asserts the tier/verdict rules at build
//   time. The DB CHECK + judgment route already enforce them; this is a
//   belt-and-suspenders backstop so any drift fails the export rather than
//   silently producing an invalid memo.

import { NextResponse, type NextRequest } from "next/server";

import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import {
  decodeSupabaseBytea,
  encodeByteaHex,
} from "@/lib/engine-v2/bytea_codec";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import { extractEvidenceSlices } from "@/lib/engine-v2/evidence_slices";
import {
  MEMO_GENERATOR_VERSION,
  MemoBuildInvariantError,
  buildMemo,
  computeJudgmentSnapshotHash,
} from "@/lib/engine-v2/memo_builder";
import {
  TERMINAL_EVALUATION_STATUSES,
  type EvaluationStatus,
  type V2Evaluation,
  type V2Judgment,
  type V2PerPolicyResult,
} from "@/lib/engine-v2/types_lane2";
import type { V2Project } from "@/lib/engine-v2/types";

export const runtime = "nodejs";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isTerminal(status: EvaluationStatus | string): boolean {
  return (TERMINAL_EVALUATION_STATUSES as readonly string[]).includes(status);
}

function shortHash(hex: string): string {
  return hex.slice(0, 12);
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

  // 3. Resolve params.
  const { id: projectId, evalId } = await context.params;

  // 4. Ownership probe v2_projects (RLS scopes to admin owner).
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
    return NextResponse.json({ error: "forbidden_or_not_found" }, { status: 403 });
  }
  const project = projectRow as Pick<V2Project, "id" | "name">;

  // 5. Fetch evaluation (scoped to project + id; RLS already filters).
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
    return NextResponse.json({ error: "evaluation_not_found" }, { status: 404 });
  }
  const evaluation = evalRow as V2Evaluation;

  if (!isTerminal(evaluation.status)) {
    return NextResponse.json(
      { error: "evaluation_not_terminal", status: evaluation.status },
      { status: 400 },
    );
  }

  // 6. Fetch per-policy results.
  const { data: resultsData, error: resultsErr } = await client
    .from("v2_per_policy_results")
    .select(
      "id, evaluation_id, policy_id, stage, packet_id, tier, verdict_suggestion, ai_suggestion, confidence, confidence_method, summary, evidence_packet, pathway_notes, rubric_self_score, raw_result_json, created_at, s4_schema_version, evidence_present, evidence_signal_counts, confidence_scope, evidence_synthesis_self_score",
    )
    .eq("evaluation_id", evaluation.id)
    .order("policy_id", { ascending: true });
  if (resultsErr) {
    return NextResponse.json(
      { error: "per_policy_query_failed", detail: resultsErr.message },
      { status: 500 },
    );
  }
  const results = (resultsData ?? []) as V2PerPolicyResult[];
  const resultIds = results.map((r) => r.id);

  // 7. Fetch judgments for those per-policy results.
  let judgments: V2Judgment[] = [];
  if (resultIds.length > 0) {
    const { data: judgmentsData, error: judgmentsErr } = await client
      .from("v2_judgments")
      .select(
        "id, per_policy_result_id, reviewer_user_id, tier, verdict, rationale, evidence_refs, created_at, updated_at",
      )
      .in("per_policy_result_id", resultIds);
    if (judgmentsErr) {
      return NextResponse.json(
        { error: "judgments_query_failed", detail: judgmentsErr.message },
        { status: 500 },
      );
    }
    judgments = (judgmentsData ?? []) as V2Judgment[];
  }

  // 8a. Extract evidence_slices from the raw eval result JSON.
  // Returns null for older schema_version 0.0.1 evals that predate this field.
  const evidenceSlices = extractEvidenceSlices(evaluation.raw_eval_result_json);

  // 8b. Pre-compute snapshot hash; check cache.
  // The hash now includes evidence_slices content hashes so memos invalidate
  // when slices change (e.g. after the submission-text correction engine run).
  const snapshotHash = computeJudgmentSnapshotHash(judgments, evidenceSlices);
  // Cache lookup: version-aware. A stale generator_version row is a MISS so
  // that a version bump always causes regeneration without a manual purge.
  const { data: cachedRow, error: cachedErr } = await client
    .from("v2_memo_exports")
    .select("id, content_sha256, byte_size, judgment_snapshot_hash")
    .eq("evaluation_id", evaluation.id)
    .eq("judgment_snapshot_hash", snapshotHash)
    .eq("generator_version", MEMO_GENERATOR_VERSION)
    .maybeSingle();
  if (cachedErr) {
    return NextResponse.json(
      { error: "memo_cache_query_failed", detail: cachedErr.message },
      { status: 500 },
    );
  }
  if (cachedRow) {
    const row = cachedRow as {
      id: string;
      content_sha256: string;
      byte_size: number;
    };
    return NextResponse.json(
      {
        memo_id: row.id,
        content_sha256: row.content_sha256,
        byte_size: row.byte_size,
        cached: true,
      },
      { status: 200 },
    );
  }

  // 9. Build memo (pass evidenceSlices so verbatim excerpts are inlined).
  let built;
  try {
    built = await buildMemo({ project, evaluation, results, judgments, evidenceSlices });
  } catch (err) {
    if (err instanceof MemoBuildInvariantError) {
      return NextResponse.json(
        { error: "memo_build_invariant_violation", detail: err.message },
        { status: 422 },
      );
    }
    return NextResponse.json(
      {
        error: "memo_build_failed",
        detail: (err as Error).message ?? "unknown_error",
      },
      { status: 500 },
    );
  }

  // 10. Insert.
  //
  // CRITICAL: supabase-js sends inserts as JSON to PostgREST. Passing a Node
  // Buffer or Uint8Array here gets JSON-serialized into an object shape that
  // PostgreSQL cannot interpret as BYTEA, corrupting the stored bytes (this
  // was the root cause of the 2026-05-12 docx download corruption: Word
  // refused to open the file, Notepad++ showed gibberish). We must encode the
  // bytes as a Postgres `\x<hex>` literal string -- which is the canonical
  // PostgREST representation for BYTEA inserts.
  const insertResp = await client
    .from("v2_memo_exports")
    .insert({
      evaluation_id: evaluation.id,
      generator_version: MEMO_GENERATOR_VERSION,
      judgment_snapshot_hash: built.judgmentSnapshotHash,
      content_sha256: built.contentSha256,
      content_blob: encodeByteaHex(built.bytes),
      byte_size: built.bytes.byteLength,
    })
    .select("id, content_sha256, byte_size")
    .single();

  if (insertResp.error) {
    // 23505 unique violation: another request inserted between our cache check
    // and our insert. Re-read the existing row and check its generator_version.
    // If it is the same version (concurrent same-version write), return it as
    // a cache hit. If it is a stale version, DELETE it and retry the INSERT
    // once (bounded: at most one delete + one retry).
    const code = (insertResp.error as { code?: string }).code;
    if (code === "23505") {
      const { data: reRead, error: reReadErr } = await client
        .from("v2_memo_exports")
        .select("id, content_sha256, byte_size, generator_version")
        .eq("evaluation_id", evaluation.id)
        .eq("judgment_snapshot_hash", built.judgmentSnapshotHash)
        .maybeSingle();
      if (reReadErr || !reRead) {
        return NextResponse.json(
          {
            error: "memo_post_conflict_reread_failed",
            detail: reReadErr?.message ?? "no_row",
          },
          { status: 500 },
        );
      }
      const existingRow = reRead as {
        id: string;
        content_sha256: string;
        byte_size: number;
        generator_version: string;
      };
      // Same-version concurrent write -- reuse the row.
      if (existingRow.generator_version === MEMO_GENERATOR_VERSION) {
        return NextResponse.json(
          {
            memo_id: existingRow.id,
            content_sha256: existingRow.content_sha256,
            byte_size: existingRow.byte_size,
            cached: true,
          },
          { status: 200 },
        );
      }
      // Stale version row -- DELETE it and retry the INSERT once.
      //
      // (a) The DELETE predicate (id = existingRow.id) targets the exact row
      //     the reread SELECT just returned, so RLS cannot hide from the DELETE
      //     a row it already exposed via SELECT (both are governed by the same
      //     owner/admin FOR ALL policy).
      // (b) Transient window: a concurrent regenerator's reread can observe
      //     null in the gap between this request's DELETE and its re-INSERT.
      //     That concurrent request returns a retryable 500 (no row found on
      //     reread); the caller simply re-requests. We do not loop here -- the
      //     delete + retry is bounded to one attempt to avoid unbounded churn.
      const { error: deleteErr } = await client
        .from("v2_memo_exports")
        .delete()
        .eq("id", existingRow.id);
      if (deleteErr) {
        return NextResponse.json(
          {
            error: "memo_stale_delete_failed",
            detail: deleteErr.message,
          },
          { status: 500 },
        );
      }
      // Retry INSERT (bounded: one attempt only).
      const retryResp = await client
        .from("v2_memo_exports")
        .insert({
          evaluation_id: evaluation.id,
          generator_version: MEMO_GENERATOR_VERSION,
          judgment_snapshot_hash: built.judgmentSnapshotHash,
          content_sha256: built.contentSha256,
          content_blob: encodeByteaHex(built.bytes),
          byte_size: built.bytes.byteLength,
        })
        .select("id, content_sha256, byte_size")
        .single();
      if (retryResp.error) {
        // Concurrent same-version writer won the retry -- reread and return.
        if ((retryResp.error as { code?: string }).code === "23505") {
          const { data: retryRead, error: retryReadErr } = await client
            .from("v2_memo_exports")
            .select("id, content_sha256, byte_size")
            .eq("evaluation_id", evaluation.id)
            .eq("judgment_snapshot_hash", built.judgmentSnapshotHash)
            .eq("generator_version", MEMO_GENERATOR_VERSION)
            .maybeSingle();
          if (retryReadErr || !retryRead) {
            return NextResponse.json(
              {
                error: "memo_retry_conflict_reread_failed",
                detail: retryReadErr?.message ?? "no_row",
              },
              { status: 500 },
            );
          }
          const retryRow = retryRead as {
            id: string;
            content_sha256: string;
            byte_size: number;
          };
          return NextResponse.json(
            {
              memo_id: retryRow.id,
              content_sha256: retryRow.content_sha256,
              byte_size: retryRow.byte_size,
              cached: true,
            },
            { status: 200 },
          );
        }
        return NextResponse.json(
          { error: "memo_retry_insert_failed", detail: retryResp.error.message },
          { status: 500 },
        );
      }
      const retryInserted = retryResp.data as {
        id: string;
        content_sha256: string;
        byte_size: number;
      };
      return NextResponse.json(
        {
          memo_id: retryInserted.id,
          content_sha256: retryInserted.content_sha256,
          byte_size: retryInserted.byte_size,
          cached: false,
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { error: "memo_insert_failed", detail: insertResp.error.message },
      { status: 500 },
    );
  }

  const inserted = insertResp.data as {
    id: string;
    content_sha256: string;
    byte_size: number;
  };
  return NextResponse.json(
    {
      memo_id: inserted.id,
      content_sha256: inserted.content_sha256,
      byte_size: inserted.byte_size,
      cached: false,
    },
    { status: 200 },
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; evalId: string }> },
): Promise<NextResponse> {
  const auth = await requireAdminForApi();
  if (auth instanceof NextResponse) return auth;
  const { client } = auth;

  const { id: projectId, evalId } = await context.params;

  const memoId = request.nextUrl.searchParams.get("memo_id");
  if (!memoId) {
    return NextResponse.json({ error: "missing_memo_id" }, { status: 400 });
  }

  // Ownership double-bind: project must be visible (RLS gate on v2_projects).
  const { data: projectRow } = await client
    .from("v2_projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (!projectRow) {
    return NextResponse.json({ error: "forbidden_or_not_found" }, { status: 403 });
  }

  // RLS on v2_memo_exports already filters by admin-owner; we additionally
  // join evaluation_id to evalId so a URL-tampered memo_id from another
  // evaluation cannot leak.
  const { data: memoRow, error: memoErr } = await client
    .from("v2_memo_exports")
    .select(
      "id, evaluation_id, content_blob, content_sha256, byte_size",
    )
    .eq("id", memoId)
    .eq("evaluation_id", evalId)
    .maybeSingle();
  if (memoErr) {
    return NextResponse.json(
      { error: "memo_query_failed", detail: memoErr.message },
      { status: 500 },
    );
  }
  if (!memoRow) {
    return NextResponse.json({ error: "memo_not_found" }, { status: 404 });
  }

  const row = memoRow as {
    id: string;
    content_blob: unknown;
    content_sha256: string;
    byte_size: number;
  };

  let blob: Buffer | null;
  try {
    blob = decodeSupabaseBytea(row.content_blob);
  } catch (err) {
    return NextResponse.json(
      {
        error: "memo_content_decode_failed",
        detail: (err as Error).message ?? "unknown_decode_error",
      },
      { status: 500 },
    );
  }
  if (!blob) {
    return NextResponse.json(
      { error: "memo_content_unavailable" },
      { status: 500 },
    );
  }

  // Defensive: if the stored byte_size disagrees with the decoded length, the
  // row is corrupted -- refuse to serve a truncated/extended file rather than
  // ship an invalid .docx (ZIP integrity check would fail in Word anyway).
  if (blob.byteLength !== row.byte_size) {
    return NextResponse.json(
      {
        error: "memo_content_length_mismatch",
        detail: `expected ${row.byte_size} bytes, decoded ${blob.byteLength}`,
      },
      { status: 500 },
    );
  }

  const filename = `memo-${evalId.slice(0, 8)}-${shortHash(row.content_sha256)}.docx`;
  // Create a fresh Uint8Array view over only the bytes we want -- avoids any
  // ambiguity when `blob` is a Node Buffer that aliases a larger pool buffer.
  // (Node Buffers can share underlying ArrayBuffers with siblings; passing
  // the raw .buffer to NextResponse would leak unrelated bytes.)
  const body = new Uint8Array(blob.byteLength);
  body.set(blob);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(blob.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
