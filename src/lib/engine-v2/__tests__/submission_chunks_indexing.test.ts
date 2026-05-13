// engine_v2 Lane 2d / Phase B tests for submission_chunks_indexing.
//
// Covers:
//   - buildSubmissionChunkRows: map-KEY join (BLOCKER 3); source.chunk_id
//     stored as optional metadata only; indigenous_flagged deterministic.
//   - buildCitationRows: only submission-side evidence_packet entries
//     (resolves against evidence_slices map; policy-text entries excluded);
//     de-duplicated.
//   - indexSubmissionChunksFromEnvelope: idempotent via RPC
//     (replace_submission_chunks); pending -> running -> complete/error
//     status chain (Round 2 / IMPORTANT 1); missing-slices path still
//     calls RPC for DELETE (Round 2 / IMPORTANT 3); throws on data-write
//     failure (writes status='error'); status-write failures propagate
//     (Round 2 / IMPORTANT 4).
//   - runIndexerNonBlocking: does NOT rethrow on failure; writes status
//     row; surfaces statusWriteError in result.
//   - detectIndigenousContent: word-boundary on short tokens (tek/latek);
//     positive + clearly-negative cases.
//
// Phase B corrective follow-up (RLS alignment): tests use a mock
// authenticated client passed via params.client. The Phase B tables now
// expose owner-AND-admin FOR ALL TO authenticated RLS policies, so the
// indexer writes through the same client used elsewhere in engine_v2.
// No service-role client is constructed, mocked, or asserted.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildSubmissionChunkRows,
  buildCitationRows,
  indexSubmissionChunksFromEnvelope,
  runIndexerNonBlocking,
} from "../submission_chunks_indexing";
import { detectIndigenousContent } from "../submission_indigenous_keywords";
import type { EvidenceSliceMap } from "../evidence_slices";

const EVAL_ID = "abcdef01-2345-6789-abcd-ef0123456789";

function makeSlice(
  id: string,
  content: string,
  overrides: Partial<{
    page: number | null;
    section: string | null;
    title: string;
    chunk_id: string | null;
  }> = {},
): EvidenceSliceMap[string] {
  return {
    content_hash: `hash_${id}`,
    content,
    field: "original_text",
    policy_id: "CSR-1",
    source: {
      doc_id: `doc_${id}`,
      title: overrides.title ?? "Submission report",
      page: overrides.page === undefined ? 12 : overrides.page,
      section:
        overrides.section === undefined ? "Section 4.2" : overrides.section,
      chunk_id: overrides.chunk_id === undefined ? null : overrides.chunk_id,
      source_path: null,
    },
  };
}

describe("detectIndigenousContent", () => {
  it("matches plain ASCII multi-token keywords case-insensitively", () => {
    expect(
      detectIndigenousContent(
        "The First Nation has used these waters for fishing.",
      ),
    ).toBe(true);
    expect(detectIndigenousContent("UNDRIP article 19 applies here.")).toBe(
      true,
    );
    expect(
      detectIndigenousContent("Traditional Foods sampled from the garden."),
    ).toBe(true);
  });

  it("matches Indigenous-uses pathway language", () => {
    expect(
      detectIndigenousContent("Hunting on the traditional territory."),
    ).toBe(true);
    expect(detectIndigenousContent("Country food consumption is high.")).toBe(
      true,
    );
  });

  it("returns false for clearly-non-Indigenous regulatory text", () => {
    expect(
      detectIndigenousContent(
        "Soil concentrations exceed the CSR Schedule 3.1 standard.",
      ),
    ).toBe(false);
    expect(
      detectIndigenousContent(
        "The remediation plan addresses groundwater contamination.",
      ),
    ).toBe(false);
  });

  it("applies word-boundary check for the short token 'tek'", () => {
    // 'tek' alone (whole-word) -> true
    expect(detectIndigenousContent("The TEK informs the assessment.")).toBe(
      true,
    );
    expect(detectIndigenousContent("TEK and Western science combined.")).toBe(
      true,
    );
    // Substring inside a non-Indigenous English word -> false
    expect(
      detectIndigenousContent("The latek sample arrived at the lab."),
    ).toBe(false);
    expect(detectIndigenousContent("Biotek sensors deployed at site.")).toBe(
      false,
    );
  });

  it("omits 'consent' from the keyword list (false-positive guard)", () => {
    // 'consent' is intentionally NOT a keyword; the only matches below are
    // via other tokens, so this content (no Indigenous markers) should be
    // false.
    expect(
      detectIndigenousContent(
        "The applicant consented to the schedule change.",
      ),
    ).toBe(false);
  });

  it("metis-diacritic fold-test fixture (plain-ASCII keyword still matches the lowercased ASCII source)", () => {
    // The TS-side detector intentionally stays ASCII. Diacritic-bearing
    // source text is normalized by callers if needed; the keyword list
    // itself is ASCII-only. Confirm the plain 'metis' token matches an
    // ASCII source verbatim. (If a real submission surfaces a diacritic
    // miss, the owner adds an additional fold-test input to the keyword
    // list.)
    expect(detectIndigenousContent("The Metis community in the region.")).toBe(
      true,
    );
    expect(detectIndigenousContent("metis traditional uses documented.")).toBe(
      true,
    );
  });
});

describe("buildSubmissionChunkRows", () => {
  it("uses the evidence_slices map KEY as evidence_item_id (BLOCKER 3)", () => {
    const slices: EvidenceSliceMap = {
      slice_aaa: makeSlice("aaa", "First Nation pathway content."),
      slice_bbb: makeSlice("bbb", "Pure soil chemistry text."),
    };
    const rows = buildSubmissionChunkRows(EVAL_ID, slices);
    expect(rows).toHaveLength(2);
    const ids = rows.map((r) => r.evidence_item_id).sort();
    expect(ids).toEqual(["slice_aaa", "slice_bbb"]);
  });

  it("does NOT use source.chunk_id as the join key; stores it as optional metadata", () => {
    const slices: EvidenceSliceMap = {
      slice_with_chunk: makeSlice("a", "content a", { chunk_id: "engine_c1" }),
      slice_without_chunk: makeSlice("b", "content b", { chunk_id: null }),
    };
    const rows = buildSubmissionChunkRows(EVAL_ID, slices);
    const a = rows.find((r) => r.evidence_item_id === "slice_with_chunk")!;
    const b = rows.find((r) => r.evidence_item_id === "slice_without_chunk")!;
    expect(a.source_chunk_id).toBe("engine_c1");
    expect(b.source_chunk_id).toBeNull();
  });

  it("computes indigenous_flagged deterministically per content", () => {
    const slices: EvidenceSliceMap = {
      pos: makeSlice("pos", "Traditional knowledge informs the site model."),
      neg: makeSlice("neg", "Sample H_2_O 7.2 from MW-04."),
    };
    const rows = buildSubmissionChunkRows(EVAL_ID, slices);
    expect(rows.find((r) => r.evidence_item_id === "pos")!.indigenous_flagged).toBe(true);
    expect(rows.find((r) => r.evidence_item_id === "neg")!.indigenous_flagged).toBe(false);
  });

  it("falls back to title then '(unknown)' when section is missing", () => {
    const slices: EvidenceSliceMap = {
      s1: makeSlice("s1", "x", { section: null, title: "Front matter" }),
      s2: makeSlice("s2", "x", { section: null, title: "" }),
    };
    const rows = buildSubmissionChunkRows(EVAL_ID, slices);
    expect(rows.find((r) => r.evidence_item_id === "s1")!.doc_section).toBe(
      "Front matter",
    );
    expect(rows.find((r) => r.evidence_item_id === "s2")!.doc_section).toBe(
      "(unknown)",
    );
  });

  it("preserves nullable page_num", () => {
    const slices: EvidenceSliceMap = {
      a: makeSlice("a", "x", { page: 7 }),
      b: makeSlice("b", "y", { page: null }),
    };
    const rows = buildSubmissionChunkRows(EVAL_ID, slices);
    expect(rows.find((r) => r.evidence_item_id === "a")!.page_num).toBe(7);
    expect(rows.find((r) => r.evidence_item_id === "b")!.page_num).toBeNull();
  });
});

describe("buildCitationRows", () => {
  const slices: EvidenceSliceMap = {
    slice_a: makeSlice("a", "content a"),
    slice_b: makeSlice("b", "content b"),
    slice_c: makeSlice("c", "content c"),
  };

  it("emits one citation per (policy_id, submission slice) pair", () => {
    const perPolicy = [
      {
        policy_id: "CSR-1",
        evidence_packet: {
          hits: [{ evidence_item_id: "slice_a" }, { evidence_item_id: "slice_b" }],
        },
      },
      {
        policy_id: "CSR-2",
        evidence_packet: {
          hits: [{ evidence_item_id: "slice_a" }],
        },
      },
    ];
    const rows = buildCitationRows(EVAL_ID, perPolicy, slices);
    expect(rows).toHaveLength(3);
    const keys = rows.map((r) => `${r.policy_id}::${r.evidence_item_id}`).sort();
    expect(keys).toEqual([
      "CSR-1::slice_a",
      "CSR-1::slice_b",
      "CSR-2::slice_a",
    ]);
  });

  it("excludes orphan ids (no resolution against evidence_slices)", () => {
    // 'policy_text_42' is NOT a submission slice (not present in slices).
    // The indexer treats this as a policy-text citation and skips it.
    const perPolicy = [
      {
        policy_id: "CSR-3",
        evidence_packet: {
          hits: [
            { evidence_item_id: "slice_a" },
            { evidence_item_id: "policy_text_42" },
          ],
        },
      },
    ];
    const rows = buildCitationRows(EVAL_ID, perPolicy, slices);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.evidence_item_id).toBe("slice_a");
  });

  it("de-duplicates within a single per-policy result", () => {
    const perPolicy = [
      {
        policy_id: "CSR-4",
        evidence_packet: {
          hits: [
            { evidence_item_id: "slice_a" },
            { evidence_item_id: "slice_a" },
            { evidence_item_id: "slice_a" },
          ],
        },
      },
    ];
    const rows = buildCitationRows(EVAL_ID, perPolicy, slices);
    expect(rows).toHaveLength(1);
  });

  it("tolerates alternative packet shapes (nested 'items' with 'id' field)", () => {
    const perPolicy = [
      {
        policy_id: "CSR-5",
        evidence_packet: {
          items: [{ id: "slice_b" }, { id: "slice_c" }],
        },
      },
    ];
    const rows = buildCitationRows(EVAL_ID, perPolicy, slices);
    expect(rows.map((r) => r.evidence_item_id).sort()).toEqual([
      "slice_b",
      "slice_c",
    ]);
  });

  it("skips rows with empty policy_id", () => {
    const perPolicy = [
      {
        policy_id: "",
        evidence_packet: { hits: [{ evidence_item_id: "slice_a" }] },
      },
      {
        policy_id: "CSR-6",
        evidence_packet: { hits: [{ evidence_item_id: "slice_a" }] },
      },
    ];
    const rows = buildCitationRows(EVAL_ID, perPolicy, slices);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.policy_id).toBe("CSR-6");
  });
});

// ---------- DB-mock integration tests for indexSubmissionChunksFromEnvelope.

interface RpcCallEntry {
  op: "rpc";
  fn: string;
  args: Record<string, unknown>;
}
interface UpsertCallEntry {
  op: "upsert";
  table: string;
  row: Record<string, unknown>;
}
type CallEntry = RpcCallEntry | UpsertCallEntry;

interface MockCfg {
  // RPC fails when set with this message.
  rpcError?: string;
  // Upsert against the status table fails when set with this message.
  statusUpsertError?: string;
  // Round 3 / IMPORTANT 4 (residual): selectively fail status upserts by
  // status value. Lets a test simulate a pending/running failure followed
  // by a successful 'error' write (so the final defensive write doesn't
  // mask the prior failure).
  statusUpsertErrorByStatus?: Partial<Record<"pending" | "running" | "complete" | "error", string>>;
}

function makeMockClient(cfg: MockCfg = {}): {
  client: SupabaseClient;
  calls: CallEntry[];
} {
  const calls: CallEntry[] = [];

  const from = (table: string) => {
    return {
      upsert(row: unknown) {
        const rec = row as Record<string, unknown>;
        calls.push({ op: "upsert", table, row: rec });
        let errorMessage: string | undefined;
        if (
          table === "v2_submission_chunks_indexing_status"
        ) {
          if (cfg.statusUpsertErrorByStatus) {
            const status = rec.status as
              | "pending"
              | "running"
              | "complete"
              | "error"
              | undefined;
            if (status && cfg.statusUpsertErrorByStatus[status]) {
              errorMessage = cfg.statusUpsertErrorByStatus[status];
            }
          } else if (cfg.statusUpsertError) {
            errorMessage = cfg.statusUpsertError;
          }
        }
        return Promise.resolve({
          error: errorMessage ? { message: errorMessage } : null,
        });
      },
    };
  };

  const rpc = (fn: string, args: Record<string, unknown>) => {
    calls.push({ op: "rpc", fn, args });
    return Promise.resolve({
      error: cfg.rpcError ? { message: cfg.rpcError } : null,
    });
  };

  return {
    client: { from, rpc } as unknown as SupabaseClient,
    calls,
  };
}

function statusUpserts(calls: CallEntry[]): UpsertCallEntry[] {
  return calls.filter(
    (c): c is UpsertCallEntry =>
      c.op === "upsert" && c.table === "v2_submission_chunks_indexing_status",
  );
}

function rpcCalls(calls: CallEntry[]): RpcCallEntry[] {
  return calls.filter((c): c is RpcCallEntry => c.op === "rpc");
}

function makeEnvelopeWithSlices(): {
  envelope: Record<string, unknown>;
  perPolicy: Array<Record<string, unknown>>;
} {
  const evidenceSlices: Record<string, unknown> = {
    slice_a: {
      content_hash: "h_a",
      content: "First Nation pathway content here.",
      field: "original_text",
      policy_id: "CSR-1",
      source: {
        doc_id: "doc_a",
        title: "Site report",
        page: 1,
        section: "Section 2.1",
        chunk_id: "engine_a",
        source_path: null,
      },
    },
    slice_b: {
      content_hash: "h_b",
      content: "Soil ICP-MS data, no Indigenous markers.",
      field: "original_text",
      policy_id: "CSR-2",
      source: {
        doc_id: "doc_b",
        title: "Site report",
        page: 3,
        section: "Appendix B",
        chunk_id: null,
        source_path: null,
      },
    },
  };
  return {
    envelope: {
      schema_version: "0.1.0",
      evidence_slices: evidenceSlices,
    },
    perPolicy: [
      {
        policy_id: "CSR-1",
        evidence_packet: { hits: [{ evidence_item_id: "slice_a" }] },
      },
      {
        policy_id: "CSR-2",
        evidence_packet: { hits: [{ evidence_item_id: "slice_b" }] },
      },
    ],
  };
}

describe("indexSubmissionChunksFromEnvelope", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path: status chain pending -> running -> complete; calls RPC with chunk + citation arrays", async () => {
    const { envelope, perPolicy } = makeEnvelopeWithSlices();
    const { client, calls } = makeMockClient();

    const result = await indexSubmissionChunksFromEnvelope({
      client,
      evaluationId: EVAL_ID,
      rawEnvelope: envelope,
      perPolicyResults: perPolicy,
    });

    expect(result.chunkRows).toBe(2);
    expect(result.citationRows).toBe(2);
    expect(result.statusWriteError).toBeNull();

    // Round 2 / IMPORTANT 1: full pending -> running -> complete chain.
    const statuses = statusUpserts(calls).map((c) => c.row.status);
    expect(statuses).toEqual(["pending", "running", "complete"]);

    // RPC is the only data-write call.
    const rpcs = rpcCalls(calls);
    expect(rpcs).toHaveLength(1);
    expect(rpcs[0]!.fn).toBe("replace_submission_chunks");
    expect(rpcs[0]!.args.p_evaluation_id).toBe(EVAL_ID);
    expect(
      (rpcs[0]!.args.p_chunks as Array<unknown>).length,
    ).toBe(2);
    expect(
      (rpcs[0]!.args.p_citations as Array<unknown>).length,
    ).toBe(2);
  });

  it("idempotent: re-running produces same row count via the same RPC", async () => {
    const { envelope, perPolicy } = makeEnvelopeWithSlices();
    const { client, calls } = makeMockClient();

    const r1 = await indexSubmissionChunksFromEnvelope({
      client,
      evaluationId: EVAL_ID,
      rawEnvelope: envelope,
      perPolicyResults: perPolicy,
    });
    const r2 = await indexSubmissionChunksFromEnvelope({
      client,
      evaluationId: EVAL_ID,
      rawEnvelope: envelope,
      perPolicyResults: perPolicy,
    });

    expect(r1.chunkRows).toBe(r2.chunkRows);
    expect(r1.citationRows).toBe(r2.citationRows);
    // Each run: 3 status upserts (pending,running,complete) + 1 RPC = 4 calls.
    expect(calls.length).toBe(8);
    expect(rpcCalls(calls).length).toBe(2);
  });

  it("missing evidence_slices STILL runs RPC for DELETE (Round 2 / IMPORTANT 3); then completes with 0 rows", async () => {
    const { client, calls } = makeMockClient();
    const result = await indexSubmissionChunksFromEnvelope({
      client,
      evaluationId: EVAL_ID,
      rawEnvelope: { schema_version: "0.0.1" },
      perPolicyResults: [],
    });
    expect(result.chunkRows).toBe(0);
    expect(result.citationRows).toBe(0);

    // RPC is called with empty payloads so stale rows are still DELETEd.
    const rpcs = rpcCalls(calls);
    expect(rpcs).toHaveLength(1);
    expect(rpcs[0]!.fn).toBe("replace_submission_chunks");
    expect(rpcs[0]!.args.p_evaluation_id).toBe(EVAL_ID);
    expect(rpcs[0]!.args.p_chunks).toEqual([]);
    expect(rpcs[0]!.args.p_citations).toEqual([]);

    // pending -> running -> complete still fires.
    const statuses = statusUpserts(calls).map((c) => c.row.status);
    expect(statuses).toEqual(["pending", "running", "complete"]);
  });

  it("RPC failure -> writes status='error' and throws", async () => {
    const { envelope, perPolicy } = makeEnvelopeWithSlices();
    const { client, calls } = makeMockClient({
      rpcError: "rpc_boom",
    });

    await expect(
      indexSubmissionChunksFromEnvelope({
        client,
        evaluationId: EVAL_ID,
        rawEnvelope: envelope,
        perPolicyResults: perPolicy,
      }),
    ).rejects.toThrow(/submission_chunks_indexing_failed/);

    const statusErr = statusUpserts(calls).pop();
    expect(statusErr!.row.status).toBe("error");
    expect(statusErr!.row.error_message).toEqual(
      expect.stringContaining("rpc_boom"),
    );
  });

  it("RPC failure on missing-slices DELETE path -> writes status='error' and throws", async () => {
    const { client, calls } = makeMockClient({
      rpcError: "rpc_boom_delete",
    });
    await expect(
      indexSubmissionChunksFromEnvelope({
        client,
        evaluationId: EVAL_ID,
        rawEnvelope: { schema_version: "0.0.1" },
        perPolicyResults: [],
      }),
    ).rejects.toThrow(/submission_chunks_indexing_failed/);

    const statusErr = statusUpserts(calls).pop();
    expect(statusErr!.row.status).toBe("error");
  });

  it("status-write failure is propagated via IndexResult.statusWriteError on the happy path (Round 2 / IMPORTANT 4)", async () => {
    const { envelope, perPolicy } = makeEnvelopeWithSlices();
    const { client } = makeMockClient({
      statusUpsertError: "status_upsert_boom",
    });

    const result = await indexSubmissionChunksFromEnvelope({
      client,
      evaluationId: EVAL_ID,
      rawEnvelope: envelope,
      perPolicyResults: perPolicy,
    });

    // Data write succeeded (RPC was fine) but the status table writes failed.
    expect(result.chunkRows).toBe(2);
    expect(result.citationRows).toBe(2);
    expect(result.statusWriteError).toBe("status_upsert_boom");
  });
});

describe("runIndexerNonBlocking", () => {
  it("returns {ok:true,result} on success; result carries null statusWriteError", async () => {
    const { envelope, perPolicy } = makeEnvelopeWithSlices();
    const { client } = makeMockClient();
    const out = await runIndexerNonBlocking({
      client,
      evaluationId: EVAL_ID,
      rawEnvelope: envelope,
      perPolicyResults: perPolicy,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.chunkRows).toBe(2);
      expect(out.result.statusWriteError).toBeNull();
    }
  });

  it("returns {ok:false,error} on indexer failure; does NOT rethrow", async () => {
    const { envelope, perPolicy } = makeEnvelopeWithSlices();
    const { client, calls } = makeMockClient({
      rpcError: "rpc_failure",
    });
    const out = await runIndexerNonBlocking({
      client,
      evaluationId: EVAL_ID,
      rawEnvelope: envelope,
      perPolicyResults: perPolicy,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error).toMatch(/rpc_failure/);
    }
    // Status row reflects the error transition (written by the inner indexer
    // OR by the defence-in-depth catch in runIndexerNonBlocking).
    const statusErr = statusUpserts(calls).pop();
    expect(statusErr!.row.status).toBe("error");
  });

  it("preserves prior status-write error on RPC failure even if final defensive error-status write succeeds (Round 3 / IMPORTANT 4 residual)", async () => {
    // Simulate: running status-write fails, RPC then fails, and the
    // defensive error-status writes succeed. Previously this combination
    // silently dropped the prior running-write failure because the inner
    // catch reset `lastStatusWriteError` via a successful error-status
    // write and runIndexerNonBlocking started its own fresh
    // `statusWriteError = null`. After the Option-A fix the prior error
    // is attached to the thrown Error and surfaced in the result.
    const { envelope, perPolicy } = makeEnvelopeWithSlices();
    const { client } = makeMockClient({
      rpcError: "rpc_boom",
      statusUpsertErrorByStatus: {
        running: "running_upsert_boom",
      },
    });
    const out = await runIndexerNonBlocking({
      client,
      evaluationId: EVAL_ID,
      rawEnvelope: envelope,
      perPolicyResults: perPolicy,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error).toMatch(/rpc_boom/);
      // The CRITICAL assertion: prior status-write error is NOT null even
      // though the final defensive error-status write succeeded.
      expect(out.statusWriteError).toBe("running_upsert_boom");
    }
  });
});
