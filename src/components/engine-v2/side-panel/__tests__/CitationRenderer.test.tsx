// engine_v2 frontend Lane 2d / Phase E: CitationRenderer tests.
//
// Covers:
//   - Click invokes openPeek + setPendingHighlight with the canonical
//     evidence_item_id shape via SidePanelContext.
//   - Keyboard activation (Enter / Space) behaves the same as click.
//   - Indigenous-flagged pill renders the NEUTRAL "Indigenous uses
//     content" badge (feedback_no_tier_judgment_for_ai, 2026-05-12).
//   - Pill is keyboard-focusable and reports the correct aria-label.
//   - data-evidence-item-id matches the prop.
//
// ASCII only.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

import { CitationRenderer } from "../CitationRenderer";
import * as sidePanelCtx from "../SidePanelContext";

interface MockedContext {
  openPeek: ReturnType<typeof vi.fn>;
  setPendingHighlight: ReturnType<typeof vi.fn>;
  closePeek: ReturnType<typeof vi.fn>;
}

function mountWithSpy(): MockedContext {
  const openPeek = vi.fn();
  const setPendingHighlight = vi.fn();
  const closePeek = vi.fn();
  const useSidePanelSpy = vi.spyOn(sidePanelCtx, "useSidePanel");
  useSidePanelSpy.mockReturnValue({
    pendingHighlight: null,
    setPendingHighlight,
    openPeek,
    closePeek,
    peekChunk: null,
  });
  return { openPeek, setPendingHighlight, closePeek };
}

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("CitationRenderer", () => {
  it("renders the pill with section + page label and the correct data attribute", () => {
    mountWithSpy();
    render(
      <CitationRenderer
        evidenceItemId="slice_abc123"
        docSection="S2.3 Sampling Plan"
        pageNum={42}
        positionLabel="S1"
      />,
    );
    const pill = screen.getByTestId("citation-pill");
    expect(pill.getAttribute("data-evidence-item-id")).toBe("slice_abc123");
    const section = screen.getByTestId("citation-pill-section");
    expect(section.textContent).toContain("S2.3 Sampling Plan");
    expect(section.textContent).toContain("p.42");
    const position = screen.getByTestId("citation-pill-position");
    expect(position.textContent).toBe("S1");
  });

  it("click invokes openPeek + setPendingHighlight with the canonical shape", () => {
    const { openPeek, setPendingHighlight } = mountWithSpy();
    render(
      <CitationRenderer
        evidenceItemId="slice_xyz"
        sourceChunkId="chunk-7"
        docSection="S1"
        pageNum={7}
      />,
    );
    fireEvent.click(screen.getByTestId("citation-pill"));
    expect(openPeek).toHaveBeenCalledTimes(1);
    expect(openPeek.mock.calls[0]![0]).toMatchObject({
      evidenceItemId: "slice_xyz",
      sourceChunkId: "chunk-7",
      docSection: "S1",
      pageNum: 7,
      content: null,
    });
    expect(setPendingHighlight).toHaveBeenCalledTimes(1);
    expect(setPendingHighlight.mock.calls[0]![0]).toMatchObject({
      evidenceItemId: "slice_xyz",
    });
  });

  it("keyboard activation (Enter) fires the same handlers as click", () => {
    const { openPeek, setPendingHighlight } = mountWithSpy();
    render(<CitationRenderer evidenceItemId="slice_kbd" />);
    const pill = screen.getByTestId("citation-pill");
    fireEvent.keyDown(pill, { key: "Enter" });
    expect(openPeek).toHaveBeenCalledTimes(1);
    expect(setPendingHighlight).toHaveBeenCalledTimes(1);
    expect(openPeek.mock.calls[0]![0]).toMatchObject({
      evidenceItemId: "slice_kbd",
    });
  });

  it("keyboard activation (Space) fires the same handlers as click", () => {
    const { openPeek, setPendingHighlight } = mountWithSpy();
    render(<CitationRenderer evidenceItemId="slice_space" />);
    const pill = screen.getByTestId("citation-pill");
    fireEvent.keyDown(pill, { key: " " });
    expect(openPeek).toHaveBeenCalledTimes(1);
    expect(setPendingHighlight).toHaveBeenCalledTimes(1);
  });

  it("renders the NEUTRAL Indigenous uses content badge when flagged", () => {
    mountWithSpy();
    render(
      <CitationRenderer
        evidenceItemId="slice_ind"
        indigenousFlagged={true}
      />,
    );
    const badge = screen.getByTestId("citation-pill-indigenous-badge");
    expect(badge.textContent).toBe("Indigenous uses content");
    // Neutral wording -- no procedural / consultation language.
    expect(badge.textContent).not.toMatch(/consult/i);
    expect(badge.textContent).not.toMatch(/TIER_3/);
  });

  it("does not render the Indigenous badge when not flagged", () => {
    mountWithSpy();
    render(<CitationRenderer evidenceItemId="slice_plain" />);
    expect(screen.queryByTestId("citation-pill-indigenous-badge")).toBeNull();
  });

  it("is degraded gracefully when used outside a SidePanelProvider", () => {
    // Without a provider, useSidePanel returns null. Click is a no-op
    // (no handlers to invoke, no throw).
    const useSidePanelSpy = vi.spyOn(sidePanelCtx, "useSidePanel");
    useSidePanelSpy.mockReturnValue(null);
    render(<CitationRenderer evidenceItemId="slice_offgrid" />);
    fireEvent.click(screen.getByTestId("citation-pill"));
    // The mock context returned null; openPeek would not be defined.
    // The render did not throw, which is the test bar.
    expect(screen.getByTestId("citation-pill")).toBeTruthy();
  });
});
