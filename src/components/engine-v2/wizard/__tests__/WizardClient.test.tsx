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
    <>
      <button
        onClick={() => onChange(["era-review"])}
        data-testid="service-step"
      >
        ServiceTypeStep
      </button>
      {/* Emits a DIFFERENT service set so tests can change the proposer context. */}
      <button
        onClick={() => onChange(["hhra-review"])}
        data-testid="service-step-alt"
      >
        ServiceTypeStepAlt
      </button>
    </>
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
    activeBandMin,
    onBandChange,
  }: {
    proposal: Record<string, unknown> | null;
    loading: boolean;
    error: string | null;
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    onRetry: () => void;
    bandPresets: unknown[];
    activeBandMin: number;
    onBandChange: (min: number) => void;
  }) => (
    <div data-testid="applicable-policy-step">
      <span data-testid="ap-loading">{String(loading)}</span>
      <span data-testid="ap-error">{error ?? ""}</span>
      <span data-testid="ap-proposal">{proposal ? "loaded" : "null"}</span>
      <span data-testid="ap-selected">{selectedIds.join(",")}</span>
      <span data-testid="ap-band-min">{String(activeBandMin)}</span>
      <button onClick={() => onChange(["P1", "P2"])} data-testid="ap-change">
        Change
      </button>
      <button onClick={onRetry} data-testid="ap-retry">
        Retry
      </button>
      {/* Band-switch buttons used by band-preset tests. */}
      <button onClick={() => onBandChange(0)} data-testid="ap-band-all">
        Band-all
      </button>
      <button onClick={() => onBandChange(12)} data-testid="ap-band-12">
        Band-12
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

// Narrow structural spy type: ReturnType<typeof vi.spyOn> collapses to the
// wrong overload (constructor Mock) and fails CI's tsc --noEmit, and explicit
// spyOn generics fight the keyof-globalThis constraint. Only the members this
// file actually uses are typed; call args stay unknown[][] (use sites cast).
type FetchMockImpl = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;
type FetchSpy = {
  mockImplementation: (impl: FetchMockImpl) => unknown;
  mockRestore: () => void;
  mock: { calls: unknown[][] };
};
let fetchSpy: FetchSpy;

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

    // Default band is >=11 (CP3_DEFAULT_BAND_MIN). CSAP-COP-GW-001 has score 12
    // (>= 11) so it IS default-checked. P28-ERA-001 has score 8 (< 11) so it
    // is NOT default-checked (still visible/tickable -- recall guarantee).
    expect(screen.getByTestId("ap-selected").textContent).toContain(
      "CSAP-COP-GW-001",
    );
    expect(screen.getByTestId("ap-selected").textContent).not.toContain(
      "P28-ERA-001",
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

  // --- CP-3 score-band preset tests ---

  it("CP-3: default band >=11 checks only score>=11 entries on proposal load", async () => {
    // PROPOSAL_FIXTURE: CSAP-COP-GW-001 score=12 (>=11 -> checked),
    //                   P28-ERA-001 score=8 (<11 -> NOT checked).
    await navigateToStep(4);
    await waitFor(() =>
      expect(screen.getByTestId("ap-proposal").textContent).toBe("loaded"),
    );
    const selected = screen.getByTestId("ap-selected").textContent ?? "";
    expect(selected).toContain("CSAP-COP-GW-001");
    expect(selected).not.toContain("P28-ERA-001");
    // The active band min is passed to the step.
    expect(screen.getByTestId("ap-band-min").textContent).toBe("11");
  });

  it("CP-3: switching band to All-signal-fired (min=0) checks both entries", async () => {
    await navigateToStep(4);
    await waitFor(() =>
      expect(screen.getByTestId("ap-proposal").textContent).toBe("loaded"),
    );
    // Switch to min=0 (all signal-fired).
    fireEvent.click(screen.getByTestId("ap-band-all"));
    const selected = screen.getByTestId("ap-selected").textContent ?? "";
    expect(selected).toContain("CSAP-COP-GW-001");
    expect(selected).toContain("P28-ERA-001");
    expect(screen.getByTestId("ap-band-min").textContent).toBe("0");
  });

  it("CP-3: switching band to >=12 checks only the score-12 entry", async () => {
    await navigateToStep(4);
    await waitFor(() =>
      expect(screen.getByTestId("ap-proposal").textContent).toBe("loaded"),
    );
    // Switch to min=12.
    fireEvent.click(screen.getByTestId("ap-band-12"));
    const selected = screen.getByTestId("ap-selected").textContent ?? "";
    expect(selected).toContain("CSAP-COP-GW-001");
    expect(selected).not.toContain("P28-ERA-001");
    expect(screen.getByTestId("ap-band-min").textContent).toBe("12");
  });

  // --- P1 stale-cohort guard (codex ship-gate) ---

  it("(a) editing services after a proposal loads forces a refetch and disables Next until the new proposal lands", async () => {
    // Count propose-policies calls so we can prove a SECOND fetch fires.
    let proposeCalls = 0;
    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      if (url.includes("propose-policies")) {
        proposeCalls += 1;
        return jsonResponse(200, PROPOSAL_FIXTURE);
      }
      if (url.includes("/api/engine-v2/projects")) {
        return jsonResponse(201, { id: "new-project-id" });
      }
      return jsonResponse(404, { error: "not_found" });
    });

    await navigateToStep(4);
    await waitFor(() =>
      expect(screen.getByTestId("ap-proposal").textContent).toBe("loaded"),
    );
    expect(proposeCalls).toBe(1);
    // Next is enabled for the loaded proposal.
    expect(screen.getByRole("button", { name: /next/i })).toHaveProperty(
      "disabled",
      false,
    );

    // Go Back to step 2 (services) and change the service selection. This both
    // invalidates the proposal and changes the context key.
    fireEvent.click(screen.getByRole("button", { name: /back/i })); // -> step 3
    fireEvent.click(screen.getByRole("button", { name: /back/i })); // -> step 2
    fireEvent.click(screen.getByTestId("service-step-alt")); // services -> ["hhra-review"]

    // Forward again to step 4. The fetch-on-enter effect must refetch.
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 3
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 4

    await waitFor(() => expect(proposeCalls).toBe(2));
    // After the second proposal resolves, Next is enabled again for the NEW context.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /next/i })).toHaveProperty(
        "disabled",
        false,
      ),
    );
  });

  it("(b) a stale in-flight response (old context) is discarded; state holds the new context's proposal", async () => {
    // Two distinct proposals keyed by which service set is in the request body.
    // Use score=12 so entries are above the default band (>=11) and appear in
    // ap-selected, making the stale-discard assertions meaningful.
    const OLD_PROPOSAL = {
      ...PROPOSAL_FIXTURE,
      signal_fired: [
        { policy_id: "OLD-1", score: 12, rationale: "r", inclusive_fallback: false },
      ],
      counts: { ...PROPOSAL_FIXTURE.counts, signal_fired_count: 1 },
    };
    const NEW_PROPOSAL = {
      ...PROPOSAL_FIXTURE,
      signal_fired: [
        { policy_id: "NEW-1", score: 12, rationale: "r", inclusive_fallback: false },
      ],
      counts: { ...PROPOSAL_FIXTURE.counts, signal_fired_count: 1 },
    };

    // Deferred resolvers so we can control resolution ORDER: the OLD (era-review)
    // request resolves AFTER the NEW (hhra-review) request.
    let resolveOld: ((r: Response) => void) | null = null;
    let resolveNew: ((r: Response) => void) | null = null;

    fetchSpy.mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      if (url.includes("propose-policies")) {
        const body = JSON.parse(
          (init as RequestInit).body as string,
        ) as { selected_services: string[] };
        const isOld = body.selected_services.includes("era-review");
        return new Promise<Response>((resolve) => {
          if (isOld) resolveOld = resolve;
          else resolveNew = resolve;
        });
      }
      if (url.includes("/api/engine-v2/projects")) {
        return jsonResponse(201, { id: "new-project-id" });
      }
      return jsonResponse(404, { error: "not_found" });
    });

    // Navigate to step 4 with services=["era-review"] -> fires the OLD request (hangs).
    render(<WizardClient />);
    fireEvent.click(screen.getByTestId("metadata-step"));
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 1
    fireEvent.click(screen.getByTestId("apptype-step"));
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 2
    fireEvent.click(screen.getByTestId("service-step")); // services = ["era-review"]
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 3
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 4
    await waitFor(() => expect(resolveOld).not.toBeNull());

    // Go Back to step 2, change services -> ["hhra-review"] (invalidates + new key),
    // then forward to step 4 -> fires the NEW request (also hangs).
    fireEvent.click(screen.getByRole("button", { name: /back/i })); // -> step 3
    fireEvent.click(screen.getByRole("button", { name: /back/i })); // -> step 2
    fireEvent.click(screen.getByTestId("service-step-alt")); // services = ["hhra-review"]
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 3
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 4
    await waitFor(() => expect(resolveNew).not.toBeNull());

    // Resolve the NEW request first, then the OLD (stale) one AFTER.
    resolveNew!(jsonResponse(200, NEW_PROPOSAL));
    await waitFor(() =>
      expect(screen.getByTestId("ap-proposal").textContent).toBe("loaded"),
    );
    await waitFor(() =>
      expect(screen.getByTestId("ap-selected").textContent).toContain("NEW-1"),
    );

    // Now resolve the STALE old-context request. It must be DISCARDED.
    resolveOld!(jsonResponse(200, OLD_PROPOSAL));
    // Give microtasks a chance to (wrongly) apply the stale response.
    await Promise.resolve();
    await Promise.resolve();

    // State still holds the NEW context's proposal; OLD-1 never appears.
    expect(screen.getByTestId("ap-selected").textContent).toContain("NEW-1");
    expect(screen.getByTestId("ap-selected").textContent).not.toContain("OLD-1");
    // Next remains enabled for the current (new) context.
    expect(screen.getByRole("button", { name: /next/i })).toHaveProperty(
      "disabled",
      false,
    );
  });

  it("(c) editing services while a proposal is loaded blocks Next (gate requires matching context key)", async () => {
    // A propose-policies response that hangs forever so a refetch never lands;
    // the only way Next becomes enabled is a key-matching loaded proposal.
    let proposeCalls = 0;
    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      if (url.includes("propose-policies")) {
        proposeCalls += 1;
        // First call resolves; later calls hang (so post-edit refetch stays pending).
        if (proposeCalls === 1) return jsonResponse(200, PROPOSAL_FIXTURE);
        return new Promise(() => {});
      }
      if (url.includes("/api/engine-v2/projects")) {
        return jsonResponse(201, { id: "new-project-id" });
      }
      return jsonResponse(404, { error: "not_found" });
    });

    await navigateToStep(4);
    await waitFor(() =>
      expect(screen.getByTestId("ap-proposal").textContent).toBe("loaded"),
    );
    expect(screen.getByRole("button", { name: /next/i })).toHaveProperty(
      "disabled",
      false,
    );

    // Back to services, change selection (invalidates + changes key), return to step 4.
    fireEvent.click(screen.getByRole("button", { name: /back/i })); // -> step 3
    fireEvent.click(screen.getByRole("button", { name: /back/i })); // -> step 2
    fireEvent.click(screen.getByTestId("service-step-alt")); // services -> ["hhra-review"]
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 3
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 4

    // The refetch is pending (hangs); the gate must keep Next DISABLED because no
    // proposal matches the current context key.
    await waitFor(() => expect(proposeCalls).toBe(2));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /next/i })).toHaveProperty(
        "disabled",
        true,
      ),
    );
  });

  // --- P2 same-context overlapping-fetch guard (codex confirmation round) ---
  // Both requests share IDENTICAL selections, so the context-key guard cannot
  // distinguish them; the monotonic seq guard must ensure only the NEWEST settles.

  it("(p2a) same-context overlap: stale request A resolves with an ERROR first, then B with a proposal -> B wins, no error, Next enabled only after B", async () => {
    // Queue of deferred resolvers, one per propose-policies call (same context).
    const resolvers: Array<(r: Response) => void> = [];
    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      if (url.includes("propose-policies")) {
        return new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        });
      }
      if (url.includes("/api/engine-v2/projects")) {
        return jsonResponse(201, { id: "new-project-id" });
      }
      return jsonResponse(404, { error: "not_found" });
    });

    // Enter step 4 with services=["era-review"] -> fetch A (pending).
    render(<WizardClient />);
    fireEvent.click(screen.getByTestId("metadata-step"));
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 1
    fireEvent.click(screen.getByTestId("apptype-step"));
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 2
    fireEvent.click(screen.getByTestId("service-step")); // services = ["era-review"]
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 3
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 4
    await waitFor(() => expect(resolvers.length).toBe(1)); // A pending

    // Leave step 4 (Back to step 3) and re-enter with IDENTICAL selections -> fetch B.
    fireEvent.click(screen.getByRole("button", { name: /back/i })); // -> step 3
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 4
    await waitFor(() => expect(resolvers.length).toBe(2)); // B pending; same context

    // Resolve the STALE A with an ERROR first. The seq guard must DISCARD it:
    // no error must surface, and the spinner must NOT be cleared by A.
    resolvers[0]!(jsonResponse(500, { error: "stale_boom" }));
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.getByTestId("ap-error").textContent).toBe("");
    expect(screen.getByTestId("ap-proposal").textContent).toBe("null");
    // Next still disabled (B is the only valid fetch and is still pending).
    expect(screen.getByRole("button", { name: /next/i })).toHaveProperty(
      "disabled",
      true,
    );

    // Now resolve B with the real proposal.
    resolvers[1]!(jsonResponse(200, PROPOSAL_FIXTURE));
    await waitFor(() =>
      expect(screen.getByTestId("ap-proposal").textContent).toBe("loaded"),
    );
    expect(screen.getByTestId("ap-error").textContent).toBe("");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /next/i })).toHaveProperty(
        "disabled",
        false,
      ),
    );
  });

  it("(p2b) same-context overlap: stale request A resolves AFTER B with a different payload -> B's payload retained", async () => {
    // Use score=12 so entries are above the default band (>=11) and appear in
    // ap-selected, making the stale-discard assertions meaningful.
    const A_PAYLOAD = {
      ...PROPOSAL_FIXTURE,
      signal_fired: [
        { policy_id: "A-STALE-1", score: 12, rationale: "r", inclusive_fallback: false },
      ],
      counts: { ...PROPOSAL_FIXTURE.counts, signal_fired_count: 1 },
    };
    const B_PAYLOAD = {
      ...PROPOSAL_FIXTURE,
      signal_fired: [
        { policy_id: "B-FRESH-1", score: 12, rationale: "r", inclusive_fallback: false },
      ],
      counts: { ...PROPOSAL_FIXTURE.counts, signal_fired_count: 1 },
    };

    const resolvers: Array<(r: Response) => void> = [];
    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      if (url.includes("propose-policies")) {
        return new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        });
      }
      if (url.includes("/api/engine-v2/projects")) {
        return jsonResponse(201, { id: "new-project-id" });
      }
      return jsonResponse(404, { error: "not_found" });
    });

    render(<WizardClient />);
    fireEvent.click(screen.getByTestId("metadata-step"));
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 1
    fireEvent.click(screen.getByTestId("apptype-step"));
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 2
    fireEvent.click(screen.getByTestId("service-step")); // services = ["era-review"]
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 3
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 4
    await waitFor(() => expect(resolvers.length).toBe(1)); // A pending

    // Re-enter with identical selections -> B (same context).
    fireEvent.click(screen.getByRole("button", { name: /back/i })); // -> step 3
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // -> step 4
    await waitFor(() => expect(resolvers.length).toBe(2)); // B pending

    // B resolves first (becomes the loaded proposal).
    resolvers[1]!(jsonResponse(200, B_PAYLOAD));
    await waitFor(() =>
      expect(screen.getByTestId("ap-selected").textContent).toContain("B-FRESH-1"),
    );

    // A (stale, superseded) resolves AFTER with a different payload -> must be ignored.
    resolvers[0]!(jsonResponse(200, A_PAYLOAD));
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.getByTestId("ap-selected").textContent).toContain("B-FRESH-1");
    expect(screen.getByTestId("ap-selected").textContent).not.toContain("A-STALE-1");
    expect(screen.getByRole("button", { name: /next/i })).toHaveProperty(
      "disabled",
      false,
    );
  });
});
