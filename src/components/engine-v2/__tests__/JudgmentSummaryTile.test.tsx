// engine_v2 Lane 2b: JudgmentSummaryTile tests.
//
// Covers:
//   - empty state (0 of 0, 0%, all verdict/tier pills present at count 0)
//   - partial progress: judged/total/unjudged counts + rounded percentage + progress-bar width
//   - judged count is deduped by unique per_policy_result_id (multiple judgment rows on the
//     same result count once, not twice)
//   - unjudged clamps to 0 (never negative) when a judgment references a result_id not present
//     in `results` (orphan judgment row -> judged > total)
//   - verdict counts reflect judgments[].verdict; an unrecognized verdict string is silently
//     ignored (not counted, no crash) via the isJudgmentVerdict guard
//   - tier counts reflect results[].tier (not judgments); null/undefined/unrecognized tier
//     values classify as "Unknown" via the classifyTier guard
//   - malformed judgment entries (null, non-string per_policy_result_id) do not throw
//
// Style: mirrors EvidenceStatusCell.test.tsx (render + screen queries, plain ASCII only).
// Pure React/component test only -- no network, no Supabase, no route integration.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import { JudgmentSummaryTile } from "../JudgmentSummaryTile";
import type { V2PerPolicyResult, V2Judgment, JudgmentTier, JudgmentVerdict } from "@/lib/engine-v2/types_lane2";

let resultCounter = 0;
function makeResult(overrides: Partial<V2PerPolicyResult> = {}): V2PerPolicyResult {
  resultCounter += 1;
  return {
    id: `result-${resultCounter}`,
    evaluation_id: "eval-1",
    policy_id: `POLICY-${resultCounter}`,
    stage: null,
    packet_id: null,
    tier: "TIER_1_BINARY",
    verdict_suggestion: null,
    ai_suggestion: null,
    confidence: null,
    confidence_method: null,
    summary: null,
    evidence_packet: [],
    pathway_notes: {},
    rubric_self_score: null,
    raw_result_json: {},
    created_at: "2026-07-08T00:00:00.000Z",
    s4_schema_version: null,
    evidence_present: null,
    evidence_signal_counts: null,
    confidence_scope: null,
    evidence_synthesis_self_score: null,
    ...overrides,
  };
}

let judgmentCounter = 0;
function makeJudgment(overrides: Partial<V2Judgment> = {}): V2Judgment {
  judgmentCounter += 1;
  return {
    id: `judgment-${judgmentCounter}`,
    per_policy_result_id: `result-${judgmentCounter}`,
    reviewer_user_id: "reviewer-1",
    tier: "TIER_1_BINARY",
    verdict: "ADEQUATE",
    rationale: null,
    evidence_refs: [],
    created_at: "2026-07-08T00:00:00.000Z",
    updated_at: "2026-07-08T00:00:00.000Z",
    ...overrides,
  };
}

function verdictPillCount(verdict: JudgmentVerdict): string {
  const pill = screen
    .getAllByTestId("judgment-summary-verdict-pill")
    .find((el) => el.getAttribute("data-verdict") === verdict);
  if (!pill) throw new Error(`verdict pill not found: ${verdict}`);
  return pill.querySelector(".font-mono")?.textContent ?? "";
}

function tierPillCount(tier: JudgmentTier | "Unknown"): string {
  const pill = screen
    .getAllByTestId("judgment-summary-tier-pill")
    .find((el) => el.getAttribute("data-tier") === tier);
  if (!pill) throw new Error(`tier pill not found: ${tier}`);
  return pill.querySelector(".font-mono")?.textContent ?? "";
}

describe("JudgmentSummaryTile - empty state", () => {
  it("renders 0 of 0, 0 unjudged, 0% progress, and all verdict/tier pills at count 0", () => {
    render(<JudgmentSummaryTile results={[]} judgments={[]} />);

    expect(screen.getByTestId("judgment-summary-tile")).toBeInTheDocument();
    expect(screen.getByTestId("judgment-summary-judged").textContent).toBe("0");
    expect(screen.getByTestId("judgment-summary-total").textContent).toBe("0");
    expect(screen.getByTestId("judgment-summary-unjudged").textContent).toContain("0 unjudged");

    const bar = screen.getByTestId("judgment-summary-progress-bar");
    expect(bar).toHaveStyle({ width: "0%" });

    for (const v of [
      "ADEQUATE",
      "INADEQUATE",
      "DEFICIENT",
      "REQUIRES_REVIEW",
      "OBSERVATION_ONLY",
    ] as const) {
      expect(verdictPillCount(v)).toBe("0");
    }
    for (const t of [
      "TIER_1_BINARY",
      "TIER_2_PROFESSIONAL",
      "TIER_3_STATUTORY",
      "Unknown",
    ] as const) {
      expect(tierPillCount(t)).toBe("0");
    }
  });
});

describe("JudgmentSummaryTile - progress counts and percentage", () => {
  it("renders judged/total/unjudged and rounds the percentage correctly", () => {
    // 3 results, 1 judged -> 33% (Math.round(1/3*100) = 33)
    const results = [makeResult(), makeResult(), makeResult()];
    const judgments = [makeJudgment({ per_policy_result_id: results[0]!.id })];

    render(<JudgmentSummaryTile results={results} judgments={judgments} />);

    expect(screen.getByTestId("judgment-summary-judged").textContent).toBe("1");
    expect(screen.getByTestId("judgment-summary-total").textContent).toBe("3");
    expect(screen.getByTestId("judgment-summary-unjudged").textContent).toContain("2 unjudged");
    expect(screen.getByTestId("judgment-summary-progress-bar")).toHaveStyle({ width: "33%" });
  });

  it("renders 100% when all results are judged", () => {
    const results = [makeResult(), makeResult()];
    const judgments = results.map((r) => makeJudgment({ per_policy_result_id: r.id }));

    render(<JudgmentSummaryTile results={results} judgments={judgments} />);

    expect(screen.getByTestId("judgment-summary-judged").textContent).toBe("2");
    expect(screen.getByTestId("judgment-summary-unjudged").textContent).toContain("0 unjudged");
    expect(screen.getByTestId("judgment-summary-progress-bar")).toHaveStyle({ width: "100%" });
  });
});

describe("JudgmentSummaryTile - judged-count dedup", () => {
  it("counts a result as judged once even with multiple judgment rows for the same result_id", () => {
    const results = [makeResult(), makeResult()];
    // Two judgment rows both referencing results[0] (e.g. history/re-judge scenario).
    const judgments = [
      makeJudgment({ per_policy_result_id: results[0]!.id, verdict: "REQUIRES_REVIEW" }),
      makeJudgment({ per_policy_result_id: results[0]!.id, verdict: "ADEQUATE" }),
    ];

    render(<JudgmentSummaryTile results={results} judgments={judgments} />);

    // judged is the count of UNIQUE result ids with >=1 judgment, not the row count.
    expect(screen.getByTestId("judgment-summary-judged").textContent).toBe("1");
    expect(screen.getByTestId("judgment-summary-unjudged").textContent).toContain("1 unjudged");
    // Verdict counts, by contrast, count every judgment ROW (not deduped by result).
    expect(verdictPillCount("REQUIRES_REVIEW")).toBe("1");
    expect(verdictPillCount("ADEQUATE")).toBe("1");
  });
});

describe("JudgmentSummaryTile - unjudged clamp (defensive)", () => {
  it("clamps unjudged to 0 (never negative) when a judgment references a result_id absent from results", () => {
    const results = [makeResult()];
    // Orphan judgment: references a result_id that does not appear in `results` at all.
    const judgments = [
      makeJudgment({ per_policy_result_id: results[0]!.id }),
      makeJudgment({ per_policy_result_id: "orphan-result-id" }),
    ];

    render(<JudgmentSummaryTile results={results} judgments={judgments} />);

    // judged counts unique judged result ids seen (2), total is results.length (1).
    expect(screen.getByTestId("judgment-summary-judged").textContent).toBe("2");
    expect(screen.getByTestId("judgment-summary-total").textContent).toBe("1");
    // unjudged = max(0, total - judged) = max(0, 1 - 2) = 0, never negative.
    expect(screen.getByTestId("judgment-summary-unjudged").textContent).toContain("0 unjudged");
  });
});

describe("JudgmentSummaryTile - verdict counts", () => {
  it("counts each verdict type independently and always renders all 5 pills", () => {
    const results = [makeResult(), makeResult(), makeResult()];
    const judgments = [
      makeJudgment({ per_policy_result_id: results[0]!.id, verdict: "ADEQUATE" }),
      makeJudgment({ per_policy_result_id: results[1]!.id, verdict: "ADEQUATE" }),
      makeJudgment({ per_policy_result_id: results[2]!.id, verdict: "INADEQUATE" }),
    ];

    render(<JudgmentSummaryTile results={results} judgments={judgments} />);

    expect(verdictPillCount("ADEQUATE")).toBe("2");
    expect(verdictPillCount("INADEQUATE")).toBe("1");
    expect(verdictPillCount("DEFICIENT")).toBe("0");
    expect(verdictPillCount("REQUIRES_REVIEW")).toBe("0");
    expect(verdictPillCount("OBSERVATION_ONLY")).toBe("0");
  });

  it("silently ignores an unrecognized verdict value without crashing or counting it", () => {
    const results = [makeResult()];
    const judgments = [
      // Cast through unknown: simulates a malformed/legacy row with a verdict value outside
      // the known JudgmentVerdict union (the component's isJudgmentVerdict guard should
      // simply skip it, not throw).
      makeJudgment({
        per_policy_result_id: results[0]!.id,
        verdict: "SOME_UNKNOWN_VERDICT" as unknown as JudgmentVerdict,
      }),
    ];

    expect(() =>
      render(<JudgmentSummaryTile results={results} judgments={judgments} />),
    ).not.toThrow();

    for (const v of [
      "ADEQUATE",
      "INADEQUATE",
      "DEFICIENT",
      "REQUIRES_REVIEW",
      "OBSERVATION_ONLY",
    ] as const) {
      expect(verdictPillCount(v)).toBe("0");
    }
    // The result IS still counted as judged (judged set is keyed by result_id presence,
    // independent of whether the verdict value itself was recognized).
    expect(screen.getByTestId("judgment-summary-judged").textContent).toBe("1");
  });
});

describe("JudgmentSummaryTile - tier mix (from results, not judgments)", () => {
  it("counts tiers from results[].tier and always renders all 4 pills including Unknown", () => {
    const results = [
      makeResult({ tier: "TIER_1_BINARY" }),
      makeResult({ tier: "TIER_1_BINARY" }),
      makeResult({ tier: "TIER_2_PROFESSIONAL" }),
      makeResult({ tier: "TIER_3_STATUTORY" }),
      makeResult({ tier: null }),
      makeResult({ tier: "some-unrecognized-tier-string" }),
    ];

    render(<JudgmentSummaryTile results={results} judgments={[]} />);

    expect(tierPillCount("TIER_1_BINARY")).toBe("2");
    expect(tierPillCount("TIER_2_PROFESSIONAL")).toBe("1");
    expect(tierPillCount("TIER_3_STATUTORY")).toBe("1");
    // null tier + an unrecognized tier string both classify as "Unknown".
    expect(tierPillCount("Unknown")).toBe("2");
  });
});

describe("JudgmentSummaryTile - malformed judgment rows (defensive)", () => {
  it("does not throw on null entries or non-string per_policy_result_id in the judgments array", () => {
    const results = [makeResult()];
    const judgments = [
      null as unknown as V2Judgment,
      makeJudgment({ per_policy_result_id: undefined as unknown as string }),
      makeJudgment({ per_policy_result_id: results[0]!.id }),
    ];

    expect(() =>
      render(<JudgmentSummaryTile results={results} judgments={judgments} />),
    ).not.toThrow();

    // Only the one well-formed judgment (matching results[0]) should count.
    expect(screen.getByTestId("judgment-summary-judged").textContent).toBe("1");
  });
});
