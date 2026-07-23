import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";

import { PathwayNotesView, isPathwayNotesArray } from "../PathwayNotesView";
import { PerPolicyResultsTable } from "../PerPolicyResultsTable";
import type { V2PerPolicyResult } from "@/lib/engine-v2/types_lane2";

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
    evidence_packet: {},
    pathway_notes: [],
    rubric_self_score: null,
    raw_result_json: {},
    created_at: "2026-05-12T10:00:00Z",
    s4_schema_version: null,
    evidence_present: null,
    evidence_signal_counts: null,
    confidence_scope: null,
    evidence_synthesis_self_score: null,
    ...overrides,
  };
}

describe("PathwayNotesView helpers", () => {
  it("t4 legacy keyed-object value -> isPathwayNotesArray returns false", () => {
    expect(isPathwayNotesArray({ some_key: "val" })).toBe(false);
  });

  it("t5 malformed scalar -> isPathwayNotesArray returns false", () => {
    expect(isPathwayNotesArray("oops")).toBe(false);
    expect(isPathwayNotesArray(null)).toBe(false);
    expect(isPathwayNotesArray(123)).toBe(false);
  });
  
  it("array -> isPathwayNotesArray returns true", () => {
    expect(isPathwayNotesArray([])).toBe(true);
    expect(isPathwayNotesArray([{ a: 1 }])).toBe(true);
  });
});

describe("PathwayNotesView component", () => {
  const t1HappyPath = [
    {
      pathway_id: "550e8400-e29b-41d4-a716-446655440000",
      pathway_kind: "GOVERNED_BY",
      narrative: "First narrative",
      edge_chain: ["REQUIRES", "CITES"],
      supporting_evidence_item_ids: ["slice_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f61111"],
    },
    {
      pathway_id: "550e8400-e29b-41d4-a716-446655440001",
      pathway_kind: "CITATION_CHAIN",
      narrative: "Second narrative",
      edge_chain: ["SAME_DOC"],
      supporting_evidence_item_ids: ["slice_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f62222"],
    }
  ];

  it("t1 happy path: 2 conforming items render as ordered cards without pre JSON", () => {
    render(<PathwayNotesView value={t1HappyPath} />);
    const cards = screen.getAllByTestId("pathway-note-card");
    expect(cards).toHaveLength(2);
    
    expect(screen.queryByTestId("pathway-note-fallback")).not.toBeInTheDocument();

    const firstCard = cards[0];
    const secondCard = cards[1];

    expect(within(firstCard).getByTestId("pathway-kind-badge").textContent).toBe("GOVERNED_BY");
    expect(within(firstCard).getByTestId("pathway-narrative").textContent).toBe("First narrative");
    expect(within(firstCard).getByTestId("pathway-edge-chain").textContent).toBe("REQUIRES->CITES");
    
    expect(within(secondCard).getByTestId("pathway-kind-badge").textContent).toBe("CITATION_CHAIN");
    expect(within(secondCard).getByTestId("pathway-narrative").textContent).toBe("Second narrative");
    expect(within(secondCard).getByTestId("pathway-edge-chain").textContent).toBe("SAME_DOC");
  });

  it("t2 empty array renders empty-state message", () => {
    render(<PathwayNotesView value={[]} />);
    const emptyMsg = screen.getByTestId("per-policy-pathway-notes-empty");
    expect(emptyMsg).toBeInTheDocument();
    expect(emptyMsg.textContent).toBe("No pathway notes recorded.");
  });

  it("t3 item with an extra unknown key degrades to JSON fallback, sibling stays as card", () => {
    const data = [
      {
        pathway_id: "550e8400-e29b-41d4-a716-446655440000",
        pathway_kind: "GOVERNED_BY",
        narrative: "I am fine",
        edge_chain: ["REQUIRES"],
        supporting_evidence_item_ids: ["slice_1111111111111111111111111111111111111111111111111111111111111111"],
      },
      {
        pathway_id: "550e8400-e29b-41d4-a716-446655440001",
        pathway_kind: "CITATION_CHAIN",
        narrative: "I have an extra key",
        edge_chain: ["SAME_DOC"],
        supporting_evidence_item_ids: ["slice_2222222222222222222222222222222222222222222222222222222222222222"],
        extra_key: "oops"
      }
    ];

    render(<PathwayNotesView value={data} />);
    const cards = screen.getAllByTestId("pathway-note-card");
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).getByTestId("pathway-narrative").textContent).toBe("I am fine");

    const fallback = screen.getAllByTestId("pathway-note-fallback");
    expect(fallback).toHaveLength(1);
    expect(fallback[0].textContent).toContain("extra_key");
  });

  it("t6 narrative containing <script>alert(1)</script> renders as TEXT (injection safety)", () => {
    const data = [
      {
        pathway_id: "550e8400-e29b-41d4-a716-446655440000",
        pathway_kind: "GOVERNED_BY",
        narrative: "<script>alert(1)</script>",
        edge_chain: ["REQUIRES"],
        supporting_evidence_item_ids: ["slice_1111111111111111111111111111111111111111111111111111111111111111"],
      }
    ];

    render(<PathwayNotesView value={data} />);
    const card = screen.getByTestId("pathway-note-card");
    expect(within(card).getByTestId("pathway-narrative").textContent).toBe("<script>alert(1)</script>");
    // Testing library DOM will not parse the literal text as a node
    expect(document.querySelector("script")).toBeNull();
  });

  it("t7 item with empty edge_chain -> non-conforming -> JSON fallback", () => {
    const data = [
      {
        pathway_id: "550e8400-e29b-41d4-a716-446655440000",
        pathway_kind: "GOVERNED_BY",
        narrative: "No edges",
        edge_chain: [],
        supporting_evidence_item_ids: ["slice_1111111111111111111111111111111111111111111111111111111111111111"],
      }
    ];

    render(<PathwayNotesView value={data} />);
    expect(screen.queryByTestId("pathway-note-card")).not.toBeInTheDocument();
    
    const fallback = screen.getByTestId("pathway-note-fallback");
    expect(fallback.textContent).toContain("No edges");
  });

  it("t8 integration: render PerPolicyResultsTable with a row whose pathway_notes is the t1 array -> cards appear", () => {
    const row = makeResult({
      pathway_notes: t1HappyPath
    });

    render(<PerPolicyResultsTable results={[row]} judgments={[]} />);

    // Expand the row first (mirror PerPolicyResultsTable.test.tsx idiom).
    const expandToggle = screen.getByTestId("per-policy-expand-toggle");
    fireEvent.click(expandToggle);

    const pathwayNotesSection = screen.getByTestId("per-policy-pathway-notes");
    expect(pathwayNotesSection).toBeInTheDocument();

    const cards = within(pathwayNotesSection).getAllByTestId("pathway-note-card");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByTestId("pathway-narrative").textContent).toBe("First narrative");
  });
});

describe("evidence reference matching (L3A R3/X3 as amended)", () => {
  const matchedId =
    "slice_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f61111";
  const unmatchedId =
    "slice_ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff2222";
  const note = {
    pathway_id: "550e8400-e29b-41d4-a716-446655440000",
    pathway_kind: "GOVERNED_BY",
    narrative: "Matched vs unmatched",
    edge_chain: ["REQUIRES"],
    supporting_evidence_item_ids: [matchedId, unmatchedId],
  };

  it("marks ids present in the row's collected evidence set; leaves others plain", () => {
    render(
      <PathwayNotesView
        value={[note]}
        presentEvidenceIds={new Set([matchedId])}
      />,
    );
    const matched = screen.getByTestId("pathway-evidence-id-matched");
    expect(matched.getAttribute("title")).toContain("present in this row's evidence packet");
    expect(matched.textContent).toContain("*");
    const unmatched = screen.getByTestId("pathway-evidence-id-unmatched");
    expect(unmatched.getAttribute("title")).toBe(unmatchedId);
    expect(unmatched.textContent).not.toContain("*");
  });

  it("no presentEvidenceIds prop -> all ids render unmatched (no throw)", () => {
    render(<PathwayNotesView value={[note]} />);
    expect(screen.getAllByTestId("pathway-evidence-id-unmatched")).toHaveLength(2);
    expect(screen.queryByTestId("pathway-evidence-id-matched")).not.toBeInTheDocument();
  });

  it("table-level: legacy keyed-object pathway_notes routes to JsonObjectView (R5)", () => {
    const row = makeResult({
      pathway_notes: { legacy_key: "legacy value" } as unknown as Record<string, unknown>,
    });
    render(<PerPolicyResultsTable results={[row]} judgments={[]} />);
    const expandToggle = screen.getByTestId("per-policy-expand-toggle");
    fireEvent.click(expandToggle);
    const notesEl = screen.getByTestId("per-policy-pathway-notes");
    expect(notesEl.textContent).toContain("legacy_key");
    expect(screen.queryByTestId("pathway-note-card")).not.toBeInTheDocument();
  });

  it("table-level integration: supporting id present in the row's evidence_packet gets the matched marker", () => {
    const row = makeResult({
      pathway_notes: [note],
      evidence_packet: [
        {
          evidence_item_id: matchedId,
          evidence_type: "quote",
          is_supporting_or_negating: "SUPPORTING",
        },
      ] as unknown as Record<string, unknown>,
    });
    render(<PerPolicyResultsTable results={[row]} judgments={[]} />);
    const expandToggle = screen.getByTestId("per-policy-expand-toggle");
    fireEvent.click(expandToggle);
    expect(screen.getByTestId("pathway-evidence-id-matched")).toBeInTheDocument();
    expect(screen.getByTestId("pathway-evidence-id-unmatched")).toBeInTheDocument();
  });
});

  it("table-level: a CORPUS-SIDE packet item does NOT produce the matched marker (pins the post-filter adjudication)", () => {
    const corpusId =
      "slice_cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc3333";
    const row = makeResult({
      pathway_notes: [
        {
          pathway_id: "550e8400-e29b-41d4-a716-446655440000",
          pathway_kind: "GOVERNED_BY",
          narrative: "Corpus-side must not match",
          edge_chain: ["REQUIRES"],
          supporting_evidence_item_ids: [corpusId],
        },
      ],
      evidence_packet: [
        {
          evidence_item_id: corpusId,
          evidence_type: "quote",
          evidence_item_ref: { index_side: "corpus" },
        },
      ] as unknown as Record<string, unknown>,
    });
    render(<PerPolicyResultsTable results={[row]} judgments={[]} />);
    fireEvent.click(screen.getByTestId("per-policy-expand-toggle"));
    // The corpus-side item is filtered from the citations render, so the
    // pathway reference must render UNMATCHED -- an emerald "present"
    // endorsement of corpus-side content would be the owner-rejected
    // anti-pattern by proxy.
    expect(screen.queryByTestId("pathway-evidence-id-matched")).not.toBeInTheDocument();
    expect(screen.getByTestId("pathway-evidence-id-unmatched")).toBeInTheDocument();
  });
