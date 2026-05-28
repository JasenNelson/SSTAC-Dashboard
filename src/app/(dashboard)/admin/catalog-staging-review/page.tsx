import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import { CatalogStagingReview } from '@/components/matrix-options/CatalogStagingReview';
import ErrorBoundary from '@/components/ErrorBoundary';

/**
 * Admin-gated route mounting the CatalogStagingReview HITL approval pane.
 *
 * Auth posture matches the underlying catalog_extraction_staging RLS policy
 * and the catalog_approve_staging_row() RPC: admin OR matrix_admin role
 * required. Non-admin authenticated users are redirected to /dashboard;
 * unauthenticated users are redirected to /login.
 *
 * Authored 2026-05-28 by Stream D autonomous session as the dashboard surface
 * for the staging queue created by migrations 20260527000004 +
 * 20260527000005. See docs/STREAM_D_AUTONOMOUS_AGENT.md for the end-to-end
 * architecture.
 */
export default async function CatalogStagingReviewPage() {
  const cookieStore = await cookies();
  // Cookie-handler shape mirrors admin/page.tsx (full get/set/remove) rather
  // than admin/matrix-review/page.tsx (get-only). Either works in practice
  // because @supabase/ssr's auth.getUser() in a Server Component rarely
  // invokes set/remove (middleware handles refresh). The verbose form is
  // forward-defensive against future @supabase/ssr upgrades that might
  // invoke set during getUser().
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Cookie set may fail in some edge cases; safe to ignore here
            // because the page is read-only at the server boundary.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // See note above.
          }
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Admin gate matches the catalog_extraction_staging RLS policy + the
  // catalog_approve_staging_row RPC's role check: admin OR matrix_admin.
  // This is intentionally broader than the existing /admin/matrix-review
  // page (which checks 'admin' only) so a matrix_admin user can both reach
  // the page AND successfully invoke the server actions.
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'matrix_admin']);

  const isAdmin = Array.isArray(roles) && roles.length > 0;

  if (!isAdmin) {
    redirect('/dashboard');
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900 text-white shadow-2xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">
                Catalog Staging Review
              </h1>
              <p className="text-base text-sky-200 max-w-3xl mx-auto">
                HITL approval queue for the Catalog Extraction Agent. Review
                pending AI-proposed catalog rows; approve to promote into the
                production catalog tables, or reject to remove from the queue.
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <CatalogStagingReview isAdmin={isAdmin} />
        </div>
      </div>
    </ErrorBoundary>
  );
}
