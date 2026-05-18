// Server-only page-level auth guard for Regulatory Review methodology routes.
//
// Why this exists (mirrors agentic-os page-auth-guard.ts):
//   The parent layout at src/app/(dashboard)/regulatory-review/layout.tsx
//   performs the auth + admin-role check. But Next.js App Router caches
//   layout RSC payloads during client-side navigation between sibling
//   pages, so the layout's auth check is NOT a per-navigation guard. A
//   session that expires while the dashboard is open could let an admin
//   (or ex-admin) client-side-navigate between methodology sub-routes
//   whose `page.tsx` does its own data fetch -- bypassing the layout's
//   stale auth check.
//
//   The fix: re-introduce inline auth at every `page.tsx` in the
//   `/regulatory-review/methodology` route group, in addition to the
//   layout's check. Defense in depth: both checks must pass for the
//   page to render.
//
// Why not requireAdminForServerComponent:
//   The shared helper at @/lib/engine-v2/admin_guards hardcodes the
//   post-login redirect to /dashboard/engine-v2. Calling it from
//   regulatory-review methodology routes would land session-expired
//   users on the wrong page. This helper redirects to
//   /login?redirect=/regulatory-review/methodology so they return here
//   after re-auth.
//
// Server-only -- the createServerClient + supabase.auth.getUser() chain
// must run on the server. Never imported from a 'use client' file.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

export interface MethodologyPageAccessResult {
  user: User;
}

/**
 * Check that the current request belongs to an authenticated admin.
 * Redirects to /login (unauthenticated) or /dashboard (authenticated
 * but not admin) on failure.
 *
 * Returns the Supabase user on success so the caller can use the
 * user.email / user.id in downstream logic without re-fetching.
 *
 * Safe to call from layout.tsx + each page.tsx without performance
 * concern: Supabase's getUser() short-circuits via the JWT in the
 * cookie when the token is valid (no DB round-trip); the role lookup
 * is a single indexed read on user_roles.
 */
export async function requireMethodologyPageAccess(): Promise<MethodologyPageAccessResult> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?redirect=/regulatory-review/methodology');
  }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!roleData) {
    redirect('/dashboard');
  }

  return { user };
}
