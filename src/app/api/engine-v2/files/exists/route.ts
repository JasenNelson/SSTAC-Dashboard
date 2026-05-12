// engine_v2 frontend Lane 1 / Module L1-3: GET /api/engine-v2/files/exists (Finding 60).
//
// GET-only finalization probe used by UploadStep AMBIGUOUS-path polling. Safe read.
// requireAdminForApi + ownership probe + Zod query validation `{project_id, file_id}`.
// 200 with row OR 404. No CSRF (GET; no state change).

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { FileExistsQuerySchema } from "@/lib/engine-v2/zod";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdminForApi();
  if (auth instanceof NextResponse) return auth;
  const { client } = auth;

  const { searchParams } = new URL(request.url);
  const queryRaw = {
    project_id: searchParams.get("project_id"),
    file_id: searchParams.get("file_id"),
  };
  const parsed = FileExistsQuerySchema.safeParse(queryRaw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { project_id, file_id } = parsed.data;

  // Ownership probe via RLS-authenticated client.
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

  const { data: file, error: fileErr } = await client
    .from("v2_submission_files")
    .select("*")
    .eq("id", file_id)
    .eq("project_id", project_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (fileErr) {
    return NextResponse.json(
      { error: "select_failed", detail: fileErr.message },
      { status: 500 },
    );
  }
  if (!file) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ exists: true, file }, { status: 200 });
}
