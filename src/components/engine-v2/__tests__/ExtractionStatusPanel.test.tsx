// engine_v2 frontend Lane 1 / Module L1-5: ExtractionStatusPanel tests.
//
// Focused on the indeterminate progress bar behavior added for honest UX
// during single-PDF extractions, where dashboard_extract.py only updates
// progress after each file completes and never crosses the 5% threshold
// mid-flight. While extracting AND progress < 5, the bar shows an animated
// indeterminate sliding bar instead of a stuck 0% bar. Once progress
// crosses 5 (or status becomes terminal), the standard determinate %-based
// bar is shown.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import { ExtractionStatusPanel } from "../ExtractionStatusPanel";
import type { V2ExtractionRun } from "@/lib/engine-v2/types";

function makeRun(overrides: Partial<V2ExtractionRun>): V2ExtractionRun {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    project_id: "00000000-0000-4000-8000-0000000000aa",
    status: "extracting",
    total_files: 1,
    completed_files: 0,
    current_file: "Site3250-PSI.pdf",
    progress: 0,
    errors: [],
    chunk_progress: null,
    updated_at: "2026-05-12T10:00:00Z",
    started_at: "2026-05-12T10:00:00Z",
    completed_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  // Avoid the panel's auto-polling effect from firing fetch in JSDOM.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ExtractionStatusPanel indeterminate progress bar", () => {
  it("renders indeterminate bar when extracting AND progress < 5", () => {
    const run = makeRun({ status: "extracting", progress: 0 });
    render(<ExtractionStatusPanel projectId="proj-1" run={run} />);
    const bar = screen.getByTestId("extraction-status-progress-bar");
    expect(bar.getAttribute("data-progress-mode")).toBe("indeterminate");
    // The numeric % label is replaced by a working indicator.
    expect(screen.getByTestId("extraction-status-progress-pct").textContent)
      .toContain("working");
  });

  it("renders determinate %-bar once progress crosses the 5% threshold", () => {
    const run = makeRun({ status: "extracting", progress: 42 });
    render(<ExtractionStatusPanel projectId="proj-1" run={run} />);
    const bar = screen.getByTestId("extraction-status-progress-bar");
    expect(bar.getAttribute("data-progress-mode")).toBe("determinate");
    expect(screen.getByTestId("extraction-status-progress-pct").textContent)
      .toContain("42%");
  });

  it("renders determinate %-bar for terminal status even when progress is low", () => {
    // Completed runs should always show the actual % (100), not indeterminate.
    const run = makeRun({
      status: "completed",
      progress: 100,
      completed_files: 1,
    });
    render(<ExtractionStatusPanel projectId="proj-1" run={run} />);
    const bar = screen.getByTestId("extraction-status-progress-bar");
    expect(bar.getAttribute("data-progress-mode")).toBe("determinate");
    expect(screen.getByTestId("extraction-status-progress-pct").textContent)
      .toContain("100%");
  });

  it("renders determinate %-bar for pending status (not extracting)", () => {
    const run = makeRun({ status: "pending", progress: 0 });
    render(<ExtractionStatusPanel projectId="proj-1" run={run} />);
    const bar = screen.getByTestId("extraction-status-progress-bar");
    expect(bar.getAttribute("data-progress-mode")).toBe("determinate");
  });
});
