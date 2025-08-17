// src/app/(dashboard)/admin/page.tsx
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { 
  Users, 
  Tags, 
  Bell, 
  Calendar, 
  FileText, 
  MessageSquare,
  BarChart3,
  Settings
} from 'lucide-react';
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
    .single();

  const isAdmin = !!roleData;
  
  if (!isAdmin) {
    redirect('/dashboard');
  }

  // Fetch key metrics (we'll implement these with real data later)
  // For now, using placeholder data to get the UI working
  const metrics = {
    totalUsers: 12,
    newDocumentsThisMonth: 8,
    totalDiscussionThreads: 15,
    activeAnnouncements: 3,
    totalMilestones: 7,
    completedMilestones: 4
  };

  return <AdminDashboardClient metrics={metrics} />;
}
