// engine_v2 frontend Lane 1: materialize Storage objects to local disk + quarantine helper
// (Findings 29, 30, 34, 35, 36, 38, 49, 54, 62).
//
// Module L1-6 calls `materializeToLocal` per file before spawning the Docling subprocess,
// then calls `quarantineUploadsDir` on any error path so the uploads dir is moved to
// `_quarantine/<projectId>_<UTC>/` instead of being left polluting the staging area.
//
// `materializeToLocal` signature (per L1-6 spec): (client, storagePath, localPath). The
// client is an authenticated Supabase server client; storagePath is the v2-submissions
// bucket key; localPath is the absolute destination on disk.
//
// Implementation (L1-6 BLOCKER #3 fix): uses createSignedUrl + native fetch to stream
// the source file to the local tempfile in chunks via stream.pipeline, so 50MB+ PDFs
// do NOT buffer the entire file in the Node heap. The signed URL is valid for 60 seconds
// (sufficient for the pipeline to complete). Parent dir is mkdir-recursive'd before write
// (Finding 34); partial files are unlinked on any error (Finding 30).
//
// `quarantineUploadsDir` contract (Finding 62 locked):
//   - source missing -> { moved: false, reason: 'source_missing' } (NO throw)
//   - containment violation -> THROWS (Finding 15/25)
//   - unexpected fs errors (EACCES, EBUSY, etc.) -> THROWS
//   - happy path -> { moved: true, targetPath }
//
// `.gitignore` for engine_v2 worktree staging dirs is a CROSS-REPO edit that the L1-6
// plan calls out at line 1014; we are intentionally SKIPPING it in this module per the
// allowlist contract (single-repo demo posture). Owner can land that follow-up commit
// in the worktree separately.

import * as fs from "fs";
import * as path from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isContained } from "./path_containment";
import type { QuarantineUploadsDirResult } from "./types";

const BUCKET = "v2-submissions";

function getBasePath(): string {
  return (
    process.env.REG_REVIEW_ENGINE_V2_BASE_PATH ??
    "C:/Projects/Regulatory-Review/engine_v2_dashboard_staging"
  );
}

// Pad to UTC ISO with no characters that NTFS dislikes (no ':' in directory names).
// 2026-05-11T18:30:42.123Z -> 2026-05-11T18-30-42-123Z
function utcStampForPath(d: Date = new Date()): string {
  const iso = d.toISOString();
  return iso.replace(/:/g, "-").replace(/\./g, "-");
}

// Signed-URL TTL for the streaming download. 60 seconds is sufficient for the
// stream.pipeline to complete even for large files over a local network; the
// URL is only used once and the pipeline runs synchronously to completion.
const SIGNED_URL_TTL_SECONDS = 60;

// Materialize a single bucket object to the local filesystem. Streams the source
// file via a short-lived signed URL through Node's stream.pipeline so that
// large (50MB+) PDFs do NOT buffer the entire file in the heap before writing.
//
// Implementation: createSignedUrl -> fetch(url) -> Readable.fromWeb(body) ->
// fs.createWriteStream. NO service-role required; the signed URL is generated
// using the authenticated client's RLS-checked credentials.
//
// Partial-file cleanup (Finding 30): on any throw the localPath is best-effort
// unlinked so we never leave a half-written artifact for the extractor to read.
//
// Throws on:
//   - createSignedUrl error
//   - HTTP response !ok from the signed URL
//   - stream.pipeline failure (network / disk error)
export async function materializeToLocal(
  client: SupabaseClient,
  storagePath: string,
  localPath: string,
): Promise<void> {
  // Obtain a short-lived signed URL (RLS-checked via the authenticated client).
  const { data: signedData, error: signedErr } = await client.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (signedErr || !signedData?.signedUrl) {
    throw new Error(
      `materialize_signed_url_failed:${signedErr?.message ?? "no_url"}`,
    );
  }

  // Ensure parent dir exists before write (Finding 34).
  await fs.promises.mkdir(path.dirname(localPath), { recursive: true });

  // Fetch the object and stream it to disk. Partial-file cleanup on any error.
  let writeStream: fs.WriteStream | null = null;
  try {
    const response = await fetch(signedData.signedUrl);
    if (!response.ok || !response.body) {
      throw new Error(
        `materialize_fetch_failed:${response.status}:${response.statusText}`,
      );
    }

    writeStream = fs.createWriteStream(localPath);

    // Node 18+: ReadableStream (WHATWG) can be adapted via Readable.fromWeb so
    // stream.pipeline handles backpressure and cleanup automatically.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const readable = Readable.fromWeb(response.body as any);
    await pipeline(readable, writeStream);
  } catch (err) {
    // Best-effort unlink of any partial file (Finding 30).
    await fs.promises.unlink(localPath).catch(() => {
      /* best-effort; file may not exist yet */
    });
    throw err;
  }
}

// Move the project's uploads dir to a timestamped quarantine subdir under
// `<BASE>/data/v2_dashboard_uploads/_quarantine/`. Best-effort wrapper; route callers
// MUST wrap this in their own try/catch so a quarantine failure does NOT mask the
// route's terminal error response (Finding 54).
//
// Contract notes:
//   - source missing returns normally with `{moved: false, reason: 'source_missing'}`.
//   - quarantine base is mkdir-recursive'd before move; idempotent if it already exists.
//   - both source and target parent dirs are isContained-checked against BASE/data/
//     v2_dashboard_uploads/ so a path-traversal cannot redirect the move.
//   - any other fs failure (EACCES, EBUSY, ENOSPC) throws.
export async function quarantineUploadsDir(
  projectId: string,
): Promise<QuarantineUploadsDirResult> {
  const base = getBasePath();
  const uploadsBase = path.resolve(base, "data", "v2_dashboard_uploads");
  const source = path.resolve(uploadsBase, projectId);
  const quarantineBase = path.resolve(uploadsBase, "_quarantine");

  // Source-missing branch: do not throw. (Finding 62.)
  try {
    await fs.promises.stat(source);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { moved: false, reason: "source_missing" };
    }
    throw err;
  }

  // Ensure quarantine base exists (idempotent).
  await fs.promises.mkdir(quarantineBase, { recursive: true });

  const target = path.resolve(quarantineBase, `${projectId}_${utcStampForPath()}`);

  // Containment checks on source and target's parent dir (target doesn't exist yet, so
  // we validate quarantineBase as the resolvable containment anchor).
  const srcContained = await isContained(uploadsBase, source);
  if (!srcContained) {
    throw new Error(
      `quarantine_containment_violation:source_outside_uploads_base:${source}`,
    );
  }
  const tgtParentContained = await isContained(uploadsBase, quarantineBase);
  if (!tgtParentContained) {
    throw new Error(
      `quarantine_containment_violation:target_parent_outside_uploads_base:${quarantineBase}`,
    );
  }

  await fs.promises.rename(source, target);
  return { moved: true, targetPath: target };
}
