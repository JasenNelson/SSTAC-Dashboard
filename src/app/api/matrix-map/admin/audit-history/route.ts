import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

// =====================================================================
// GET /api/matrix-map/admin/audit-history?dra_id=<uuid>
// =====================================================================
//
// Codex P2 fix (2026-07-11): admin/matrix-map/publish/page.tsx previously
// fetched only the newest 200 rows of matrix_map.dra_visibility_audit
// GLOBALLY and filtered client-side per selected DRA. If the audit table
// grew past 200 rows and the selected DRA's latest change fell outside that
// global top-200 window, the UI would falsely render "No recorded
// visibility changes for this DRA" -- a false-negative audit result.
//
// This route fixes that by scoping the read to ONE dra_id server-side, so
// the result is always accurate for whichever DRA the admin has selected
// (never truncated by unrelated DRAs' more-recent changes). Called by
// DraPublishControl on selection change.
//
// Auth mirrors publish/route.ts: caller must be authenticated AND hold the
// admin or matrix_admin role (matrix_map.dra_visibility_audit is RLS-gated
// to that same role set for SELECT; see
// supabase/migrations/20260519000001_matrix_map_schema.sql +
// 20260519000002_matrix_map_rls.sql, policy dra_visibility_audit_admin_select).
// GET / read-only => no CSRF token required (unlike the publish POST).
//
// Plain ASCII only.
// =====================================================================

export const runtime = 'nodejs';

const ADMIN_ROLES = ['admin', 'matrix_admin'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUDIT_ROW_LIMIT = 50;

async function createAuthenticatedClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    },
  );
}

async function requireMatrixMapAdmin(
  client: SupabaseClient,
): Promise<{ user: User } | NextResponse> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: role, error: roleError } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ADMIN_ROLES)
    .limit(1)
    .maybeSingle();

  if (roleError) {
    return NextResponse.json(
      { error: 'admin_role_query_failed', detail: roleError.message },
      { status: 500 },
    );
  }

  if (!role) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  return { user };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authClient = await createAuthenticatedClient();
  const auth = await requireMatrixMapAdmin(authClient);
  if (auth instanceof NextResponse) return auth;

  const draId = request.nextUrl.searchParams.get('dra_id');
  if (typeof draId !== 'string' || !UUID_RE.test(draId)) {
    return NextResponse.json({ error: 'invalid_dra_id' }, { status: 400 });
  }

  const { data, error } = await authClient
    .schema('matrix_map')
    .from('dra_visibility_audit')
    .select('id, dra_id, prior_value, new_value, changed_at, changed_by_email, reason')
    .eq('dra_id', draId)
    .order('changed_at', { ascending: false })
    .limit(AUDIT_ROW_LIMIT);

  if (error) {
    return NextResponse.json(
      { error: 'query_failed', detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, dra_id: draId, rows: data ?? [] }, { status: 200 });
}
