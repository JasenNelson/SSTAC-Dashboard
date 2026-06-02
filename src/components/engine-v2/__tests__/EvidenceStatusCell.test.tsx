// engine_v2 S4 read-side: EvidenceStatusCell tests.
//
// Covers:
//   - present=true renders "Evidence present" indicator
//   - present=false renders "Evidence absent" indicator
//   - Signal readout appears when signalCounts is populated
//   - Signal readout omits absent keys
//   - Signal readout is absent when signalCounts is null
//   - match-confidence only rendered when scope === "EVIDENCE_MATCH_NOT_ADEQUACY"
//   - match-confidence NOT rendered for wrong scope
//   - match-confidence NOT rendered for null confidence
//   - indigenous-content badge rendered when matched=true
//   - indigenous-content badge NOT rendered when matched=false
//   - degrades gracefully on null signalCounts (no throw)
//
// Style: mirrors PerPolicyResultsTable.test.tsx (render + screen queries).
// Plain ASCII only.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import { EvidenceStatusCell } from "../EvidenceStatusCell";

describe("EvidenceStatusCell - present indicator", () => {
  it("renders Evidence present badge when present=true", () => {
    render(
      <EvidenceStatusCell
        present={true}
        signalCounts={null}
        confidence={null}
        confidenceScope={null}
        indigenousMatched={false}
        indigenousKeywords={[]}
      />,
    );
    const badge = screen.getByTestId("evidence-present-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-evidence-present", "true");
    expect(badge.textContent).toContain("Evidence present");
  });

  it("renders Evidence absent badge when present=false", () => {
    render(
      <EvidenceStatusCell
        present={false}
        signalCounts={null}
        confidence={null}
        confidenceScope={null}
        indigenousMatched={false}
        indigenousKeywords={[]}
      />,
    );
    const badge = screen.getByTestId("evidence-present-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-evidence-present", "false");
    expect(badge.textContent).toContain("Evidence absent");
  });

  it("renders 'Unknown' badge when present=null (defensive)", () => {
    render(
      <EvidenceStatusCell
        present={null}
        signalCounts={null}
        confidence={null}
        confidenceScope={null}
        indigenousMatched={false}
        indigenousKeywords={[]}
      />,
    );
    const badge = screen.getByTestId("evidence-present-badge");
    expect(badge).toHaveAttribute("data-evidence-present", "unknown");
  });
});

describe("EvidenceStatusCell - signal readout", () => {
  it("renders signal readout with all keys when signalCounts is fully populated", () => {
    render(
      <EvidenceStatusCell
        present={true}
        signalCounts={{ total_cited: 5, supporting: 3, negating: 1, absence_or_category_mismatch: 0, neutral: 1 }}
        confidence={null}
        confidenceScope={null}
        indigenousMatched={false}
        indigenousKeywords={[]}
      />,
    );
    const readout = screen.getByTestId("evidence-signal-readout");
    expect(readout).toBeInTheDocument();
    expect(readout.textContent).toContain("5 cited");
    expect(readout.textContent).toContain("3 support");
    expect(readout.textContent).toContain("1 negate");
  });

  it("omits keys that are missing/undefined from the readout", () => {
    render(
      <EvidenceStatusCell
        present={true}
        signalCounts={{ total_cited: 2 }}
        confidence={null}
        confidenceScope={null}
        indigenousMatched={false}
        indigenousKeywords={[]}
      />,
    );
    const readout = screen.getByTestId("evidence-signal-readout");
    expect(readout.textContent).toContain("2 cited");
    expect(readout.textContent).not.toContain("support");
    expect(readout.textContent).not.toContain("negate");
  });

  it("does not render signal readout when signalCounts is null", () => {
    render(
      <EvidenceStatusCell
        present={true}
        signalCounts={null}
        confidence={null}
        confidenceScope={null}
        indigenousMatched={false}
        indigenousKeywords={[]}
      />,
    );
    expect(screen.queryByTestId("evidence-signal-readout")).toBeNull();
  });

  it("does not render signal readout when all signalCounts keys are absent", () => {
    render(
      <EvidenceStatusCell
        present={true}
        signalCounts={{}}
        confidence={null}
        confidenceScope={null}
        indigenousMatched={false}
        indigenousKeywords={[]}
      />,
    );
    expect(screen.queryByTestId("evidence-signal-readout")).toBeNull();
  });
});

describe("EvidenceStatusCell - match-confidence guard", () => {
  it("renders match-confidence when scope === EVIDENCE_MATCH_NOT_ADEQUACY", () => {
    render(
      <EvidenceStatusCell
        present={true}
        signalCounts={null}
        confidence={0.87}
        confidenceScope="EVIDENCE_MATCH_NOT_ADEQUACY"
        indigenousMatched={false}
        indigenousKeywords={[]}
      />,
    );
    const confEl = screen.getByTestId("evidence-match-confidence");
    expect(confEl).toBeInTheDocument();
    expect(confEl.textContent).toContain("match confidence");
    expect(confEl.textContent).toContain("0.87");
    // Must not use adequacy / verdict words.
    expect(confEl.textContent).not.toContain("adequacy");
    expect(confEl.textContent).not.toContain("verdict");
  });

  it("does NOT render match-confidence when scope is wrong", () => {
    render(
      <EvidenceStatusCell
        present={true}
        signalCounts={null}
        confidence={0.87}
        confidenceScope="SOME_OTHER_SCOPE"
        indigenousMatched={false}
        indigenousKeywords={[]}
      />,
    );
    expect(screen.queryByTestId("evidence-match-confidence")).toBeNull();
  });

  it("does NOT render match-confidence when scope is null", () => {
    render(
      <EvidenceStatusCell
        present={true}
        signalCounts={null}
        confidence={0.87}
        confidenceScope={null}
        indigenousMatched={false}
        indigenousKeywords={[]}
      />,
    );
    expect(screen.queryByTestId("evidence-match-confidence")).toBeNull();
  });

  it("does NOT render match-confidence when confidence is null (even with correct scope)", () => {
    render(
      <EvidenceStatusCell
        present={true}
        signalCounts={null}
        confidence={null}
        confidenceScope="EVIDENCE_MATCH_NOT_ADEQUACY"
        indigenousMatched={false}
        indigenousKeywords={[]}
      />,
    );
    expect(screen.queryByTestId("evidence-match-confidence")).toBeNull();
  });
});

describe("EvidenceStatusCell - indigenous content badge", () => {
  it("renders indigenous-content badge when indigenousMatched=true", () => {
    render(
      <EvidenceStatusCell
        present={true}
        signalCounts={null}
        confidence={null}
        confidenceScope={null}
        indigenousMatched={true}
        indigenousKeywords={["traditional garden", "fishing"]}
      />,
    );
    const badge = screen.getByTestId("indigenous-content-badge");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain("Indigenous uses content");
    // No procedural / consultation / tier / SDM / QP language.
    expect(badge.textContent).not.toContain("SDM");
    expect(badge.textContent).not.toContain("consultation");
    expect(badge.textContent).not.toContain("tier");
  });

  it("does NOT render indigenous-content badge when indigenousMatched=false", () => {
    render(
      <EvidenceStatusCell
        present={true}
        signalCounts={null}
        confidence={null}
        confidenceScope={null}
        indigenousMatched={false}
        indigenousKeywords={[]}
      />,
    );
    expect(screen.queryByTestId("indigenous-content-badge")).toBeNull();
  });

  it("renders badge with no keywords when keywords array is empty but matched=true", () => {
    render(
      <EvidenceStatusCell
        present={true}
        signalCounts={null}
        confidence={null}
        confidenceScope={null}
        indigenousMatched={true}
        indigenousKeywords={[]}
      />,
    );
    expect(screen.getByTestId("indigenous-content-badge")).toBeInTheDocument();
  });
});

describe("EvidenceStatusCell - whole-component presence", () => {
  it("always renders the outer evidence-status-cell container", () => {
    render(
      <EvidenceStatusCell
        present={true}
        signalCounts={null}
        confidence={null}
        confidenceScope={null}
        indigenousMatched={false}
        indigenousKeywords={[]}
      />,
    );
    expect(screen.getByTestId("evidence-status-cell")).toBeInTheDocument();
  });
});
