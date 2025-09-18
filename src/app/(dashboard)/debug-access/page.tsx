import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function DebugAccessPage() {
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
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Debug - Not Authenticated</h1>
          <p>User is not authenticated. Error: {authError?.message || 'No error message'}</p>
        </div>
      </div>
    )
  }

  // Check user roles
  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)

  // Check if review_submissions table exists
  const { data: tableCheck, error: tableError } = await supabase
    .from('review_submissions')
    .select('id')
    .limit(1)

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Access Debug Information</h1>
        
        <div className="space-y-6">
          {/* User Info */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">User Information</h2>
            <div className="space-y-2">
              <p><strong>User ID:</strong> {user.id}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Created At:</strong> {user.created_at}</p>
            </div>
          </div>

          {/* Role Information */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Role Information</h2>
            {roleError ? (
              <div className="text-red-600">
                <p><strong>Error:</strong> {roleError.message}</p>
                <p><strong>Code:</strong> {roleError.code}</p>
                <p><strong>Details:</strong> {roleError.details}</p>
              </div>
            ) : (
              <div>
                <p><strong>Roles found:</strong> {roleData?.length || 0}</p>
                {roleData && roleData.length > 0 ? (
                  <ul className="list-disc list-inside mt-2">
                    {roleData.map((role, index) => (
                      <li key={index}>{role.role}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-red-600">No roles found - this is the problem!</p>
                )}
              </div>
            )}
          </div>

          {/* Database Table Check */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Database Table Check</h2>
            {tableError ? (
              <div className="text-red-600">
                <p><strong>Error:</strong> {tableError.message}</p>
                <p><strong>Code:</strong> {tableError.code}</p>
                <p><strong>Details:</strong> {tableError.details}</p>
                <p className="mt-2 text-sm">This suggests the review_submissions table doesn't exist or has permission issues.</p>
              </div>
            ) : (
              <div className="text-green-600">
                <p>✅ review_submissions table is accessible</p>
                <p>Table check returned: {JSON.stringify(tableCheck)}</p>
              </div>
            )}
          </div>

          {/* TWG Review Access Test */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">TWG Review Access Test</h2>
            <div className="space-y-2">
              <p><strong>Authentication:</strong> {user ? '✅ Authenticated' : '❌ Not authenticated'}</p>
              <p><strong>Has any role:</strong> {roleData && roleData.length > 0 ? '✅ Yes' : '❌ No'}</p>
              <p><strong>Can access review_submissions:</strong> {!tableError ? '✅ Yes' : '❌ No'}</p>
              <p><strong>Should be able to access TWG Review:</strong> {
                user && roleData && roleData.length > 0 && !tableError ? '✅ Yes' : '❌ No'
              }</p>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-blue-50 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Recommendations</h2>
            {!roleData || roleData.length === 0 ? (
              <div className="text-red-600">
                <p><strong>Issue:</strong> User has no roles assigned</p>
                <p><strong>Solution:</strong> The user needs to be assigned a 'member' role. This should happen automatically when they sign up, but it seems the trigger didn't work.</p>
                <p><strong>Manual fix:</strong> An admin can assign the role through the admin dashboard, or the database trigger needs to be fixed.</p>
              </div>
            ) : tableError ? (
              <div className="text-red-600">
                <p><strong>Issue:</strong> Database table access problem</p>
                <p><strong>Solution:</strong> The review_submissions table needs to be created or the RLS policies need to be fixed.</p>
              </div>
            ) : (
              <div className="text-green-600">
                <p>✅ Everything looks good! The user should be able to access the TWG Review page.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
