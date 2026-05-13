// engine_v2 frontend Lane 2d / Phase D: chat_retrieval tests.
//
// Covers:
//   - retrieveSubmissionChunks calls the RPC with the right args and
//     maps row shape (doc_section/page_num -> section/page).
//   - retrieveSubmissionChunks surfaces indigenous_flagged unchanged.
//   - retrieveSubmissionChunks throws on RPC error.
//   - retrievePolicyMatches is SYNCHRONOUS and calls searchPolicies
//     with the OPTIONS-OBJECT form { limit: N } (BLOCKER 2 regression
//     guard).
//   - retrievePolicyMatches returns [] on internal driver failure.
//   - shouldUsePolicyAxis: triggers on policy-id pattern; triggers on
//     >=80 char query; returns false on short non-id query.
//
// PROMPT + REGISTRY SNAPSHOT TESTS:
//   - FAST_MODE_PROMPT pinned (chat-prompts.ts).
//   - THINKING_MODE_PROMPT pinned (chat-prompts.ts).
//   - MODE_TO_MODEL defaults pinned + gemma4:26b absent (chat-model-
//     registry.ts).
//
// ASCII only.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../policy_kb", () => ({
  searchPolicies: vi.fn(),
}));

import { searchPolicies } from "../policy_kb";
import {
  retrievePolicyMatches,
  retrieveSubmissionChunks,
  shouldUsePolicyAxis,
  POLICY_AXIS_LONG_QUERY_THRESHOLD,
  type ChatRetrievalRpcClient,
} from "../chat_retrieval";
import {
  FAST_MODE_PROMPT,
  THINKING_MODE_PROMPT,
  getSystemPrompt,
} from "../chat-prompts";
import {
  MODE_TO_MODEL,
  resolveChatModel,
} from "../chat-model-registry";

const mockedSearchPolicies = vi.mocked(searchPolicies);

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

interface RpcArgs {
  p_evaluation_id: string;
  p_query: string;
  p_limit: number;
}

function makeRpcClient(opts: {
  rows?: unknown[];
  error?: { message: string };
  capture?: { args?: RpcArgs };
}): ChatRetrievalRpcClient {
  return {
    async rpc(_fn, args) {
      if (opts.capture) opts.capture.args = args;
      if (opts.error) return { data: null, error: opts.error };
      return { data: (opts.rows ?? []) as never, error: null };
    },
  };
}

describe("retrieveSubmissionChunks()", () => {
  it("calls search_submission_chunks with the supplied args", async () => {
    const capture: { args?: RpcArgs } = {};
    const client = makeRpcClient({ rows: [], capture });
    await retrieveSubmissionChunks("eval-1", "arsenic", 6, client);
    expect(capture.args).toEqual({
      p_evaluation_id: "eval-1",
      p_query: "arsenic",
      p_limit: 6,
    });
  });

  it("maps RPC row shape to citation shape", async () => {
    const client = makeRpcClient({
      rows: [
        {
          id: "row-1",
          evidence_item_id: "slice_aaa",
          source_chunk_id: "sc_aaa",
          doc_section: "1.2 Site",
          page_num: 12,
          snippet: "<mark>arsenic</mark> exceedance",
          indigenous_flagged: false,
          cited_by_count: 3,
          rank: 0.42,
        },
      ],
    });
    const out = await retrieveSubmissionChunks("eval-1", "arsenic", 6, client);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      type: "chunk",
      evidence_item_id: "slice_aaa",
      source_chunk_id: "sc_aaa",
      section: "1.2 Site",
      page: 12,
      snippet: "<mark>arsenic</mark> exceedance",
      indigenous_flagged: false,
      rank: 0.42,
    });
  });

  it("surfaces indigenous_flagged unchanged (no filtering, no reorder)", async () => {
    const client = makeRpcClient({
      rows: [
        {
          id: "a",
          evidence_item_id: "slice_a",
          source_chunk_id: null,
          doc_section: "S1",
          page_num: 1,
          snippet: "...",
          indigenous_flagged: true,
          cited_by_count: 0,
          rank: 0.9,
        },
        {
          id: "b",
          evidence_item_id: "slice_b",
          source_chunk_id: null,
          doc_section: "S2",
          page_num: 2,
          snippet: "...",
          indigenous_flagged: false,
          cited_by_count: 0,
          rank: 0.5,
        },
      ],
    });
    const out = await retrieveSubmissionChunks("eval-1", "garden", 6, client);
    expect(out.map((r) => r.indigenous_flagged)).toEqual([true, false]);
    // Order preserved (no Indigenous-driven reordering).
    expect(out.map((r) => r.evidence_item_id)).toEqual([
      "slice_a",
      "slice_b",
    ]);
  });

  it("throws when the RPC errors", async () => {
    const client = makeRpcClient({ error: { message: "db down" } });
    await expect(
      retrieveSubmissionChunks("eval-1", "arsenic", 6, client),
    ).rejects.toThrow(/submission_search_failed/);
  });
});

describe("retrievePolicyMatches()", () => {
  it("is SYNCHRONOUS and calls searchPolicies with options-object form { limit }", () => {
    mockedSearchPolicies.mockReturnValue({
      rows: [
        {
          id: "CSAP-NPG-RP-1",
          originalText: "Policy text.",
          plainLanguage: null,
          discretionTier: "TIER_1_BINARY",
          topicCategory: null,
          subCategory: null,
          sourceDocument: "CSAP",
          sourceSection: "S1",
          sourcePage: "p.1",
          keywords: null,
          reviewQuestion: null,
          matchExplanation: null,
        },
      ],
      topics: [],
      usedFallback: false,
    });
    const out = retrievePolicyMatches("CSAP-NPG-RP-1", 3);

    // Synchronous: the return is a plain array, not a Promise.
    expect(Array.isArray(out)).toBe(true);

    // Options-object form: BLOCKER 2 regression guard. NOT positional.
    expect(mockedSearchPolicies).toHaveBeenCalledTimes(1);
    const callArgs = mockedSearchPolicies.mock.calls[0]!;
    expect(callArgs[0]).toBe("CSAP-NPG-RP-1");
    expect(callArgs[1]).toEqual({ limit: 3 });

    expect(out[0]).toEqual({
      type: "policy",
      policy_id: "CSAP-NPG-RP-1",
      excerpt: "Policy text.",
      source: "CSAP, S1",
    });
  });

  it("falls back to plainLanguage when originalText is null", () => {
    mockedSearchPolicies.mockReturnValue({
      rows: [
        {
          id: "P1",
          originalText: null,
          plainLanguage: "Plain summary.",
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
    const out = retrievePolicyMatches("garden", 3);
    expect(out[0]!.excerpt).toBe("Plain summary.");
    expect(out[0]!.source).toBeNull();
  });

  it("returns [] when policy_kb throws (e.g., driver unavailable)", () => {
    mockedSearchPolicies.mockImplementation(() => {
      throw new Error("better-sqlite3 not available in this runtime");
    });
    const out = retrievePolicyMatches("garden", 3);
    expect(out).toEqual([]);
  });
});

describe("shouldUsePolicyAxis()", () => {
  it("triggers on a policy-id-shaped token", () => {
    expect(shouldUsePolicyAxis("how does CSAP-NPG-RP-1 apply here")).toBe(
      true,
    );
    expect(shouldUsePolicyAxis("EMA_REG_375.96 is relevant")).toBe(true);
  });

  it("triggers on a long query above the threshold", () => {
    const longQ = "a".repeat(POLICY_AXIS_LONG_QUERY_THRESHOLD + 1);
    expect(shouldUsePolicyAxis(longQ)).toBe(true);
  });

  it("does NOT trigger on a short non-id query", () => {
    expect(shouldUsePolicyAxis("arsenic in soil")).toBe(false);
    expect(shouldUsePolicyAxis("garden near the site")).toBe(false);
  });
});

// --- prompt + registry snapshot tests ---

describe("chat-prompts.ts (snapshot pins)", () => {
  it("FAST_MODE_PROMPT matches snapshot", () => {
    expect(FAST_MODE_PROMPT).toMatchInlineSnapshot(
      `"You are an evidence-finder for the human reviewer. Find and cite relevant chunks from the structured submission to support the reviewer's professional judgment. Be terse. Verbatim citations only (evidence_item_id, section, page). Surface Indigenous-uses content (traditional gardens, hunting, fishing, medicines, and similar) as technically relevant evidence for contamination pathway assessment, like any other pathway evidence. Never propose adequacy, compliance, or regulatory determinations -- the reviewer holds those. Never speak in procedural or consultation language; that scope belongs to the reviewer and the in-person consultation process."`,
    );
  });

  it("THINKING_MODE_PROMPT matches snapshot", () => {
    expect(THINKING_MODE_PROMPT).toMatchInlineSnapshot(
      `"You are a synthesis assistant for the human reviewer. Find evidence in the structured submission, then synthesize across cited chunks to help the reviewer see relationships between pathway-relevant content. Be thorough. Verbatim citations only (evidence_item_id, section, page). Surface Indigenous-uses content (traditional gardens, hunting, fishing, medicines, and similar) as technically relevant pathway evidence, like any other pathway evidence. Never propose adequacy, compliance, or regulatory determinations -- the reviewer holds those. Never speak in procedural or consultation language; that scope belongs to the reviewer and the in-person consultation process."`,
    );
  });

  it("neither prompt contains TIER_2 / TIER_3 strings", () => {
    for (const prompt of [FAST_MODE_PROMPT, THINKING_MODE_PROMPT]) {
      expect(prompt).not.toMatch(/TIER_2/);
      expect(prompt).not.toMatch(/TIER_3/);
    }
  });

  it("neither prompt contains procedural-gate / consultation voice phrases", () => {
    for (const prompt of [FAST_MODE_PROMPT, THINKING_MODE_PROMPT]) {
      expect(prompt).not.toMatch(/SDM determination/i);
      expect(prompt).not.toMatch(/Section 35/);
      expect(prompt).not.toMatch(/DRIPA/);
      expect(prompt).not.toMatch(/Honour of the Crown/);
    }
  });

  it("getSystemPrompt routes by mode", () => {
    expect(getSystemPrompt("fast")).toBe(FAST_MODE_PROMPT);
    expect(getSystemPrompt("thinking")).toBe(THINKING_MODE_PROMPT);
  });
});

describe("chat-model-registry.ts (snapshot pins)", () => {
  it("MODE_TO_MODEL defaults match snapshot", () => {
    expect(MODE_TO_MODEL).toMatchInlineSnapshot(`
      {
        "fast": {
          "default": "gemma4:e4b",
          "fallbacks": [
            "qwen3.5:9b",
            "mistral-nemo:latest",
          ],
          "temperature": 0.3,
        },
        "thinking": {
          "default": "qwen2.5:14b-instruct-q4_K_M",
          "fallbacks": [
            "qwen3.5:9b",
            "mistral-nemo:latest",
          ],
          "temperature": 0.5,
        },
      }
    `);
  });

  it("gemma4:26b is NOT present in any default or fallback (CPU spillover lockout)", () => {
    for (const mode of ["fast", "thinking"] as const) {
      const cfg = MODE_TO_MODEL[mode];
      expect(cfg.default).not.toBe("gemma4:26b");
      expect(cfg.fallbacks).not.toContain("gemma4:26b");
    }
  });

  it("resolveChatModel returns default when available", () => {
    expect(
      resolveChatModel("fast", ["gemma4:e4b", "qwen3.5:9b"]),
    ).toEqual({ model: "gemma4:e4b", temperature: 0.3 });
  });

  it("resolveChatModel walks fallbacks when default missing", () => {
    expect(
      resolveChatModel("thinking", ["mistral-nemo:latest"]),
    ).toEqual({
      model: "mistral-nemo:latest",
      temperature: 0.5,
    });
  });

  it("resolveChatModel returns null when nothing matches", () => {
    expect(resolveChatModel("fast", ["llama3:70b"])).toBeNull();
  });
});
