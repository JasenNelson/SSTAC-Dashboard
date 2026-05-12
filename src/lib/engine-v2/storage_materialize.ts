// engine_v2 frontend Lane 1: materialize Storage objects to local disk + quarantine helper
// (Findings 29, 30, 34, 35, 36, 38, 49, 54, 62).
//
// Module L1-6 calls `materializeToLocal` per file before spawning the Docling subprocess,
// then calls `quarantineUploadsDir` on any error path so the uploads dir is moved to
// `_quarantine/<projectId>_<UTC>/` instead of being left polluting the staging area.
//
// `materializeToLocal` signature (per L1-6 spec): (client, storagePath, localPath). The
// client is an authenticated Supabase server client; storagePath is the v2-submissions
// bucket key; localPath is the absolute destination on disk. Implementation uses
// `supabase.storage.from('v2-submissions').download(storagePath)` (returns a Blob);
// parent dir is mkdir-recursive'd before write (Finding 34); partial files are unlinked
// on any error (Finding 30).
//
// NOTE on the v6.x writeStream pattern in Engineering Decisions: that block describes a
// fetch-based streaming variant for signed-URL downloads. The L1-6 spec for this module
// uses the SupabaseClient direct-download path, which buffers the file as a Blob (acceptable
// for Lane 1 sizes -- bucket file_size_limit caps individual files; large-file streaming
// is a Lane 2 enhancement). Persistent error listener / backpressure / drain semantics from
// the ED block do not apply to Blob-bytes write paths.
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

// Materialize a single bucket object to the local filesystem. Uses the authenticated
// SupabaseClient's storage download (Blob) -- NO service-role. Throws on:
//   - download error from Supabase Storage
//   - fs write failure (parent dir creation, write, unlink-on-cleanup)
//
// Partial-file cleanup (Finding 30): on any throw after the writeFile call started, the
// localPath is best-effort unlinked so we never leave a half-written artifact for the
// extractor to read.
export async function materializeToLocal(
  client: SupabaseClient,
  storagePath: string,
  localPath: string,
): Promise<void> {
  const { data, error } = await client.storage.from(BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(
      `materialize_download_failed:${error?.message ?? "no_data"}`,
    );
  }

  // Ensure parent dir exists before write (Finding 34).
  await fs.promises.mkdir(path.dirname(localPath), { recursive: true });

  // Convert Blob -> Buffer via ArrayBuffer. Blob.arrayBuffer() resolves to a
  // structured-cloneable ArrayBuffer; Buffer.from copies into a Node Buffer.
  let buf: Buffer;
  try {
    const ab = await data.arrayBuffer();
    buf = Buffer.from(ab);
  } catch (err) {
    throw new Error(
      `materialize_blob_decode_failed:${(err as Error).message ?? "unknown"}`,
    );
  }

  try {
    await fs.promises.writeFile(localPath, buf);
  } catch (err) {
    // Cleanup partial file on any write failure (Finding 30).
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
