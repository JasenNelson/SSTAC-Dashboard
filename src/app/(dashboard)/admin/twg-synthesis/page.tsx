import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import TWGSynthesisClient from './TWGSynthesisClient'

export default async function TWGSynthesisPage() {
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

  // Get review submissions data
  const { data: submissions, error: submissionsError } = await supabase
    .from('admin_review_submissions')
    .select('*')
    .order('created_at', { ascending: false })

  // Get review files
  const { data: files, error: filesError } = await supabase
    .from('review_files')
    .select('*')
    .order('created_at', { ascending: false })

  // Log errors but don't let them break the page
  if (submissionsError) {
    console.error('Error fetching submissions:', submissionsError)
  }
  if (filesError) {
    console.error('Error fetching files:', filesError)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <TWGSynthesisClient 
        user={user}
        submissions={submissions || []}
        files={files || []}
      />
    </div>
  )
}
