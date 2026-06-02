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
    // S4 expand-contract fields: null for legacy 0.0.1 rows.
    s4_schema_version: null,
    evidence_present: null,
    evidence_signal_counts: null,
    confidence_scope: null,
    evidence_synthesis_self_score: null,
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
  it("uses 'AI Determination' column header for legacy 0.0.1 runs (not 'Summary')", () => {
    render(
      <PerPolicyResultsTable results={RESULTS} judgments={NO_JUDGMENTS} />,
    );
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toContain("AI Determination");
    expect(headers).not.toContain("Summary");
  });

  it("uses 'AI Evidence Synthesis' column header for 0.1.0 evidence-status runs (AI-scope, owner 2026-06-02)", () => {
    // AI-scope correction: the AI surfaces evidence, it does not make
    // determinations. Schema-aware header -- 0.1.0 rows show the neutral label;
    // legacy 0.0.1 keep "AI Determination" (covered by the test above).
    render(
      <PerPolicyResultsTable
        results={[makeS4Result({ policy_id: "PX-S4-1" })]}
        judgments={NO_JUDGMENTS}
      />,
    );
    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toContain("AI Evidence Synthesis");
    expect(headers).not.toContain("AI Determination");
  });

  it("0.1.0 expanded row carries no determination wording; uses AI Evidence Synthesis (Surface-3 P3)", () => {
    render(
      <PerPolicyResultsTable
        results={[makeS4Result({ policy_id: "PX-S4-2" })]}
        judgments={NO_JUDGMENTS}
      />,
    );
    fireEvent.click(screen.getByTestId("per-policy-expand-toggle"));
    // No determination-shaped wording anywhere for a 0.1.0 table (header + expanded).
    expect(screen.queryByText("AI Determination")).not.toBeInTheDocument();
    expect(screen.queryByText(/no determination/i)).not.toBeInTheDocument();
    // The synthesis label appears in both the column header and the expanded detail.
    expect(
      screen.getAllByText("AI Evidence Synthesis").length,
    ).toBeGreaterThanOrEqual(2);
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

describe("PerPolicyResultsTable policyTexts prop (Lane 2c regression fix)", () => {
  it("displays policyTexts[policy_id] in the Policy Text panel when provided", () => {
    // Primary path: policyTexts map wins, even when evidenceSlices is present.
    const slices = {
      "slice_sub_1": {
        content_hash: "sub1",
        content: "PSI SUBMISSION EXCERPT -- must NOT appear in Policy Text panel.",
        field: "submission_text",
        policy_id: "PX-001",
        source: {
          doc_id: "submission-report-1",
          title: "PSI report",
          page: 4,
          section: null,
          chunk_id: null,
          source_path: null,
        },
      },
    };
    const policyTexts = {
      "PX-001": "Does the investigator identify the primary authors of the plan and state qualifications?",
    };
    render(
      <PerPolicyResultsTable
        results={[RESULTS[0]!]}
        judgments={NO_JUDGMENTS}
        evidenceSlices={slices}
        policyTexts={policyTexts}
      />,
    );
    fireEvent.click(screen.getByTestId("per-policy-expand-toggle"));
    const policyTextEl = screen.getByTestId("per-policy-policy-text");
    expect(policyTextEl.textContent).toContain(
      "Does the investigator identify the primary authors",
    );
    // Submission excerpt must NOT appear in the Policy Text panel.
    expect(policyTextEl.textContent).not.toContain("PSI SUBMISSION EXCERPT");
  });

  it("NEVER returns slice.content when slice.field is submission_text (regression guard for AUTH-1 PSI bug)", () => {
    // Regression guard: post-engine-fix, evidence_slices contain submission
    // excerpts (field=submission_text). findPolicyText must NOT return those
    // in the Policy Text panel, even when policyTexts prop is absent.
    const slices = {
      "slice_sub_2": {
        content_hash: "sub2",
        content: "Hydrocarbon impacted soil should be removed -- submission excerpt.",
        field: "submission_text",
        policy_id: "PX-001",
        source: {
          doc_id: "submission-report-2",
          title: "PSI report 2",
          page: 7,
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
        // policyTexts intentionally absent to test the slice guard path.
      />,
    );
    fireEvent.click(screen.getByTestId("per-policy-expand-toggle"));
    // Must NOT render the submission excerpt as policy text.
    expect(
      screen.queryByTestId("per-policy-policy-text"),
    ).not.toBeInTheDocument();
    // Must show "not retrieved" fallback instead.
    expect(
      screen.getByTestId("per-policy-policy-text-missing"),
    ).toBeInTheDocument();
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

// Round 2 fix coverage (Phase E IMPORTANT 1): collapsed-row highlight.
// The original Phase E implementation looked for [data-evidence-item-id]
// nodes via DOM querySelector, which only exist when the row is expanded.
// The fix derives matching rows from the data model so the row wrapper
// receives data-eval-pulse regardless of expansion state.
describe("PerPolicyResultsTable highlight (collapsed rows)", () => {
  const HIGHLIGHT_ID = "slice_submission_collapsed_1";

  function makeHighlightableResult(
    id: string,
    policyId: string,
  ): V2PerPolicyResult {
    return makeResult({
      id,
      policy_id: policyId,
      evidence_packet: {
        items: [
          {
            evidence_item_id: HIGHLIGHT_ID,
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
  }

  it("marks matching ROW with data-eval-pulse even when collapsed", () => {
    const matching = makeHighlightableResult(
      "00000000-0000-4000-8000-000000000010",
      "PX-010",
    );
    const nonMatching = makeResult({
      id: "00000000-0000-4000-8000-000000000011",
      policy_id: "PX-011",
      evidence_packet: {},
      pathway_notes: {},
    });

    render(
      <PerPolicyResultsTable
        results={[matching, nonMatching]}
        judgments={NO_JUDGMENTS}
        highlightEvidenceItemId={HIGHLIGHT_ID}
      />,
    );

    const rows = screen.getAllByTestId("per-policy-row");
    expect(rows).toHaveLength(2);
    const matchedRow = rows.find(
      (r) => r.getAttribute("data-policy-id") === "PX-010",
    );
    const unmatchedRow = rows.find(
      (r) => r.getAttribute("data-policy-id") === "PX-011",
    );
    expect(matchedRow?.getAttribute("data-eval-pulse")).toBe("true");
    // Non-matching rows must NOT receive the pulse marker.
    expect(unmatchedRow?.getAttribute("data-eval-pulse")).toBeNull();
  });

  it("marks ALL matching rows when multiple rows cite the same chunk", () => {
    const r1 = makeHighlightableResult(
      "00000000-0000-4000-8000-000000000020",
      "PX-020",
    );
    const r2 = makeHighlightableResult(
      "00000000-0000-4000-8000-000000000021",
      "PX-021",
    );

    render(
      <PerPolicyResultsTable
        results={[r1, r2]}
        judgments={NO_JUDGMENTS}
        highlightEvidenceItemId={HIGHLIGHT_ID}
      />,
    );

    const rows = screen.getAllByTestId("per-policy-row");
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.getAttribute("data-eval-pulse")).toBe("true");
    }
  });
});

// ---- S4 read-side tests: mixed 0.1.0 and 0.0.1 rows ----
//
// Spec: PerPolicyResultsTable spec Task 2a / 2b / 2d (render swap, sort).
// Plain ASCII only.

function makeS4Result(overrides: Partial<V2PerPolicyResult>): V2PerPolicyResult {
  // 0.1.0 packet: no verdict_suggestion / ai_suggestion; has evidence fields.
  return {
    id: "s4-00000000-0000-4000-8000-000000000001",
    evaluation_id: "00000000-0000-4000-8000-000000000abc",
    policy_id: "S4-001",
    stage: "S4",
    packet_id: "pkt-s4-1",
    tier: "TIER_1_BINARY",
    verdict_suggestion: null,
    ai_suggestion: null,
    confidence: 0.88,
    confidence_method: "evidence_match",
    summary: "Evidence match summary.",
    evidence_packet: {},
    pathway_notes: {},
    rubric_self_score: null,
    s4_schema_version: "0.1.0",
    evidence_present: true,
    evidence_signal_counts: {
      total_cited: 5,
      supporting: 3,
      negating: 1,
      absence_or_category_mismatch: 0,
      neutral: 1,
    },
    confidence_scope: "EVIDENCE_MATCH_NOT_ADEQUACY",
    evidence_synthesis_self_score: null,
    raw_result_json: {
      schema_version: "0.1.0",
      indigenous_content_signal: {
        matched: false,
        trigger_keywords_matched: [],
        detector_version: "v1",
      },
    },
    created_at: "2026-06-02T10:00:00Z",
    ...overrides,
  };
}

describe("PerPolicyResultsTable S4 mixed-row rendering", () => {
  it("0.1.0 row renders EvidenceStatusCell (data-testid=evidence-status-cell); 0.0.1 row renders VerdictBadge", () => {
    const legacy = makeResult({
      id: "legacy-00000000-0000-4000-8000-000000000001",
      policy_id: "LG-001",
      tier: "TIER_1_BINARY",
      verdict_suggestion: "PASS",
      confidence: 0.9,
    });
    const s4 = makeS4Result({
      id: "s4-00000000-0000-4000-8000-000000000002",
      policy_id: "S4-002",
    });

    render(
      <PerPolicyResultsTable results={[legacy, s4]} judgments={NO_JUDGMENTS} />,
    );

    // 0.1.0 row must render evidence-status-cell, not verdict-badge.
    expect(screen.getByTestId("evidence-status-cell")).toBeInTheDocument();

    // 0.0.1 row must render verdict-badge.
    // The judgment-cell also contains verdict badges; find via query for
    // per-policy-verdict-badge in a non-judgment context -- easiest: check
    // the badge has data-verdict=PASS.
    const verdictBadges = screen.getAllByTestId("per-policy-verdict-badge");
    const verdicts = verdictBadges.map((b) => b.getAttribute("data-verdict"));
    expect(verdicts).toContain("PASS");
  });

  it("tier badge renders for BOTH 0.1.0 and 0.0.1 rows (tier is unchanged)", () => {
    const legacy = makeResult({
      id: "legacy-00000000-0000-4000-8000-000000000001",
      policy_id: "LG-001",
      tier: "TIER_2_PROFESSIONAL",
      verdict_suggestion: "ESCALATE",
      confidence: 0.5,
    });
    const s4 = makeS4Result({
      id: "s4-00000000-0000-4000-8000-000000000002",
      policy_id: "S4-002",
      tier: "TIER_1_BINARY",
    });

    render(
      <PerPolicyResultsTable results={[legacy, s4]} judgments={NO_JUDGMENTS} />,
    );

    const tierBadges = screen.getAllByTestId("per-policy-tier-badge");
    expect(tierBadges).toHaveLength(2);
    const tiers = tierBadges.map((b) => b.getAttribute("data-tier"));
    expect(tiers).toContain("TIER_2_PROFESSIONAL");
    expect(tiers).toContain("TIER_1_BINARY");
  });

  it("column header renamed from 'AI Verdict' to 'AI Evidence Signal'", () => {
    render(
      <PerPolicyResultsTable results={RESULTS} judgments={NO_JUDGMENTS} />,
    );
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent ?? "");
    expect(headers.some((h) => h.includes("AI Evidence Signal"))).toBe(true);
    expect(headers.some((h) => h.trim() === "AI Verdict")).toBe(false);
  });
});

describe("PerPolicyResultsTable S4 mixed-list sort", () => {
  it("sorts mixed 0.1.0 and 0.0.1 rows deterministically by verdict key without throwing", () => {
    const legacy = makeResult({
      id: "legacy-00000000-0000-4000-8000-000000000001",
      policy_id: "LG-001",
      tier: "TIER_1_BINARY",
      verdict_suggestion: "PASS",
      confidence: 0.9,
    });
    const s4present = makeS4Result({
      id: "s4-00000000-0000-4000-8000-000000000002",
      policy_id: "S4-002",
      evidence_present: true,
      evidence_signal_counts: { total_cited: 5, supporting: 3, negating: 1 },
    });
    const s4absent = makeS4Result({
      id: "s4-00000000-0000-4000-8000-000000000003",
      policy_id: "S4-003",
      evidence_present: false,
      evidence_signal_counts: { total_cited: 0 },
    });

    // Should not throw.
    render(
      <PerPolicyResultsTable
        results={[legacy, s4absent, s4present]}
        judgments={NO_JUDGMENTS}
      />,
    );

    // Switch to verdict sort asc.
    fireEvent.change(screen.getByTestId("sort-by"), {
      target: { value: "verdict" },
    });

    const rows = screen.getAllByTestId("per-policy-row");
    // We expect 3 rows total -- the render completed without throwing.
    expect(rows).toHaveLength(3);

    // In asc order: present first (band 0), absent next (band 1), legacy last (band 2).
    const order = rows.map((r) => r.getAttribute("data-policy-id"));
    expect(order[0]).toBe("S4-002"); // present=true, supporting=3 -> band 0
    expect(order[1]).toBe("S4-003"); // present=false -> band 1
    expect(order[2]).toBe("LG-001"); // legacy -> band 2
  });

  it("reverses the mixed sort order when direction is desc", () => {
    const legacy = makeResult({
      id: "legacy-00000000-0000-4000-8000-000000000001",
      policy_id: "LG-001",
      tier: "TIER_1_BINARY",
      verdict_suggestion: "PASS",
      confidence: 0.9,
    });
    const s4 = makeS4Result({
      id: "s4-00000000-0000-4000-8000-000000000002",
      policy_id: "S4-002",
      evidence_present: true,
    });

    render(
      <PerPolicyResultsTable
        results={[legacy, s4]}
        judgments={NO_JUDGMENTS}
      />,
    );

    fireEvent.change(screen.getByTestId("sort-by"), {
      target: { value: "verdict" },
    });
    // Toggle to desc.
    fireEvent.click(screen.getByTestId("sort-dir-toggle"));

    const rows = screen.getAllByTestId("per-policy-row");
    const order = rows.map((r) => r.getAttribute("data-policy-id"));
    // desc: legacy (band 2) first, then s4 (band 0).
    expect(order[0]).toBe("LG-001");
    expect(order[1]).toBe("S4-002");
  });
});

describe("PerPolicyResultsTable S4 technical details block (L1505)", () => {
  it("0.1.0 row shows evidence_present + confidence_scope in tech details (not blank ai_suggestion)", () => {
    const s4 = makeS4Result({
      id: "s4-00000000-0000-4000-8000-000000000002",
      policy_id: "S4-002",
      evidence_present: true,
      confidence_scope: "EVIDENCE_MATCH_NOT_ADEQUACY",
    });

    render(
      <PerPolicyResultsTable results={[s4]} judgments={NO_JUDGMENTS} />,
    );

    // Expand the row.
    fireEvent.click(screen.getByTestId("per-policy-expand-toggle"));
    // Show tech details.
    fireEvent.click(screen.getByTestId("per-policy-tech-details-toggle"));

    const stageInfo = screen.getByTestId("per-policy-stage-info");
    expect(stageInfo.textContent).toContain("evidence_present=true");
    expect(stageInfo.textContent).toContain("confidence_scope=EVIDENCE_MATCH_NOT_ADEQUACY");
    // Must not show stale ai_suggestion=null or blank.
    expect(stageInfo.textContent).not.toContain("ai_suggestion");
  });

  it("legacy 0.0.1 row shows ai_suggestion in tech details", () => {
    const legacy = makeResult({
      id: "legacy-00000000-0000-4000-8000-000000000001",
      policy_id: "LG-001",
      ai_suggestion: "PASS",
      verdict_suggestion: "PASS",
      confidence: 0.9,
    });

    render(
      <PerPolicyResultsTable results={[legacy]} judgments={NO_JUDGMENTS} />,
    );

    fireEvent.click(screen.getByTestId("per-policy-expand-toggle"));
    fireEvent.click(screen.getByTestId("per-policy-tech-details-toggle"));

    const stageInfo = screen.getByTestId("per-policy-stage-info");
    expect(stageInfo.textContent).toContain("ai_suggestion=PASS");
    expect(stageInfo.textContent).not.toContain("evidence_present");
  });
});

describe("PerPolicyResultsTable S4 mixed-list filter", () => {
  const present010 = makeResult({
    id: "present-00000000-0000-4000-8000-000000000001",
    policy_id: "EV-PRESENT",
    s4_schema_version: "0.1.0",
    evidence_present: true,
    verdict_suggestion: null,
    ai_suggestion: null,
    raw_result_json: { schema_version: "0.1.0" },
  });
  const absent010 = makeResult({
    id: "absent-00000000-0000-4000-8000-000000000002",
    policy_id: "EV-ABSENT",
    s4_schema_version: "0.1.0",
    evidence_present: false,
    verdict_suggestion: null,
    ai_suggestion: null,
    raw_result_json: { schema_version: "0.1.0" },
  });
  const legacyPass = makeResult({
    id: "legacy-00000000-0000-4000-8000-000000000003",
    policy_id: "LG-PASS",
    verdict_suggestion: "PASS",
    ai_suggestion: "PASS",
  });
  const MIXED: V2PerPolicyResult[] = [present010, absent010, legacyPass];

  it("EVIDENCE_PRESENT shows only the 0.1.0 present row (hides absent 0.1.0 + legacy)", () => {
    render(<PerPolicyResultsTable results={MIXED} judgments={NO_JUDGMENTS} />);
    fireEvent.change(screen.getByTestId("filter-verdict"), {
      target: { value: "EVIDENCE_PRESENT" },
    });
    const rows = screen.getAllByTestId("per-policy-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.getAttribute("data-policy-id")).toBe("EV-PRESENT");
  });

  it("EVIDENCE_ABSENT shows only the 0.1.0 absent row", () => {
    render(<PerPolicyResultsTable results={MIXED} judgments={NO_JUDGMENTS} />);
    fireEvent.change(screen.getByTestId("filter-verdict"), {
      target: { value: "EVIDENCE_ABSENT" },
    });
    const rows = screen.getAllByTestId("per-policy-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.getAttribute("data-policy-id")).toBe("EV-ABSENT");
  });

  it("a legacy verdict value (PASS) shows only the legacy row (hides 0.1.0 rows)", () => {
    render(<PerPolicyResultsTable results={MIXED} judgments={NO_JUDGMENTS} />);
    fireEvent.change(screen.getByTestId("filter-verdict"), {
      target: { value: "PASS" },
    });
    const rows = screen.getAllByTestId("per-policy-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.getAttribute("data-policy-id")).toBe("LG-PASS");
  });
});

describe("PerPolicyResultsTable S4 confidence column (codex P2: no unscoped/duplicate confidence)", () => {
  it("0.1.0 row: standalone Confidence column defers ('-'); match confidence is in the evidence cell only", () => {
    const row010 = makeResult({
      id: "conf010-00000000-0000-4000-8000-000000000001",
      policy_id: "EV-CONF",
      s4_schema_version: "0.1.0",
      evidence_present: true,
      confidence: 0.88,
      confidence_scope: "EVIDENCE_MATCH_NOT_ADEQUACY",
      verdict_suggestion: null,
      ai_suggestion: null,
      raw_result_json: { schema_version: "0.1.0" },
    });
    render(<PerPolicyResultsTable results={[row010]} judgments={NO_JUDGMENTS} />);
    // Standalone Confidence column defers to the scope-guarded evidence cell.
    expect(screen.getByTestId("per-policy-confidence-cell").textContent?.trim()).toBe("-");
    // The scoped match confidence is shown exactly once, in the evidence cell.
    expect(
      screen.getByTestId("evidence-match-confidence").textContent,
    ).toContain("0.88");
  });

  it("0.1.0 row with MISSING confidence_scope: neither column nor cell leaks the number", () => {
    const unscoped = makeResult({
      id: "confunscoped-00000000-0000-4000-8000-000000000003",
      policy_id: "EV-UNSCOPED",
      s4_schema_version: "0.1.0",
      evidence_present: true,
      confidence: 0.77,
      confidence_scope: null,
      verdict_suggestion: null,
      ai_suggestion: null,
      raw_result_json: { schema_version: "0.1.0" },
    });
    render(<PerPolicyResultsTable results={[unscoped]} judgments={NO_JUDGMENTS} />);
    expect(screen.getByTestId("per-policy-confidence-cell").textContent?.trim()).toBe("-");
    expect(screen.queryByTestId("evidence-match-confidence")).toBeNull();
    // The raw 0.77 must not leak anywhere when scope is missing.
    const row = screen.getByTestId("per-policy-row");
    expect(row.textContent ?? "").not.toContain("0.77");
  });

  it("legacy 0.0.1 row: standalone Confidence column shows the number (unchanged)", () => {
    const legacy = makeResult({
      id: "conflegacy-00000000-0000-4000-8000-000000000002",
      policy_id: "LG-CONF",
      confidence: 0.9,
      verdict_suggestion: "PASS",
      ai_suggestion: "PASS",
    });
    render(<PerPolicyResultsTable results={[legacy]} judgments={NO_JUDGMENTS} />);
    const confCell = screen.getByTestId("per-policy-confidence-cell");
    expect(confCell.textContent?.trim()).not.toBe("-");
    expect(confCell.textContent ?? "").toMatch(/\d/);
  });

  it("unscoped 0.1.0 confidence does NOT drive the Min-Confidence filter (codex P2 round 2)", () => {
    // Unscoped 0.1.0 row has a real 0.77 but it is surfaced nowhere; it must NOT be
    // filtered-IN by that hidden value. A scoped 0.1.0 row at 0.77 IS filtered by it.
    const scoped = makeResult({
      id: "ctlscoped-00000000-0000-4000-8000-000000000001",
      policy_id: "SCOPED-77",
      s4_schema_version: "0.1.0",
      evidence_present: true,
      confidence: 0.77,
      confidence_scope: "EVIDENCE_MATCH_NOT_ADEQUACY",
      verdict_suggestion: null,
      ai_suggestion: null,
      raw_result_json: { schema_version: "0.1.0" },
    });
    const unscoped = makeResult({
      id: "ctlunscoped-00000000-0000-4000-8000-000000000002",
      policy_id: "UNSCOPED-77",
      s4_schema_version: "0.1.0",
      evidence_present: true,
      confidence: 0.77,
      confidence_scope: null,
      verdict_suggestion: null,
      ai_suggestion: null,
      raw_result_json: { schema_version: "0.1.0" },
    });
    render(
      <PerPolicyResultsTable results={[scoped, unscoped]} judgments={NO_JUDGMENTS} />,
    );
    fireEvent.change(screen.getByTestId("filter-min-confidence"), {
      target: { value: "0.5" },
    });
    const rows = screen.getAllByTestId("per-policy-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.getAttribute("data-policy-id")).toBe("SCOPED-77");
  });

  it("Confidence sort: no-surfaceable-confidence rows sort LAST in both directions (codex P2 r3)", () => {
    const scopedHigh = makeResult({
      id: "sorthi-00000000-0000-4000-8000-000000000001",
      policy_id: "S-HI",
      s4_schema_version: "0.1.0",
      evidence_present: true,
      confidence: 0.9,
      confidence_scope: "EVIDENCE_MATCH_NOT_ADEQUACY",
      verdict_suggestion: null,
      ai_suggestion: null,
      raw_result_json: { schema_version: "0.1.0" },
    });
    const legacyMid = makeResult({
      id: "sortmid-00000000-0000-4000-8000-000000000002",
      policy_id: "L-MID",
      confidence: 0.5,
      verdict_suggestion: "PASS",
      ai_suggestion: "PASS",
    });
    const unscopedHidden = makeResult({
      id: "sorthidden-00000000-0000-4000-8000-000000000003",
      policy_id: "U-HIDDEN",
      s4_schema_version: "0.1.0",
      evidence_present: true,
      confidence: 0.77, // real but unscoped -> not surfaceable -> sorts as null
      confidence_scope: null,
      verdict_suggestion: null,
      ai_suggestion: null,
      raw_result_json: { schema_version: "0.1.0" },
    });
    const nullLegacy = makeResult({
      id: "sortnull-00000000-0000-4000-8000-000000000004",
      policy_id: "N-NULL",
      confidence: null,
      verdict_suggestion: "PASS",
      ai_suggestion: "PASS",
    });
    render(
      <PerPolicyResultsTable
        results={[unscopedHidden, nullLegacy, scopedHigh, legacyMid]}
        judgments={NO_JUDGMENTS}
      />,
    );
    fireEvent.change(screen.getByTestId("sort-by"), {
      target: { value: "confidence" },
    });

    const ids = () =>
      screen.getAllByTestId("per-policy-row").map((r) => r.getAttribute("data-policy-id"));

    // Ascending (default): real values ascending (0.5, 0.9), nulls last.
    const asc = ids();
    expect(asc.slice(0, 2)).toEqual(["L-MID", "S-HI"]);
    expect(new Set(asc.slice(2))).toEqual(new Set(["U-HIDDEN", "N-NULL"]));

    // Descending: real values descending (0.9, 0.5), nulls STILL last.
    fireEvent.click(screen.getByTestId("sort-dir-toggle"));
    const desc = ids();
    expect(desc.slice(0, 2)).toEqual(["S-HI", "L-MID"]);
    expect(new Set(desc.slice(2))).toEqual(new Set(["U-HIDDEN", "N-NULL"]));
  });
});

describe("PerPolicyResultsTable legacy verdict sort (codex+claude desktop P2)", () => {
  it("pure-legacy rows sort by verdict_suggestion alphabetically (pre-S4 behavior restored)", () => {
    const mk = (id: string, pol: string, verdict: string) =>
      makeResult({
        id,
        policy_id: pol,
        verdict_suggestion: verdict,
        ai_suggestion: verdict,
      });
    // Scrambled input; verdict sort (asc) must restore the legacy localeCompare order.
    const rows = [
      mk("lg-p-00000000-0000-4000-8000-000000000001", "LG-PASS", "PASS"),
      mk("lg-e-00000000-0000-4000-8000-000000000002", "LG-ESCALATE", "ESCALATE"),
      mk("lg-n-00000000-0000-4000-8000-000000000003", "LG-NOTFOUND", "NOT_FOUND"),
      mk("lg-f-00000000-0000-4000-8000-000000000004", "LG-FAIL", "FAIL"),
    ];
    render(<PerPolicyResultsTable results={rows} judgments={NO_JUDGMENTS} />);
    fireEvent.change(screen.getByTestId("sort-by"), { target: { value: "verdict" } });
    const ids = screen
      .getAllByTestId("per-policy-row")
      .map((r) => r.getAttribute("data-policy-id"));
    // localeCompare order: ESCALATE < FAIL < NOT_FOUND < PASS (NOT the semantic rank).
    expect(ids).toEqual(["LG-ESCALATE", "LG-FAIL", "LG-NOTFOUND", "LG-PASS"]);
  });
});
