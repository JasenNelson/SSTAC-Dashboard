import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';

const ADMIN_ROLES = ['admin', 'matrix_admin'];
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const publicationId = request.nextUrl.searchParams.get('publication_id');
  if (typeof publicationId !== 'string' || !UUID_RE.test(publicationId)) {
    return NextResponse.json({ error: 'invalid_publication_id' }, { status: 400 });
  }

  const { data, error } = await authClient
    .schema('matrix_map')
    .rpc('fetch_site_aggregate_publication_audit', {
      p_publication_id: publicationId,
    });

  if (error) {
    return NextResponse.json(
      { error: 'query_failed', detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, publication_id: publicationId, rows: data ?? [] },
    { status: 200 },
  );
}
