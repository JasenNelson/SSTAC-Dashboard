// engine_v2 Gate 2A (WARP-43 launch-slice plan v5, Phase 2A): local mock-client
// test against the REAL CANARY E-58 eval_result.json artifact (42-policy WARP+HHRA+IH
// run, 2026-07-04). Proves the WIRING of importEvalResult -> runIndexerNonBlocking ->
// indexSubmissionChunksFromEnvelope -> replaceChunksTransactional -> rpc() against real
// production-shaped data, with ZERO database/network involved.
//
// Scope note (Leg-1 review, 2026-07-07): the RPC-payload assertion derives its
// "expected" values from the SAME pure functions (buildSubmissionChunkRows/
// buildCitationRows) production code calls -- so a bug INSIDE those functions would
// pass on both sides. This test validates the PLUMBING (call order, evaluation_id
// stripping, status-chain sequencing, row counts) using real data shapes, not
// row-CONTENT correctness of those pure functions -- that lives in
// submission_chunks_indexing.test.ts's own hand-crafted-fixture assertions. The one
// non-circular content check here is the hard-coded tier==="TIER_1_BINARY" /
// confidence===0.75 spot-check on a named real policy, verifying toPerPolicyRow's
// field mapping independently.
//
// This is separate from eval_result_import.test.ts (which uses small hand-crafted
// fixtures and does not exercise the real indexer/RPC path) so it doesn't disturb
// that file's existing coverage.
//
// See .tmp_warp43_launch_execution_plan_v5_20260707.md Phase 2A for the plan this
// test implements.
//
// codex Leg-2 P1 fix (2026-07-07): this test reads a machine-local artifact path
// that does not exist on CI or other developer machines. Gated behind
// RR_ENGINE_INTEGRATION=1 + fs.existsSync(), mirroring the existing pattern in
// propose_policies.integration.test.ts (same skip-reason-string convention).
//
// To run locally:
//   $env:RR_ENGINE_INTEGRATION = "1"
//   npx vitest run src/lib/engine-v2/__tests__/eval_result_import.real_e58.test.ts

import * as fs from "fs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  importEvalResult,
  type EvalResultEnvelope,
} from "../eval_result_import";
import {
  buildSubmissionChunkRows,
  buildCitationRows,
  type PerPolicyResultLike,
} from "../submission_chunks_indexing";
import { extractEvidenceSlices } from "../evidence_slices";

// Real artifact path (read-only; already verified in R2, not modified by this test).
const E58_PATH =
  "C:\\Projects\\Regulatory-Review\\engine_v2_dashboard_staging\\data\\v2_dashboard_eval_runs\\33333333-3333-3333-3333-333333333333\\636249a3-3302-4048-bca8-167fa6e90060\\eval_result.json";

const TEST_EVAL_ID = "e58e58e5-8e58-4e58-8e58-e58e58e58e58";

// Skip conditions: env var not set, or the machine-local artifact is absent
// (CI runners and other developer machines will not have this path).
const integrationEnabled = process.env["RR_ENGINE_INTEGRATION"] === "1";
const artifactExists = fs.existsSync(E58_PATH);
const shouldRun = integrationEnabled && artifactExists;

const skipReason = !integrationEnabled
  ? "RR_ENGINE_INTEGRATION is not set to 1"
  : !artifactExists
    ? `E-58 artifact not found: ${E58_PATH}`
    : "";

type CallEntry =
  | {
      op: "upsert";
      table: string;
      row: unknown;
      onConflict?: string;
      ignoreDuplicates?: boolean;
    }
  | {
      op: "update";
      table: string;
      patch: Record<string, unknown>;
      eqCol?: string;
      eqVal?: string;
    }
  | { op: "rpc"; fn: string; args: Record<string, unknown> };

// Merges the two existing mock-client shapes (eval_result_import.test.ts's
// v2_per_policy_results/v2_evaluations coverage + submission_chunks_indexing.test.ts's
// v2_submission_chunks_indexing_status/rpc coverage) into one client that can run the
// REAL importEvalResult -> runIndexerNonBlocking -> indexSubmissionChunksFromEnvelope
// path end-to-end without a stray "unexpected table" throw disabling the indexer.
function makeMockClient(): { client: SupabaseClient; calls: CallEntry[] } {
  const calls: CallEntry[] = [];

  const from = (table: string) => {
    if (table === "v2_per_policy_results") {
      return {
        upsert: (
          rows: unknown,
          opts: { onConflict?: string; ignoreDuplicates?: boolean },
        ) => {
          calls.push({
            op: "upsert",
            table,
            row: rows,
            onConflict: opts?.onConflict,
            ignoreDuplicates: opts?.ignoreDuplicates,
          });
          return Promise.resolve({ error: null, data: null });
        },
      };
    }
    if (table === "v2_evaluations") {
      return {
        update: (patch: Record<string, unknown>) => {
          const entry: Extract<CallEntry, { op: "update" }> = {
            op: "update",
            table,
            patch,
          };
          calls.push(entry);
          return {
            eq: (col: string, val: string) => {
              entry.eqCol = col;
              entry.eqVal = val;
              return Promise.resolve({ error: null, data: null });
            },
          };
        },
      };
    }
    if (table === "v2_submission_chunks_indexing_status") {
      return {
        upsert: (row: unknown, _opts?: { onConflict?: string }) => {
          calls.push({ op: "upsert", table, row });
          return Promise.resolve({ error: null });
        },
      };
    }
    throw new Error(`unexpected table: ${table}`);
  };

  const rpc = (fn: string, args: Record<string, unknown>) => {
    calls.push({ op: "rpc", fn, args });
    return Promise.resolve({ error: null });
  };

  return { client: { from, rpc } as unknown as SupabaseClient, calls };
}

function perPolicyUpserts(calls: CallEntry[]) {
  return calls.filter(
    (c): c is Extract<CallEntry, { op: "upsert" }> =>
      c.op === "upsert" && c.table === "v2_per_policy_results",
  );
}
function evaluationUpdates(calls: CallEntry[]) {
  return calls.filter(
    (c): c is Extract<CallEntry, { op: "update" }> =>
      c.op === "update" && c.table === "v2_evaluations",
  );
}
function statusUpserts(calls: CallEntry[]) {
  return calls.filter(
    (c): c is Extract<CallEntry, { op: "upsert" }> =>
      c.op === "upsert" && c.table === "v2_submission_chunks_indexing_status",
  );
}
function rpcCalls(calls: CallEntry[]) {
  return calls.filter(
    (c): c is Extract<CallEntry, { op: "rpc" }> => c.op === "rpc",
  );
}

describe.skipIf(!shouldRun)(
  `importEvalResult against the real CANARY E-58 artifact (Gate 2A) (skip: ${skipReason || "none"})`,
  () => {
  let realEnvelope: EvalResultEnvelope;

  beforeEach(() => {
    vi.restoreAllMocks();
    const raw = fs.readFileSync(E58_PATH, "utf-8");
    realEnvelope = JSON.parse(raw) as EvalResultEnvelope;
  });

  it("fixture sanity check: schema_version, per_policy_results count, evidence_slices count, coverage_statement", () => {
    expect(realEnvelope.schema_version).toBe("0.1.0");
    expect(realEnvelope.per_policy_results).toHaveLength(42);
    expect(Object.keys(realEnvelope.evidence_slices ?? {})).toHaveLength(420);
    expect(realEnvelope.coverage_statement).toMatchObject({
      total_policies: 42,
      evaluated: 42,
      deferred: 0,
      error: 0,
    });
  });

  it("imports exactly 42 per_policy rows with correct field values and stamps completed status", async () => {
    const { client, calls } = makeMockClient();
    const result = await importEvalResult(client, TEST_EVAL_ID, realEnvelope);

    expect(result.rowsImported).toBe(42);
    expect(result.terminalStatus).toBe("completed");

    const upserts = perPolicyUpserts(calls);
    expect(upserts).toHaveLength(1);
    // Leg-1 minor #2: assert the onConflict tuple, not just capture it -- a
    // changed-conflict-tuple regression (wrong-row-target class of bug) would
    // not be caught without this.
    expect(upserts[0]!.onConflict).toBe(
      "evaluation_id,policy_id,stage,packet_id",
    );
    expect(upserts[0]!.ignoreDuplicates).toBe(false);
    const rows = upserts[0]!.row as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(42);

    const app23a = rows.find((r) => r.policy_id === "CSAP-NPG-RP-APP-23a");
    expect(app23a).toBeDefined();
    expect(app23a!.tier).toBe("TIER_1_BINARY");
    expect(app23a!.confidence).toBe(0.75);
  });

  it("persists the full envelope (including all 420 evidence_slices) in raw_eval_result_json and it dereferences correctly", async () => {
    const { client, calls } = makeMockClient();
    await importEvalResult(client, TEST_EVAL_ID, realEnvelope);

    const updates = evaluationUpdates(calls);
    expect(updates).toHaveLength(1);
    // Leg-1 minor #2: assert the .eq() row-target filter, not just capture
    // it -- a wrong-row-target regression (updating the wrong evaluation)
    // would not be caught without this.
    expect(updates[0]!.eqCol).toBe("id");
    expect(updates[0]!.eqVal).toBe(TEST_EVAL_ID);
    const patch = updates[0]!.patch;
    expect(patch.status).toBe("completed");

    const raw = patch.raw_eval_result_json as EvalResultEnvelope;
    expect(Object.keys(raw.evidence_slices ?? {})).toHaveLength(420);

    const slices = extractEvidenceSlices(raw);
    expect(slices).not.toBeNull();
    expect(Object.keys(slices!)).toHaveLength(420);
  });

  it("calls replace_submission_chunks RPC exactly once with the correctly-stripped p_chunks/p_citations payload", async () => {
    const { client, calls } = makeMockClient();
    await importEvalResult(client, TEST_EVAL_ID, realEnvelope);

    const rpcs = rpcCalls(calls);
    expect(rpcs).toHaveLength(1);
    expect(rpcs[0]!.fn).toBe("replace_submission_chunks");
    expect(rpcs[0]!.args.p_evaluation_id).toBe(TEST_EVAL_ID);

    // Ground-truth expected payload, derived directly from the fixture via the
    // SAME pure functions + the SAME extractEvidenceSlices() normalization step
    // the production code path uses (indexSubmissionChunksFromEnvelope calls
    // extractEvidenceSlices(rawEnvelope) before buildSubmissionChunkRows/
    // buildCitationRows -- not the raw evidence_slices dict directly).
    const normalizedSlices = extractEvidenceSlices(realEnvelope);
    expect(normalizedSlices).not.toBeNull();

    const expectedChunkRows = buildSubmissionChunkRows(
      TEST_EVAL_ID,
      normalizedSlices!,
    );
    const expectedCitationRows = buildCitationRows(
      TEST_EVAL_ID,
      (realEnvelope.per_policy_results ?? []) as PerPolicyResultLike[],
      normalizedSlices!,
    );

    // replaceChunksTransactional strips evaluation_id from every row before
    // building the RPC payload (defence-in-depth against row-payload spoofing;
    // submission_chunks_indexing.ts:212-239) -- so the expected payload is the
    // row output MINUS evaluation_id, not the raw row output.
    const expectedChunksPayload = expectedChunkRows.map(
      ({ evaluation_id, ...row }) => row,
    );
    const expectedCitationsPayload = expectedCitationRows.map(
      ({ evaluation_id, ...row }) => row,
    );

    expect(rpcs[0]!.args.p_chunks).toEqual(expectedChunksPayload);
    expect(rpcs[0]!.args.p_citations).toEqual(expectedCitationsPayload);
    expect((rpcs[0]!.args.p_chunks as unknown[]).length).toBe(420);

    // Explicit negative check: the stripping actually happened, not merely
    // that the values happen to coincide.
    for (const row of rpcs[0]!.args.p_chunks as Array<Record<string, unknown>>) {
      expect(row).not.toHaveProperty("evaluation_id");
    }
    for (const row of rpcs[0]!.args
      .p_citations as Array<Record<string, unknown>>) {
      expect(row).not.toHaveProperty("evaluation_id");
    }
  });

  it("indexer status chain runs pending -> running -> complete", async () => {
    const { client, calls } = makeMockClient();
    await importEvalResult(client, TEST_EVAL_ID, realEnvelope);

    const statuses = statusUpserts(calls).map(
      (c) => (c.row as Record<string, unknown>).status,
    );
    expect(statuses).toEqual(["pending", "running", "complete"]);
  });
  },
);
