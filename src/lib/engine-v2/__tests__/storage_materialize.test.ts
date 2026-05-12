import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  materializeToLocal,
  quarantineUploadsDir,
} from "../storage_materialize";

// Build a minimal mock SupabaseClient that returns a Blob-like from
// .from('v2-submissions').download(). We deliberately mint a duck-typed object with
// .arrayBuffer() rather than constructing a real Blob, because jsdom in some versions
// does not provide Blob.prototype.arrayBuffer().
interface BlobLike {
  arrayBuffer(): Promise<ArrayBuffer>;
}
function blobFromBytes(bytes: Uint8Array): BlobLike {
  // Copy into a fresh ArrayBuffer so it survives across the boundary.
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return {
    async arrayBuffer() {
      return copy.buffer;
    },
  };
}
function makeClient(opts: {
  blob?: BlobLike;
  error?: { message: string } | null;
  recordCall?: (path: string) => void;
}): SupabaseClient {
  return {
    storage: {
      from(bucket: string) {
        if (bucket !== "v2-submissions") {
          throw new Error(`unexpected bucket: ${bucket}`);
        }
        return {
          async download(p: string) {
            opts.recordCall?.(p);
            if (opts.error) {
              return { data: null, error: opts.error };
            }
            return {
              data: opts.blob ?? blobFromBytes(new Uint8Array()),
              error: null,
            };
          },
        };
      },
    },
  } as unknown as SupabaseClient;
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

describe("materializeToLocal (Findings 29, 30, 34)", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await makeTmpDir("materialize");
  });

  afterEach(async () => {
    await rimraf(tmp);
  });

  it("downloads a Blob and writes bytes to localPath", async () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    const blob = blobFromBytes(bytes);
    const client = makeClient({ blob });

    const localPath = path.join(tmp, "out", "abc.pdf");
    await materializeToLocal(client, "user1/project1/abc/abc.pdf", localPath);

    const written = await fs.promises.readFile(localPath);
    expect(Array.from(written)).toEqual(Array.from(bytes));
  });

  it("mkdir-recursive's the parent dir when it does not exist (Finding 34)", async () => {
    const client = makeClient({ blob: blobFromBytes(new Uint8Array([1, 2, 3])) });
    const deepPath = path.join(tmp, "a", "b", "c", "d", "out.pdf");
    expect(fs.existsSync(path.dirname(deepPath))).toBe(false);

    await materializeToLocal(client, "user/project/file/file.pdf", deepPath);

    expect(fs.existsSync(deepPath)).toBe(true);
  });

  it("throws when supabase download returns an error", async () => {
    const client = makeClient({ error: { message: "rls_blocked" } });
    const localPath = path.join(tmp, "x.pdf");
    await expect(
      materializeToLocal(client, "user/project/file/file.pdf", localPath),
    ).rejects.toThrow(/materialize_download_failed/);
    expect(fs.existsSync(localPath)).toBe(false);
  });

  it("passes the storage_path through to download()", async () => {
    const recorded: string[] = [];
    const client = makeClient({
      blob: blobFromBytes(new Uint8Array([0])),
      recordCall: (p) => recorded.push(p),
    });
    const localPath = path.join(tmp, "y.pdf");
    await materializeToLocal(client, "u/p/f/f.pdf", localPath);
    expect(recorded).toEqual(["u/p/f/f.pdf"]);
  });

  it("unlinks partial file when fs.writeFile throws (Finding 30)", async () => {
    const client = makeClient({ blob: blobFromBytes(new Uint8Array([1, 2])) });
    const localPath = path.join(tmp, "partial.pdf");
    // Pre-create the parent dir; then make writeFile throw via vi.spyOn.
    await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
    // Pretouch the file so we can verify unlink ran (after the simulated failure).
    await fs.promises.writeFile(localPath, Buffer.from([0xff]));

    const writeSpy = vi
      .spyOn(fs.promises, "writeFile")
      .mockImplementationOnce(async () => {
        throw new Error("disk_full");
      });

    try {
      await expect(
        materializeToLocal(client, "u/p/f/f.pdf", localPath),
      ).rejects.toThrow(/disk_full/);
    } finally {
      writeSpy.mockRestore();
    }
    // Either the unlink succeeded (file gone) or the pretouched file was removed.
    expect(fs.existsSync(localPath)).toBe(false);
  });
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
