import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import TWGReviewClient from './TWGReviewClient'

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
      },
    }
  )

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Check if user has any role (admin or member can access TWG review)
  let { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .limit(1)

  // If no role found, attempt a safe one-time self-assign of 'member' (non-destructive)
  if (!roleData || roleData.length === 0) {
    try {
      await supabase.from('user_roles').insert({ user_id: user.id, role: 'member' })
      // Re-check after insert
      const recheck = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .limit(1)
      roleData = recheck.data || null
      roleError = recheck.error || null
    } catch {}
  }

  // Allow access if user has any role (even if multiple roles exist)
  if (roleError || !roleData || roleData.length === 0) {
    redirect('/dashboard')
  }

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <TWGReviewClient 
        user={user}
        existingSubmission={existingSubmission}
      />
    </div>
  )
}
