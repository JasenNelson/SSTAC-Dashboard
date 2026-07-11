import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { checkCsrf } from '@/lib/engine-v2/csrf';

export const runtime = 'nodejs';

const ADMIN_ROLES = ['admin', 'matrix_admin'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

interface PublishPayload {
  dra_id: string;
  public: boolean;
  reason: string;
}

function parsePublishPayload(value: unknown): PublishPayload {
  if (!value || typeof value !== 'object') {
    throw new Error('body must be an object');
  }
  const body = value as Record<string, unknown>;
  
  if (typeof body.dra_id !== 'string' || !UUID_RE.test(body.dra_id)) {
    throw new Error('dra_id must be a UUID string');
  }
  if (typeof body.public !== 'boolean') {
    throw new Error('public must be a boolean');
  }
  if (typeof body.reason !== 'string' || body.reason.trim().length === 0) {
    throw new Error('reason must be a non-empty string');
  }

  return {
    dra_id: body.dra_id,
    public: body.public,
    reason: body.reason,
  };
}

function mapRpcErrorToResponse(error: { code?: string; message?: string }) {
  if (error.code === '42501') {
    return NextResponse.json(
      { error: 'rpc_forbidden', detail: error.message },
      { status: 403 }
    );
  }
  return NextResponse.json(
    { error: 'rpc_failed', detail: error.message },
    { status: 500 }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authClient = await createAuthenticatedClient();
  const auth = await requireMatrixMapAdmin(authClient);
  if (auth instanceof NextResponse) return auth;

  const csrf = checkCsrf(request);
  if (!csrf.ok) {
    const status =
      csrf.reason === 'missing_content_type' ||
      csrf.reason === 'wrong_content_type'
        ? 415
        : 403;
    return NextResponse.json({ error: csrf.reason, detail: csrf.detail }, { status });
  }

  let payload: PublishPayload;
  try {
    payload = parsePublishPayload(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_payload', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const { error } = await authClient
    .schema('matrix_map')
    .rpc('flip_dra_public', {
      p_dra_id: payload.dra_id,
      p_new_value: payload.public,
      p_actor_id: auth.user.id,
      p_reason: payload.reason.trim(),
    });

  if (error) {
    return mapRpcErrorToResponse(error);
  }

  return NextResponse.json({ ok: true, dra_id: payload.dra_id, public: payload.public }, { status: 200 });
}
