// Route-level tests for POST /api/engine-v2/projects/[id]/evaluation/[evalId]/memo.
//
// Covers the cache-invalidation logic added in Option A (2026-06-02):
//   - A cached row whose generator_version matches MEMO_GENERATOR_VERSION is
//     returned as a cache hit (no rebuild).
//   - A cached row whose generator_version is STALE (old value) is treated as
//     a cache MISS -- the route must regenerate the memo, not return the stale
//     blob. This is the regression this test suite was written to guard.
//   - The 23505 same-version concurrent collision path still returns the
//     winner's row as a cache hit.
//
// The route imports buildMemo (generates real .docx via docxjs) which is heavy
// for a unit test. We mock the entire memo_builder module so the POST handler
// can run without spawning a real docx build.
//
// vitest hoists vi.mock calls to the top of the file. String literals must be
// used inside the factory -- no top-level variables may be referenced there.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// Mock memo_builder BEFORE importing the route so the route gets the mock.
// Uses string literals (no const refs) because vi.mock is hoisted.
vi.mock("@/lib/engine-v2/memo_builder", () => ({
  MEMO_GENERATOR_VERSION: "lane2b-memo-v2",
  MemoBuildInvariantError: class MemoBuildInvariantError extends Error {},
  buildMemo: vi.fn().mockResolvedValue({
    bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    contentSha256: "a".repeat(64),
    judgmentSnapshotHash: "b".repeat(64),
    generatorVersion: "lane2b-memo-v2",
  }),
  computeJudgmentSnapshotHash: vi.fn().mockReturnValue("b".repeat(64)),
}));

vi.mock("@/lib/engine-v2/admin_guards", () => ({
  requireAdminForApi: vi.fn(),
}));
vi.mock("@/lib/engine-v2/csrf", () => ({
  checkCsrf: vi.fn(),
}));
vi.mock("@/lib/engine-v2/evidence_slices", () => ({
  extractEvidenceSlices: vi.fn().mockReturnValue(null),
}));
vi.mock("@/lib/engine-v2/bytea_codec", () => ({
  decodeSupabaseBytea: vi.fn(),
  encodeByteaHex: vi.fn().mockReturnValue("\\x504b0304"),
}));

import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import { POST } from "../route";

// --- Constants (local copies; not used inside vi.mock factories) ------------

const CURRENT_VERSION = "lane2b-memo-v2";
const STALE_VERSION = "lane2b-memo-v1";
const SNAPSHOT_HASH = "b".repeat(64);

// --- Fixtures ---------------------------------------------------------------

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const EVAL_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const NOW_ISO = "2026-06-02T10:00:00.000Z";

function makeReq(): import("next/server").NextRequest {
  const headers = new Headers({
    "content-type": "application/json",
    origin: "https://test",
  });
  const url = `https://test/api/engine-v2/projects/${PROJECT_ID}/evaluation/${EVAL_ID}/memo`;
  return {
    headers,
    nextUrl: new URL(url),
    async text() { return "{}"; },
    async json() { return {}; },
  } as unknown as import("next/server").NextRequest;
}

function makeContext(
  id: string,
  evalId: string,
): { params: Promise<{ id: string; evalId: string }> } {
  return { params: Promise.resolve({ id, evalId }) };
}

function evalRow(): Record<string, unknown> {
  return {
    id: EVAL_ID,
    project_id: PROJECT_ID,
    extraction_run_id: null,
    status: "completed",
    run_id_engine: null,
    variant_config_hash: null,
    evaluation_backend: "stub",
    embedder_backend: "stub",
    reranker_backend: "disabled",
    model: null,
    bench_fixture: "bench_test",
    applicability_mode: "off",
    coverage_statement: { total_policies: 1, evaluated: 1, deferred: 0, error: 0 },
    errors: [],
    raw_eval_result_json: null,
    started_at: NOW_ISO,
    completed_at: NOW_ISO,
    updated_at: NOW_ISO,
  };
}

// Supabase client builder.
// cacheRow: the row PHYSICALLY PRESENT in v2_memo_exports for the cache-lookup
//   key. The mock applies the route's actual generator_version filter: if the
//   route added .eq("generator_version", CURRENT_VERSION) and this row's
//   generator_version is stale, the mock returns null (MISS) -- emulating the
//   DB version gate. If the route did NOT add that filter (regression), the
//   stale row leaks through as a HIT and the regression test fails. (null here
//   means no row present at all.)
// insertError: if set, the INSERT returns this error.
// reReadRow: the row returned by the 23505 reread SELECT.
// deleteError: if set, the DELETE returns this error.
// retryInsertError: if set, the retry INSERT returns this error.
interface ClientBuilders {
  cacheRow?: Record<string, unknown> | null;
  cacheError?: { message: string };
  insertError?: { code?: string; message: string };
  reReadRow?: Record<string, unknown> | null;
  reReadError?: { message: string };
  deleteError?: { message: string };
  retryInsertError?: { code?: string; message: string };
  retryReReadRow?: Record<string, unknown> | null;
  retryReReadError?: { message: string };
}

// Spies recorded across the lifetime of one client so tests can assert that
// the version filter and the stale-row delete actually fired.
interface ClientSpy {
  // The eq(col,val) filters recorded on the CACHE-LOOKUP SELECT chain.
  cacheLookupFilters: Array<[string, unknown]>;
  // Ids passed to v2_memo_exports DELETE .eq("id", <id>), in call order.
  deletedIds: string[];
}

function makeSupabaseClient(b: ClientBuilders) {
  let memoInsertCallCount = 0;
  // Track which maybeSingle call within v2_memo_exports we are on
  // (first = cache lookup, second = 23505 reread, third = retry reread).
  let memoMaybeSingleCallCount = 0;

  const spy: ClientSpy = {
    cacheLookupFilters: [],
    deletedIds: [],
  };

  const client = {
    _spy: spy,
    from(table: string) {
      if (table === "v2_projects") {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() {
            return { data: { id: PROJECT_ID, name: "Test" }, error: null };
          },
        };
      }
      if (table === "v2_evaluations") {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() {
            return { data: evalRow(), error: null };
          },
        };
      }
      if (table === "v2_per_policy_results") {
        return {
          select() { return this; },
          eq() { return this; },
          order() { return this; },
          async then(resolve: (val: unknown) => unknown) {
            return resolve({ data: [], error: null });
          },
        };
      }
      if (table === "v2_judgments") {
        return {
          select() { return this; },
          in() { return this; },
          async then(resolve: (val: unknown) => unknown) {
            return resolve({ data: [], error: null });
          },
        };
      }
      if (table === "v2_memo_exports") {
        // Capture outer b and counters via closure.
        const builders = b;
        const getAndIncrMemoMaybeSingle = () => {
          memoMaybeSingleCallCount += 1;
          return memoMaybeSingleCallCount;
        };
        const getAndIncrMemoInsert = () => {
          memoInsertCallCount += 1;
          return memoInsertCallCount;
        };

        // Per-SELECT-chain recorder. Each from("v2_memo_exports") call that
        // builds a SELECT chain accumulates its own eq filters here so the
        // cache-lookup maybeSingle can inspect them (and apply the version
        // gate) and the test can assert the recorded filters.
        const chainFilters: Array<[string, unknown]> = [];

        return {
          select() { return this; },
          eq(col: string, val: unknown) {
            chainFilters.push([col, val]);
            return this;
          },
          async maybeSingle() {
            const callNum = getAndIncrMemoMaybeSingle();
            if (callNum === 1) {
              // Cache lookup. Record the filters this lookup actually applied.
              spy.cacheLookupFilters = [...chainFilters];
              if (builders.cacheError) return { data: null, error: builders.cacheError };
              // Version gate emulation: if the route applied
              // ["generator_version", CURRENT_VERSION], a STALE-version row is
              // filtered OUT (MISS). If the route did NOT apply that filter
              // (regression), the stale row leaks through as a HIT.
              const appliedVersionGate = chainFilters.some(
                ([c, v]) => c === "generator_version" && v === CURRENT_VERSION,
              );
              const row = builders.cacheRow ?? null;
              if (
                row &&
                appliedVersionGate &&
                (row as { generator_version?: string }).generator_version !== undefined &&
                (row as { generator_version?: string }).generator_version !== CURRENT_VERSION
              ) {
                // Stale row filtered out by the version gate -> MISS.
                return { data: null, error: null };
              }
              return { data: row, error: null };
            }
            if (callNum === 2) {
              // 23505 reread.
              if (builders.reReadError) return { data: null, error: builders.reReadError };
              return { data: builders.reReadRow ?? null, error: null };
            }
            // callNum === 3: retry reread after stale-delete + retry-23505.
            if (builders.retryReReadError) return { data: null, error: builders.retryReReadError };
            return { data: builders.retryReReadRow ?? null, error: null };
          },
          insert(_data: unknown) {
            const callNum = getAndIncrMemoInsert();
            return {
              select() { return this; },
              async single() {
                if (callNum === 1 && builders.insertError) {
                  return { data: null, error: builders.insertError };
                }
                if (callNum === 2 && builders.retryInsertError) {
                  return { data: null, error: builders.retryInsertError };
                }
                // Successful insert: return a fresh row.
                return {
                  data: {
                    id: `inserted-memo-${callNum}`,
                    content_sha256: "a".repeat(64),
                    byte_size: 4,
                  },
                  error: null,
                };
              },
            };
          },
          delete() {
            // DELETE .eq("id", existingRow.id). Record the deleted id so the
            // test can assert the stale-row delete fired (or did not).
            const deleteBuilders = builders;
            return {
              eq(_col: string, val: unknown) {
                spy.deletedIds.push(val as string);
                return {
                  async then(resolve: (v: unknown) => unknown) {
                    if (deleteBuilders.deleteError) {
                      return resolve({ error: deleteBuilders.deleteError });
                    }
                    return resolve({ error: null });
                  },
                };
              },
            };
          },
        };
      }
      return {} as never;
    },
  };
  return client;
}

function mockAuthOk(client: ReturnType<typeof makeSupabaseClient>) {
  (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    client,
    user: { id: USER_ID },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (checkCsrf as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ ok: true });
});

// --- Tests ------------------------------------------------------------------

describe("POST /api/engine-v2/projects/[id]/evaluation/[evalId]/memo -- cache version-awareness", () => {
  it("returns cached: true when a current-version row exists (no rebuild)", async () => {
    // The cache SELECT includes .eq('generator_version', CURRENT_VERSION).
    // When the row matches, the route returns it immediately without buildMemo.
    const client = makeSupabaseClient({
      cacheRow: {
        id: "memo-cached-001",
        content_sha256: "c".repeat(64),
        byte_size: 1024,
        judgment_snapshot_hash: SNAPSHOT_HASH,
      },
    });
    mockAuthOk(client);
    const res = await POST(makeReq(), makeContext(PROJECT_ID, EVAL_ID));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.cached).toBe(true);
    expect(body.memo_id).toBe("memo-cached-001");
  });

  it("regenerates when an actual STALE-version row is present -- version gate filters it out (primary regression)", async () => {
    // A row IS physically present in v2_memo_exports for the same
    // (evaluation_id, judgment_snapshot_hash) but with STALE_VERSION. The mock
    // emulates the DB version gate: because the route adds
    // .eq("generator_version", CURRENT_VERSION), this stale row is filtered out
    // (MISS) and the route regenerates. If the route DROPPED the version
    // filter, the mock would return the stale row as a HIT and this test would
    // fail -- which is exactly the guard we want.
    const client = makeSupabaseClient({
      cacheRow: {
        id: "memo-stale-cached-001",
        content_sha256: "f".repeat(64),
        byte_size: 999,
        judgment_snapshot_hash: SNAPSHOT_HASH,
        generator_version: STALE_VERSION,
      },
    });
    mockAuthOk(client);
    const res = await POST(makeReq(), makeContext(PROJECT_ID, EVAL_ID));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    // Regenerated -- NOT the stale cached blob.
    expect(body.cached).toBe(false);
    expect(body.memo_id).not.toBe("memo-stale-cached-001");
    // The cache-lookup chain MUST have applied the version filter. If the route
    // deletes .eq("generator_version", MEMO_GENERATOR_VERSION), this assertion
    // fails (the stale row would have been a hit).
    expect(client._spy.cacheLookupFilters).toContainEqual([
      "generator_version",
      CURRENT_VERSION,
    ]);
  });

  it("23505 same-version concurrent collision: reread returns current-version row as cached: true", async () => {
    // Cache MISS -> INSERT hits 23505 -> reread returns a row with
    // CURRENT_VERSION (concurrent same-version writer won). Route must return
    // it as cached: true without deleting anything.
    const client = makeSupabaseClient({
      cacheRow: null,
      insertError: { code: "23505", message: "unique violation" },
      reReadRow: {
        id: "memo-concurrent-001",
        content_sha256: "d".repeat(64),
        byte_size: 2048,
        generator_version: CURRENT_VERSION,
      },
    });
    mockAuthOk(client);
    const res = await POST(makeReq(), makeContext(PROJECT_ID, EVAL_ID));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.cached).toBe(true);
    expect(body.memo_id).toBe("memo-concurrent-001");
    // Same-version collision must NOT delete the existing (fresh) row.
    expect(client._spy.deletedIds).toEqual([]);
  });

  it("23505 stale-version collision: DELETE stale row + retry INSERT succeeds -> cached: false", async () => {
    // Cache MISS -> INSERT hits 23505 -> reread returns a row with STALE_VERSION.
    // Route must DELETE the stale row and retry the INSERT, which succeeds.
    const client = makeSupabaseClient({
      cacheRow: null,
      insertError: { code: "23505", message: "unique violation" },
      reReadRow: {
        id: "memo-stale-001",
        content_sha256: "e".repeat(64),
        byte_size: 512,
        generator_version: STALE_VERSION,
      },
      // No retryInsertError -- retry INSERT succeeds.
    });
    mockAuthOk(client);
    const res = await POST(makeReq(), makeContext(PROJECT_ID, EVAL_ID));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    // Retry INSERT succeeded with a fresh row.
    expect(body.cached).toBe(false);
    expect(typeof body.memo_id).toBe("string");
    // The stale row's DELETE must have fired exactly once, for its id.
    expect(client._spy.deletedIds).toEqual(["memo-stale-001"]);
  });

  it("23505 stale-version collision, then retry INSERT also 23505: version-gated reread returns the concurrent current-version row -> cached: true, no second delete", async () => {
    // Covers the retry-INSERT-23505 sub-branch: cache MISS -> INSERT 23505 ->
    // reread STALE -> DELETE stale row -> retry INSERT ALSO 23505 (a concurrent
    // same-version writer won the retry) -> version-gated reread finds the
    // current-version row -> return it as cached: true. The stale-row DELETE
    // fired exactly once; the retry-23505 path does NOT delete again.
    const client = makeSupabaseClient({
      cacheRow: null,
      insertError: { code: "23505", message: "unique violation" },
      reReadRow: {
        id: "memo-stale-001",
        content_sha256: "e".repeat(64),
        byte_size: 512,
        generator_version: STALE_VERSION,
      },
      retryInsertError: { code: "23505", message: "unique violation" },
      retryReReadRow: {
        id: "memo-retry-winner-001",
        content_sha256: "a".repeat(64),
        byte_size: 4,
        generator_version: CURRENT_VERSION,
      },
    });
    mockAuthOk(client);
    const res = await POST(makeReq(), makeContext(PROJECT_ID, EVAL_ID));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.cached).toBe(true);
    expect(body.memo_id).toBe("memo-retry-winner-001");
    // Exactly one delete (the stale row); the retry-23505 reread path must not
    // issue a second delete.
    expect(client._spy.deletedIds).toEqual(["memo-stale-001"]);
  });
});
