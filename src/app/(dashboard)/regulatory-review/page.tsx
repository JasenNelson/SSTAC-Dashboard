// src/app/(dashboard)/regulatory-review/page.tsx
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import ErrorBoundary from '@/components/ErrorBoundary';
import { getSubmissions, getSubmissionById, type Submission } from '@/lib/sqlite/queries';
import { getReviewProjects, updateReviewProject } from '@/lib/sqlite/queries/review-projects';
import LandingPageClient from './components/LandingPageClient';
import type { ReviewProjectDisplay } from './components/LandingPageClient';
import { type DisplaySubmission } from './components';

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

  // Fetch review projects
  let projectsDisplay: ReviewProjectDisplay[] = [];
  try {
    const rawProjects = getReviewProjects();

    // Reconcile stale statuses: if a submission exists for a project
    // that's stuck in a pre-evaluated state, correct it to 'evaluated'.
    const STALE_STATUSES = ['created', 'extracted', 'extracting', 'evaluating'];
    for (const p of rawProjects) {
      if (STALE_STATUSES.includes(p.status)) {
        try {
          const sub = getSubmissionById(p.id);
          if (sub) {
            updateReviewProject(p.id, { status: 'evaluated' });
            p.status = 'evaluated';
          }
        } catch {
          // Non-critical — skip reconciliation on error
        }
      }
    }

    projectsDisplay = rawProjects.map((p) => {
      let selectedServices: string[] = [];
      try {
        selectedServices = JSON.parse(p.selected_services);
      } catch {
        selectedServices = [];
      }
      return {
        id: p.id,
        siteId: p.site_id,
        siteName: p.site_name,
        applicantName: p.applicant_name,
        applicationTypes: (() => {
          try { return JSON.parse(p.application_type); }
          catch { return [p.application_type]; }
        })(),
        selectedServices,
        status: p.status,
        fileCount: 0, // File count requires a join; populated on detail view
        createdAt: p.created_at,
      };
    });
  } catch (error) {
    console.error('Error fetching review projects:', error);
  }

  return (
    <ErrorBoundary>
      <LandingPageClient
        submissions={submissions}
        projects={projectsDisplay}
      />
    </ErrorBoundary>
  );
}
