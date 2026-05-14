// engine_v2 frontend Lane 2a / Module L2a-3: tests for eval_result_import.ts.
//
// Covers the codex BLOCKER fix:
//   - UPSERT per_policy_results FIRST, then UPDATE v2_evaluations LAST.
//   - DO UPDATE (not DO NOTHING) on conflict so retries repair partial rows.
//   - Terminal status classification from coverage_statement.error + telemetry.errors.
//   - If UPSERT fails, the terminal UPDATE must NOT fire.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  importEvalResult,
  type EvalResultEnvelope,
} from "../eval_result_import";

// Track the order in which `.from()` is called so we can assert UPSERT before UPDATE.
type CallLog = Array<{
  table: string;
  op: "upsert" | "update";
  rows?: unknown;
  patch?: Record<string, unknown>;
  onConflict?: string;
  ignoreDuplicates?: boolean;
}>;

interface MockConfig {
  upsertError?: { message: string } | null;
  updateError?: { message: string } | null;
}

function makeMockClient(cfg: MockConfig = {}): {
  client: SupabaseClient;
  calls: CallLog;
} {
  const calls: CallLog = [];

  const from = (table: string) => {
    if (table === "v2_per_policy_results") {
      return {
        upsert: (
          rows: unknown,
          opts: { onConflict?: string; ignoreDuplicates?: boolean },
        ) => {
          calls.push({
            table,
            op: "upsert",
            rows,
            onConflict: opts?.onConflict,
            ignoreDuplicates: opts?.ignoreDuplicates,
          });
          return Promise.resolve({
            error: cfg.upsertError ?? null,
            data: null,
          });
        },
      };
    }
    if (table === "v2_evaluations") {
      return {
        update: (patch: Record<string, unknown>) => {
          calls.push({ table, op: "update", patch });
          return {
            eq: (_col: string, _val: string) =>
              Promise.resolve({
                error: cfg.updateError ?? null,
                data: null,
              }),
          };
        },
      };
    }
    throw new Error(`unexpected table: ${table}`);
  };

  const client = { from } as unknown as SupabaseClient;
  return { client, calls };
}

const EVAL_ID = "11111111-2222-3333-4444-555555555555";

function makeEnvelope(
  overrides: Partial<EvalResultEnvelope> = {},
): EvalResultEnvelope {
  return {
    run_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    schema_version: "0.0.1",
    variant_config_hash: "vhash_abc",
    provenance: { corpus_version: "v2026.05" },
    per_policy_results: [],
    coverage_statement: {
      total_policies: 1,
      evaluated: 1,
      deferred: 0,
      error: 0,
      deferred_reasons: {},
    },
    telemetry: { errors: [] },
    ...overrides,
  };
}

function makePolicyRow(
  policyId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    policy_id: policyId,
    stage: "S4",
    packet_id: "pkt_1",
    tier: "TIER_1_BINARY",
    verdict_suggestion: "PASS",
    ai_suggestion: "PASS",
    confidence: 0.92,
    confidence_method: "calibrated",
    summary: "Sample summary",
    evidence_packet: { hits: [{ chunk_id: "c1" }] },
    pathway_notes: {},
    rubric_self_score: { overall: 4 },
    ...overrides,
  };
}

describe("importEvalResult", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path: 3 per_policy rows, empty errors -> completed; UPSERT before UPDATE", async () => {
    const env = makeEnvelope({
      per_policy_results: [
        makePolicyRow("CSR-1"),
        makePolicyRow("CSR-2"),
        makePolicyRow("CSR-3"),
      ],
    });
    const { client, calls } = makeMockClient();

    const result = await importEvalResult(client, EVAL_ID, env);

    expect(result.rowsImported).toBe(3);
    expect(result.terminalStatus).toBe("completed");
    expect(result.errorsCount).toBe(0);

    // Order: UPSERT first, UPDATE last.
    expect(calls).toHaveLength(2);
    expect(calls[0]!.table).toBe("v2_per_policy_results");
    expect(calls[0]!.op).toBe("upsert");
    expect(calls[1]!.table).toBe("v2_evaluations");
    expect(calls[1]!.op).toBe("update");

    // Verify codex DO UPDATE semantics: ignoreDuplicates explicitly false.
    expect(calls[0]!.onConflict).toBe(
      "evaluation_id,policy_id,stage,packet_id",
    );
    expect(calls[0]!.ignoreDuplicates).toBe(false);

    // UPDATE patch carries terminal status + provenance.
    expect(calls[1]!.patch).toMatchObject({
      status: "completed",
      run_id_engine: env.run_id,
      variant_config_hash: env.variant_config_hash,
    });
  });

  it("telemetry.errors non-empty -> completed_with_errors", async () => {
    const env = makeEnvelope({
      per_policy_results: [makePolicyRow("CSR-1")],
      telemetry: { errors: [{ kind: "stage_warning", msg: "x" }] },
    });
    const { client, calls } = makeMockClient();

    const result = await importEvalResult(client, EVAL_ID, env);

    expect(result.terminalStatus).toBe("completed_with_errors");
    expect(result.errorsCount).toBe(1);
    expect(calls[1]!.patch?.status).toBe("completed_with_errors");
    expect(calls[1]!.patch?.errors).toEqual([
      { kind: "stage_warning", msg: "x" },
    ]);
  });

  it("coverage_statement.error > 0 -> completed_with_errors even when telemetry empty", async () => {
    const env = makeEnvelope({
      per_policy_results: [makePolicyRow("CSR-1")],
      coverage_statement: {
        total_policies: 5,
        evaluated: 3,
        deferred: 0,
        error: 2,
        deferred_reasons: {},
      },
      telemetry: { errors: [] },
    });
    const { client, calls } = makeMockClient();

    const result = await importEvalResult(client, EVAL_ID, env);

    expect(result.terminalStatus).toBe("completed_with_errors");
    expect(result.errorsCount).toBe(0);
    expect(calls[1]!.patch?.status).toBe("completed_with_errors");
  });

  it("empty per_policy_results -> rowsImported=0 and NO upsert call, but UPDATE still runs", async () => {
    const env = makeEnvelope({ per_policy_results: [] });
    const { client, calls } = makeMockClient();

    const result = await importEvalResult(client, EVAL_ID, env);

    expect(result.rowsImported).toBe(0);
    expect(result.terminalStatus).toBe("completed");
    // Only UPDATE was made.
    expect(calls).toHaveLength(1);
    expect(calls[0]!.table).toBe("v2_evaluations");
    expect(calls[0]!.op).toBe("update");
  });

  it("UPSERT failure throws and UPDATE is NEVER called (codex ordering)", async () => {
    const env = makeEnvelope({
      per_policy_results: [makePolicyRow("CSR-1")],
    });
    const { client, calls } = makeMockClient({
      upsertError: { message: "duplicate key value" },
    });

    await expect(importEvalResult(client, EVAL_ID, env)).rejects.toThrow(
      /per_policy_upsert_failed/,
    );

    // CRITICAL: no UPDATE call after a failed UPSERT. This is the codex
    // BLOCKER fix -- without it, a partial import could leave a "completed"
    // evaluation row with missing per_policy verdicts.
    const updateCalls = calls.filter(
      (c) => c.table === "v2_evaluations" && c.op === "update",
    );
    expect(updateCalls).toHaveLength(0);
  });

  it("DO UPDATE semantics: re-import same envelope twice is idempotent", async () => {
    const env = makeEnvelope({
      per_policy_results: [makePolicyRow("CSR-1"), makePolicyRow("CSR-2")],
    });
    const { client, calls } = makeMockClient();

    const r1 = await importEvalResult(client, EVAL_ID, env);
    const r2 = await importEvalResult(client, EVAL_ID, env);

    expect(r1.rowsImported).toBe(2);
    expect(r2.rowsImported).toBe(2);
    expect(r1.terminalStatus).toBe(r2.terminalStatus);

    // Each import emits one upsert and one update; total 4 calls. The mock
    // backend always returns success for upsert (since DO UPDATE is the
    // contract). At the real DB layer, ON CONFLICT DO UPDATE will overwrite
    // rather than insert-duplicate or no-op.
    expect(calls).toHaveLength(4);
    expect(calls[0]!.op).toBe("upsert");
    expect(calls[1]!.op).toBe("update");
    expect(calls[2]!.op).toBe("upsert");
    expect(calls[3]!.op).toBe("update");

    // Both upsert calls pass DO UPDATE semantics.
    expect(calls[0]!.ignoreDuplicates).toBe(false);
    expect(calls[2]!.ignoreDuplicates).toBe(false);
  });

  it("evaluation UPDATE failure surfaces as throw", async () => {
    const env = makeEnvelope({
      per_policy_results: [makePolicyRow("CSR-1")],
    });
    const { client } = makeMockClient({
      updateError: { message: "rls_violation" },
    });

    await expect(importEvalResult(client, EVAL_ID, env)).rejects.toThrow(
      /evaluation_update_failed/,
    );
  });

  it("normalizes per_policy row: missing fields default to null/empty objects", async () => {
    const env = makeEnvelope({
      per_policy_results: [{ policy_id: "CSR-NULL" }],
    });
    const { client, calls } = makeMockClient();

    const result = await importEvalResult(client, EVAL_ID, env);
    expect(result.rowsImported).toBe(1);

    const upsertCall = calls.find((c) => c.op === "upsert");
    expect(upsertCall).toBeDefined();
    const rows = upsertCall!.rows as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      evaluation_id: EVAL_ID,
      policy_id: "CSR-NULL",
      // stage and packet_id default to "" (NOT NULL columns per Lane 2a hotfix)
      // so the unique index (evaluation_id, policy_id, stage, packet_id) always
      // resolves on the upsert onConflict tuple.
      stage: "",
      packet_id: "",
      tier: null,
      verdict_suggestion: null,
      confidence: null,
      evidence_packet: [],
      pathway_notes: {},
      rubric_self_score: null,
    });
    // raw_result_json preserves the original row.
    expect(rows[0]!.raw_result_json).toEqual({ policy_id: "CSR-NULL" });
  });

  it("empty per_policy_results + telemetry errors -> completed_with_errors", async () => {
    const env = makeEnvelope({
      per_policy_results: [],
      telemetry: { errors: ["boom"] },
    });
    const { client, calls } = makeMockClient();

    const result = await importEvalResult(client, EVAL_ID, env);
    expect(result.rowsImported).toBe(0);
    expect(result.terminalStatus).toBe("completed_with_errors");
    expect(result.errorsCount).toBe(1);
    // Only UPDATE fired.
    expect(calls).toHaveLength(1);
    expect(calls[0]!.op).toBe("update");
  });

  // --- P0 regression: evidence_packet array must survive import ---
  //
  // Root cause: asRecord(raw.evidence_packet) ?? {} stripped arrays to {}.
  // The engine S4 contract emits evidence_packet as an ARRAY of evidence-item
  // objects (each carrying evidence_item_id, evidence_type, evidence_item_ref).
  // The fix uses asArray first so the stored JSONB column carries the full array.

  it("P0 regression: evidence_packet array of 3 items survives toPerPolicyRow (not stripped to {})", async () => {
    const evidenceItems = [
      { evidence_item_id: "slice_aaa", evidence_type: "POSITIVE", evidence_item_ref: { index_side: "submission" } },
      { evidence_item_id: "slice_bbb", evidence_type: "NEGATIVE", evidence_item_ref: { index_side: "submission" } },
      { evidence_item_id: "slice_ccc", evidence_type: "NEUTRAL",  evidence_item_ref: { index_side: "submission" } },
    ];
    const env = makeEnvelope({
      per_policy_results: [
        {
          policy_id: "CSR-EP",
          stage: "S4",
          packet_id: "pkt_ep",
          tier: "TIER_1_BINARY",
          verdict_suggestion: "PASS",
          ai_suggestion: "PASS",
          confidence: 0.88,
          confidence_method: "calibrated",
          summary: "Adequate submission text found.",
          evidence_packet: evidenceItems,
          pathway_notes: {},
          rubric_self_score: null,
        },
      ],
    });
    const { client, calls } = makeMockClient();

    const result = await importEvalResult(client, EVAL_ID, env);
    expect(result.rowsImported).toBe(1);

    const upsertCall = calls.find((c) => c.op === "upsert");
    expect(upsertCall).toBeDefined();
    const rows = upsertCall!.rows as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);

    // CRITICAL: evidence_packet must be the original array, NOT {} and NOT [].
    const ep = rows[0]!.evidence_packet;
    expect(Array.isArray(ep)).toBe(true);
    expect((ep as unknown[]).length).toBe(3);
    expect(ep).toEqual(evidenceItems);
  });

  it("P0 regression: missing evidence_packet falls back to [] not {}", async () => {
    const env = makeEnvelope({
      per_policy_results: [{ policy_id: "CSR-NOEP" }],
    });
    const { client, calls } = makeMockClient();

    await importEvalResult(client, EVAL_ID, env);

    const rows = (calls.find((c) => c.op === "upsert")!.rows) as Array<Record<string, unknown>>;
    expect(rows[0]!.evidence_packet).toEqual([]);
  });

  it("P0 regression: object-shaped evidence_packet (legacy schema 0.0.1) still accepted", async () => {
    const legacyPacket = { hits: [{ chunk_id: "c1" }], score: 0.9 };
    const env = makeEnvelope({
      per_policy_results: [
        { ...makePolicyRow("CSR-LEGACY"), evidence_packet: legacyPacket },
      ],
    });
    const { client, calls } = makeMockClient();

    await importEvalResult(client, EVAL_ID, env);

    const rows = (calls.find((c) => c.op === "upsert")!.rows) as Array<Record<string, unknown>>;
    // Object-shaped packet is preserved as-is (asArray returns null -> asRecord succeeds).
    expect(rows[0]!.evidence_packet).toEqual(legacyPacket);
  });
});
