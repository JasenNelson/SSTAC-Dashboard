// Route-level unit tests for POST /api/engine-v2/projects/[id]/extract.
//
// L1-3 retro: gaps in extraction flow test coverage.
//
// Covers silent-error and edge-case paths:
//   1. Zero-file guard -- 400 when no active files exist for the project.
//   2. Race-condition idempotency -- 409 when a non-terminal run already exists (23505).
//   3. Materialization failure -- 500, run transitions to 'error', quarantine fires.
//   4. Subprocess spawn failure -- 500, run transitions to 'error', quarantine fires.
//   5. LOCAL_ENGINE_ENABLED gate -- 503 when env var is not 'true'.
//   6. Submission files query failure -- 500 surfaces the DB error detail.
//
// Testing strategy: mock all external dependencies (Supabase client, materializeToLocal,
// spawnExtractor, quarantineUploadsDir). Assert on HTTP status, response body, and
// Supabase mutation calls.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

// --- Module mocks (must be hoisted before imports) ---

vi.mock("@/lib/engine-v2/admin_guards", () => ({
  requireAdminForApi: vi.fn(),
}));
vi.mock("@/lib/engine-v2/csrf", () => ({
  checkCsrf: vi.fn(),
}));
vi.mock("@/lib/engine-v2/storage_materialize", () => ({
  materializeToLocal: vi.fn(),
  quarantineUploadsDir: vi.fn(),
}));
vi.mock("@/lib/engine-v2/spawn_extraction", () => ({
  spawnExtractor: vi.fn(),
}));

import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import { materializeToLocal, quarantineUploadsDir } from "@/lib/engine-v2/storage_materialize";
import { spawnExtractor } from "@/lib/engine-v2/spawn_extraction";
import { POST } from "../route";

// --- Helpers ---

const PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RUN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EXISTING_RUN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const FILE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

type MockFn = ReturnType<typeof vi.fn>;

function makeCtx(projectId = PROJECT_ID) {
  return { params: Promise.resolve({ id: projectId }) };
}

function makeReq(): import("next/server").NextRequest {
  return {
    headers: new Headers({
      "content-type": "application/json",
      origin: "https://test",
    }),
    nextUrl: { origin: "https://test" } as never,
    async json() {
      return {};
    },
  } as unknown as import("next/server").NextRequest;
}

type UpdateSpyFn = (patch: unknown) => { eq: (col: string, val: unknown) => Promise<{ data: null; error: null }> };

interface ClientBuilders {
  projectRow?: { id: string; user_id: string } | null;
  projectErr?: { message: string };
  filesRows?: Array<{ id: string; storage_path: string; mime_type: string; original_filename: string }>;
  filesErr?: { message: string };
  insertRunErr?: { code?: string; message?: string } | null;
  insertRunRow?: { id: string; status: string } | null;
  existingRunRow?: { id: string; status: string } | null;
  existingRunErr?: { message: string };
  updateCallSpy?: UpdateSpyFn;
}

function makeClient(b: ClientBuilders) {
  const defaultUpdate: UpdateSpyFn = (_patch) => ({
    eq: (_col, _val) => Promise.resolve({ data: null, error: null }),
  });
  const updateSpy = b.updateCallSpy ?? defaultUpdate;

  return {
    from(table: string) {
      if (table === "v2_projects") {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() {
            if (b.projectErr) return { data: null, error: b.projectErr };
            return { data: b.projectRow ?? { id: PROJECT_ID, user_id: "u1" }, error: null };
          },
        };
      }
      if (table === "v2_submission_files") {
        return {
          select() { return this; },
          eq() { return this; },
          is() { return this; },
          then(resolve: (v: { data: typeof b.filesRows | null; error: typeof b.filesErr | null }) => void) {
            if (b.filesErr) {
              resolve({ data: null, error: b.filesErr });
            } else {
              resolve({
                data: b.filesRows ?? [
                  {
                    id: FILE_ID,
                    storage_path: `u1/${PROJECT_ID}/${FILE_ID}/${FILE_ID}.pdf`,
                    mime_type: "application/pdf",
                    original_filename: "doc.pdf",
                  },
                ],
                error: null,
              });
            }
          },
        };
      }
      if (table === "v2_extraction_runs") {
        return {
          insert(_payload: unknown) {
            void _payload;
            return {
              select() { return this; },
              async single() {
                if (b.insertRunErr) {
                  return { data: null, error: b.insertRunErr };
                }
                return {
                  data: b.insertRunRow ?? { id: RUN_ID, status: "pending" },
                  error: null,
                };
              },
            };
          },
          select() {
            return {
              eq() { return this; },
              in() { return this; },
              order() { return this; },
              limit() { return this; },
              async maybeSingle() {
                if (b.existingRunErr) return { data: null, error: b.existingRunErr };
                return { data: b.existingRunRow ?? null, error: null };
              },
            };
          },
          update(_patch: unknown) {
            void _patch;
            return updateSpy(_patch);
          },
        };
      }
      return {} as never;
    },
  };
}

async function readJson(res: NextResponse): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

// --- Test setup ---

let savedLocalEngine: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  savedLocalEngine = process.env.LOCAL_ENGINE_ENABLED;
  process.env.LOCAL_ENGINE_ENABLED = "true";

  (checkCsrf as unknown as MockFn).mockReturnValue({ ok: true });
  (quarantineUploadsDir as unknown as MockFn).mockResolvedValue({ moved: true, targetPath: "/quarantine/test" });
  (spawnExtractor as unknown as MockFn).mockResolvedValue({});
  (materializeToLocal as unknown as MockFn).mockResolvedValue(undefined);
});

afterEach(() => {
  if (savedLocalEngine === undefined) {
    delete process.env.LOCAL_ENGINE_ENABLED;
  } else {
    process.env.LOCAL_ENGINE_ENABLED = savedLocalEngine;
  }
});

// --- Tests ---

describe("POST /api/engine-v2/projects/[id]/extract: LOCAL_ENGINE_ENABLED gate", () => {
  it("returns 503 local_engine_disabled when LOCAL_ENGINE_ENABLED is not 'true'", async () => {
    process.env.LOCAL_ENGINE_ENABLED = "false";
    (requireAdminForApi as unknown as MockFn).mockResolvedValue({
      client: makeClient({}),
      user: { id: "u1" },
    });
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(503);
    const body = await readJson(res);
    expect(body.error).toBe("local_engine_disabled");
  });
});

describe("POST /api/engine-v2/projects/[id]/extract: zero-file guard (Finding 80)", () => {
  it("returns 400 no_active_files when project has no active submission files", async () => {
    (requireAdminForApi as unknown as MockFn).mockResolvedValue({
      client: makeClient({ filesRows: [] }),
      user: { id: "u1" },
    });
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toBe("no_active_files");
  });

  it("returns 500 submission_files_query_failed when DB query errors", async () => {
    (requireAdminForApi as unknown as MockFn).mockResolvedValue({
      client: makeClient({ filesErr: { message: "connection refused" } }),
      user: { id: "u1" },
    });
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(500);
    const body = await readJson(res);
    expect(body.error).toBe("submission_files_query_failed");
    // Error detail MUST be surfaced (not swallowed silently).
    expect(body.detail).toBe("connection refused");
  });
});

describe("POST /api/engine-v2/projects/[id]/extract: race-condition idempotency (23505)", () => {
  it("returns 409 with existing run_id when a non-terminal run already exists", async () => {
    (requireAdminForApi as unknown as MockFn).mockResolvedValue({
      client: makeClient({
        insertRunErr: { code: "23505", message: "unique violation" },
        existingRunRow: { id: EXISTING_RUN_ID, status: "extracting" },
      }),
      user: { id: "u1" },
    });
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(409);
    const body = await readJson(res);
    expect(body.run_id).toBe(EXISTING_RUN_ID);
    expect(body.status).toBe("extracting");
  });

  it("returns 500 idempotency_reselect_failed when re-SELECT finds no non-terminal row", async () => {
    (requireAdminForApi as unknown as MockFn).mockResolvedValue({
      client: makeClient({
        insertRunErr: { code: "23505", message: "unique violation" },
        existingRunRow: null,
      }),
      user: { id: "u1" },
    });
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(500);
    const body = await readJson(res);
    expect(body.error).toBe("idempotency_reselect_failed");
    // Detail MUST be surfaced (not swallowed silently).
    expect(body.detail).toBeDefined();
  });
});

describe("POST /api/engine-v2/projects/[id]/extract: materialization failure", () => {
  it("returns 500 materialization_failed and transitions run to error status", async () => {
    const patchCalls: unknown[] = [];
    const updateSpy: UpdateSpyFn = (patch) => {
      patchCalls.push(patch);
      return { eq: (_col, _val) => Promise.resolve({ data: null, error: null }) };
    };

    (requireAdminForApi as unknown as MockFn).mockResolvedValue({
      client: makeClient({ updateCallSpy: updateSpy }),
      user: { id: "u1" },
    });
    (materializeToLocal as unknown as MockFn).mockRejectedValue(
      new Error("materialize_fetch_failed:403:Forbidden"),
    );

    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(500);
    const body = await readJson(res);
    expect(body.error).toBe("materialization_failed");
    // Error detail MUST be surfaced (not silently swallowed).
    expect(typeof body.detail).toBe("string");
    expect((body.detail as string).length).toBeGreaterThan(0);

    // Run row MUST be transitioned to 'error' status.
    expect(patchCalls.some((p) => (p as Record<string, unknown>).status === "error")).toBe(true);

    // Quarantine MUST be fired after materialization failure.
    expect(quarantineUploadsDir).toHaveBeenCalledWith(PROJECT_ID);
  });

  it("quarantine failure does not mask the materialization error response", async () => {
    (requireAdminForApi as unknown as MockFn).mockResolvedValue({
      client: makeClient({}),
      user: { id: "u1" },
    });
    (materializeToLocal as unknown as MockFn).mockRejectedValue(new Error("disk_full"));
    // Quarantine also fails -- should be best-effort and NOT mask the original 500.
    (quarantineUploadsDir as unknown as MockFn).mockRejectedValue(new Error("quarantine_eacces"));

    const res = await POST(makeReq(), makeCtx());
    // Original materialization_failed 500 must still be returned.
    expect(res.status).toBe(500);
    const body = await readJson(res);
    expect(body.error).toBe("materialization_failed");
  });
});

describe("POST /api/engine-v2/projects/[id]/extract: subprocess spawn failure", () => {
  it("returns 500 subprocess_spawn_failed and transitions run to error status", async () => {
    const patchCalls: unknown[] = [];
    const updateSpy: UpdateSpyFn = (patch) => {
      patchCalls.push(patch);
      return { eq: (_col, _val) => Promise.resolve({ data: null, error: null }) };
    };

    (requireAdminForApi as unknown as MockFn).mockResolvedValue({
      client: makeClient({ updateCallSpy: updateSpy }),
      user: { id: "u1" },
    });
    (spawnExtractor as unknown as MockFn).mockRejectedValue(
      new Error("ENOENT: pythonw.exe not found"),
    );

    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(500);
    const body = await readJson(res);
    expect(body.error).toBe("subprocess_spawn_failed");
    // Error detail MUST be surfaced (not swallowed silently).
    expect(typeof body.detail).toBe("string");
    expect((body.detail as string).length).toBeGreaterThan(0);

    // Run row MUST be transitioned to 'error' on spawn failure.
    expect(patchCalls.some((p) => (p as Record<string, unknown>).status === "error")).toBe(true);

    // Quarantine MUST fire on spawn failure.
    expect(quarantineUploadsDir).toHaveBeenCalledWith(PROJECT_ID);
  });
});
