import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import { DraPublishControl } from '@/components/matrix-map/DraPublishControl';
import ErrorBoundary from '@/components/ErrorBoundary';

export default async function MatrixMapPublishPage() {
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
          } catch {
            // safe to ignore
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // safe to ignore
          }
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'matrix_admin']);

  const isAdmin = Array.isArray(roles) && roles.length > 0;

  if (!isAdmin) {
    redirect('/dashboard');
  }

  const { data: initialDras } = await supabase
    .schema('matrix_map')
    .from('dras')
    .select('id, title, agency, year, public')
    .eq('is_deleted', false)
    .order('title');

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900 text-white shadow-2xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">
                DRA Publish Control
              </h1>
              <p className="text-base text-sky-200 max-w-3xl mx-auto">
                Toggle the publication status of Data Request Applications (DRAs).
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <DraPublishControl initialDras={initialDras || []} isAdmin={isAdmin} />
        </div>
      </div>
    </ErrorBoundary>
  );
}
