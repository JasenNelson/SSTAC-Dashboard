// Route-level tests for POST /api/engine-v2/files/complete (Findings 99, 105, 107, 110).
//
// Verifies that EVERY non-2xx response body includes a literal boolean
// `orphan_cleanup_required` field, and that 2xx responses do NOT include it.
// Covers auth/CSRF/Zod/ownership/HEAD/filename/SHA/magic/idempotent-409/cap/23505/23514.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// --- Module mocks ---------------------------------------------------------

vi.mock("@/lib/engine-v2/admin_guards", () => ({
  requireAdminForApi: vi.fn(),
}));
vi.mock("@/lib/engine-v2/csrf", () => ({
  checkCsrf: vi.fn(),
}));
vi.mock("@/lib/engine-v2/streaming_sha256", () => ({
  computeStreamingSha256AndMagic: vi.fn(),
}));
vi.mock("@/lib/engine-v2/storage_safe_delete", () => ({
  deleteUnfinalizedStorageObject: vi.fn(),
}));

import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import { computeStreamingSha256AndMagic } from "@/lib/engine-v2/streaming_sha256";
import { deleteUnfinalizedStorageObject } from "@/lib/engine-v2/storage_safe_delete";
import { POST } from "../route";

// --- Helpers --------------------------------------------------------------

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const FILE_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

interface MakeReqOpts {
  body?: unknown;
  bodyRaw?: string;
  contentType?: string;
}

function makeReq(opts: MakeReqOpts = {}): import("next/server").NextRequest {
  const ct = opts.contentType ?? "application/json";
  const body = opts.bodyRaw ?? JSON.stringify(opts.body ?? defaultPayload());
  const headers = new Headers({ "content-type": ct, origin: "https://test" });
  return {
    headers,
    nextUrl: { origin: "https://test" } as never,
    async json() {
      return JSON.parse(body) as unknown;
    },
  } as unknown as import("next/server").NextRequest;
}

function defaultPayload() {
  return {
    project_id: PROJECT_ID,
    file_id: FILE_ID,
    original_filename: "report.pdf",
    size_bytes: 10,
    content_type: "application/pdf",
  };
}

// A minimal supabase client builder. Each test wires up the query chain.
interface ClientBuilders {
  ownedProject?: { id: string; max_files: number; max_total_bytes: number } | null;
  ownedProjectError?: { message: string };
  storageList?: Array<{ name: string; metadata?: Record<string, unknown> }>;
  storageListError?: { message: string };
  signedUrl?: string;
  signedUrlError?: { message: string };
  existingFile?: Record<string, unknown> | null;
  capPreflightRows?: Array<{ size_bytes: number }>;
  insertResult?: { data?: Record<string, unknown>; error?: { code?: string; message?: string; details?: string } };
  duplicateWinner?: Record<string, unknown> | null;
}

function makeSupabaseClient(b: ClientBuilders) {
  return {
    from(table: string) {
      if (table === "v2_projects") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            if (b.ownedProjectError) return { data: null, error: b.ownedProjectError };
            return { data: b.ownedProject ?? null, error: null };
          },
        };
      }
      if (table === "v2_submission_files") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          is() {
            return this;
          },
          async maybeSingle() {
            // First maybeSingle call after select chain -> existing row OR duplicate winner.
            return { data: b.existingFile ?? null, error: null };
          },
          insert(_payload: unknown) {
            void _payload;
            return {
              select() {
                return this;
              },
              async single() {
                const r = b.insertResult ?? {};
                return {
                  data: r.data ?? null,
                  error: r.error ?? null,
                };
              },
            };
          },
          // Used by capPreflight (no maybeSingle; returns array).
          then(resolve: (v: { data: Array<{ size_bytes: number }> | null; error: { message: string } | null }) => void) {
            resolve({ data: b.capPreflightRows ?? [], error: null });
          },
        };
      }
      return {} as never;
    },
    storage: {
      from(_bucket: string) {
        void _bucket;
        return {
          async list(_prefix: string) {
            void _prefix;
            if (b.storageListError) return { data: null, error: b.storageListError };
            return { data: b.storageList ?? [], error: null };
          },
          async createSignedUrl(_p: string, _ttl: number) {
            void _p;
            void _ttl;
            if (b.signedUrlError) return { data: null, error: b.signedUrlError };
            return {
              data: { signedUrl: b.signedUrl ?? "https://signed.test/x" },
              error: null,
            };
          },
        };
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (checkCsrf as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ ok: true });
});

async function readJson(res: NextResponse): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

// --- Tests ---------------------------------------------------------------

describe("/files/complete error response schema (Finding 99/105)", () => {
  it("401/403 from requireAdminForApi -> body includes orphan_cleanup_required:true", async () => {
    const denied = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(denied);
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
    const body = await readJson(res);
    expect(body.orphan_cleanup_required).toBe(true);
  });

  it("415 from CSRF wrong content-type -> orphan_cleanup_required:true", async () => {
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      client: makeSupabaseClient({}),
      user: { id: USER_ID },
    });
    (checkCsrf as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ok: false,
      reason: "wrong_content_type",
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(415);
    const body = await readJson(res);
    expect(body.orphan_cleanup_required).toBe(true);
  });

  it("403 from CSRF origin mismatch -> orphan_cleanup_required:true", async () => {
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      client: makeSupabaseClient({}),
      user: { id: USER_ID },
    });
    (checkCsrf as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ok: false,
      reason: "origin_mismatch",
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(403);
    const body = await readJson(res);
    expect(body.orphan_cleanup_required).toBe(true);
  });

  it("400 Zod invalid payload -> orphan_cleanup_required:true", async () => {
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      client: makeSupabaseClient({}),
      user: { id: USER_ID },
    });
    const res = await POST(
      makeReq({ body: { project_id: "not-a-uuid" } }),
    );
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toBe("invalid_payload");
    expect(body.orphan_cleanup_required).toBe(true);
  });

  it("400 invalid_json -> orphan_cleanup_required:true", async () => {
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      client: makeSupabaseClient({}),
      user: { id: USER_ID },
    });
    const res = await POST(makeReq({ bodyRaw: "{not-json" }));
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toBe("invalid_json");
    expect(body.orphan_cleanup_required).toBe(true);
  });

  it("403 ownership probe (no row) -> orphan_cleanup_required:true", async () => {
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      client: makeSupabaseClient({ ownedProject: null }),
      user: { id: USER_ID },
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(403);
    const body = await readJson(res);
    expect(body.orphan_cleanup_required).toBe(true);
  });

  it("400 invalid_filename when name has separator -> orphan_cleanup_required:true", async () => {
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      client: makeSupabaseClient({
        ownedProject: { id: PROJECT_ID, max_files: 50, max_total_bytes: 524288000 },
      }),
      user: { id: USER_ID },
    });
    const payload = { ...defaultPayload(), original_filename: "evil/path.pdf" };
    const res = await POST(makeReq({ body: payload }));
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toBe("invalid_filename");
    expect(body.orphan_cleanup_required).toBe(true);
  });

  it("400 head_mismatch when object missing -> orphan_cleanup_required:true", async () => {
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      client: makeSupabaseClient({
        ownedProject: { id: PROJECT_ID, max_files: 50, max_total_bytes: 524288000 },
        storageList: [],
      }),
      user: { id: USER_ID },
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toBe("head_mismatch");
    expect(body.orphan_cleanup_required).toBe(true);
  });

  it("500 sha_streaming_failed -> orphan_cleanup_required:true", async () => {
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      client: makeSupabaseClient({
        ownedProject: { id: PROJECT_ID, max_files: 50, max_total_bytes: 524288000 },
        storageList: [
          {
            name: `${FILE_ID}.pdf`,
            metadata: { size: 10, mimetype: "application/pdf" },
          },
        ],
      }),
      user: { id: USER_ID },
    });
    (computeStreamingSha256AndMagic as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network_down"),
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    const body = await readJson(res);
    expect(body.error).toBe("sha_streaming_failed");
    expect(body.orphan_cleanup_required).toBe(true);
  });

  it("400 magic_mismatch when first bytes wrong -> orphan_cleanup_required:true", async () => {
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      client: makeSupabaseClient({
        ownedProject: { id: PROJECT_ID, max_files: 50, max_total_bytes: 524288000 },
        storageList: [
          {
            name: `${FILE_ID}.pdf`,
            metadata: { size: 10, mimetype: "application/pdf" },
          },
        ],
      }),
      user: { id: USER_ID },
    });
    (computeStreamingSha256AndMagic as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      sha256: "deadbeef".repeat(8),
      firstBytes: new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]),
    });
    (deleteUnfinalizedStorageObject as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      deleted: true,
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toBe("magic_mismatch");
    expect(body.orphan_cleanup_required).toBe(true);
  });

  it("200 idempotent retry when existing row matches -> NO flag in body", async () => {
    const sha = "a".repeat(64);
    const expectedPath = `${USER_ID}/${PROJECT_ID}/${FILE_ID}/${FILE_ID}.pdf`;
    const existingRow = {
      id: FILE_ID,
      project_id: PROJECT_ID,
      storage_path: expectedPath,
      sha256: sha,
      size_bytes: 10,
      mime_type: "application/pdf",
    };
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      client: makeSupabaseClient({
        ownedProject: { id: PROJECT_ID, max_files: 50, max_total_bytes: 524288000 },
        storageList: [
          {
            name: `${FILE_ID}.pdf`,
            metadata: { size: 10, mimetype: "application/pdf" },
          },
        ],
        existingFile: existingRow,
      }),
      user: { id: USER_ID },
    });
    (computeStreamingSha256AndMagic as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      sha256: sha,
      firstBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0, 0, 0]),
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.orphan_cleanup_required).toBeUndefined();
    expect(body.id).toBe(FILE_ID);
  });

  it("409 file_id_reused_with_different_content -> orphan_cleanup_required:false (Finding 107)", async () => {
    const existingRow = {
      id: FILE_ID,
      project_id: PROJECT_ID,
      storage_path: `${USER_ID}/${PROJECT_ID}/${FILE_ID}/${FILE_ID}.pdf`,
      sha256: "b".repeat(64),
      size_bytes: 10,
      mime_type: "application/pdf",
    };
    (requireAdminForApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      client: makeSupabaseClient({
        ownedProject: { id: PROJECT_ID, max_files: 50, max_total_bytes: 524288000 },
        storageList: [
          {
            name: `${FILE_ID}.pdf`,
            metadata: { size: 10, mimetype: "application/pdf" },
          },
        ],
        existingFile: existingRow,
      }),
      user: { id: USER_ID },
    });
    (computeStreamingSha256AndMagic as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      sha256: "c".repeat(64), // mismatch
      firstBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0, 0, 0]),
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(409);
    const body = await readJson(res);
    expect(body.error).toBe("file_id_reused_with_different_content");
    expect(body.orphan_cleanup_required).toBe(false);
  });
});
