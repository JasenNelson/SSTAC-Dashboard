// offline engine->dashboard round-trip contract test; deterministic; no network/
// Supabase/DB; the REAL artifact is read from an external engine worktree path and the suite
// SKIPS (describe.skipIf) when absent so CI stays green; locally it is the M6 last-mile gate.
// State: import-readiness GREEN (engine validator) is a PRECONDITION run engine-side; this test
// proves the dashboard projection preserves reviewer-visible content.

import { existsSync, readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  importEvalResult,
  type EvalResultEnvelope,
} from "../eval_result_import";

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

const REAL_ARTIFACT = "C:\\Projects\\Regulatory-Review-worktrees\\engine-v2-m6-overnight-2026-07-03\\engine_v2\\data\\eval_runs\\m6_overnight\\m6_quality_42_run1\\636249a3-3302-4048-bca8-167fa6e90060\\eval_result.json";
// OPT-IN (codex sstac-pn-r1 P2): the real artifact lives OUTSIDE this repo and can change without
// a dashboard diff -- the suite must never run implicitly just because the file exists. Enable
// locally with: RR_ENGINE_ROUNDTRIP=1 npx vitest run <this file>.
const OPT_IN = process.env.RR_ENGINE_ROUNDTRIP === "1";
const HAVE = OPT_IN && existsSync(REAL_ARTIFACT);

type Row = Record<string, unknown>;

function assertRoundTripInvariants(envelope: EvalResultEnvelope, rows: Row[]) {
  const perPolicy = (envelope.per_policy_results ?? []) as Row[];
  // a. rows.length === envelope.per_policy_results.length;
  expect(rows.length).toBe(perPolicy.length);

  // b. every row policy_id is a non-empty string and the multiset of policy_ids matches the envelope's;
  const envPolicyIds = [...perPolicy.map((r) => r.policy_id as string)].sort();
  const rowPolicyIds = [...rows.map((r) => r.policy_id as string)].sort();
  expect(rowPolicyIds).toEqual(envPolicyIds);
  rows.forEach((r) => {
    expect(typeof r.policy_id).toBe("string");
    expect((r.policy_id as string).length).toBeGreaterThan(0);
  });

  rows.forEach((r) => {
    // c. every row confidence is a finite number in [0,1];
    expect(Number.isFinite(r.confidence)).toBe(true);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);

    // d. every row tier is one of TIER_1_BINARY/TIER_2_PROFESSIONAL/TIER_3_STATUTORY
    // tier is carried as DATA; this test does not endorse its regulatory correctness
    expect(["TIER_1_BINARY", "TIER_2_PROFESSIONAL", "TIER_3_STATUTORY"]).toContain(r.tier);

    // e. every row evidence_packet is an Array (0.1.0 rows) and its length equals the source row's
    // evidence_packet length (content preserved verbatim by reference equality on raw_result_json);
    expect(Array.isArray(r.evidence_packet)).toBe(true);
    const sourceRow = perPolicy.find((pr) => pr.policy_id === r.policy_id) as Row;
    expect(Array.isArray(sourceRow.evidence_packet)).toBe(true); // 0.1.0 contract: array at source too
    expect((r.evidence_packet as unknown[]).length).toBe((sourceRow.evidence_packet as unknown[]).length);
    // e2. projection consistency (Claude verification fix, 2026-07-22): the ADVERTISED total_cited
    // must match the PROJECTED packet length for flat-array 0.1.0 rows -- this is what makes a
    // null/absent packet with advertised counts FAIL here instead of silently projecting to [].
    // (Dashboard-collected-count equality with corpus filtering is the engine validator's job;
    // this asserts only that the reviewer sees as many cards as the header advertises.)
    const sc = r.evidence_signal_counts as Record<string, unknown>;
    expect(sc.total_cited).toBe((r.evidence_packet as unknown[]).length);

    // f. every row s4_schema_version === "0.1.0" and evidence_signal_counts has the 5 numeric fields
    // total_cited/supporting/negating/absence_or_category_mismatch/neutral;
    expect(r.s4_schema_version).toBe("0.1.0");
    expect(r.evidence_signal_counts).toBeDefined();
    expect(typeof sc.total_cited).toBe("number");
    expect(typeof sc.supporting).toBe("number");
    expect(typeof sc.negating).toBe("number");
    expect(typeof sc.absence_or_category_mismatch).toBe("number");
    expect(typeof sc.neutral).toBe("number");

    // g. every row pathway_notes is an Array (engine 0.1.0 emits arrays; may be empty);
    expect(Array.isArray(r.pathway_notes)).toBe(true);

    // h. every row raw_result_json.indigenous_content_signal is a non-null object with boolean matched
    // Indigenous-content signal = pathway-relevant evidence metadata, never an automatic determination
    const rawJson = r.raw_result_json as Record<string, unknown>;
    expect(rawJson).toBeDefined();
    const ics = rawJson.indigenous_content_signal as Record<string, unknown> | null;
    expect(typeof ics).toBe("object");
    expect(ics).not.toBeNull();
    expect(typeof (ics as Record<string, unknown>).matched).toBe("boolean");
  });
}

describe.skipIf(!HAVE)("real artifact round-trip (opt-in via RR_ENGINE_ROUNDTRIP=1)", () => {
  const EVAL_ID = "11111111-2222-3333-4444-555555555555";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("real 42-policy artifact round-trips through importEvalResult with reviewer-visible content preserved", async () => {
    const content = readFileSync(REAL_ARTIFACT, "utf-8");
    const envelope = JSON.parse(content) as EvalResultEnvelope;

    const { client, calls } = makeMockClient();
    const result = await importEvalResult(client, EVAL_ID, envelope);

    // i. terminal: importEvalResult result.terminalStatus === "completed" for the real artifact.
    expect(result.terminalStatus).toBe("completed");
    expect(result.rowsImported).toBe(42);

    const upsertCall = calls.find((c) => c.op === "upsert");
    expect(upsertCall).toBeDefined();
    const rows = upsertCall!.rows as Row[];
    expect(rows.length).toBe(42);

    assertRoundTripInvariants(envelope, rows);
  });

  it("re-import is idempotent (same importer keys)", async () => {
    const content = readFileSync(REAL_ARTIFACT, "utf-8");
    const envelope = JSON.parse(content) as EvalResultEnvelope;

    const { client, calls } = makeMockClient();
    await importEvalResult(client, EVAL_ID, envelope);
    await importEvalResult(client, EVAL_ID, envelope);

    const upserts = calls.filter((c) => c.op === "upsert");
    expect(upserts).toHaveLength(2);

    const rows1 = upserts[0]!.rows as Row[];
    const rows2 = upserts[1]!.rows as Row[];

    const keyFor = (r: Row) => `${r.policy_id}|${r.stage}|${r.packet_id}`;
    const keys1 = rows1.map(keyFor).sort();
    const keys2 = rows2.map(keyFor).sort();

    expect(keys1).toEqual(keys2);
  });
});

function makePolicyRow(
  policyId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    policy_id: policyId,
    schema_version: "0.1.0",
    stage: "S4",
    packet_id: "pkt_1",
    tier: "TIER_1_BINARY",
    confidence: 0.92,
    confidence_method: "calibrated",
    confidence_scope: "EVIDENCE_MATCH_NOT_ADEQUACY",
    summary: "Sample summary",
    evidence_present: true,
    evidence_packet: [{ evidence_item_id: "c1" }],
    pathway_notes: [],
    // internally consistent (codex sstac-pn-r1 P3): 1 packet item => total_cited/supporting 1, so
    // each failure fixture throws on ITS OWN invariant, not on the e2 count mismatch.
    evidence_signal_counts: {
      total_cited: 1,
      supporting: 1,
      negating: 0,
      absence_or_category_mismatch: 0,
      neutral: 0,
    },
    evidence_synthesis_self_score: { appropriateness: 4, sufficiency: 4 },
    indigenous_content_signal: { matched: false },
    ...overrides,
  };
}

function makeEnvelope(
  overrides: Partial<EvalResultEnvelope> = {},
): EvalResultEnvelope {
  return {
    run_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    schema_version: "0.1.0",
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

describe("failure fixtures", () => {
  const EVAL_ID = "22222222-3333-4444-5555-666666666666";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("validator-RED shape: null evidence_packet does not silently satisfy the round-trip invariants", async () => {
    const env = makeEnvelope({
      per_policy_results: [
        makePolicyRow("CSR-RED-1", { evidence_packet: null })
      ] as unknown as EvalResultEnvelope["per_policy_results"],
    });
    const { client, calls } = makeMockClient();
    
    // import succeeds (importer is permissive)
    await importEvalResult(client, EVAL_ID, env);
    
    const upsertCall = calls.find((c) => c.op === "upsert");
    const rows = upsertCall!.rows as Row[];
    
    // BUT expect(() => assertRoundTripInvariants(...)).toThrow()
    expect(() => assertRoundTripInvariants(env, rows)).toThrow();
  });

  it("validator-RED shape: null indigenous_content_signal fails the invariants", async () => {
    const env = makeEnvelope({
      per_policy_results: [
        makePolicyRow("CSR-RED-2", { indigenous_content_signal: null })
      ] as unknown as EvalResultEnvelope["per_policy_results"],
    });
    const { client, calls } = makeMockClient();
    
    await importEvalResult(client, EVAL_ID, env);
    
    const upsertCall = calls.find((c) => c.op === "upsert");
    const rows = upsertCall!.rows as Row[];
    
    expect(() => assertRoundTripInvariants(env, rows)).toThrow();
  });

  it("validator-RED shape: array-stripped legacy pathway_notes object on a 0.1.0 row is surfaced", async () => {
    const env = makeEnvelope({
      per_policy_results: [
        makePolicyRow("CSR-RED-3", { pathway_notes: { legacy: true } })
      ] as unknown as EvalResultEnvelope["per_policy_results"],
    });
    const { client, calls } = makeMockClient();
    
    await importEvalResult(client, EVAL_ID, env);
    
    const upsertCall = calls.find((c) => c.op === "upsert");
    const rows = upsertCall!.rows as Row[];
    
    expect(() => assertRoundTripInvariants(env, rows)).toThrow();
  });
});
