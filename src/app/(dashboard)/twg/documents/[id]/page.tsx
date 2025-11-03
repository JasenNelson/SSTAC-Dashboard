// src/app/(dashboard)/twg/documents/[id]/page.tsx
import Link from 'next/link';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import DeleteButton from '@/components/dashboard/DeleteButton';

export const dynamic = 'force-dynamic';

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
          try { cookieStore.set({ name, value, ...options }); } catch (_error) {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch (_error) {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: document, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !document) {
    notFound();
  }

  // Check if user has admin role in user_roles table
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single();

  const isAdmin = !!roleData;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link 
            href="/twg/documents" 
            className="text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            &larr; Back to all documents
          </Link>
        </div>

        <article className="bg-white rounded-lg shadow-md p-6 md:p-8">
          <header className="border-b pb-4 mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
              {document.title || 'Untitled Document'}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Created on: {new Date(document.created_at).toLocaleString()}
            </p>
            {isAdmin && (
              <div className="mt-4 flex gap-4 items-center">
                <Link
                  href={`/twg/documents/${document.id}/edit`}
                  className="text-sm text-indigo-600 hover:text-indigo-800 underline"
                >
                  Edit
                </Link>
                <DeleteButton 
                  documentId={document.id} 
                  documentTitle={document.title || 'Untitled Document'} 
                />
              </div>
            )}
          </header>

          <div className="prose max-w-none">
            {document.file_url ? (
              <p className="mb-4">
                <a
                  href={document.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-800 underline"
                >
                  Link to file
                </a>
              </p>
            ) : (
              <p className="mb-4">This document has no file.</p>
            )}

            {document.description ? (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Description</h2>
                <p className="text-gray-700 whitespace-pre-line">{document.description}</p>
              </div>
            ) : (
              <p className="text-gray-500">No description provided.</p>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}