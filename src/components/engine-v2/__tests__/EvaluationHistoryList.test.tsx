// Phase 2.6 hotfix tests (owner directive 2026-05-12):
//
// The Coverage column on the evaluation-history table MUST read directly
// from coverage_statement.evaluated and coverage_statement.total_policies
// as emitted by the engine's eval_result.json. NOT_FOUND and ESCALATE are
// valid AI suggestions (not errors) and the engine counts them toward
// "evaluated". Falling back to a PASS+FAIL derivation would misreport an
// eval that shipped 43 ESCALATE rows as "0 / 43".

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import { EvaluationHistoryList } from "../EvaluationHistoryList";
import type { V2EvaluationListRow } from "@/lib/engine-v2/types_lane2";

const PROJECT_ID = "00000000-0000-4000-8000-000000000aaa";

function makeRow(
  overrides: Partial<V2EvaluationListRow> = {},
): V2EvaluationListRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    status: "completed",
    evaluation_backend: "live",
    bench_fixture: "fixture-a",
    coverage_statement: { total_policies: 43, evaluated: 43 },
    started_at: "2026-05-12T10:00:00Z",
    completed_at: "2026-05-12T10:05:00Z",
    errors: [],
    ...overrides,
  };
}

describe("EvaluationHistoryList coverage column (Phase 2.6)", () => {
  it("Coverage column reads coverage_statement.evaluated when present", () => {
    const row = makeRow({
      coverage_statement: {
        total_policies: 43,
        evaluated: 43,
        deferred: 0,
        error: 0,
      },
    });
    render(
      <EvaluationHistoryList projectId={PROJECT_ID} evaluations={[row]} />,
    );
    const tr = screen.getByTestId("evaluation-history-row");
    // The cell content matches "{evaluated} / {total_policies}".
    expect(tr.textContent).toContain("43 / 43");
    expect(tr.textContent).not.toContain("0 / 43");
  });

  it("Coverage column reports evaluated count even when no PASS/FAIL rows shipped", () => {
    // Real-world regression scenario: 43 ESCALATE rows. The engine reports
    // evaluated=43; a PASS+FAIL derivation would render "0 / 43".
    const row = makeRow({
      coverage_statement: {
        total_policies: 43,
        evaluated: 43,
        deferred: 0,
        error: 0,
        deferred_reasons: {},
      },
    });
    render(
      <EvaluationHistoryList projectId={PROJECT_ID} evaluations={[row]} />,
    );
    const tr = screen.getByTestId("evaluation-history-row");
    expect(tr.textContent).toContain("43 / 43");
  });

  it("Coverage column falls back to '-' when coverage_statement is missing entirely", () => {
    // Older schema: no coverage_statement field. Render "-" rather than
    // fabricate a derivation.
    const row = makeRow({
      coverage_statement: {} as Record<string, unknown>,
    });
    render(
      <EvaluationHistoryList projectId={PROJECT_ID} evaluations={[row]} />,
    );
    const tr = screen.getByTestId("evaluation-history-row");
    expect(tr.textContent).toContain("-");
    // It MUST NOT show "0 / 0" or any fabricated number.
    expect(tr.textContent).not.toContain("0 / 0");
  });

  it("Coverage column renders partial when only one of evaluated/total_policies is present", () => {
    const row = makeRow({
      coverage_statement: { evaluated: 12 },
    });
    render(
      <EvaluationHistoryList projectId={PROJECT_ID} evaluations={[row]} />,
    );
    const tr = screen.getByTestId("evaluation-history-row");
    expect(tr.textContent).toContain("12 / -");
  });
});
