import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import TWGSynthesisClient from './TWGSynthesisClient'
import ErrorBoundary from '@/components/ErrorBoundary'

export const dynamic = 'force-dynamic';

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

  // Prefer querying base table to avoid auth.users permissions via views
  const { data: baseSubmissions, error: submissionsError } = await supabase
    .from('review_submissions')
    .select('id, user_id, status, form_data, created_at, updated_at')
    .order('created_at', { ascending: false })

  // Build email map via safe function (does not require direct auth.users access)
  let emailMap: Record<string, string> = {}
  try {
    const { data: emailRows } = await supabase.rpc('get_users_with_emails')
    if (emailRows && Array.isArray(emailRows)) {
      emailMap = Object.fromEntries(
        emailRows.map((r: { id: string; email: string }) => [r.id, r.email])
      )
    }
  } catch {}

  // Get review files
  const { data: files, error: filesError } = await supabase
    .from('review_files')
    .select('id, submission_id, file_name:filename, file_path, mime_type:mimetype, file_size, created_at:uploaded_at')
    .order('uploaded_at', { ascending: false })

  // Log errors but don't let them break the page
  if (submissionsError) {
    console.error('Error fetching submissions:', submissionsError)
  }
  if (filesError) {
    console.error('Error fetching files:', filesError)
  }

  // Shape submissions to expected structure for client, including email
  type BaseSubmission = {
    id: string;
    user_id: string;
    status: 'IN_PROGRESS' | 'SUBMITTED';
    form_data: unknown;
    created_at: string;
    updated_at: string;
  };
  const mappedSubmissions = (baseSubmissions || []).map((s: BaseSubmission) => ({
    id: s.id,
    user_id: s.user_id,
    email: emailMap[s.user_id] || `User ${String(s.user_id).slice(0, 8)}...`,
    status: s.status,
    form_data: s.form_data,
    created_at: s.created_at,
    updated_at: s.updated_at,
    file_count: 0, // not used for filtering; files listed separately
  }))

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <TWGSynthesisClient 
          user={user}
          submissions={mappedSubmissions}
          files={files || []}
        />
      </div>
    </ErrorBoundary>
  )
}
