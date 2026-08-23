import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import ErrorBoundary from '@/components/ErrorBoundary';
import { QaqcAdminReviewClient } from './QaqcAdminReviewClient';
import { fetchAllReviews } from '@/lib/matrix-options/provenance/qa-review-sync';

/**
 * Admin-gated route for compiling and reviewing all Stage 2 QA/QC verification
 * results, reviewer notes, and flagged issues from Supabase.
 *
 * Auth posture: requires admin or matrix_admin role in user_roles.
 */
export default async function QaqcAdminReviewPage() {
  const cookieStore = await cookies();
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
            // Read-only server component boundary
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Read-only server component boundary
          }
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'matrix_admin']);

  const isAdmin = Array.isArray(roles) && roles.length > 0;

  if (!isAdmin) {
    redirect('/dashboard');
  }

  const initialReviews = await fetchAllReviews();

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        {/* Top Hero Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900 text-white shadow-2xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold uppercase tracking-wider mb-3 border border-sky-400/30">
                Admin Quality Assurance &amp; Governance
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">
                QA/QC Verification &amp; Review Ledger
              </h1>
              <p className="text-sm sm:text-base text-sky-200 max-w-3xl mx-auto leading-relaxed">
                Centralized administrative review console for compiled Stage 2 toxicologist verifications,
                substance parameter notes, discrepancy logs, and potential issue flags.
              </p>
            </div>
          </div>
        </div>

        {/* Content Container */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <QaqcAdminReviewClient initialReviews={initialReviews} isAdmin={isAdmin} />
        </div>
      </div>
    </ErrorBoundary>
  );
}
