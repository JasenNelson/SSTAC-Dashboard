// engine_v2 frontend Lane 1 / Module L1-3: POST /api/engine-v2/files/orphan.
//
// Cleans up the just-uploaded Storage object for a file_id that never finalized
// in v2_submission_files. ALL deletion goes through deleteUnfinalizedStorageObject
// (Findings 48, 73, 74, 76); the helper refuses to delete if any active row
// references the path AND fails closed on guard-query error.
//
// Plan v7.19 L1-3 step-1..8 flow.

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import { OrphanCleanupPayloadSchema } from "@/lib/engine-v2/zod";
import { mimeToExtension, MIME_TO_EXT } from "@/lib/engine-v2/mime_to_extension";
import { deleteUnfinalizedStorageObject } from "@/lib/engine-v2/storage_safe_delete";

export const runtime = "nodejs";

const BUCKET = "v2-submissions";

function isAllowedExtension(ext: string): boolean {
  return Object.values(MIME_TO_EXT).includes(ext);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Step 1: admin gate.
  const auth = await requireAdminForApi();
  if (auth instanceof NextResponse) return auth;
  const { client, user } = auth;

  // Step 2: CSRF.
  const csrf = checkCsrf(request);
  if (!csrf.ok) {
    const status =
      csrf.reason === "missing_content_type" || csrf.reason === "wrong_content_type"
        ? 415
        : 403;
    return NextResponse.json(
      { error: csrf.reason, detail: csrf.detail },
      { status },
    );
  }

  // Step 3: Zod validate payload.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = OrphanCleanupPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { project_id, file_id } = parsed.data;

  // Step 4: ownership probe.
  const { data: project, error: projErr } = await client
    .from("v2_projects")
    .select("id")
    .eq("id", project_id)
    .maybeSingle();
  if (projErr || !project) {
    return NextResponse.json(
      { error: "project_not_found_or_forbidden" },
      { status: 403 },
    );
  }

  // Step 5: LIST storage.objects under prefix `<user_id>/<project_id>/<file_id>/`.
  const prefix = `${user.id}/${project_id}/${file_id}`;
  const { data: listed, error: listErr } = await client.storage.from(BUCKET).list(prefix);
  if (listErr) {
    return NextResponse.json(
      { error: "list_failed", detail: listErr.message },
      { status: 500 },
    );
  }
  const candidates = (listed ?? []) as Array<{ name: string }>;

  // Step 6: exactly-one validation. 0 -> 404; >=2 -> 409 + log.
  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "not_found", file_id, prefix },
      { status: 404 },
    );
  }
  if (candidates.length >= 2) {
    // Log via stderr (no exception); no DELETE on ambiguity.
    console.warn(
      `[engine-v2 orphan] ambiguous prefix: file_id=${file_id}, count=${candidates.length}`,
    );
    return NextResponse.json(
      {
        error: "ambiguous_prefix",
        file_id,
        candidates: candidates.map((c) => c.name),
      },
      { status: 409 },
    );
  }

  // Step 7: compute the expected storage path. Object name is `<file_id>.<ext>`;
  // validate extension is one we recognize and ALSO matches the file_id-based pattern.
  const onlyName = candidates[0]!.name;
  const dotIdx = onlyName.lastIndexOf(".");
  if (dotIdx <= 0) {
    return NextResponse.json(
      { error: "malformed_object_name", name: onlyName },
      { status: 409 },
    );
  }
  const stem = onlyName.slice(0, dotIdx);
  const ext = onlyName.slice(dotIdx + 1).toLowerCase();
  if (stem !== file_id) {
    return NextResponse.json(
      { error: "malformed_object_name", name: onlyName, expected_stem: file_id },
      { status: 409 },
    );
  }
  if (!isAllowedExtension(ext)) {
    // Reject deletes of objects whose extension we did not produce; defense-in-depth.
    return NextResponse.json(
      { error: "unrecognized_extension", name: onlyName },
      { status: 409 },
    );
  }
  // Make linter aware mimeToExtension is intentionally imported for symmetry / type proof.
  void mimeToExtension;
  const expectedPath = `${user.id}/${project_id}/${file_id}/${onlyName}`;

  // Step 8: DELETE via the shared helper.
  const result = await deleteUnfinalizedStorageObject(client, expectedPath);
  if (result.deleted === true) {
    return NextResponse.json({ deleted: true }, { status: 200 });
  }
  if (result.reason === "finalized_row_references_path") {
    return NextResponse.json(
      {
        error: "already_finalized",
        file_id,
        storage_path: expectedPath,
      },
      { status: 409 },
    );
  }
  if (result.reason?.startsWith("guard_query_error:")) {
    return NextResponse.json(
      { error: "guard_query_error", detail: result.reason },
      { status: 500 },
    );
  }
  return NextResponse.json(
    { error: "storage_delete_error", detail: result.reason ?? "unknown" },
    { status: 500 },
  );
}
