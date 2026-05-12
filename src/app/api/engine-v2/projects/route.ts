// engine_v2 frontend Lane 1 / Module L1-4: POST /api/engine-v2/projects.
//
// Creates a v2_projects row owned by the authenticated admin user.
// Flow (per plan v7.19 L1-4):
//   1. requireAdminForApi  -> 401 / 403 NextResponse on failure.
//   2. checkCsrf           -> 415 (Content-Type) or 403 (Origin) on failure.
//   3. Zod validate body   -> 400 on schema failure.
//   4. INSERT v2_projects (max_files / max_total_bytes use DB defaults per Finding 81).
//   5. 201 with inserted row, or 500 on DB error.

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import { ProjectCreatePayloadSchema } from "@/lib/engine-v2/zod";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Step 1: admin gate.
  const auth = await requireAdminForApi();
  if (auth instanceof NextResponse) return auth;
  const { client, user } = auth;

  // Step 2: CSRF.
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

  // Step 3: Zod validation. Trap JSON parse errors before Zod sees them so
  // malformed bodies surface as 400 rather than uncaught throws.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400 },
    );
  }
  const parsed = ProjectCreatePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Step 4: INSERT. max_files / max_total_bytes intentionally omitted so the
  // DB defaults (50, 524288000) apply per Finding 81.
  const payload = parsed.data;
  const { data, error } = await client
    .from("v2_projects")
    .insert({
      user_id: user.id,
      name: payload.name,
      application_types: payload.application_types,
      selected_services: payload.selected_services,
      media_types: payload.media_types,
      submission_context_overrides: payload.submission_context_overrides,
      model: payload.model ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        error: "insert_failed",
        detail: error?.message ?? "no row returned",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
