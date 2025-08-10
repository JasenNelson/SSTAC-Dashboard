// app/dashboard/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import Header from '@/components/Header'; // Assuming Header is in components folder

export default async function DashboardPage() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    // This protects the page from unauthenticated users.
    redirect('/login');
  }

  return (
    <div>
      <Header />
      <main className="p-8">
        <h1 className="text-3xl font-bold">Welcome to your Dashboard</h1>
        <p className="mt-4">This is a protected page. You can only see this if you are logged in.</p>
        <p className="mt-2">Your email: {session.user.email}</p>
      </main>
    </div>
  );
}
