import { describe, it, expect } from "vitest";

import {
  MEMO_GENERATOR_VERSION,
  MemoBuildInvariantError,
  buildMemo,
  computeJudgmentSnapshotHash,
  type MemoBuilderInput,
} from "../memo_builder";
import type {
  JudgmentTier,
  JudgmentVerdict,
  V2Evaluation,
  V2Judgment,
  V2PerPolicyResult,
} from "../types_lane2";
import type { V2Project } from "../types";

function makeProject(overrides: Partial<V2Project> = {}): Pick<V2Project, "id" | "name"> {
  return {
    id: overrides.id ?? "11111111-1111-1111-1111-111111111111",
    name: overrides.name ?? "Test Project",
  };
}

function makeEvaluation(overrides: Partial<V2Evaluation> = {}): V2Evaluation {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    project_id: "11111111-1111-1111-1111-111111111111",
    extraction_run_id: "33333333-3333-3333-3333-333333333333",
    status: "completed",
    run_id_engine: "run_abc",
    variant_config_hash: "vch_abc",
    evaluation_backend: "stub",
    embedder_backend: "stub",
    reranker_backend: "disabled",
    model: null,
    bench_fixture: "bench_43_full",
    applicability_mode: "off",
    coverage_statement: {
      total_policies: 43,
      evaluated: 40,
      deferred: 2,
      error: 1,
    },
    errors: [],
    raw_eval_result_json: {
      corpus_version: "v3.2",
      git_sha_at_run: "deadbeef",
    },
    started_at: "2026-05-12T10:00:00.000Z",
    completed_at: "2026-05-12T10:30:00.000Z",
    updated_at: "2026-05-12T10:30:00.000Z",
    ...overrides,
  };
}

let resultCounter = 0;
function makeResult(
  tier: JudgmentTier,
  policyId: string,
  aiSuggestion: string,
  overrides: Partial<V2PerPolicyResult> = {},
): V2PerPolicyResult {
  resultCounter += 1;
  const id = overrides.id ?? `r-${String(resultCounter).padStart(8, "0")}`;
  return {
    id,
    evaluation_id: "22222222-2222-2222-2222-222222222222",
    policy_id: policyId,
    stage: "S4",
    packet_id: null,
    tier,
    verdict_suggestion: aiSuggestion,
    ai_suggestion: aiSuggestion,
    confidence: 0.8,
    confidence_method: "stub",
    summary: "Summary for " + policyId,
    evidence_packet: {},
    pathway_notes: {},
    rubric_self_score: null,
    raw_result_json: {},
    created_at: "2026-05-12T10:20:00.000Z",
    ...overrides,
  };
}

function makeJudgment(
  perPolicyResultId: string,
  tier: JudgmentTier,
  verdict: JudgmentVerdict,
  overrides: Partial<V2Judgment> = {},
): V2Judgment {
  return {
    id: overrides.id ?? `j-${perPolicyResultId}`,
    per_policy_result_id: perPolicyResultId,
    reviewer_user_id: "user-1",
    tier,
    verdict,
    rationale: overrides.rationale ?? "Reviewer rationale text.",
    evidence_refs: overrides.evidence_refs ?? [],
    created_at: "2026-05-12T10:25:00.000Z",
    updated_at: "2026-05-12T10:25:00.000Z",
    ...overrides,
  };
}

function happyPathInput(): MemoBuilderInput {
  const t1 = makeResult("TIER_1_BINARY", "POL-001", "PASS", { id: "r-t1a" });
  const t1b = makeResult("TIER_1_BINARY", "POL-002", "FAIL", { id: "r-t1b" });
  const t2 = makeResult("TIER_2_PROFESSIONAL", "POL-010", "ESCALATE", { id: "r-t2" });
  const t3 = makeResult("TIER_3_STATUTORY", "POL-100", "NOT_FOUND", { id: "r-t3" });

  return {
    project: makeProject(),
    evaluation: makeEvaluation(),
    results: [t1, t1b, t2, t3],
    judgments: [
      makeJudgment(t1.id, "TIER_1_BINARY", "ADEQUATE"),
      makeJudgment(t1b.id, "TIER_1_BINARY", "INADEQUATE"),
      makeJudgment(t2.id, "TIER_2_PROFESSIONAL", "DEFICIENT"),
      makeJudgment(t3.id, "TIER_3_STATUTORY", "OBSERVATION_ONLY"),
    ],
  };
}

const HEX64 = /^[0-9a-f]{64}$/;

describe("buildMemo", () => {
  it("happy path: produces non-empty bytes + hex hashes + generator tag", async () => {
    const out = await buildMemo(happyPathInput());
    expect(out.bytes).toBeInstanceOf(Uint8Array);
    expect(out.bytes.byteLength).toBeGreaterThan(1000);
    // Open XML zip magic.
    expect(out.bytes[0]).toBe(0x50);
    expect(out.bytes[1]).toBe(0x4b);
    expect(out.contentSha256).toMatch(HEX64);
    expect(out.judgmentSnapshotHash).toMatch(HEX64);
    expect(out.generatorVersion).toBe(MEMO_GENERATOR_VERSION);
  });

  it("idempotency: judgmentSnapshotHash is stable for the same inputs", async () => {
    // judgmentSnapshotHash is the idempotency key on v2_memo_exports.
    // It is the only hash we require to be deterministic; contentSha256 is
    // a per-blob identifier and may legitimately vary (docx Packer embeds
    // zip-entry timestamps).
    const a = await buildMemo(happyPathInput());
    const b = await buildMemo(happyPathInput());
    expect(a.judgmentSnapshotHash).toBe(b.judgmentSnapshotHash);
    expect(a.contentSha256).toMatch(HEX64);
    expect(b.contentSha256).toMatch(HEX64);
  });

  it("different judgments produce a different judgmentSnapshotHash", async () => {
    const base = happyPathInput();
    const baseOut = await buildMemo(base);

    const altered: MemoBuilderInput = {
      ...base,
      judgments: base.judgments.map((j, i) =>
        i === 0 ? { ...j, verdict: "INADEQUATE" as const, updated_at: "2026-05-12T11:00:00.000Z" } : j,
      ),
    };
    const alteredOut = await buildMemo(altered);
    expect(alteredOut.judgmentSnapshotHash).not.toBe(baseOut.judgmentSnapshotHash);
  });

  it("TIER_2_PROFESSIONAL + ADEQUATE judgment throws memo_build_invariant_violation_tier_2_adequate", async () => {
    const input = happyPathInput();
    const t2Result = input.results.find((r) => r.tier === "TIER_2_PROFESSIONAL")!;
    const badInput: MemoBuilderInput = {
      ...input,
      judgments: input.judgments.map((j) =>
        j.per_policy_result_id === t2Result.id
          ? { ...j, verdict: "ADEQUATE" as JudgmentVerdict }
          : j,
      ),
    };
    await expect(buildMemo(badInput)).rejects.toThrow(MemoBuildInvariantError);
    await expect(buildMemo(badInput)).rejects.toThrow(
      "memo_build_invariant_violation_tier_2_adequate",
    );
  });

  it("TIER_3_STATUTORY + INADEQUATE judgment throws memo_build_invariant_violation_tier_3_non_observation", async () => {
    const input = happyPathInput();
    const t3Result = input.results.find((r) => r.tier === "TIER_3_STATUTORY")!;
    const badInput: MemoBuilderInput = {
      ...input,
      judgments: input.judgments.map((j) =>
        j.per_policy_result_id === t3Result.id
          ? { ...j, verdict: "INADEQUATE" as JudgmentVerdict }
          : j,
      ),
    };
    await expect(buildMemo(badInput)).rejects.toThrow(MemoBuildInvariantError);
    await expect(buildMemo(badInput)).rejects.toThrow(
      "memo_build_invariant_violation_tier_3_non_observation",
    );
  });

  it("empty per_policy + empty judgments still produces a valid docx", async () => {
    const out = await buildMemo({
      project: makeProject(),
      evaluation: makeEvaluation(),
      results: [],
      judgments: [],
    });
    expect(out.bytes.byteLength).toBeGreaterThan(500);
    expect(out.bytes[0]).toBe(0x50);
    expect(out.bytes[1]).toBe(0x4b);
    expect(out.contentSha256).toMatch(HEX64);
    expect(out.judgmentSnapshotHash).toMatch(HEX64);
  });
});

describe("computeJudgmentSnapshotHash", () => {
  it("is independent of judgment input order (sorts by id)", () => {
    const t1 = makeResult("TIER_1_BINARY", "POL-A", "PASS");
    const t1b = makeResult("TIER_1_BINARY", "POL-B", "FAIL");
    const j1 = makeJudgment(t1.id, "TIER_1_BINARY", "ADEQUATE", { id: "j-a" });
    const j2 = makeJudgment(t1b.id, "TIER_1_BINARY", "INADEQUATE", { id: "j-b" });

    const h1 = computeJudgmentSnapshotHash([j1, j2]);
    const h2 = computeJudgmentSnapshotHash([j2, j1]);
    expect(h1).toBe(h2);
  });

  it("changes when verdict changes", () => {
    const t1 = makeResult("TIER_1_BINARY", "POL-C", "PASS");
    const j = makeJudgment(t1.id, "TIER_1_BINARY", "ADEQUATE", { id: "j-c" });
    const h1 = computeJudgmentSnapshotHash([j]);
    const h2 = computeJudgmentSnapshotHash([{ ...j, verdict: "INADEQUATE" }]);
    expect(h1).not.toBe(h2);
  });
});
