// engine_v2 frontend Lane 2d / Phase D: AskAiTab tests.
//
// Covers:
//   - On mount: fetches /indexing-status and /chat/models in parallel.
//   - status='complete' enables the input; the mode selector toggles
//     fast/thinking and persists via useSidePanelState.
//   - status='error' renders the retry CTA that POSTs /reindex and
//     re-fetches /indexing-status.
//   - status='absent' renders the "no chunks indexed yet" hint.
//   - Submit posts to /chat with the correct body; SSE citation +
//     delta events render in the message list.
//   - Indigenous-flagged citation renders the NEUTRAL "Indigenous uses
//     content" badge.
//   - Cancel during streaming aborts the in-flight fetch.
//   - Model status chip availability dots reflect /chat/models.
//
// ASCII only.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

import { AskAiTab } from "../AskAiTab";
import { SidePanelProvider } from "../SidePanelContext";

const EVAL_ID = "11111111-2222-3333-4444-555555555555";

interface FetchCall {
  url: string;
  init?: RequestInit;
}

type Handler = (
  url: string,
  init?: RequestInit,
) => Promise<Response> | Response;

let calls: FetchCall[] = [];
let handler: Handler | null = null;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Build an SSE response body that emits the given lines (each a
// `event: X\ndata: Y\n\n` chunk).
function sseResponse(frames: Array<{ event: string; data: unknown }>): Response {
  const body = frames
    .map((f) => `event: ${f.event}\ndata: ${JSON.stringify(f.data)}\n\n`)
    .join("");
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

beforeEach(() => {
  calls = [];
  handler = null;
  vi.spyOn(global, "fetch").mockImplementation(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      calls.push({ url, init });
      if (!handler) {
        // Default: pretend everything is missing so nothing crashes.
        if (url.includes("/indexing-status")) {
          return Promise.resolve(jsonResponse({ status: "absent" }));
        }
        if (url.includes("/chat/models")) {
          return Promise.resolve(
            jsonResponse({
              fast: { model_id: "gemma4:e4b", available: false },
              thinking: {
                model_id: "qwen2.5:14b-instruct-q4_K_M",
                available: false,
              },
            }),
          );
        }
        return Promise.resolve(jsonResponse({ error: "not_handled" }, 500));
      }
      return Promise.resolve(handler(url, init));
    },
  );
  if (typeof window !== "undefined") {
    window.localStorage.clear();
  }
});
afterEach(() => {
  vi.restoreAllMocks();
});

function renderWithProvider() {
  return render(
    <SidePanelProvider>
      <AskAiTab evaluationId={EVAL_ID} />
    </SidePanelProvider>,
  );
}

describe("AskAiTab", () => {
  it("renders the loading placeholder before indexing-status resolves", async () => {
    let resolveStatus: ((r: Response) => void) | null = null;
    handler = (url) => {
      if (url.includes("/indexing-status")) {
        return new Promise<Response>((res) => {
          resolveStatus = res;
        });
      }
      if (url.includes("/chat/models")) {
        return jsonResponse({
          fast: { model_id: "gemma4:e4b", available: true },
          thinking: {
            model_id: "qwen2.5:14b-instruct-q4_K_M",
            available: true,
          },
        });
      }
      return jsonResponse({ error: "not_handled" }, 500);
    };
    renderWithProvider();
    expect(screen.getByTestId("ask-ai-status-loading")).toBeInTheDocument();
    await act(async () => {
      resolveStatus?.(jsonResponse({ status: "complete" }));
    });
    await waitFor(() =>
      expect(screen.queryByTestId("ask-ai-status-loading")).toBeNull(),
    );
  });

  it("status='complete' enables the input and shows the empty-state hint", async () => {
    handler = (url) => {
      if (url.includes("/indexing-status")) {
        return jsonResponse({ status: "complete" });
      }
      if (url.includes("/chat/models")) {
        return jsonResponse({
          fast: { model_id: "gemma4:e4b", available: true },
          thinking: {
            model_id: "qwen2.5:14b-instruct-q4_K_M",
            available: true,
          },
        });
      }
      return jsonResponse({ error: "not_handled" }, 500);
    };
    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId("ask-ai-input")).not.toBeDisabled(),
    );
  });

  it("status='error' renders the retry CTA; clicking it POSTs /reindex and re-fetches status", async () => {
    let indexingCalls = 0;
    handler = (url, init) => {
      if (url.includes("/indexing-status")) {
        indexingCalls += 1;
        if (indexingCalls === 1) {
          return jsonResponse({
            status: "error",
            error_message: "extract failed",
          });
        }
        return jsonResponse({ status: "complete" });
      }
      if (url.includes("/reindex")) {
        expect(init?.method).toBe("POST");
        return jsonResponse({ ok: true });
      }
      if (url.includes("/chat/models")) {
        return jsonResponse({
          fast: { model_id: "gemma4:e4b", available: true },
          thinking: {
            model_id: "qwen2.5:14b-instruct-q4_K_M",
            available: true,
          },
        });
      }
      return jsonResponse({ error: "not_handled" }, 500);
    };
    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId("ask-ai-status-error")).toBeInTheDocument(),
    );
    const retry = screen.getByTestId("ask-ai-retry-button");
    fireEvent.click(retry);
    await waitFor(() =>
      expect(screen.queryByTestId("ask-ai-status-error")).toBeNull(),
    );
    expect(calls.some((c) => c.url.includes("/reindex"))).toBe(true);
  });

  it("status='absent' renders the no-chunks hint", async () => {
    handler = (url) => {
      if (url.includes("/indexing-status")) {
        return jsonResponse({ status: "absent" });
      }
      if (url.includes("/chat/models")) {
        return jsonResponse({
          fast: { model_id: "gemma4:e4b", available: false },
          thinking: {
            model_id: "qwen2.5:14b-instruct-q4_K_M",
            available: false,
          },
        });
      }
      return jsonResponse({ error: "not_handled" }, 500);
    };
    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId("ask-ai-status-absent")).toBeInTheDocument(),
    );
  });

  it("mode selector toggles fast/thinking and persists via useSidePanelState", async () => {
    handler = (url) => {
      if (url.includes("/indexing-status")) {
        return jsonResponse({ status: "complete" });
      }
      if (url.includes("/chat/models")) {
        return jsonResponse({
          fast: { model_id: "gemma4:e4b", available: true },
          thinking: {
            model_id: "qwen2.5:14b-instruct-q4_K_M",
            available: true,
          },
        });
      }
      return jsonResponse({ error: "not_handled" }, 500);
    };
    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId("ask-ai-mode-fast")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("ask-ai-tab")).toHaveAttribute(
      "data-chat-mode",
      "fast",
    );
    fireEvent.click(screen.getByTestId("ask-ai-mode-thinking"));
    await waitFor(() =>
      expect(screen.getByTestId("ask-ai-tab")).toHaveAttribute(
        "data-chat-mode",
        "thinking",
      ),
    );
    // Verify localStorage persistence via the per-eval key.
    const key = `engine_v2.side_panel.per_eval.${EVAL_ID}`;
    const raw = window.localStorage.getItem(key);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.chatMode).toBe("thinking");
  });

  it("model status chips reflect availability dots from /chat/models", async () => {
    handler = (url) => {
      if (url.includes("/indexing-status")) {
        return jsonResponse({ status: "complete" });
      }
      if (url.includes("/chat/models")) {
        return jsonResponse({
          fast: { model_id: "gemma4:e4b", available: true },
          thinking: {
            model_id: "qwen2.5:14b-instruct-q4_K_M",
            available: false,
          },
        });
      }
      return jsonResponse({ error: "not_handled" }, 500);
    };
    renderWithProvider();
    await waitFor(() => {
      const fastChip = screen.queryByTestId("ask-ai-model-chip-fast");
      expect(fastChip).not.toBeNull();
    });
    expect(screen.getByTestId("ask-ai-model-chip-fast")).toHaveAttribute(
      "data-available",
      "true",
    );
    expect(screen.getByTestId("ask-ai-model-chip-thinking")).toHaveAttribute(
      "data-available",
      "false",
    );
  });

  it("submit sends a POST to /chat and renders citation + delta events", async () => {
    let chatBodyJson: string | null = null;
    handler = (url, init) => {
      if (url.includes("/indexing-status")) {
        return jsonResponse({ status: "complete" });
      }
      if (url.includes("/chat/models")) {
        return jsonResponse({
          fast: { model_id: "gemma4:e4b", available: true },
          thinking: {
            model_id: "qwen2.5:14b-instruct-q4_K_M",
            available: true,
          },
        });
      }
      if (url.endsWith("/chat")) {
        chatBodyJson = (init?.body as string) ?? null;
        return sseResponse([
          {
            event: "citation",
            data: {
              type: "chunk",
              evidence_item_id: "slice_a",
              source_chunk_id: "sc_a",
              section: "1.2 Site",
              page: 12,
              snippet: "arsenic exceedance",
              indigenous_flagged: false,
            },
          },
          { event: "delta", data: { text: "Hello " } },
          { event: "delta", data: { text: "world." } },
          {
            event: "meta",
            data: { model: "gemma4:e4b", mode: "fast", retrievalCount: 1 },
          },
          { event: "done", data: {} },
        ]);
      }
      return jsonResponse({ error: "not_handled" }, 500);
    };
    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId("ask-ai-input")).not.toBeDisabled(),
    );
    fireEvent.change(screen.getByTestId("ask-ai-input"), {
      target: { value: "arsenic exceedance in soil" },
    });
    fireEvent.click(screen.getByTestId("ask-ai-send-button"));

    await waitFor(() => {
      const messages = screen.queryAllByTestId(/ask-ai-message-/);
      expect(messages.length).toBeGreaterThanOrEqual(2);
    });

    // Assistant content rendered (Hello world.).
    await waitFor(() => {
      const messages = screen.getAllByTestId("ask-ai-message-assistant");
      expect(messages[messages.length - 1]!.textContent).toContain(
        "Hello world.",
      );
    });

    // Citation pill rendered.
    expect(
      screen.getByTestId("ask-ai-citation-chunk"),
    ).toHaveAttribute("data-evidence-item-id", "slice_a");

    // Body shape: mode=fast, history=[], query verbatim.
    expect(chatBodyJson).not.toBeNull();
    const parsed = JSON.parse(chatBodyJson!);
    expect(parsed.mode).toBe("fast");
    expect(parsed.query).toBe("arsenic exceedance in soil");
    expect(parsed.history).toEqual([]);
  });

  it("Indigenous-flagged citation renders the neutral 'Indigenous uses content' badge", async () => {
    handler = (url) => {
      if (url.includes("/indexing-status")) {
        return jsonResponse({ status: "complete" });
      }
      if (url.includes("/chat/models")) {
        return jsonResponse({
          fast: { model_id: "gemma4:e4b", available: true },
          thinking: {
            model_id: "qwen2.5:14b-instruct-q4_K_M",
            available: true,
          },
        });
      }
      if (url.endsWith("/chat")) {
        return sseResponse([
          {
            event: "citation",
            data: {
              type: "chunk",
              evidence_item_id: "slice_indi",
              source_chunk_id: null,
              section: "Traditional uses",
              page: 7,
              snippet: "garden",
              indigenous_flagged: true,
            },
          },
          { event: "delta", data: { text: "Garden evidence on p.7." } },
          { event: "done", data: {} },
        ]);
      }
      return jsonResponse({ error: "not_handled" }, 500);
    };
    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId("ask-ai-input")).not.toBeDisabled(),
    );
    fireEvent.change(screen.getByTestId("ask-ai-input"), {
      target: { value: "traditional gardens near the site" },
    });
    fireEvent.click(screen.getByTestId("ask-ai-send-button"));

    await waitFor(() =>
      expect(
        screen.getByTestId("ask-ai-citation-indigenous-badge"),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByTestId("ask-ai-citation-indigenous-badge"),
    ).toHaveTextContent("Indigenous uses content");

    // Verify the chat proceeded normally (no hard-stop, no
    // procedural-gate language injected by the client).
    const assistant = screen.getAllByTestId("ask-ai-message-assistant");
    expect(assistant[assistant.length - 1]!.textContent).toContain(
      "Garden evidence on p.7.",
    );
  });

  it("cancel button aborts the in-flight chat fetch", async () => {
    let abortSignalCaptured: AbortSignal | null = null;
    handler = (url, init) => {
      if (url.includes("/indexing-status")) {
        return jsonResponse({ status: "complete" });
      }
      if (url.includes("/chat/models")) {
        return jsonResponse({
          fast: { model_id: "gemma4:e4b", available: true },
          thinking: {
            model_id: "qwen2.5:14b-instruct-q4_K_M",
            available: true,
          },
        });
      }
      if (url.endsWith("/chat")) {
        abortSignalCaptured = init?.signal ?? null;
        // Return a never-resolving stream so the test can hit cancel.
        const stream = new ReadableStream({});
        return new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      return jsonResponse({ error: "not_handled" }, 500);
    };
    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId("ask-ai-input")).not.toBeDisabled(),
    );
    fireEvent.change(screen.getByTestId("ask-ai-input"), {
      target: { value: "hello" },
    });
    fireEvent.click(screen.getByTestId("ask-ai-send-button"));

    // Cancel button must appear once streaming starts.
    await waitFor(() =>
      expect(screen.getByTestId("ask-ai-cancel-button")).toBeInTheDocument(),
    );
    expect(abortSignalCaptured).not.toBeNull();
    expect(abortSignalCaptured!.aborted).toBe(false);

    fireEvent.click(screen.getByTestId("ask-ai-cancel-button"));
    await waitFor(() =>
      expect(abortSignalCaptured!.aborted).toBe(true),
    );
  });

  it("Enter submits; Shift+Enter inserts a newline (no submit)", async () => {
    let chatCalls = 0;
    handler = (url) => {
      if (url.includes("/indexing-status")) {
        return jsonResponse({ status: "complete" });
      }
      if (url.includes("/chat/models")) {
        return jsonResponse({
          fast: { model_id: "gemma4:e4b", available: true },
          thinking: {
            model_id: "qwen2.5:14b-instruct-q4_K_M",
            available: true,
          },
        });
      }
      if (url.endsWith("/chat")) {
        chatCalls += 1;
        return sseResponse([{ event: "done", data: {} }]);
      }
      return jsonResponse({ error: "not_handled" }, 500);
    };
    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId("ask-ai-input")).not.toBeDisabled(),
    );
    const input = screen.getByTestId("ask-ai-input");
    fireEvent.change(input, { target: { value: "first" } });

    // Shift+Enter: must NOT submit.
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(chatCalls).toBe(0);

    // Enter: must submit.
    fireEvent.change(input, { target: { value: "second" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(chatCalls).toBe(1));
  });
});
