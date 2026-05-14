import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Readable } from "stream";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  materializeToLocal,
  quarantineUploadsDir,
} from "../storage_materialize";

// Mock global fetch so tests run without a real network.
// Each test configures fetchMock to return bytes or an error.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// Helper: build a mock ReadableStream (WHATWG) from a Uint8Array.
// materializeToLocal uses Readable.fromWeb(response.body), so we need
// a WHATWG-compatible ReadableStream that Readable.fromWeb can wrap.
function makeReadableStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

// Build a minimal mock SupabaseClient for the new streaming implementation.
// The new materializeToLocal calls createSignedUrl (not download).
function makeClient(opts: {
  signedUrl?: string;
  signedError?: { message: string } | null;
  recordCall?: (storagePath: string) => void;
}): SupabaseClient {
  return {
    storage: {
      from(bucket: string) {
        if (bucket !== "v2-submissions") {
          throw new Error(`unexpected bucket: ${bucket}`);
        }
        return {
          async createSignedUrl(p: string, _ttl: number) {
            opts.recordCall?.(p);
            if (opts.signedError) {
              return { data: null, error: opts.signedError };
            }
            return {
              data: { signedUrl: opts.signedUrl ?? "https://example.com/signed" },
              error: null,
            };
          },
        };
      },
    },
  } as unknown as SupabaseClient;
}

// Configure fetchMock to respond with bytes.
function mockFetchWithBytes(bytes: Uint8Array): void {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    statusText: "OK",
    body: makeReadableStream(bytes),
  });
}

// Configure fetchMock to return a non-2xx error response.
function mockFetchError(status: number, statusText: string): void {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status,
    statusText,
    body: null,
  });
}

async function makeTmpDir(label: string): Promise<string> {
  const root = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), `engine-v2-${label}-`),
  );
  return root;
}

async function rimraf(p: string): Promise<void> {
  await fs.promises.rm(p, { recursive: true, force: true }).catch(() => {
    /* best-effort */
  });
}

describe("materializeToLocal (streaming, L1-6 BLOCKER #3 fix)", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await makeTmpDir("materialize");
    fetchMock.mockReset();
  });

  afterEach(async () => {
    await rimraf(tmp);
    vi.restoreAllMocks();
  });

  it("streams a response body and writes bytes to localPath", async () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // %PDF-1
    const client = makeClient({ signedUrl: "https://example.com/test.pdf" });
    mockFetchWithBytes(bytes);

    const localPath = path.join(tmp, "out", "abc.pdf");
    await materializeToLocal(client, "user1/project1/abc/abc.pdf", localPath);

    const written = await fs.promises.readFile(localPath);
    expect(Array.from(written)).toEqual(Array.from(bytes));
  });

  it("mkdir-recursive's the parent dir when it does not exist (Finding 34)", async () => {
    const client = makeClient({});
    mockFetchWithBytes(new Uint8Array([1, 2, 3]));
    const deepPath = path.join(tmp, "a", "b", "c", "d", "out.pdf");
    expect(fs.existsSync(path.dirname(deepPath))).toBe(false);

    await materializeToLocal(client, "user/project/file/file.pdf", deepPath);

    expect(fs.existsSync(deepPath)).toBe(true);
  });

  it("throws when createSignedUrl returns an error", async () => {
    const client = makeClient({ signedError: { message: "rls_blocked" } });
    const localPath = path.join(tmp, "x.pdf");

    await expect(
      materializeToLocal(client, "user/project/file/file.pdf", localPath),
    ).rejects.toThrow(/materialize_signed_url_failed/);
    expect(fs.existsSync(localPath)).toBe(false);
  });

  it("throws when the signed URL fetch returns a non-2xx response", async () => {
    const client = makeClient({ signedUrl: "https://example.com/gone.pdf" });
    mockFetchError(403, "Forbidden");
    const localPath = path.join(tmp, "forbidden.pdf");

    await expect(
      materializeToLocal(client, "user/project/file/file.pdf", localPath),
    ).rejects.toThrow(/materialize_fetch_failed:403/);
    // Partial file must be cleaned up (Finding 30).
    expect(fs.existsSync(localPath)).toBe(false);
  });

  it("passes the storage_path through to createSignedUrl()", async () => {
    const recorded: string[] = [];
    const client = makeClient({
      signedUrl: "https://example.com/ok.pdf",
      recordCall: (p) => recorded.push(p),
    });
    mockFetchWithBytes(new Uint8Array([0]));

    const localPath = path.join(tmp, "y.pdf");
    await materializeToLocal(client, "u/p/f/f.pdf", localPath);
    expect(recorded).toEqual(["u/p/f/f.pdf"]);
  });

  it("unlinks partial file when the pipeline fails mid-stream (Finding 30)", async () => {
    const client = makeClient({ signedUrl: "https://example.com/partial.pdf" });

    // Return a stream that errors mid-way.
    const erroringStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.error(new Error("network_drop"));
      },
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      body: erroringStream,
    });

    const localPath = path.join(tmp, "partial.pdf");
    await expect(
      materializeToLocal(client, "u/p/f/partial.pdf", localPath),
    ).rejects.toThrow();

    // Partial file must be cleaned up.
    expect(fs.existsSync(localPath)).toBe(false);
  });

  // Memory-bounded regression test (L1-6 BLOCKER #3): streaming should NOT cause
  // heap growth proportional to the file size. We use a 100MB synthetic stream
  // and verify that heap growth stays well below 100MB.
  //
  // Node's streaming pipeline reads in chunks; the GC may not have run by the
  // time we measure, so we use a generous 70MB ceiling (not 50MB) to avoid
  // flakiness on CI while still catching a full-buffer regression.
  it("does not buffer a large (100 MB) file in the heap (streaming regression)", async () => {
    const FILE_SIZE = 100 * 1024 * 1024; // 100 MB
    const HEAP_CEILING_BYTES = 70 * 1024 * 1024; // 70 MB growth ceiling

    const client = makeClient({ signedUrl: "https://example.com/large.pdf" });

    // Build a large ReadableStream from small chunks without allocating a 100MB
    // monolithic buffer (which would defeat the test).
    const CHUNK_SIZE = 64 * 1024; // 64 KB chunks
    let sent = 0;
    const largeSteam = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= FILE_SIZE) {
          controller.close();
          return;
        }
        const remaining = FILE_SIZE - sent;
        const toSend = Math.min(CHUNK_SIZE, remaining);
        controller.enqueue(new Uint8Array(toSend));
        sent += toSend;
      },
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      body: largeSteam,
    });

    const localPath = path.join(tmp, "large.pdf");

    // Force GC before measuring (Node may not expose gc() in all environments).
    if (typeof global.gc === "function") global.gc();
    const memBefore = process.memoryUsage();

    await materializeToLocal(client, "large/file.pdf", localPath);

    if (typeof global.gc === "function") global.gc();
    const memAfter = process.memoryUsage();

    // Verify the file was written correctly.
    const stat = await fs.promises.stat(localPath);
    expect(stat.size).toBe(FILE_SIZE);

    // Check BOTH heap (V8 objects) AND external/arrayBuffers (Buffer/ArrayBuffer backing
    // store) for growth. A full-buffer implementation would spike one or both. The ceiling
    // is generous (70MB) to account for streaming chunk overlap and GC timing.
    const heapGrowth = memAfter.heapUsed - memBefore.heapUsed;
    const externalGrowth = memAfter.external - memBefore.external;
    const arrayBuffersGrowth = memAfter.arrayBuffers - memBefore.arrayBuffers;

    // At least one dimension must be below ceiling -- if all were >= ceiling, the entire
    // 100MB file is being held in memory simultaneously.
    const maxGrowth = Math.max(heapGrowth, externalGrowth, arrayBuffersGrowth);
    expect(maxGrowth).toBeLessThan(HEAP_CEILING_BYTES);
  }, 30000); // 30s timeout for large file write
});

describe("quarantineUploadsDir (Findings 38, 49, 54, 62)", () => {
  let stagingRoot: string;
  let originalEnv: string | undefined;
  const projectId = "11111111-2222-3333-4444-555555555555";

  beforeEach(async () => {
    stagingRoot = await makeTmpDir("quarantine-base");
    originalEnv = process.env.REG_REVIEW_ENGINE_V2_BASE_PATH;
    process.env.REG_REVIEW_ENGINE_V2_BASE_PATH = stagingRoot;
  });

  afterEach(async () => {
    if (originalEnv === undefined) {
      delete process.env.REG_REVIEW_ENGINE_V2_BASE_PATH;
    } else {
      process.env.REG_REVIEW_ENGINE_V2_BASE_PATH = originalEnv;
    }
    await rimraf(stagingRoot);
  });

  function uploadsPathFor(p: string): string {
    return path.join(stagingRoot, "data", "v2_dashboard_uploads", p);
  }

  it("returns {moved:false, reason:'source_missing'} when source absent (Finding 62; NO throw)", async () => {
    // Don't create any source dir. The helper must not throw.
    const r = await quarantineUploadsDir(projectId);
    expect(r.moved).toBe(false);
    expect(r.reason).toBe("source_missing");
    expect(r.targetPath).toBeUndefined();
  });

  it("moves source to quarantine when present", async () => {
    const source = uploadsPathFor(projectId);
    await fs.promises.mkdir(source, { recursive: true });
    const sentinel = path.join(source, "marker.txt");
    await fs.promises.writeFile(sentinel, "hello");

    const r = await quarantineUploadsDir(projectId);
    expect(r.moved).toBe(true);
    expect(r.targetPath).toBeTruthy();
    expect(fs.existsSync(source)).toBe(false);
    expect(fs.existsSync(r.targetPath!)).toBe(true);
    const movedMarker = path.join(r.targetPath!, "marker.txt");
    expect(fs.existsSync(movedMarker)).toBe(true);
    const contents = await fs.promises.readFile(movedMarker, "utf-8");
    expect(contents).toBe("hello");

    // The target must be under the quarantine base.
    const quarBase = uploadsPathFor("_quarantine");
    expect(r.targetPath!.startsWith(quarBase)).toBe(true);
  });

  it("creates the quarantine base dir if it does not exist", async () => {
    const source = uploadsPathFor(projectId);
    await fs.promises.mkdir(source, { recursive: true });
    // quarantine base does NOT yet exist.
    const quarBase = uploadsPathFor("_quarantine");
    expect(fs.existsSync(quarBase)).toBe(false);

    const r = await quarantineUploadsDir(projectId);
    expect(r.moved).toBe(true);
    expect(fs.existsSync(quarBase)).toBe(true);
  });

  it("is idempotent on quarantine base mkdir when it already exists", async () => {
    const source = uploadsPathFor(projectId);
    await fs.promises.mkdir(source, { recursive: true });
    const quarBase = uploadsPathFor("_quarantine");
    await fs.promises.mkdir(quarBase, { recursive: true });

    const r = await quarantineUploadsDir(projectId);
    expect(r.moved).toBe(true);
    expect(fs.existsSync(quarBase)).toBe(true);
  });

  it("throws on containment violation when source resolves outside uploads base", async () => {
    // Build a project-id-like string that contains '..' segments. path.resolve will
    // normalize it OUT of the uploads base, so the helper's isContained check should
    // refuse the move. (Real callers pass UUIDs; this defends against a future bug.)
    const traversalId = path.join("..", "..", "evil");

    // We must pre-create the resolved source so step "source missing" doesn't trigger
    // first. Resolved source for this traversalId lands outside the staging root, so
    // it's hard to materialize without polluting an unrelated dir. Instead, point the
    // env BASE at a deeper subdir and use the traversal to escape that inner base into
    // the outer tmp.
    const innerBase = path.join(stagingRoot, "inner");
    await fs.promises.mkdir(innerBase, { recursive: true });
    process.env.REG_REVIEW_ENGINE_V2_BASE_PATH = innerBase;
    const innerUploads = path.join(innerBase, "data", "v2_dashboard_uploads");
    await fs.promises.mkdir(innerUploads, { recursive: true });
    // Pre-create the resolved-outside dir so stat() succeeds and we reach the isContained check.
    const escapedDir = path.resolve(innerUploads, traversalId);
    await fs.promises.mkdir(escapedDir, { recursive: true });

    await expect(quarantineUploadsDir(traversalId)).rejects.toThrow(
      /containment_violation/,
    );

    // Cleanup the escaped dir we created.
    await rimraf(escapedDir);
  });
});
