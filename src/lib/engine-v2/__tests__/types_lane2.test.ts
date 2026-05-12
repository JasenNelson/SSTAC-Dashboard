import { describe, it, expect } from "vitest";
import {
  TERMINAL_EVALUATION_STATUSES,
  type EvaluationStatus,
} from "../types_lane2";

describe("TERMINAL_EVALUATION_STATUSES", () => {
  it("has exactly 3 entries", () => {
    expect(TERMINAL_EVALUATION_STATUSES).toHaveLength(3);
  });

  it("does not include 'running' (non-terminal)", () => {
    const running: EvaluationStatus = "running";
    expect(TERMINAL_EVALUATION_STATUSES).not.toContain(running);
  });

  it("does not include 'pending' (non-terminal)", () => {
    const pending: EvaluationStatus = "pending";
    expect(TERMINAL_EVALUATION_STATUSES).not.toContain(pending);
  });

  it("includes 'completed' (terminal)", () => {
    const completed: EvaluationStatus = "completed";
    expect(TERMINAL_EVALUATION_STATUSES).toContain(completed);
  });

  it("includes 'completed_with_errors' (terminal)", () => {
    const cwe: EvaluationStatus = "completed_with_errors";
    expect(TERMINAL_EVALUATION_STATUSES).toContain(cwe);
  });

  it("includes 'error' (terminal)", () => {
    const err: EvaluationStatus = "error";
    expect(TERMINAL_EVALUATION_STATUSES).toContain(err);
  });
});
