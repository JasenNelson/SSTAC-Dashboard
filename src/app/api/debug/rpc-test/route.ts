'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/lib/supabase-auth';

export async function GET() {
  const results: Record<string, unknown> = {};

  // Test 1: get-only client (original pattern)
  try {
    const cookieStore = await cookies();
    const getOnlyClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error: authErr } = await getOnlyClient.auth.getUser();
    results.getOnly_auth = { user_id: user?.id, error: authErr };

    if (user) {
      const { data: roleData } = await getOnlyClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();
      results.getOnly_adminCheck = { role: roleData?.role ?? null };

      const { data: rpcData, error: rpcErr } = await getOnlyClient.rpc(
        'manage_user_role_insert',
        { p_user_id: '00000000-0000-0000-0000-000000000000', p_role: 'member' }
      );
      results.getOnly_rpc = { data: rpcData, error: rpcErr };
    }
  } catch (e) {
    results.getOnly_exception = String(e);
  }

  // Test 2: authenticated client (full cookie handlers)
  try {
    const authClient = await createAuthenticatedClient();

    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    results.authClient_auth = { user_id: user?.id, error: authErr };

    if (user) {
      const { data: rpcData, error: rpcErr } = await authClient.rpc(
        'manage_user_role_insert',
        { p_user_id: '00000000-0000-0000-0000-000000000000', p_role: 'member' }
      );
      results.authClient_rpc = { data: rpcData, error: rpcErr };
    }
  } catch (e) {
    results.authClient_exception = String(e);
  }

  return NextResponse.json(results, { status: 200 });
}
