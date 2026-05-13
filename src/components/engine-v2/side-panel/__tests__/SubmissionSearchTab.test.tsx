// engine_v2 Lane 2d / Phase C: SubmissionSearchTab tests.
//
// Covers:
//   - On mount, fetches /indexing-status; renders loading then transitions.
//   - status='complete' enables the input and runs a debounced search on
//     input change; results render with <mark> highlight + Indigenous
//     content-type badge + cited-by badge.
//   - status='error' renders the retry CTA; clicking it POSTs to
//     /reindex then re-fetches /indexing-status.
//   - status='absent' renders the backwards-compat "no indexed chunks"
//     hint with the input disabled.
//   - Clicking a result invokes openPeek via SidePanelContext with the
//     evidence_item_id shape.
//   - Empty results render "No matches for that query."
//   - The Indigenous badge label is the neutral "Indigenous uses content"
//     (no procedural / consultation language).
//
// ASCII only.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
// `act` is still used inside the retry-CTA test for the click handler that
// triggers a state transition synchronously plus a post-click re-fetch.
import React from "react";

import { SubmissionSearchTab } from "../SubmissionSearchTab";
import { SidePanelProvider } from "../SidePanelContext";
import * as sidePanelCtx from "../SidePanelContext";

const EVAL_ID = "11111111-2222-3333-4444-555555555555";

// Helpers around the global fetch mock.
type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>;

function jsonResponse(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let fetchHandler: FetchHandler | null = null;
beforeEach(() => {
  fetchHandler = null;
  vi.spyOn(global, "fetch").mockImplementation(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (!fetchHandler) {
        return Promise.resolve(jsonResponse({ status: "absent" }));
      }
      return fetchHandler(url, init);
    },
  );
  // Defensive localStorage reset.
  if (typeof window !== "undefined") {
    window.localStorage.clear();
  }
});
afterEach(() => {
  vi.restoreAllMocks();
});

function renderWithProvider(): ReturnType<typeof render> {
  return render(
    <SidePanelProvider>
      <SubmissionSearchTab evaluationId={EVAL_ID} />
    </SidePanelProvider>,
  );
}

describe("SubmissionSearchTab", () => {
  it("renders the loading placeholder before indexing-status resolves", async () => {
    let resolveStatus: ((r: Response) => void) | null = null;
    fetchHandler = (url) => {
      if (url.includes("/indexing-status")) {
        return new Promise<Response>((resolve) => {
          resolveStatus = resolve;
        });
      }
      return Promise.resolve(jsonResponse({ status: "absent" }));
    };
    renderWithProvider();
    expect(
      screen.getByTestId("submission-search-status-loading"),
    ).toBeTruthy();
    // Release the in-flight fetch so the unmount cleanup doesn't leak.
    await act(async () => {
      resolveStatus?.(jsonResponse({ status: "complete" }));
    });
  });

  it("status='complete' enables the input and a debounced search renders results with <mark> + badges", async () => {
    fetchHandler = (url) => {
      if (url.includes("/indexing-status")) {
        return Promise.resolve(jsonResponse({ status: "complete" }));
      }
      if (url.includes("/submission/search")) {
        return Promise.resolve(
          jsonResponse({
            query: "arsenic",
            count: 1,
            results: [
              {
                evidence_item_id: "slice_aaa",
                snippet:
                  "Arsenic concentrations in the upper <mark>arsenic</mark> soil exceeded the guideline.",
                section: "1.2 Site",
                page: 12,
                indigenous_flagged: true,
                cited_by_count: 3,
              },
            ],
          }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    };

    renderWithProvider();
    // Wait for status load.
    await waitFor(() =>
      expect(screen.queryByTestId("submission-search-status-loading"))
        .toBeFalsy(),
    );
    const input = screen.getByTestId(
      "submission-search-input",
    ) as HTMLInputElement;
    expect(input.disabled).toBe(false);
    fireEvent.change(input, { target: { value: "arsenic" } });
    // Wait for the 250ms debounce to fire and the search to render.
    await waitFor(
      () =>
        expect(screen.queryByTestId("submission-search-results"))
          .toBeTruthy(),
      { timeout: 2000 },
    );
    // Snippet renders with <mark>.
    const result = screen.getByTestId("submission-search-result");
    expect(result.innerHTML).toContain("<mark>");
    // Indigenous content-type badge uses the neutral label.
    const ind = screen.getByTestId("submission-search-indigenous-badge");
    expect(ind.textContent).toBe("Indigenous uses content");
    // Crucial: no procedural language anywhere on the page.
    const html = document.body.innerHTML;
    expect(html.includes("SDM determination")).toBe(false);
    expect(html.includes("requires professional judgment")).toBe(false);
    expect(html.includes("Section 35")).toBe(false);
    expect(html.includes("DRIPA")).toBe(false);
    // Cited-by badge shows the count.
    const cited = screen.getByTestId("submission-search-cited-by-badge");
    expect(cited.textContent).toContain("3");
  });

  it("status='error' renders the retry CTA; clicking it POSTs to /reindex then re-fetches status", async () => {
    // First /indexing-status -> error; /reindex -> 200; second /indexing-status -> complete.
    let statusCalls = 0;
    let reindexCalls = 0;
    let reindexInit: RequestInit | undefined;
    fetchHandler = (url, init) => {
      if (url.includes("/indexing-status")) {
        statusCalls += 1;
        if (statusCalls === 1) {
          return Promise.resolve(
            jsonResponse({
              status: "error",
              error_message: "rpc_failure: connection_lost",
            }),
          );
        }
        return Promise.resolve(jsonResponse({ status: "complete" }));
      }
      if (url.includes("/reindex")) {
        reindexCalls += 1;
        reindexInit = init;
        return Promise.resolve(
          jsonResponse({ status: "complete", chunk_rows: 5 }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    };
    renderWithProvider();
    await waitFor(() =>
      expect(screen.queryByTestId("submission-search-status-error"))
        .toBeTruthy(),
    );
    const cta = screen.getByTestId("submission-search-retry-button");
    expect(cta.textContent).toContain("Retry indexing");
    // Error message visible.
    expect(document.body.innerHTML).toContain("rpc_failure: connection_lost");
    await act(async () => {
      fireEvent.click(cta);
    });
    expect(reindexCalls).toBe(1);
    // IMPORTANT 2 (Round 2): assert method + Content-Type header so a
    // future refactor that drops the JSON content-type header is caught.
    expect(reindexInit?.method).toBe("POST");
    const headers = reindexInit?.headers as Record<string, string> | undefined;
    expect(headers).toBeTruthy();
    expect(headers!["Content-Type"]).toBe("application/json");
    // After retry, status re-fetched and now complete -> input enabled.
    await waitFor(() => {
      const input = screen.queryByTestId(
        "submission-search-input",
      ) as HTMLInputElement | null;
      expect(input).toBeTruthy();
      expect(input!.disabled).toBe(false);
    });
    expect(statusCalls).toBeGreaterThanOrEqual(2);
  });

  it("status='absent' renders the backwards-compat hint and disables the input", async () => {
    fetchHandler = (url) => {
      if (url.includes("/indexing-status")) {
        return Promise.resolve(jsonResponse({ status: "absent" }));
      }
      return Promise.resolve(jsonResponse({}));
    };
    renderWithProvider();
    await waitFor(() =>
      expect(screen.queryByTestId("submission-search-status-absent"))
        .toBeTruthy(),
    );
    const input = screen.getByTestId(
      "submission-search-input",
    ) as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it("renders 'No matches for that query.' when search returns 0 results", async () => {
    fetchHandler = (url) => {
      if (url.includes("/indexing-status")) {
        return Promise.resolve(jsonResponse({ status: "complete" }));
      }
      if (url.includes("/submission/search")) {
        return Promise.resolve(
          jsonResponse({ query: "zzz", count: 0, results: [] }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    };
    renderWithProvider();
    await waitFor(() =>
      expect(screen.queryByTestId("submission-search-status-loading"))
        .toBeFalsy(),
    );
    const input = screen.getByTestId(
      "submission-search-input",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "zzz" } });
    await waitFor(
      () =>
        expect(screen.queryByTestId("submission-search-empty"))
          .toBeTruthy(),
      { timeout: 2000 },
    );
  });

  it("clicking a result invokes openPeek via SidePanelContext with the evidence_item_id shape", async () => {
    fetchHandler = (url) => {
      if (url.includes("/indexing-status")) {
        return Promise.resolve(jsonResponse({ status: "complete" }));
      }
      if (url.includes("/submission/search")) {
        return Promise.resolve(
          jsonResponse({
            query: "foo",
            count: 1,
            results: [
              {
                evidence_item_id: "slice_xyz",
                snippet: "<mark>foo</mark> sample text",
                section: "S",
                page: 7,
                indigenous_flagged: false,
                cited_by_count: 0,
              },
            ],
          }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    };

    // Spy on useSidePanel().openPeek by wrapping the provider value.
    const openPeek = vi.fn();
    const useSidePanelSpy = vi.spyOn(sidePanelCtx, "useSidePanel");
    useSidePanelSpy.mockReturnValue({
      pendingHighlight: null,
      setPendingHighlight: vi.fn(),
      openPeek,
      closePeek: vi.fn(),
      peekChunk: null,
    });

    render(<SubmissionSearchTab evaluationId={EVAL_ID} />);

    await waitFor(() =>
      expect(screen.queryByTestId("submission-search-status-loading"))
        .toBeFalsy(),
    );
    const input = screen.getByTestId(
      "submission-search-input",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "foo" } });
    await waitFor(
      () =>
        expect(screen.queryByTestId("submission-search-result"))
          .toBeTruthy(),
      { timeout: 2000 },
    );
    const row = screen.getByTestId("submission-search-result");
    fireEvent.click(row);
    expect(openPeek).toHaveBeenCalledTimes(1);
    expect(openPeek.mock.calls[0]![0]).toMatchObject({
      evidenceItemId: "slice_xyz",
      docSection: "S",
      pageNum: 7,
    });
  });

  // Round 2 MINOR 3: status='pending' / 'running' both render the
  // indexing placeholder with the input disabled.
  it("status='pending' renders the indexing placeholder and disables the input", async () => {
    fetchHandler = (url) => {
      if (url.includes("/indexing-status")) {
        return Promise.resolve(jsonResponse({ status: "pending" }));
      }
      return Promise.resolve(jsonResponse({}));
    };
    renderWithProvider();
    await waitFor(() =>
      expect(screen.queryByTestId("submission-search-status-indexing"))
        .toBeTruthy(),
    );
    const input = screen.getByTestId(
      "submission-search-input",
    ) as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it("status='running' renders the indexing placeholder and disables the input", async () => {
    fetchHandler = (url) => {
      if (url.includes("/indexing-status")) {
        return Promise.resolve(jsonResponse({ status: "running" }));
      }
      return Promise.resolve(jsonResponse({}));
    };
    renderWithProvider();
    await waitFor(() =>
      expect(screen.queryByTestId("submission-search-status-indexing"))
        .toBeTruthy(),
    );
    const input = screen.getByTestId(
      "submission-search-input",
    ) as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  // Round 2 MINOR 3: load-failed renders a clear error, not a blank pane.
  it("load-failed status renders a clear error message (not a blank screen)", async () => {
    fetchHandler = (url) => {
      if (url.includes("/indexing-status")) {
        return Promise.resolve(
          jsonResponse({ error: "internal_error" }, 500),
        );
      }
      return Promise.resolve(jsonResponse({}));
    };
    renderWithProvider();
    await waitFor(() =>
      expect(
        screen.queryByTestId("submission-search-status-load-failed"),
      ).toBeTruthy(),
    );
    const panel = screen.getByTestId("submission-search-status-load-failed");
    expect(panel.textContent ?? "").toContain("Could not load indexing status");
    expect(panel.textContent ?? "").toContain("internal_error");
  });

  // Round 2 MINOR 3: last query restores from localStorage on remount.
  it("restores the last query from localStorage on remount", async () => {
    // Seed the per-eval localStorage entry with the schema
    // useSidePanelState expects.
    const KEY = `engine_v2.side_panel.per_eval.${EVAL_ID}`;
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        open: true,
        activeTab: "search-sub",
        lastQueryPerTab: { "search-sub": "arsenic" },
        chatMode: "fast",
      }),
    );
    fetchHandler = (url) => {
      if (url.includes("/indexing-status")) {
        return Promise.resolve(jsonResponse({ status: "complete" }));
      }
      if (url.includes("/submission/search")) {
        return Promise.resolve(
          jsonResponse({ query: "arsenic", count: 0, results: [] }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    };
    renderWithProvider();
    await waitFor(() => {
      const input = screen.queryByTestId(
        "submission-search-input",
      ) as HTMLInputElement | null;
      expect(input).toBeTruthy();
      // After the hydration effect fires, the input reflects the
      // persisted value.
      expect(input!.value).toBe("arsenic");
    });
  });

  // Round 2 BLOCKER regression: stable deps mean ONE settled
  // /submission/search request per query, even across many re-renders
  // of the hook's returned object (which has a fresh identity each
  // render). The old code captured the whole panelState in runSearch's
  // dep array and could fire the search repeatedly.
  it("BLOCKER regression: a single typed query produces exactly one /submission/search call", async () => {
    let searchCalls = 0;
    fetchHandler = (url) => {
      if (url.includes("/indexing-status")) {
        return Promise.resolve(jsonResponse({ status: "complete" }));
      }
      if (url.includes("/submission/search")) {
        searchCalls += 1;
        return Promise.resolve(
          jsonResponse({
            query: "arsenic",
            count: 0,
            results: [],
          }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    };
    renderWithProvider();
    await waitFor(() =>
      expect(screen.queryByTestId("submission-search-status-loading"))
        .toBeFalsy(),
    );
    const input = screen.getByTestId(
      "submission-search-input",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "arsenic" } });
    // Wait past the debounce and let the empty-results state settle.
    await waitFor(
      () =>
        expect(screen.queryByTestId("submission-search-empty"))
          .toBeTruthy(),
      { timeout: 2000 },
    );
    // Give the event loop several ticks to surface any leftover
    // scheduling churn from a fresh-object hook dep.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(searchCalls).toBe(1);
  });
});
