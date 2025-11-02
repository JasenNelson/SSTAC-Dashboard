// src/app/(dashboard)/admin/page.tsx
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import AdminDashboardClient from './AdminDashboardClient';

export default async function AdminDashboardPage() {
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
          try { cookieStore.set({ name, value, ...options }); } catch (error) {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch (error) {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Check if user has admin role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  const isAdmin = !!roleData;
  
  if (!isAdmin) {
    redirect('/dashboard');
  }

  // Fetch key metrics with real data
  const [
    usersResult,
    documentsResult,
    discussionsResult,
    announcementsResult,
    milestonesResult,
    pollVotesResult
  ] = await Promise.all([
    // Total users
    supabase
      .from('user_roles')
      .select('id', { count: 'exact' }),
    
    // Documents this month
    supabase
      .from('documents')
      .select('id', { count: 'exact' })
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    
    // Total discussion threads
    supabase
      .from('discussions')
      .select('id', { count: 'exact' }),
    
    // Active announcements
    supabase
      .from('announcements')
      .select('id', { count: 'exact' })
      .eq('is_active', true),
    
    // Milestones
    supabase
      .from('milestones')
      .select('id, status', { count: 'exact' }),
    
    // Total poll votes (from both poll_votes and ranking_votes tables)
    Promise.all([
      supabase
        .from('poll_votes')
        .select('id', { count: 'exact' }),
      supabase
        .from('ranking_votes')
        .select('id', { count: 'exact' })
    ])
  ]);

  const completedMilestones = milestonesResult.data?.filter(m => m.status === 'completed').length || 0;
  const totalPollVotes = (pollVotesResult[0].count || 0) + (pollVotesResult[1].count || 0);

  const metrics = {
    totalUsers: usersResult.count || 0,
    newDocumentsThisMonth: documentsResult.count || 0,
    totalDiscussionThreads: discussionsResult.count || 0,
    activeAnnouncements: announcementsResult.count || 0,
    totalMilestones: milestonesResult.count || 0,
    completedMilestones,
    totalPollVotes
  };

  return <AdminDashboardClient metrics={metrics} />;
}
