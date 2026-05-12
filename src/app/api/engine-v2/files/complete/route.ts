// engine_v2 frontend Lane 1 / Module L1-3: POST /api/engine-v2/files/complete.
//
// Finalizes a TUS-uploaded file: HEAD verify, streaming SHA + magic, filename safety,
// idempotent-retry safety, cap preflight, INSERT-first race-safe finalize with cap
// trigger handling. ALL Storage DELETE paths go through deleteUnfinalizedStorageObject
// (Findings 69, 73, 74, 86).
//
// Plan v7.19 L1-3, steps 1-11 (Finding 68 renumbering: idempotent-retry safety BEFORE
// cap preflight). Universal error-response schema (Findings 99, 105): every non-2xx
// body includes literal boolean `orphan_cleanup_required`. UploadStep strict-equality
// dispatch (Finding 100) requires this on EVERY error path.

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import { FileCompletePayloadSchema } from "@/lib/engine-v2/zod";
import { validateFilename } from "@/lib/engine-v2/filename_safety";
import { mimeToExtension } from "@/lib/engine-v2/mime_to_extension";
import { computeStreamingSha256AndMagic } from "@/lib/engine-v2/streaming_sha256";
import { deleteUnfinalizedStorageObject } from "@/lib/engine-v2/storage_safe_delete";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const BUCKET = "v2-submissions";

// Magic-byte signatures keyed by allowed MIME types.
// PDF: 25 50 44 46 2D ("%PDF-"); DOCX: 50 4B 03 04 (ZIP "PK"); DOC: D0 CF 11 E0 A1 B1 1A E1.
const MAGIC_SIGNATURES: Record<string, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    0x50, 0x4b, 0x03, 0x04,
  ],
  "application/msword": [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
};

// /files/complete-local error wrapper (Finding 105): every non-2xx response body MUST
// include a literal boolean `orphan_cleanup_required`. Used by ALL pre-step-8 failure
// paths (auth, CSRF, Zod, ownership, HEAD, filename, SHA) instead of the shared
// helpers' generic responses, so the flag is guaranteed present.
function fileCompleteError(
  status: number,
  body: Record<string, unknown>,
  orphanCleanupRequired: boolean,
): NextResponse {
  return NextResponse.json(
    { ...body, orphan_cleanup_required: orphanCleanupRequired },
    { status },
  );
}

function bytesStartWith(actual: Uint8Array, signature: number[]): boolean {
  if (actual.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (actual[i] !== signature[i]) return false;
  }
  return true;
}

interface ExpectedPathParts {
  expectedPath: string;
  ext: string;
}

function deriveExpectedPath(
  userId: string,
  projectId: string,
  fileId: string,
  mime: string,
): ExpectedPathParts {
  const ext = mimeToExtension(mime);
  const expectedPath = `${userId}/${projectId}/${fileId}/${fileId}.${ext}`;
  return { expectedPath, ext };
}

// Caps row shape from v2_projects (max_files, max_total_bytes columns from Finding 23).
interface ProjectCapRow {
  id: string;
  max_files: number;
  max_total_bytes: number;
}

async function fetchOwnedProject(
  client: SupabaseClient,
  projectId: string,
): Promise<ProjectCapRow | null> {
  const { data, error } = await client
    .from("v2_projects")
    .select("id, max_files, max_total_bytes")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ProjectCapRow;
}

async function fetchExistingFileRow(
  client: SupabaseClient,
  fileId: string,
  projectId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await client
    .from("v2_submission_files")
    .select("*")
    .eq("id", fileId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

interface CapPreflightDecision {
  exceeded: boolean;
  capKind?: "files" | "bytes";
  currentValue?: number;
  limit?: number;
}

async function capPreflight(
  client: SupabaseClient,
  projectId: string,
  caps: ProjectCapRow,
  incomingSize: number,
): Promise<CapPreflightDecision> {
  const { data, error } = await client
    .from("v2_submission_files")
    .select("size_bytes")
    .eq("project_id", projectId)
    .is("deleted_at", null);
  if (error || !data) {
    // If we cannot read the cap state, do NOT block; trigger is authoritative.
    return { exceeded: false };
  }
  const rows = data as Array<{ size_bytes: number }>;
  const fileCount = rows.length;
  const byteSum = rows.reduce((acc, r) => acc + (r.size_bytes || 0), 0);
  if (fileCount + 1 > caps.max_files) {
    return {
      exceeded: true,
      capKind: "files",
      currentValue: fileCount,
      limit: caps.max_files,
    };
  }
  if (byteSum + incomingSize > caps.max_total_bytes) {
    return {
      exceeded: true,
      capKind: "bytes",
      currentValue: byteSum,
      limit: caps.max_total_bytes,
    };
  }
  return { exceeded: false };
}

interface HeadResult {
  ok: boolean;
  size?: number;
  contentType?: string;
  reason?: string;
}

async function headStorageObject(
  client: SupabaseClient,
  expectedPath: string,
): Promise<HeadResult> {
  // Supabase JS client does not expose HEAD on Storage objects directly. The closest
  // safe path is to list the parent prefix and locate the object metadata. If the
  // object is missing, return ok:false. Tests inject a custom client where the
  // storage object presents `list` returning [{name, metadata: {size, mimetype}}].
  try {
    const lastSlash = expectedPath.lastIndexOf("/");
    const prefix = lastSlash > 0 ? expectedPath.slice(0, lastSlash) : "";
    const target = lastSlash > 0 ? expectedPath.slice(lastSlash + 1) : expectedPath;
    const { data, error } = await client.storage.from(BUCKET).list(prefix);
    if (error || !data) {
      return { ok: false, reason: error?.message ?? "list_failed" };
    }
    const match = (data as Array<{ name: string; metadata?: Record<string, unknown> }>).find(
      (o) => o.name === target,
    );
    if (!match) return { ok: false, reason: "object_not_found" };
    const meta = match.metadata ?? {};
    const size = typeof meta.size === "number" ? meta.size : undefined;
    const contentType =
      typeof meta.mimetype === "string"
        ? (meta.mimetype as string)
        : typeof meta.contentType === "string"
          ? (meta.contentType as string)
          : undefined;
    return { ok: true, size, contentType };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

async function createSignedUrl(
  client: SupabaseClient,
  expectedPath: string,
): Promise<string | null> {
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(expectedPath, 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Step 1: requireAdminForApi.
  const auth = await requireAdminForApi();
  if (auth instanceof NextResponse) {
    // Re-wrap helper response with the orphan_cleanup_required flag (Finding 105).
    // Auth/CSRF/early failures: TUS already uploaded; orphan needed (true).
    let bodyJson: Record<string, unknown> = {};
    try {
      bodyJson = (await auth.clone().json()) as Record<string, unknown>;
    } catch {
      bodyJson = { error: "unauthorized_or_forbidden" };
    }
    return fileCompleteError(auth.status, bodyJson, true);
  }
  const { client, user } = auth;

  // Step 2: CSRF check.
  const csrf = checkCsrf(request);
  if (!csrf.ok) {
    const status =
      csrf.reason === "missing_content_type" || csrf.reason === "wrong_content_type"
        ? 415
        : 403;
    return fileCompleteError(
      status,
      { error: csrf.reason, detail: csrf.detail },
      true,
    );
  }

  // Step 3: Zod validate payload.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fileCompleteError(400, { error: "invalid_json" }, true);
  }
  const parsed = FileCompletePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return fileCompleteError(
      400,
      { error: "invalid_payload", issues: parsed.error.issues },
      true,
    );
  }
  const payload = parsed.data;

  // Step 4: ownership probe via RLS-authenticated client.
  const project = await fetchOwnedProject(client, payload.project_id);
  if (!project) {
    return fileCompleteError(
      403,
      { error: "project_not_found_or_forbidden" },
      true,
    );
  }

  // Step 6 (filename safety) -- run before any Storage I/O so a malformed filename
  // fails fast. NFC normalization is performed inside validateFilename.
  const fnameCheck = validateFilename(payload.original_filename);
  if (!fnameCheck.ok || !fnameCheck.normalized) {
    return fileCompleteError(
      400,
      { error: "invalid_filename", reason: fnameCheck.reason },
      true,
    );
  }
  const originalFilenameNfc = fnameCheck.normalized;

  // Derive expected storage path.
  let expected: ExpectedPathParts;
  try {
    expected = deriveExpectedPath(
      user.id,
      payload.project_id,
      payload.file_id,
      payload.content_type,
    );
  } catch (err) {
    return fileCompleteError(
      400,
      { error: "unsupported_mime_type", detail: (err as Error).message },
      true,
    );
  }
  const expectedPath = expected.expectedPath;

  // Step 5: HEAD object at expected path; verify size + content-type match POST claim.
  const head = await headStorageObject(client, expectedPath);
  if (!head.ok) {
    return fileCompleteError(
      400,
      {
        error: "head_mismatch",
        detail: head.reason ?? "object_not_found",
      },
      true,
    );
  }
  if (typeof head.size === "number" && head.size !== payload.size_bytes) {
    return fileCompleteError(
      400,
      {
        error: "head_mismatch",
        detail: "size_mismatch",
        head_size: head.size,
        claimed_size: payload.size_bytes,
      },
      true,
    );
  }
  if (head.contentType && head.contentType !== payload.content_type) {
    return fileCompleteError(
      400,
      {
        error: "head_mismatch",
        detail: "content_type_mismatch",
        head_content_type: head.contentType,
        claimed_content_type: payload.content_type,
      },
      true,
    );
  }

  // Step 7: streaming SHA256 + first-8-bytes capture.
  const signedUrl = await createSignedUrl(client, expectedPath);
  if (!signedUrl) {
    return fileCompleteError(
      500,
      { error: "sha_streaming_failed", detail: "signed_url_unavailable" },
      true,
    );
  }
  let sha256Hex: string;
  let firstBytes: Uint8Array;
  try {
    const r = await computeStreamingSha256AndMagic(signedUrl, {});
    sha256Hex = r.sha256;
    firstBytes = r.firstBytes;
  } catch (err) {
    return fileCompleteError(
      500,
      { error: "sha_streaming_failed", detail: (err as Error).message },
      true,
    );
  }

  // Step 8: magic-byte validation. firstBytes.length < 8 OR magic mismatch -> DELETE
  // via helper and handle the three failure reasons.
  const signature = MAGIC_SIGNATURES[payload.content_type];
  const magicOk =
    firstBytes.length >= 8 && signature !== undefined && bytesStartWith(firstBytes, signature);
  if (!magicOk) {
    // Plan line 839: log file_id on all step 8 outcomes; never log original_filename.
    console.warn(
      `[engine_v2/files/complete] magic_mismatch file_id=${payload.file_id} declared=${payload.content_type}`,
    );
    const r = await deleteUnfinalizedStorageObject(client, expectedPath);
    if (r.deleted === true) {
      return fileCompleteError(
        400,
        { error: "magic_mismatch", detail: "file_signature_does_not_match_declared_mime" },
        true,
      );
    }
    if (r.reason?.startsWith("guard_query_error:")) {
      return fileCompleteError(
        500,
        {
          error: "guard_query_error_during_magic_cleanup",
          detail: r.reason,
        },
        true,
      );
    }
    if (r.reason === "finalized_row_references_path") {
      // Extremely unlikely at step 8; treat as already-finalized.
      const existing = await fetchExistingFileRow(client, payload.file_id, payload.project_id);
      if (existing) {
        return NextResponse.json(existing, { status: 200 });
      }
      return fileCompleteError(
        500,
        { error: "guard_query_error_during_magic_cleanup", detail: "finalized_row_references_path_but_no_row" },
        true,
      );
    }
    // storage_error
    return fileCompleteError(
      500,
      { error: "storage_error_during_magic_cleanup", detail: r.reason ?? "unknown" },
      true,
    );
  }

  // Step 9: idempotent-retry safety check (Findings 64, 68 -- runs BEFORE cap preflight).
  const existing = await fetchExistingFileRow(client, payload.file_id, payload.project_id);
  if (existing) {
    const existingPath = (existing.storage_path as string | undefined) ?? "";
    const existingSha = (existing.sha256 as string | undefined) ?? "";
    const existingSize = (existing.size_bytes as number | undefined) ?? -1;
    const existingMime = (existing.mime_type as string | undefined) ?? "";
    const allMatch =
      existingPath === expectedPath &&
      existingSha === sha256Hex &&
      existingSize === payload.size_bytes &&
      existingMime === payload.content_type;
    if (allMatch) {
      // True idempotent retry. Do NOT delete the just-uploaded storage object;
      // TUS is idempotent on objectName so it is identical to the referenced one.
      return NextResponse.json(existing, { status: 200 });
    }
    return fileCompleteError(
      409,
      {
        error: "file_id_reused_with_different_content",
        existing_sha256: existingSha,
        requested_sha256: sha256Hex,
      },
      false,
    );
  }

  // Step 10: cap preflight (UX-only; trigger is authoritative).
  const capDecision = await capPreflight(client, payload.project_id, project, payload.size_bytes);
  if (capDecision.exceeded) {
    const r = await deleteUnfinalizedStorageObject(client, expectedPath);
    if (r.deleted === true) {
      return fileCompleteError(
        413,
        {
          error: "project_cap_exceeded",
          cap_kind: capDecision.capKind,
          current_value: capDecision.currentValue,
          limit: capDecision.limit,
        },
        true,
      );
    }
    if (r.reason?.startsWith("guard_query_error:")) {
      return fileCompleteError(
        500,
        { error: "guard_query_error_during_cap_cleanup", detail: r.reason },
        true,
      );
    }
    if (r.reason === "finalized_row_references_path") {
      const concurrent = await fetchExistingFileRow(
        client,
        payload.file_id,
        payload.project_id,
      );
      if (concurrent) return NextResponse.json(concurrent, { status: 200 });
      return fileCompleteError(
        500,
        { error: "guard_query_error_during_cap_cleanup", detail: "finalized_row_references_path_but_no_row" },
        true,
      );
    }
    return fileCompleteError(
      413,
      {
        error: "project_cap_exceeded",
        cap_kind: capDecision.capKind,
        current_value: capDecision.currentValue,
        limit: capDecision.limit,
        storage_cleanup_deferred: true,
      },
      true,
    );
  }

  // Step 11: INSERT-first race-safe finalize. Trigger enforces caps atomically.
  const insertPayload = {
    id: payload.file_id, // Finding 58 -- client-supplied file_id is PK.
    project_id: payload.project_id,
    original_filename: originalFilenameNfc,
    storage_path: expectedPath,
    size_bytes: payload.size_bytes,
    mime_type: payload.content_type,
    sha256: sha256Hex,
  };
  const { data: inserted, error: insertErr } = await client
    .from("v2_submission_files")
    .insert(insertPayload)
    .select("*")
    .single();

  if (!insertErr && inserted) {
    return NextResponse.json(inserted, { status: 201 });
  }

  // Error path: distinguish 23505 (unique violation) and 23514 (cap trigger).
  const code = (insertErr as { code?: string } | null)?.code;
  const message = insertErr?.message ?? "";
  const constraintHint = (insertErr as { details?: string } | null)?.details ?? "";

  if (code === "23505") {
    const isPkConflict =
      constraintHint.includes("v2_submission_files_pkey") ||
      message.includes("v2_submission_files_pkey");
    if (isPkConflict) {
      // Race between step 9 and step 11: another request committed the same file_id.
      // Re-run step 9 logic.
      const conc = await fetchExistingFileRow(client, payload.file_id, payload.project_id);
      if (!conc) {
        return fileCompleteError(
          500,
          { error: "pk_conflict_but_no_row" },
          true,
        );
      }
      const concPath = (conc.storage_path as string | undefined) ?? "";
      const concSha = (conc.sha256 as string | undefined) ?? "";
      const concSize = (conc.size_bytes as number | undefined) ?? -1;
      const concMime = (conc.mime_type as string | undefined) ?? "";
      const concMatch =
        concPath === expectedPath &&
        concSha === sha256Hex &&
        concSize === payload.size_bytes &&
        concMime === payload.content_type;
      if (concMatch) {
        return NextResponse.json(conc, { status: 200 });
      }
      return fileCompleteError(
        409,
        {
          error: "file_id_reused_with_different_content",
          existing_sha256: concSha,
          requested_sha256: sha256Hex,
        },
        false,
      );
    }
    // 23505 against the active-sha unique index. Existing winning row by (project_id, sha256).
    const { data: winner, error: winnerErr } = await client
      .from("v2_submission_files")
      .select("*")
      .eq("project_id", payload.project_id)
      .eq("sha256", sha256Hex)
      .is("deleted_at", null)
      .maybeSingle();
    const winningRow = winnerErr ? null : (winner as Record<string, unknown> | null);
    const r = await deleteUnfinalizedStorageObject(client, expectedPath);
    if (r.deleted === true) {
      return NextResponse.json(winningRow ?? {}, { status: 200 });
    }
    if (r.reason === "finalized_row_references_path") {
      return NextResponse.json(winningRow ?? {}, { status: 200 });
    }
    if (r.reason?.startsWith("guard_query_error:")) {
      return fileCompleteError(
        500,
        {
          error: "guard_query_error_during_dup_sha_cleanup",
          detail: r.reason,
        },
        true,
      );
    }
    // storage_error -- existing row is the data integrity win; storage cleanup deferred.
    return NextResponse.json(winningRow ?? {}, { status: 200 });
  }

  if (code === "23514") {
    // Cap trigger fired. Re-derive cap_kind / current_value / limit by re-running
    // capPreflight against the now-current state (race-safe vs lazy zero).
    const recheck = await capPreflight(
      client,
      payload.project_id,
      project,
      payload.size_bytes,
    );
    let capKind: "files" | "bytes" = recheck.capKind ?? "files";
    let currentValue = recheck.currentValue ?? 0;
    let limit = recheck.limit ?? project.max_files;
    if (!recheck.exceeded) {
      // Trigger fired but preflight does not see it; fall back to parsing the
      // trigger's message text + project defaults.
      if (/byte/i.test(message)) {
        capKind = "bytes";
        limit = project.max_total_bytes;
      } else {
        capKind = "files";
        limit = project.max_files;
      }
      currentValue = limit; // best-effort: we know we are at or beyond limit
    }
    console.warn(
      `[engine_v2/files/complete] 23514 cap_violation file_id=${payload.file_id} cap_kind=${capKind} current=${currentValue} limit=${limit}`,
    );
    const r = await deleteUnfinalizedStorageObject(client, expectedPath);
    if (r.deleted === true) {
      return fileCompleteError(
        413,
        {
          error: "project_cap_exceeded",
          cap_kind: capKind,
          current_value: currentValue,
          limit,
        },
        true,
      );
    }
    if (r.reason === "finalized_row_references_path") {
      const conc = await fetchExistingFileRow(
        client,
        payload.file_id,
        payload.project_id,
      );
      if (conc) return NextResponse.json(conc, { status: 200 });
      return fileCompleteError(
        500,
        {
          error: "guard_query_error_during_cap_cleanup",
          detail: "finalized_row_references_path_but_no_row",
        },
        true,
      );
    }
    if (r.reason?.startsWith("guard_query_error:")) {
      return fileCompleteError(
        500,
        {
          error: "guard_query_error_during_cap_cleanup",
          detail: r.reason,
        },
        true,
      );
    }
    // storage_error -- cap is dominant; storage cleanup deferred.
    return fileCompleteError(
      413,
      {
        error: "project_cap_exceeded",
        cap_kind: capKind,
        current_value: currentValue,
        limit,
        storage_cleanup_deferred: true,
      },
      true,
    );
  }

  // Unknown INSERT error.
  return fileCompleteError(
    500,
    { error: "insert_failed", detail: message },
    true,
  );
}
