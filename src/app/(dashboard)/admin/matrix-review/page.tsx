import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import MatrixReviewClient from './MatrixReviewClient'
import ErrorBoundary from '@/components/ErrorBoundary'

export default async function MatrixReviewPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Check admin role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()

  if (!roleData) {
    redirect('/dashboard')
  }

  // Fetch reviews
  const { data: baseReviews, error: reviewsError } = await supabase
    .from('matrix_reviews')
    .select('id, user_id, status, poll_data, comments_data, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (reviewsError) {
    console.error('Error fetching matrix reviews:', reviewsError)
  }

  // Build email map via safe function
  let emailMap: Record<string, string> = {}
  try {
    const { data: emailRows } = await supabase.rpc('get_users_with_emails')
    if (emailRows && Array.isArray(emailRows)) {
      emailMap = Object.fromEntries(
        emailRows.map((r: { id: string; email: string }) => [r.id, r.email])
      )
    }
  } catch {}

  // Shape submissions
  type BaseReview = {
    id: string;
    user_id: string;
    status: 'IN_PROGRESS' | 'SUBMITTED';
    poll_data: unknown;
    comments_data: unknown;
    created_at: string;
    updated_at: string;
  };
  
  const mappedReviews = (baseReviews || []).map((s: BaseReview) => ({
    id: s.id,
    user_id: s.user_id,
    email: emailMap[s.user_id] || `User ${String(s.user_id).slice(0, 8)}...`,
    status: s.status,
    poll_data: (s.poll_data || {}) as Record<string, unknown>,
    comments_data: (s.comments_data || {}) as Record<string, unknown>,
    created_at: s.created_at,
    updated_at: s.updated_at,
  }))

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <MatrixReviewClient 
          user={user}
          reviews={mappedReviews}
        />
      </div>
    </ErrorBoundary>
  )
}
