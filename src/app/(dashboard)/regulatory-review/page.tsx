// src/app/(dashboard)/regulatory-review/page.tsx
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import ErrorBoundary from '@/components/ErrorBoundary';
import { getSubmissions, type Submission } from '@/lib/sqlite/queries';
import { SubmissionCard, type DisplaySubmission } from './components';

function transformSubmission(sub: Submission): DisplaySubmission {
  // Determine status based on review progress
  let status: 'pending' | 'in_progress' | 'complete' = 'pending';
  const totalReviewed = sub.pass_count + sub.fail_count + sub.partial_count;
  if (totalReviewed === 0 && sub.requires_judgment_count > 0) {
    status = 'pending';
  } else if (totalReviewed > 0 && sub.requires_judgment_count > 0) {
    status = 'in_progress';
  } else if (sub.requires_judgment_count === 0) {
    status = 'complete';
  }

  return {
    id: sub.id,
    siteId: sub.site_id,
    type: sub.submission_type,
    status,
    totalItems: sub.total_items,
    passCount: sub.pass_count,
    failCount: sub.fail_count,
    pendingCount: sub.requires_judgment_count,
    submittedAt: sub.evaluation_started || sub.imported_at,
    submittedBy: 'AI Evaluation',
  };
}


export default async function RegulatoryReviewPage() {
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
          } catch (_error) {
            // Server Component cookie handling
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (_error) {
            // Server Component cookie handling
          }
        },
      },
    }
  );

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login?redirect=/regulatory-review');
  }

  // Fetch submissions from SQLite
  let submissions: DisplaySubmission[] = [];
  try {
    const rawSubmissions = getSubmissions();
    submissions = rawSubmissions.map(transformSubmission);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    // Fallback to empty array if database not initialized
  }

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-gray-500">
              {submissions.length} submission{submissions.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            disabled
          >
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import Evaluation
          </button>
        </div>

        {/* Submissions Grid */}
        {submissions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {submissions.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No submissions</h3>
            <p className="mt-2 text-sm text-gray-500">
              No regulatory review submissions have been imported yet.
            </p>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
