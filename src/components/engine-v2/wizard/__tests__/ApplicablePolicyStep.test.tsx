// Unit tests for ApplicablePolicyStep component.
//
// Covers:
//   - Loading state renders spinner + message.
//   - Error state renders error + retry button.
//   - No proposal yet renders waiting message.
//   - Proposal present: groups are rendered collapsed; rows not rendered initially.
//   - Expanding a group renders its rows.
//   - Group check-all toggles all group ids.
//   - Floor section renders collapsed; default unchecked.
//   - Selection counter updates with selectedIds.
//   - Uncheck-all within a group removes all group ids from selection.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ApplicablePolicyStep } from "../ApplicablePolicyStep";
import type { ProposerCliOutput } from "@/lib/engine-v2/propose_policies";

function makeProposal(overrides: Partial<ProposerCliOutput> = {}): ProposerCliOutput {
  return {
    schema_version: "proposer_cli/0.1.0",
    app_context_echo: {},
    signal_fired: [
      {
        policy_id: "CSAP-COP-GW-001",
        score: 12.0,
        rationale: "rationale A",
        inclusive_fallback: false,
      },
      {
        policy_id: "CSAP-COP-SED-001",
        score: 12.0,
        rationale: "rationale B",
        inclusive_fallback: false,
      },
      {
        policy_id: "P28-ERA-001",
        score: 8.0,
        rationale: "rationale C",
        inclusive_fallback: false,
      },
    ],
    floor_tail_policy_ids: ["CSAP-ERA-BIO-001", "CSAP-ERA-BIO-002"],
    counts: {
      total_scored: 5860,
      signal_fired_count: 3,
      floor_tail_count: 2,
      ceiling_hit: false,
    },
    ...overrides,
  };
}

describe("ApplicablePolicyStep", () => {
  it("renders spinner and loading message during loading", () => {
    render(
      <ApplicablePolicyStep
        proposal={null}
        loading={true}
        error={null}
        selectedIds={[]}
        onChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/scoring policies/i)).toBeTruthy();
  });

  it("renders error message and retry button when error is present", () => {
    const onRetry = vi.fn();
    render(
      <ApplicablePolicyStep
        proposal={null}
        loading={false}
        error="proposer_exit_1: engine internal error"
        selectedIds={[]}
        onChange={vi.fn()}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText(/Policy proposal failed/i)).toBeTruthy();
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders waiting message when no proposal and not loading and no error", () => {
    render(
      <ApplicablePolicyStep
        proposal={null}
        loading={false}
        error={null}
        selectedIds={[]}
        onChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/waiting for proposal/i)).toBeTruthy();
  });

  it("renders group headers collapsed (rows not in DOM)", () => {
    const proposal = makeProposal();
    render(
      <ApplicablePolicyStep
        proposal={proposal}
        loading={false}
        error={null}
        selectedIds={[]}
        onChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    // Group headers present, keyed by the FIRST TWO dash-separated segments.
    expect(screen.getByText(/^CSAP-COP$/)).toBeTruthy();
    expect(screen.getByText(/^P28-ERA$/)).toBeTruthy();
    // Row policy ids should NOT be in the DOM while collapsed.
    expect(screen.queryByText("CSAP-COP-GW-001")).toBeNull();
    expect(screen.queryByText("P28-ERA-001")).toBeNull();
  });

  it("expanding a group renders its rows", () => {
    const proposal = makeProposal();
    render(
      <ApplicablePolicyStep
        proposal={proposal}
        loading={false}
        error={null}
        selectedIds={[]}
        onChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    // Click the CSAP-COP group button.
    const csapBtn = screen.getByRole("button", { name: /CSAP-COP/i });
    fireEvent.click(csapBtn);
    // Now rows should be visible.
    expect(screen.getByText("CSAP-COP-GW-001")).toBeTruthy();
    expect(screen.getByText("CSAP-COP-SED-001")).toBeTruthy();
    // P28-ERA group still collapsed.
    expect(screen.queryByText("P28-ERA-001")).toBeNull();
  });

  it("check-all button for a group adds all group ids to selection", () => {
    const proposal = makeProposal();
    const onChange = vi.fn();
    render(
      <ApplicablePolicyStep
        proposal={proposal}
        loading={false}
        error={null}
        selectedIds={[]}
        onChange={onChange}
        onRetry={vi.fn()}
      />,
    );
    // Find the group check-all by aria-label (2-segment key).
    const groupCheckAll = screen.getByRole("checkbox", {
      name: /Select all CSAP-COP policies/i,
    });
    fireEvent.click(groupCheckAll);
    expect(onChange).toHaveBeenCalledOnce();
    const nextIds = onChange.mock.calls[0]![0] as string[];
    expect(nextIds).toContain("CSAP-COP-GW-001");
    expect(nextIds).toContain("CSAP-COP-SED-001");
    expect(nextIds).not.toContain("P28-ERA-001");
  });

  it("check-all unchecks all when all were checked", () => {
    const proposal = makeProposal();
    const onChange = vi.fn();
    const allGroupIds = ["CSAP-COP-GW-001", "CSAP-COP-SED-001"];
    render(
      <ApplicablePolicyStep
        proposal={proposal}
        loading={false}
        error={null}
        selectedIds={[...allGroupIds, "P28-ERA-001"]}
        onChange={onChange}
        onRetry={vi.fn()}
      />,
    );
    const groupCheckAll = screen.getByRole("checkbox", {
      name: /Select all CSAP-COP policies/i,
    });
    fireEvent.click(groupCheckAll);
    expect(onChange).toHaveBeenCalledOnce();
    const nextIds = onChange.mock.calls[0]![0] as string[];
    // CSAP-COP ids removed; P28-ERA preserved.
    expect(nextIds).not.toContain("CSAP-COP-GW-001");
    expect(nextIds).not.toContain("CSAP-COP-SED-001");
    expect(nextIds).toContain("P28-ERA-001");
  });

  it("floor section is rendered collapsed and has floor check-all checkbox", () => {
    const proposal = makeProposal();
    render(
      <ApplicablePolicyStep
        proposal={proposal}
        loading={false}
        error={null}
        selectedIds={[]}
        onChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    // Floor section header present.
    expect(screen.getByText(/additional policies included by inclusive floor/i)).toBeTruthy();
    // Floor ids should NOT be visible while collapsed.
    expect(screen.queryByText("CSAP-ERA-BIO-001")).toBeNull();
    // Floor check-all checkbox is present.
    expect(screen.getByRole("checkbox", { name: /Select all floor policies/i })).toBeTruthy();
  });

  it("floor check-all adds floor ids to selection", () => {
    const proposal = makeProposal();
    const onChange = vi.fn();
    render(
      <ApplicablePolicyStep
        proposal={proposal}
        loading={false}
        error={null}
        selectedIds={[]}
        onChange={onChange}
        onRetry={vi.fn()}
      />,
    );
    const floorCheckAll = screen.getByRole("checkbox", {
      name: /Select all floor policies/i,
    });
    fireEvent.click(floorCheckAll);
    expect(onChange).toHaveBeenCalledOnce();
    const nextIds = onChange.mock.calls[0]![0] as string[];
    expect(nextIds).toContain("CSAP-ERA-BIO-001");
    expect(nextIds).toContain("CSAP-ERA-BIO-002");
  });

  it("selection counter shows correct count", () => {
    const proposal = makeProposal();
    render(
      <ApplicablePolicyStep
        proposal={proposal}
        loading={false}
        error={null}
        selectedIds={["CSAP-COP-GW-001", "P28-ERA-001"]}
        onChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/2 of 5 proposed policies/i)).toBeTruthy();
  });

  it("warns when selection is empty", () => {
    const proposal = makeProposal();
    render(
      <ApplicablePolicyStep
        proposal={proposal}
        loading={false}
        error={null}
        selectedIds={[]}
        onChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/No policies selected/i)).toBeTruthy();
  });

  it("splits the same first-segment ids into distinct 2-segment groups", () => {
    // Two ids share the FIRST segment (CSAP) but differ in the SECOND.
    // A single-segment key would collapse both into one CSAP group; the
    // 2-segment key must keep CSAP-RAPG and CSAP-NPG separate.
    const proposal = makeProposal({
      signal_fired: [
        { policy_id: "CSAP-RAPG-ERA-01", score: 1, rationale: "r", inclusive_fallback: false },
        { policy_id: "CSAP-NPG-RP-O-4b", score: 1, rationale: "r", inclusive_fallback: false },
      ],
      floor_tail_policy_ids: [],
      counts: { total_scored: 5860, signal_fired_count: 2, floor_tail_count: 0, ceiling_hit: false },
    });
    render(
      <ApplicablePolicyStep
        proposal={proposal}
        loading={false}
        error={null}
        selectedIds={[]}
        onChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/^CSAP-RAPG$/)).toBeTruthy();
    expect(screen.getByText(/^CSAP-NPG$/)).toBeTruthy();
  });

  it("renders large groups (>300) in slices with a 'show more' control", () => {
    // 600 entries sharing a 2-segment key. Initial slice is 250; a single
    // 'show more' reveals 250 more (500 total), leaving 100 remaining.
    const big = Array.from({ length: 600 }, (_v, i) => ({
      policy_id: `BIG-GRP-${String(i).padStart(4, "0")}`,
      score: 1,
      rationale: `r${i}`,
      inclusive_fallback: false,
    }));
    const proposal = makeProposal({
      signal_fired: big,
      floor_tail_policy_ids: [],
      counts: { total_scored: 5860, signal_fired_count: 600, floor_tail_count: 0, ceiling_hit: false },
    });
    render(
      <ApplicablePolicyStep
        proposal={proposal}
        loading={false}
        error={null}
        selectedIds={[]}
        onChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    // Expand the group.
    fireEvent.click(screen.getByRole("button", { name: /BIG-GRP/i }));
    // Only the first 250 rows are mounted initially.
    expect(screen.getByText("BIG-GRP-0000")).toBeTruthy();
    expect(screen.getByText("BIG-GRP-0249")).toBeTruthy();
    expect(screen.queryByText("BIG-GRP-0250")).toBeNull();
    // The "show more" control is present.
    const showMore = screen.getByRole("button", { name: /Show 250 more/i });
    fireEvent.click(showMore);
    // Now 500 rows mounted; row 250 and 499 visible, 500 still hidden.
    expect(screen.getByText("BIG-GRP-0250")).toBeTruthy();
    expect(screen.getByText("BIG-GRP-0499")).toBeTruthy();
    expect(screen.queryByText("BIG-GRP-0500")).toBeNull();
    // Remaining count reflected (600 - 500 = 100).
    expect(screen.getByRole("button", { name: /Show 100 more/i })).toBeTruthy();
  });
});
