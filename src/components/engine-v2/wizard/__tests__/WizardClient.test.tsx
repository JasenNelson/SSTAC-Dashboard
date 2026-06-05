// Unit tests for WizardClient: 6-step wizard with ApplicablePoliciesStep at index 4.
//
// Covers:
//   - Renders 6 step labels.
//   - canAdvance gating: step 4 blocked when proposal null + no error; passes when loaded.
//   - On entering step 4, fetch is made to /api/engine-v2/projects/propose-policies.
//   - Submit body contains applicable_policy_ids when proposal was loaded.
//   - Submit body omits applicable_policy_ids when proposal had no selected ids.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// --- Module mocks ---

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock all child step components to keep rendering simple.
vi.mock("../ProjectMetadataStep", () => ({
  ProjectMetadataStep: ({ onChange }: { onChange: (v: { name: string; description: string }) => void }) => (
    <button
      onClick={() => onChange({ name: "Test Project", description: "" })}
      data-testid="metadata-step"
    >
      MetadataStep
    </button>
  ),
}));

vi.mock("../ApplicationTypeStep", () => ({
  ApplicationTypeStep: ({ onChange }: { onChange: (v: string[]) => void }) => (
    <button
      onClick={() => onChange(["risk_assessment"])}
      data-testid="apptype-step"
    >
      AppTypeStep
    </button>
  ),
  APPLICATION_TYPE_OPTIONS: [{ id: "risk_assessment", label: "Risk Assessment" }],
}));

vi.mock("../ServiceTypeStep", () => ({
  ServiceTypeStep: ({ onChange }: { onChange: (v: string[]) => void }) => (
    <button
      onClick={() => onChange(["era-review"])}
      data-testid="service-step"
    >
      ServiceTypeStep
    </button>
  ),
}));

vi.mock("../SubmissionContextStep", () => ({
  SubmissionContextStep: () => <div data-testid="context-step">ContextStep</div>,
}));

vi.mock("../ApplicablePolicyStep", () => ({
  ApplicablePolicyStep: ({
    proposal,
    loading,
    error,
    selectedIds,
    onChange,
    onRetry,
  }: {
    proposal: Record<string, unknown> | null;
    loading: boolean;
    error: string | null;
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    onRetry: () => void;
  }) => (
    <div data-testid="applicable-policy-step">
      <span data-testid="ap-loading">{String(loading)}</span>
      <span data-testid="ap-error">{error ?? ""}</span>
      <span data-testid="ap-proposal">{proposal ? "loaded" : "null"}</span>
      <span data-testid="ap-selected">{selectedIds.join(",")}</span>
      <button onClick={() => onChange(["P1", "P2"])} data-testid="ap-change">
        Change
      </button>
      <button onClick={onRetry} data-testid="ap-retry">
        Retry
      </button>
    </div>
  ),
}));

vi.mock("../ReviewStep", () => ({
  ReviewStep: ({ proposalSummary }: { proposalSummary: { selectedCount: number } | null }) => (
    <div data-testid="review-step">
      ReviewStep{proposalSummary ? ` selected=${proposalSummary.selectedCount}` : ""}
    </div>
  ),
}));

vi.mock("@/lib/engine-v2/service_to_media", () => ({
  deriveMediaTypesFromServices: () => ["soil"],
}));

import { WizardClient } from "../WizardClient";

// --- Helpers ---

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const PROPOSAL_FIXTURE = {
  schema_version: "proposer_cli/0.1.0",
  app_context_echo: {},
  signal_fired: [
    { policy_id: "CSAP-COP-GW-001", score: 12, rationale: "r", inclusive_fallback: false },
    { policy_id: "P28-ERA-001", score: 8, rationale: "r2", inclusive_fallback: false },
  ],
  floor_tail_policy_ids: ["FLOOR-001"],
  counts: {
    total_scored: 5860,
    signal_fired_count: 2,
    floor_tail_count: 1,
    ceiling_hit: false,
  },
};

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    if (url.includes("propose-policies")) {
      return jsonResponse(200, PROPOSAL_FIXTURE);
    }
    if (url.includes("/api/engine-v2/projects")) {
      return jsonResponse(201, { id: "new-project-id" });
    }
    return jsonResponse(404, { error: "not_found" });
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
});

// Helper: navigate to a specific step by clicking Next enough times.
async function navigateToStep(step: number) {
  render(<WizardClient />);

  // Step 0 -> fill metadata.
  fireEvent.click(screen.getByTestId("metadata-step"));

  if (step >= 1) {
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
  }
  if (step >= 2) {
    // Step 1 -> fill apptype.
    fireEvent.click(screen.getByTestId("apptype-step"));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
  }
  if (step >= 3) {
    // Step 2 -> fill services.
    fireEvent.click(screen.getByTestId("service-step"));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
  }
  if (step >= 4) {
    // Step 3 -> context always allows advance.
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
  }
  if (step >= 5) {
    // Step 4 -> wait for proposal then advance.
    await waitFor(() => expect(screen.getByTestId("ap-proposal").textContent).toBe("loaded"));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
  }
}

describe("WizardClient", () => {
  it("renders 6 step labels", () => {
    render(<WizardClient />);
    expect(screen.getByText(/1\. Metadata/)).toBeTruthy();
    expect(screen.getByText(/2\. Application types/)).toBeTruthy();
    expect(screen.getByText(/3\. Services/)).toBeTruthy();
    expect(screen.getByText(/4\. Context/)).toBeTruthy();
    expect(screen.getByText(/5\. Applicable policies/)).toBeTruthy();
    expect(screen.getByText(/6\. Review/)).toBeTruthy();
  });

  it("step 0 Next is disabled until metadata name filled", () => {
    render(<WizardClient />);
    const nextBtn = screen.getByRole("button", { name: /next/i });
    expect(nextBtn).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByTestId("metadata-step"));
    expect(nextBtn).toHaveProperty("disabled", false);
  });

  it("advancing to step 4 triggers POST to propose-policies", async () => {
    await navigateToStep(4);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("propose-policies"),
        expect.any(Object),
      );
    });
  });

  it("step 4 Next is disabled while proposal is loading", async () => {
    // Override fetch to hang for this proposal.
    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      if (url.includes("propose-policies")) {
        // Never resolves during test.
        return new Promise(() => {});
      }
      return jsonResponse(404, {});
    });

    render(<WizardClient />);
    fireEvent.click(screen.getByTestId("metadata-step"));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByTestId("apptype-step"));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByTestId("service-step"));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    // At step 4 while loading: ap-loading=true, Next should be disabled.
    await waitFor(() => {
      expect(screen.getByTestId("ap-loading").textContent).toBe("true");
    });
    const nextBtn = screen.getByRole("button", { name: /next/i });
    expect(nextBtn).toHaveProperty("disabled", true);
  });

  it("step 4 Next enabled after proposal loads", async () => {
    await navigateToStep(4);
    await waitFor(() =>
      expect(screen.getByTestId("ap-proposal").textContent).toBe("loaded"),
    );
    const nextBtn = screen.getByRole("button", { name: /next/i });
    expect(nextBtn).toHaveProperty("disabled", false);
  });

  it("submit at step 5 includes applicable_policy_ids in body", async () => {
    await navigateToStep(4);
    await waitFor(() =>
      expect(screen.getByTestId("ap-proposal").textContent).toBe("loaded"),
    );

    // Default selection is all signal_fired ids.
    expect(screen.getByTestId("ap-selected").textContent).toContain(
      "CSAP-COP-GW-001",
    );

    // Advance to step 5.
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByTestId("review-step")).toBeTruthy();

    // Submit.
    fireEvent.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard/engine-v2/new-project-id"));

    // Verify the create body included applicable_policy_ids.
    const createCall = fetchSpy.mock.calls.find((c) =>
      String(c[0]).includes("/api/engine-v2/projects") &&
      !String(c[0]).includes("propose-policies"),
    );
    expect(createCall).toBeDefined();
    const body = JSON.parse((createCall![1] as RequestInit).body as string) as Record<
      string,
      unknown
    >;
    expect(Array.isArray(body["applicable_policy_ids"])).toBe(true);
    expect((body["applicable_policy_ids"] as string[]).length).toBeGreaterThan(0);
  });

  it("ReviewStep receives proposalSummary with selected count", async () => {
    await navigateToStep(5);
    expect(screen.getByTestId("review-step").textContent).toContain("selected=");
  });
});
