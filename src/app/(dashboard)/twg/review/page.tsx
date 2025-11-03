import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import TWGReviewClient from './TWGReviewClient'
import ErrorBoundary from '@/components/ErrorBoundary'

export default async function TWGReviewPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (_error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (_error) {
            // The `remove` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  // Check authentication - matches pattern used by other dashboard pages
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  // Handle authentication errors
  if (authError) {
    console.error('[TWG Review] Auth error:', {
      message: authError.message,
      code: authError.status,
      userId: user?.id
    })
    
    // If it's a refresh token error or invalid session, redirect to login
    if (authError.message?.includes('Refresh Token') || 
        authError.message?.includes('Invalid refresh token') ||
        authError.message?.includes('JWT') ||
        authError.status === 401) {
      console.warn('[TWG Review] Invalid session, redirecting to login')
      redirect('/login?redirect=/twg/review')
    }
  }
  
  // Redirect to login if not authenticated - same pattern as other pages
  if (!user) {
    redirect('/login?redirect=/twg/review')
  }
  
  // Note: No role check needed - authentication is sufficient for access.
  // Role checks are only needed for admin pages (handled separately).
  // The 'member' role is automatically assigned by database trigger for tracking purposes.

  // Get user's existing review submission if any
  let existingSubmission = null
  try {
    const { data, error } = await supabase
      .from('review_submissions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error fetching review submission:', error)
    } else {
      existingSubmission = data
    }
  } catch (error) {
    console.error('Error accessing review_submissions table:', error)
    // Continue without existing submission if table doesn't exist yet
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <TWGReviewClient 
          user={user}
          existingSubmission={existingSubmission}
        />
      </div>
    </ErrorBoundary>
  )
}
