// engine_v2 frontend Lane 1 (post-Lane-1 polish): DELETE /api/engine-v2/files/[id].
//
// Soft-deletes a v2_submission_files row by setting deleted_at = now().
// The underlying storage object is left in place; Lane 2 janitor reaps it.
// (Hard-delete via /files/orphan refuses to delete finalized objects per
// Finding 48; soft-delete is the correct primitive for "user wants to remove
// this file from their project".)
//
// Flow:
//   1. requireAdminForApi -> 401/403 NextResponse on failure.
//   2. checkCsrf -> 415 (Content-Type) | 403 (Origin).
//   3. Validate id is a UUID-ish string.
//   4. UPDATE v2_submission_files SET deleted_at = now() WHERE id = $id
//      AND deleted_at IS NULL. RLS filters by per-admin-owner so a non-owner
//      cannot delete someone else's file (0 rows updated -> 404).
//   5. Return 200 with the deleted row id.

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAdminForApi();
  if (auth instanceof NextResponse) return auth;
  const { client } = auth;

  const csrf = checkCsrf(request);
  if (!csrf.ok) {
    const status =
      csrf.reason === "missing_content_type" ||
      csrf.reason === "wrong_content_type"
        ? 415
        : 403;
    return NextResponse.json(
      { error: csrf.reason, detail: csrf.detail },
      { status },
    );
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await client
    .from("v2_submission_files")
    .update({ deleted_at: nowIso })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "soft_delete_failed", detail: error.message },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "not_found_or_already_deleted" }, { status: 404 });
  }
  return NextResponse.json({ id: data.id, deleted_at: nowIso }, { status: 200 });
}
