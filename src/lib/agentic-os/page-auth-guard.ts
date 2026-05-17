// Server-only auth guard helper for Agentic OS routes.
//
// Why this exists (codex 2026-05-16 P2 finding on commit 586eaab):
//   The IA refactor lifted the auth + admin-role check to layout.tsx,
//   relying on the layout to gate every sibling route. But Next.js App
//   Router caches layout RSC payloads during client-side navigation
//   between sibling pages, so the layout's auth check is NOT a per-
//   navigation guard. A session that expires while the dashboard is
//   open could let an admin (or ex-admin) client-side-navigate to a
//   sibling route whose `page.tsx` does its own data fetch -- bypassing
//   the layout's stale auth check.
//
//   The fix: re-introduce inline auth at every `page.tsx` in the
//   `/admin/agentic-os` route group, in addition to the layout's
//   check. Defense in depth: both checks must pass for the page to
//   render. This restores the pre-refactor behavior of the Projects
//   page (which had inline auth before the layout lift) AND extends
//   the same protection to the new Subscriptions route + every future
//   PR-2 route.
//
// Why not middleware:
//   middleware.ts's matcher does NOT include /admin/:path* today, AND
//   the middleware only enforces session presence (not role). Adding
//   /admin/* to middleware would conflict with the existing admin-page
//   architecture pattern (each admin page does its own role check
//   inline because the shared `requireAdminForServerComponent` helper
//   hardcodes a redirect to /dashboard/engine-v2 which is wrong for
//   Agentic OS / matrix-review). Page-level guard is the minimal-blast-
//   radius fix that matches the existing pattern.
//
// Why not `requireAdminForServerComponent`:
//   The shared helper at `@/lib/engine-v2/admin_guards` hardcodes the
//   post-login redirect to `/dashboard/engine-v2`. Calling it from
//   Agentic OS routes would land session-expired users on the wrong
//   page. The matrix-review-admin page made the same divergence. When/
//   if the helper learns a `next` parameter, both inline check paths
//   should be migrated to it.
//
// Server-only -- the createServerClient + supabase.auth.getUser() chain
// must run on the server. Never imported from a 'use client' file.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

export interface AgenticOsAccessResult {
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
 * is a single indexed read on user_roles. Total overhead: <10ms in
 * the cold case, <1ms when the request is already authenticated.
 */
export async function requireAgenticOsPageAccess(): Promise<AgenticOsAccessResult> {
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
    redirect('/login');
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
