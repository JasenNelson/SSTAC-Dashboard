// engine_v2 frontend Lane 2b: PerPolicyResultsTable tests.
//
// Covers Modules L2b-3 (evidence/pathway rendering), L2b-5 (filter/sort UX),
// and the UI portion of L2b-2 (inline tier-aware HITL judgment editor).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import React from "react";

import { PerPolicyResultsTable } from "../PerPolicyResultsTable";
import type {
  V2PerPolicyResult,
  V2Judgment,
} from "@/lib/engine-v2/types_lane2";

function makeResult(overrides: Partial<V2PerPolicyResult>): V2PerPolicyResult {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    evaluation_id: "00000000-0000-4000-8000-000000000abc",
    policy_id: "PX-001",
    stage: "S2",
    packet_id: "pkt-1",
    tier: "TIER_1_BINARY",
    verdict_suggestion: "PASS",
    ai_suggestion: "PASS",
    confidence: 0.9,
    confidence_method: "calibrated",
    summary: "Summary for PX-001",
    evidence_packet: {
      chunks: [
        { text: "Excerpt A", source_ref: { page: 1 } },
      ],
      minority_findings: ["Possibly applies under condition X."],
      evidence_gaps: ["Missing pH data."],
    },
    pathway_notes: { pathway_a: "wired" },
    rubric_self_score: null,
    raw_result_json: {},
    created_at: "2026-05-12T10:00:00Z",
    ...overrides,
  };
}

const RESULTS: V2PerPolicyResult[] = [
  makeResult({
    id: "00000000-0000-4000-8000-000000000001",
    policy_id: "PX-001",
    tier: "TIER_1_BINARY",
    verdict_suggestion: "PASS",
    confidence: 0.9,
  }),
  makeResult({
    id: "00000000-0000-4000-8000-000000000002",
    policy_id: "PX-002",
    tier: "TIER_2_PROFESSIONAL",
    verdict_suggestion: "ESCALATE",
    confidence: 0.5,
    evidence_packet: {},
    pathway_notes: {},
  }),
  makeResult({
    id: "00000000-0000-4000-8000-000000000003",
    policy_id: "PX-003",
    tier: "TIER_3_STATUTORY",
    verdict_suggestion: "ESCALATE",
    confidence: 0.2,
    evidence_packet: {},
    pathway_notes: {},
  }),
];

const NO_JUDGMENTS: V2Judgment[] = [];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("PerPolicyResultsTable rendering", () => {
  it("renders one row per result with toolbar visible", () => {
    render(
      <PerPolicyResultsTable results={RESULTS} judgments={NO_JUDGMENTS} />,
    );
    expect(screen.getByTestId("per-policy-results-toolbar")).toBeInTheDocument();
    const rows = screen.getAllByTestId("per-policy-row");
    expect(rows).toHaveLength(3);
    expect(screen.getByTestId("filter-tier")).toBeInTheDocument();
    expect(screen.getByTestId("filter-verdict")).toBeInTheDocument();
    expect(screen.getByTestId("filter-min-confidence")).toBeInTheDocument();
    expect(screen.getByTestId("sort-by")).toBeInTheDocument();
    expect(screen.getByTestId("results-count").textContent).toContain(
      "Showing 3 of 3",
    );
  });
});

describe("PerPolicyResultsTable filtering", () => {
  it("narrows displayed rows when tier filter is applied", () => {
    render(
      <PerPolicyResultsTable results={RESULTS} judgments={NO_JUDGMENTS} />,
    );
    fireEvent.change(screen.getByTestId("filter-tier"), {
      target: { value: "TIER_2_PROFESSIONAL" },
    });
    const rows = screen.getAllByTestId("per-policy-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.getAttribute("data-policy-id")).toBe("PX-002");
    expect(screen.getByTestId("results-count").textContent).toContain(
      "Showing 1 of 3",
    );
  });

  it("hides rows below the confidence threshold", () => {
    render(
      <PerPolicyResultsTable results={RESULTS} judgments={NO_JUDGMENTS} />,
    );
    fireEvent.change(screen.getByTestId("filter-min-confidence"), {
      target: { value: "0.6" },
    });
    const rows = screen.getAllByTestId("per-policy-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.getAttribute("data-policy-id")).toBe("PX-001");
  });
});

describe("PerPolicyResultsTable sorting", () => {
  it("sorts by confidence desc when selected", () => {
    render(
      <PerPolicyResultsTable results={RESULTS} judgments={NO_JUDGMENTS} />,
    );
    fireEvent.change(screen.getByTestId("sort-by"), {
      target: { value: "confidence" },
    });
    fireEvent.click(screen.getByTestId("sort-dir-toggle"));
    const rows = screen.getAllByTestId("per-policy-row");
    const order = rows.map((r) => r.getAttribute("data-policy-id"));
    expect(order).toEqual(["PX-001", "PX-002", "PX-003"]);
  });
});

describe("PerPolicyResultsTable expand panel", () => {
  it("shows evidence + pathway rendering when expanded", () => {
    render(
      <PerPolicyResultsTable results={RESULTS} judgments={NO_JUDGMENTS} />,
    );
    const rows = screen.getAllByTestId("per-policy-row");
    const px1Row = rows.find(
      (r) => r.getAttribute("data-policy-id") === "PX-001",
    );
    expect(px1Row).toBeTruthy();
    const toggle = within(px1Row as HTMLElement).getByTestId(
      "per-policy-expand-toggle",
    );
    fireEvent.click(toggle);

    expect(screen.getByTestId("per-policy-detail-row")).toBeInTheDocument();
    expect(screen.getByTestId("per-policy-evidence-packet")).toBeInTheDocument();
    expect(screen.getByTestId("per-policy-pathway-notes")).toBeInTheDocument();
    expect(
      screen.getByTestId("per-policy-minority-findings"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("per-policy-evidence-gaps"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("per-policy-stage-info").textContent).toContain(
      "stage=S2",
    );
  });
});

describe("PerPolicyResultsTable tier-aware verdict dropdown", () => {
  function expandRow(policyId: string): void {
    const rows = screen.getAllByTestId("per-policy-row");
    const target = rows.find(
      (r) => r.getAttribute("data-policy-id") === policyId,
    );
    expect(target).toBeTruthy();
    const toggle = within(target as HTMLElement).getByTestId(
      "per-policy-expand-toggle",
    );
    fireEvent.click(toggle);
  }

  it("TIER_1 row shows all 4 verdicts", () => {
    render(
      <PerPolicyResultsTable
        results={[RESULTS[0]!]}
        judgments={NO_JUDGMENTS}
      />,
    );
    expandRow("PX-001");
    const select = screen.getByTestId(
      "per-policy-judgment-verdict",
    ) as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual([
      "ADEQUATE",
      "INADEQUATE",
      "DEFICIENT",
      "REQUIRES_REVIEW",
    ]);
  });

  it("TIER_2 row shows only DEFICIENT + REQUIRES_REVIEW (no ADEQUATE)", () => {
    render(
      <PerPolicyResultsTable
        results={[RESULTS[1]!]}
        judgments={NO_JUDGMENTS}
      />,
    );
    expandRow("PX-002");
    const select = screen.getByTestId(
      "per-policy-judgment-verdict",
    ) as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(["DEFICIENT", "REQUIRES_REVIEW"]);
    expect(optionValues).not.toContain("ADEQUATE");
    expect(screen.getByTestId("per-policy-tier-help").textContent).toContain(
      "cannot return ADEQUATE",
    );
  });

  it("TIER_3 row shows only OBSERVATION_ONLY", () => {
    render(
      <PerPolicyResultsTable
        results={[RESULTS[2]!]}
        judgments={NO_JUDGMENTS}
      />,
    );
    expandRow("PX-003");
    const select = screen.getByTestId(
      "per-policy-judgment-verdict",
    ) as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(["OBSERVATION_ONLY"]);
    expect(screen.getByTestId("per-policy-tier-help").textContent).toContain(
      "SDM/Crown",
    );
  });
});

describe("PerPolicyResultsTable save judgment", () => {
  it("POSTs correct body and updates UI on 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "j-1",
          per_policy_result_id: RESULTS[0]!.id,
          reviewer_user_id: "user-1",
          tier: "TIER_1_BINARY",
          verdict: "ADEQUATE",
          rationale: "looks good",
          evidence_refs: [],
          created_at: "2026-05-12T11:00:00Z",
          updated_at: "2026-05-12T11:00:00Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PerPolicyResultsTable
        results={[RESULTS[0]!]}
        judgments={NO_JUDGMENTS}
      />,
    );
    fireEvent.click(screen.getByTestId("per-policy-expand-toggle"));
    fireEvent.change(screen.getByTestId("per-policy-judgment-verdict"), {
      target: { value: "ADEQUATE" },
    });
    fireEvent.change(screen.getByTestId("per-policy-judgment-rationale"), {
      target: { value: "looks good" },
    });
    fireEvent.click(screen.getByTestId("per-policy-judgment-save"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const callArgs = fetchMock.mock.calls[0]!;
    const url = callArgs[0] as string;
    const init = callArgs[1] as RequestInit;
    expect(url).toBe(
      `/api/engine-v2/per-policy/${encodeURIComponent(RESULTS[0]!.id)}/judgment`,
    );
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body as string) as {
      per_policy_result_id: string;
      verdict: string;
      rationale: string | null;
    };
    expect(body.per_policy_result_id).toBe(RESULTS[0]!.id);
    expect(body.verdict).toBe("ADEQUATE");
    expect(body.rationale).toBe("looks good");

    // Judgment cell now shows the new verdict.
    await waitFor(() => {
      const badges = screen.getAllByTestId("per-policy-verdict-badge");
      const verdicts = badges.map((b) => b.getAttribute("data-verdict"));
      expect(verdicts).toContain("ADEQUATE");
    });
  });

  it("surfaces verdict_not_allowed_for_tier with allowed list on 422", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "verdict_not_allowed_for_tier",
          tier: "TIER_2_PROFESSIONAL",
          verdict: "ADEQUATE",
          allowed: ["DEFICIENT", "REQUIRES_REVIEW"],
        }),
        { status: 422, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Build a synthetic TIER_2 row but seed draft with ADEQUATE by spoofing tier
    // via an additional row that pretends to be TIER_1 in the component view
    // but the server still rejects. Easiest approach: render TIER_2 row but
    // verify the server error path is plumbed by directly clicking save with
    // whatever the default verdict is, since the API mock returns 422 anyway.
    render(
      <PerPolicyResultsTable
        results={[RESULTS[1]!]}
        judgments={NO_JUDGMENTS}
      />,
    );
    fireEvent.click(screen.getByTestId("per-policy-expand-toggle"));
    fireEvent.click(screen.getByTestId("per-policy-judgment-save"));

    await waitFor(() => {
      expect(
        screen.getByTestId("per-policy-judgment-error"),
      ).toBeInTheDocument();
    });
    const errText = screen.getByTestId("per-policy-judgment-error").textContent ?? "";
    expect(errText).toContain("verdict_not_allowed_for_tier");
    expect(errText).toContain("DEFICIENT");
    expect(errText).toContain("REQUIRES_REVIEW");
  });
});
