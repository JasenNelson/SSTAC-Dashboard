// engine_v2 frontend Lane 2d / Phase D: POST /chat route tests.
//
// Critical regression guards:
//   1. Output passthrough: the SSE delta stream is NOT post-filtered.
//      The test name is pinned per the v0.5 IMPORTANT 5 spec.
//   2. No tier prompt rules / no banned-phrase classifier on route.
//   3. policy_kb.searchPolicies is called with options-object form.
//   4. AbortSignal.timeout used (no raw setTimeout) for idle + connect.
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
import { NextResponse } from "next/server";

vi.mock("@/lib/engine-v2/admin_guards", () => ({
  requireAdminForApi: vi.fn(),
}));
vi.mock("@/lib/api-guards", () => ({
  requireLocalEngine: vi.fn(),
}));
vi.mock("@/lib/engine-v2/ollama_tags_cache", () => ({
  getOllamaTags: vi.fn(),
  __resetOllamaTagsCache: vi.fn(),
}));
vi.mock("@/lib/engine-v2/policy_kb", () => ({
  searchPolicies: vi.fn(),
}));

import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { requireLocalEngine } from "@/lib/api-guards";
import { getOllamaTags } from "@/lib/engine-v2/ollama_tags_cache";
import { searchPolicies } from "@/lib/engine-v2/policy_kb";
import { POST } from "../route";

const mockedAdmin = vi.mocked(requireAdminForApi);
const mockedLocalEngine = vi.mocked(requireLocalEngine);
const mockedTags = vi.mocked(getOllamaTags);
const mockedSearchPolicies = vi.mocked(searchPolicies);

const EVAL_ID = "11111111-2222-3333-4444-555555555555";
const USER_ID = "admin-user";

// --- request builder ---

function makeReq(
  body: unknown,
  init?: { headers?: Record<string, string> },
): import("next/server").NextRequest {
  const defaultHeaders: Record<string, string> = {
    "content-type": "application/json",
    origin: "http://localhost:3000",
  };
  const headers = new Headers({ ...defaultHeaders, ...(init?.headers ?? {}) });
  const controller = new AbortController();
  return {
    headers,
    nextUrl: new URL(
      `http://localhost:3000/api/engine-v2/evaluations/${EVAL_ID}/chat`,
    ),
    signal: controller.signal,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as import("next/server").NextRequest;
}
function makeContext(): { params: Promise<{ evalId: string }> } {
  return { params: Promise.resolve({ evalId: EVAL_ID }) };
}

// --- supabase fake ---

interface ClientCfg {
  ownershipRow?: { id: string; v2_projects: { user_id: string } } | null;
  ownershipError?: { message: string };
  rpcRows?: unknown[];
  rpcError?: { message: string };
  rpcCalls?: Array<{ fn: string; args: unknown }>;
}

function makeClient(cfg: ClientCfg) {
  cfg.rpcCalls = cfg.rpcCalls ?? [];
  return {
    from(table: string) {
      if (table === "v2_evaluations") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            if (cfg.ownershipError) {
              return { data: null, error: cfg.ownershipError };
            }
            const defaultRow =
              cfg.ownershipRow === undefined
                ? { id: EVAL_ID, v2_projects: { user_id: USER_ID } }
                : cfg.ownershipRow;
            return { data: defaultRow, error: null };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
    async rpc(fn: string, args: unknown) {
      cfg.rpcCalls!.push({ fn, args });
      if (cfg.rpcError) return { data: null, error: cfg.rpcError };
      return { data: cfg.rpcRows ?? [], error: null };
    },
  };
}

function adminOk(client: unknown = makeClient({})): void {
  mockedAdmin.mockResolvedValue({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: client as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: { id: USER_ID } as any,
  });
}
function adminForbidden(): void {
  mockedAdmin.mockResolvedValue(
    NextResponse.json({ error: "Forbidden" }, { status: 403 }),
  );
}
function localEngineOk(): void {
  mockedLocalEngine.mockReturnValue(null);
}
function localEngineDisabled(): void {
  mockedLocalEngine.mockReturnValue(
    NextResponse.json(
      { error: "This feature requires the local evaluation engine." },
      { status: 503 },
    ),
  );
}

// --- SSE helpers ---

async function readSseToText(resp: Response): Promise<string> {
  if (!resp.body) return "";
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

interface ParsedEvent {
  event: string;
  data: unknown;
}

function parseSse(text: string): ParsedEvent[] {
  const frames = text.split("\n\n");
  const events: ParsedEvent[] = [];
  for (const frame of frames) {
    const trimmed = frame.trim();
    if (!trimmed) continue;
    let event = "message";
    let dataLine = "";
    for (const line of trimmed.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        dataLine += line.slice("data:".length).trim();
      }
    }
    let data: unknown = null;
    if (dataLine) {
      try {
        data = JSON.parse(dataLine);
      } catch {
        data = dataLine;
      }
    }
    events.push({ event, data });
  }
  return events;
}

// Build a ReadableStream that emits Ollama NDJSON lines.
function makeOllamaNdjsonResponse(lines: string[]): Response {
  const body = lines.join("\n") + "\n";
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/x-ndjson" },
  });
}

// --- env + global setup ---

let originalLocalEngineEnv: string | undefined;
let originalSiteUrl: string | undefined;
const fetchSpy = vi.spyOn(global, "fetch");
beforeEach(() => {
  originalLocalEngineEnv = process.env.LOCAL_ENGINE_ENABLED;
  originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.LOCAL_ENGINE_ENABLED = "true";
  // CSRF accepts origin === NEXT_PUBLIC_SITE_URL in self-hosted-prod
  // path when VERCEL_ENV is undefined and NODE_ENV is not 'development'
  // (the vitest env). Pin the expected site origin so the default
  // makeReq() origin (http://localhost:3000) is allowed.
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  vi.clearAllMocks();
  fetchSpy.mockReset();
  // Default: gemma4:e4b available, qwen2.5:14b-instruct-q4_K_M available.
  mockedTags.mockResolvedValue([
    "gemma4:e4b",
    "qwen2.5:14b-instruct-q4_K_M",
  ]);
  mockedSearchPolicies.mockReturnValue({
    rows: [],
    topics: [],
    usedFallback: false,
  });
});
afterEach(() => {
  if (originalLocalEngineEnv === undefined) {
    delete process.env.LOCAL_ENGINE_ENABLED;
  } else {
    process.env.LOCAL_ENGINE_ENABLED = originalLocalEngineEnv;
  }
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }
  fetchSpy.mockReset();
});

// --- tests ---

describe("POST /api/engine-v2/evaluations/[evalId]/chat", () => {
  it("403 when non-admin", async () => {
    adminForbidden();
    const res = await POST(
      makeReq({ query: "arsenic", mode: "fast" }),
      makeContext(),
    );
    expect(res.status).toBe(403);
  });

  it("503 local_engine_disabled when LOCAL_ENGINE_ENABLED!='true'", async () => {
    adminOk();
    localEngineDisabled();
    const res = await POST(
      makeReq({ query: "arsenic", mode: "fast" }),
      makeContext(),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("local_engine_disabled");
  });

  it("415 on missing/wrong content-type (CSRF)", async () => {
    adminOk();
    localEngineOk();
    const req = makeReq(
      { query: "arsenic", mode: "fast" },
      { headers: { "content-type": "text/plain" } },
    );
    const res = await POST(req, makeContext());
    expect(res.status).toBe(415);
  });

  it("403 on origin mismatch (CSRF)", async () => {
    adminOk();
    localEngineOk();
    const req = makeReq(
      { query: "arsenic", mode: "fast" },
      { headers: { origin: "http://evil.example.com" } },
    );
    const res = await POST(req, makeContext());
    expect(res.status).toBe(403);
  });

  it("400 on Zod-strict failure: extra keys rejected", async () => {
    adminOk();
    localEngineOk();
    const res = await POST(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeReq({ query: "arsenic", mode: "fast", extra: "nope" } as any),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it("400 on Zod-strict failure: missing required field", async () => {
    adminOk();
    localEngineOk();
    const res = await POST(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeReq({ query: "arsenic" } as any),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it("400 on Zod-strict failure: query too long", async () => {
    adminOk();
    localEngineOk();
    const q = "a".repeat(4_001);
    const res = await POST(
      makeReq({ query: q, mode: "fast" }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it("400 on bad mode enum", async () => {
    adminOk();
    localEngineOk();
    const res = await POST(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeReq({ query: "arsenic", mode: "deep" } as any),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it("404 when ownership probe returns null", async () => {
    const client = makeClient({ ownershipRow: null });
    adminOk(client);
    localEngineOk();
    const res = await POST(
      makeReq({ query: "arsenic", mode: "fast" }),
      makeContext(),
    );
    expect(res.status).toBe(404);
  });

  it("emits SSE error event when no model resolves", async () => {
    const client = makeClient({});
    adminOk(client);
    localEngineOk();
    mockedTags.mockResolvedValue([]);
    const res = await POST(
      makeReq({ query: "arsenic", mode: "fast" }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const text = await readSseToText(res);
    const events = parseSse(text);
    const errorEvent = events.find((e) => e.event === "error");
    expect(errorEvent).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((errorEvent!.data as any).code).toBe("model_unavailable");
  });

  it("happy path: emits citation events, delta events, meta, and done", async () => {
    const client = makeClient({
      rpcRows: [
        {
          id: "row-1",
          evidence_item_id: "slice_a",
          source_chunk_id: "sc_a",
          doc_section: "1.2 Site",
          page_num: 12,
          snippet: "arsenic exceedance",
          indigenous_flagged: false,
          cited_by_count: 2,
          rank: 0.42,
        },
      ],
    });
    adminOk(client);
    localEngineOk();

    fetchSpy.mockResolvedValueOnce(
      makeOllamaNdjsonResponse([
        JSON.stringify({ message: { content: "Hello " } }),
        JSON.stringify({ message: { content: "world." } }),
        JSON.stringify({ done: true }),
      ]),
    );

    const res = await POST(
      makeReq({ query: "arsenic exceedance in soil", mode: "fast" }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const text = await readSseToText(res);
    const events = parseSse(text);

    const citations = events.filter((e) => e.event === "citation");
    expect(citations).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((citations[0]!.data as any).evidence_item_id).toBe("slice_a");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((citations[0]!.data as any).type).toBe("chunk");

    const deltas = events.filter((e) => e.event === "delta");
    expect(deltas.length).toBeGreaterThan(0);
    const concatenated = deltas
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((d) => (d.data as any).text as string)
      .join("");
    expect(concatenated).toBe("Hello world.");

    const meta = events.find((e) => e.event === "meta");
    expect(meta).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((meta!.data as any).model).toBe("gemma4:e4b");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((meta!.data as any).retrievalCount).toBe(1);

    expect(events.some((e) => e.event === "done")).toBe(true);
  });

  it("uses thinking mode model when mode='thinking'", async () => {
    const client = makeClient({});
    adminOk(client);
    localEngineOk();
    fetchSpy.mockResolvedValueOnce(
      makeOllamaNdjsonResponse([
        JSON.stringify({ message: { content: "ok" } }),
      ]),
    );
    const res = await POST(
      makeReq({ query: "long thoughtful question", mode: "thinking" }),
      makeContext(),
    );
    const events = parseSse(await readSseToText(res));
    const meta = events.find((e) => e.event === "meta");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((meta!.data as any).model).toBe("qwen2.5:14b-instruct-q4_K_M");
  });

  it("chat route does NOT post-filter procedural phrases from Ollama output (regression guard for v0.3 banned-phrase classifier removal)", async () => {
    const client = makeClient({});
    adminOk(client);
    localEngineOk();

    // The route MUST pass these exact strings through unchanged. Each
    // fragment is emitted as a SEPARATE NDJSON delta with a "\n" suffix
    // so we can assert byte-for-byte equality on the concatenated
    // delta payload (catching subtle rewrites like "SDM" -> "Senior
    // Decision-Maker" that a toContain() check would miss).
    const PROCEDURAL_FRAGMENTS = [
      "this requires SDM determination",
      "Section 35 considerations apply",
      "TIER_3_STATUTORY",
      "TIER_2_PROFESSIONAL",
      "Honour of the Crown",
      "DRIPA",
    ];
    const expected = PROCEDURAL_FRAGMENTS.map((f) => f + "\n").join("");

    fetchSpy.mockResolvedValueOnce(
      makeOllamaNdjsonResponse(
        PROCEDURAL_FRAGMENTS.map((frag) =>
          JSON.stringify({ message: { content: frag + "\n" } }),
        ),
      ),
    );

    const res = await POST(
      makeReq({ query: "test passthrough", mode: "fast" }),
      makeContext(),
    );
    const events = parseSse(await readSseToText(res));
    const deltas = events.filter((e) => e.event === "delta");
    const concat = deltas
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((d) => (d.data as any).text as string)
      .join("");

    // Byte-for-byte equality: catches any rewrite, not just deletion.
    expect(concat).toBe(expected);
  });

  it("surfaces RPC error as SSE error event (no thrown 500)", async () => {
    const client = makeClient({ rpcError: { message: "db down" } });
    adminOk(client);
    localEngineOk();
    const res = await POST(
      makeReq({ query: "arsenic", mode: "fast" }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const events = parseSse(await readSseToText(res));
    const err = events.find((e) => e.event === "error");
    expect(err).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((err!.data as any).code).toBe("submission_retrieval_failed");
  });

  it("invokes the policy axis when the query looks policy-grounded", async () => {
    const client = makeClient({});
    adminOk(client);
    localEngineOk();
    mockedSearchPolicies.mockReturnValue({
      rows: [
        {
          id: "CSAP-NPG-RP-1",
          originalText: "Policy text.",
          plainLanguage: null,
          discretionTier: null,
          topicCategory: null,
          subCategory: null,
          sourceDocument: null,
          sourceSection: null,
          sourcePage: null,
          keywords: null,
          reviewQuestion: null,
          matchExplanation: null,
        },
      ],
      topics: [],
      usedFallback: false,
    });
    fetchSpy.mockResolvedValueOnce(
      makeOllamaNdjsonResponse([
        JSON.stringify({ message: { content: "ok" } }),
      ]),
    );
    const res = await POST(
      makeReq({
        query: "how does CSAP-NPG-RP-1 apply to arsenic remediation",
        mode: "fast",
      }),
      makeContext(),
    );
    const events = parseSse(await readSseToText(res));
    const policyCit = events.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e) => e.event === "citation" && (e.data as any).type === "policy",
    );
    expect(policyCit).toBeDefined();
    // BLOCKER 2 regression guard: options-object form { limit: 3 }.
    const callArgs = mockedSearchPolicies.mock.calls[0]!;
    expect(callArgs[1]).toEqual({ limit: 3 });
  });

  it("does NOT invoke the policy axis on a short non-id query", async () => {
    const client = makeClient({});
    adminOk(client);
    localEngineOk();
    fetchSpy.mockResolvedValueOnce(
      makeOllamaNdjsonResponse([
        JSON.stringify({ message: { content: "ok" } }),
      ]),
    );
    await POST(
      makeReq({ query: "arsenic in soil", mode: "fast" }),
      makeContext(),
    );
    expect(mockedSearchPolicies).not.toHaveBeenCalled();
  });

  it("caps history at 10 turns server-side (defensive slice)", async () => {
    const client = makeClient({});
    adminOk(client);
    localEngineOk();
    const longHistory = Array.from({ length: 12 }).map((_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `turn-${i}`,
    }));
    // Zod schema bounds history at 10 already; passing 12 should 400.
    const res = await POST(
      makeReq({
        query: "test",
        mode: "fast",
        history: longHistory,
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it("does NOT import detectIndigenousContent / INDIGENOUS_HARD_STOP / submission_indigenous_keywords", async () => {
    // Read the route source verbatim; assert the forbidden tokens are
    // absent (this is the scope-lock invariant from
    // feedback_no_tier_judgment_for_ai). The test is deliberately a
    // string scan so accidental imports cannot pass type-check and slip
    // past test review.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const routePath = path.resolve(
      process.cwd(),
      "src/app/api/engine-v2/evaluations/[evalId]/chat/route.ts",
    );
    const src = fs.readFileSync(routePath, "utf8");
    // Comments may MENTION the absence (e.g., "NO detectIndigenousContent
    // import"). The scan therefore matches an actual import statement
    // shape, not the bare identifier.
    expect(src).not.toMatch(/^\s*import[^;]*\bdetectIndigenousContent\b/m);
    expect(src).not.toMatch(/^\s*import[^;]*\bINDIGENOUS_HARD_STOP\b/m);
    expect(src).not.toMatch(/^\s*import[^;]*submission_indigenous_keywords/m);
  });

  it("connect timeout is cleared once fetch resolves (healthy stream past 10s is NOT aborted at the connect deadline)", async () => {
    // Regression for Phase D Round 2 IMPORTANT 1: previously the route
    // wired the 10s connect timeout via AbortSignal.any() on the fetch
    // signal, which kept aborting the underlying stream at the connect
    // deadline even after the response was established. The fix uses a
    // manual AbortController and clears the connect setTimeout the
    // moment fetch() resolves, so only the per-chunk idle race (60s)
    // governs the live stream.
    //
    // CRITICAL: this regression is about CLOCK TIME. The buggy wiring
    // only manifests when more than 10s elapse after fetch() resolves
    // while the stream is still healthy. Round 2 used real timers with
    // 50ms/10ms waits which NEVER crossed the 10s deadline -- the test
    // would falsely pass even with the buggy code because
    // capturedFetchSignal.aborted would still be false at end-of-test.
    // Round 3 fix: use vi.useFakeTimers() so we can synthesize 11s of
    // elapsed time between the first and second delta. If the connect
    // timeout were NOT cleared after fetch resolves, advancing the
    // fake clock past 10s would fire setTimeout(connect-timeout) which
    // would call upstreamController.abort(), and
    // capturedFetchSignal.aborted would flip to true. The assertion
    // .aborted === false therefore actually verifies the contract.

    vi.useFakeTimers();
    try {
      const client = makeClient({});
      adminOk(client);
      localEngineOk();

      const encoder = new TextEncoder();
      const ndjsonLines = [
        JSON.stringify({ message: { content: "delta-at-8s " } }),
        JSON.stringify({ message: { content: "delta-at-18s" } }),
      ];

      // Manually-controlled ReadableStream: we hold onto the
      // ReadableStreamDefaultController so the test can enqueue lines
      // at precise points in the fake timeline, then close.
      //
      // Round 4 fix (Codex IMPORTANT): wire the stream to honor the
      // fetch signal. In production, when an aborted fetch propagates
      // to the body, reader.read() rejects. Previously this mock
      // ignored init.signal, so even on the BUGGY wiring the manual
      // stream kept emitting after upstreamController.abort() fired,
      // and the concat / no-error-event assertions would falsely pass.
      // Only the .aborted === false assertion actually caught the bug.
      // With this listener, an upstream abort propagates into the
      // stream (controller.error), reader.read() rejects, the route
      // emits an SSE error event and returns -- so ALL THREE
      // assertions independently fail under the Round 1 buggy wiring.
      let streamCtrl: ReadableStreamDefaultController<Uint8Array> | null =
        null;
      let capturedFetchSignal: AbortSignal | null = null;
      fetchSpy.mockImplementationOnce(async (_url, init) => {
        capturedFetchSignal =
          (init as RequestInit | undefined)?.signal ?? null;
        const body = new ReadableStream<Uint8Array>({
          start(c) {
            streamCtrl = c;
            // Honor the fetch signal: if the route's upstream signal
            // aborts (e.g., because the connect-timeout setTimeout
            // fired and was never cleared), error the stream so
            // reader.read() rejects -- matching real fetch/Response
            // body semantics.
            const sig = (init as RequestInit | undefined)?.signal;
            if (sig) {
              const onAbort = () => {
                try {
                  const reason = (sig as AbortSignal & { reason?: unknown })
                    .reason;
                  c.error(
                    reason instanceof Error
                      ? reason
                      : new Error(String(reason ?? "aborted")),
                  );
                } catch {
                  // Controller may already be closed; ignore.
                }
              };
              if (sig.aborted) {
                onAbort();
              } else {
                sig.addEventListener("abort", onAbort, { once: true });
              }
            }
          },
        });
        // Simulate a short connect under the fake clock. Use a real
        // microtask hop (Promise.resolve) so we do NOT depend on a
        // timer tick to resolve fetch -- the route then enters the
        // read loop on the next microtask, which lets the test drive
        // the timeline deterministically below.
        await Promise.resolve();
        return new Response(body, {
          status: 200,
          headers: { "content-type": "application/x-ndjson" },
        });
      });

      const resPromise = POST(
        makeReq({ query: "long stream test", mode: "fast" }),
        makeContext(),
      );

      // Let admin gate / ownership probe / fetch microtasks settle.
      // runOnlyPendingTimersAsync flushes pending microtasks AND any
      // currently-scheduled timers (the route schedules the 10s
      // connect-timeout setTimeout when it enters start()). Use
      // advanceTimersByTime(0) repeatedly to drain microtasks without
      // crossing into the 10s connect deadline.
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      // First delta: emit before the 10s connect deadline.
      // streamCtrl is set inside the ReadableStream start() callback,
      // which runs when the route's reader.getReader() is called. The
      // microtask drains above guarantee start() has executed.
      if (!streamCtrl) {
        throw new Error("stream controller not initialized; route did not call getReader()");
      }
      (streamCtrl as ReadableStreamDefaultController<Uint8Array>).enqueue(
        encoder.encode(ndjsonLines[0] + "\n"),
      );
      // Let the route's reader.read() surface the first delta.
      await vi.advanceTimersByTimeAsync(0);

      // CRITICAL: cross the 10s connect deadline. If the route did
      // NOT clear connectTimeoutId after fetch() resolved, this
      // advance would fire upstreamController.abort("connect_timeout")
      // and capturedFetchSignal.aborted would become true.
      await vi.advanceTimersByTimeAsync(11_000);

      // Second delta arrives well after the connect deadline but well
      // before the 60s idle deadline. On the FIXED code this must
      // flow through; on the BUGGY code the upstream would already be
      // aborted (controller errored by the abort listener above) and
      // these enqueue/close calls would THROW because the controller
      // is no longer writable. Wrap in try/catch so the test continues
      // to the assertions even on the buggy code path -- the
      // assertions (concat / no error event / signal not aborted) are
      // the real bug detectors; enqueue throwing is the side effect.
      try {
        (streamCtrl as ReadableStreamDefaultController<Uint8Array>).enqueue(
          encoder.encode(ndjsonLines[1] + "\n"),
        );
        (streamCtrl as ReadableStreamDefaultController<Uint8Array>).close();
      } catch {
        // Controller errored by the abort listener; expected under
        // the buggy Round 1 wiring, no-op under the fixed code.
      }
      // Drain the route's remaining reader.read() and SSE emission
      // microtasks. Use runAllTimersAsync to let any cleanup timers
      // (e.g., the 60s idle AbortSignal.timeout) finish/clear cleanly
      // without leaving a dangling handle.
      await vi.runAllTimersAsync();

      const res = await resPromise;
      expect(res.status).toBe(200);
      // readSseToText drains the SSE body; under fake timers the
      // stream's TextDecoder microtasks still resolve normally.
      const events = parseSse(await readSseToText(res));
      const deltas = events.filter((e) => e.event === "delta");
      const concat = deltas
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((d) => (d.data as any).text as string)
        .join("");
      expect(concat).toBe("delta-at-8s delta-at-18s");
      // No error event: the stream completed cleanly across the 10s
      // boundary.
      expect(events.find((e) => e.event === "error")).toBeUndefined();
      // The fetch signal that the route passed upstream must NOT be
      // aborted at end of a healthy stream that crossed the 10s
      // connect deadline. On the BUGGY wiring (connect setTimeout
      // attached to the fetch signal and never cleared) this would be
      // true after the advanceTimersByTimeAsync(11_000) above.
      expect(capturedFetchSignal).not.toBeNull();
      expect(capturedFetchSignal!.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("route uses AbortSignal.timeout for idle and a cancellable setTimeout for connect (no AbortSignal.any; Node 20.0 compatible)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const routePath = path.resolve(
      process.cwd(),
      "src/app/api/engine-v2/evaluations/[evalId]/chat/route.ts",
    );
    const src = fs.readFileSync(routePath, "utf8");
    // Idle race still uses AbortSignal.timeout (per-chunk).
    expect(src).toMatch(/AbortSignal\.timeout/);
    // AbortSignal.any must NOT be CALLED (requires Node 20.3+; engines
    // floor is 20.0). Replaced by a manual AbortController + listener
    // wiring. The regex matches a call site (with optional whitespace
    // before the open paren) so explanatory comments mentioning the
    // identifier do not trip the guard.
    expect(src).not.toMatch(/AbortSignal\.any\s*\(/);
    // The connect timeout uses a cancellable setTimeout that is cleared
    // the moment fetch() resolves; ensure both the setTimeout and a
    // matching clearTimeout are present.
    expect(src).toMatch(/\bsetTimeout\(/);
    expect(src).toMatch(/\bclearTimeout\(/);
  });
});
