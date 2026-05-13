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
    // Stage / packet metadata is now hidden behind a "Show technical details"
    // disclosure (engineering-only line). Reveal it and verify the content.
    expect(
      screen.queryByTestId("per-policy-stage-info"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("per-policy-tech-details-toggle"));
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

describe("PerPolicyResultsTable AI Determination + policy text + tech disclosure", () => {
  it("uses 'AI Determination' as column header (not 'Summary')", () => {
    render(
      <PerPolicyResultsTable results={RESULTS} judgments={NO_JUDGMENTS} />,
    );
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toContain("AI Determination");
    expect(headers).not.toContain("Summary");
  });

  it("renders policy text prominently from evidence_slices when policy_id matches", () => {
    const slices = {
      "slice_abc": {
        content_hash: "abc",
        content: "Verbatim policy text for PX-001.",
        field: "original_text",
        policy_id: "PX-001",
        source: {
          doc_id: "CSAP-NPG",
          title: "CSAP NPG",
          page: 12,
          section: "RP-APP-23a",
          chunk_id: null,
          source_path: null,
        },
      },
    };
    render(
      <PerPolicyResultsTable
        results={[RESULTS[0]!]}
        judgments={NO_JUDGMENTS}
        evidenceSlices={slices}
      />,
    );
    fireEvent.click(screen.getByTestId("per-policy-expand-toggle"));
    const policyText = screen.getByTestId("per-policy-policy-text");
    expect(policyText.textContent).toContain("Verbatim policy text for PX-001.");
  });

  it("falls back to 'not retrieved' when slices exist but no policy_id match", () => {
    const slices = {
      "slice_other": {
        content_hash: "xyz",
        content: "Some other policy text.",
        field: "original_text",
        policy_id: "PX-999",
        source: {
          doc_id: "D",
          title: "T",
          page: null,
          section: null,
          chunk_id: null,
          source_path: null,
        },
      },
    };
    render(
      <PerPolicyResultsTable
        results={[RESULTS[0]!]}
        judgments={NO_JUDGMENTS}
        evidenceSlices={slices}
      />,
    );
    fireEvent.click(screen.getByTestId("per-policy-expand-toggle"));
    expect(
      screen.getByTestId("per-policy-policy-text-missing"),
    ).toBeInTheDocument();
  });

  it("falls back to schema-v0.0.1 message when evidenceSlices is null", () => {
    render(
      <PerPolicyResultsTable
        results={[RESULTS[0]!]}
        judgments={NO_JUDGMENTS}
        evidenceSlices={null}
      />,
    );
    fireEvent.click(screen.getByTestId("per-policy-expand-toggle"));
    expect(
      screen.getByTestId("per-policy-policy-text-older-schema"),
    ).toBeInTheDocument();
  });

  it("hides Stage / Packet line by default; reveals it via disclosure toggle", () => {
    render(
      <PerPolicyResultsTable
        results={[RESULTS[0]!]}
        judgments={NO_JUDGMENTS}
      />,
    );
    fireEvent.click(screen.getByTestId("per-policy-expand-toggle"));
    expect(
      screen.queryByTestId("per-policy-stage-info"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("per-policy-tech-details-toggle"));
    expect(screen.getByTestId("per-policy-stage-info")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("per-policy-tech-details-toggle"));
    expect(
      screen.queryByTestId("per-policy-stage-info"),
    ).not.toBeInTheDocument();
  });
});

describe("PerPolicyResultsTable evidence citations regulatory invariant (Phase 2.7)", () => {
  // Owner directive 2026-05-12: evidence citations on the per-policy results
  // table render ONLY submission content. Policy KB chunks
  // (index_side === "corpus") are NEVER rendered here, regardless of how
  // matched. These tests are regression guards -- if a future commit
  // re-adds a fallback that surfaces policy-side content (e.g. the
  // Phase 2 Fix 4 policy_id fallback), they MUST fail.

  function makeEmptyPacketResult(): V2PerPolicyResult {
    return makeResult({
      id: "00000000-0000-4000-8000-000000000001",
      policy_id: "PX-001",
      evidence_packet: {}, // No items / no evidence_item_id refs.
      pathway_notes: {},
    });
  }

  function makeCorpusSidePacketResult(): V2PerPolicyResult {
    return makeResult({
      id: "00000000-0000-4000-8000-000000000001",
      policy_id: "PX-001",
      evidence_packet: {
        items: [
          {
            evidence_item_id: "slice_corpus_aaa",
            evidence_type: "POSITIVE",
            evidence_item_ref: {
              index_side: "corpus",
              source_document_provenance: {
                doc_id: "CSAP-NPG",
              },
            },
          },
        ],
      },
      pathway_notes: {},
    });
  }

  it("evidence citations NEVER render an entry whose index_side is \"corpus\"", () => {
    const slices = {
      slice_corpus_aaa: {
        content_hash: "corpus-aaa",
        content: "SECRET POLICY-SIDE TEXT THAT MUST NOT APPEAR.",
        field: "original_text",
        policy_id: "PX-001",
        source: {
          doc_id: "CSAP-NPG",
          title: "CSAP NPG",
          page: 7,
          section: "RP-APP-1",
          chunk_id: null,
          source_path: null,
        },
      },
    };
    render(
      <PerPolicyResultsTable
        results={[makeCorpusSidePacketResult()]}
        judgments={NO_JUDGMENTS}
        evidenceSlices={slices}
      />,
    );
    fireEvent.click(screen.getByTestId("per-policy-expand-toggle"));

    // Regulatory invariant: corpus-side content NEVER reaches the
    // evidence-citations renderer. (The dedicated "Policy text" section
    // above the citations is a separate concern -- that section is
    // explicitly the place policy text IS shown; this invariant is about
    // the EVIDENCE section ONLY.)
    const evidenceSection = screen.getByTestId("per-policy-verbatim-section");
    expect(evidenceSection.textContent).not.toContain(
      "SECRET POLICY-SIDE TEXT THAT MUST NOT APPEAR",
    );
    expect(
      within(evidenceSection).queryByTestId("evidence-citation-card"),
    ).not.toBeInTheDocument();
    // Empty-state message renders instead.
    expect(
      screen.getByTestId("per-policy-evidence-empty-submission"),
    ).toBeInTheDocument();
  });

  it("evidence citations show the empty-state message when packet contains only corpus-side entries", () => {
    render(
      <PerPolicyResultsTable
        results={[makeCorpusSidePacketResult()]}
        judgments={NO_JUDGMENTS}
        evidenceSlices={null}
      />,
    );
    fireEvent.click(screen.getByTestId("per-policy-expand-toggle"));
    const empty = screen.getByTestId("per-policy-evidence-empty-submission");
    expect(empty).toBeInTheDocument();
    expect(empty.textContent).toContain("No submission evidence cited.");
    expect(empty.textContent).toContain(
      "Reviewer should",
    );
    expect(empty.textContent).toContain(
      "examine the AI determination above and the structured submission",
    );
  });

  it("evidence citations show the empty-state message when packet is empty and evidence_slices contains matching slices (Phase 2 Fix 4 reversion)", () => {
    // Phase 2 Fix 4 introduced a policy_id-matched fallback in this exact
    // case. Phase 2.7 reverts that anti-pattern. If a future commit re-adds
    // the fallback, this test fails.
    const slices = {
      slice_aaa: {
        content_hash: "aaa111",
        content: "Verbatim policy text matching by policy_id only.",
        field: "original_text",
        policy_id: "PX-001",
        source: {
          doc_id: "CSAP-NPG",
          title: "CSAP NPG",
          page: 7,
          section: "RP-APP-1",
          chunk_id: null,
          source_path: null,
        },
      },
    };
    render(
      <PerPolicyResultsTable
        results={[makeEmptyPacketResult()]}
        judgments={NO_JUDGMENTS}
        evidenceSlices={slices}
      />,
    );
    fireEvent.click(screen.getByTestId("per-policy-expand-toggle"));

    // Empty-state renders.
    expect(
      screen.getByTestId("per-policy-evidence-empty-submission"),
    ).toBeInTheDocument();
    // The Fix 4 fallback testids MUST NOT appear.
    expect(
      screen.queryByTestId("per-policy-verbatim-policy-id-fallback"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("per-policy-verbatim-policy-id-badge"),
    ).not.toBeInTheDocument();
    // The slice content MUST NOT appear under the evidence label, even
    // though it IS still rendered in the dedicated "Policy text" section
    // above (that's a different section and not subject to this invariant).
    const evidenceSection = screen.getByTestId("per-policy-verbatim-section");
    expect(evidenceSection.textContent).not.toContain(
      "Verbatim policy text matching by policy_id only.",
    );
  });

  it("evidence citations show the empty-state when evidenceSlices is null (older schema)", () => {
    render(
      <PerPolicyResultsTable
        results={[makeEmptyPacketResult()]}
        judgments={NO_JUDGMENTS}
        evidenceSlices={null}
      />,
    );
    fireEvent.click(screen.getByTestId("per-policy-expand-toggle"));
    expect(
      screen.getByTestId("per-policy-evidence-empty-submission"),
    ).toBeInTheDocument();
  });

  it("evidence citations filter out a self-referenced entry (source_document_provenance.doc_id === policy_id)", () => {
    // Defense-in-depth: even when the engine forgets to set index_side
    // explicitly, a self-reference via doc_id should be filtered.
    const selfRefResult = makeResult({
      id: "00000000-0000-4000-8000-000000000001",
      policy_id: "PX-001",
      evidence_packet: {
        items: [
          {
            evidence_item_id: "slice_selfref",
            evidence_type: "POSITIVE",
            evidence_item_ref: {
              source_document_provenance: {
                doc_id: "PX-001",
              },
            },
          },
        ],
      },
      pathway_notes: {},
    });
    const slices = {
      slice_selfref: {
        content_hash: "selfref",
        content: "Self-referenced policy KB text that must not appear.",
        field: "original_text",
        policy_id: "PX-001",
        source: {
          doc_id: "PX-001",
          title: "self",
          page: null,
          section: null,
          chunk_id: null,
          source_path: null,
        },
      },
    };
    render(
      <PerPolicyResultsTable
        results={[selfRefResult]}
        judgments={NO_JUDGMENTS}
        evidenceSlices={slices}
      />,
    );
    fireEvent.click(screen.getByTestId("per-policy-expand-toggle"));
    // Scope to the evidence-citations section only -- the dedicated
    // "Policy text" section is a separate concern.
    const evidenceSection = screen.getByTestId("per-policy-verbatim-section");
    expect(evidenceSection.textContent).not.toContain(
      "Self-referenced policy KB text that must not appear",
    );
    expect(
      within(evidenceSection).queryByTestId("evidence-citation-card"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("per-policy-evidence-empty-submission"),
    ).toBeInTheDocument();
  });

  it("evidence citations DO render submission-side entries (happy path)", () => {
    // Sanity check: legitimate submission-side evidence still renders.
    const goodResult = makeResult({
      id: "00000000-0000-4000-8000-000000000001",
      policy_id: "PX-001",
      evidence_packet: {
        items: [
          {
            evidence_item_id: "slice_submission_xyz",
            evidence_type: "POSITIVE",
            evidence_item_ref: {
              index_side: "submission",
              source_document_provenance: {
                doc_id: "submission-report-1",
              },
            },
          },
        ],
      },
      pathway_notes: {},
    });
    const slices = {
      slice_submission_xyz: {
        content_hash: "xyz",
        content: "Real submission report excerpt that should render.",
        field: "original_text",
        policy_id: "PX-001",
        source: {
          doc_id: "submission-report-1",
          title: "Submission report",
          page: 5,
          section: null,
          chunk_id: null,
          source_path: null,
        },
      },
    };
    render(
      <PerPolicyResultsTable
        results={[goodResult]}
        judgments={NO_JUDGMENTS}
        evidenceSlices={slices}
      />,
    );
    fireEvent.click(screen.getByTestId("per-policy-expand-toggle"));
    const card = screen.getByTestId("evidence-citation-card");
    expect(card.textContent).toContain(
      "Real submission report excerpt that should render.",
    );
    expect(
      screen.queryByTestId("per-policy-evidence-empty-submission"),
    ).not.toBeInTheDocument();
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
