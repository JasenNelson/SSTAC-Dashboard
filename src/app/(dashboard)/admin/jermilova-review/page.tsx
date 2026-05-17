// /admin/jermilova-review -- admin pool for the Jermilova BN-RRM
// collaborative-review feedback. Lists every user's document_reviews row
// where document_id='jermilova_bnrrm', with filters + status counts +
// per-section comment table. Mirrors the /admin/matrix-review pattern
// shape-for-shape against the new document_reviews table.
//
// Server-side: auth + admin-role gate (mirrors matrix-review). Fetches
// all rows for document_id='jermilova_bnrrm' (RLS allows admin SELECT via
// public.is_admin()). Maps user_ids to emails via the
// get_users_with_emails RPC the 20260515 security-audit migration
// introduced.

import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import JermilovaReviewClient from './JermilovaReviewClient';
import ErrorBoundary from '@/components/ErrorBoundary';

const DOCUMENT_ID = 'jermilova_bnrrm';

export const metadata = {
  title: 'Jermilova Review Admin Pool | SSTAC Dashboard',
  description:
    'Admin view of all collaborative-review submissions for the Jermilova BN-RRM methodology paper.',
};

export default async function JermilovaReviewAdminPage() {
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

  // Fetch all Jermilova reviews. RLS allows admin SELECT all rows; the
  // document_id filter scopes to the Jermilova stream specifically so
  // future docs sharing the document_reviews table do not pollute this
  // admin pool.
  const { data: baseReviews, error: reviewsError } = await supabase
    .from('document_reviews')
    .select('id, user_id, status, comments_data, created_at, updated_at')
    .eq('document_id', DOCUMENT_ID)
    .order('updated_at', { ascending: false });

  if (reviewsError) {
    console.error('Error fetching jermilova reviews:', reviewsError);
  }
  // Codex 2026-05-17 P2: surface fetch failures explicitly rather than
  // rendering an empty pool that admins could mistake for "no
  // submissions." A null baseReviews + non-null reviewsError indicates
  // an actual error (RLS regression, missing table, etc.).
  const fetchErrorMessage =
    reviewsError != null
      ? reviewsError.message ?? 'Failed to fetch document_reviews.'
      : null;

  // Build email map via the safe SECURITY DEFINER function from the
  // 2026-05-15 security audit. Admin-only RPC.
  let emailMap: Record<string, string> = {};
  try {
    const { data: emailRows } = await supabase.rpc('get_users_with_emails');
    if (emailRows && Array.isArray(emailRows)) {
      emailMap = Object.fromEntries(
        emailRows.map((r: { id: string; email: string }) => [r.id, r.email]),
      );
    }
  } catch {
    /* empty -- emails fall back to id-prefix per row */
  }

  type BaseReview = {
    id: string;
    user_id: string;
    status: 'IN_PROGRESS' | 'SUBMITTED';
    comments_data: unknown;
    created_at: string;
    updated_at: string;
  };

  const mappedReviews = (baseReviews || []).map((s: BaseReview) => ({
    id: s.id,
    user_id: s.user_id,
    email: emailMap[s.user_id] || `User ${String(s.user_id).slice(0, 8)}...`,
    status: s.status,
    comments_data: (s.comments_data || {}) as Record<string, unknown>,
    created_at: s.created_at,
    updated_at: s.updated_at,
  }));

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <JermilovaReviewClient
          reviews={mappedReviews}
          fetchError={fetchErrorMessage}
        />
      </div>
    </ErrorBoundary>
  );
}
