// engine_v2 frontend Lane 2d / Phase D: SSE chat route.
//
// POST /api/engine-v2/evaluations/[evalId]/chat
//
// Streams a grounded chat response over server-sent events. Two modes
// (fast / thinking) drive the system prompt and the resolved Ollama
// model via the user-editable scaffolding files:
//   - chat-prompts.ts (FAST_MODE_PROMPT / THINKING_MODE_PROMPT)
//   - chat-model-registry.ts (MODE_TO_MODEL)
//
// Retrieval (parallels Phase C):
//   - Submission axis (PRIMARY, async): search_submission_chunks RPC.
//   - Policy axis (SECONDARY, sync): policy_kb.searchPolicies({limit:3})
//     when the query looks policy-grounded.
//
// SCOPE LOCK (feedback_no_tier_judgment_for_ai, 2026-05-12, HIGH
// AUTHORITY): the AI surface is an evidence-finder, NOT a tier-judge,
// NOT a procedural-gate. This route therefore has:
//   - NO detectIndigenousContent import (none).
//   - NO INDIGENOUS_HARD_STOP import (none).
//   - NO submission_indigenous_keywords import (that module is indexer-
//     only).
//   - NO banned-phrase post-filter on the SSE delta stream. Whatever
//     Ollama emits, the route passes through unchanged. This is
//     verified by an explicit regression test:
//       "chat route does NOT post-filter procedural phrases from Ollama
//        output (regression guard for v0.3 banned-phrase classifier
//        removal)"
//   - NO TIER_2 / TIER_3 strings in the system prompt (the prompt is
//     loaded by name from chat-prompts.ts).
//
// Resource discipline:
//   - request.signal propagates to the upstream Ollama fetch via a
//     manually-wired AbortController. The connect-timeout setTimeout is
//     CLEARED as soon as fetch() resolves so a healthy long stream is
//     not aborted at the connect deadline. The request.signal listener
//     is removed in finally to avoid leaks.
//   - Idle timeout (per-chunk) uses AbortSignal.timeout in the reader
//     race loop and is independent of the connect timeout.
//   - AbortSignal.any is NOT used (needs Node 20.3+; engines floor is
//     20.0). The manual AbortController + listener pattern is portable.
//   - try/finally on the Ollama reader loop calls reader.cancel() and
//     controller.close() on any throw.
//   - History is capped at 10 turns server-side regardless of client
//     input.
//
// ASCII only.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { requireLocalEngine } from "@/lib/api-guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import { getOllamaBaseUrl } from "@/lib/ollama/model-registry";
import {
  getOllamaTags,
} from "@/lib/engine-v2/ollama_tags_cache";
import {
  MODE_TO_MODEL,
  resolveChatModel,
} from "@/lib/engine-v2/chat-model-registry";
import { getSystemPrompt } from "@/lib/engine-v2/chat-prompts";
import {
  retrievePolicyMatches,
  retrieveSubmissionChunks,
  shouldUsePolicyAxis,
  type PolicyCitation,
  type SubmissionChunkCitation,
} from "@/lib/engine-v2/chat_retrieval";

export const runtime = "nodejs";

// --- Constants ---

const SUBMISSION_CHUNK_LIMIT = 6;
const POLICY_LIMIT = 3;
const HISTORY_MAX_TURNS = 10;
const QUERY_MAX_LEN = 4_000;
const QUERY_MIN_LEN = 1;
const OLLAMA_CONNECT_TIMEOUT_MS = 10_000;
const OLLAMA_IDLE_TIMEOUT_MS = 60_000;

// --- Schema ---

const historyTurnSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(QUERY_MAX_LEN),
  })
  .strict();

const chatBodySchema = z
  .object({
    query: z.string().min(QUERY_MIN_LEN).max(QUERY_MAX_LEN),
    mode: z.enum(["fast", "thinking"]),
    history: z.array(historyTurnSchema).max(HISTORY_MAX_TURNS).optional(),
  })
  .strict();

type ChatBody = z.infer<typeof chatBodySchema>;

// --- SSE helpers ---

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;

function sseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function singleEventStream(event: string, data: Record<string, unknown>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sseEvent(event, data)));
      if (event !== "done") {
        controller.enqueue(encoder.encode(sseEvent("done", {})));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

// --- Context formatting ---

function formatCitationsForPrompt(
  chunks: SubmissionChunkCitation[],
  policies: PolicyCitation[],
): string {
  const parts: string[] = [];
  if (chunks.length > 0) {
    parts.push("Submission excerpts:");
    chunks.forEach((c, i) => {
      const ref =
        c.page !== null
          ? `${c.section} - p.${c.page}`
          : c.section;
      parts.push(
        `[S${i + 1}] (${c.evidence_item_id}; ${ref}):\n${c.snippet.replace(/<\/?mark>/g, "")}`,
      );
    });
  }
  if (policies.length > 0) {
    parts.push("\nPolicy KB excerpts:");
    policies.forEach((p, i) => {
      const ref = p.source ?? "source unknown";
      parts.push(`[P${i + 1}] Policy ${p.policy_id} (${ref}):\n${p.excerpt}`);
    });
  }
  return parts.join("\n\n");
}

function buildContextPrompt(
  query: string,
  chunks: SubmissionChunkCitation[],
  policies: PolicyCitation[],
): string {
  const context = formatCitationsForPrompt(chunks, policies);
  if (!context) {
    return `Reviewer question:\n${query}\n\n(No retrieval matches surfaced for this query.)`;
  }
  return `${context}\n\nReviewer question:\n${query}`;
}

// --- Handler ---

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ evalId: string }> },
): Promise<Response> {
  // Step 1: admin gate.
  const auth = await requireAdminForApi();
  if (auth instanceof NextResponse) return auth;
  const { client, user } = auth;

  // Step 2: local-engine gate (normalized 503 shape).
  const engineErr = requireLocalEngine();
  if (engineErr) {
    return NextResponse.json(
      { error: "local_engine_disabled" },
      { status: 503 },
    );
  }

  // Step 3: CSRF check.
  const csrf = checkCsrf(request);
  if (!csrf.ok) {
    const status =
      csrf.reason === "missing_content_type" ||
      csrf.reason === "wrong_content_type"
        ? 415
        : 403;
    return NextResponse.json(
      { error: "csrf_failed", reason: csrf.reason },
      { status },
    );
  }

  // Step 4: parse + Zod-strict validate body.
  let body: ChatBody;
  try {
    const raw = (await request.json()) as unknown;
    const parsed = chatBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", detail: parsed.error.message },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { evalId } = await context.params;

  // Step 5: ownership probe via JOIN.
  const { data: ownership, error: ownershipErr } = await client
    .from("v2_evaluations")
    .select("id, v2_projects!inner(user_id)")
    .eq("id", evalId)
    .eq("v2_projects.user_id", user.id)
    .maybeSingle();
  if (ownershipErr) {
    return NextResponse.json(
      { error: "ownership_probe_failed", detail: ownershipErr.message },
      { status: 500 },
    );
  }
  if (!ownership) {
    return NextResponse.json(
      { error: "evaluation_not_found" },
      { status: 404 },
    );
  }

  // History is already <=10 by Zod; defensive slice in case the schema
  // bound is relaxed later. Slice from the END (last 10 turns).
  const history = (body.history ?? []).slice(-HISTORY_MAX_TURNS);

  // Step 6: resolve model from cached tags.
  const availableModels = await getOllamaTags();
  const resolved = resolveChatModel(body.mode, availableModels);
  if (!resolved) {
    const cfg = MODE_TO_MODEL[body.mode];
    const tried = [cfg.default, ...cfg.fallbacks];
    return singleEventStream("error", {
      code: "model_unavailable",
      message:
        availableModels.length === 0
          ? `Ollama is not reachable at ${getOllamaBaseUrl()}. Start Ollama and reload.`
          : `No compatible model for mode '${body.mode}'. Tried: ${tried.join(", ")}.`,
      mode: body.mode,
      tried,
    });
  }

  // Step 7: retrieval. Submission axis is awaited; policy axis is
  // SYNCHRONOUS (better-sqlite3 driver) and is only invoked when the
  // query looks policy-grounded.
  const startMs = Date.now();
  let chunks: SubmissionChunkCitation[] = [];
  try {
    chunks = await retrieveSubmissionChunks(
      evalId,
      body.query,
      SUBMISSION_CHUNK_LIMIT,
      client,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "submission_retrieval_failed";
    return singleEventStream("error", {
      code: "submission_retrieval_failed",
      message,
    });
  }
  const policies: PolicyCitation[] = shouldUsePolicyAxis(body.query)
    ? retrievePolicyMatches(body.query, POLICY_LIMIT)
    : [];
  const retrievalCount = chunks.length + policies.length;

  // Step 8: build prompt + message list.
  const systemPrompt = getSystemPrompt(body.mode);
  const userContext = buildContextPrompt(body.query, chunks, policies);
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
  ];
  for (const turn of history) {
    messages.push({ role: turn.role, content: turn.content });
  }
  messages.push({ role: "user", content: userContext });

  // Step 9: stream.
  const encoder = new TextEncoder();
  const baseUrl = getOllamaBaseUrl();
  const upstreamSignal = request.signal;

  const stream = new ReadableStream({
    async start(controller) {
      // Emit citations FIRST so the UI can render pills before the
      // first delta token arrives.
      try {
        for (const c of chunks) {
          controller.enqueue(
            encoder.encode(
              sseEvent("citation", {
                type: "chunk",
                evidence_item_id: c.evidence_item_id,
                source_chunk_id: c.source_chunk_id,
                section: c.section,
                page: c.page,
                snippet: c.snippet,
                indigenous_flagged: c.indigenous_flagged,
                rank: c.rank,
              }),
            ),
          );
        }
        for (const p of policies) {
          controller.enqueue(
            encoder.encode(
              sseEvent("citation", {
                type: "policy",
                policy_id: p.policy_id,
                excerpt: p.excerpt,
                source: p.source,
              }),
            ),
          );
        }
      } catch (err) {
        // Controller already closed, e.g., client aborted.
        const message =
          err instanceof Error ? err.message : "citation_emit_failed";
        try {
          controller.enqueue(
            encoder.encode(sseEvent("error", { message })),
          );
          controller.close();
        } catch {
          // Already closed; nothing to do.
        }
        return;
      }

      // Connect to Ollama with a connect timeout that is CLEARED once
      // fetch() resolves. The upstream request.signal is forwarded via
      // a manually-wired listener so a client disconnect aborts the
      // upstream fetch+stream at any time. AbortSignal.any is avoided
      // (it requires Node 20.3+; engines floor is 20.0).
      const upstreamController = new AbortController();
      let connectTimeoutId: ReturnType<typeof setTimeout> | null =
        setTimeout(() => {
          upstreamController.abort(new Error("connect_timeout"));
        }, OLLAMA_CONNECT_TIMEOUT_MS);
      const onUpstreamAbort = (): void => {
        upstreamController.abort(
          upstreamSignal.reason instanceof Error
            ? upstreamSignal.reason
            : new Error("client_disconnected"),
        );
      };
      if (upstreamSignal.aborted) {
        onUpstreamAbort();
      } else {
        upstreamSignal.addEventListener("abort", onUpstreamAbort, {
          once: true,
        });
      }
      const clearConnectTimeout = (): void => {
        if (connectTimeoutId !== null) {
          clearTimeout(connectTimeoutId);
          connectTimeoutId = null;
        }
      };

      let ollamaResp: Response;
      try {
        ollamaResp = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: resolved.model,
            messages,
            stream: true,
            options: { temperature: resolved.temperature },
          }),
          signal: upstreamController.signal,
        });
        // CRITICAL: clear the connect timeout the moment the response
        // is established. Without this, a healthy stream is aborted at
        // OLLAMA_CONNECT_TIMEOUT_MS instead of relying on the per-chunk
        // idle race for the remainder of the stream.
        clearConnectTimeout();
      } catch (err) {
        clearConnectTimeout();
        upstreamSignal.removeEventListener("abort", onUpstreamAbort);
        const message =
          err instanceof Error ? err.message : "ollama_connect_failed";
        try {
          controller.enqueue(
            encoder.encode(
              sseEvent("error", { code: "ollama_connect_failed", message }),
            ),
          );
          controller.close();
        } catch {
          // already closed
        }
        return;
      }

      if (!ollamaResp.ok || !ollamaResp.body) {
        upstreamSignal.removeEventListener("abort", onUpstreamAbort);
        try {
          controller.enqueue(
            encoder.encode(
              sseEvent("error", {
                code: "ollama_upstream_error",
                message: `Ollama returned ${ollamaResp.status}: ${ollamaResp.statusText}`,
              }),
            ),
          );
          controller.close();
        } catch {
          // already closed
        }
        return;
      }

      const reader = ollamaResp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let closed = false;

      const closeOnce = (): void => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      try {
        // Read with an idle timeout per chunk: if Ollama goes silent for
        // OLLAMA_IDLE_TIMEOUT_MS, abort the loop and emit a clean error.
        for (;;) {
          const idleSignal = AbortSignal.timeout(OLLAMA_IDLE_TIMEOUT_MS);
          const idleAbort = new Promise<never>((_, reject) => {
            idleSignal.addEventListener(
              "abort",
              () => reject(new Error("stream_idle_timeout")),
              { once: true },
            );
          });

          let result: ReadableStreamReadResult<Uint8Array>;
          try {
            result = await Promise.race([reader.read(), idleAbort]);
          } catch (raceErr) {
            const msg =
              raceErr instanceof Error
                ? raceErr.message
                : "stream_read_failed";
            controller.enqueue(
              encoder.encode(
                sseEvent("error", {
                  code:
                    msg === "stream_idle_timeout"
                      ? "stream_idle_timeout"
                      : "stream_read_failed",
                  message: msg,
                }),
              ),
            );
            return;
          }

          const { done, value } = result;
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed) as {
                message?: { content?: string };
              };
              const text = parsed.message?.content;
              if (typeof text === "string" && text.length > 0) {
                // PASSTHROUGH: NO post-filter on text. The output
                // passthrough regression test asserts this directly.
                controller.enqueue(
                  encoder.encode(sseEvent("delta", { text })),
                );
              }
            } catch {
              // Skip malformed NDJSON line.
            }
          }
        }

        // Drain any trailing partial.
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer) as {
              message?: { content?: string };
            };
            const text = parsed.message?.content;
            if (typeof text === "string" && text.length > 0) {
              controller.enqueue(
                encoder.encode(sseEvent("delta", { text })),
              );
            }
          } catch {
            // Skip.
          }
        }

        controller.enqueue(
          encoder.encode(
            sseEvent("meta", {
              model: resolved.model,
              mode: body.mode,
              retrievalCount,
              durationMs: Date.now() - startMs,
            }),
          ),
        );
        controller.enqueue(encoder.encode(sseEvent("done", {})));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "chat_stream_failed";
        try {
          controller.enqueue(
            encoder.encode(sseEvent("error", { message })),
          );
        } catch {
          // already closed
        }
      } finally {
        clearConnectTimeout();
        upstreamSignal.removeEventListener("abort", onUpstreamAbort);
        try {
          await reader.cancel();
        } catch {
          // best-effort
        }
        closeOnce();
      }
    },
    cancel() {
      // Caller aborted; nothing to clean up beyond the reader (handled
      // in finally above when the start() promise resolves).
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
